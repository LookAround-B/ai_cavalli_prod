import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { sanitizeId } from '@/lib/validation/sanitize'
import { nextSerialBillNumber } from '@/lib/utils/bill-number'

/**
 * Generate Session Bill API
 * Creates a SINGLE consolidated bill for all orders in a guest session.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const sessionId = sanitizeId(body.sessionId || '')
        const paymentMethod = body.paymentMethod || 'cash'

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
                // Fallback: find orders by userId, guest phone, or tableName
                const fallbackWhere: Record<string, unknown>[] = []
                if (session.userId) {
                    fallbackWhere.push({ userId: session.userId, billed: false, createdAt: { gte: session.startedAt } })
                }
                if (session.guestPhone) {
                    fallbackWhere.push({
                        guestInfo: { path: ['phone'], equals: session.guestPhone },
                        billed: false,
                        createdAt: { gte: session.startedAt }
                    })
                }
                // Also try matching by table name + time window for walk-in orders
                if (session.tableName) {
                    fallbackWhere.push({
                        tableName: session.tableName,
                        billed: false,
                        createdAt: { gte: session.startedAt }
                    })
                }

                if (fallbackWhere.length > 0) {
                    const fallbackOrders = await prisma.order.findMany({
                        where: { OR: fallbackWhere },
                        include: {
                            orderItems: {
                                include: { menuItem: { select: { name: true } } }
                            }
                        }
                    })
                    if (fallbackOrders.length > 0) {
                        orders = fallbackOrders
                        // Link these orders to the session for future lookups
                        await prisma.order.updateMany({
                            where: { id: { in: fallbackOrders.map(o => o.id) } },
                            data: { sessionId }
                        })
                    }
                }

                if (orders.length === 0) {
                    return NextResponse.json(
                        { success: false, error: 'No orders found in this session.' },
                        { status: 400 }
                    )
                }
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    gstAmount: Number((existingBill as any).gstAmount || 0),
                    finalTotal: Number(existingBill.finalTotal),
                    paymentMethod: existingBill.paymentMethod,
                    createdAt: existingBill.createdAt,
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

        orders.forEach((order) => {
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

        // discount_amount in orders table is stored as a percentage (e.g. 10 = 10%)
        // Sum discount percentages across orders and calculate actual amount
        let totalDiscountPercent = 0
        orders.forEach((order) => {
            const dp = Number(order.discountAmount || 0)
            if (dp > totalDiscountPercent) totalDiscountPercent = dp // use highest discount %
        })
        const totalDiscount = totalDiscountPercent > 0 ? Math.round((totalItemsAmount * (totalDiscountPercent / 100)) * 100) / 100 : 0
        const afterDiscount = totalItemsAmount - totalDiscount
        // GST 5% on the amount after discount
        const gstAmount = Math.round((afterDiscount * 0.05) * 100) / 100
        const finalTotal = afterDiscount + gstAmount

        // 4. Generate bill number in serial format (A001, A002 ... A999, B001 ...)
        const billNumber = await nextSerialBillNumber(prisma)

        // 5. Create bill + items in transaction
        const bill = await prisma.$transaction(async (tx) => {
            const newBill = await tx.bill.create({
                data: {
                    sessionId,
                    // Don't set orderId for session bills to avoid unique constraint conflicts
                    // Session bills are linked via sessionId, not orderId
                    billNumber,
                    itemsTotal: totalItemsAmount,
                    discountAmount: totalDiscount,
                    gstAmount,
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
                itemsTotal: Number(totalItemsAmount),
                discountAmount: Number(totalDiscount),
                gstAmount: Number(gstAmount),
                finalTotal: Number(finalTotal),
                paymentMethod,
                createdAt: new Date().toISOString(),
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
    } catch (error: unknown) {
        console.error('Session bill generation error:', error)
        let message = 'Internal server error'
        if ((error as any)?.code === 'P2002') {
            message = 'A bill already exists for one of the orders in this session'
        } else if (error instanceof Error) {
            message = error.message
        }
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        )
    }
}
