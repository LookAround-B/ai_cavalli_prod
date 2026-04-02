import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import { validateBody, guestLoginSchema } from '@/lib/validation/schemas'

/**
 * Guest Login API
 * Creates or reuses a guest user and starts a dining session.
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const parsed = await validateBody(request, guestLoginSchema)
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
        }

        const { name, phone: sanitizedPhone, table_name: tableName, num_guests: numGuests } = parsed.data

        // Check if phone belongs to Staff or Rider
        const staffOrRider = await prisma.user.findFirst({
            where: { phone: sanitizedPhone, role: { in: ['STAFF', 'RIDER'] } },
            select: { id: true, role: true },
        })

        if (staffOrRider) {
            return NextResponse.json(
                { success: false, error: 'This phone number is registered to internal personnel. Please use the Staff/Rider login.' },
                { status: 400 }
            )
        }

        // Find or create guest user
        let user = await prisma.user.findFirst({
            where: { phone: sanitizedPhone, role: 'OUTSIDER' },
            select: { id: true, name: true, phone: true, role: true },
        })

        if (user) {
            if (user.name !== name) {
                await prisma.user.update({ where: { id: user.id }, data: { name } })
                user = { ...user, name }
            }
        } else {
            const guestEmail = `guest_${sanitizedPhone}@aicavalli.local`
            user = await prisma.user.create({
                data: {
                    name,
                    phone: sanitizedPhone,
                    email: guestEmail,
                    role: 'OUTSIDER',
                },
                select: { id: true, name: true, phone: true, role: true },
            })
        }

        // Check for existing active session
        const existingSession = await prisma.guestSession.findFirst({
            where: { guestPhone: sanitizedPhone, status: 'active' },
        })

        let session = existingSession

        if (existingSession) {
            if (existingSession.tableName !== tableName ||
                existingSession.numGuests !== numGuests) {
                session = await prisma.guestSession.update({
                    where: { id: existingSession.id },
                    data: {
                        tableName,
                        numGuests,
                        guestName: name,
                        userId: user.id,
                    },
                })
            }
        } else {
            session = await prisma.guestSession.create({
                data: {
                    guestName: name,
                    guestPhone: sanitizedPhone,
                    tableName,
                    numGuests,
                    userId: user.id,
                    status: 'active',
                    totalAmount: 0,
                },
            })
        }

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
            session: {
                id: session!.id,
                tableName: session!.tableName,
                numGuests: session!.numGuests,
                totalAmount: session!.totalAmount,
                startedAt: session!.startedAt
            },
            message: existingSession ? 'Welcome back! Your session is active.' : 'Session started. Enjoy your meal!'
        })
    } catch (error: unknown) {
        console.error('Guest login error:', error)
        return NextResponse.json({ success: false, error: 'Internal server error. Please try again.' }, { status: 500 })
    }
}
