import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'

const ADMIN_ROLES = ['ADMIN', 'KITCHEN']

async function authenticateAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim() || request.cookies.get('session_token')?.value
    const userId = request.headers.get('X-User-Id')

    if (token) {
        const requester = await prisma.user.findFirst({
            where: { sessionToken: token },
            select: { id: true, role: true, sessionExpiresAt: true }
        })

        if (requester) {
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

    if (!token && !userId) return { authenticated: false, error: 'Not authenticated' }
    return { authenticated: false, error: 'Invalid session' }
}

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const data = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' }
        })

        // Map to snake_case for frontend compat
        const mapped = data.map((a: any) => ({
            id: a.id, title: a.title, description: a.description,
            image_url: a.imageUrl, link: a.link, active: a.active,
            created_at: a.createdAt
        }))

        return NextResponse.json({ success: true, data: mapped })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Fetch announcements error:', error)
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateAdmin(request)
        if (!auth.authenticated) {
            const status = auth.error === 'Admin privileges required' ? 403 : 401
            return NextResponse.json({ success: false, error: auth.error }, { status })
        }

        const { action, payload } = await request.json()

        if (action === 'create') {
            const { title, description, link, image_url, active = true } = payload || {}

            if (!title || !String(title).trim()) {
                return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
            }

            await prisma.announcement.create({
                data: {
                    title: String(title).trim(),
                    description: description || null,
                    link: link || null,
                    imageUrl: image_url || null,
                    active: Boolean(active),
                }
            })

            return NextResponse.json({ success: true, message: 'Announcement created successfully' })
        }

        if (action === 'delete') {
            const { id } = payload || {}
            if (!id) {
                return NextResponse.json({ success: false, error: 'Announcement id is required' }, { status: 400 })
            }

            await prisma.announcement.delete({ where: { id } })

            return NextResponse.json({ success: true, message: 'Announcement deleted successfully' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error'
        console.error('Admin announcements operation error:', error)
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
