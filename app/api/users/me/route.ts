import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/database/prisma'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || ''

    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const user = await prisma.user.findFirst({
      where: { sessionToken: token }
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        parent_name: user.parentName,
        created_at: user.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('User me fetch error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 })
  }
}
