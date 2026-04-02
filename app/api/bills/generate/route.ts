import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { requireRoles } from '@/lib/auth/api-middleware'
import type { UserRole } from '@/lib/types/auth'
import { validateBody, generateBillSchema, updateBillPaymentSchema } from '@/lib/validation/schemas'
import { sanitizeId } from '@/lib/validation/sanitize'

function normalizeRole(role: string): UserRole {
    const raw = (role || '').toUpperCase()
    return (raw === 'KITCHEN_MANAGER' ? 'KITCHEN' : raw === 'GUEST' ? 'OUTSIDER' : raw) as UserRole
}

const BILL_ROLES: UserRole[] = ['STAFF', 'KITCHEN', 'ADMIN']

export async function POST(request: NextRequest) {
    try {
        const parsed = await validateBody(request, generateBillSchema)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
        }

        const { orderId, paymentMethod, userId } = parsed.data

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
                user: { select: { name: true, role: true } },
            },
        })

        if (!order) {
            return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
        }

        // 2. Check if bill already exists — delete old bill to regenerate
        const existingBill = await prisma.bill.findUnique({
            where: { orderId },
            select: { id: true, billNumber: true },
        })

        if (existingBill) {
            // Delete old bill items and bill so we can regenerate with current order items
            await prisma.billItem.deleteMany({ where: { billId: existingBill.id } })
            await prisma.bill.delete({ where: { id: existingBill.id } })
        }

        // 3. Calculate totals
        let itemsTotal = 0
        order.orderItems.forEach((item) => {
            const itemPrice = Number(item.price) || 0
            itemsTotal += item.quantity * itemPrice
        })
        
        // itemsTotal should be rounded to 2 decimal places
        itemsTotal = Math.round(itemsTotal * 100) / 100

        // discount_amount in orders table is stored as a percentage (e.g. 10 = 10%)
        const discountPercent = Number(order.discountAmount) || 0
        const discountAmount = discountPercent > 0 ? Math.round((itemsTotal * (discountPercent / 100)) * 100) / 100 : 0
        const afterDiscount = Math.round((itemsTotal - discountAmount) * 100) / 100
        // GST 5% on the amount after discount
        const gstAmount = Math.round((afterDiscount * 0.05) * 100) / 100
        const finalTotal = Math.round((afterDiscount + gstAmount) * 100) / 100

        // 4. Generate bill number
        const billNumber = `BILL-${Date.now().toString(36).toUpperCase()}`

        // 4b. Resolve guest name (parse kitchen order notes if applicable)
        let resolvedGuestName = ''
        if (order.notes && typeof order.notes === 'string' && order.notes.startsWith('KITCHEN_ORDER')) {
            const parts = order.notes.split('|').map((s: string) => s.trim())
            if (parts.length >= 2 && parts[1]) resolvedGuestName = parts[1]
        }
        if (!resolvedGuestName) {
            const guestInfo = order.guestInfo as any
            resolvedGuestName = guestInfo?.name || order.user?.name || ''
        }

        // 5. Create bill with items in transaction
        // Build bill items - group by item name
        const itemMap = new Map<string, { itemName: string; quantity: number; price: number; subtotal: number }>()
        order.orderItems.forEach((item) => {
            const name = item.menuItem?.name || 'Unknown Item'
            const price = Number(item.price)
            const existing = itemMap.get(name)
            if (existing) {
                existing.quantity += item.quantity
                existing.subtotal += item.quantity * price
            } else {
                itemMap.set(name, {
                    itemName: name,
                    quantity: item.quantity,
                    price,
                    subtotal: item.quantity * price,
                })
            }
        })
        const billItemsData = Array.from(itemMap.values())

        // Prepend "Standard Regular Staff Meal" for staff meal orders
        if (order.notes === 'REGULAR_STAFF_MEAL') {
            billItemsData.unshift({
                itemName: 'Standard Regular Staff Meal',
                quantity: 1,
                price: 0,
                subtotal: 0,
            })
        }

        const bill = await prisma.bill.create({
            data: {
                orderId,
                billNumber,
                itemsTotal,
                discountAmount,
                gstAmount,
                finalTotal,
                paymentMethod,
                paymentStatus: 'pending',
                guestName: resolvedGuestName || undefined,
                tableName: order.tableName || undefined,
                billItems: {
                    create: billItemsData,
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
                gstAmount: Number(bill.gstAmount || 0),
                finalTotal: Number(bill.finalTotal),
                paymentMethod: bill.paymentMethod,
                guestName: bill.guestName || resolvedGuestName,
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

// PATCH: Update bill payment method
export async function PATCH(request: NextRequest) {
    try {
        const parsed = await validateBody(request, updateBillPaymentSchema)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
        }

        const { billId, paymentMethod } = parsed.data

        const bill = await prisma.bill.update({
            where: { id: billId },
            data: { paymentMethod },
            select: { id: true, paymentMethod: true },
        })

        return NextResponse.json({ success: true, bill })
    } catch (error) {
        console.error('Bill payment update error:', error)
        return NextResponse.json({ success: false, error: 'Failed to update payment method' }, { status: 500 })
    }
}
