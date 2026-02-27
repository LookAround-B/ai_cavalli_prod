import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

// GET: fetch all menu items with categories (admin, includes unavailable)
// POST: create menu item
// PUT: update menu item
// DELETE: delete menu item
// PATCH: toggle availability

export async function GET(request: NextRequest) {
  try {
    const [categories, items] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.menuItem.findMany({
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
    ])

    return NextResponse.json({
      success: true,
      categories: categories.map(c => ({ id: c.id, name: c.name, sort_order: c.sortOrder })),
      items: items.map(i => ({
        id: i.id, name: i.name, description: i.description,
        price: Number(i.price), category_id: i.categoryId,
        image_url: i.imageUrl, available: i.available,
        created_at: i.createdAt?.toISOString(),
        category: i.category ? { name: i.category.name } : null
      }))
    })
  } catch (error) {
    console.error('Menu items fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, price, category_id, image_url, available } = body

    const item = await prisma.menuItem.create({
      data: {
        name,
        description: description || null,
        price,
        categoryId: category_id,
        imageUrl: image_url || null,
        available: available !== false
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: item.id, name: item.name, description: item.description,
        price: Number(item.price), category_id: item.categoryId,
        image_url: item.imageUrl, available: item.available
      }
    })
  } catch (error: any) {
    console.error('Menu item create error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to create item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, price, category_id, image_url, available } = body

    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })

    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        name,
        description: description || null,
        price,
        categoryId: category_id,
        imageUrl: image_url || null,
        available
      }
    })

    return NextResponse.json({ success: true, data: { id: item.id } })
  } catch (error: any) {
    console.error('Menu item update error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })

    await prisma.menuItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Menu item delete error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, available } = body

    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })

    await prisma.menuItem.update({
      where: { id },
      data: { available }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Menu item toggle error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to toggle availability' }, { status: 500 })
  }
}
