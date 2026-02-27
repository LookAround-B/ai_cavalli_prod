import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'

/**
 * Session refresh endpoint
 * Validates session token against DB and returns fresh user data
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ success: false, error: 'No session token' }, { status: 401 })
        }

        const user = await prisma.user.findFirst({
            where: { sessionToken: token },
            select: {
                id: true,
                email: true,
                phone: true,
                name: true,
                role: true,
                parentName: true,
                position: true,
                createdAt: true,
                sessionToken: true,
                sessionExpiresAt: true,
            },
        })

        if (!user) {
            return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
        }

        // Check expiration
        if (user.sessionExpiresAt && user.sessionExpiresAt < new Date()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { sessionToken: null, sessionExpiresAt: null },
            })
            return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 })
        }

        // Normalize role
        const rawRole = (user.role || '').toUpperCase()
        const normalizedRole = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN'
            : rawRole === 'GUEST' ? 'OUTSIDER'
            : rawRole

        const safeUser = {
            id: user.id,
            email: user.email,
            phone: user.phone,
            name: user.name,
            role: normalizedRole,
            parent_name: user.parentName,
            position: user.position,
            created_at: user.createdAt.toISOString()
        }

        return NextResponse.json({
            success: true,
            user: safeUser,
            session: { session_token: token }
        })
    } catch (error) {
        console.error('Refresh error:', error)
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
    }
}
