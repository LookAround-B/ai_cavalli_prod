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

    // Strategy 2: by order IDs (direct lookup only)
    if (bills.length === 0 && (orderId || orderIds)) {
      const ids = orderId ? [orderId] : (orderIds?.split(',') || [])
      bills = await prisma.bill.findMany({
        where: { orderId: { in: ids } },
        include: { billItems: true },
        orderBy: { createdAt: 'desc' },
        take: 1
      })

      // Strategy 2b: if the order belongs to a session, find the session's bill
      if (bills.length === 0 && orderId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { sessionId: true }
        })
        if (order?.sessionId) {
          bills = await prisma.bill.findMany({
            where: { sessionId: order.sessionId },
            include: { billItems: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          })
        }
      }
    }

    // Strategy 3: by guest name (most recent only, within 24 hours)
    if (bills.length === 0 && guestName) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      bills = await prisma.bill.findMany({
        where: { 
          guestName,
          createdAt: { gte: oneDayAgo }
        },
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
        table_name: bill.tableName,
        items_total: Number(bill.itemsTotal),
        discount_amount: Number(bill.discountAmount),
        final_total: Number(bill.finalTotal),
        payment_method: bill.paymentMethod,
        created_at: bill.createdAt.toISOString(),
        bill_items: bill.billItems.map((i: any) => ({
          id: i.id,
          item_name: i.itemName,
          quantity: i.quantity,
          price: Number(i.price),
          subtotal: Number(i.subtotal)
        }))
      }
    })
  } catch (error) {
    console.error('Bill lookup error:', error)
    return NextResponse.json({ success: false, error: 'Failed to lookup bill' }, { status: 500 })
  }
}
