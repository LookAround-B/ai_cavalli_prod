'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnnouncementCard } from '@/components/ui/AnnouncementCard'
import { ChevronDown } from 'lucide-react'

export default function StudentHome() {
    const router = useRouter()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)

    // Design Tokens
    const ITALIAN_RED = '#A91E22'
    const DEEP_BLACK = '#1A1A1A'
    const CRISP_WHITE = '#FFFFFF'

    useEffect(() => {
        async function fetchNews() {
            try {
                const res = await fetch('/api/announcements')
                const json = await res.json()
                if (json.success && json.data) setAnnouncements(json.data)
            } catch (e) { console.error('fetchNews error:', e) }
            setLoadingAnnouncements(false)
        }

        fetchNews()
    }, [])

    return (
        <div style={{ background: CRISP_WHITE, color: DEEP_BLACK, minHeight: '100dvh' }} className="fade-in">
            {/* 1. Cinematic Video Hero */}
            <header
                style={{
                    height: 'clamp(450px, 85dvh, 900px)',
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
                    {/* ANIMATED LUXURY TITLE */}
                    <h1
                        className="hero-title shimmer-text"
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

                    <p
                        className="hero-subtitle"
                        style={{
                            letterSpacing: '0.6em',
                            fontSize: 'clamp(0.7rem, 2vw, 0.85rem)',
                            marginBottom: '3.5rem',
                            color: CRISP_WHITE,
                            fontWeight: 700,
                            opacity: 0,
                        }}
                    >
                        An Indo-Italian café at EIRS—where tradition, taste, and equestrian grace unite
                    </p>

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
                        Explore Menu
                    </button>
                </div>

                <div style={{ position: 'absolute', bottom: '40px', zIndex: 10 }}>
                    <ChevronDown size={32} color={ITALIAN_RED} style={{ animation: 'bounce 2s infinite' }} />
                </div>
            </header>

            {/* 2. News Section (Il Giornale) */}
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: 'clamp(40px, 10vw, 100px) clamp(12px, 4vw, 24px)' }} id="journal">
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
                        Notes on seasonal ingredients, private gatherings, and the art of dining.
                    </p>
                </div>

                {announcements.length > 0 ? (
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
                        <p style={{ color: '#BBB', letterSpacing: '0.2em', fontSize: '0.8rem' }}>SILENZIO STAMPA</p>
                    </div>
                )}
            </main>

            {/* 3. Hospitality Section (Visual Contrast Fix) */}
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
                    <h3
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                            marginBottom: '2rem',
                            color: DEEP_BLACK,
                            fontWeight: 800,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        Ai Cavalli
                    </h3>
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

                    <div style={{ width: '80px', height: '1px', background: DEEP_BLACK, margin: '0 auto 2.5rem', opacity: 0.6 }} />

                    <p
                        style={{
                            color: CRISP_WHITE,
                            lineHeight: 1.8,
                            fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)',
                            fontWeight: 400,
                            margin: '0 auto',
                            maxWidth: '750px',
                        }}
                    >
                        An Indo-Italian café at EIRS—where tradition, taste, and equestrian grace unite.                    </p>
                </div>
            </section>

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
        </div>
    )
}
