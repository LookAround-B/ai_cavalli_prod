'use client'

import { useEffect, useState, useMemo } from 'react'
import NextImage from 'next/image'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Loading } from '@/components/ui/Loading'
import {
    Edit2,
    Plus,
    Search,
    Image as ImageIcon,
    Save,
    Trash2,
    Utensils,
    X,
    Eye,
    EyeOff,
    Package
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
    const [isFormOpen, setIsFormOpen] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        fetchData()
        return () => window.removeEventListener('resize', checkMobile)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Lock body scroll when mobile bottom-sheet is open
    useEffect(() => {
        if (isMobile && isFormOpen) {
            const original = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = original }
        }
    }, [isMobile, isFormOpen])

    async function fetchData() {
        setDataLoading(true)
        try {
            const res = await fetch('/api/v1/menu/items')
            const json = await res.json()
            if (json.success) {
                const cats = json.categories || json.data?.categories || []
                const menuItems = json.items || json.data?.items || []
                if (cats.length > 0) {
                    setCategories(cats)
                    if (!categoryId && cats.length > 0) {
                        setCategoryId(cats[0].id)
                    }
                }
                if (menuItems.length > 0) setItems(menuItems)
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

    const stats = useMemo(() => ({
        total: items.length,
        available: items.filter(i => i.available).length,
        hidden: items.filter(i => !i.available).length,
    }), [items])

    function resetForm() {
        setEditingId(null)
        setName('')
        setDesc('')
        setPrice('')
        setCategoryId(categories[0]?.id || '')
        setImageUrl('')
        setAvailable(true)
    }

    function openNewForm() {
        resetForm()
        setIsFormOpen(true)
    }

    function closeForm() {
        setIsFormOpen(false)
        resetForm()
    }

    function handleEdit(item: MenuItem) {
        setEditingId(item.id)
        setName(item.name)
        setDesc(item.description || '')
        setPrice(Number(item.price).toFixed(2))
        setCategoryId(item.category_id)
        setImageUrl(item.image_url || '')
        setAvailable(item.available !== false)
        if (isMobile) {
            setIsFormOpen(true)
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
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

        const parsedPrice = parseFloat(price)
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            showError('Invalid Price', 'Please enter a valid price (e.g. 1700.00)')
            setLoading(false)
            return
        }

        const payload: Record<string, unknown> = {
            name,
            description: desc,
            price: parsedPrice,
            category_id: finalCategoryId,
            image_url: imageUrl,
            available: available
        }

        let error: string | null = null
        try {
            if (editingId) {
                payload.id = editingId
                const res = await fetch('/api/v1/menu/items', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const json = await res.json()
                if (!json.success) error = json.error
            } else {
                const res = await fetch('/api/v1/menu/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const json = await res.json()
                if (!json.success) error = json.error
            }
        } catch (e: unknown) {
            error = (e as Error).message
        }

        if (!error) {
            await fetchData()
            resetForm()
            if (isMobile) setIsFormOpen(false)
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
            const res = await fetch('/api/v1/menu/items', {
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
        } catch (e: unknown) {
            showError('Error updating availability', (e as Error).message)
        }
    }

    const formNode = (
        <FormPanel
            editingId={editingId}
            name={name} setName={setName}
            desc={desc} setDesc={setDesc}
            price={price} setPrice={setPrice}
            categoryId={categoryId} setCategoryId={setCategoryId}
            categories={categories}
            imageUrl={imageUrl} setImageUrl={setImageUrl}
            available={available} setAvailable={setAvailable}
            loading={loading}
            onSubmit={handleSubmit}
            onCancel={isMobile ? closeForm : resetForm}
            isMobile={isMobile}
        />
    )

    return (
        <div style={{
            minHeight: '100vh',
            background: 'rgb(245,245,245)',
            padding: isMobile ? '0.875rem' : 'clamp(1rem, 3vw, 2.5rem)',
            paddingBottom: isMobile ? '6rem' : undefined,
            overflowX: 'hidden',
        }}>
            {/* Subtle background pattern */}
            <div style={{
                position: 'fixed', inset: 0,
                backgroundImage: 'radial-gradient(circle at 20px 20px, rgba(var(--primary-rgb), 0.03) 1px, transparent 0)',
                backgroundSize: '40px 40px',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                <AdminPageHeader title="Menu Management" subtitle="Configure and manage your restaurant menu items" icon={Utensils} backHref="/ops" />

                {/* Stats Banner */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: isMobile ? '0.5rem' : '1rem',
                    marginBottom: isMobile ? '1rem' : '1.5rem',
                }}>
                    <StatCard icon={Package} label="Total" value={stats.total} color="var(--primary)" isMobile={isMobile} />
                    <StatCard icon={Eye} label="Visible" value={stats.available} color="#059669" isMobile={isMobile} />
                    <StatCard icon={EyeOff} label="Hidden" value={stats.hidden} color="#DC2626" isMobile={isMobile} />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(380px, 440px) 1fr',
                    gap: isMobile ? 0 : 'clamp(1.25rem, 3vw, 2rem)',
                    alignItems: 'start'
                }}>
                    {/* Form panel — inline on desktop */}
                    {!isMobile && (
                        <div style={{ position: 'sticky', top: '1.5rem' }}>
                            {formNode}
                        </div>
                    )}

                    {/* Items section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.875rem' : '1.5rem', minWidth: 0 }}>
                        {/* Sticky search + filters */}
                        <div style={{
                            position: isMobile ? 'sticky' : 'static',
                            top: isMobile ? '0.5rem' : undefined,
                            zIndex: 5,
                            background: isMobile ? 'rgb(245,245,245)' : 'transparent',
                            paddingTop: isMobile ? '0.5rem' : 0,
                            paddingBottom: isMobile ? '0.5rem' : 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                        }}>
                            {/* Search */}
                            <div style={{ position: 'relative' }}>
                                <Search
                                    size={18}
                                    style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }}
                                />
                                <Input
                                    placeholder="Search menu items..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value.replace(/<[^>]*>/g, '').slice(0, 200))}
                                    maxLength={200}
                                    style={{
                                        paddingLeft: '46px',
                                        height: isMobile ? '46px' : '52px',
                                        borderRadius: '14px',
                                        background: 'white',
                                        border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    }}
                                />
                            </div>

                            {/* Category chips */}
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                overflowX: isMobile ? 'auto' : 'visible',
                                flexWrap: isMobile ? 'nowrap' : 'wrap',
                                paddingBottom: isMobile ? '4px' : 0,
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                            }}>
                                <CategoryChip label="All" count={items.length} active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
                                {categories.map(c => {
                                    const count = items.filter(i => i.category_id === c.id).length
                                    return (
                                        <CategoryChip
                                            key={c.id}
                                            label={c.name}
                                            count={count}
                                            active={selectedCategory === c.id}
                                            onClick={() => setSelectedCategory(c.id)}
                                        />
                                    )
                                })}
                            </div>
                        </div>

                        {/* Items list */}
                        {dataLoading ? (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'white', borderRadius: '20px', border: '2px dashed rgba(var(--primary-rgb), 0.2)' }}>
                                <Loading />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <EmptyState
                                hasFilters={searchQuery !== '' || selectedCategory !== 'all'}
                                onAddItem={openNewForm}
                                onClearFilters={() => { setSearchQuery(''); setSelectedCategory('all') }}
                            />
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
                                gap: isMobile ? '0.75rem' : '1.25rem'
                            }}>
                                {filteredItems.map(item => (
                                    <MenuItemCard
                                        key={item.id}
                                        item={item}
                                        isActive={item.id === editingId && !isMobile}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        onToggleAvailable={handleToggleAvailable}
                                        isMobile={isMobile}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile FAB */}
            {isMobile && (
                <button
                    onClick={openNewForm}
                    aria-label="Add new menu item"
                    style={{
                        position: 'fixed',
                        bottom: '1.25rem',
                        right: '1.25rem',
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 8px 24px rgba(var(--primary-rgb), 0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 30,
                    }}
                >
                    <Plus size={26} strokeWidth={2.5} />
                </button>
            )}

            {/* Mobile bottom sheet form */}
            {isMobile && isFormOpen && (
                <>
                    <div
                        onClick={closeForm}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 40,
                            animation: 'fadeIn 0.2s ease',
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        bottom: 0, left: 0, right: 0,
                        background: 'white',
                        borderTopLeftRadius: '20px',
                        borderTopRightRadius: '20px',
                        zIndex: 41,
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        animation: 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
                    }}>
                        {/* Drag handle */}
                        <div style={{ padding: '0.75rem 0 0.5rem', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(0,0,0,0.15)' }} />
                        </div>

                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 1.25rem 1rem',
                            borderBottom: '1px solid rgba(var(--primary-rgb), 0.08)',
                            flexShrink: 0,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {editingId ? <Edit2 size={18} color="white" /> : <Plus size={18} color="white" />}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>
                                    {editingId ? 'Edit Item' : 'New Menu Item'}
                                </h3>
                            </div>
                            <button
                                onClick={closeForm}
                                style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'rgba(0,0,0,0.05)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                }}
                                aria-label="Close form"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form body — scrollable */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                            {formNode}
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                /* Hide scrollbar on category chip row */
                div::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    )
}

/* ============================================================
   Sub-components
   ============================================================ */

function StatCard({ icon: Icon, label, value, color, isMobile }: {
    icon: React.ElementType; label: string; value: number; color: string; isMobile: boolean;
}) {
    return (
        <div style={{
            background: 'white',
            border: '1px solid rgba(var(--primary-rgb), 0.1)',
            borderRadius: isMobile ? '12px' : '16px',
            padding: isMobile ? '0.75rem' : '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '0.5rem' : '0.875rem',
            minWidth: 0,
        }}>
            <div style={{
                width: isMobile ? '32px' : '40px',
                height: isMobile ? '32px' : '40px',
                borderRadius: isMobile ? '8px' : '10px',
                background: `${color}15`,
                color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Icon size={isMobile ? 16 : 20} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                    {value}
                </div>
                <div style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                    {label}
                </div>
            </div>
        </div>
    )
}

function CategoryChip({ label, count, active, onClick }: {
    label: string; count: number; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: active ? 'var(--primary)' : 'white',
                color: active ? 'white' : 'var(--text-muted)',
                border: '1.5px solid',
                borderColor: active ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
            }}
        >
            {label}
            <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '10px',
                background: active ? 'rgba(255,255,255,0.25)' : 'rgba(var(--primary-rgb), 0.1)',
                color: active ? 'white' : 'var(--primary)',
            }}>
                {count}
            </span>
        </button>
    )
}

function EmptyState({ hasFilters, onAddItem, onClearFilters }: {
    hasFilters: boolean; onAddItem: () => void; onClearFilters: () => void;
}) {
    return (
        <div style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'white',
            borderRadius: '20px',
            border: '2px dashed rgba(var(--primary-rgb), 0.2)'
        }}>
            <div style={{ color: 'var(--border)', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                <ImageIcon size={56} strokeWidth={1.5} />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: 'var(--text)', fontWeight: 700 }}>
                {hasFilters ? 'No items match your filters' : 'No menu items yet'}
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 1.25rem 0', fontSize: '0.875rem' }}>
                {hasFilters ? 'Try a different search or category' : 'Get started by adding your first menu item'}
            </p>
            <button
                onClick={hasFilters ? onClearFilters : onAddItem}
                style={{
                    height: '40px',
                    padding: '0 1.25rem',
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                {hasFilters ? <>Clear Filters</> : <><Plus size={16} /> Add First Item</>}
            </button>
        </div>
    )
}

function FormPanel({
    editingId, name, setName, desc, setDesc, price, setPrice,
    categoryId, setCategoryId, categories, imageUrl, setImageUrl,
    available, setAvailable, loading, onSubmit, onCancel, isMobile,
}: {
    editingId: string | null;
    name: string; setName: (v: string) => void;
    desc: string; setDesc: (v: string) => void;
    price: string; setPrice: (v: string) => void;
    categoryId: string; setCategoryId: (v: string) => void;
    categories: Category[];
    imageUrl: string; setImageUrl: (v: string) => void;
    available: boolean; setAvailable: (v: boolean) => void;
    loading: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    isMobile: boolean;
}) {
    return (
        <div style={{
            background: 'white',
            padding: isMobile ? 0 : '1.75rem',
            borderRadius: isMobile ? 0 : '20px',
            border: isMobile ? 'none' : '1px solid rgba(var(--primary-rgb), 0.12)',
            boxShadow: isMobile ? 'none' : '0 4px 16px rgba(var(--primary-rgb), 0.06)',
        }}>
            {!isMobile && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    marginBottom: '1.5rem',
                    paddingBottom: '1.25rem',
                    borderBottom: '1px solid rgba(var(--primary-rgb), 0.1)',
                }}>
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.25)',
                    }}>
                        {editingId ? <Edit2 size={20} color="white" /> : <Plus size={20} color="white" />}
                    </div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)' }}>
                        {editingId ? 'Edit Item' : 'New Menu Item'}
                    </h3>
                </div>
            )}

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <FormField label="Item Name">
                    <Input
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        placeholder="e.g. Wagyu Truffle Burger"
                        required
                    />
                </FormField>

                <FormField label="Description">
                    <Textarea
                        value={desc}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
                        placeholder="Ingredients and preparation..."
                        style={{ minHeight: '90px', resize: 'vertical' }}
                    />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1rem', width: '100%' }}>
                    <FormField label="Price (₹)">
                        <Input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            value={price}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const val = e.target.value
                                if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setPrice(val)
                            }}
                            placeholder="0.00"
                            required
                        />
                    </FormField>
                    <FormField label="Category">
                        <Select
                            value={categoryId}
                            onChange={e => setCategoryId(e.target.value)}
                            style={{ width: '100%', minWidth: 0 }}
                        >
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </Select>
                    </FormField>
                </div>

                <ImageSelector
                    label="Item Image"
                    value={imageUrl}
                    onChange={(val) => setImageUrl(val)}
                />

                {/* Availability toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    background: available ? 'rgba(5, 150, 105, 0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: available ? 'rgba(5, 150, 105, 0.2)' : 'rgba(0,0,0,0.08)',
                    transition: 'all 0.25s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        {available ? <Eye size={18} color="#059669" /> : <EyeOff size={18} color="var(--text-muted)" />}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>
                                {available ? 'Available for order' : 'Hidden from menu'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {available ? 'Customers can order this item' : 'Not visible to customers'}
                            </div>
                        </div>
                    </div>
                    <div
                        onClick={() => setAvailable(!available)}
                        style={{
                            width: '44px', height: '24px', borderRadius: '12px',
                            background: available ? '#059669' : '#aaa',
                            transition: 'background 0.25s', cursor: 'pointer', position: 'relative',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '2px',
                            left: available ? '22px' : '2px',
                            width: '20px', height: '20px', borderRadius: '50%',
                            background: 'white',
                            transition: 'left 0.25s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }} />
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            flex: editingId ? 2 : 1,
                            height: '50px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.25)',
                            transition: 'all 0.25s ease',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? (
                            <div style={{ width: '18px', height: '18px', border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                            <>
                                <Save size={17} />
                                {editingId ? 'Update Item' : 'Create Item'}
                            </>
                        )}
                    </button>
                    {editingId && (
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                flex: 1,
                                height: '50px',
                                background: 'white',
                                color: 'var(--text-muted)',
                                border: '1.5px solid rgba(var(--primary-rgb), 0.15)',
                                borderRadius: '12px',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
            }}>
                {label}
            </label>
            {children}
        </div>
    )
}

function MenuItemCard({ item, isActive, onEdit, onDelete, onToggleAvailable, isMobile }: {
    item: MenuItem;
    isActive: boolean;
    onEdit: (item: MenuItem) => void;
    onDelete: (id: string) => void;
    onToggleAvailable: (id: string, available: boolean) => void;
    isMobile: boolean;
}) {
    if (isMobile) {
        // Compact mobile list card: image+info row + controls row
        return (
            <div style={{
                background: 'white',
                borderRadius: '14px',
                overflow: 'hidden',
                border: isActive ? '2px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.12)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                width: '100%',
                opacity: item.available ? 1 : 0.85,
            }}>
                {/* Top row: image + info */}
                <div style={{ display: 'flex' }}>
                    <div style={{
                        width: '92px', height: '92px', flexShrink: 0,
                        background: 'rgba(var(--primary-rgb), 0.05)',
                        borderRight: '1px solid rgba(var(--primary-rgb), 0.06)',
                        overflow: 'hidden',
                    }}>
                        {item.image_url ? (
                            <NextImage
                                src={item.image_url} alt={item.name}
                                width={92} height={92}
                                style={{ objectFit: 'contain', display: 'block' }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <ImageIcon size={26} strokeWidth={1.2} />
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>
                            {item.category?.name}
                        </span>
                        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                                ₹{Number(item.price).toFixed(2)}
                            </span>
                            {!item.available && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', background: 'rgba(220,38,38,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                    Hidden
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom row: toggle + actions */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px',
                    borderTop: '1px solid rgba(var(--primary-rgb), 0.06)',
                    background: 'rgba(var(--primary-rgb), 0.015)',
                }}>
                    <div
                        onClick={() => onToggleAvailable(item.id, !item.available)}
                        style={{ width: '36px', height: '20px', borderRadius: '10px', background: item.available ? '#059669' : '#ccc', transition: 'background 0.25s', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
                    >
                        <div style={{ position: 'absolute', top: '2px', left: item.available ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.available ? '#059669' : '#DC2626', flex: 1, minWidth: 0 }}>
                        {item.available ? 'Available' : 'Hidden'}
                    </span>
                    <button
                        onClick={() => onEdit(item)}
                        style={{ height: '32px', padding: '0 14px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}
                    >
                        <Edit2 size={13} /> Edit
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        style={{ width: '32px', height: '32px', background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        aria-label="Delete item"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        )
    }

    // Desktop card (vertical, image-first)
    return (
        <div style={{
            background: 'white',
            borderRadius: '18px',
            overflow: 'hidden',
            border: isActive ? '2px solid var(--primary)' : '1px solid rgba(var(--primary-rgb), 0.12)',
            boxShadow: isActive ? '0 8px 24px rgba(var(--primary-rgb), 0.15)' : '0 4px 12px rgba(0,0,0,0.04)',
            display: 'flex', flexDirection: 'column',
            transition: 'all 0.3s ease',
            opacity: item.available ? 1 : 0.85,
        }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!isActive) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.08)' }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!isActive) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)' }
            }}
        >
            <div style={{ width: '100%', height: '170px', background: 'rgba(var(--primary-rgb), 0.05)', position: 'relative' }}>
                {item.image_url ? (
                    <NextImage src={item.image_url} alt={item.name} fill style={{ objectFit: 'contain' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <ImageIcon size={44} strokeWidth={1} />
                    </div>
                )}
                {!item.available && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(220,38,38,0.95)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Hidden
                    </div>
                )}
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(var(--primary-rgb), 0.95)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 800 }}>
                    {item.category?.name}
                </div>
            </div>

            <div style={{ padding: '1.1rem 1.25rem 1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                    </h4>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                        ₹{Number(item.price).toFixed(2)}
                    </span>
                </div>
                {item.description && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', lineHeight: 1.5, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.description}
                    </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '0.75rem', borderTop: '1px solid rgba(var(--primary-rgb), 0.08)' }}>
                    <div onClick={() => onToggleAvailable(item.id, !item.available)} style={{ width: '38px', height: '22px', borderRadius: '11px', background: item.available ? '#059669' : '#ccc', transition: 'background 0.25s', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: '2px', left: item.available ? '18px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.available ? '#059669' : '#DC2626', flex: 1 }}>
                        {item.available ? 'Available' : 'Hidden'}
                    </span>
                    <button
                        onClick={() => onEdit(item)}
                        style={{ height: '34px', padding: '0 12px', background: 'rgba(var(--primary-rgb), 0.08)', color: 'var(--primary)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s ease' }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white' }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.08)'; e.currentTarget.style.color = 'var(--primary)' }}
                    >
                        <Edit2 size={13} /> Edit
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        style={{ width: '34px', height: '34px', background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = 'white' }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)'; e.currentTarget.style.color = '#DC2626' }}
                        aria-label="Delete item"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
