import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { Prisma } from '@prisma/client'
import { validateBody, createSpecialSchema } from '@/lib/validation/schemas'
import { sanitizeId } from '@/lib/validation/sanitize'

// POST - add a special or create menu item + add as special
export async function POST(request: NextRequest) {
    try {
        const parsed = await validateBody(request, createSpecialSchema)
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error }, { status: 400 })
        }

        const { menu_item_id, period, date } = parsed.data

        const targetDate = date ? new Date(`${date}T00:00:00.000Z`) : new Date()
        targetDate.setUTCHours(0, 0, 0, 0)

        const existing = await prisma.dailySpecial.findUnique({
            where: {
                date_period_menuItemId: {
                    date: targetDate,
                    period,
                    menuItemId: menu_item_id,
                },
            },
            include: { menuItem: true },
        })

        const data: any = existing || await prisma.dailySpecial.create({
            data: {
                menuItemId: menu_item_id,
                period,
                date: targetDate,
            },
            include: { menuItem: true }
        })

        // Map to snake_case response
        const menuItem = data.menuItem
        return NextResponse.json({
            success: true,
            alreadyExists: Boolean(existing),
            data: {
                id: data.id,
                date: data.date,
                period: data.period,
                menuItemId: data.menuItemId,
                createdAt: data.createdAt,
                menu_item_id: data.menuItemId,
                menu_item: menuItem ? {
                    id: menuItem.id,
                    name: menuItem.name,
                    description: menuItem.description,
                    price: Number(menuItem.price),
                    image_url: menuItem.imageUrl,
                    available: menuItem.available,
                    category_id: menuItem.categoryId,
                    created_at: menuItem.createdAt,
                } : null,
                created_at: data.createdAt,
            }
        })
    } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return NextResponse.json({
                success: true,
                alreadyExists: true,
                message: 'Special already exists for this item and period today'
            })
        }
        const message = err instanceof Error ? err.message : 'Server error'
        console.error('POST /api/kitchen/specials error:', err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// DELETE - remove a special by id
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = sanitizeId(searchParams.get('id') || '')

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        await prisma.dailySpecial.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Server error'
        console.error('DELETE /api/kitchen/specials error:', err)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
