import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

// Lookup bills by session, order, or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const orderId = searchParams.get('orderId')
    const orderIds = searchParams.get('orderIds') // comma-separated
    const guestName = searchParams.get('guestName')

    let bills: any[] = []

    // Strategy 1: by session
    if (sessionId) {
      bills = await prisma.bill.findMany({
        where: { sessionId },
        include: { billItems: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
    }

    // Strategy 2: by order IDs
    if (bills.length === 0 && (orderId || orderIds)) {
      const ids = orderId ? [orderId] : (orderIds?.split(',') || [])
      bills = await prisma.bill.findMany({
        where: { orderId: { in: ids } },
        include: { billItems: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
    }

    // Strategy 3: by guest name
    if (bills.length === 0 && guestName) {
      bills = await prisma.bill.findMany({
        where: { guestName },
        include: { billItems: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
    }

    if (bills.length === 0) {
      return NextResponse.json({ success: true, data: null })
    }

    const bill = bills[0]
    return NextResponse.json({
      success: true,
      data: {
        id: bill.id,
        bill_number: bill.billNumber,
        order_id: bill.orderId,
        session_id: bill.sessionId,
        guest_name: bill.guestName,
        items_total: Number(bill.itemsTotal),
        discount_amount: Number(bill.discountAmount),
        final_total: Number(bill.finalTotal),
        payment_method: bill.paymentMethod,
        session_details: bill.sessionDetails,
        created_at: bill.createdAt.toISOString(),
        bill_items: bill.billItems.map((i: any) => ({
          id: i.id,
          item_name: i.itemName,
          quantity: i.quantity,
          unit_price: Number(i.unitPrice),
          subtotal: Number(i.subtotal)
        }))
      }
    })
  } catch (error) {
    console.error('Bill lookup error:', error)
    return NextResponse.json({ success: false, error: 'Failed to lookup bill' }, { status: 500 })
  }
}
