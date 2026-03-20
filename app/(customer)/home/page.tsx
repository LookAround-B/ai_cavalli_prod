'use client'

import { useAuth } from '@/lib/auth/context'
import { Loading } from '@/components/ui/Loading'
import StudentHome from '@/components/home/StudentHome'
import GuestHome from '@/components/home/GuestHome'

export default function CustomerHomePage() {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <Loading fullScreen message="Loading..." />
    }

    // If no user is logged in, show guest home
    if (!user) {
        return <GuestHome />
    }

    // Render role-specific home page
    if (user.role === 'OUTSIDER') {
        return <GuestHome />
    }

    // Default to StudentHome for STUDENT and other roles
    return <StudentHome />
}