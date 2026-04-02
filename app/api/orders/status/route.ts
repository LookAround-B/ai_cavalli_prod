import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { validateBody, updateOrderStatusSchema } from '@/lib/validation/schemas'

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await validateBody(request, updateOrderStatusSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderId, status } = parsed.data

    await prisma.order.update({
      where: { id: orderId },
      data: { status }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update status'
    console.error('Order status update error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
