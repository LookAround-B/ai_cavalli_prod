/**
 * Unified Authentication & RBAC Types
 * Roles: RIDER, STAFF, OUTSIDER, KITCHEN, ADMIN
 */

export type UserRole = 'RIDER' | 'STAFF' | 'OUTSIDER' | 'KITCHEN' | 'ADMIN'

export interface AuthUser {
    id: string
    email: string
    phone: string
    name: string
    role: UserRole
    parent_name?: string
    position?: string
    last_login?: string
    created_at: string
}

export interface AuthSession {
    user: AuthUser
    session_token: string
    expires_at: string
    created_at: string
}

export interface AuthResponse {
    success: boolean
    user?: AuthUser
    session?: AuthSession
    error?: string
    message?: string
}

export interface LoginCredentials {
    email?: string
    phone: string
    pin: string
}

export interface GuestLoginCredentials {
    name: string
    phone: string
    email?: string
    table_name: string
    num_guests: number
}

export interface AuthContextType {
    user: AuthUser | null
    isLoading: boolean
    isAuthenticated: boolean
    sessionToken: string | null
    login: (credentials: LoginCredentials) => Promise<AuthResponse>
    guestLogin: (credentials: GuestLoginCredentials) => Promise<AuthResponse>
    logout: () => Promise<void>
    refreshSession: () => Promise<boolean>
    hasRole: (...roles: UserRole[]) => boolean
    hasPermission: (permission: string) => boolean
}

/**
 * Role-Based Access Control Matrix
 */
export const RBAC = {
    RIDER: {
        name: 'RIDER',
        permissions: [
            'view_menu',
            'create_order',
            'view_own_orders',
            'cancel_own_order',
            'view_own_profile',
            'update_own_profile'
        ]
    },
    STAFF: {
        name: 'Staff',
        permissions: [
            'view_menu',
            'create_order',
            'view_own_orders',
            'cancel_own_order',
            'view_own_profile',
            'update_own_profile'
        ]
    },
    OUTSIDER: {
        name: 'Guest',
        permissions: [
            'view_menu',
            'create_order',
            'view_own_orders',
            'view_own_session',
            'update_own_session',
            'request_bill'
        ]
    },
    KITCHEN: {
        name: 'Kitchen Manager',
        permissions: [
            'view_all_orders',
            'update_order_status',
            'view_order_details',
            'view_all_sessions',
            'manage_specials',
            'view_analytics',
            'view_all_users',
            'manage_menu',
            'manage_announcements',
            'view_menu',
            'create_order',
            'view_riders',
        ]
    },
    ADMIN: {
        name: 'Admin',
        permissions: [
            'view_menu',
            'manage_menu',
            'view_all_orders',
            'update_order_status',
            'view_all_sessions',
            'manage_users',
            'manage_staff',
            'view_analytics',
            'manage_announcements',
            'manage_specials',
            'view_audit_logs',
            'manage_roles'
        ]
    }
} as const

/**
 * Route Access Control
 */
export const routeAccess: Record<string, UserRole[]> = {
    // Public routes (no auth required)
    '/login': [],
    '/auth/callback': [],
    '/home': [],
    '/menu': [],

    // Public customer routes (accessible without auth)
    '/cart': [],
    '/orders': [],
    '/profile': [],  // Public route - shows "not logged in" page for unauthenticated users

    // Protected customer routes (need auth)
    '/status': ['OUTSIDER', 'RIDER', 'STAFF'],

    // Kitchen routes
    '/kitchen': ['KITCHEN', 'ADMIN'],
    '/kitchen/orders': ['KITCHEN', 'ADMIN'],
    '/kitchen/specials': ['KITCHEN', 'ADMIN'],
    '/kitchen/analytics': ['KITCHEN', 'ADMIN'],

    // Admin routes (KITCHEN has full access except bill delete)
    '/ops': ['KITCHEN', 'ADMIN'],
    '/ops/users': ['KITCHEN', 'ADMIN'],
    '/ops/menu': ['KITCHEN', 'ADMIN'],
    '/ops/menu/price-increase': ['KITCHEN', 'ADMIN'],
    '/ops/cms': ['KITCHEN', 'ADMIN'],
    '/ops/analytics': ['KITCHEN', 'ADMIN'],
    '/ops/audit': ['KITCHEN', 'ADMIN'],

    // API routes
    '/api/v1/auth/login': [],
    '/api/v1/auth/logout': ['RIDER', 'STAFF', 'OUTSIDER', 'KITCHEN', 'ADMIN'],
    '/api/v1/auth/refresh': ['RIDER', 'STAFF', 'OUTSIDER', 'KITCHEN', 'ADMIN'],
    '/api/v1/orders/create': ['RIDER', 'STAFF', 'OUTSIDER', 'KITCHEN', 'ADMIN'],
    '/api/v1/orders/list': ['RIDER', 'STAFF', 'OUTSIDER', 'KITCHEN', 'ADMIN'],
    '/api/v1/ops/users': ['ADMIN', 'KITCHEN'],
    '/api/v1/users/profile': ['RIDER', 'STAFF', 'OUTSIDER', 'KITCHEN', 'ADMIN']
}

/**
 * Helper functions
 */
export function canAccess(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    if (requiredRoles.length === 0) return true
    return requiredRoles.includes(userRole)
}

export function hasPermission(userRole: UserRole, permission: string): boolean {
    const role = RBAC[userRole]
    return (role?.permissions as readonly string[]).includes(permission) ?? false
}

export function getRoleDisplayName(role: UserRole): string {
    return RBAC[role]?.name ?? role
}

export function getRouteAccessRoles(path: string): UserRole[] {
    return routeAccess[path] ?? ['ADMIN']
}
