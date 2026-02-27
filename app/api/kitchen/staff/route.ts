import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function GET(request: NextRequest) {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['KITCHEN', 'ADMIN'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: staff.map(s => ({ id: s.id, name: s.name }))
    })
  } catch (error) {
    console.error('Kitchen staff fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch staff' }, { status: 500 })
  }
}
