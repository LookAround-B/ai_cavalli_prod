'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, ShoppingCart, User, Package } from 'lucide-react'
import clsx from 'clsx'
import styles from './BottomNav.module.css'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'

const tabs = [
    { name: 'Home', href: '/home', icon: Home, ariaLabel: 'Go to home page', authOnly: false },
    { name: 'Menu', href: '/menu', icon: Menu, ariaLabel: 'View menu', authOnly: false },
    { name: 'Cart', href: '/cart', icon: ShoppingCart, ariaLabel: 'View shopping cart', authOnly: false },
    { name: 'Orders', href: '/orders', icon: Package, ariaLabel: 'View your orders', authOnly: false },
    { name: 'Profile', href: '/profile', icon: User, ariaLabel: 'View profile', authOnly: false },
]

export function BottomNav() {
    const pathname = usePathname()
    const { items } = useCart()
    const { user } = useAuth()
    const cartCount = items.length
    const isAuthenticated = Boolean(user)

    const visibleTabs = tabs.filter(tab => !tab.authOnly || isAuthenticated)

    return (
        <nav className={styles.nav} role="navigation" aria-label="Main navigation">
            {visibleTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = pathname.startsWith(tab.href)
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={clsx(styles.link, isActive && styles.active)}
                        aria-label={tab.ariaLabel}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <div className={styles.iconWrapper}>
                            <Icon
                                size={24}
                                strokeWidth={isActive ? 2.5 : 2}
                                aria-hidden="true"
                            />
                            {tab.name === 'Cart' && cartCount > 0 && (
                                <span className={styles.badge}>{cartCount}</span>
                            )}
                        </div>
                        <span className={styles.label}>{tab.name}</span>
                    </Link>
                )
            })}
        </nav>
    )
}