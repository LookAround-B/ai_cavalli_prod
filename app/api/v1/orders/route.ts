import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { sanitizeId, sanitizeOrderStatus, sanitizeLimit, sanitizeDate } from '@/lib/validation/sanitize'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId    = sanitizeId(searchParams.get('userId') || '')
    const orderId   = sanitizeId(searchParams.get('orderId') || '')
    const status    = sanitizeOrderStatus(searchParams.get('status') || '')
    const limit     = sanitizeLimit(searchParams.get('limit') || '100')
    const includeAll = searchParams.get('all') === 'true'
    const startDate = sanitizeDate(searchParams.get('startDate') || '')
    const endDate   = sanitizeDate(searchParams.get('endDate') || '')
    const fields    = searchParams.get('fields')          // 'minimal' for status-only poll
    const sinceRaw  = searchParams.get('since') || ''     // ISO timestamp — incremental fetch

    const where: Record<string, unknown> = {}

    if (orderId) {
      where.id = orderId
    } else if (userId && !includeAll) {
      where.userId = userId
    }

    if (status.length > 0) {
      where.status = { in: status }
    }

    if (startDate) {
      where.createdAt = { ...(where.createdAt as object || {}), gte: new Date(`${startDate}T00:00:00`) }
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt as object || {}), lte: new Date(`${endDate}T23:59:59`) }
    }

    // Incremental fetch: only return orders updated after 'since'
    if (sinceRaw) {
      const sinceDate = new Date(sinceRaw)
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gt: sinceDate }
      }
    }

    // ── Minimal mode: status + discount only (used by SSE fallback polls) ──
    if (fields === 'minimal') {
      const minimal = await prisma.order.findMany({
        where,
        select: {
          id: true,
          status: true,
          discountAmount: true,
          billed: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      })

      const etagMin = minimal.length > 0
        ? `"${minimal[0].updatedAt.toISOString()}"`
        : '"empty"'
      if (request.headers.get('If-None-Match') === etagMin) {
        return new Response(null, { status: 304 })
      }

      return NextResponse.json({ success: true, data: minimal }, {
        headers: { ETag: etagMin, 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
      })
    }

    // ── Full mode ──
    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { role: true, name: true, phone: true } },
        bill: { select: { paymentMethod: true } },
        orderItems: {
          include: {
            menuItem: {
              include: { category: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const data = orders.map((o) => ({
      id:                o.id,
      user_id:           o.userId,
      table_name:        o.tableName,
      guest_info:        o.guestInfo,
      status:            o.status,
      total:             Number(o.total),
      discount_amount:   Number(o.discountAmount),
      ready_in_minutes:  o.readyInMinutes,
      num_guests:        o.numGuests,
      notes:             o.notes,
      location_type:     o.locationType,
      billed:            o.billed,
      bill_payment_method: o.bill?.paymentMethod ?? null,
      created_at:        o.createdAt.toISOString(),
      updated_at:        o.updatedAt.toISOString(),
      user: o.user
        ? { role: o.user.role, name: o.user.name, phone: o.user.phone }
        : null,
      items: o.orderItems.map((i) => ({
        id:           i.id,
        menu_item_id: i.menuItemId,
        quantity:     i.quantity,
        price:        Number(i.price),
        menu_item:    i.menuItem
          ? {
              id:       i.menuItem.id,
              name:     i.menuItem.name,
              category: i.menuItem.category ? { name: i.menuItem.category.name } : null,
            }
          : null,
      })),
    }))

    // ETag based on the most recently updated order
    const etag = data.length > 0
      ? `"${data[0].updated_at}"`
      : '"empty"'

    if (request.headers.get('If-None-Match') === etag) {
      return new Response(null, { status: 304 })
    }

    return NextResponse.json({ success: true, data }, {
      headers: { ETag: etag, 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' },
    })
  } catch (error) {
    console.error('[GET /api/orders]', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 })
  }
}
