import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { sanitizeId, sanitizeString, sanitizeNotes } from '@/lib/validation/sanitize'
import { notifyOrderEvent } from '@/lib/sse/notify'
import { fetchAndSerializeOrder } from '@/lib/utils/serialize-order'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId: rawUserId,
      items,
      tableName: rawTableName,
      numGuests,
      locationType,
      notes: rawNotes,
      sessionId: rawSessionId,
    } = body

    const userId           = sanitizeId(rawUserId || '')
    const sessionId        = rawSessionId ? sanitizeId(rawSessionId) : undefined
    const tableName        = sanitizeString(rawTableName || '') || 'N/A'
    const notes            = sanitizeNotes(rawNotes || '')
    const sanitizedGuests  = Math.min(Math.max(parseInt(numGuests) || 1, 1), 50)
    const hasStaffMeal     = notes === 'REGULAR_STAFF_MEAL'

    if (!userId || (!hasStaffMeal && (!items || items.length === 0))) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userId and at least one item' },
        { status: 400 },
      )
    }

    // ── Auth guard ───────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization')
    const token      = authHeader?.replace('Bearer ', '') ?? ''

    // Check if the request comes from a KITCHEN/ADMIN user creating on behalf of another user
    let isStaffCreating = false
    if (token && token !== 'null' && token !== 'undefined') {
      const requester = await prisma.user.findFirst({
        where: { sessionToken: token },
        select: { id: true, role: true, sessionExpiresAt: true },
      })
      if (requester) {
        const requesterRole = (requester.role || '').toUpperCase()
        if ((requesterRole === 'KITCHEN' || requesterRole === 'ADMIN') &&
            requester.sessionExpiresAt && requester.sessionExpiresAt > new Date()) {
          isStaffCreating = true
          // Extend the kitchen/admin session
          prisma.user.update({
            where: { id: requester.id },
            data: { sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          }).catch(() => {})
        }
      }
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:              true,
        name:            true,
        email:           true,
        role:            true,
        sessionToken:    true,
        sessionExpiresAt: true,
        guestSessions:   {
          where: { status: 'active' },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!userRecord) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const tokenValid =
      token &&
      token !== 'null' &&
      token !== 'undefined' &&
      userRecord.sessionToken === token &&
      userRecord.sessionExpiresAt &&
      userRecord.sessionExpiresAt > new Date()

    const hasActiveSession = userRecord.guestSessions.length > 0

    // Also allow if sessionId was passed and belongs to this user
    let sessionBelongsToUser = false
    if (!tokenValid && !hasActiveSession && !isStaffCreating && sessionId) {
      const sess = await prisma.guestSession.findFirst({
        where: { id: sessionId, userId, status: 'active' },
        select: { id: true },
      })
      sessionBelongsToUser = !!sess
    }

    if (!isStaffCreating && !tokenValid && !hasActiveSession && !sessionBelongsToUser) {
      console.warn(`[CREATE ORDER] Unauthorized attempt for userId=${userId}`)
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 },
      )
    }

    // Sliding-window session extension for direct user token
    if (tokenValid && !isStaffCreating) {
      prisma.user
        .update({
          where: { id: userId },
          data: { sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        })
        .catch(() => {})
    }
    // ─────────────────────────────────────────────────────────────────────

    const rawRole     = (userRecord.role ?? '').toUpperCase()
    const normalRole  = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN' : rawRole === 'GUEST' ? 'OUTSIDER' : rawRole

    if (hasStaffMeal && normalRole !== 'STAFF') {
      return NextResponse.json(
        { success: false, error: 'Regular Staff Meal is available to STAFF only' },
        { status: 403 },
      )
    }

    // ── Fetch + validate menu items ───────────────────────────────────────
    const itemIds   = Array.isArray(items) ? items.map((i: { itemId?: string }) => sanitizeId(i.itemId || '')) : []
    const menuItems = itemIds.length
      ? await prisma.menuItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true, price: true, available: true },
        })
      : []

    let serverTotal = 0
    const orderItemsData: { menuItemId: string; quantity: number; price: number }[] = []

    for (const item of (Array.isArray(items) ? items : []) as { itemId?: string; quantity?: number }[]) {
      const sanitizedId = sanitizeId(item.itemId || '')
      const menuItem    = menuItems.find((m) => m.id === sanitizedId)
      if (!menuItem) {
        return NextResponse.json({ success: false, error: `Item ${sanitizedId} not found` }, { status: 400 })
      }
      if (!menuItem.available) {
        return NextResponse.json({ success: false, error: `${menuItem.name} is currently unavailable` }, { status: 400 })
      }
      const qty       = Math.min(Math.max(parseInt(String(item.quantity)) || 1, 1), 100)
      serverTotal    += Number(menuItem.price) * qty
      orderItemsData.push({ menuItemId: sanitizedId, quantity: qty, price: Number(menuItem.price) })
    }

    // ── Create order ──────────────────────────────────────────────────────
    const order = await prisma.order.create({
      data: {
        userId,
        guestInfo: normalRole === 'OUTSIDER'
          ? { name: userRecord.name, email: userRecord.email }
          : undefined,
        tableName,
        locationType: locationType === 'indoor' || locationType === 'outdoor' ? locationType : undefined,
        numGuests: sanitizedGuests,
        total: serverTotal,
        notes,
        sessionId: sessionId || undefined,
        status: 'pending',
        orderItems: {
          create: orderItemsData.map((i) => ({
            menuItemId: i.menuItemId,
            quantity:   i.quantity,
            price:      i.price,
          })),
        },
      },
      select: { id: true },
    })

    // Push FULL order via SSE — kitchen renders it instantly with zero extra fetch
    // fetchAndSerializeOrder runs after the transaction so all relations are readable
    const serialized = await fetchAndSerializeOrder(order.id)
    if (serialized) {
      await notifyOrderEvent('order_created', serialized as unknown as Record<string, unknown>)
    } else {
      // Fallback stub — client will call fetchSingleOrder(id)
      await notifyOrderEvent('order_created', { id: order.id, _needsFetch: true })
    }

    // ── Email summary (non-blocking) ──────────────────────────────────────
    if (userRecord.email) {
      try {
        const { sendEmail } = await import('@/lib/utils/email')
        const itemsHtml = (Array.isArray(items) ? items : [])
          .map((item: { itemId?: string; quantity?: number }) => {
            const m = menuItems.find((x) => x.id === item.itemId)
            return `<li>${m?.name ?? 'Item'} x ${item.quantity} — ₹${(Number(m?.price) || 0) * (Number(item.quantity) || 1)}</li>`
          })
          .join('')
        sendEmail({
          to:      userRecord.email,
          subject: `Order Confirmed: ${tableName} — Ai Cavalli`,
          html: `<div style="font-family:sans-serif;padding:20px">
            <h2 style="color:#c0272d">Grazie, ${userRecord.name}!</h2>
            <p>Your order for <strong>Table ${tableName}</strong> is being prepared.</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Total: ₹${serverTotal}</strong></p>
          </div>`,
        }).catch((e: Error) => console.error('[CREATE ORDER] Email failed:', e.message))
      } catch {}
    }

    return NextResponse.json({ success: true, orderId: order.id, total: serverTotal, message: 'Order created successfully' })
  } catch (error) {
    console.error('[POST /api/orders/create]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
