'use client'

import { useState, useMemo, useEffect } from 'react'
import { AdminPageHeader } from '@/components/layout/AdminPageHeader'
import { showError, showSuccess, showConfirm } from '@/components/ui/Popup'
import { TrendingUp, DollarSign, AlertCircle, Check, Search, ChevronLeft, ChevronRight, List, Tag, Package } from 'lucide-react'

type TargetType = 'all' | 'category' | 'products'

interface Category {
    id: string
    name: string
}

interface MenuItem {
    id: string
    name: string
    price: number
    category_id: string | null
}

interface PreviewItem {
    id: string
    name: string
    category: string
    oldPrice: number
    newPrice: number
    increase: number
}

interface PreviewResponse {
    success: boolean
    preview?: PreviewItem[]
    summary?: { totalItems: number; avgIncrease: number }
    error?: string
}

const MODE_OPTIONS: { value: TargetType; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'all', label: 'Entire Menu', icon: <List size={18} />, desc: 'Apply to all menu items' },
    { value: 'category', label: 'By Category', icon: <Tag size={18} />, desc: 'Apply to one category' },
    { value: 'products', label: 'Select Products', icon: <Package size={18} />, desc: 'Pick specific items' },
]

export default function PriceIncreasePage() {
    const [targetType, setTargetType] = useState<TargetType>('all')
    const [percentage, setPercentage] = useState('')
    const [reason, setReason] = useState('')

    // Category mode
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState('')

    // Products mode
    const [allItems, setAllItems] = useState<MenuItem[]>([])
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
    const [itemSearch, setItemSearch] = useState('')

    // Preview state
    const [preview, setPreview] = useState<PreviewItem[]>([])
    const [summary, setSummary] = useState<{ totalItems: number; avgIncrease: number } | null>(null)
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [filterText, setFilterText] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    useEffect(() => {
        fetch('/api/menu')
            .then(r => r.json())
            .then(json => {
                if (json.success) {
                    setCategories(json.data.categories || [])
                    setAllItems(json.data.menuItems || [])
                }
            })
            .catch(() => {})
    }, [])

    const filteredMenuItems = useMemo(() => {
        if (!itemSearch) return allItems
        return allItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    }, [allItems, itemSearch])

    const filteredAndPaginatedItems = useMemo(() => {
        const filtered = preview.filter(item =>
            item.name.toLowerCase().includes(filterText.toLowerCase())
        )
        const startIndex = (currentPage - 1) * itemsPerPage
        const paginated = filtered.slice(startIndex, startIndex + itemsPerPage)
        return { items: paginated, totalFiltered: filtered.length, totalPages: Math.ceil(filtered.length / itemsPerPage) }
    }, [preview, filterText, currentPage, itemsPerPage])

    function buildRequestBody(action: 'preview' | 'apply') {
        const base = {
            action,
            percentage: parseFloat(percentage),
            targetType,
            reason: reason || undefined,
        }
        if (targetType === 'category') return { ...base, categoryId: selectedCategoryId }
        if (targetType === 'products') return { ...base, itemIds: Array.from(selectedItemIds) }
        return base
    }

    function validate(): string | null {
        const p = parseFloat(percentage)
        if (isNaN(p) || p < 0.01 || p > 100) return 'Please enter a percentage between 0.01 and 100'
        if (targetType === 'category' && !selectedCategoryId) return 'Please select a category'
        if (targetType === 'products' && selectedItemIds.size === 0) return 'Please select at least one product'
        return null
    }

    async function handlePreview() {
        const err = validate()
        if (err) { showError('Validation Error', err); return }
        setLoading(true)
        try {
            const res = await fetch('/api/ops/menu/bulk-price-increase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildRequestBody('preview')),
            })
            const json: PreviewResponse = await res.json()
            if (json.success && json.preview && json.summary) {
                setPreview(json.preview)
                setSummary(json.summary)
                setShowPreview(true)
                setCurrentPage(1)
                setFilterText('')
            } else {
                showError('Preview Failed', json.error || 'Failed to generate preview')
            }
        } catch (e: any) {
            showError('Preview Failed', e.message || 'An error occurred')
        }
        setLoading(false)
    }

    async function handleApply() {
        const p = parseFloat(percentage)
        const confirmed = await showConfirm(
            'Confirm Price Increase',
            `Increase prices for ${summary?.totalItems || 0} items by ${p}%? This cannot be undone.`,
            'Apply Changes',
            'Cancel'
        )
        if (!confirmed) return
        setLoading(true)
        try {
            const res = await fetch('/api/ops/menu/bulk-price-increase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildRequestBody('apply')),
            })
            const json = await res.json()
            if (json.success) {
                showSuccess('Success', json.message || `Updated ${json.updatedCount} items`)
                resetForm()
            } else {
                showError('Update Failed', json.error || 'Failed to update prices')
            }
        } catch (e: any) {
            showError('Update Failed', e.message || 'An error occurred')
        }
        setLoading(false)
    }

    function resetForm() {
        setPercentage('')
        setReason('')
        setPreview([])
        setSummary(null)
        setShowPreview(false)
        setCurrentPage(1)
        setFilterText('')
        setSelectedItemIds(new Set())
        setSelectedCategoryId('')
    }

    function toggleItem(id: string) {
        setSelectedItemIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function toggleAll() {
        const visible = filteredMenuItems.map(i => i.id)
        const allSelected = visible.every(id => selectedItemIds.has(id))
        setSelectedItemIds(prev => {
            const next = new Set(prev)
            visible.forEach(id => allSelected ? next.delete(id) : next.add(id))
            return next
        })
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '48px',
        padding: '0 16px',
        fontSize: '0.95rem',
        border: '2px solid rgba(var(--primary-rgb), 0.2)',
        borderRadius: '12px',
        outline: 'none',
    }

    return (
        <div style={{ minHeight: '100vh', background: 'rgb(245,245,245)', padding: 'clamp(1rem, 3vw, 2.5rem)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <AdminPageHeader
                    title="Price Increase"
                    subtitle="Adjust menu prices by percentage"
                    icon={TrendingUp}
                    backHref="/ops/menu"
                />

                {/* Mode Selector */}
                <div style={{ background: 'white', padding: 'clamp(1.25rem, 4vw, 2rem)', borderRadius: '20px', border: '1px solid rgba(var(--primary-rgb), 0.12)', boxShadow: '0 4px 20px rgba(var(--primary-rgb), 0.06)', marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Apply Price Increase To</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {MODE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setTargetType(opt.value); setShowPreview(false); setPreview([]) }}
                                style={{
                                    padding: '16px 12px',
                                    borderRadius: '14px',
                                    border: `2px solid ${targetType === opt.value ? 'var(--primary)' : 'rgba(var(--primary-rgb), 0.15)'}`,
                                    background: targetType === opt.value ? 'rgba(var(--primary-rgb), 0.06)' : 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <span style={{ color: targetType === opt.value ? 'var(--primary)' : 'var(--text-muted)' }}>{opt.icon}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: targetType === opt.value ? 'var(--primary)' : 'var(--text)' }}>{opt.label}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Config Card */}
                <div style={{ background: 'white', padding: 'clamp(1.25rem, 4vw, 2.5rem)', borderRadius: '20px', border: '1px solid rgba(var(--primary-rgb), 0.12)', boxShadow: '0 4px 20px rgba(var(--primary-rgb), 0.06)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.75rem', paddingBottom: '1.5rem', borderBottom: '2px solid rgba(var(--primary-rgb), 0.08)' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={22} color="white" />
                        </div>
                        <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem', color: 'var(--text)' }}>Adjustment Settings</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        {/* Percentage */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Increase Percentage
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={percentage}
                                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setPercentage(v) }}
                                    placeholder="5.00"
                                    disabled={loading}
                                    style={{ ...inputStyle, paddingRight: '48px', height: '52px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)')}
                                />
                                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted)' }}>%</span>
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Reason (Optional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value.slice(0, 500))}
                                placeholder="e.g., Monthly adjustment"
                                disabled={loading}
                                style={{ ...inputStyle, height: '52px' }}
                                onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)')}
                            />
                        </div>

                        {/* Category selector */}
                        {targetType === 'category' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Select Category *
                                </label>
                                <select
                                    value={selectedCategoryId}
                                    onChange={e => setSelectedCategoryId(e.target.value)}
                                    style={{ ...inputStyle, height: '52px', cursor: 'pointer', background: 'white' }}
                                >
                                    <option value="">— Choose a category —</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Products multi-select */}
                    {targetType === 'products' && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Select Products *
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {selectedItemIds.size > 0 && (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', padding: '3px 10px', background: 'rgba(var(--primary-rgb), 0.08)', borderRadius: '20px' }}>
                                            {selectedItemIds.size} selected
                                        </span>
                                    )}
                                    <button
                                        onClick={toggleAll}
                                        style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px' }}
                                    >
                                        {filteredMenuItems.every(i => selectedItemIds.has(i.id)) ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                            </div>
                            <div style={{ position: 'relative', marginBottom: '10px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    placeholder="Search items..."
                                    style={{ ...inputStyle, paddingLeft: '42px', height: '44px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)')}
                                />
                            </div>
                            <div style={{ border: '2px solid rgba(var(--primary-rgb), 0.12)', borderRadius: '12px', maxHeight: '320px', overflowY: 'auto' }}>
                                {filteredMenuItems.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No items found</div>
                                ) : filteredMenuItems.map((item, idx) => (
                                    <label
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            borderBottom: idx < filteredMenuItems.length - 1 ? '1px solid rgba(var(--primary-rgb), 0.07)' : 'none',
                                            background: selectedItemIds.has(item.id) ? 'rgba(var(--primary-rgb), 0.04)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedItemIds.has(item.id)}
                                            onChange={() => toggleItem(item.id)}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', flexShrink: 0 }}
                                        />
                                        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>{item.name}</span>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>₹{item.price.toFixed(2)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handlePreview}
                        disabled={loading || !percentage}
                        style={{
                            width: '100%',
                            height: '52px',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '14px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            cursor: loading || !percentage ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            opacity: loading || !percentage ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading ? (
                            <div style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                            <><TrendingUp size={18} /> Preview Changes</>
                        )}
                    </button>
                </div>

                {/* Preview Section */}
                {showPreview && preview.length > 0 && summary && (
                    <div style={{ background: 'white', padding: 'clamp(1.25rem, 4vw, 2.5rem)', borderRadius: '20px', border: '1px solid rgba(var(--primary-rgb), 0.12)', boxShadow: '0 4px 20px rgba(var(--primary-rgb), 0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '2px solid rgba(var(--primary-rgb), 0.08)', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text)' }}>
                                    {summary.totalItems} items will be updated
                                </h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    Avg increase: ₹{summary.avgIncrease.toFixed(2)} per item
                                </p>
                            </div>
                            <span style={{ padding: '8px 18px', background: 'rgba(var(--primary-rgb), 0.08)', borderRadius: '10px', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={16} />+{percentage}%
                            </span>
                        </div>

                        {/* Filter row */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '440px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    value={filterText}
                                    onChange={e => { setFilterText(e.target.value); setCurrentPage(1) }}
                                    placeholder="Filter by name..."
                                    style={{ ...inputStyle, paddingLeft: '42px', height: '44px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)')}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Per page:</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                                    style={{ height: '44px', padding: '0 16px', fontSize: '0.9rem', fontWeight: 600, border: '2px solid rgba(var(--primary-rgb), 0.15)', borderRadius: '10px', outline: 'none', cursor: 'pointer', background: 'white' }}
                                >
                                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(var(--primary-rgb), 0.04)' }}>
                                        {['Item Name', 'Category', 'Current Price', 'New Price', 'Increase'].map(h => (
                                            <th key={h} style={{ padding: '13px 14px', textAlign: h === 'Item Name' || h === 'Category' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndPaginatedItems.items.length > 0 ? (
                                        filteredAndPaginatedItems.items.map((item, idx) => (
                                            <tr key={item.id} style={{ borderBottom: idx < filteredAndPaginatedItems.items.length - 1 ? '1px solid rgba(var(--primary-rgb), 0.07)' : 'none' }}>
                                                <td style={{ padding: '14px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)' }}>{item.name}</td>
                                                <td style={{ padding: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.category || '—'}</td>
                                                <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-muted)' }}>₹{item.oldPrice.toFixed(2)}</td>
                                                <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>₹{item.newPrice.toFixed(2)}</td>
                                                <td style={{ padding: '14px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 600, color: '#059669' }}>+₹{item.increase.toFixed(2)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={5} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>No items match your filter</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filteredAndPaginatedItems.totalPages > 1 && (
                            <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', padding: '12px 14px', background: 'rgba(var(--primary-rgb), 0.02)', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Page {currentPage} of {filteredAndPaginatedItems.totalPages} · {filteredAndPaginatedItems.totalFiltered} items
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[
                                        { label: <><ChevronLeft size={14} /> Prev</>, onClick: () => setCurrentPage(p => Math.max(1, p - 1)), disabled: currentPage === 1 },
                                        { label: <>Next <ChevronRight size={14} /></>, onClick: () => setCurrentPage(p => Math.min(filteredAndPaginatedItems.totalPages, p + 1)), disabled: currentPage === filteredAndPaginatedItems.totalPages },
                                    ].map((btn, i) => (
                                        <button key={i} onClick={btn.onClick} disabled={btn.disabled}
                                            style={{ height: '38px', padding: '0 14px', background: btn.disabled ? 'rgba(var(--primary-rgb), 0.04)' : 'white', color: btn.disabled ? 'var(--text-muted)' : 'var(--primary)', border: '2px solid rgba(var(--primary-rgb), 0.15)', borderRadius: '9px', fontSize: '0.85rem', fontWeight: 600, cursor: btn.disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {btn.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={resetForm}
                                disabled={loading}
                                style={{ flex: 1, height: '52px', background: 'white', color: 'var(--text-muted)', border: '2px solid rgba(var(--primary-rgb), 0.15)', borderRadius: '14px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={loading}
                                style={{ flex: 2, height: '52px', background: '#059669', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                            >
                                {loading ? (
                                    <div style={{ width: '20px', height: '20px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                ) : (
                                    <><Check size={18} /> Apply Changes</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
