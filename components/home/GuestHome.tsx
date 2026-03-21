'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnnouncementCard } from '@/components/ui/AnnouncementCard'
import { Loading } from '@/components/ui/Loading'
import { ChevronDown, Receipt, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

export default function GuestHome() {
    const router = useRouter()
    const { user } = useAuth()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
    const [activeSession, setActiveSession] = useState<any>(null)
    const [loadingSession, setLoadingSession] = useState(true)

    // Design Tokens
    const ITALIAN_RED = '#A91E22'
    const DEEP_BLACK = '#1A1A1A'
    const CRISP_WHITE = '#FFFFFF'
    const GUEST_GREEN = '#10B981'

    useEffect(() => {
        async function fetchNews() {
            try {
                const res = await fetch('/api/announcements')
                const json = await res.json()
                if (json.success && json.data) setAnnouncements(json.data)
            } catch (e) { console.error('fetchNews error:', e) }
            setLoadingAnnouncements(false)
        }

        async function fetchActiveSession() {
            try {
                const response = await fetch(`/api/sessions/active?phone=${user?.phone}&userId=${user?.id}`)
                const data = await response.json()
                if (data.success) setActiveSession(data.session)
            } catch (e) {
                console.error(e)
            } finally {
                setLoadingSession(false)
            }
        }

        fetchNews()
        if (user?.email || user?.phone) {
            fetchActiveSession()
        } else {
            setLoadingSession(false)
        }
    }, [user?.id, user?.email])

    if (loadingSession) {
        return <Loading fullScreen message="Loading your dining session..." />
    }

    return (
        <div style={{ background: CRISP_WHITE, color: DEEP_BLACK, minHeight: '100dvh' }} className="fade-in">
            {/* 1. Hero Section with Simpler CTA */}
            <header
                style={{
                    height: 'clamp(450px, 80dvh, 800px)',
                    minHeight: '400px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: '#000',
                    position: 'relative',
                }}
            >
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    poster="https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2000"
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.55,
                        filter: 'grayscale(10%) contrast(110%)',
                    }}
                >
                    <source src="/home.mp4" type="video/mp4" />
                </video>

                {/* Depth Layering */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.6) 100%)',
                        zIndex: 1,
                    }}
                />

                <div style={{ position: 'relative', textAlign: 'center', padding: '0 clamp(16px, 5vw, 24px)', zIndex: 10, maxWidth: '100%' }}>
                    <h1
                        className="hero-title"
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: 'clamp(3.5rem, 12vw, 8.5rem)',
                            lineHeight: 1,
                            marginBottom: '1.5rem',
                            textTransform: 'uppercase',
                            fontWeight: 900,
                        }}
                    >
                        Ai Cavalli
                    </h1>
                    <h3
                        className="hero-subtitle"
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: 'clamp(1.35rem, 5vw, 3rem)',
                            lineHeight: 1,
                            marginBottom: '2rem',
                            textTransform: 'capitalize',
                            fontWeight: 700,
                            color: CRISP_WHITE,
                            opacity: 0,
                        }}
                    >
                        Savour the Legacy
                    </h3>

                    <p
                        className="hero-subtitle"
                        style={{
                            letterSpacing: '0.3em',
                            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                            marginBottom: '2rem',
                            color: CRISP_WHITE,
                            fontWeight: 400,
                            opacity: 0,
                        }}
                    >
                        An Indo-Italian café at EIRS—where tradition, taste, and equestrian grace unite.
                    </p>

                    {!activeSession && (
                        <button
                            onClick={() => router.push('/menu')}
                            className="hero-button"
                            style={{
                                padding: '1.25rem 3.5rem',
                                background: ITALIAN_RED,
                                color: CRISP_WHITE,
                                border: 'none',
                                fontWeight: 700,
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                boxShadow: '0 12px 40px rgba(169, 30, 34, 0.4)',
                                opacity: 0,
                                transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                            }}
                        >
                            Start Ordering
                        </button>
                    )}
                </div>

                <div style={{ position: 'absolute', bottom: '40px', zIndex: 10 }}>
                    <ChevronDown size={32} color={ITALIAN_RED} style={{ animation: 'bounce 2s infinite' }} />
                </div>
            </header>

            {/* 2. Active Session Card (Prominent for Guests) */}
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(32px, 8vw, 100px) clamp(12px, 4vw, 24px)' }} id="session">
                {activeSession ? (
                    <div
                        className="hover-lift session-card"
                        style={{
                            marginBottom: '80px',
                            background: `linear-gradient(135deg, ${GUEST_GREEN} 0%, #059669 100%)`,
                            borderRadius: '24px',
                            padding: 'clamp(20px, 4vw, 40px)',
                            color: 'white',
                            boxShadow: '0 20px 40px rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'clamp(12px, 2.5vw, 24px)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Decorative Pattern */}
                        <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.1 }}>
                            <Receipt size={200} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, flexWrap: 'wrap', gap: '24px' }}>
                            <div style={{ flex: '1 1 auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <Clock size={20} />
                                    <span style={{ fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.875rem' }}>Active Dining Session</span>
                                </div>
                                <h3 style={{
                                    margin: '8px 0',
                                    fontSize: 'clamp(1.5rem, 8vw, 2.5rem)',
                                    fontFamily: 'var(--font-serif)',
                                    fontWeight: 900,
                                    color: ITALIAN_RED,
                                    lineHeight: 1
                                }}>
                                    ₹{activeSession.total_amount?.toFixed(2) || '0.00'}
                                </h3>
                                <p style={{ margin: 0, opacity: 0.9, fontSize: 'clamp(0.9rem, 2.2vw, 1.2rem)', fontWeight: 600 }}>
                                    {activeSession.orderCount || 0} Orders placed • {activeSession.num_guests} {activeSession.num_guests === 1 ? 'Guest' : 'Guests'}
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <Button
                                    onClick={() => router.push('/menu')}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        color: 'white',
                                        fontWeight: 800,
                                        padding: '0.85rem 1.75rem',
                                        height: 'auto',
                                        borderRadius: '12px',
                                        fontSize: '0.95rem',
                                        border: '2px solid white',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}
                                >
                                    Add More Orders
                                </Button>

                                <Button
                                    onClick={() => router.push('/orders')}
                                    style={{
                                        background: 'white',
                                        color: '#059669',
                                        fontWeight: 900,
                                        padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(1.25rem, 3vw, 2rem)',
                                        height: 'auto',
                                        borderRadius: '12px',
                                        fontSize: 'clamp(0.85rem, 2vw, 1.05rem)',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    VIEW STATUS <ArrowRight size={18} style={{ marginLeft: '8px' }} />
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        style={{
                            marginBottom: 'clamp(40px, 8vw, 80px)',
                            background: 'linear-gradient(135deg, #FEF3C7 0%, #FCD34D 100%)',
                            borderRadius: 'clamp(16px, 4vw, 24px)',
                            padding: 'clamp(24px, 6vw, 40px)',
                            textAlign: 'center',
                            color: DEEP_BLACK,
                            boxShadow: '0 20px 40px rgba(252, 211, 77, 0.2)',
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontFamily: 'var(--font-serif)', fontWeight: 800, marginBottom: '12px' }}>
                            No Active Session
                        </h3>
                        <p style={{ margin: 0, fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', opacity: 0.9 }}>
                            Start exploring the menu to place your first order
                        </p>
                    </div>
                )
                }

                {/* 3. News Section (Il Giornale) */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        marginBottom: 'clamp(40px, 6vw, 80px)',
                    }}
                >
                    <div style={{ width: '50px', height: '2px', background: ITALIAN_RED, marginBottom: '2rem' }} />
                    <h2
                        style={{
                            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
                            fontFamily: 'var(--font-serif)',
                            marginBottom: '1rem',
                            color: DEEP_BLACK,
                            fontWeight: 500,
                        }}
                    >
                        Il Giornale
                    </h2>
                    <p style={{ color: '#666', fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)', fontStyle: 'italic', maxWidth: '500px', padding: '0 1rem' }}>
                        Today's specials and dining highlights
                    </p>
                </div>

                {
                    announcements.length > 0 ? (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
                                gap: 'clamp(24px, 4vw, 48px)',
                            }}
                        >
                            {announcements.map((item) => (
                                <AnnouncementCard key={item.id} announcement={item} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '100px 24px', border: '1px solid #F0F0F0', borderRadius: '4px' }}>
                            <p style={{ color: '#BBB', letterSpacing: '0.2em', fontSize: '0.8rem' }}>No updates at this time</p>
                        </div>
                    )
                }
            </main >

            {/* 4. Guest Call to Action Section */}
            <section
                style={{
                    background: ITALIAN_RED,
                    padding: 'clamp(60px, 12vw, 140px) clamp(16px, 5vw, 24px)',
                    paddingBottom: 'clamp(100px, 15vw, 140px)',
                    textAlign: 'center',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle, transparent 0%, rgba(0,0,0,0.15) 100%)',
                        pointerEvents: 'none',
                    }}
                />

                <div style={{ position: 'relative', zIndex: 2, maxWidth: '900px', margin: '0 auto' }}>
                    <h1
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                            marginBottom: '1rem',
                            color: DEEP_BLACK,
                            fontWeight: 800,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Ai Cavalli
                    </h1>
                    <h2
                        className='bottom-section'
                        style={{
                            fontFamily: 'var(--font-serif)',
                            lineHeight: 1,
                            marginBottom: '2rem',
                            textTransform: 'capitalize',
                            fontWeight: 700,
                            color: CRISP_WHITE,
                            opacity: 100,
                        }}
                    >
                        Savour the Legacy
                    </h2>

                    <div style={{ width: '80px', height: '1px', background: CRISP_WHITE, margin: '0 auto 2.5rem', opacity: 0.6 }} />

                    <p
                        style={{
                            color: CRISP_WHITE,
                            lineHeight: 1.8,
                            fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
                            fontWeight: 400,
                            margin: '0 auto',
                            maxWidth: '750px',
                        }}
                    >
                        An Indo-Italian café at EIRS—where tradition, taste, and equestrian grace unite.
                    </p>
                </div>
            </section >

            <style jsx>{`
                /* 1. Cinematic Title Reveal & Shimmer */
                .hero-title {
                    background: linear-gradient(to right, #a91e22 20%, #d32f2f 40%, #ff5252 50%, #d32f2f 60%, #a91e22 80%);
                    background-size: 200% auto;
                    background-clip: text;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: titleReveal 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards, shimmer 4s linear infinite;
                }

                .hero-subtitle {
                    animation: subtitleReveal 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards;
                }

                .hero-button {
                    animation: subtitleReveal 1s ease-out 1.1s forwards;
                }

                /* 2. Advanced Keyframes */
                @keyframes titleReveal {
                    from {
                        opacity: 0;
                        transform: translateY(40px) scale(1.05);
                        filter: blur(15px) brightness(1.2);
                        letter-spacing: 0.15em;
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                        filter: blur(0) brightness(1);
                        letter-spacing: -0.03em;
                    }
                }

                @keyframes shimmer {
                    to {
                        background-position: 200% center;
                    }
                }

                @keyframes subtitleReveal {
                    from {
                        opacity: 0;
                        transform: translateY(15px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes bounce {
                    0%,
                    20%,
                    50%,
                    80%,
                    100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(-10px);
                    }
                    60% {
                        transform: translateY(-5px);
                    }
                }

                .hero-button:hover {
                    transform: translateY(-5px) scale(1.03);
                    box-shadow: 0 20px 60px rgba(169, 30, 34, 0.6) !important;
                    background: #c22227 !important;
                }

                .hover-lift {
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .hover-lift:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 30px 60px rgba(16, 185, 129, 0.3) !important;
                }

                @media (max-width: 768px) {
                    main {
                        padding: 40px 12px !important;
                    }
                    header {
                        height: 75dvh !important;
                        min-height: 380px !important;
                    }
                    .hero-title {
                        letter-spacing: -0.01em;
                    }
                    .session-card {
                        margin-bottom: 32px !important;
                        border-radius: 16px !important;
                        gap: 10px !important;
                        padding: 16px !important;
                    }
                }
                @media (max-width: 480px) {
                    main {
                        padding: 32px 10px !important;
                    }
                    header {
                        height: 70dvh !important;
                        min-height: 360px !important;
                    }
                }
            `}</style>
        </div >
    )
}
