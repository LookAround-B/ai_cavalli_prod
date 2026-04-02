'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loading } from '@/components/ui/Loading'
import {
    Trash2,
    Plus,
    Image,
    Bell,
    Calendar,
    Link as LinkIcon,
    Sparkles,
    ExternalLink,
    ChefHat,
    Utensils
} from 'lucide-react'
import { ImageSelector } from '@/components/ui/ImageSelector'
import { AdminPageHeader } from '@/components/layout/AdminPageHeader'
import { showConfirm, showError } from '@/components/ui/Popup'

interface Announcement {
    id: string
    title: string
    description: string
    link?: string
    image_url?: string
    created_at: string
    active: boolean
}

export default function CMSPage() {
    const { sessionToken, user: authUser } = useAuth()
    const [news, setNews] = useState<Announcement[]>([])
    const [title, setTitle] = useState('')
    const [desc, setDesc] = useState('')
    const [linkUrl, setLinkUrl] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const hasToken = sessionToken || localStorage.getItem('session_token')
        const hasUser = authUser?.id || localStorage.getItem('auth_user')
        if (hasToken || hasUser) fetchNews()
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [sessionToken, authUser])

    function getAuthHeaders(): Record<string, string> {
        const token = sessionToken || localStorage.getItem('session_token') || ''
        const userId = authUser?.id || (() => {
            try {
                const stored = localStorage.getItem('auth_user')
                return stored ? JSON.parse(stored).id : ''
            } catch {
                return ''
            }
        })()

        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        }
        if (token) headers['Authorization'] = `Bearer ${token}`
        if (userId) headers['X-User-Id'] = userId
        return headers
    }

    async function fetchNews() {
        setDataLoading(true)
        try {
            const response = await fetch('/api/admin/announcements', {
                method: 'GET',
                headers: getAuthHeaders(),
                credentials: 'include'
            })
            const result = await response.json()
            if (result.success && result.data) setNews(result.data)
            else showError('Error loading announcements', result.error || 'Please try again.')
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Please try again.'
            showError('Error loading announcements', message)
        }
        setDataLoading(false)
    }

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        try {
            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    action: 'create',
                    payload: {
                        title,
                        description: desc,
                        link: linkUrl,
                        image_url: imageUrl,
                        active: true
                    }
                })
            })

            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to add announcement')

            setTitle('')
            setDesc('')
            setLinkUrl('')
            setImageUrl('')
            fetchNews()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Please try again.'
            showError(`Error adding news: ${message}`, `"please try again."`)
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        const confirmed = await showConfirm('Are you sure you want to delete this announcement?', "This action cannot be undone.")
        if (!confirmed) return
        try {
            const response = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    action: 'delete',
                    payload: { id }
                })
            })
            const result = await response.json()
            if (!result.success) throw new Error(result.error || 'Failed to delete announcement')
            fetchNews()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Please try again.'
            showError(`Error deleting news: ${message}`, `"please try again."`)
        }
    }

    if (dataLoading) return <Loading />

    return (
        <div style={{
            minHeight: '100vh',
            background: 'rgb(245,245,245)',
            padding: 'clamp(1rem, 3vw, 2.5rem)',
        }}>
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: 'radial-gradient(circle at 20px 20px, rgba(var(--primary-rgb), 0.03) 1px, transparent 0)',
                backgroundSize: '40px 40px',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                <AdminPageHeader title="Announcements & Events" subtitle="Manage restaurant news, events and promotions" icon={Bell} backHref="/admin" />

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                    gap: 'clamp(1.25rem, 4vw, 2.5rem)',
                    alignItems: 'start'
                }}>
                    {/* Creator Section */}
                    <div style={{
                        background: 'white',
                        padding: 'clamp(1.25rem, 5vw, 2.5rem)',
                        borderRadius: 'clamp(16px, 3vw, 24px)',
                        border: '1px solid rgba(var(--primary-rgb), 0.15)',
                        boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.08)',
                        position: isMobile ? 'static' : 'sticky',
                        top: '2rem',
                        maxHeight: isMobile ? 'none' : 'calc(100vh - 4rem)',
                        overflowY: isMobile ? 'visible' : 'auto'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: '2rem',
                            paddingBottom: '1.5rem',
                            borderBottom: '2px solid rgba(var(--primary-rgb), 0.1)'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.25)'
                            }}>
                                <Plus size={24} color="white" />
                            </div>
                            <h3 style={{
                                margin: 0,
                                fontWeight: '600',
                                fontSize: '1.5rem',
                                color: 'var(--text)',
                            }}>
                                New Announcement
                            </h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            <ItalianFormField
                                label="Title"
                                value={title}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                                placeholder="e.g. Special Autumn Menu"
                                required
                            />

                            <div>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                }}>
                                    Description
                                </label>
                                <Textarea
                                    value={desc}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
                                    placeholder="Describe the event or announcement..."
                                    style={{
                                        width: '100%',
                                        padding: '16px 18px',
                                        borderRadius: '14px',
                                        border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                        minHeight: '130px',
                                        fontSize: '1rem',
                                        resize: 'vertical',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                        background: 'white'
                                    }}
                                    onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
                                        e.target.style.borderColor = 'var(--primary)'
                                        e.target.style.boxShadow = '0 0 0 4px rgba(var(--primary-rgb), 0.08)'
                                    }}
                                    onBlur={(e: React.FocusEvent<HTMLTextAreaElement>) => {
                                        e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                        e.target.style.boxShadow = 'none'
                                    }}
                                />
                            </div>

                            <ImageSelector
                                label="Announcement Image"
                                value={imageUrl}
                                onChange={(val) => setImageUrl(val)}
                            />

                            <ItalianFormField
                                label="Link (Optional)"
                                icon={<LinkIcon size={16} />}
                                value={linkUrl}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkUrl(e.target.value)}
                                placeholder="https://..."
                            />

                            <button
                                onClick={handleAdd}
                                disabled={loading || !title}
                                style={{
                                    height: '58px',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '14px',
                                    fontSize: '1.05rem',
                                    fontWeight: '600',
                                    cursor: loading || !title ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.3)',
                                    opacity: loading || !title ? 0.6 : 1,
                                    marginTop: '0.5rem',
                                    letterSpacing: '0.02em'
                                }}
                                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    if (!loading && title) {
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--primary-rgb), 0.4)'
                                    }
                                }}
                                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.3)'
                                }}
                            >
                                {loading ? (
                                    <div style={{ width: '22px', height: '22px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                ) : (
                                    <>
                                        <ChefHat size={20} />
                                        Publish Announcement
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* List Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0 0.5rem'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontWeight: '600',
                                fontSize: '1.75rem',
                                color: 'var(--text)',
                            }}>
                                Published Board
                            </h3>
                            <span style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-muted)',
                                fontWeight: '600',
                                background: 'rgba(var(--primary-rgb), 0.08)',
                                padding: '8px 18px',
                                borderRadius: '24px',
                                border: '1px solid rgba(var(--primary-rgb), 0.15)',
                            }}>
                                {news.length} {news.length === 1 ? 'Announcement' : 'Announcements'}
                            </span>
                        </div>

                        {news.length === 0 ? (
                            <div style={{
                                padding: '5rem 2rem',
                                textAlign: 'center',
                                background: 'white',
                                borderRadius: '24px',
                                border: '2px dashed rgba(var(--primary-rgb), 0.2)'
                            }}>
                                <div style={{ color: 'var(--border)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                    <Sparkles size={72} strokeWidth={1.5} />
                                </div>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', color: 'var(--text)', fontWeight: '600' }}>
                                    No announcements yet
                                </h3>
                                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                                    Start sharing news and events with your guests
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))',
                                gap: '1.5rem'
                            }}>
                                {news.map(item => (
                                    <ItalianAnnouncementCard
                                        key={item.id}
                                        item={item}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div >

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div >
    )
}

function ItalianFormField({ label, icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div>
            <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
                fontSize: '0.75rem',
                fontWeight: '700',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
            }}>
                {icon}
                {label}
            </label>
            <Input
                {...props}
                style={{
                    width: '100%',
                    padding: '16px 18px',
                    borderRadius: '14px',
                    border: '2px solid rgba(var(--primary-rgb), 0.15)',
                    fontSize: '1rem',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                    background: 'white',
                }}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                    e.target.style.borderColor = 'var(--primary)'
                    e.target.style.boxShadow = '0 0 0 4px rgba(var(--primary-rgb), 0.08)'
                }}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                    e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                    e.target.style.boxShadow = 'none'
                }}
            />
        </div>
    )
}

