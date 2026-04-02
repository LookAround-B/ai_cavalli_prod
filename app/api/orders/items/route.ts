import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'
import { validateBody, addOrderItemSchema, updateOrderItemSchema } from '@/lib/validation/schemas'
import { sanitizeId } from '@/lib/validation/sanitize'

// POST: Add item to order
export async function POST(request: NextRequest) {
  try {
    const parsed = await validateBody(request, addOrderItemSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderId, menuItemId, quantity, price } = parsed.data

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } })
    if (!menuItem) {
      return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 })
    }

    await prisma.orderItem.create({
      data: {
        orderId,
        menuItemId,
        quantity,
        price: price ?? menuItem.price
      }
    })

    // Recalculate order total
    const items = await prisma.orderItem.findMany({ where: { orderId } })
    const total = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0)
    await prisma.order.update({ where: { id: orderId }, data: { total } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add item'
    console.error('Add order item error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// PUT: Update item quantity
export async function PUT(request: NextRequest) {
  try {
    const parsed = await validateBody(request, updateOrderItemSchema)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const { orderItemId, quantity } = parsed.data

    const item = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { quantity }
    })

    // Recalculate order total
    const items = await prisma.orderItem.findMany({ where: { orderId: item.orderId } })
    const total = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0)
    await prisma.order.update({ where: { id: item.orderId }, data: { total } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update item'
    console.error('Update order item error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE: Remove item from order
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderItemId = sanitizeId(searchParams.get('id') || '')
    if (!orderItemId) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
    }

    const item = await prisma.orderItem.delete({ where: { id: orderItemId } })

    // Recalculate order total
    const items = await prisma.orderItem.findMany({ where: { orderId: item.orderId } })
    const total = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0)
    await prisma.order.update({ where: { id: item.orderId }, data: { total } })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete item'
    console.error('Delete order item error:', error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
