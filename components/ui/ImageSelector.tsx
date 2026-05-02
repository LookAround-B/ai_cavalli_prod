'use client'

import { useState, useRef } from 'react'
import { Upload, Link as LinkIcon, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from './button'

interface ImageSelectorProps {
    value: string;
    onChange: (val: string) => void;
    label?: string;
}

export function ImageSelector({ value, onChange, label = "Image" }: ImageSelectorProps) {
    const [mode, setMode] = useState<'url' | 'upload'>('url')
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Only JPEG, PNG, GIF, and WebP images are allowed.')
            return
        }

        // 2MB Limit
        if (file.size > MAX_FILE_SIZE) {
            setError('File size exceeds 2MB limit.')
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64String = reader.result as string
            onChange(base64String)
            setError(null)
        }
        reader.readAsDataURL(file)
    }

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim()
        if (!val) { onChange(''); return }
        try {
            const url = new URL(val)
            if (['http:', 'https:'].includes(url.protocol)) {
                onChange(val)
            }
        } catch {
            // Allow typing - only set if it could become a valid URL
            onChange(val)
        }
    }

    return (
        <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                color: 'var(--text-muted)',
                textTransform: 'uppercase'
            }}>
                {label}
            </label>

            <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden'
            }}>
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.02)'
                }}>
                    <button
                        type="button"
                        onClick={() => setMode('url')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: mode === 'url' ? 'white' : 'transparent',
                            color: mode === 'url' ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        <LinkIcon size={14} /> URL
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('upload')}
                        style={{
                            flex: 1,
                            padding: '10px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: mode === 'upload' ? 'white' : 'transparent',
                            color: mode === 'upload' ? 'var(--primary)' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        <Upload size={14} /> Upload
                    </button>
                </div>

                <div style={{ padding: 'var(--space-3)' }}>
                    {mode === 'url' ? (
                        <div style={{ position: 'relative' }}>
                            <input
                                type="url"
                                value={value.startsWith('data:') ? '' : value}
                                onChange={handleUrlChange}
                                placeholder="Paste image URL here..."
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.9rem',
                                    outline: 'none'
                                }}
                            />
                            {value.startsWith('data:') && (
                                <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                                    Local image selected. Enter URL to override.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".jpg,.jpeg,.png,.gif,.webp"
                                style={{ display: 'none' }}
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: '2px dashed var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '20px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)',
                                    background: 'rgba(0,0,0,0.01)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                                <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Click to select image (Max 2MB)
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', color: '#EF4444', fontSize: '0.75rem' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    {value && !error && (
                        <div style={{ marginTop: '12px', position: 'relative' }}>
                            <div style={{
                                width: '100%',
                                height: '140px',
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                                border: '1px solid var(--border)'
                            }}>
                                <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    background: 'rgba(0,0,0,0.5)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
