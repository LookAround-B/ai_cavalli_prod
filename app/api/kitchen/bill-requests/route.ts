import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function GET(_request: NextRequest) {
  try {
    const sessions = await prisma.guestSession.findMany({
      where: {
        status: 'active',
        billRequested: true
      },
      orderBy: { billRequestedAt: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: sessions.map(s => ({
        id: s.id,
        table_name: s.tableName,
        guest_name: s.guestName,
        guest_phone: s.guestPhone,
        num_guests: s.numGuests,
        status: s.status,
        total_amount: s.totalAmount ? Number(s.totalAmount) : 0,
        bill_requested: s.billRequested,
        bill_requested_at: s.billRequestedAt?.toISOString(),
        created_at: s.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Bill requests fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch bill requests' }, { status: 500 })
  }
}
