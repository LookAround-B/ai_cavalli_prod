'use client'

import { useAuth } from '@/lib/auth/context'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import { TopNav } from '@/components/layout/TopNav'
import { PopupProvider } from '@/components/ui/Popup'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Admin Portal...</div>
    }

    if (!user) {
        return null
    }

    const links = [
        { label: 'Analytics', href: '/ops' },
        { label: 'Menu', href: '/ops/menu' },
        { label: 'Price Increase', href: '/ops/menu/price-increase' },
        { label: 'CMS', href: '/ops/cms' },
        { label: 'Users', href: '/ops/users' },
    ]

    const getRoleLabel = () => {
        if (user.role === 'KITCHEN') return 'Kitchen Manager'
        return 'Admin'
    }

    return (
        <ProtectedRoute requiredRoles={['ADMIN', 'KITCHEN']}>
            <div className="admin-layout">
                <TopNav
                    title="Admin Portal"
                    links={links}
                    accentColor="#FFFFFF"
                    accentText="#1A1A1A"
                    roleLabel={getRoleLabel()}
                    viewToggle={{ currentView: 'admin' }}
                />
                <main style={{
                    padding: 'clamp(0.75rem, 3vw, 2rem)',
                    background: '#f5f5f5',
                    minHeight: 'calc(100dvh - 64px)'
                }}>
                    {children}
                </main>
                <PopupProvider />
            </div>
        </ProtectedRoute>
    )
}
