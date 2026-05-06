import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { validateBody, updateOrderDiscountSchema } from '@/lib/validation/schemas'
import { notifyOrderEvent } from '@/lib/sse/notify'

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await validateBody(request, updateOrderDiscountSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderId, discountAmount } = parsed.data

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { discountAmount },
      select: { id: true, discountAmount: true, userId: true, updatedAt: true },
    })

    await notifyOrderEvent('order_updated', {
      id:              updated.id,
      discount_amount: Number(updated.discountAmount),
      user_id:         updated.userId,
      updatedAt:       updated.updatedAt.toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/orders/discount]', error)
    return NextResponse.json({ success: false, error: 'Failed to update discount' }, { status: 500 })
  }
}
