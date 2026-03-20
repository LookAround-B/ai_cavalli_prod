'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthUser, UserRole, LoginCredentials, GuestLoginCredentials, AuthResponse } from '@/lib/types/auth'
import { hasPermission, canAccess } from '@/lib/types/auth'

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to set auth cookie for middleware detection
function setAuthCookie(role: UserRole | null, token?: string | null, userId?: string | null) {
    if (typeof document === 'undefined') return

    if (role === null) {
        // Clear cookies on logout
        document.cookie = 'auth_role=; path=/; max-age=0; SameSite=Lax'
        document.cookie = 'session_token=; path=/; max-age=0; SameSite=Lax'
        document.cookie = 'auth_user_id=; path=/; max-age=0; SameSite=Lax'
    } else {
        // Set auth role cookie
        document.cookie = `auth_role=${role}; path=/; max-age=86400; SameSite=Lax`
        // Set session token cookie (for API auth)
        if (token) {
            document.cookie = `session_token=${token}; path=/; max-age=86400; SameSite=Lax`
        }
        // Set user ID cookie (for API auth fallback)
        if (userId) {
            document.cookie = `auth_user_id=${userId}; path=/; max-age=86400; SameSite=Lax`
        }
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [sessionToken, setSessionToken] = useState<string | null>(null)
    const router = useRouter()

    // Initialize user from localStorage (client-side only)
    useEffect(() => {
        const initializeAuth = async () => {
            // First, check localStorage for cached user and session
            const storedUser = localStorage.getItem('auth_user')
            const storedToken = localStorage.getItem('session_token')
            let cachedUser: AuthUser | null = null

            if (storedUser) {
                try {
                    cachedUser = JSON.parse(storedUser)
                } catch (e) {
                    console.error('Failed to parse stored user:', e)
                    localStorage.removeItem('auth_user')
                }
            }

            // If user found in storage, use it (session validated on server-side via token)
            if (cachedUser && storedToken) {
                setUser(cachedUser)
                setSessionToken(storedToken)
                setAuthCookie(cachedUser.role, storedToken, cachedUser.id)
            }

            setIsLoading(false)
        }

        initializeAuth()
    }, [])

    // Login handler for PIN-based (RIDER/KITCHEN/ADMIN)
    const login = useCallback(
        async (credentials: LoginCredentials): Promise<AuthResponse> => {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: credentials.phone,
                        pin: credentials.pin,
                        login_type: 'rider'
                    })
                })

                const data = await response.json()

                if (data.success && data.user && data.session) {
                    localStorage.setItem('auth_user', JSON.stringify(data.user))
                    localStorage.setItem('session_token', data.session.session_token)
                    setUser(data.user)
                    setSessionToken(data.session.session_token)
                    setAuthCookie(data.user.role, data.session.session_token, data.user.id)
                    return data
                }

                return data
            } catch (error) {
                console.error('Login error:', error)
                return { success: false, error: 'Login failed' }
            }
        },
        []
    )

    // Guest login handler
    const guestLogin = useCallback(
        async (credentials: GuestLoginCredentials): Promise<AuthResponse> => {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: credentials.phone,
                        name: credentials.name,
                        table_name: credentials.table_name,
                        num_guests: credentials.num_guests,
                        login_type: 'guest'
                    })
                })

                const data = await response.json()

                if (data.success && data.user && data.session) {
                    localStorage.setItem('auth_user', JSON.stringify(data.user))
                    localStorage.setItem('session_token', data.session.session_token)
                    localStorage.setItem('guest_session', JSON.stringify(data.session))
                    setUser(data.user)
                    setSessionToken(data.session.session_token)
                    setAuthCookie('OUTSIDER', data.session.session_token, data.user.id)
                    return data
                }

                return data
            } catch (error) {
                console.error('Guest login error:', error)
                return { success: false, error: 'Login failed' }
            }
        },
        []
    )

    const logout = useCallback(async () => {
        try {
            // Call logout endpoint with userId
            const storedUser = localStorage.getItem('auth_user')
            const userData = storedUser ? JSON.parse(storedUser) : null
            if (userData?.id) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userData.id })
                })
            }
        } catch (e) {
            console.error('Logout request error:', e)
        } finally {
            // Clear all auth-related localStorage
            localStorage.removeItem('auth_user')
            localStorage.removeItem('session_token')
            localStorage.removeItem('guest_session')
            localStorage.removeItem('guest_phone')
            localStorage.removeItem('guest_name')
            localStorage.removeItem('guest_email')
            localStorage.removeItem('guest_table')
            localStorage.removeItem('guest_num_guests')
            localStorage.removeItem('guest_orders')
            localStorage.removeItem('is_guest_active')
            // Keep cart in localStorage so it persists across sessions

            // Clear auth cookies
            setAuthCookie(null)

            setUser(null)
            setSessionToken(null)
            router.push('/menu')
        }
    }, [router])

    const refreshSession = useCallback(async (): Promise<boolean> => {
        try {
            const token = localStorage.getItem('session_token')
            if (!token) {
                return false
            }

            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            })

            const data = await response.json()

            if (data.success && data.user && data.session) {
                localStorage.setItem('auth_user', JSON.stringify(data.user))
                localStorage.setItem('session_token', data.session.session_token)
                setUser(data.user)
                setSessionToken(data.session.session_token)
                return true
            }

            return false
        } catch (error) {
            console.error('Session refresh error:', error)
            return false
        }
    }, [])

    const hasRoleCheck = useCallback(
        (...roles: UserRole[]): boolean => {
            if (!user) return false
            return canAccess(user.role, roles)
        },
        [user]
    )

    const hasPermissionCheck = useCallback(
        (permission: string): boolean => {
            if (!user) return false
            return hasPermission(user.role, permission)
        },
        [user]
    )

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                sessionToken,
                login,
                guestLogin,
                logout,
                refreshSession,
                hasRole: hasRoleCheck,
                hasPermission: hasPermissionCheck
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
