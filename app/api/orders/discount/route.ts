import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const { orderId, discountAmount } = await request.json()
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { discountAmount: discountAmount || 0 }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Order discount update error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to update discount' }, { status: 500 })
  }
}
