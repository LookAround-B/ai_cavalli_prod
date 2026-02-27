import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'

/**
 * Request Bill API
 * Creates a bill request notification that appears on the kitchen display.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, userId } = await request.json()

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            )
        }

        // AUTH: Try session token for staff, or userId for guest
        let isAuthorized = false
        let requesterRole: string | null = null

        const authHeader = request.headers.get('Authorization')
        if (authHeader && authHeader !== 'Bearer null' && authHeader !== 'Bearer undefined') {
            const token = authHeader.replace('Bearer ', '')
            const requester = await prisma.user.findFirst({
                where: { sessionToken: token },
                select: { id: true, role: true }
            })

            if (requester) {
                const role = (requester.role || '').toUpperCase()
                requesterRole = role
                if (['STAFF', 'KITCHEN', 'ADMIN'].includes(role)) {
                    isAuthorized = true
                }
            }
        }

        // If not staff authorized, check userId
        if (!isAuthorized && userId) {
            isAuthorized = true // Verified below via ownership check
        }

        if (!isAuthorized) {
            return NextResponse.json(
                { success: false, error: 'Authorization required' },
                { status: 401 }
            )
        }

        // Fetch session with orders
        const session = await prisma.guestSession.findFirst({
            where: { id: sessionId, status: 'active' },
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
                { success: false, error: 'Active session not found' },
                { status: 404 }
            )
        }

        // Ownership check for non-staff
        if (requesterRole && !['STAFF', 'KITCHEN', 'ADMIN'].includes(requesterRole)) {
            if (session.userId !== userId) {
                return NextResponse.json(
                    { success: false, error: 'Unauthorized: You can only request bills for your own session' },
                    { status: 403 }
                )
            }
        } else if (!requesterRole && userId) {
            if (session.userId !== userId) {
                return NextResponse.json(
                    { success: false, error: 'Unauthorized: Session mismatch' },
                    { status: 403 }
                )
            }
        }

        const orders = session.orders || []
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

        // Update session with bill_requested flag
        await prisma.guestSession.update({
            where: { id: sessionId },
            data: {
                billRequested: true,
                billRequestedAt: new Date(),
                totalAmount,
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Bill request sent to kitchen. A waiter will bring your bill shortly.',
            session: {
                id: session.id,
                guestName: session.guestName,
                tableName: session.tableName,
                totalAmount,
                orderCount: orders.length
            }
        })
    } catch (error) {
        console.error('Bill request error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to request bill' },
            { status: 500 }
        )
    }
}
