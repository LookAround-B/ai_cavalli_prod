import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const { orderId, status } = await request.json()
    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: 'orderId and status required' }, { status: 400 })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Order status update error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to update status' }, { status: 500 })
  }
}
