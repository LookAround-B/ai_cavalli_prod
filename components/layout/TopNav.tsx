'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface NavLink {
    label: string
    href: string
    muted?: boolean
}

interface TopNavProps {
    title: string
    links: NavLink[]
    accentColor?: string       // header background
    accentText?: string        // header text color
    roleLabel?: string         // shown next to user name
    viewToggle?: {
        currentView: 'kitchen' | 'admin'
    }
}

export function TopNav({ title, links, accentColor = '#1A1A1A', accentText = '#FFFFFF', roleLabel, viewToggle }: TopNavProps) {
    const { user, logout } = useAuth()
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        if (menuOpen) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [menuOpen])

    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await logout()
        } catch {
            setLoggingOut(false)
        }
    }

    const isKitchen = viewToggle?.currentView === 'kitchen'
    const isAdmin = viewToggle?.currentView === 'admin'

    return (
        <header style={{
            background: accentColor,
            color: accentText,
            padding: '0 clamp(0.75rem, 2vw, 1.5rem)',
            height: '60px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            gap: '0.5rem',
        }}>
            {/* Left: Title */}
            <h1 style={{
                margin: 0,
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-serif)',
                flexShrink: 0,
            }}>
                {title}
            </h1>

            {/* Center: Nav links */}
            <nav style={{
                display: 'flex',
                gap: '0.25rem',
                alignItems: 'center',
                overflowX: 'auto',
                paddingBottom: '2px', // Space for focus ring if needed
                flexShrink: 1,
                minWidth: 0,
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
            }}>
                <style>{`
                    nav::-webkit-scrollbar { display: none; }
                `}</style>
                {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            style={{
                                color: link.muted
                                    ? `${accentText}88`
                                    : isActive ? accentText : `${accentText}cc`,
                                textDecoration: 'none',
                                fontSize: 'clamp(0.7rem, 1.5vw, 0.85rem)',
                                fontWeight: isActive ? 700 : 500,
                                padding: '0.4rem clamp(0.4rem, 1vw, 0.75rem)',
                                borderRadius: '8px',
                                background: isActive ? `${accentText}15` : 'transparent',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                            }}
                        >
                            {link.label}
                        </Link>
                    )
                })}

                {/* View Toggle for ADMIN users */}
                {viewToggle && (
                    <Link
                        href={isKitchen ? '/admin' : '/kitchen'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginLeft: 'clamp(0.25rem, 1vw, 0.5rem)',
                            padding: '0.3rem 0.7rem',
                            borderRadius: '20px',
                            border: `1.5px solid ${accentText}30`,
                            background: `${accentText}08`,
                            color: `${accentText}90`,
                            textDecoration: 'none',
                            fontSize: 'clamp(0.65rem, 1.2vw, 0.78rem)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            flexShrink: 0,
                        }}
                    >
                        <span style={{
                            display: 'inline-block',
                            width: '28px',
                            height: '16px',
                            borderRadius: '12px',
                            background: isAdmin
                                ? 'linear-gradient(135deg, #C0272D, #8B1A1F)'
                                : `${accentText}25`,
                            position: 'relative',
                            transition: 'background 0.25s ease',
                            flexShrink: 0,
                        }}>
                            <span style={{
                                position: 'absolute',
                                top: '2px',
                                left: isAdmin ? '14px' : '2px',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: 'white',
                                transition: 'left 0.25s ease',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            }} />
                        </span>
                        {isKitchen ? 'Admin' : 'Kitchen'}
                    </Link>
                )}
            </nav>

            {/* Right: User menu */}
            <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: `${accentText}10`,
                        border: `1px solid ${accentText}20`,
                        borderRadius: '10px',
                        padding: '0.35rem clamp(0.5rem, 1.5vw, 0.75rem)',
                        color: accentText,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                        minHeight: '44px', /* Touch target */
                    }}
                    aria-label="User menu"
                >
                    {/* Avatar circle */}
                    <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: `${accentText}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        flexShrink: 0,
                    }}>
                        {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                    <span className="user-name-label" style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name || 'User'}
                    </span>
                    <ChevronDown size={14} style={{
                        transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                    }} />
                </button>

                {/* Dropdown */}
                {menuOpen && (
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-lg)',
                        border: '1px solid var(--border)',
                        minWidth: '220px',
                        overflow: 'hidden',
                        animation: 'fadeInDown 0.15s ease',
                        zIndex: 200,
                    }}>
                        {/* User info */}
                        <div style={{
                            padding: '0.875rem 1rem',
                            borderBottom: '1px solid var(--border)',
                        }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                color: 'var(--text)',
                                marginBottom: '2px',
                            }}>
                                {user?.name}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                            }}>
                                {roleLabel || user?.role || 'User'}
                                {user?.phone && ` · ${user.phone}`}
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '0.75rem 1rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: loggingOut ? 'wait' : 'pointer',
                                color: 'var(--primary)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'background 0.15s ease',
                                textAlign: 'left',
                                opacity: loggingOut ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => { if (!loggingOut) e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                            <LogOut size={16} />
                            {loggingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}
