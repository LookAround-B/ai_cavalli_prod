import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { validateBody, bulkPriceIncreaseSchema } from '@/lib/validation/schemas'

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
 * POST /api/admin/menu/bulk-price-increase
 * Actions: preview | apply
 *
 * Preview: Calculate new prices for all menu items
 * Apply: Update all menu item prices and create price history records
 */
export async function POST(request: NextRequest) {
    try {
        // Validate request body
        const parsed = await validateBody(request, bulkPriceIncreaseSchema)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
        }

        // Authenticate admin
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { action, percentage, userId, reason } = parsed.data

        // Fetch all menu items
        const menuItems = await prisma.menuItem.findMany({
            select: {
                id: true,
                name: true,
                price: true,
            },
            orderBy: { name: 'asc' }
        })

        if (menuItems.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No menu items found'
            }, { status: 404 })
        }

        // Calculate new prices
        const preview = menuItems.map(item => {
            const oldPrice = Number(item.price)
            const increase = oldPrice * (percentage / 100)
            const newPrice = Number((oldPrice + increase).toFixed(2))

            return {
                id: item.id,
                name: item.name,
                oldPrice: oldPrice,
                newPrice: newPrice,
                increase: Number(increase.toFixed(2))
            }
        })

        // Calculate summary
        const totalIncrease = preview.reduce((sum, item) => sum + item.increase, 0)
        const avgIncrease = Number((totalIncrease / preview.length).toFixed(2))

        // If action is preview, return the calculated values
        if (action === 'preview') {
            return NextResponse.json({
                success: true,
                preview: preview,
                summary: {
                    totalItems: preview.length,
                    avgIncrease: avgIncrease
                }
            })
        }

        // If action is apply, update prices and create history records
        if (action === 'apply') {
            const adminUserId = userId || auth.requester?.id

            await prisma.$transaction(async (tx) => {
                // Update all menu item prices
                for (const item of preview) {
                    await tx.menuItem.update({
                        where: { id: item.id },
                        data: { price: item.newPrice.toFixed(2) }
                    })

                    // Create price history record
                    await tx.priceHistory.create({
                        data: {
                            menuItemId: item.id,
                            oldPrice: item.oldPrice.toFixed(2),
                            newPrice: item.newPrice.toFixed(2),
                            changeType: 'bulk_increase',
                            percentage: percentage.toFixed(2),
                            changedBy: adminUserId,
                            reason: reason || `Bulk price increase of ${percentage}%`
                        }
                    })
                }
            })

            return NextResponse.json({
                success: true,
                message: `Successfully updated ${preview.length} menu item prices`,
                updatedCount: preview.length
            })
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action'
        }, { status: 400 })

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Bulk price increase error:', error)
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        )
    }
}
