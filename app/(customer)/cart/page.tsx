'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ShoppingBag, Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Loading } from '@/components/ui/Loading'
import { showError, showPopup } from '@/components/ui/Popup'
import { LoginRequiredModal } from '@/components/ui/LoginRequiredModal'

interface DailySpecial {
    id: string
    period?: string
    menu_item?: { id: string; name: string; price: number }
    name?: string
    price?: number
}

interface OrderResponse {
    success: boolean
    error?: string
}

export default function CartPage() {
    const { items, addToCart, removeFromCart, updateQuantity, total, clearCart, editingOrderId } = useCart()
    const { user } = useAuth()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [dailySpecials, setDailySpecials] = useState<DailySpecial[]>([])
    const [locationType, setLocationType] = useState<'indoor' | 'outdoor'>('indoor')
    const [notes, setNotes] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('cart_notes') || ''
        }
        return ''
    })
    const [riderSettlementType, setRiderSettlementType] = useState<'monthly' | 'paid_now'>('monthly')
    const [showLoginModal, setShowLoginModal] = useState(false)

    // Persist notes to localStorage
    useEffect(() => {
        if (notes) {
            localStorage.setItem('cart_notes', notes)
        } else {
            localStorage.removeItem('cart_notes')
        }
    }, [notes])

    // Fetch daily specials
    useEffect(() => {
        async function fetchSpecials() {
            try {
                const res = await fetch('/api/v1/v1/menu')
                const json = await res.json()
                if (json.success) {
                    setDailySpecials(json.data?.specials || [])
                }
            } catch (e) {
                console.error('fetchSpecials error:', e)
            }
        }
        fetchSpecials()
    }, [])

    // Resolve table name and guests from session/user data
    const getTableInfo = () => {
        // OUTSIDER: get from guest_session
        if (user?.role === 'OUTSIDER') {
            const storedSession = localStorage.getItem('guest_session')
            if (storedSession) {
                try {
                    const session = JSON.parse(storedSession)
                    return {
                        tableName: session.table_name || 'Guest',
                        numGuests: parseInt(session.num_guests) || 1
                    }
                } catch { /* fallthrough */ }
            }
            return { tableName: 'Guest', numGuests: 1 }
        }
        // RIDER/STAFF/KITCHEN: use name as identifier
        return { tableName: user?.name || user?.role || 'Staff', numGuests: 1 }
    }

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault()

        // Check if user is authenticated — show login modal
        if (!user) {
            localStorage.setItem('checkout_intent', 'true')
            setShowLoginModal(true)
            return
        }

        setLoading(true)

        try {
            // Check for virtual items
            const hasRegularMeal = items.some(item => item.itemId === 'REGULAR_MEAL_VIRTUAL')
            const isStaffUser = user?.role === 'STAFF'
            const isRiderPaidNow = user?.role === 'RIDER' && riderSettlementType === 'paid_now'
            const trimmedNotes = notes.trim()
            const finalNotes = hasRegularMeal && isStaffUser
                ? 'REGULAR_STAFF_MEAL'
                : isRiderPaidNow
                    ? trimmedNotes
                        ? `[RIDER_PAID_NOW] ${trimmedNotes}`
                        : '[RIDER_PAID_NOW]'
                    : trimmedNotes

            // Resolve table info automatically
            const { tableName, numGuests } = getTableInfo()

            // Get guest session ID if applicable
            let sessionId = null
            if (user?.role === 'OUTSIDER') {
                const storedSession = localStorage.getItem('guest_session')
                if (storedSession) {
                    try {
                        sessionId = JSON.parse(storedSession).id
                    } catch { /* ignore */ }
                }
                if (!sessionId) {
                    // Fallback: fetch active session
                    try {
                        const sessionResp = await fetch(`/api/sessions/active?userId=${user.id}`)
                        const sessionData = await sessionResp.json()
                        if (sessionData.success && sessionData.session) {
                            sessionId = sessionData.session.id
                            localStorage.setItem('guest_session', JSON.stringify(sessionData.session))
                        }
                    } catch { /* continue without sessionId */ }
                }
            }

            // Get auth token
            const token = localStorage.getItem('session_token')

            let orderData: OrderResponse

            if (editingOrderId) {
                // UPDATE existing order
                const orderResponse = await fetch('/api/v1/v1/orders/update', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        orderId: editingOrderId,
                        userId: user?.id,
                        items: items.filter(item => item.itemId !== 'REGULAR_MEAL_VIRTUAL'),
                        notes: finalNotes,
                        riderPaidNow: isRiderPaidNow,
                    })
                })

                orderData = await orderResponse.json()
            } else {
                // CREATE new order
                const orderResponse = await fetch('/api/v1/v1/orders/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        userId: user?.id,
                        phone: user?.phone,
                        items: items.filter(item => item.itemId !== 'REGULAR_MEAL_VIRTUAL'),
                        tableName,
                        numGuests,
                        locationType,
                        notes: finalNotes,
                        riderPaidNow: isRiderPaidNow,
                        sessionId
                    })
                })

                orderData = await orderResponse.json()
            }

            if (!orderData.success) {
                throw new Error(orderData.error || 'Something went wrong. Please try again.')
            }

            // Success!
            localStorage.removeItem('cart_notes')
            clearCart()

            // Redirect
            router.push('/orders')
        } catch (err: unknown) {
            console.error('Order placement error:', err)
            showError('Oops!', (err as Error).message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <Loading fullScreen message={editingOrderId ? "Updating your order..." : "Placing your order..."} />
    }

    if (items.length === 0) {
        return (
            <div className="container fade-in" style={{
                paddingTop: 'clamp(3rem, 15vh, 20vh)',
                paddingLeft: 'clamp(1rem, 4vw, 2rem)',
                paddingRight: 'clamp(1rem, 4vw, 2rem)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-6)'
            }}>
                <div style={{
                    width: 'clamp(72px, 20vw, 100px)',
                    height: 'clamp(72px, 20vw, 100px)',
                    borderRadius: '50%',
                    background: 'rgba(var(--primary-rgb), 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    marginBottom: 'var(--space-2)'
                }}>
                    <ShoppingBag style={{ width: 'clamp(36px, 12vw, 48px)', height: 'clamp(36px, 12vw, 48px)' }} />
                </div>
                <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)' }}>Your Cart is Empty</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.95rem, 3vw, 1.125rem)', maxWidth: '300px' }}>
                    Looks like you haven&apos;t added anything to your cart yet.
                </p>
                <Link href="/menu">
                    <Button size="lg">Discover Our Menu</Button>
                </Link>

                {/* Specials Section for Guests on Empty Cart */}
                {(!user || user?.role === 'OUTSIDER') && dailySpecials.length > 0 && (
                    <div style={{ marginTop: '32px', width: '100%', maxWidth: '400px', padding: '16px', background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%)', borderRadius: '12px', border: '2px solid #FBBF24', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ⭐ Today's Specials
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                            {dailySpecials.map((special) => {
                                const item = special.menu_item || special;
                                return (
                                    <button
                                        key={special.id}
                                        type="button"
                                        onClick={() => {
                                            addToCart({
                                                itemId: item.id,
                                                name: item.name,
                                                price: item.price
                                            });
                                            showPopup({ type: 'success', title: 'Added to cart!', message: 'Added to cart!' });
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            background: 'white',
                                            border: '1px solid #FBBF24',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#FBBF24'
                                            e.currentTarget.style.color = 'white'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'white'
                                            e.currentTarget.style.color = 'inherit'
                                        }}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 700, color: '#92400E', fontSize: '0.95rem' }}>{item.name}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7, color: 'inherit', marginTop: '2px' }}>₹{item.price} • {special.period || 'special'}</div>
                                        </div>
                                        <Plus size={18} style={{ flexShrink: 0, marginLeft: '8px' }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="container fade-in" style={{ padding: 'clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 1.5rem)', paddingBottom: 'var(--space-12)' }}>
            <PageHeader title={editingOrderId ? "Edit Order" : "Checkout"} backHref={editingOrderId ? "/menu" : "/orders"} />

            {/* Editing Order Banner */}
            {editingOrderId && (
                <div style={{
                    background: '#FEF3C7',
                    border: '1.5px solid #F59E0B',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: 'var(--space-6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <Sparkles size={20} style={{ color: '#92400E' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400E' }}>Editing Existing Order</div>
                        <div style={{ fontSize: '0.8rem', color: '#A16207' }}>Modify items below and confirm to update your order</div>
                    </div>
                    <button
                        onClick={() => { clearCart(); router.push('/orders') }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #D97706',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#92400E',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Cancel Edit
                    </button>
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 'var(--space-8)',
                alignItems: 'start'
            }}>
                {/* Responsive layout */}
                <style jsx>{`
                    @media (min-width: 1024px) {
                        div[data-checkout-container] {
                            grid-template-columns: 1fr 400px !important;
                        }
                    }
                    @media (max-width: 768px) {
                        div[data-cart-item] {
                            flex-direction: row !important;
                            align-items: center !important;
                            gap: 8px !important;
                            padding: 8px 12px !important;
                        }
                        div[data-cart-item] h3 {
                            font-size: 0.95rem !important;
                            white-space: normal !important;
                            display: -webkit-box !important;
                            -webkit-line-clamp: 2 !important;
                            -webkit-box-orient: vertical !important;
                        }
                        div[data-cart-item] p {
                            font-size: 0.9rem !important;
                        }
                        div[data-cart-item-controls] {
                            gap: 6px !important;
                            margin-top: 0 !important;
                            flex-wrap: nowrap !important;
                            justify-content: flex-end !important;
                        }
                        div[data-cart-item-controls] button {
                            width: 28px !important;
                            height: 28px !important;
                        }
                        div[data-cart-item-controls] span {
                            min-width: 24px !important;
                            font-size: 0.9rem !important;
                        }
                        div[data-order-summary] {
                            padding: 1rem !important;
                            position: relative !important;
                            top: auto !important;
                        }
                        div[data-checkout-container] {
                            gap: 1.5rem !important;
                        }
                    }
                `}</style>

                <div data-checkout-container style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-8)' }}>
                    <div>
                        <h2 style={{ marginBottom: 'var(--space-4)', fontSize: '1.25rem', opacity: 0.8 }}>Your Items</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {items.map(item => (
                                <div key={item.itemId} data-cart-item className="hover-lift" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'var(--surface)',
                                    padding: 'clamp(0.75rem, 3vw, 1rem)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: 'clamp(1rem, 3vw, 1.125rem)', fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h3>
                                        <p style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{(item.price * item.quantity).toFixed(2)}</p>
                                    </div>

                                    <div data-cart-item-controls style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--background)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '2px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            <button
                                                onClick={() => updateQuantity(item.itemId, -1)}
                                                style={{
                                                    width: 'clamp(28px, 6vw, 32px)',
                                                    height: 'clamp(28px, 6vw, 32px)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    fontSize: '1.25rem'
                                                }}
                                            >-</button>
                                            <span style={{ minWidth: 'clamp(28px, 6vw, 32px)', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.itemId, 1)}
                                                style={{
                                                    width: 'clamp(28px, 6vw, 32px)',
                                                    height: 'clamp(28px, 6vw, 32px)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    fontSize: '1.25rem'
                                                }}
                                            >+</button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.itemId)}
                                            style={{
                                                color: '#EF4444',
                                                border: 'none',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                transition: 'var(--transition)'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div data-order-summary style={{
                        background: 'var(--surface)',
                        padding: 'clamp(1rem, 4vw, 1.5rem)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                        position: 'sticky',
                        top: 'var(--space-6)'
                    }}>
                        <h2 style={{ marginBottom: 'var(--space-6)', fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontFamily: 'var(--font-serif)' }}>Order Summary</h2>

                        {/* Specials Section for Guests */}
                        {(!user || user?.role === 'OUTSIDER') && dailySpecials.length > 0 && (
                            <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%)', borderRadius: '12px', border: '2px solid #FBBF24', marginBottom: 'var(--space-6)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.75rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    ⭐ Today&apos;s Specials
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {dailySpecials.map((special) => {
                                        const item = special.menu_item || special;
                                        return (
                                            <button
                                                key={special.id}
                                                type="button"
                                                onClick={() => {
                                                    addToCart({
                                                        itemId: item.id,
                                                        name: item.name,
                                                        price: item.price
                                                    });
                                                    showPopup({ type: 'success', title: 'Added to cart!', message: 'Added to cart!' });
                                                }}
                                                style={{
                                                    padding: '10px 12px',
                                                    background: 'white',
                                                    border: '1px solid #FBBF24',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    width: '100%'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#FBBF24'
                                                    e.currentTarget.style.color = 'white'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'white'
                                                    e.currentTarget.style.color = 'inherit'
                                                }}
                                            >
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: 700, color: '#92400E', fontSize: '0.95rem' }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.7, color: 'inherit', marginTop: '2px' }}>₹{item.price} • {special.period || 'special'}</div>
                                                </div>
                                                <Plus size={18} style={{ flexShrink: 0, marginLeft: '8px' }} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {(!user || user?.role === 'OUTSIDER') && (
                            <div style={{
                                background: 'rgba(var(--primary-rgb), 0.05)',
                                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                                padding: 'var(--space-4)',
                                borderRadius: 'var(--radius)',
                                marginBottom: 'var(--space-6)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    right: '-10px',
                                    fontSize: '2.5rem',
                                    opacity: 0.05,
                                    transform: 'rotate(15deg)'
                                }}>🐎</div>
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.9rem',
                                    lineHeight: 1.5,
                                    color: 'var(--primary)',
                                    fontWeight: 600,
                                    fontStyle: 'italic',
                                    position: 'relative',
                                    zIndex: 1
                                }}>
                                    &quot;Freshly made just for you - it&apos;ll be ready in about 30 minutes. Take a moment to soak in the Horsey atmosphere.&quot;
                                </p>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', padding: 'clamp(0.75rem, 3vw, 1rem)', background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 'clamp(0.875rem, 3vw, 1rem)' }}>Total Amount</span>
                            <span style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 800, color: 'var(--primary)' }}>₹{total.toFixed(2)}</span>
                        </div>

                        <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                                    <input
                                        type="radio"
                                        name="locationType"
                                        checked={locationType === 'indoor'}
                                        onChange={() => setLocationType('indoor')}
                                        style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                                    />
                                    Indoor
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                                    <input
                                        type="radio"
                                        name="locationType"
                                        checked={locationType === 'outdoor'}
                                        onChange={() => setLocationType('outdoor')}
                                        style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                                    />
                                    Outdoor
                                </label>
                            </div>

                            <Input
                                label="Special Notes"
                                placeholder="Any allergies or extra requests?"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />

                            {user?.role === 'RIDER' && (
                                <div style={{
                                    padding: '1.25rem',
                                    background: 'rgba(var(--primary-rgb), 0.05)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                    marginTop: 'var(--space-2)'
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                                        Rider Settlement
                                    </div>

                                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <input
                                                type="radio"
                                                name="riderSettlementType"
                                                checked={riderSettlementType === 'monthly'}
                                                onChange={() => setRiderSettlementType('monthly')}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            />
                                            Add to monthly account
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                            <input
                                                type="radio"
                                                name="riderSettlementType"
                                                checked={riderSettlementType === 'paid_now'}
                                                onChange={() => setRiderSettlementType('paid_now')}
                                                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                                            />
                                            Pay now
                                        </label>
                                    </div>

                                    {riderSettlementType === 'monthly' ? (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '14px',
                                        }}>
                                            <div style={{
                                                minWidth: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: 'var(--primary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.85rem',
                                                fontWeight: '900',
                                                boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
                                            }}>!</div>
                                            <p style={{
                                                margin: 0,
                                                fontSize: '0.9rem',
                                                color: 'var(--text)',
                                                fontWeight: '600',
                                                lineHeight: 1.5
                                            }}>
                                                This transaction will be recorded and settled as part of your <span style={{ color: 'var(--primary)' }}>monthly expense account</span>.
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '14px',
                                            background: 'rgba(16, 185, 129, 0.08)',
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            borderRadius: '12px',
                                            padding: '12px'
                                        }}>
                                            <div style={{
                                                minWidth: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: '#10B981',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                fontWeight: '900'
                                            }}>✓</div>
                                            <p style={{
                                                margin: 0,
                                                fontSize: '0.9rem',
                                                color: 'var(--text)',
                                                fontWeight: '600',
                                                lineHeight: 1.5
                                            }}>
                                                This order will be marked as <span style={{ color: '#10B981' }}>paid on order day</span> and should be excluded from monthly account deductions in reports.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {user?.role === 'STAFF' && (
                                <div style={{
                                    padding: '1.25rem',
                                    background: 'rgba(var(--primary-rgb), 0.05)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '14px',
                                    marginTop: 'var(--space-2)'
                                }}>
                                    <div style={{
                                        minWidth: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: '900',
                                        boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
                                    }}>!</div>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.9rem',
                                        color: 'var(--text)',
                                        fontWeight: '600',
                                        lineHeight: 1.5
                                    }}>
                                        This transaction will be recorded and settled as part of your <span style={{ color: 'var(--primary)' }}>monthly expense account</span>.
                                    </p>
                                </div>
                            )}

                            <Button type="submit" isLoading={loading} size="lg" style={{ marginTop: 'var(--space-4)', height: 'clamp(48px, 10vw, 56px)', fontSize: 'clamp(1rem, 3vw, 1.125rem)', width: '100%' }}>
                                {editingOrderId ? 'Update Order' : 'Confirm Order'}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Login Required Modal */}
            <LoginRequiredModal 
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                message="You need to login before placing an order"
            />
        </div>
    )
}

