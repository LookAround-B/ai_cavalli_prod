import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { validateBody, updateOrderStatusSchema } from '@/lib/validation/schemas'
import { notifyOrderEvent } from '@/lib/sse/notify'

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await validateBody(request, updateOrderStatusSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderId, status } = parsed.data

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      // Include userId + billed so the customer SSE handler can filter / update correctly
      select: {
        id:        true,
        status:    true,
        userId:    true,
        billed:    true,
        updatedAt: true,
      },
    })

    await notifyOrderEvent('order_updated', {
      id:        updated.id,
      status:    updated.status,
      user_id:   updated.userId,
      billed:    updated.billed,
      updatedAt: updated.updatedAt.toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[PATCH /api/orders/status]', error)
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
