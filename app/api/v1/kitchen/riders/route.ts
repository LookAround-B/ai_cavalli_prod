import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { getAuthUser } from '@/lib/auth/api-middleware'

export async function GET(request: NextRequest) {
    const { user, error } = await getAuthUser(request)
    if (!user || error) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'KITCHEN' && user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    try {
        const riders = await prisma.user.findMany({
            where: { role: 'RIDER' },
            select: { id: true, name: true, phone: true, email: true, position: true },
            orderBy: { name: 'asc' },
        })

        return NextResponse.json({
            success: true,
            data: riders.map(r => ({
                id: r.id,
                name: r.name,
                phone: r.phone,
                email: r.email,
                position: r.position,
            })),
        })
    } catch (err) {
        console.error('Riders fetch error:', err)
        return NextResponse.json({ success: false, error: 'Failed to fetch riders' }, { status: 500 })
    }
}
