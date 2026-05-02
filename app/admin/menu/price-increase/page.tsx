'use client'

import { useState, useMemo } from 'react'
import { AdminPageHeader } from '@/components/layout/AdminPageHeader'
import { showError, showSuccess, showConfirm } from '@/components/ui/Popup'
import { TrendingUp, DollarSign, AlertCircle, Check, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface PreviewItem {
    id: string
    name: string
    oldPrice: number
    newPrice: number
    increase: number
}

interface PreviewResponse {
    success: boolean
    preview?: PreviewItem[]
    summary?: {
        totalItems: number
        avgIncrease: number
    }
    error?: string
}

export default function PriceIncreasePage() {
    const [percentage, setPercentage] = useState('')
    const [reason, setReason] = useState('')
    const [preview, setPreview] = useState<PreviewItem[]>([])
    const [summary, setSummary] = useState<{ totalItems: number; avgIncrease: number } | null>(null)
    const [loading, setLoading] = useState(false)
    const [showPreview, setShowPreview] = useState(false)

    // Pagination and filtering state
    const [filterText, setFilterText] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // Filter and paginate preview items
    const filteredAndPaginatedItems = useMemo(() => {
        // Filter items by name
        const filtered = preview.filter(item =>
            item.name.toLowerCase().includes(filterText.toLowerCase())
        )

        // Calculate pagination
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        const paginated = filtered.slice(startIndex, endIndex)

        return {
            items: paginated,
            totalFiltered: filtered.length,
            totalPages: Math.ceil(filtered.length / itemsPerPage)
        }
    }, [preview, filterText, currentPage, itemsPerPage])

    async function handlePreview() {
        const parsedPercentage = parseFloat(percentage)
        if (isNaN(parsedPercentage) || parsedPercentage < 0.01 || parsedPercentage > 100) {
            showError('Invalid Percentage', 'Please enter a percentage between 0.01 and 100')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/admin/menu/bulk-price-increase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'preview',
                    percentage: parsedPercentage
                })
            })
            const json: PreviewResponse = await res.json()

            if (json.success && json.preview && json.summary) {
                setPreview(json.preview)
                setSummary(json.summary)
                setShowPreview(true)
                // Reset pagination and filter
                setCurrentPage(1)
                setFilterText('')
            } else {
                showError('Preview Failed', json.error || 'Failed to generate preview')
            }
        } catch (e: unknown) {
            showError('Preview Failed', (e as Error).message || 'An error occurred')
        }
        setLoading(false)
    }

    async function handleApply() {
        const parsedPercentage = parseFloat(percentage)

        const confirmed = await showConfirm(
            'Confirm Price Increase',
            `Are you sure you want to increase prices for all ${summary?.totalItems || 0} items by ${parsedPercentage}%? This action will update all menu item prices.`,
            'Apply Changes',
            'Cancel'
        )

        if (!confirmed) return

        setLoading(true)
        try {
            const res = await fetch('/api/admin/menu/bulk-price-increase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'apply',
                    percentage: parsedPercentage,
                    reason: reason || undefined
                })
            })
            const json = await res.json()

            if (json.success) {
                showSuccess('Success', json.message || `Successfully updated ${json.updatedCount} items`)
                // Reset form
                setPercentage('')
                setReason('')
                setPreview([])
                setSummary(null)
                setShowPreview(false)
                setCurrentPage(1)
                setFilterText('')
            } else {
                showError('Update Failed', json.error || 'Failed to update prices')
            }
        } catch (e: any) {
            showError('Update Failed', e.message || 'An error occurred')
        }
        setLoading(false)
    }

    function handleCancel() {
        setShowPreview(false)
        setPreview([])
        setSummary(null)
        setCurrentPage(1)
        setFilterText('')
    }

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

            <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                <AdminPageHeader
                    title="Bulk Price Increase"
                    subtitle="Adjust prices for all menu items by percentage"
                    icon={TrendingUp}
                    backHref="/admin/menu"
                />

                {/* Input Form */}
                <div style={{
                    background: 'white',
                    padding: 'clamp(1.5rem, 5vw, 3rem)',
                    borderRadius: 'clamp(16px, 3vw, 24px)',
                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                    boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.08)',
                    marginBottom: '2rem'
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
                            <DollarSign size={24} color="white" />
                        </div>
                        <h3 style={{
                            margin: 0,
                            fontWeight: '600',
                            fontSize: '1.5rem',
                            color: 'var(--text)',
                        }}>
                            Price Adjustment Settings
                        </h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
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
                                Price Increase Percentage
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={percentage}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                            setPercentage(val)
                                        }
                                    }}
                                    placeholder="5.00"
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        height: '56px',
                                        padding: '0 50px 0 20px',
                                        fontSize: '1.1rem',
                                        fontWeight: '600',
                                        border: '2px solid rgba(var(--primary-rgb), 0.2)',
                                        borderRadius: '14px',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)'}
                                />
                                <span style={{
                                    position: 'absolute',
                                    right: '20px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '1.1rem',
                                    fontWeight: '700',
                                    color: 'var(--text-muted)'
                                }}>
                                    %
                                </span>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                                Enter a value between 0.01 and 100
                            </p>
                        </div>

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
                                Reason (Optional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                                placeholder="e.g., Monthly price adjustment"
                                disabled={loading}
                                maxLength={500}
                                style={{
                                    width: '100%',
                                    height: '56px',
                                    padding: '0 20px',
                                    fontSize: '1rem',
                                    border: '2px solid rgba(var(--primary-rgb), 0.2)',
                                    borderRadius: '14px',
                                    outline: 'none',
                                    transition: 'all 0.3s ease',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.2)'}
                            />
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                                Optional note for audit trail
                            </p>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={handlePreview}
                            disabled={loading || !percentage}
                            style={{
                                flex: 1,
                                height: '58px',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '14px',
                                fontSize: '1.05rem',
                                fontWeight: '600',
                                cursor: loading || !percentage ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.3)',
                                opacity: loading || !percentage ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                                if (!loading && percentage) {
                                    e.currentTarget.style.transform = 'translateY(-2px)'
                                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--primary-rgb), 0.4)'
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.3)'
                            }}
                        >
                            {loading ? (
                                <div style={{ width: '22px', height: '22px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            ) : (
                                <>
                                    <TrendingUp size={20} />
                                    Preview Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Preview Section */}
                {showPreview && preview.length > 0 && summary && (
                    <div style={{
                        background: 'white',
                        padding: 'clamp(1.5rem, 5vw, 3rem)',
                        borderRadius: 'clamp(16px, 3vw, 24px)',
                        border: '1px solid rgba(var(--primary-rgb), 0.15)',
                        boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.08)',
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '2rem',
                            paddingBottom: '1.5rem',
                            borderBottom: '2px solid rgba(var(--primary-rgb), 0.1)'
                        }}>
                            <div>
                                <h3 style={{
                                    margin: '0 0 8px 0',
                                    fontWeight: '600',
                                    fontSize: '1.5rem',
                                    color: 'var(--text)',
                                }}>
                                    Preview: {summary.totalItems} items will be updated
                                </h3>
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    Average increase: ₹{summary.avgIncrease.toFixed(2)} per item
                                </p>
                            </div>
                            <div style={{
                                padding: '12px 24px',
                                background: 'rgba(var(--primary-rgb), 0.1)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <AlertCircle size={20} color="var(--primary)" />
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    +{percentage}%
                                </span>
                            </div>
                        </div>

                        {/* Filter and Items Per Page Controls */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1rem',
                            marginBottom: '1.5rem',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '500px' }}>
                                <Search size={18} style={{
                                    position: 'absolute',
                                    left: '16px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--text-muted)'
                                }} />
                                <input
                                    type="text"
                                    value={filterText}
                                    onChange={(e) => {
                                        setFilterText(e.target.value)
                                        setCurrentPage(1) // Reset to first page when filtering
                                    }}
                                    placeholder="Filter by item name..."
                                    style={{
                                        width: '100%',
                                        height: '48px',
                                        padding: '0 16px 0 48px',
                                        fontSize: '0.95rem',
                                        border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    color: 'var(--text-muted)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    Items per page:
                                </label>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value))
                                        setCurrentPage(1) // Reset to first page when changing items per page
                                    }}
                                    style={{
                                        height: '48px',
                                        padding: '0 40px 0 16px',
                                        fontSize: '0.95rem',
                                        fontWeight: '600',
                                        border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                        borderRadius: '12px',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        background: 'white',
                                        color: 'var(--text)',
                                        appearance: 'none',
                                        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23666\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 16px center'
                                    }}
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="20">20</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>
                        </div>

                        {/* Results count */}
                        {filterText && (
                            <div style={{
                                marginBottom: '1rem',
                                padding: '12px 16px',
                                background: 'rgba(var(--primary-rgb), 0.05)',
                                borderRadius: '8px',
                                fontSize: '0.9rem',
                                color: 'var(--text-muted)'
                            }}>
                                Showing {filteredAndPaginatedItems.totalFiltered} of {preview.length} items
                            </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Item Name</th>
                                        <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Price</th>
                                        <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New Price</th>
                                        <th style={{ padding: '16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Increase</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndPaginatedItems.items.length > 0 ? (
                                        filteredAndPaginatedItems.items.map((item, index) => (
                                            <tr key={item.id} style={{
                                                borderBottom: index < filteredAndPaginatedItems.items.length - 1 ? '1px solid rgba(var(--primary-rgb), 0.1)' : 'none'
                                            }}>
                                                <td style={{ padding: '16px', fontSize: '0.95rem', fontWeight: '500', color: 'var(--text)' }}>
                                                    {item.name}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                                                    ₹{item.oldPrice.toFixed(2)}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary)' }}>
                                                    ₹{item.newPrice.toFixed(2)}
                                                </td>
                                                <td style={{ padding: '16px', textAlign: 'right', fontSize: '0.95rem', fontWeight: '600', color: '#059669' }}>
                                                    +₹{item.increase.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} style={{
                                                padding: '32px',
                                                textAlign: 'center',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.95rem'
                                            }}>
                                                No items match your filter
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {filteredAndPaginatedItems.totalPages > 1 && (
                            <div style={{
                                marginTop: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                padding: '16px',
                                background: 'rgba(var(--primary-rgb), 0.02)',
                                borderRadius: '12px'
                            }}>
                                <div style={{
                                    fontSize: '0.9rem',
                                    color: 'var(--text-muted)',
                                    fontWeight: '500'
                                }}>
                                    Page {currentPage} of {filteredAndPaginatedItems.totalPages}
                                    <span style={{ margin: '0 8px' }}>•</span>
                                    {filteredAndPaginatedItems.totalFiltered} total items
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        style={{
                                            height: '40px',
                                            padding: '0 16px',
                                            background: currentPage === 1 ? 'rgba(var(--primary-rgb), 0.05)' : 'white',
                                            color: currentPage === 1 ? 'var(--text-muted)' : 'var(--primary)',
                                            border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                            borderRadius: '10px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (currentPage !== 1) {
                                                e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)'
                                                e.currentTarget.style.borderColor = 'var(--primary)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (currentPage !== 1) {
                                                e.currentTarget.style.background = 'white'
                                                e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                            }
                                        }}
                                    >
                                        <ChevronLeft size={16} />
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(filteredAndPaginatedItems.totalPages, prev + 1))}
                                        disabled={currentPage === filteredAndPaginatedItems.totalPages}
                                        style={{
                                            height: '40px',
                                            padding: '0 16px',
                                            background: currentPage === filteredAndPaginatedItems.totalPages ? 'rgba(var(--primary-rgb), 0.05)' : 'white',
                                            color: currentPage === filteredAndPaginatedItems.totalPages ? 'var(--text-muted)' : 'var(--primary)',
                                            border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                            borderRadius: '10px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600',
                                            cursor: currentPage === filteredAndPaginatedItems.totalPages ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (currentPage !== filteredAndPaginatedItems.totalPages) {
                                                e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)'
                                                e.currentTarget.style.borderColor = 'var(--primary)'
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (currentPage !== filteredAndPaginatedItems.totalPages) {
                                                e.currentTarget.style.background = 'white'
                                                e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                            }
                                        }}
                                    >
                                        Next
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                style={{
                                    flex: 1,
                                    height: '58px',
                                    background: 'white',
                                    color: 'var(--text-muted)',
                                    border: '2px solid rgba(var(--primary-rgb), 0.15)',
                                    borderRadius: '14px',
                                    fontSize: '1.05rem',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'
                                        e.currentTarget.style.borderColor = 'var(--primary)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'white'
                                    e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApply}
                                disabled={loading}
                                style={{
                                    flex: 2,
                                    height: '58px',
                                    background: '#059669',
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
                                    boxShadow: '0 4px 16px rgba(5, 150, 105, 0.3)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.boxShadow = '0 6px 24px rgba(5, 150, 105, 0.4)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(5, 150, 105, 0.3)'
                                }}
                            >
                                {loading ? (
                                    <div style={{ width: '22px', height: '22px', border: '3px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                ) : (
                                    <>
                                        <Check size={20} />
                                        Apply Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
