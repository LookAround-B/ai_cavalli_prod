import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { Prisma } from '@prisma/client'

/**
 * Generate User Bill API
 * Creates a consolidated bill from all unbilled orders for a user.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, paymentMethod = 'cash' } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'User ID is required' },
                { status: 400 }
            )
        }

        // 1. Fetch user profile
        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, phone: true, email: true, role: true }
        })

        if (!userData) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            )
        }

        // 2. Fetch all unbilled orders
        const orders = await prisma.order.findMany({
            where: {
                userId,
                billed: false
            },
            include: {
                orderItems: {
                    include: { menuItem: { select: { name: true } } }
                }
            },
            orderBy: { createdAt: 'asc' }
        })

        if (!orders || orders.length === 0) {
            // Check for existing already-billed orders
            const billedOrders = await prisma.order.findMany({
                where: { userId, billed: true },
                select: { id: true },
                orderBy: { createdAt: 'desc' }
            })

            if (billedOrders.length > 0) {
                const existingBill = await prisma.bill.findFirst({
                    where: { orderId: { in: billedOrders.map(o => o.id) } },
                    include: { billItems: true },
                    orderBy: { createdAt: 'desc' }
                })

                if (existingBill) {
                    const billItems = existingBill.billItems.map((item) => ({
                        item_name: item.itemName,
                        quantity: item.quantity,
                        price: Number(item.price),
                        subtotal: Number(item.subtotal)
                    }))

                    return NextResponse.json({
                        success: true,
                        bill: {
                            id: existingBill.id,
                            billNumber: existingBill.billNumber,
                            itemsTotal: Number(existingBill.itemsTotal),
                            discountAmount: Number(existingBill.discountAmount || 0),
                            finalTotal: Number(existingBill.finalTotal),
                            paymentMethod: existingBill.paymentMethod,
                            items: billItems,
                            sessionDetails: {
                                guestName: userData.name || 'Guest',
                                tableName: existingBill.tableName || userData.name || 'N/A',
                                numGuests: 1,
                                orderCount: billedOrders.length,
                                startedAt: existingBill.createdAt
                            }
                        }
                    })
                }
            }

            return NextResponse.json(
                { success: false, error: 'No orders found' },
                { status: 400 }
            )
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
                    orderId: orders[0].id,
                    billNumber,
                    itemsTotal: totalItemsAmount,
                    discountAmount: totalDiscount,
                    finalTotal,
                    paymentMethod,
                    paymentStatus: 'pending',
                    guestName: userData.name || 'Guest',
                    guestPhone: userData.phone || '',
                    tableName: orders[0].tableName || userData.name || 'N/A',
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

            return newBill
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
                    guestName: userData.name || 'Guest',
                    tableName: orders[0].tableName || userData.name || 'N/A',
                    numGuests: 1,
                    orderCount: orders.length,
                    startedAt: orders[0].createdAt
                }
            }
        })
    } catch (error) {
        console.error('User bill generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
