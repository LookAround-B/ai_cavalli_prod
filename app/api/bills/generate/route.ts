import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { requireRoles } from '@/lib/auth/api-middleware'
import type { UserRole } from '@/lib/types/auth'

function normalizeRole(role: string): UserRole {
    const raw = (role || '').toUpperCase()
    return (raw === 'KITCHEN_MANAGER' ? 'KITCHEN' : raw === 'GUEST' ? 'OUTSIDER' : raw) as UserRole
}

const BILL_ROLES: UserRole[] = ['STAFF', 'KITCHEN', 'ADMIN']

export async function POST(request: NextRequest) {
    try {
        const { orderId, paymentMethod = 'cash', userId } = await request.json()

        if (!orderId) {
            return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 })
        }

        // AUTH GUARD
        const { authorized } = await requireRoles(request, BILL_ROLES)
        if (!authorized) {
            if (!userId) {
                return NextResponse.json({ success: false, error: 'Unauthorized: No valid session or userId' }, { status: 401 })
            }
            const userRecord = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true },
            })
            if (!userRecord || !BILL_ROLES.includes(normalizeRole(userRecord.role))) {
                return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 })
            }
        }

        // 1. Fetch order with items
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: {
                    include: { menuItem: { select: { name: true } } },
                },
            },
        })

        if (!order) {
            return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
        }

        // 2. Check if bill already exists
        const existingBill = await prisma.bill.findUnique({
            where: { orderId },
            select: { id: true, billNumber: true },
        })

        if (existingBill) {
            return NextResponse.json(
                { success: false, error: 'Bill already exists for this order', billNumber: existingBill.billNumber },
                { status: 400 }
            )
        }

        // 3. Calculate totals
        let itemsTotal = 0
        order.orderItems.forEach((item) => {
            itemsTotal += item.quantity * Number(item.price)
        })
        // discount_amount in orders table is stored as a percentage (e.g. 10 = 10%)
        const discountPercent = Number(order.discountAmount) || 0
        const discountAmount = discountPercent > 0 ? Math.round((itemsTotal * (discountPercent / 100)) * 100) / 100 : 0
        const finalTotal = itemsTotal - discountAmount

        // 4. Generate bill number
        const billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`

        // 5. Create bill with items in transaction
        const bill = await prisma.bill.create({
            data: {
                orderId,
                billNumber,
                itemsTotal,
                discountAmount,
                finalTotal,
                paymentMethod,
                paymentStatus: 'pending',
                billItems: {
                    create: order.orderItems.map((item) => ({
                        itemName: item.menuItem?.name || 'Unknown Item',
                        quantity: item.quantity,
                        price: Number(item.price),
                        subtotal: item.quantity * Number(item.price),
                    })),
                },
            },
            include: { billItems: true },
        })

        // 6. Mark order as billed
        await prisma.order.update({ where: { id: orderId }, data: { billed: true } })

        return NextResponse.json({
            success: true,
            bill: {
                id: bill.id,
                billNumber: bill.billNumber,
                itemsTotal: Number(bill.itemsTotal),
                discountAmount: Number(bill.discountAmount || 0),
                finalTotal: Number(bill.finalTotal),
                paymentMethod: bill.paymentMethod,
                createdAt: bill.createdAt,
                items: bill.billItems.map(item => ({
                    itemName: item.itemName,
                    quantity: item.quantity,
                    price: Number(item.price),
                    subtotal: Number(item.subtotal),
                })),
                orderDetails: {
                    tableName: order.tableName,
                    guestInfo: order.guestInfo,
                    notes: order.notes,
                    createdAt: order.createdAt,
                },
            },
        })
    } catch (error) {
        console.error('Bill generation error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
