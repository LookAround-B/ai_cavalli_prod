'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { User, Package, LogOut, MessageSquare, ShieldCheck, Utensils, Receipt, CreditCard, Clock, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Loading } from '@/components/ui/Loading'
import { useCart } from '@/lib/context/CartContext'
import { showError, showSuccess, showConfirm } from '@/components/ui/Popup'

export default function ProfilePage() {
    const { logout, user } = useAuth()
    const role = user?.role
    const { clearCart } = useCart()
    const [userDetails, setUserDetails] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(true)
    const [activeSession, setActiveSession] = useState<any>(null)
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
    const [endingSession, setEndingSession] = useState(false)

    useEffect(() => {
        if (!user) return

        // Set initial user details from context
        setUserDetails(user)

        async function fetchUserDetails() {
            try {
                const sessionToken = localStorage.getItem('session_token') || ''
                const res = await fetch('/api/users/me', {
                    headers: { 'Authorization': `Bearer ${sessionToken}` }
                })
                const json = await res.json()
                if (json.success && json.data) setUserDetails(json.data)
            } catch (e) { console.error('fetchUserDetails error:', e) }
        }

        async function fetchOrders() {
            try {
                const res = await fetch(`/api/orders?userId=${user!.id}`)
                const json = await res.json()
                if (json.success && json.data) setOrders(json.data)
            } catch (e) { console.error('fetchOrders error:', e) }
            setLoadingOrders(false)
        }

        async function fetchActiveSession() {
            try {
                if (user?.role === 'OUTSIDER') {
                    // OUTSIDER: look up guest_session by phone or userId
                    const params = new URLSearchParams()
                    const phone = userDetails?.phone || user?.phone
                    if (phone) params.set('phone', phone)
                    params.set('userId', user.id)

                    const response = await fetch(`/api/sessions/active?${params.toString()}`)
                    const data = await response.json()
                    if (data.success && data.session) {
                        setActiveSession(data.session)
                        return
                    }
                }
                // For ALL roles: set virtual session so bill button works
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            } catch (e) {
                console.error('fetchActiveSession error:', e)
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            }
        }

        fetchUserDetails()
        fetchOrders()
        fetchActiveSession()
    }, [user])

    const handleGetBill = async () => {
        // CASE 1: No orders placed
        if (orders.length === 0) {
            const confirmed = await showConfirm(
                'Leaving Ai Cavalli?',
                "You haven't placed any orders yet. Would you like to end your visit and sign out?",
                'Sign Out',
                'Stay'
            )
            if (confirmed) {
                clearCart()
                logout()
            }
            return
        }

        // CASE 2: Has orders — request bill
        // Admin/Kitchen roles don't need logout warning
        const isStaffRole = user?.role === 'ADMIN' || user?.role === 'KITCHEN'
        const confirmed = await showConfirm(
            isStaffRole ? 'Generate Bill?' : 'Before Bill Preview',
            isStaffRole
                ? 'This will generate your bill. You can print or save it as PDF.'
                : "You'll be logged out after billing and will need to start a new order next time. Continue to generate your bill preview?",
            isStaffRole ? 'Get Bill' : 'Continue',
            'Not Yet'
        )

        if (!confirmed) return

        setEndingSession(true)
        try {
            // OUTSIDER with real session: use session-based request
            if (activeSession && !activeSession._virtual && activeSession.id) {
                const response = await fetch('/api/bills/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: activeSession.id,
                        userId: user?.id
                    })
                })
                const data = await response.json()
                if (data.success) {
                    showSuccess('Bill Requested', data.message || 'A waiter will bring your bill shortly.')
                } else {
                    showError('Request Failed', data.error || 'Unknown error')
                }
            } else {
                // RIDER/STAFF: generate bill directly
                const response = await fetch('/api/bills/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user?.id,
                        paymentMethod: 'cash'
                    })
                })
                const data = await response.json()
                if (data.success) {
                    showSuccess('Bill Generated', 'Your bill has been created successfully.')
                } else {
                    showError('Bill Failed', data.error || 'Unknown error')
                }
            }
        } catch (error) {
            console.error(error)
            showError('Something Went Wrong', 'Failed to request bill. Please ask a waiter directly.')
        } finally {
            setEndingSession(false)
        }
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <PageHeader title="My Account" backHref="/home" />

            <div style={{
                background: 'var(--surface)',
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                marginBottom: 'var(--space-8)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '100px',
                    height: '100px',
                    background: 'rgba(var(--primary-rgb), 0.03)',
                    borderRadius: '50%'
                }} />

                {user ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: 'var(--radius)',
                                background: 'rgba(var(--primary-rgb), 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary)'
                            }}>
                                <User size={32} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{userDetails?.name || 'Ai Cavalli Member'}</h2>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>{role === 'OUTSIDER' ? 'GUEST' : role} ACCOUNT</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                            <div style={{ padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                                    {/* {role === 'RIDER' || role === 'STAFF' ? 'PHONE NUMBER' : 'EMAIL ADDRESS'} */}
                                    PHONE NUMBER
                                </p>
                                <p style={{ fontWeight: 700, margin: 0 }}>
                                    {/* {role === 'RIDER' || role === 'STAFF'
                                        ? (userDetails?.phone || 'Not set')
                                        : (userDetails?.email || 'Not set')} */}
                                    {userDetails?.phone}
                                </p>
                            </div>
                            <div style={{ padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>SECURITY PIN</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={16} color="#10B981" />
                                    <p style={{ fontWeight: 700, margin: 0 }}>Verified</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                            <div style={{
                                flex: '1 1 100%',
                                background: 'rgba(16, 185, 129, 0.05)',
                                padding: 'var(--space-4)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                marginBottom: 'var(--space-2)'
                            }}>
                                {/* Order Summary */}
                                {activeSession && !activeSession._virtual && (
                                    <div style={{
                                        background: 'var(--background)',
                                        padding: 'var(--space-4)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: 'var(--space-4)',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>SESSION SUMMARY</span>
                                            <span style={{ fontSize: '0.75rem', background: '#10B981', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>TABLE</p>
                                                <p style={{ fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>{activeSession.table_name}</p>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ORDERS</p>
                                                <p style={{ fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>{orders.length} placed</p>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Total</span>
                                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                    ₹{(activeSession.total_amount || orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Simple order summary for RIDER/STAFF */}
                                {activeSession?._virtual && orders.length > 0 && (
                                    <div style={{
                                        background: 'var(--background)',
                                        padding: 'var(--space-4)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: 'var(--space-4)',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>{orders.length} ORDER{orders.length !== 1 ? 'S' : ''}</span>
                                            </div>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                ₹{orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                    <Button
                                        onClick={() => window.location.href = '/home'}
                                        variant="outline"
                                        style={{
                                            flex: 1,
                                            height: '48px',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            borderColor: 'var(--primary)',
                                            color: 'var(--primary)'
                                        }}
                                    >
                                        <Utensils size={18} style={{ marginRight: '8px' }} />
                                        ORDER MORE
                                    </Button>
                                </div>

                                <Button
                                    onClick={handleGetBill}
                                    disabled={endingSession || orders.length === 0}
                                    style={{
                                        width: '100%',
                                        height: '56px',
                                        fontSize: '1.25rem',
                                        fontWeight: 900,
                                        background: orders.length === 0 ? '#ccc' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                        border: 'none',
                                        boxShadow: orders.length === 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        cursor: orders.length === 0 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <Receipt size={24} />
                                    {endingSession ? 'Requesting...' : orders.length === 0 ? 'NO ORDERS YET' : 'GET THE BILL'}
                                </Button>

                                {orders.length > 0 && (
                                    <p style={{
                                        margin: '10px 0 0 0',
                                        fontSize: '0.8rem',
                                        color: '#059669',
                                        textAlign: 'center'
                                    }}>
                                        A waiter will bring your bill to the table
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={() => window.open('https://wa.me/1234567890', '_blank')}
                                variant="outline"
                                style={{ flex: 1, minWidth: '180px', color: '#075E54', borderColor: '#075E54' }}
                            >
                                <MessageSquare size={18} style={{ marginRight: '8px' }} />
                                Contact Support
                            </Button>
                            <Button
                                onClick={() => { clearCart(); logout(); }}
                                variant="outline"
                                style={{
                                    flex: 1,
                                    minWidth: '180px',
                                    color: '#dc2626',
                                    borderColor: '#fecaca',
                                    background: '#fef2f2',
                                    fontWeight: 700,
                                }}
                            >
                                <LogOut size={18} style={{ marginRight: '8px' }} />
                                Sign Out
                            </Button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(var(--secondary-rgb), 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary)',
                            margin: '0 auto var(--space-4)'
                        }}>
                            <User size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>Guest Seeker</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                            Sign in to save your favorite dishes and view your full order history.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', maxWidth: '500px', margin: '0 auto' }}>
                            <Link href="/login" style={{ flex: 1, minWidth: '200px' }}>
                                <Button style={{ width: '100%', height: '48px' }}>Sign In / Register</Button>
                            </Link>
                            <Button
                                onClick={() => window.open('https://wa.me/1234567890', '_blank')}
                                variant="outline"
                                style={{ flex: 1, minWidth: '200px', height: '48px' }}
                            >
                                Contact Support
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <Package size={24} color="var(--primary)" />
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-serif)' }}>Order History</h2>
            </div>

            {!user ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Please sign in to view your previous orders.</p>
                </div>
            ) : loadingOrders ? (
                <div style={{ padding: 'var(--space-8)' }}><Loading /></div>
            ) : orders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {orders.map(order => {
                        const statusConfig: any = {
                            pending: { icon: Clock, color: '#F59E0B', label: 'Preparing', bg: 'rgba(245, 158, 11, 0.1)' },
                            ready: { icon: CheckCircle2, color: 'var(--primary)', label: 'Ready', bg: 'rgba(var(--primary-rgb), 0.1)' },
                            completed: { icon: CheckCircle2, color: '#10B981', label: 'Done', bg: 'rgba(16, 185, 129, 0.1)' },
                            cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.1)' }
                        }
                        const config = statusConfig[order.status] || statusConfig.pending
                        const StatusIcon = config.icon
                        const isExpanded = expandedOrder === order.id
                        const itemCount = order.items?.length || 0
                        const isStaffMeal = order.notes === 'REGULAR_STAFF_MEAL'
                        const firstItem = isStaffMeal ? 'Staff Meal' : order.items?.[0]?.menu_item?.name || 'Order'
                        const extraCount = isStaffMeal ? itemCount : (itemCount - 1)
                        const summary = extraCount > 0 ? `${firstItem} +${extraCount} more` : firstItem

                        return (
                            <div
                                key={order.id}
                                style={{
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                            >
                                {/* Compact header row */}
                                <div style={{
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <StatusIcon size={20} color={config.color} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                color: 'var(--text)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '60%'
                                            }}>
                                                {summary}
                                            </span>
                                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
                                                ₹{order.total.toFixed(0)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{
                                                fontWeight: 700,
                                                color: config.color,
                                                background: config.bg,
                                                padding: '1px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.03em'
                                            }}>
                                                {config.label}
                                            </span>
                                            <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span>•</span>
                                            <span>{order.table_name}</span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        color="var(--text-muted)"
                                        style={{
                                            transition: 'transform 0.2s',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            flexShrink: 0
                                        }}
                                    />
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 16px 14px',
                                        borderTop: '1px solid var(--border)'
                                    }}>
                                        <div style={{ padding: '12px 0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>#{order.id.slice(0, 8).toUpperCase()}</span>
                                                <span>{order.num_guests || 1} Guest{(order.num_guests || 1) > 1 ? 's' : ''}</span>
                                            </div>
                                            <div style={{
                                                background: 'var(--background)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '10px 12px',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {order.notes === 'REGULAR_STAFF_MEAL' && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: order.items?.length ? '6px' : 0, paddingBottom: order.items?.length ? '6px' : 0, borderBottom: order.items?.length ? '1px solid var(--border)' : 'none' }}>
                                                        <Utensils size={14} />
                                                        <span>Standard Regular Staff Meal</span>
                                                    </div>
                                                )}
                                                {order.items?.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {order.items?.map((item: any) => (
                                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                                                                <span>{item.quantity}x {item.menu_item?.name}</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>₹{(item.quantity * item.price).toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {order.discount_amount > 0 && (
                                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
                                                    Discount: -{order.discount_amount}%
                                                </div>
                                            )}
                                            {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    Note: {order.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No orders placed yet. Time to eat!</p>
                </div>
            )}
        </div>
    )
}


