import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { sanitizeId, sanitizeOrderStatus, sanitizeLimit, sanitizeDate } from '@/lib/validation/sanitize'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = sanitizeId(searchParams.get('userId') || '')
    const orderId = sanitizeId(searchParams.get('orderId') || '')
    const status = sanitizeOrderStatus(searchParams.get('status') || '')
    const limit = sanitizeLimit(searchParams.get('limit') || '100')
    const includeAll = searchParams.get('all') === 'true' // for admin/kitchen
    const startDate = sanitizeDate(searchParams.get('startDate') || '')
    const endDate = sanitizeDate(searchParams.get('endDate') || '')

    const where: any = {}

    if (orderId) {
      where.id = orderId
    } else if (userId && !includeAll) {
      where.userId = userId
    }

    if (status.length > 0) {
      where.status = { in: status }
    }

    if (startDate) {
      where.createdAt = { ...(where.createdAt || {}), gte: new Date(`${startDate}T00:00:00`) }
    }
    if (endDate) {
      where.createdAt = { ...(where.createdAt || {}), lte: new Date(`${endDate}T23:59:59`) }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { role: true, name: true, phone: true, parentName: true, email: true } },
        bill: { select: { paymentMethod: true } },
        orderItems: {
          include: {
            menuItem: {
              include: { category: { select: { name: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: orders.map(o => ({
        id: o.id,
        user_id: o.userId,
        table_name: o.tableName,
        guest_info: o.guestInfo,
        status: o.status,
        total: Number(o.total),
        discount_amount: Number(o.discountAmount),
        ready_in_minutes: o.readyInMinutes,
        num_guests: o.numGuests,
        notes: o.notes,
        location_type: o.locationType,
        billed: o.billed,
        bill_payment_method: o.bill?.paymentMethod || null,
        created_at: o.createdAt.toISOString(),
        user: o.user ? {
          role: o.user.role,
          name: o.user.name,
          phone: o.user.phone,
          parent_name: o.user.parentName,
          email: o.user.email
        } : null,
        items: o.orderItems.map(i => ({
          id: i.id,
          menu_item_id: i.menuItemId,
          quantity: i.quantity,
          price: Number(i.price),
          menu_item: i.menuItem ? {
            id: i.menuItem.id,
            name: i.menuItem.name,
            category: i.menuItem.category ? { name: i.menuItem.category.name } : null
          } : null
        }))
      }))
    })
  } catch (error) {
    console.error('Orders fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 })
  }
}
