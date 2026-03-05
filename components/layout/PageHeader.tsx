'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
    title: string
    backHref: string
}

export function PageHeader({ title, backHref }: PageHeaderProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(0.5rem, 2vw, 1.25rem)',
            marginBottom: 'clamp(1rem, 4vw, 2.5rem)',
        }}>
            <Link
                href={backHref}
                style={{
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <ChevronLeft size={32} />
            </Link>
            <h1 style={{
                margin: 0,
                fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
                fontFamily: 'var(--font-serif)',
                lineHeight: 1.1,
            }}>
                {title}
            </h1>
        </div>
    )
}
