'use client'

import React from 'react'
import { Calendar, ArrowRight } from 'lucide-react'

export function AnnouncementCard({ announcement }: { announcement: any }) {
    return (
        <div style={{
            background: 'white',
            borderRadius: 'clamp(16px, 4vw, 24px)',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            cursor: 'pointer'
        }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Image Container */}
            {announcement.image_url && (
                <div style={{ width: '100%', height: 'clamp(160px, 30vw, 220px)', overflow: 'hidden' }}>
                    <img
                        src={announcement.image_url}
                        alt={announcement.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
            )}

            {/* Content Container */}
            <div style={{ padding: 'clamp(1.25rem, 4vw, 1.75rem)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                    <Calendar size={14} color="#A91E22" />
                    <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        color: '#999',
                        textTransform: 'uppercase'
                    }}>
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </span>
                </div>

                <h3 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
                    color: '#1A1A1A',
                    marginBottom: '0.75rem',
                    lineHeight: 1.25
                }}>
                    {announcement.title}
                </h3>

                <p style={{
                    color: '#666',
                    lineHeight: 1.6,
                    fontSize: '0.95rem',
                    marginBottom: '1.5rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {announcement.content}
                </p>

                <div style={{
                    marginTop: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#A91E22',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    letterSpacing: '0.05em'
                }}>
                    READ MORE <ArrowRight size={16} />
                </div>
            </div>
        </div>
    )
}