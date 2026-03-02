import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import type { UserRole } from '@/lib/types/auth'

const ADMIN_ROLES = ['ADMIN', 'KITCHEN']

/**
 * Authenticate an admin user from the request.
 * Strategy 1: session_token DB lookup
 * Strategy 2: user ID + verify admin role (fallback)
 */
async function authenticateAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim() || request.cookies.get('session_token')?.value
    const userId = request.headers.get('X-User-Id')

    // Strategy 1: session_token DB lookup
    if (token) {
        const requester = await prisma.user.findFirst({
            where: { sessionToken: token },
            select: { id: true, role: true, sessionExpiresAt: true }
        })

        if (requester) {
            // Auto-extend expired sessions
            if (requester.sessionExpiresAt && requester.sessionExpiresAt < new Date()) {
                await prisma.user.update({
                    where: { id: requester.id },
                    data: { sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
                })
            }

            const role = (requester.role || '').toUpperCase()
            if (ADMIN_ROLES.includes(role)) {
                return { authenticated: true, requester }
            }
            return { authenticated: false, error: 'Admin privileges required' }
        }
    }

    // Strategy 2: user ID lookup
    if (userId) {
        const requester = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true }
        })

        if (requester) {
            const role = (requester.role || '').toUpperCase()
            if (ADMIN_ROLES.includes(role)) {
                return { authenticated: true, requester }
            }
            return { authenticated: false, error: 'Admin privileges required' }
        }
    }

    if (!token && !userId) {
        return { authenticated: false, error: 'Not authenticated' }
    }

    return { authenticated: false, error: 'Invalid session' }
}

/**
 * GET /api/admin/users — Fetch all users
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const users = await prisma.user.findMany({
            select: {
                id: true, phone: true, email: true, name: true,
                role: true, parentName: true, createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        })

        // Map to snake_case for frontend compat
        const data = users.map((u: any) => ({
            id: u.id, phone: u.phone, email: u.email, name: u.name,
            role: u.role, parent_name: u.parentName, created_at: u.createdAt
        }))

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error('Fetch users error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/users — Create, update, or delete users
 */
export async function POST(request: NextRequest) {
    try {
        const { action, userData } = await request.json()

        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        if (action === 'create') {
            const { name, phone, email, pin, role, parent_name } = userData
            const userEmail = email || (phone ? `${phone}@aicavalli.local` : `user_${Date.now()}@aicavalli.local`)

            await prisma.user.create({
                data: {
                    name,
                    phone,
                    email: userEmail,
                    pin,
                    role: role as UserRole,
                    parentName: role === 'RIDER' ? parent_name : null,
                }
            })

            return NextResponse.json({ success: true, message: 'User created successfully' })

        } else if (action === 'update') {
            const { id, name, phone, email, pin, role, parent_name } = userData

            const data: any = {
                name,
                phone,
                role: role as UserRole,
                parentName: role === 'RIDER' ? parent_name : null,
            }
            if (email) data.email = email
            if (pin) data.pin = pin

            await prisma.user.update({ where: { id }, data })

            return NextResponse.json({ success: true, message: 'User updated successfully' })

        } else if (action === 'delete') {
            const { id } = userData

            await prisma.$transaction(async (tx) => {
                // Remove related records (foreign key constraints)
                const userOrders = await tx.order.findMany({
                    where: { userId: id },
                    select: { id: true }
                })
                const orderIds = userOrders.map(o => o.id)

                if (orderIds.length > 0) {
                    await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
                    await tx.order.deleteMany({ where: { id: { in: orderIds } } })
                }
                await tx.guestSession.deleteMany({ where: { userId: id } })
                await tx.user.delete({ where: { id } })
            })

            return NextResponse.json({ success: true, message: 'User deleted successfully' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    } catch (error: any) {
        console.error('Admin user operation error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
