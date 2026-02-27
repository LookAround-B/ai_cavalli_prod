/**
 * API Route Protection Utilities
 * Middleware for checking authorization in API endpoints
 * Uses Prisma ORM (no Supabase dependency)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/database/prisma'
import type { UserRole } from '@/lib/types/auth'
import { RBAC, hasPermission as checkPermission } from '@/lib/types/auth'

interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return { user: null, error: 'Authorization header missing' }
        }

        const token = authHeader.replace('Bearer ', '')

        // Look up user by session token
        const profile = await prisma.user.findFirst({
            where: { sessionToken: token },
            select: {
                id: true,
                email: true,
                phone: true,
                name: true,
                role: true,
                parentName: true,
                position: true,
                createdAt: true,
                sessionToken: true,
                sessionExpiresAt: true,
            },
        })

        if (!profile) {
            return { user: null, error: 'Invalid session token' }
        }

        // Check expiry — auto-extend if expired (sliding window session)
        if (profile.sessionExpiresAt && profile.sessionExpiresAt < new Date()) {
            const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
            await prisma.user.update({
                where: { id: profile.id },
                data: { sessionExpiresAt: newExpiry },
            })
            console.log(`Session auto-extended for user ${profile.id} via api-middleware`)
        }

        // Normalize role — DB may store 'kitchen_manager', 'guest', etc.
        const rawRole = (profile.role || '').toUpperCase()
        const normalizedRole = rawRole === 'KITCHEN_MANAGER' ? 'KITCHEN'
            : rawRole === 'GUEST' ? 'OUTSIDER'
            : rawRole

        const user = {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            name: profile.name,
            role: normalizedRole,
            parent_name: profile.parentName,
            position: profile.position,
            created_at: profile.createdAt.toISOString(),
            session_token: profile.sessionToken,
            session_expires_at: profile.sessionExpiresAt?.toISOString(),
        }

        return { user, error: undefined }
    } catch (error) {
        console.error('Auth user fetch error:', error)
        return { user: null, error: 'Authentication failed' }
    }
}

/**
 * Require specific roles for API endpoint
 */
export async function requireRoles(
    request: NextRequest,
    allowedRoles: UserRole[]
): Promise<{ authorized: boolean; user: any; error?: string; response?: NextResponse }> {
    const { user, error } = await getAuthUser(request)

    if (error || !user) {
        const response = NextResponse.json(
            { success: false, error: error || 'Unauthorized' },
            { status: 401 }
        )
        return { authorized: false, user: null, error, response }
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
        const response = NextResponse.json(
            { success: false, error: 'Forbidden: Insufficient permissions' },
            { status: 403 }
        )
        return { authorized: false, user, error: 'Role not allowed', response }
    }

    return { authorized: true, user }
}

/**
 * Require specific permission for API endpoint
 */
export async function requirePermission(
    request: NextRequest,
    permission: string
): Promise<{ authorized: boolean; user: any; error?: string; response?: NextResponse }> {
    const { user, error } = await getAuthUser(request)

    if (error || !user) {
        const response = NextResponse.json(
            { success: false, error: error || 'Unauthorized' },
            { status: 401 }
        )
        return { authorized: false, user: null, error, response }
    }

    if (!checkPermission(user.role as UserRole, permission)) {
        const response = NextResponse.json(
            { success: false, error: 'Forbidden: Missing required permission' },
            { status: 403 }
        )
        return { authorized: false, user, error: 'Permission denied', response }
    }

    return { authorized: true, user }
}

/**
 * Check if user can access resource
 */
export function canAccessResource(
    userRole: UserRole,
    resourceOwnerId: string,
    currentUserId: string,
    allowOwnerAccess = true
): boolean {
    if (userRole === 'ADMIN') return true
    if (allowOwnerAccess && currentUserId === resourceOwnerId) return true
    return false
}

/**
 * Audit log helper (console only — no audit table in production DB)
 */
export async function logAudit(
    userId: string,
    action: string,
    details?: Record<string, any>,
    status: 'success' | 'failed' = 'success'
) {
    if (status === 'failed') {
        console.warn(`[AUDIT] ${action} FAILED userId=${userId}`, details)
    }
}

/**
 * Create API response
 */
export function apiResponse<T>(
    success: boolean,
    data?: T,
    error?: string,
    statusCode: number = success ? 200 : 400
): [T extends any ? ApiResponse<T> : never, number] {
    return [
        {
            success,
            ...(data && { data }),
            ...(error && { error })
        } as any,
        statusCode
    ]
}
