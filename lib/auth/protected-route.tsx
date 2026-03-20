/**
 * Route Protection Components
 * Ensures users have required roles to access protected routes
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import type { UserRole } from '@/lib/types/auth'

interface ProtectedRouteProps {
    children: React.ReactNode
    requiredRoles: UserRole[]
    fallbackPath?: string
}

/**
 * Protects a page/route by checking user roles
 */
export function ProtectedRoute({ children, requiredRoles, fallbackPath = '/menu' }: ProtectedRouteProps) {
    const { user, isLoading, hasRole } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push(fallbackPath)
            } else if (!hasRole(...requiredRoles)) {
                // Redirect to home based on role
                switch (user.role) {
                    case 'OUTSIDER':
                        router.push('/home')
                        break
                    case 'KITCHEN':
                    case 'ADMIN':
                        router.push('/kitchen')
                        break
                    case 'STAFF':
                    case 'RIDER':
                    default:
                        router.push('/home')
                        break
                }
            }
        }
    }, [user, isLoading, hasRole, router, fallbackPath, requiredRoles])

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
    }

    if (!user || !hasRole(...requiredRoles)) {
        return null
    }

    return <>{children}</>
}

interface RoleGuardProps {
    children: React.ReactNode
    allowedRoles: UserRole[]
    fallback?: React.ReactNode
}

/**
 * Conditionally renders content based on user role
 * Useful for showing/hiding sections within a page
 */
export function RoleGuard({ children, allowedRoles, fallback = null }: RoleGuardProps) {
    const { user, hasRole } = useAuth()

    if (!user || !hasRole(...allowedRoles)) {
        return <>{fallback}</>
    }

    return <>{children}</>
}
