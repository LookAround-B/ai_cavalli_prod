import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { sanitizeId, sanitizePaymentMethod } from '@/lib/validation/sanitize'

/**
 * End Session API
 * Uses Prisma ORM — authenticates via session token lookup (no Supabase Auth)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const sessionId = sanitizeId(body.sessionId || '')
        const paymentMethod = sanitizePaymentMethod(body.paymentMethod)

        if (!sessionId) {
            return NextResponse.json({ success: false, error: 'Valid session ID is required' }, { status: 400 })
        }

        // AUTH GUARD: Verify requester via session token
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Authorization header missing' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const requester = await prisma.user.findFirst({
            where: { sessionToken: token },
            select: { id: true, role: true }
        })

        if (!requester) {
            return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 })
        }

        const isStaff = ['STAFF', 'ADMIN', 'KITCHEN'].includes((requester.role || '').toUpperCase())

        // Get session with all orders
        const session = await prisma.guestSession.findUnique({
            where: { id: sessionId },
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
            return NextResponse.json(
                { success: false, error: 'Session not found' },
                { status: 404 }
            )
        }

        // VERIFY OWNERSHIP
        if (!isStaff && session.userId !== requester.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized to end this session' }, { status: 403 })
        }

        if (session.status !== 'active') {
            return NextResponse.json(
                { success: false, error: 'Session already ended' },
                { status: 400 }
            )
        }

        const orders = session.orders || []
        if (orders.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No orders in this session' },
                { status: 400 }
            )
        }

        const totalAmount = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

        // Fetch user email if linked
        let userEmail: string | null = null
        let emailResult = { success: false, error: 'No email found for user' }
        if (session.userId) {
            const userData = await prisma.user.findUnique({
                where: { id: session.userId },
                select: { email: true }
            })
            userEmail = userData?.email ?? null
        }

        // Send Email Bill if email available
        if (userEmail) {
            try {
                const { sendOrderBillEmail } = require('@/lib/utils/email')

                const allItems: any[] = []
                orders.forEach((order) => {
                    order.orderItems.forEach((item) => {
                        allItems.push({
                            name: item.menuItem?.name || 'Item',
                            quantity: item.quantity,
                            price: Number(item.price)
                        })
                    })
                })

                emailResult = await sendOrderBillEmail(userEmail, {
                    sessionId: session.id,
                    items: allItems,
                    totalAmount
                })
            } catch (e) {
                emailResult = { success: false, error: 'Email sending failed' }
            }
        }

        // Update session status
        await prisma.guestSession.update({
            where: { id: sessionId },
            data: {
                status: 'ended',
                endedAt: new Date(),
                totalAmount,
                paymentMethod,
                whatsappSent: false,
            }
        })

        return NextResponse.json({
            success: true,
            session: {
                id: sessionId,
                totalAmount,
                orderCount: orders.length,
                emailSent: emailResult.success,
                emailError: emailResult.error
            },
            message: emailResult.success
                ? 'Session ended! Bill sent to your email successfully.'
                : `Session ended. ${emailResult.error}`
        })
    } catch (error) {
        console.error('End session error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
