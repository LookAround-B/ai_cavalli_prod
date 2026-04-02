import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { validateBody, updateOrderDiscountSchema } from '@/lib/validation/schemas'

export async function PATCH(request: NextRequest) {
  try {
    const parsed = await validateBody(request, updateOrderDiscountSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderId, discountAmount } = parsed.data

    await prisma.order.update({
      where: { id: orderId },
      data: { discountAmount }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update discount'
    console.error('Order discount update error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
