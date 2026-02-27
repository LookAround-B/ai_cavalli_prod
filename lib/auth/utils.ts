/**
 * Server-side authentication utilities
 * All operations use Prisma ORM (no Supabase dependency)
 */

import prisma from '@/lib/database/prisma'
import bcrypt from 'bcryptjs'
import type { AuthUser } from '@/lib/types/auth'

/** Generate a random session token */
export function generateSessionToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 64; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${Date.now().toString(36)}_${result}`
}

/** Get user by phone (returns ALL columns for PIN checking) */
export async function getUserByPhone(phone: string): Promise<any | null> {
    try {
        const user = await prisma.user.findUnique({ where: { phone } })
        if (!user) return null
        // Return snake_case for backward compat with route handlers
        return {
            id: user.id,
            phone: user.phone,
            pin: user.pin,
            name: user.name,
            role: user.role,
            parent_name: user.parentName,
            created_at: user.createdAt,
            auth_method: user.authMethod,
            email: user.email,
            pin_hash: user.pinHash,
            position: user.position,
            failed_login_attempts: user.failedLoginAttempts,
            locked_until: user.lockedUntil,
            last_login: user.lastLogin,
            session_token: user.sessionToken,
            session_expires_at: user.sessionExpiresAt,
        }
    } catch (error) {
        console.error('getUserByPhone error:', error)
        return null
    }
}

/** Get user by ID (safe fields only) */
export async function getUserById(id: string): Promise<AuthUser | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                phone: true,
                name: true,
                role: true,
                parentName: true,
                position: true,
                lastLogin: true,
                createdAt: true,
            },
        })
        if (!user) return null
        return {
            id: user.id,
            email: user.email ?? '',
            phone: user.phone,
            name: user.name,
            role: user.role,
            parent_name: user.parentName ?? undefined,
            position: user.position ?? undefined,
            last_login: user.lastLogin?.toISOString(),
            created_at: user.createdAt.toISOString(),
        } as AuthUser
    } catch (error) {
        console.error('getUserById error:', error)
        return null
    }
}

/**
 * Verify PIN against stored hash or plaintext
 * Supports: bcrypt hash (pinHash), plaintext (pin)
 */
export async function verifyPin(inputPin: string, user: any): Promise<boolean> {
    try {
        // 1. Try bcrypt hash in pin_hash column
        if (user.pin_hash) {
            if (user.pin_hash.startsWith('$2')) {
                return await bcrypt.compare(inputPin, user.pin_hash)
            }
        }

        // 2. Fallback: plaintext pin column
        if (user.pin && user.pin === inputPin) {
            // Upgrade to bcrypt hash on successful plaintext match
            try {
                const hash = await bcrypt.hash(inputPin, 10)
                await prisma.user.update({
                    where: { id: user.id },
                    data: { pinHash: hash },
                })
            } catch {
                // Non-critical - upgrade failed silently
            }
            return true
        }

        return false
    } catch (error) {
        console.error('verifyPin error:', error)
        return false
    }
}

/** Store session token in DB */
export async function updateSessionToken(
    userId: string,
    sessionToken: string,
    expiresInHours: number = 24
): Promise<boolean> {
    try {
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        await prisma.user.update({
            where: { id: userId },
            data: {
                sessionToken,
                sessionExpiresAt: expiresAt,
                lastLogin: new Date(),
            },
        })
        return true
    } catch (error) {
        console.error('updateSessionToken error:', error)
        return false
    }
}

/** Clear session token on logout */
export async function clearSessionToken(userId: string): Promise<boolean> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { sessionToken: null, sessionExpiresAt: null },
        })
        return true
    } catch {
        return false
    }
}

/** Validate session token against DB */
export async function validateSessionToken(userId: string, token: string): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { sessionToken: true, sessionExpiresAt: true },
        })
        if (!user) return false
        if (user.sessionToken !== token) return false
        if (!user.sessionExpiresAt || user.sessionExpiresAt < new Date()) return false
        return true
    } catch {
        return false
    }
}

/** Check if user account is locked (by PHONE) */
export async function isUserLocked(phone: string): Promise<{ locked: boolean; until?: Date }> {
    try {
        const user = await prisma.user.findUnique({
            where: { phone },
            select: { lockedUntil: true },
        })

        if (!user || !user.lockedUntil) return { locked: false }

        if (user.lockedUntil < new Date()) {
            await prisma.user.update({
                where: { phone },
                data: { lockedUntil: null, failedLoginAttempts: 0 },
            })
            return { locked: false }
        }
        return { locked: true, until: user.lockedUntil }
    } catch {
        return { locked: false }
    }
}

/** Record failed login attempt (by PHONE). Locks after 5 failures for 30 min */
export async function recordFailedLogin(phone: string, reason: string = 'Invalid credentials'): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { phone },
            select: { id: true, failedLoginAttempts: true },
        })

        if (!user) {
            await logAuthAction(null, 'failed_login', { phone, reason }, 'failed', reason)
            return
        }

        const attempts = (user.failedLoginAttempts || 0) + 1
        const shouldLock = attempts >= 5

        await prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: attempts,
                ...(shouldLock ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } : {}),
            },
        })
        await logAuthAction(user.id, 'failed_login', { attempts, locked: shouldLock }, 'failed', reason)
    } catch (error) {
        console.error('recordFailedLogin error:', error)
    }
}

/** Clear failed login attempts on successful login */
export async function clearFailedLoginAttempts(userId: string): Promise<void> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { failedLoginAttempts: 0, lockedUntil: null },
        })
    } catch (error) {
        console.error('clearFailedLoginAttempts error:', error)
    }
}

/** Log authentication event (console only — no auth_logs table) */
export async function logAuthAction(
    userId: string | null,
    eventType: string,
    details?: Record<string, any>,
    status: 'success' | 'failed' = 'success',
    reason?: string
): Promise<void> {
    // auth_logs table does not exist in the production DB.
    // Log to console for debugging.
    if (status === 'failed') {
        console.warn(`[AUTH] ${eventType} FAILED userId=${userId} reason=${reason}`, details)
    }
}
