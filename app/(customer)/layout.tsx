'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { BottomNav } from '@/components/layout/BottomNav'
import { PopupProvider } from '@/components/ui/Popup'

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (user && (user.role === 'KITCHEN' || user.role === 'ADMIN')) {
                router.push('/kitchen')
            }
            // Allow unauthenticated users (guests) to browse menu/home
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return <div className="loading-screen" style={{
            height: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
            color: 'var(--text-muted)'
        }}>Loading...</div>
    }

    // Redirect KITCHEN/ADMIN to their portal
    if (user && (user.role === 'KITCHEN' || user.role === 'ADMIN')) {
        return null
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <BottomNav />
            <PopupProvider />
        </div>
    )
}
