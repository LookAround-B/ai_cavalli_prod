import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { Prisma } from '@prisma/client'

// POST - add a special or create menu item + add as special
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { menu_item_id, period, date } = body

        if (!menu_item_id || !period) {
            return NextResponse.json({ error: 'menu_item_id and period are required' }, { status: 400 })
        }

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

        const data = existing || await prisma.dailySpecial.create({
            data: {
                menuItemId: menu_item_id,
                period,
                date: targetDate,
            },
            include: { menuItem: true }
        })

        // Map to snake_case response
        return NextResponse.json({
            success: true,
            alreadyExists: Boolean(existing),
            data: {
                ...data,
                menu_item_id: data.menuItemId,
                menu_item: data.menuItem ? {
                    id: data.menuItem.id,
                    name: data.menuItem.name,
                    description: data.menuItem.description,
                    price: Number(data.menuItem.price),
                    image_url: data.menuItem.imageUrl,
                    available: data.menuItem.available,
                    category_id: data.menuItem.categoryId,
                    created_at: data.menuItem.createdAt,
                } : null,
                created_at: data.createdAt,
            }
        })
    } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return NextResponse.json({
                success: true,
                alreadyExists: true,
                message: 'Special already exists for this item and period today'
            })
        }
        console.error('POST /api/kitchen/specials error:', err)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}

// DELETE - remove a special by id
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        await prisma.dailySpecial.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('DELETE /api/kitchen/specials error:', err)
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
    }
}
