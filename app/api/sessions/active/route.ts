import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { sanitizeId, sanitizePhone } from '@/lib/validation/sanitize'

/**
 * Get Active Session API
 * Retrieves the active dining session for a guest by phone number.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const phone = searchParams.get('phone')
        const userId = searchParams.get('userId')

        if (!phone && !userId) {
            return NextResponse.json(
                { success: false, error: 'Phone or userId is required' },
                { status: 400 }
            )
        }

        const sanitizedPhone = sanitizePhone(phone || '')
        const sanitizedUserId = userId ? sanitizeId(userId) : ''

        const where: Record<string, unknown> = { status: 'active' }
        if (sanitizedPhone) {
            where.guestPhone = sanitizedPhone
        } else if (sanitizedUserId) {
            where.userId = sanitizedUserId
        }

        const session = await prisma.guestSession.findFirst({
            where,
            include: {
                orders: {
                    include: {
                        orderItems: {
                            include: { menuItem: { select: { name: true } } }
                        }
                    }
                }
            }
        })

        if (!session) {
            return NextResponse.json({ success: true, session: null })
        }

        const orders = session.orders || []
        const orderCount = orders.length
        const totalFromOrders = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

        // Map to snake_case for frontend compat
        const mappedOrders = orders.map(o => ({
            id: o.id,
            total: Number(o.total),
            discount_amount: Number(o.discountAmount || 0),
            created_at: o.createdAt,
            status: o.status,
            order_items: o.orderItems.map(oi => ({
                id: oi.id,
                quantity: oi.quantity,
                price: Number(oi.price),
                menu_items: oi.menuItem ? { name: oi.menuItem.name } : null,
            }))
        }))

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                guest_phone: session.guestPhone,
                guest_name: session.guestName,
                table_name: session.tableName,
                num_guests: session.numGuests,
                started_at: session.startedAt,
                ended_at: session.endedAt,
                total_amount: Number(session.totalAmount),
                status: session.status,
                payment_method: session.paymentMethod,
                payment_status: session.paymentStatus,
                bill_requested: session.billRequested,
                bill_requested_at: session.billRequestedAt,
                user_id: session.userId,
                created_at: session.createdAt,
                orders: mappedOrders,
                orderCount,
                calculatedTotal: totalFromOrders
            }
        })
    } catch (error) {
        console.error('Active session error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
