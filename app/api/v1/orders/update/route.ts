import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { sanitizeId, sanitizeNotes } from '@/lib/validation/sanitize'
import { notifyOrderEvent } from '@/lib/sse/notify'

export async function PUT(request: NextRequest) {
  try {
    const body    = await request.json()
    const orderId = sanitizeId(body.orderId || '')
    const userId  = sanitizeId(body.userId  || '')
    const items   = Array.isArray(body.items) ? body.items : []
    const notes   = body.notes !== undefined ? sanitizeNotes(body.notes || '') : undefined

    if (!orderId || !userId || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: orderId, userId, and at least one item' },
        { status: 400 },
      )
    }

    // ── Auth guard: single DB query ──────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    const token      = authHeader?.replace('Bearer ', '') ?? ''

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:               true,
        sessionToken:     true,
        sessionExpiresAt: true,
        guestSessions: {
          where: { status: 'active' },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!userRecord) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const tokenValid =
      token &&
      token !== 'null' &&
      token !== 'undefined' &&
      userRecord.sessionToken === token &&
      userRecord.sessionExpiresAt &&
      userRecord.sessionExpiresAt > new Date()

    const hasActiveSession = userRecord.guestSessions.length > 0

    if (!tokenValid && !hasActiveSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    // Sliding-window session extension (fire-and-forget)
    if (tokenValid) {
      prisma.user
        .update({
          where: { id: userId },
          data: { sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        })
        .catch(() => {})
    }
    // ─────────────────────────────────────────────────────────────────────

    // Verify order belongs to user and is still editable
    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true },
    })

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: 'Order not found or does not belong to you' },
        { status: 404 },
      )
    }

    if (['ready', 'completed', 'cancelled'].includes(existingOrder.status)) {
      return NextResponse.json(
        { success: false, error: 'This order can no longer be modified.' },
        { status: 403 },
      )
    }

    // Fetch and validate current prices
    const itemIds  = items.map((i: { itemId?: string }) => sanitizeId(i.itemId || ''))
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, available: true },
    })

    let serverTotal = 0
    const validated: { orderId: string; menuItemId: string; quantity: number; price: number }[] = []

    for (const item of items as { itemId?: string; quantity?: number }[]) {
      const sid      = sanitizeId(item.itemId || '')
      const menuItem = menuItems.find((m) => m.id === sid)
      if (!menuItem) {
        return NextResponse.json({ success: false, error: `Item ${sid} not found` }, { status: 400 })
      }
      if (!menuItem.available) {
        return NextResponse.json({ success: false, error: `${menuItem.name} is currently unavailable` }, { status: 400 })
      }
      const qty     = Math.min(Math.max(parseInt(String(item.quantity)) || 1, 1), 100)
      serverTotal  += Number(menuItem.price) * qty
      validated.push({ orderId, menuItemId: sid, quantity: qty, price: Number(menuItem.price) })
    }

    // Atomic update
    const [, , updated] = await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId } }),
      prisma.orderItem.createMany({ data: validated }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          total: serverTotal,
          ...(notes !== undefined ? { notes } : {}),
        },
        select: { id: true, updatedAt: true },
      }),
    ])

    await notifyOrderEvent('order_updated', {
      id:        updated.id,
      updatedAt: updated.updatedAt.toISOString(),
    })

    return NextResponse.json({ success: true, orderId, total: serverTotal, message: 'Order updated successfully' })
  } catch (error) {
    console.error('[PUT /api/orders/update]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
