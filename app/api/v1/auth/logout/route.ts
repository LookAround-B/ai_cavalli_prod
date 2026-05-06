import { NextRequest, NextResponse } from 'next/server'
import { clearSessionToken, logAuthAction } from '@/lib/auth/utils'

/**
 * Logout endpoint - clears session token from DB
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const userId = body.userId

        if (userId) {
            await clearSessionToken(userId)
            await logAuthAction(userId, 'logout')
        }

        return NextResponse.json({ success: true, message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error:', error)
        return NextResponse.json({ success: true, message: 'Logged out' })
    }
}

export async function GET() {
    return NextResponse.json({ success: true, message: 'Logged out' })
}
