'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth/context'

import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle, ChevronDown, LogOut, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'
import { Utensils, Receipt } from 'lucide-react'
import { useCart } from '@/lib/context/CartContext'
import { BillPreviewModal, BillData } from '@/components/ui/BillPreviewModal'
import { showError, showSuccess, showConfirm } from '@/components/ui/Popup'

export default function OrdersPage() {
    const { user, logout } = useAuth()
    const { clearCart, addToCart, items: cartItems, setEditingOrderId } = useCart()
    const router = useRouter()
    const searchParams = useSearchParams()
    const orderIdParam = searchParams.get('orderId')

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [activeSession, setActiveSession] = useState<any>(null)
    const [endingSession, setEndingSession] = useState(false)
    const [billPreview, setBillPreview] = useState<BillData | null>(null)
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

    // Track whether we've already triggered auto-logout to avoid double-firing
    const [autoLogoutTriggered, setAutoLogoutTriggered] = useState(false)

    // Cooldown notification state
    const [showCooldown, setShowCooldown] = useState(false)
    const [cooldownTime, setCooldownTime] = useState(300) // 5 minutes in seconds
    const [lastOrderTime, setLastOrderTime] = useState<Date | null>(null)

    useEffect(() => {
        // If neither user nor orderIdParam, we can't show anything
        if (!user && !orderIdParam) {
            setLoading(false)
            return
        }

        async function fetchOrders() {
            try {
                let url = '/api/orders?'
                if (user) url += `userId=${user.id}`
                else if (orderIdParam) url += `orderId=${orderIdParam}`
                const res = await fetch(url)
                const json = await res.json()
                const data = json.success ? json.data : null

            if (data) {
                setOrders(data)

                // Check for recent orders and start cooldown if needed
                if (data.length > 0) {
                    const mostRecentOrder = new Date(data[0].created_at)
                    const now = new Date()
                    const timeDiff = (now.getTime() - mostRecentOrder.getTime()) / 1000 // in seconds
                    
                    if (timeDiff < 300) { // Less than 5 minutes ago
                        setLastOrderTime(mostRecentOrder)
                        setShowCooldown(true)
                        setCooldownTime(Math.ceil(300 - timeDiff))
                    }
                }

                // Show bill preview when kitchen/admin has billed all orders
                if (
                    user?.role === 'OUTSIDER' &&
                    data.length > 0 &&
                    data.every((o: any) => o.billed === true) &&
                    !autoLogoutTriggered
                ) {
                    setAutoLogoutTriggered(true)
                    // Fetch the generated bill and show it so guest can print/save
                    fetchKitchenBill(data.map((o: any) => o.id))
                }
            }
            } catch (e) { console.error('fetchOrders error:', e) }
            setLoading(false)
        }

        async function fetchActiveSession() {
            try {
                if (user?.role === 'OUTSIDER') {
                    // OUTSIDER: look up guest_session by phone or userId
                    const params = new URLSearchParams()
                    if (user.phone) params.set('phone', user.phone)
                    params.set('userId', user.id)

                    const response = await fetch(`/api/sessions/active?${params.toString()}`)
                    const data = await response.json()
                    if (data.success && data.session) {
                        setActiveSession(data.session)
                        return
                    }
                }
                // For ALL roles (including OUTSIDER fallback): build a virtual session from orders
                // This ensures RIDER/STAFF can also use "Get the Bill"
                // We'll set a marker so handleGetBill knows to use the user-based flow
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            } catch (e) {
                console.error('fetchActiveSession error:', e)
                // Still set virtual session so the bill button works
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            }
        }

        fetchOrders()
        fetchActiveSession()
    }, [user, orderIdParam])

    // Manual refresh handler
    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            let url = '/api/orders?'
            if (user) url += `userId=${user.id}`
            else if (orderIdParam) url += `orderId=${orderIdParam}`
            const res = await fetch(url)
            const json = await res.json()
            const data = json.success ? json.data : null
            if (data) setOrders(data)
        } catch (e) { console.error('refresh error:', e) }
        setRefreshing(false)
    }

    // Refs for stable references in timer callback
    const logoutRef = useRef(logout)
    const clearCartRef = useRef(clearCart)
    const userRef = useRef(user)
    useEffect(() => { logoutRef.current = logout }, [logout])
    useEffect(() => { clearCartRef.current = clearCart }, [clearCart])
    useEffect(() => { userRef.current = user }, [user])

    // Cooldown timer effect + auto-logout when timer expires
    useEffect(() => {
        if (!showCooldown || cooldownTime < 0) return

        if (cooldownTime === 0) {
            // Timer expired — auto-logout immediately
            setShowCooldown(false)
            if (userRef.current?.role === 'OUTSIDER') {
                console.log('Auto-logout triggered after 5-min cooldown')
                clearCartRef.current()
                logoutRef.current()
            }
            return
        }

        const timer = setInterval(() => {
            setCooldownTime((prevTime) => prevTime - 1)
        }, 1000)

        return () => clearInterval(timer)
    }, [showCooldown, cooldownTime])

    // Format cooldown time display
    const formatCooldownTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Handle editing the most recent order within cooldown window
    const handleEditOrder = () => {
        if (orders.length === 0) return

        // Get the most recent order (already sorted by created_at desc)
        const recentOrder = orders[0]

        // Clear existing cart and load order items into cart
        clearCart()

        // Set the editing order ID so cart page knows to update, not create
        setEditingOrderId(recentOrder.id)

        // Add each item from the order to the cart
        if (recentOrder.items && recentOrder.items.length > 0) {
            for (const item of recentOrder.items) {
                const menuItemId = item.menu_item_id || item.menu_item?.id
                const menuItemName = item.menu_item?.name || 'Item'
                if (menuItemId) {
                    // Add item with correct quantity
                    for (let i = 0; i < item.quantity; i++) {
                        addToCart({
                            id: menuItemId,
                            name: menuItemName,
                            price: item.price,
                        })
                    }
                }
            }
        }

        // Navigate to menu so user can browse and modify items
        router.push('/menu')
    }

    // Separate effect for polling guest session status (billed by kitchen/admin)
    useEffect(() => {
        if (
            !user ||
            user.role !== 'OUTSIDER' ||
            !activeSession ||
            activeSession._virtual ||
            !activeSession.id ||
            autoLogoutTriggered
        ) return

        const sessionPollInterval = setInterval(async () => {
            try {
                const params = new URLSearchParams()
                if (user.phone) params.set('phone', user.phone)
                params.set('userId', user.id)
                const res = await fetch(`/api/sessions/active?${params.toString()}`)
                const data = await res.json()
                if (data.success && data.session?.status === 'ended' && !autoLogoutTriggered) {
                    setAutoLogoutTriggered(true)
                    const orderIds = orders.map((o: any) => o.id)
                    if (orderIds.length > 0) {
                        fetchKitchenBill(orderIds)
                    } else {
                        showSuccess('Session Ended', 'Your visit has ended. Logging you out...')
                        clearCart()
                        setTimeout(() => logout(), 2500)
                    }
                }
            } catch (e) { console.error('Session poll error:', e) }
        }, 5000)

        return () => {
            clearInterval(sessionPollInterval)
        }
    }, [user, activeSession, autoLogoutTriggered])

    // Fetch a bill generated by kitchen/admin and show it in the preview modal
    const fetchKitchenBill = async (orderIds: string[]) => {
        try {
            let bill: any = null

            // Strategy 1: Find bill by session_id
            if (activeSession && !activeSession._virtual && activeSession.id) {
                const res = await fetch(`/api/bills/lookup?sessionId=${activeSession.id}`)
                const json = await res.json()
                if (json.success && json.data) bill = json.data
            }

            // Strategy 2: Find bill by order_id
            if (!bill) {
                const res = await fetch(`/api/bills/lookup?orderIds=${orderIds.join(',')}`)
                const json = await res.json()
                if (json.success && json.data) bill = json.data
            }

            // Strategy 3: Find most recent bill by guest_name
            if (!bill && user) {
                const res = await fetch(`/api/bills/lookup?guestName=${encodeURIComponent(user.name || '')}`)
                const json = await res.json()
                if (json.success && json.data) bill = json.data
            }

            if (bill) {
                setBillPreview({
                    id: bill.id,
                    billNumber: bill.bill_number,
                    items: (bill.bill_items || []).map((item: any) => ({
                        item_name: item.item_name || item.name || 'Item',
                        quantity: item.quantity,
                        price: item.price || item.unit_price || 0,
                        subtotal: item.subtotal || item.total_price || (item.quantity * (item.price || item.unit_price || 0))
                    })),
                    itemsTotal: bill.items_total,
                    discountAmount: bill.discount_amount || 0,
                    finalTotal: bill.final_total,
                    paymentMethod: bill.payment_method,
                    createdAt: bill.created_at,
                    sessionDetails: bill.session_details
                })
            } else {
                // No bill record found — offer logout
                const confirmed = await showConfirm(
                    'Session Complete',
                    'Your orders have been billed. Would you like to sign out?',
                    'Sign Out',
                    'Stay'
                )
                if (confirmed) {
                    clearCart()
                    logout()
                }
            }
        } catch (err) {
            console.error('Failed to fetch kitchen bill:', err)
            showSuccess('Bill Generated', 'Your bill has been processed. Logging you out...')
            clearCart()
            setTimeout(() => logout(), 2500)
        }
    }

    const handleOrderBill = (order: any) => {
        const items = (order.items || []).map((item: any) => ({
            item_name: item.menu_item?.name || 'Item',
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
        }))
        const itemsTotal = items.reduce((sum: number, i: any) => sum + i.subtotal, 0)
        setBillPreview({
            billNumber: `ORD-${order.id.slice(0, 8).toUpperCase()}`,
            items,
            itemsTotal,
            discountAmount: 0,
            finalTotal: order.total || itemsTotal,
            paymentMethod: 'cash',
            createdAt: order.created_at,
            sessionDetails: {
                guestName: user?.name || order.guest_name || 'Guest',
                numGuests: order.num_guests || 1,
                orderCount: 1,
                startedAt: order.created_at
            }
        })
    }

    const handleGetBill = async () => {
        // CASE 1: No orders placed at all
        if (orders.length === 0) {
            const confirmed = await showConfirm(
                "Leaving Ai Cavalli?",
                "You haven't placed any orders yet. Would you like to end your visit and sign out?",
                "Sign Out",
                "Stay"
            )
            if (confirmed) {
                clearCart()
                logout()
            }
            return
        }

        // CASE 2: All orders already billed — fetch existing bill and show it
        const allBilled = orders.every((o: any) => o.billed === true)
        if (allBilled) {
            const orderIds = orders.map((o: any) => o.id)
            await fetchKitchenBill(orderIds)
            return
        }

        // CASE 3: Has unbilled orders — confirm bill generation
        // Admin/Kitchen roles don't need logout warning
        const isStaffRole = user?.role === 'ADMIN' || user?.role === 'KITCHEN'
        const confirmed = await showConfirm(
            isStaffRole ? "Generate Bill?" : "Before Bill Preview",
            isStaffRole 
                ? "This will generate your bill. You can print or save it as PDF."
                : "You'll be logged out after billing and will need to start a new order next time. Continue to generate your bill preview?",
            isStaffRole ? "Get Bill" : "Continue",
            "Not Yet"
        )

        if (!confirmed) return

        setEndingSession(true)
        try {
            let data: any

            // Use session-based flow for OUTSIDER with a real guest_session
            if (activeSession && !activeSession._virtual && activeSession.id) {
                const response = await fetch('/api/bills/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: activeSession.id,
                        paymentMethod: 'cash'
                    })
                })
                data = await response.json()
            } else {
                // User-based flow for RIDER/STAFF or OUTSIDER without session
                const response = await fetch('/api/bills/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user?.id,
                        paymentMethod: 'cash'
                    })
                })
                data = await response.json()
            }

            if (data.success && data.bill) {
                // Show the bill preview modal
                setBillPreview({
                    id: data.bill.id,
                    billNumber: data.bill.billNumber,
                    items: data.bill.items || [],
                    itemsTotal: data.bill.itemsTotal,
                    discountAmount: data.bill.discountAmount,
                    finalTotal: data.bill.finalTotal,
                    paymentMethod: data.bill.paymentMethod,
                    createdAt: new Date().toISOString(),
                    sessionDetails: data.bill.sessionDetails
                })
            } else {
                showError("Bill Generation Failed", data.error || 'Unknown error')
            }
        } catch (error) {
            console.error(error)
            showError("Something Went Wrong", "Failed to generate bill. Please ask a waiter directly.")
        } finally {
            setEndingSession(false)
        }
    }

    if (loading) {
        return <Loading fullScreen message="Fetching your order status..." />
    }

    const handleBillPreviewClose = () => {
        setBillPreview(null)
        // Logout guest after viewing the bill
        if (user?.role === 'OUTSIDER') {
            clearCart()
            setTimeout(() => logout(), 500)
        }
    }

    const handlePrintComplete = () => {
        setBillPreview(null)
        setActiveSession(null)
        // Auto-logout guest after billing is complete
        if (user?.role === 'OUTSIDER') {
            clearCart()
            setTimeout(() => logout(), 500)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--background)',
            paddingBottom: '120px',
        }}>            {/* Cooldown Notification */}
            {showCooldown && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    background: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    maxWidth: '380px',
                    animation: 'slideInRight 0.3s ease-out',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '14px',
                        color: '#856404',
                    }}>
                        <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#fbbf24',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            flexShrink: 0,
                        }}>
                            ⏰
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                Order Edit Window
                            </div>
                            <div style={{ lineHeight: 1.4 }}>
                                If any order change is there, please update within  {formatCooldownTime(cooldownTime)} time
                            </div>
                        </div>
                        <button
                            onClick={handleEditOrder}
                            style={{
                                background: '#10B981',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            Edit Order
                        </button>
                    </div>
                </div>
            )}
            {/* Bill Preview Modal */}
            {billPreview && (
                <BillPreviewModal
                    bill={billPreview}
                    onClose={handleBillPreviewClose}
                    onPrintComplete={handlePrintComplete}
                    userRole={user?.role}
                />
            )}

            {/* Hero Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #8B1A1F 100%)',
                padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 4vw, 2rem)',
                paddingTop: 'clamp(2rem, 6vw, 3rem)',
                color: 'white',
                position: 'relative',
            }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', bottom: '-30px', left: '20%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ maxWidth: '500px', position: 'relative', zIndex: 1, flex: 1 }}>
                        <Link href={user ? "/home" : "/menu"} style={{ color: 'rgba(255,255,255,0.95)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'none', marginBottom: '12px' }}>
                            <ChevronLeft size={18} />
                            Back
                        </Link>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h1 style={{ margin: 0, fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', fontFamily: 'var(--font-serif)', fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>
                                {orderIdParam && !user ? 'Order Status' : 'My Orders'}
                            </h1>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                style={{
                                    background: 'rgba(255,255,255,0.15)',
                                    border: '1.5px solid rgba(255,255,255,0.25)',
                                    borderRadius: '10px',
                                    padding: '6px',
                                    cursor: refreshing ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s ease',
                                }}
                                title="Refresh orders"
                            >
                                <RefreshCw
                                    size={18}
                                    color="white"
                                    style={{
                                        animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                    }}
                                />
                            </button>
                        </div>
                        {orders.length > 0 && (
                            <p style={{ margin: '6px 0 0', opacity: 1, fontSize: '0.95rem', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                                {orders.length} order{orders.length !== 1 ? 's' : ''} &middot; ₹{orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0).toFixed(0)} total
                            </p>
                        )}
                    </div>
                    {/* Logout button in header */}
                    {user?.role === 'OUTSIDER' && (
                        <button
                            onClick={() => { clearCart(); logout() }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#EF4444',
                                color: 'white',
                                border: 'none',
                                padding: '10px 16px',
                                borderRadius: '12px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
                                position: 'relative',
                                zIndex: 2,
                            }}
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    )}
                </div>
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 1.5rem)' }}>

                {/* Status Summary Pills */}
                {orders.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '-20px',
                        marginBottom: '20px',
                        position: 'relative',
                        zIndex: 2,
                        overflowX: 'auto',
                        paddingBottom: '4px',
                    }}>
                        {[
                            { key: 'pending', label: 'Preparing', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
                            { key: 'ready', label: 'Ready', color: 'var(--primary)', bg: '#FEF2F2', icon: CheckCircle2 },
                            { key: 'completed', label: 'Done', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
                        ].map(s => {
                            const count = orders.filter((o: any) => o.status === s.key).length
                            if (count === 0) return null
                            const SIcon = s.icon
                            return (
                                <div key={s.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: s.bg,
                                    border: `1.5px solid ${s.color}20`,
                                    borderRadius: '20px',
                                    padding: '8px 14px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    color: s.color,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                }}>
                                    <SIcon size={14} />
                                    {count} {s.label}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Get The Bill Card */}
                {user && (
                    <div style={{
                        marginBottom: '24px',
                        background: orders.length > 0
                            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                            : 'white',
                        borderRadius: '20px',
                        padding: '20px',
                        color: orders.length > 0 ? 'white' : 'var(--text)',
                        boxShadow: orders.length > 0
                            ? '0 8px 24px rgba(5, 150, 105, 0.3)'
                            : '0 2px 12px rgba(0,0,0,0.06)',
                        border: orders.length > 0 ? 'none' : '1.5px solid var(--border)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {orders.length > 0 && (
                            <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', position: 'relative', zIndex: 1 }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: orders.length > 0 ? 'white' : 'var(--text)' }}>
                                    {orders.length > 0 ? 'Finalize Your Meal' : 'Ready for the Bill?'}
                                </h2>
                                <p style={{
                                    margin: '4px 0 0',
                                    fontSize: '0.8rem',
                                    color: orders.length > 0 ? 'rgba(255,255,255,0.95)' : 'var(--text-muted)',
                                    opacity: 1,
                                }}>
                                    {orders.length > 0
                                        ? 'Generate your bill and print or save as PDF'
                                        : 'Place an order first, then get your bill here'}
                                </p>
                            </div>
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                background: orders.length > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(16, 185, 129, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Receipt size={22} color={orders.length > 0 ? 'white' : '#10B981'} />
                            </div>
                        </div>
                        <button
                            onClick={handleGetBill}
                            disabled={endingSession}
                            style={{
                                width: '100%',
                                height: '48px',
                                borderRadius: '14px',
                                background: orders.length > 0 ? 'white' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: orders.length > 0 ? '#059669' : 'white',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                border: 'none',
                                cursor: endingSession ? 'not-allowed' : 'pointer',
                                letterSpacing: '0.02em',
                                transition: 'all 0.2s ease',
                                boxShadow: orders.length > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)',
                                opacity: endingSession ? 0.7 : 1,
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            {endingSession ? 'Processing...' : 'GET THE BILL'}
                        </button>
                    </div>
                )}

                {/* Orders List */}
                {orders.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {orders.map((order, index) => {
                            const statusConfig: any = {
                                pending: { icon: Clock, color: '#F59E0B', label: 'Preparing', bg: '#FFFBEB', borderColor: '#FDE68A' },
                                ready: { icon: CheckCircle2, color: 'var(--primary)', label: 'Ready to Serve', bg: '#FEF2F2', borderColor: '#FECACA' },
                                completed: { icon: CheckCircle2, color: '#10B981', label: 'Completed', bg: '#ECFDF5', borderColor: '#A7F3D0' },
                                cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled', bg: '#FEF2F2', borderColor: '#FECACA' }
                            }
                            const config = statusConfig[order.status] || statusConfig.pending
                            const StatusIcon = config.icon
                            const isExpanded = expandedOrder === order.id
                            const itemCount = order.items?.length || 0
                            const firstItem = order.notes === 'REGULAR_STAFF_MEAL' ? 'Staff Meal' : order.items?.[0]?.menu_item?.name || 'Order'
                            const summary = itemCount > 1 ? `${firstItem} +${itemCount - 1} more` : firstItem

                            return (
                                <div
                                    key={order.id}
                                    style={{
                                        background: 'white',
                                        borderRadius: '16px',
                                        border: `1.5px solid ${isExpanded ? config.borderColor : 'var(--border)'}`,
                                        boxShadow: isExpanded ? `0 4px 16px ${config.color}15` : '0 1px 4px rgba(0,0,0,0.04)',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.25s ease',
                                    }}
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                >
                                    {/* Status accent bar */}
                                    <div style={{ height: '3px', background: config.color, opacity: 0.8 }} />

                                    {/* Order header */}
                                    <div style={{
                                        padding: '14px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}>
                                        {/* Status icon with pulse for pending */}
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '10px',
                                            background: config.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            position: 'relative',
                                        }}>
                                            <StatusIcon size={18} color={config.color} />
                                            {order.status === 'pending' && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-2px',
                                                    right: '-2px',
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: '#F59E0B',
                                                    border: '2px solid white',
                                                    animation: 'pulse 2s infinite',
                                                }} />
                                            )}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.95rem',
                                                    color: 'var(--text)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '55%',
                                                }}>
                                                    {summary}
                                                </span>
                                                <span style={{
                                                    fontWeight: 800,
                                                    color: 'var(--text)',
                                                    fontSize: '1rem',
                                                    flexShrink: 0,
                                                }}>
                                                    ₹{order.total.toFixed(0)}
                                                </span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                            }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: config.color,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                }}>
                                                    {config.label}
                                                </span>
                                                <span style={{ opacity: 0.4 }}>&middot;</span>
                                                <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {order.table_name && (
                                                    <>
                                                        <span style={{ opacity: 0.4 }}>&middot;</span>
                                                        <span>{order.table_name}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronDown
                                            size={16}
                                            color="var(--text-muted)"
                                            style={{
                                                transition: 'transform 0.25s ease',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                flexShrink: 0,
                                                opacity: 0.5,
                                            }}
                                        />
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div style={{
                                            padding: '0 16px 16px',
                                            borderTop: '1px solid var(--border)',
                                        }}>
                                            <div style={{ paddingTop: '12px' }}>
                                                {/* Order ID & guests */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '12px',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-muted)',
                                                    fontWeight: 600,
                                                }}>
                                                    <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                                                    <span>{order.num_guests || 1} Guest{(order.num_guests || 1) > 1 ? 's' : ''}</span>
                                                </div>

                                                {/* Items list */}
                                                <div style={{
                                                    background: 'var(--background)',
                                                    borderRadius: '12px',
                                                    padding: '12px 14px',
                                                    border: '1px solid var(--border)',
                                                }}>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            color: 'var(--primary)',
                                                            fontWeight: 700,
                                                            fontSize: '0.9rem',
                                                        }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '8px',
                                                                background: 'rgba(var(--primary-rgb), 0.1)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}>
                                                                <Utensils size={16} />
                                                            </div>
                                                            Standard Regular Staff Meal
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {order.items?.map((item: any, i: number) => (
                                                                <div key={item.id} style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    fontSize: '0.87rem',
                                                                    paddingBottom: i < order.items.length - 1 ? '8px' : 0,
                                                                    borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none',
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{
                                                                            width: '22px',
                                                                            height: '22px',
                                                                            borderRadius: '6px',
                                                                            background: 'rgba(var(--primary-rgb), 0.08)',
                                                                            color: 'var(--primary)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 800,
                                                                            flexShrink: 0,
                                                                        }}>
                                                                            {item.quantity}
                                                                        </span>
                                                                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.menu_item?.name}</span>
                                                                    </div>
                                                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                        ₹{(item.quantity * item.price).toFixed(0)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Total row */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginTop: '10px',
                                                    padding: '8px 0 0',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 800,
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Order Total</span>
                                                    <span style={{ color: 'var(--primary)' }}>₹{order.total.toFixed(0)}</span>
                                                </div>

                                                {/* Notes */}
                                                {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                                    <div style={{
                                                        marginTop: '10px',
                                                        padding: '8px 12px',
                                                        background: '#FFFBEB',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8rem',
                                                        color: '#92400E',
                                                        fontStyle: 'italic',
                                                        border: '1px solid #FDE68A',
                                                    }}>
                                                        Note: {order.notes}
                                                    </div>
                                                )}

                                                {/* View Bill Button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleOrderBill(order) }}
                                                    style={{
                                                        width: '100%',
                                                        marginTop: '12px',
                                                        padding: '10px 0',
                                                        borderRadius: '10px',
                                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
                                                    }}
                                                >
                                                    <Receipt size={16} />
                                                    View Bill
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 24px',
                        background: 'white',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        marginTop: '20px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            background: 'var(--background)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <Package size={32} color="var(--text-muted)" strokeWidth={1.5} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 800, color: 'var(--text)' }}>No Orders Yet</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Your orders will appear here once you place them from the menu.
                        </p>
                        <Link href="/menu" style={{ textDecoration: 'none' }}>
                            <button style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '12px 32px',
                                borderRadius: '14px',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.25)',
                            }}>
                                Browse Menu
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Sign Out Button for guests */}
                {user?.role === 'OUTSIDER' && (
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <button
                            onClick={() => {
                                clearCart()
                                logout()
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'white',
                                color: '#EF4444',
                                border: '1.5px solid #FCA5A5',
                                padding: '12px 28px',
                                borderRadius: '14px',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(239,68,68,0.12)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </div>
                )}

            {/* Animations for notification and pulse */}
            <style>{`
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 480px) {
                    .cooldown-notification {
                        top: 10px !important;
                        right: 10px !important;
                        left: 10px !important;
                        max-width: none !important;
                    }
                }
            `}</style>
        </div>
    )
}