function ItalianAnnouncementCard({ item, onDelete }: { item: Announcement; onDelete: (id: string) => void }) {
    return (
        <div style={{
            background: 'white',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(var(--primary-rgb), 0.15)',
            boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.4s ease',
            cursor: 'default'
        }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.transform = 'translateY(-6px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(var(--primary-rgb), 0.15)'
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.08)'
            }}
        >
            {item.image_url && (
                <div style={{
                    width: '100%',
                    height: '180px',
                    background: 'rgba(var(--primary-rgb), 0.05)',
                    position: 'relative',
                    borderBottom: '1px solid rgba(var(--primary-rgb), 0.1)'
                }}>
                    <img
                        src={item.image_url}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to top, rgba(var(--primary-rgb), 0.3) 0%, transparent 50%)'
                    }} />
                </div>
            )}

            <div style={{ padding: '1.75rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <h4 style={{
                        margin: 0,
                        fontSize: '1.35rem',
                        fontWeight: '600',
                        lineHeight: 1.3,
                        color: 'var(--text)',
                        flex: 1,
                    }}>
                        {item.title}
                    </h4>
                    <button
                        onClick={() => onDelete(item.id)}
                        style={{
                            width: '40px',
                            height: '40px',
                            background: 'rgba(220, 38, 38, 0.08)',
                            color: '#DC2626',
                            border: '1px solid rgba(220, 38, 38, 0.2)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s ease',
                            marginLeft: '16px',
                            flexShrink: 0
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = '#DC2626'
                            e.currentTarget.style.color = 'white'
                            e.currentTarget.style.transform = 'scale(1.05)'
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)'
                            e.currentTarget.style.color = '#DC2626'
                            e.currentTarget.style.transform = 'scale(1)'
                        }}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>

                <p style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 1.25rem 0',
                    lineHeight: 1.7,
                    flex: 1,
                }}>
                    {item.description}
                </p>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid rgba(var(--primary-rgb), 0.1)',
                    marginTop: 'auto',
                    gap: '1rem',
                    flexWrap: 'wrap'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        fontWeight: '600',
                    }}>
                        <Calendar size={15} />
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </div>
                    {item.link && (
                        <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                fontSize: '0.8rem',
                                color: 'var(--primary)',
                                fontWeight: '700',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                e.currentTarget.style.color = 'var(--secondary)'
                                e.currentTarget.style.gap = '10px'
                            }}
                            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                                e.currentTarget.style.color = 'var(--primary)'
                                e.currentTarget.style.gap = '7px'
                            }}
                        >
                            <ExternalLink size={15} />
                            OPEN LINK
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}