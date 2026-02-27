'use client'

import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loading } from '@/components/ui/Loading'
import {
    Edit2,
    Plus,
    Search,
    Image as ImageIcon,
    Check,
    X,
    Filter,
    Save,
    Trash2,
    Utensils
} from 'lucide-react'
import { ImageSelector } from '@/components/ui/ImageSelector'
import { AdminPageHeader } from '@/components/layout/AdminPageHeader'
import { showError } from '@/components/ui/Popup'

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category_id: string;
    image_url?: string;
    available: boolean;
    category?: { name: string };
}

interface Category {
    id: string;
    name: string;
    sort_order: number;
}

export default function AdminMenuPage() {
    const [items, setItems] = useState<MenuItem[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')
    const [price, setPrice] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [available, setAvailable] = useState(true)
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        fetchData()

        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    async function fetchData() {
        setDataLoading(true)
        try {
            const res = await fetch('/api/menu/items')
            const json = await res.json()
            if (json.success) {
                if (json.data?.categories) {
                    setCategories(json.data.categories)
                    if (!categoryId && json.data.categories.length > 0) {
                        setCategoryId(json.data.categories[0].id)
                    }
                }
                if (json.data?.items) setItems(json.data.items)
            }
        } catch (e) { console.error('fetchData error:', e) }
        setDataLoading(false)
    }

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory
            return matchesSearch && matchesCategory
        })
    }, [items, searchQuery, selectedCategory])

    function resetForm() {
        setEditingId(null)
        setName('')
        setDesc('')
        setPrice('')
        setCategoryId(categories[0]?.id || '')
        setImageUrl('')
        setAvailable(true)
    }

    function handleEdit(item: MenuItem) {
        setEditingId(item.id)
        setName(item.name)
        setDesc(item.description || '')
        setPrice(item.price.toString())
        setCategoryId(item.category_id)
        setImageUrl(item.image_url || '')
        setAvailable(item.available !== false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)

        const finalCategoryId = categoryId || categories[0]?.id

        if (!finalCategoryId) {
            showError('Error: No category selected.', 'Please create a category before adding menu items.')
            setLoading(false)
            return
        }

        const payload: any = {
            name,
            description: desc,
            price: parseFloat(price),
            categoryId: finalCategoryId,
            imageUrl: imageUrl,
            available: available
        }

        let error: string | null = null
        try {
            if (editingId) {
                payload.id = editingId
                const res = await fetch('/api/menu/items', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const json = await res.json()
                if (!json.success) error = json.error
            } else {
                const res = await fetch('/api/menu/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const json = await res.json()
                if (!json.success) error = json.error
            }
        } catch (e: any) {
            error = e.message
        }

        if (!error) {
            await fetchData()
            resetForm()
        } else {
            showError(`Error saving item: ${error}`, `"please try again."`)
        }
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this item?')) return
        try {
            await fetch(`/api/menu/items?id=${id}`, { method: 'DELETE' })
        } catch (e) { console.error('handleDelete error:', e) }
        fetchData()
    }

    async function handleToggleAvailable(id: string, available: boolean) {
        try {
            const res = await fetch('/api/menu/items', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, available })
            })
            const json = await res.json()
            if (!json.success) {
                showError('Error updating availability', json.error || 'Unknown error')
            } else {
                setItems(prev => prev.map(item => item.id === id ? { ...item, available } : item))
            }
        } catch (e: any) {
            showError('Error updating availability', e.message)
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
                {/* Header Section */}
                <AdminPageHeader title="Menu Management" subtitle="Configure and manage your restaurant menu items" icon={Utensils} backHref="/admin" />

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
                    gap: '2.5rem',
                    alignItems: 'start'
                }}>
                    {/* Editor Section */}
                    <div style={{
                        background: 'white',
                        padding: '2.5rem',
                        borderRadius: '24px',
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
                                {editingId ? <Edit2 size={24} color="white" /> : <Plus size={24} color="white" />}
                            </div>
                            <h3 style={{
                                margin: 0,
                                fontWeight: '600',
                                fontSize: '1.5rem',
                                color: 'var(--text)',
                            }}>
                                {editingId ? 'Edit Item' : 'New Menu Item'}
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                            <ItalianFormField
                                label="Item Name"
                                value={name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                                placeholder="e.g. Wagyu Truffle Burger"
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
                                <textarea
                                    value={desc}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
                                    placeholder="Describe the ingredients and preparation..."
                                    style={{
                                        width: '100%',
                                        padding: '16px 18px',
                                        borderRadius: '14px',
                                        border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                        minHeight: '120px',
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <ItalianFormField
                                    label="Price (₹)"
                                    type="number"
                                    step="0.01"
                                    value={price}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                                    placeholder="0.00"
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
                                        Category
                                    </label>
                                    <select
                                        value={categoryId}
                                        onChange={e => setCategoryId(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '16px 18px',
                                            borderRadius: '14px',
                                            border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'all 0.3s ease',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                        onFocus={(e: React.FocusEvent<HTMLSelectElement>) => {
                                            e.target.style.borderColor = 'var(--primary)'
                                            e.target.style.boxShadow = '0 0 0 4px rgba(var(--primary-rgb), 0.08)'
                                        }}
                                        onBlur={(e: React.FocusEvent<HTMLSelectElement>) => {
                                            e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                            e.target.style.boxShadow = 'none'
                                        }}
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <ImageSelector
                                label="Item Image"
                                value={imageUrl}
                                onChange={(val) => setImageUrl(val)}
                            />

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1.25rem',
                                background: 'rgba(var(--primary-rgb), 0.03)',
                                borderRadius: '14px',
                                border: '1px solid rgba(var(--primary-rgb), 0.1)'
                            }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Available for Order</span>
                                <div
                                    onClick={() => setAvailable(!available)}
                                    style={{
                                        width: '48px',
                                        height: '26px',
                                        borderRadius: '13px',
                                        background: available ? 'var(--primary)' : 'var(--text-muted)',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: '3px',
                                        left: available ? '25px' : '3px',
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        flex: 2,
                                        height: '58px',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '14px',
                                        fontSize: '1.05rem',
                                        fontWeight: '600',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.3)',
                                    }}
                                    onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                                        if (!loading) {
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
                                            <Save size={20} />
                                            {editingId ? 'Update Item' : 'Create Item'}
                                        </>
                                    )}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        style={{
                                            flex: 1,
                                            height: '58px',
                                            background: 'white',
                                            color: 'var(--text-muted)',
                                            border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                            borderRadius: '14px',
                                            fontSize: '1.05rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                                            e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'
                                            e.currentTarget.style.borderColor = 'var(--primary)'
                                        }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                                            e.currentTarget.style.background = 'white'
                                            e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* List Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Filters & Search */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            padding: '0 0.5rem'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={20}
                                    style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                                />
                                <input
                                    placeholder="Search menu items..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '16px 16px 16px 52px',
                                        borderRadius: '18px',
                                        border: '2px solid rgba(var(--primary-rgb), 0.1)',
                                        background: 'white',
                                        fontSize: '1rem',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                                        outline: 'none',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = 'var(--primary)'
                                        e.target.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.1)'
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.1)'
                                        e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '24px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        whiteSpace: 'nowrap',
                                        background: selectedCategory === 'all' ? 'var(--primary)' : 'white',
                                        color: selectedCategory === 'all' ? 'white' : 'var(--text-muted)',
                                        border: '1.5px solid',
                                        borderColor: selectedCategory === 'all' ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.15)',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    All Items
                                </button>
                                {categories.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedCategory(c.id)}
                                        style={{
                                            padding: '10px 22px',
                                            borderRadius: '24px',
                                            fontSize: '0.85rem',
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                            background: selectedCategory === c.id ? 'var(--primary)' : 'white',
                                            color: selectedCategory === c.id ? 'white' : 'var(--text-muted)',
                                            border: '1.5px solid',
                                            borderColor: selectedCategory === c.id ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.15)',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredItems.length === 0 ? (
                            <div style={{
                                padding: '5rem 2rem',
                                textAlign: 'center',
                                background: 'white',
                                borderRadius: '24px',
                                border: '2px dashed rgba(var(--primary-rgb), 0.2)'
                            }}>
                                <div style={{ color: 'var(--border)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                    <ImageIcon size={72} strokeWidth={1.5} />
                                </div>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '1.5rem', color: 'var(--text)', fontWeight: '600' }}>
                                    No items found
                                </h3>
                                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                                    Try adjusting your search or category filter
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))',
                                gap: '1.5rem'
                            }}>
                                {filteredItems.map(item => (
                                    <ItalianMenuItemCard
                                        key={item.id}
                                        item={item}
                                        isActive={item.id === editingId}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onToggleAvailable={handleToggleAvailable}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

function ItalianFormField({ label, icon, ...props }: { label: React.ReactNode; icon?: React.ReactNode;[x: string]: any; }) {
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
            <input
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

function ItalianMenuItemCard({ item, isActive, onEdit, onDelete, onToggleAvailable }: {
    item: MenuItem;
    isActive: boolean;
    onEdit: (item: MenuItem) => void;
    onDelete: (id: string) => void;
    onToggleAvailable: (id: string, available: boolean) => void;
}) {
    return (
        <div style={{
            background: 'white',
            borderRadius: '20px',
            overflow: 'hidden',
            border: isActive ? '2px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.15)',
            boxShadow: isActive ? '0 8px 24px rgba(var(--primary-rgb), 0.15)' : '0 4px 16px rgba(var(--primary-rgb), 0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.4s ease',
            opacity: item.available ? 1 : 0.8,
            cursor: 'default'
        }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(-6px)'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(var(--primary-rgb), 0.15)'
                }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.08)'
                }
            }}
        >
            <div style={{
                width: '100%',
                height: '180px',
                background: 'rgba(var(--primary-rgb), 0.05)',
                position: 'relative',
                borderBottom: '1px solid rgba(var(--primary-rgb), 0.1)'
            }}>
                {item.image_url ? (
                    <img
                        src={item.image_url}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <ImageIcon size={48} strokeWidth={1} />
                    </div>
                )}
                {!item.available && (
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'rgba(220, 38, 38, 0.9)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        textTransform: 'uppercase'
                    }}>
                        Hidden
                    </div>
                )}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(var(--primary-rgb), 0.9)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.7rem',
                    fontWeight: '800'
                }}>
                    {item.category?.name}
                </div>
            </div>

            <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h4 style={{
                        margin: '0 0 4px 0',
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text)',
                        lineHeight: 1.3
                    }}>
                        {item.name}
                    </h4>
                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)' }}>₹{item.price.toFixed(2)}</span>
                </div>

                <p style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 1.5rem 0',
                    lineHeight: 1.6,
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {item.description}
                </p>

                {/* Availability Toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(var(--primary-rgb), 0.1)',
                    marginBottom: '0.75rem'
                }}>
                    <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: item.available ? '#059669' : '#DC2626'
                    }}>
                        {item.available ? 'Available' : 'Unavailable'}
                    </span>
                    <div
                        onClick={() => onToggleAvailable(item.id, !item.available)}
                        style={{
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            background: item.available ? '#059669' : '#ccc',
                            transition: 'all 0.3s ease',
                            cursor: 'pointer',
                            position: 'relative',
                            flexShrink: 0
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '2px',
                            left: item.available ? '22px' : '2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'white',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                        }} />
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '10px',
                }}>
                    <button
                        onClick={() => onEdit(item)}
                        style={{
                            flex: 1,
                            height: '42px',
                            background: 'rgba(var(--primary-rgb), 0.08)',
                            color: 'var(--primary)',
                            border: '1px solid rgba(var(--primary-rgb), 0.2)',
                            borderRadius: '10px',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'var(--primary)'
                            e.currentTarget.style.color = 'white'
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.08)'
                            e.currentTarget.style.color = 'var(--primary)'
                        }}
                    >
                        <Edit2 size={16} />
                        EDIT
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        style={{
                            width: '42px',
                            height: '42px',
                            background: 'rgba(220, 38, 38, 0.08)',
                            color: '#DC2626',
                            border: '1px solid rgba(220, 38, 38, 0.2)',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = '#DC2626'
                            e.currentTarget.style.color = 'white'
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)'
                            e.currentTarget.style.color = '#DC2626'
                        }}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}

