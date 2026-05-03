import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import type { UserRole } from '@/lib/types/auth'
import { validateBody, adminUserActionSchema, createUserSchema, updateUserSchema, deleteUserSchema } from '@/lib/validation/schemas'

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
        const data = users.map((u) => ({
            id: u.id, phone: u.phone, email: u.email, name: u.name,
            role: u.role, parent_name: u.parentName, created_at: u.createdAt
        }))

        return NextResponse.json({ success: true, data })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Fetch users error:', error)
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/users — Create, update, or delete users
 */
export async function POST(request: NextRequest) {
    try {
        // Step 1: Validate action wrapper
        const actionParsed = await validateBody(request, adminUserActionSchema)
        if (!actionParsed.success) {
            return NextResponse.json({ success: false, error: actionParsed.error }, { status: 400 })
        }

        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { action, userData } = actionParsed.data

        if (action === 'create') {
            // Step 2: Validate user creation data
            const createResult = createUserSchema.safeParse(userData)
            if (!createResult.success) {
                const errors = createResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
                return NextResponse.json({ success: false, error: `Validation failed: ${errors}` }, { status: 400 })
            }

            const { name, phone, email, pin, role, parent_name } = createResult.data
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
            const updateResult = updateUserSchema.safeParse(userData)
            if (!updateResult.success) {
                const errors = updateResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
                return NextResponse.json({ success: false, error: `Validation failed: ${errors}` }, { status: 400 })
            }

            const { id, name, phone, email, pin, role, parent_name } = updateResult.data

            const data: Record<string, unknown> = {
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
            const deleteResult = deleteUserSchema.safeParse(userData)
            if (!deleteResult.success) {
                return NextResponse.json({ success: false, error: 'User id is required' }, { status: 400 })
            }

            const { id } = deleteResult.data

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
    } catch (error: unknown) {
        console.error('Admin user operation error:', error)

        // Prisma unique constraint violation
        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code: string }).code === 'P2002'
        ) {
            const fields = (error as { meta?: { target?: string[] } }).meta?.target ?? []
            const field = fields[0] ?? 'field'
            const label = field === 'phone' ? 'phone number' : field === 'email' ? 'email' : field
            return NextResponse.json(
                { success: false, error: `A user with this ${label} already exists.` },
                { status: 409 }
            )
        }

        return NextResponse.json(
            { success: false, error: 'Something went wrong. Please try again.' },
            { status: 500 }
        )
    }
}
