import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import {
    getUserByPhone,
    verifyPin,
    updateSessionToken,
    clearFailedLoginAttempts,
    recordFailedLogin,
    isUserLocked,
    logAuthAction,
    generateSessionToken,
} from '@/lib/auth/utils'
import { sanitizePhone } from '@/lib/utils/phone'
import { sanitizeString, sanitizePin } from '@/lib/validation/sanitize'

/**
 * Unified Login Endpoint
 * - PIN login: login_type = 'rider' | 'kitchen' | 'staff'
 * - Guest login: login_type = 'guest'
 * Uses Prisma ORM (no Supabase dependency)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phone, pin, name, table_name, num_guests, login_type } = body

        if (!phone) {
            return NextResponse.json({ success: false, error: 'Phone number is required' }, { status: 400 })
        }

        const sanitizedPhone = sanitizePhone(phone)
        if (!sanitizedPhone || sanitizedPhone.length < 10) {
            return NextResponse.json({ success: false, error: 'Valid 10-digit phone number required' }, { status: 400 })
        }

        // Check account lock
        const lockStatus = await isUserLocked(sanitizedPhone)
        if (lockStatus.locked) {
            const minutesLeft = Math.ceil((lockStatus.until!.getTime() - Date.now()) / 60000)
            return NextResponse.json(
                { success: false, error: `Account locked. Try again in ${minutesLeft} minutes.` },
                { status: 429 }
            )
        }

        // ─── FLOW 1: PIN-based login (RIDER / Kitchen / Admin) ───
        if (login_type === 'rider' || login_type === 'kitchen' || login_type === 'staff') {
            const sanitizedPin = sanitizePin(pin)
            if (!sanitizedPin || sanitizedPin.length < 6) {
                return NextResponse.json({ success: false, error: 'PIN is required (6 digits)' }, { status: 400 })
            }

            const user = await getUserByPhone(sanitizedPhone)
            if (!user) {
                await recordFailedLogin(sanitizedPhone, 'User not found')
                return NextResponse.json({ success: false, error: 'Invalid phone or PIN' }, { status: 401 })
            }

            const rawRole = (user.role || '').toUpperCase()
            const userRole = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN'
                : rawRole === 'GUEST' ? 'OUTSIDER'
                : rawRole

            if (!['RIDER', 'STAFF', 'KITCHEN', 'ADMIN'].includes(userRole)) {
                return NextResponse.json(
                    { success: false, error: 'Use guest check-in for this account' },
                    { status: 403 }
                )
            }

            const pinValid = await verifyPin(sanitizedPin, user)
            if (!pinValid) {
                await recordFailedLogin(sanitizedPhone, 'Invalid PIN')
                return NextResponse.json({ success: false, error: 'Invalid phone or PIN' }, { status: 401 })
            }

            await clearFailedLoginAttempts(user.id)
            const sessionToken = generateSessionToken()
            await updateSessionToken(user.id, sessionToken, 24)
            await logAuthAction(user.id, 'login', { method: 'pin', role: userRole })

            const safeUser = {
                id: user.id,
                email: user.email,
                phone: user.phone,
                name: user.name,
                role: userRole,
                parent_name: user.parent_name,
                position: user.position,
                created_at: user.created_at
            }

            return NextResponse.json({
                success: true,
                user: safeUser,
                session: { session_token: sessionToken, expires_in: 86400 },
                message: `Welcome back, ${user.name}!`
            })
        }

        // ─── FLOW 2: Guest check-in (no PIN needed) ───
        if (login_type === 'guest' || login_type === 'outsider') {
            const sanitizedName = sanitizeString(name || '')
            if (!sanitizedName) {
                return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
            }
            const finalTableName = sanitizeString(table_name || '') || 'Walk-in'
            const sanitizedNumGuests = Math.min(Math.max(parseInt(num_guests) || 1, 1), 50)

            // Check if phone belongs to staff
            const staffUser = await prisma.user.findUnique({ where: { phone: sanitizedPhone } })

            if (staffUser) {
                const staffRole = (staffUser.role || '').toUpperCase()
                if (['RIDER', 'STAFF', 'KITCHEN', 'ADMIN'].includes(staffRole)) {
                    return NextResponse.json(
                        { success: false, error: 'This phone is registered to staff. Use staff login.' },
                        { status: 400 }
                    )
                }
            }

            // Find or create guest user
            let guestUser = staffUser && (staffUser.role || '').toUpperCase() === 'OUTSIDER'
                ? staffUser
                : null

            if (!guestUser) {
                const existingGuest = await prisma.user.findUnique({ where: { phone: sanitizedPhone } })
                if (existingGuest) {
                    guestUser = existingGuest
                    if (existingGuest.name !== sanitizedName) {
                        await prisma.user.update({
                            where: { id: existingGuest.id },
                            data: { name: sanitizedName },
                        })
                    }
                }
            }

            if (!guestUser) {
                const guestEmail = `guest_${sanitizedPhone}@aicavalli.local`
                guestUser = await prisma.user.create({
                    data: {
                        email: guestEmail,
                        phone: sanitizedPhone,
                        name: sanitizedName,
                        role: 'OUTSIDER',
                    },
                })
            }

            // Create or update guest session
            let session: Record<string, unknown> | null = null
            try {
                const existingSession = await prisma.guestSession.findFirst({
                    where: { guestPhone: sanitizedPhone, status: 'active' },
                })

                if (existingSession) {
                    session = await prisma.guestSession.update({
                        where: { id: existingSession.id },
                        data: {
                            tableName: finalTableName,
                            numGuests: sanitizedNumGuests,
                            guestName: sanitizedName,
                            userId: guestUser.id,
                        },
                    })
                } else {
                    session = await prisma.guestSession.create({
                        data: {
                            userId: guestUser.id,
                            guestName: sanitizedName,
                            guestPhone: sanitizedPhone,
                            tableName: finalTableName,
                            numGuests: sanitizedNumGuests,
                            status: 'active',
                            totalAmount: 0,
                        },
                    })
                }
            } catch (e) {
                // Non-fatal session error
            }

            const sessionToken = generateSessionToken()
            await updateSessionToken(guestUser.id, sessionToken, 24)
            await logAuthAction(guestUser.id, 'guest_login', { table_name: finalTableName, num_guests: sanitizedNumGuests })

            const safeUser = {
                id: guestUser.id,
                email: guestUser.email,
                phone: guestUser.phone || sanitizedPhone,
                name: sanitizedName,
                role: 'OUTSIDER',
                created_at: guestUser.createdAt
            }

            return NextResponse.json({
                success: true,
                user: safeUser,
                session: {
                    ...(session || {}),
                    session_token: sessionToken,
                    expires_in: 86400
                },
                message: session ? 'Welcome back! Session resumed.' : 'Dining session started!'
            })
        }

        return NextResponse.json({ success: false, error: 'Invalid login_type' }, { status: 400 })
    } catch {
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
}
