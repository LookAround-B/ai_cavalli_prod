'use client'

import { useEffect, useState, useMemo } from 'react'
import { SearchInput } from '@/components/ui/SearchInput'
import { MenuItemCard, MenuItem } from '@/components/ui/MenuItemCard'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { X, LayoutGrid } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Loading } from '@/components/ui/Loading'

interface MenuPageItem extends MenuItem {
    category_id: string;
    special_period?: string;
}

interface Category {
    id: string;
    name: string;
    sort_order: number;
}

export default function MenuPage() {
    const { user } = useAuth()
    const role = user?.role
    const isRIDERLikeRole = role === 'RIDER' || role === 'STAFF'
    const [categories, setCategories] = useState<Category[]>([])
    const [items, setItems] = useState<MenuPageItem[]>([])
    const [specials, setSpecials] = useState<MenuPageItem[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const { addToCart } = useCart()
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                const res = await fetch('/api/menu')
                const json = await res.json()
                if (json.success) {
                    if (json.data?.categories) setCategories(json.data.categories)
                    if (json.data?.menuItems) setItems(json.data.menuItems)
                    if (json.data?.specials) {
                        const specialItems = json.data.specials.map((s: { menu_item: MenuItem; period?: string }) => ({
                            ...s.menu_item,
                            special_period: s.period
                        }))
                        setSpecials(specialItems)
                    }
                }
            } catch (e) { console.error('fetchData error:', e) }
            setLoading(false)
        }
        fetchData()
    }, [])

    const displayedCategories = useMemo(() => {
        return categories.filter(cat => {
            if (cat.name === 'Fixed Menu' && !isRIDERLikeRole) {
                return false
            }
            return true
        })
    }, [categories, isRIDERLikeRole])

    const fixedMenuCategoryId = useMemo(() => {
        return categories.find(c => c.name === 'Fixed Menu')?.id
    }, [categories])

    const fixedMenuItems = useMemo(() => {
        if (!fixedMenuCategoryId) return []
        return items.filter(item => item.category_id === fixedMenuCategoryId)
    }, [items, fixedMenuCategoryId])

    const filteredItems = useMemo(() => {
        // Find if the active category is "Today's Specials"
        const specCat = categories.find(c => c.name === "Today's Specials")
        const isSpecialsActive = activeCategory === 'specials' || (specCat && activeCategory === specCat.id)

        if (isSpecialsActive && specials.length > 0) {
            // Show items from daily_specials table with search filtering
            return specials.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
                return matchesSearch
            })
        }

        return items.filter(item => {
            // Exclude fixed menu items from "All" category
            if (activeCategory === 'all' && item.category_id === fixedMenuCategoryId) return false

            const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            return matchesCategory && matchesSearch
        })
    }, [items, activeCategory, searchQuery, specials, categories, fixedMenuCategoryId])

    const filteredFixedItems = useMemo(() => {
        return fixedMenuItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
            return matchesSearch
        })
    }, [fixedMenuItems, searchQuery])

    // Create virtual Regular Meal item for staff
    const regularMealItem: MenuItem | null = useMemo(() => {
        if (role !== 'STAFF') return null
        return {
            id: 'REGULAR_MEAL_VIRTUAL',
            name: 'Regular Staff Meal',
            description: 'Standard meal for staff members (Free)',
            price: 0,
            image_url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800',
            available: true
        }
    }, [role])

    const handleAddToCart = (item: MenuItem) => {
        addToCart(item)
    }

    if (loading) {
        return <Loading fullScreen message="Preparing the menu..." />
    }
    const ITALIAN_RED = '#A91E22';
    const DEEP_BLACK = '#1A1A1A';

    return (
        <>
            <div className="container fade-in" style={{ paddingTop: 'clamp(1rem, 4vw, 1.5rem)', paddingBottom: 'clamp(140px, 25vw, 200px)' }}>
                <PageHeader title="Menu" backHref="/home" />

                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: 'rgba(253, 251, 247, 0.95)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    margin: '0 calc(-1 * clamp(0.75rem, 4vw, 2rem)) clamp(1rem, 4vw, 2rem)',
                    padding: 'clamp(0.75rem, 2.5vw, 1rem) clamp(0.75rem, 4vw, 2rem)',
                    borderBottom: '1px solid var(--border)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                }}>
                    <SearchInput
                        placeholder="What are you craving?"
                        value={searchQuery}
                        onSearch={setSearchQuery}
                    />

                </div>

                {/* Regular Meal Section - Only for Staff */}
                {regularMealItem && (
                    <div style={{ marginBottom: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ width: '8px', height: '24px', background: '#059669', borderRadius: '4px' }} />
                            <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Regular Staff Meal</h2>
                        </div>
                        <div className="menu-grid">
                            <MenuItemCard item={regularMealItem} onAdd={handleAddToCart} />
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                    </div>
                )}

                {/* Specials Highlight Section */}
                {specials.length > 0 && !searchQuery && (activeCategory === 'all' || activeCategory === 'specials' || (categories.find(c => c.name === "Today's Specials")?.id === activeCategory)) && (
                    <div style={{ marginBottom: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ width: '8px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }} />
                            <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Today&apos;s Specials</h2>
                        </div>
                        <div className="menu-grid">
                            {specials.map(item => (
                                <MenuItemCard key={`special-${item.id}`} item={item} onAdd={handleAddToCart} />
                            ))}
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                    </div>
                )}

                {/* Staff Fixed Menu Section - Only for Staff */}
                {isRIDERLikeRole && filteredFixedItems.length > 0 && (activeCategory === 'all' || activeCategory === fixedMenuCategoryId) && (
                    <div style={{ marginBottom: 'var(--space-10)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                            <div style={{ width: '8px', height: '24px', background: '#3B82F6', borderRadius: '4px' }} />
                            <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Staff Fixed Menu</h2>
                        </div>
                        <div className="menu-grid">
                            {filteredFixedItems.map(item => (
                                <MenuItemCard key={`fixed-${item.id}`} item={item} onAdd={handleAddToCart} />
                            ))}
                        </div>
                        <div style={{ height: '1px', background: 'var(--border-light)', margin: 'var(--space-8) 0' }} />
                    </div>
                )}

                <div className="menu-grid">
                    {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                            <MenuItemCard key={item.id} item={item} onAdd={handleAddToCart} />
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-6)', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '1.25rem', fontWeight: 500 }}>No dishes found</p>
                            <p>Try searching for something else or explore another category.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Category Menu Container */}
            <div 
                style={{
                position: 'fixed',
                bottom: 'clamp(70px, 12vw, 100px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10001,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 'calc(100% - 16px)',
                maxWidth: '320px',
                padding: '0 8px',
                boxSizing: 'border-box',
                pointerEvents: 'none'
            }}>
                {/* The Pop-up Menu */}
                {isCategoryMenuOpen && (
                    <div
                        style={{
                            width: '100%',
                            maxHeight: 'clamp(300px, 60vh, 400px)',
                            background: 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            borderRadius: '32px',
                            padding: 'clamp(1rem, 3vw, 1.25rem)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '16px',
                            animation: 'slideUpCenter 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            overflowY: 'auto',
                            pointerEvents: 'auto',
                            boxSizing: 'border-box'
                        }}
                        className="scrollbar-hide"
                    >
                        <div style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: '#999',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            textAlign: 'center',
                            marginBottom: '8px'
                        }}>Select Collection</div>

                        <button
                            onClick={() => { setActiveCategory('all'); setIsCategoryMenuOpen(false); }}
                            style={{
                                textAlign: 'center',
                                padding: 'clamp(0.75rem, 2vw, 1rem)',
                                borderRadius: '20px',
                                border: 'none',
                                background: activeCategory === 'all' ? ITALIAN_RED : 'rgba(0,0,0,0.03)',
                                color: activeCategory === 'all' ? 'white' : DEEP_BLACK,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                                pointerEvents: 'auto'
                            }}
                        >
                            All Dishes
                        </button>

                        {displayedCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setIsCategoryMenuOpen(false); }}
                                style={{
                                    textAlign: 'center',
                                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: activeCategory === cat.id ? ITALIAN_RED : 'rgba(0,0,0,0.03)',
                                    color: activeCategory === cat.id ? 'white' : DEEP_BLACK,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    fontSize: 'clamp(0.85rem, 2vw, 0.95rem)',
                                    pointerEvents: 'auto',
                                    wordBreak: 'break-word'
                                }}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* The Trigger Button - Capsule Style */}
                <button
                    onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                    style={{
                        width: isCategoryMenuOpen ? 'clamp(48px, 12vw, 64px)' : 'clamp(130px, 35vw, 180px)',
                        height: 'clamp(52px, 12vw, 64px)',
                        borderRadius: '40px',
                        background: isCategoryMenuOpen ? 'white' : ITALIAN_RED,
                        color: isCategoryMenuOpen ? DEEP_BLACK : 'white',
                        border: 'none',
                        boxShadow: '0 12px 30px rgba(169, 30, 34, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'clamp(6px, 2vw, 12px)',
                        cursor: 'pointer',
                        transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        pointerEvents: 'auto',
                        flexShrink: 0
                    }}
                >
                    {isCategoryMenuOpen ? (
                        <X size={24} />
                    ) : (
                        <>
                            <LayoutGrid size={20} />
                            <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.9rem)' }}>CATEGORIES</span>
                        </>
                    )}
                </button>
            </div>

            <style jsx>{`
                @keyframes slideUpCenter {
    from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
            `}</style>
        </>
    )
}
