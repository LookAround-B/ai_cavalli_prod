import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function GET(_request: NextRequest) {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: announcements.map(a => ({
        id: a.id,
        title: a.title,
        content: a.description,
        description: a.description,
        image_url: a.imageUrl,
        link: a.link,
        active: a.active,
        created_at: a.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('Announcements fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch announcements' }, { status: 500 })
  }
}
