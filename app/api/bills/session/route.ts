import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { Prisma } from '@prisma/client'

/**
 * Generate Session Bill API
 * Creates a SINGLE consolidated bill for all orders in a guest session.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const { sessionId, paymentMethod = 'cash' } = await request.json()

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID is required' },
                { status: 400 }
            )
        }

        // 1. Fetch session with ALL orders and their items
        const session = await prisma.guestSession.findUnique({
            where: { id: sessionId },
            include: {
                orders: {
                    include: {
                        orderItems: {
                            include: { menuItem: { select: { name: true } } }
                        }
                    }
                }
            }
        })

        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Session not found' },
                { status: 404 }
            )
        }

        let orders = session.orders || []

        if (orders.length === 0) {
            // Try direct query as backup
            const directOrders = await prisma.order.findMany({
                where: { sessionId },
                include: {
                    orderItems: {
                        include: { menuItem: { select: { name: true } } }
                    }
                }
            })

            if (directOrders && directOrders.length > 0) {
                orders = directOrders
            } else {
                return NextResponse.json(
                    { success: false, error: 'No orders found in this session.' },
                    { status: 400 }
                )
            }
        }

        // 2. Check if session already has a bill
        const existingBill = await prisma.bill.findFirst({
            where: { sessionId },
            include: { billItems: true }
        })

        if (existingBill) {
            const billItems = (existingBill.billItems || []).map((item) => ({
                item_name: item.itemName,
                quantity: item.quantity,
                price: Number(item.price),
                subtotal: Number(item.subtotal)
            }))

            return NextResponse.json({
                success: true,
                message: 'Bill already exists for this session',
                bill: {
                    id: existingBill.id,
                    billNumber: existingBill.billNumber,
                    itemsTotal: Number(existingBill.itemsTotal),
                    discountAmount: Number(existingBill.discountAmount || 0),
                    finalTotal: Number(existingBill.finalTotal),
                    paymentMethod: existingBill.paymentMethod,
                    items: billItems,
                    sessionDetails: {
                        guestName: session.guestName || 'Guest',
                        tableName: session.tableName || 'N/A',
                        numGuests: session.numGuests || 1,
                        orderCount: orders.length,
                        startedAt: session.startedAt
                    }
                }
            })
        }

        // 3. Consolidate all items
        const consolidatedItems: { [key: string]: { name: string, quantity: number, price: number } } = {}
        let totalItemsAmount = 0
        let totalDiscount = 0

        orders.forEach((order) => {
            totalDiscount += Number(order.discountAmount || 0)
            order.orderItems.forEach((item) => {
                const itemName = item.menuItem?.name || 'Unknown Item'
                const price = Number(item.price)
                const key = `${itemName}_${price}`

                if (consolidatedItems[key]) {
                    consolidatedItems[key].quantity += item.quantity
                } else {
                    consolidatedItems[key] = { name: itemName, quantity: item.quantity, price }
                }
                totalItemsAmount += item.quantity * price
            })
        })

        const finalTotal = totalItemsAmount - totalDiscount

        // 4. Generate bill number
        let billNumber: string
        try {
            const result = await prisma.$queryRaw<[{ generate_bill_number: string }]>(
                Prisma.sql`SELECT generate_bill_number()`
            )
            billNumber = result[0].generate_bill_number
        } catch {
            billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`
        }

        // 5. Create bill + items in transaction
        const bill = await prisma.$transaction(async (tx) => {
            const newBill = await tx.bill.create({
                data: {
                    sessionId,
                    orderId: orders[0].id,
                    billNumber,
                    itemsTotal: totalItemsAmount,
                    discountAmount: totalDiscount,
                    finalTotal,
                    paymentMethod,
                    paymentStatus: 'pending',
                    guestName: session.guestName,
                    guestPhone: session.guestPhone,
                    tableName: session.tableName,
                }
            })

            const billItems = Object.values(consolidatedItems).map(item => ({
                billId: newBill.id,
                itemName: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.quantity * item.price,
            }))

            await tx.billItem.createMany({ data: billItems })

            // Mark all orders as billed
            await tx.order.updateMany({
                where: { id: { in: orders.map(o => o.id) } },
                data: { billed: true }
            })

            // End the session
            await tx.guestSession.update({
                where: { id: sessionId },
                data: {
                    status: 'ended',
                    endedAt: new Date(),
                    totalAmount: finalTotal,
                }
            })

            return { ...newBill, items: billItems }
        })

        return NextResponse.json({
            success: true,
            bill: {
                id: bill.id,
                billNumber: bill.billNumber,
                itemsTotal: totalItemsAmount,
                discountAmount: totalDiscount,
                finalTotal,
                paymentMethod,
                items: Object.values(consolidatedItems).map(item => ({
                    item_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    subtotal: item.quantity * item.price
                })),
                sessionDetails: {
                    guestName: session.guestName,
                    tableName: session.tableName,
                    numGuests: session.numGuests,
                    orderCount: orders.length,
                    startedAt: session.startedAt
                }
            }
        })
    } catch (error) {
        console.error('Session bill generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
