import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function GET(request: NextRequest) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [categories, menuItems, dailySpecials] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.menuItem.findMany({
        where: { available: true },
        orderBy: { name: 'asc' }
      }),
      prisma.dailySpecial.findMany({
        where: {
          date: { gte: today, lt: tomorrow }
        },
        include: { menuItem: true }
      })
    ])

    return NextResponse.json({
      success: true,
      categories: categories.map(c => ({
        id: c.id, name: c.name, sort_order: c.sortOrder
      })),
      items: menuItems.map(i => ({
        id: i.id, name: i.name, description: i.description,
        price: Number(i.price), category_id: i.categoryId,
        image_url: i.imageUrl, available: i.available,
        created_at: i.createdAt?.toISOString()
      })),
      specials: dailySpecials.map(s => ({
        id: s.id, menu_item_id: s.menuItemId, period: s.period,
        date: s.date.toISOString().split('T')[0],
        menu_item: s.menuItem ? {
          id: s.menuItem.id, name: s.menuItem.name,
          description: s.menuItem.description,
          price: Number(s.menuItem.price),
          category_id: s.menuItem.categoryId,
          image_url: s.menuItem.imageUrl,
          available: s.menuItem.available
        } : null
      }))
    })
  } catch (error) {
    console.error('Menu fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch menu' }, { status: 500 })
  }
}
