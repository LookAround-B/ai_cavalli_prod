'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
    ChevronRight,
    LogOut,
    Volume2,
    History,
    LayoutDashboard,
    User,
    Shield,
    Info,
    Download,
    Settings,
    Users,
    Bell,
    CheckCircle2,
    Clock,
    ShoppingBag,
    Utensils,
    Printer,
    Pencil,
    Percent,
    XIcon,
    Receipt,
    BellRing,
    Plus,
    Package,
    AlertCircle,
    Timer,
    AlertTriangle,
    StopCircle,
    ChevronDown,
    Phone,
    MapPin,
    RefreshCw,
    Banknote,
    Smartphone,
    CreditCard,
    Bike,
    Briefcase
} from 'lucide-react'
import { Loading } from '@/components/ui/Loading'
import { MenuItemSelector } from '@/components/kitchen/MenuItemSelector'
import { showError, showSuccess, showConfirm, showPopup } from '@/components/ui/Popup'
import { BillPreviewModal, type BillData } from '@/components/ui/BillPreviewModal'

interface OrderItem {
    id: string
    name: string
    quantity: number
    notes?: string
    price: number
    menu_item_id?: string
    menu_item?: { id: string, name: string, category?: { name: string } }
}

interface Order {
    id: string
    user_id: string | null
    table_name: string
    guest_info: { name: string, phone: string } | null
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
    total: number
    discount_amount: number
    ready_in_minutes: number
    num_guests: number | null
    notes: string | null
    location_type: 'indoor' | 'outdoor' | null
    created_at: string
    items?: OrderItem[]
    user?: { role: string, name: string, phone: string } | null
    billed?: boolean
}

type FilterType = 'all' | 'rider' | 'staff' | 'guest'

export default function KitchenPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [completedOrders, setCompletedOrders] = useState<Order[]>([])
    const [cancelledOrders, setCancelledOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterType>('all')
    const [viewTab, setViewTab] = useState<'active' | 'completed' | 'cancelled'>('active')
    const [status, setStatus] = useState<string>('initializing')
    const [audioError, setAudioError] = useState(false)
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
    const [menuItems, setMenuItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [dailySpecials, setDailySpecials] = useState<any[]>([])
    const [generatingBill, setGeneratingBill] = useState<string | null>(null)
    const [printingBill, setPrintingBill] = useState<string | null>(null)
    const [reprintingBill, setReprintingBill] = useState<string | null>(null)
    const [billData, setBillData] = useState<any>(null)
    const [billRequests, setBillRequests] = useState<any[]>([])
    const [showMenuSelector, setShowMenuSelector] = useState(false)
    const [selectedOrderForMenu, setSelectedOrderForMenu] = useState<string | null>(null)
    const [billPreview, setBillPreview] = useState<BillData | null>(null)
    // Cooking timer state: maps orderId -> timestamp when cooking started
    // Persisted in localStorage so timers survive page reload
    const [cookingTimers, setCookingTimers] = useState<Record<string, number>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('kitchen_cooking_timers')
                if (saved) {
                    const parsed = JSON.parse(saved)
                    // Discard any timer older than 1 hour (stale from previous days)
                    const oneHourAgo = Date.now() - 60 * 60 * 1000
                    const cleaned: Record<string, number> = {}
                    for (const [id, ts] of Object.entries(parsed)) {
                        if (typeof ts === 'number' && ts > oneHourAgo) {
                            cleaned[id] = ts
                        }
                    }
                    return cleaned
                }
            } catch { }
        }
        return {}
    })
    // Elapsed seconds for each cooking order (for re-rendering the timer display)
    const [timerElapsed, setTimerElapsed] = useState<Record<string, number>>({})
    // Track which orders have already triggered the overdue alarm
    const overdueAlerted = useRef<Set<string>>(new Set())
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null)
    // Notification sound for new incoming orders
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null)
    // Track known order IDs to detect newly arrived orders
    const knownOrderIdsRef = useRef<Set<string> | null>(null)
    // Attendee assignment per order (orderId -> attendee name)
    const [orderAttendees, setOrderAttendees] = useState<Record<string, string>>({})
    const [attendeeDropdownOpen, setAttendeeDropdownOpen] = useState<string | null>(null)
    const [kitchenStaff, setKitchenStaff] = useState<{ id: string, name: string }[]>([])
    // Create order from kitchen portal
    const [showCreateOrder, setShowCreateOrder] = useState(false)
    const [newOrderName, setNewOrderName] = useState('')
    const [newOrderPhone, setNewOrderPhone] = useState('')
    const [newOrderTable, setNewOrderTable] = useState('')
    const [newOrderGuests, setNewOrderGuests] = useState(1)
    const [newOrderLocation, setNewOrderLocation] = useState<'indoor' | 'outdoor'>('indoor')
    const [newOrderItems, setNewOrderItems] = useState<{ menuItemId: string, quantity: number }[]>([])
    const [creatingOrder, setCreatingOrder] = useState(false)
    const [showNewOrderMenu, setShowNewOrderMenu] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    // Payment method per order (orderId -> selected method)
    const [orderPaymentMethods, setOrderPaymentMethods] = useState<Record<string, string>>({})
    const [paymentDropdownOpen, setPaymentDropdownOpen] = useState<string | null>(null)

    const PAYMENT_OPTIONS = [
        { value: 'cash', label: 'Cash', icon: <Banknote size={16} /> },
        { value: 'credit', label: 'Credit', icon: <CreditCard size={16} /> },
        { value: 'upi', label: 'UPI', icon: <Smartphone size={16} /> },
        { value: 'card', label: 'Card', icon: <CreditCard size={16} /> },
        { value: 'staff_payment', label: 'Staff', icon: <Briefcase size={16} /> },
        { value: 'rider_payment', label: 'Rider Payment', icon: <Bike size={16} /> },
        { value: 'silva', label: 'Silva', icon: <User size={16} /> },
        { value: 'chandar', label: 'Chandar', icon: <User size={16} /> },
    ]

    const { user, logout, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const fetchOrders = async () => {
        try {
            const res = await fetch('/api/orders?status=pending,preparing,ready&all=true')
            const json = await res.json()
            if (json.success && json.data) {
                // Sort descending by created_at (newest first)
                const sorted = json.data.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )
                setOrders(sorted)
                // Initialize payment dropdown for billed orders
                const billedPayments: Record<string, string> = {}
                sorted.forEach((o: any) => {
                    if (o.billed && o.bill_payment_method) billedPayments[o.id] = o.bill_payment_method
                })
                if (Object.keys(billedPayments).length > 0) {
                    setOrderPaymentMethods(prev => ({ ...billedPayments, ...prev }))
                }

                // Detect new orders and play notification sound
                const incomingIds = new Set<string>(sorted.map((o: any) => o.id as string))
                if (knownOrderIdsRef.current === null) {
                    // First load — just record the known IDs, don't play sound
                } else {
                    const hasNew = sorted.some((o: any) => !knownOrderIdsRef.current!.has(o.id))
                    if (hasNew && notificationAudioRef.current) {
                        notificationAudioRef.current.currentTime = 0
                        notificationAudioRef.current.play().catch(() => { })
                    }
                }
                knownOrderIdsRef.current = incomingIds
            }
        } catch (e) { console.error('fetchOrders error:', e) }
        setLoading(false)
    }

    const fetchCompletedOrders = async () => {
        try {
            const res = await fetch('/api/orders?status=completed&all=true&limit=30')
            const json = await res.json()
            if (json.success && json.data) {
                setCompletedOrders(json.data)
                // Initialize payment dropdown for billed completed orders
                const billedPayments: Record<string, string> = {}
                json.data.forEach((o: any) => {
                    if (o.billed && o.bill_payment_method) billedPayments[o.id] = o.bill_payment_method
                })
                if (Object.keys(billedPayments).length > 0) {
                    setOrderPaymentMethods(prev => ({ ...billedPayments, ...prev }))
                }
            }
        } catch (e) { console.error('fetchCompletedOrders error:', e) }
    }

    const fetchCancelledOrders = async () => {
        try {
            const res = await fetch('/api/orders?status=cancelled&all=true&limit=30')
            const json = await res.json()
            if (json.success && json.data) setCancelledOrders(json.data)
        } catch (e) { console.error('fetchCancelledOrders error:', e) }
    }

    const fetchSingleOrder = async (orderId: string) => {
        try {
            const res = await fetch(`/api/orders?orderId=${orderId}`)
            const json = await res.json()
            return json.success && json.data?.[0] ? json.data[0] : null
        } catch (e) {
            console.error('fetchSingleOrder error:', e)
            return null
        }
    }

    // Auth Guard - Allow staff, kitchen_manager, and admin
    useEffect(() => {
        if (!authLoading && (!user || (user.role !== 'KITCHEN' && user.role !== 'ADMIN'))) {
            router.push('/home')
        }
    }, [user, authLoading, router])

    // Subscription & Init
    useEffect(() => {
        fetchOrders()
        fetchCompletedOrders()
        setStatus('SUBSCRIBED')

        // Auto-poll for new orders every 15 seconds
        const pollInterval = setInterval(() => {
            fetchOrders()
            fetchCompletedOrders()
            // Refresh bill requests too
            fetch('/api/kitchen/bill-requests')
                .then(r => r.json())
                .then(json => { if (json.success) setBillRequests(json.data || []) })
                .catch(() => { })
        }, 15000)

        return () => clearInterval(pollInterval)
    }, [])

    // Fetch menu items and categories
    useEffect(() => {
        async function fetchMenuData() {
            try {
                const res = await fetch('/api/menu')
                const json = await res.json()
                if (json.success) {
                    const fetchedItems = json.data?.menuItems || []
                    const fetchedCategories = json.data?.categories || []
                    const specials = json.data?.specials || []

                    // Merge daily special items that aren't already in the menu items list
                    // (specials may reference items that are unavailable in regular menu)
                    const itemIds = new Set(fetchedItems.map((i: any) => i.id))
                    const specialItems = specials
                        .filter((s: any) => s.menu_item && !itemIds.has(s.menu_item.id))
                        .map((s: any) => s.menu_item)
                    const allItems = [...fetchedItems, ...specialItems]

                    setMenuItems(allItems)
                    setCategories(fetchedCategories)
                    setDailySpecials(specials)
                }
            } catch (e) { console.error('fetchMenuData error:', e) }
        }
        fetchMenuData()
    }, [])

    // Fetch and load bill requests on mount
    useEffect(() => {
        async function fetchBillRequests() {
            try {
                const res = await fetch('/api/kitchen/bill-requests')
                const json = await res.json()
                if (json.success) setBillRequests(json.data || [])
            } catch (e) { console.error('fetchBillRequests error:', e) }
        }

        fetchBillRequests()
    }, [])

    // Manual refresh handler for kitchen board
    const handleRefreshAll = useCallback(async () => {
        setRefreshing(true)
        try {
            await Promise.all([
                fetchOrders(),
                fetchCompletedOrders(),
                (async () => {
                    const res = await fetch('/api/kitchen/bill-requests')
                    const json = await res.json()
                    if (json.success) setBillRequests(json.data || [])
                })()
            ])
        } catch (e) { console.error('Refresh error:', e) }
        setRefreshing(false)
    }, [])

    // ----- Persist cooking timers to localStorage -----
    useEffect(() => {
        try {
            localStorage.setItem('kitchen_cooking_timers', JSON.stringify(cookingTimers))
        } catch { }
    }, [cookingTimers])

    // ----- Cooking Timer: tick every second & alarm when overdue -----
    const COOKING_TIME_LIMIT = 30 * 60 // 30 minutes in seconds

    useEffect(() => {
        // Preload alarm sound
        alarmAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3')
        alarmAudioRef.current.loop = true
        alarmAudioRef.current.load()
        // Preload new-order notification sound
        notificationAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        notificationAudioRef.current.load()
    }, [])

    // Tick every second to update elapsed times and check for overdue orders
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now()
            setCookingTimers(prev => {
                const newElapsed: Record<string, number> = {}
                for (const [orderId, startTime] of Object.entries(prev)) {
                    const elapsed = Math.floor((now - startTime) / 1000)
                    newElapsed[orderId] = elapsed

                    // Check if overdue (30 min) and hasn't been alerted yet
                    if (elapsed >= COOKING_TIME_LIMIT && !overdueAlerted.current.has(orderId)) {
                        overdueAlerted.current.add(orderId)
                        // Play alarm sound (silently catch if user hasn't interacted yet)
                        if (alarmAudioRef.current) {
                            alarmAudioRef.current.currentTime = 0
                            alarmAudioRef.current.play().catch(() => { })
                            // Stop alarm after 10 seconds
                            setTimeout(() => {
                                alarmAudioRef.current?.pause()
                                if (alarmAudioRef.current) alarmAudioRef.current.currentTime = 0
                            }, 10000)
                        }
                        // Browser notification
                        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                            new Notification('⏰ Order Overdue!', {
                                body: `Order #${orderId.slice(0, 8).toUpperCase()} has exceeded 30 minutes!`,
                                icon: '/favicon.ico',
                                requireInteraction: true
                            })
                        }
                    }
                }
                setTimerElapsed(newElapsed)
                return prev
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [])

    // Clean up timers when orders are completed/cancelled/removed
    useEffect(() => {
        // Skip cleanup until the initial orders fetch has completed.
        // Without this guard, the effect runs against orders=[] on mount and
        // deletes all localStorage-persisted timers before real data arrives.
        if (loading) return

        setCookingTimers(prev => {
            const activeOrderIds = new Set(orders.filter(o => o.status === 'preparing').map(o => o.id))
            const updated = { ...prev }
            let changed = false
            for (const orderId of Object.keys(updated)) {
                if (!activeOrderIds.has(orderId)) {
                    delete updated[orderId]
                    overdueAlerted.current.delete(orderId)
                    changed = true
                }
            }
            // Auto-start timers for orders already in 'preparing' that don't have a timer yet
            // Use Date.now() — we don't know when cooking actually started after a reload
            for (const order of orders) {
                if (order.status === 'preparing' && !updated[order.id]) {
                    updated[order.id] = Date.now()
                    changed = true
                }
            }
            return changed ? updated : prev
        })
    }, [orders, loading])

    // Start cooking timer when status changes to preparing
    const startCookingTimer = useCallback((orderId: string) => {
        setCookingTimers(prev => ({ ...prev, [orderId]: Date.now() }))
    }, [])

    // Stop cooking timer (when order is handed over)
    const stopCookingTimer = useCallback((orderId: string) => {
        setCookingTimers(prev => {
            const updated = { ...prev }
            delete updated[orderId]
            return updated
        })
        overdueAlerted.current.delete(orderId)
        // Stop alarm if it's currently playing
        if (alarmAudioRef.current) {
            alarmAudioRef.current.pause()
            alarmAudioRef.current.currentTime = 0
        }
    }, [])

    // Format elapsed seconds to MM:SS
    const formatTimer = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60)
        const secs = totalSeconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // Helper: is an order overdue?
    const isOrderOverdue = (orderId: string) => (timerElapsed[orderId] || 0) >= COOKING_TIME_LIMIT

    // Set allowed staff for attendee dropdown
    useEffect(() => {
        setKitchenStaff([
            { id: '1', name: 'Sonia' },
            { id: '2', name: 'Anand' },
            { id: '3', name: 'Others' }
        ])
    }, [])

    // Cancel order
    async function cancelOrder(orderId: string) {
        const ok = await showConfirm('Cancel Order', 'Are you sure you want to cancel this order? This cannot be undone.')
        if (!ok) return
        try {
            const res = await fetch('/api/orders/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: 'cancelled' })
            })
            const json = await res.json()
            if (!json.success) {
                showError('Cancel Failed', 'Failed to cancel order')
            } else {
                setOrders(prev => prev.filter(o => o.id !== orderId))
                stopCookingTimer(orderId)
                showSuccess('Order Cancelled', 'The order has been cancelled.')
            }
        } catch (e) {
            showError('Cancel Failed', 'Failed to cancel order')
        }
    }

    // Create order from kitchen portal
    async function handleCreateKitchenOrder() {
        if (!newOrderName.trim()) {
            showError('Missing Info', 'Please enter the customer name.')
            return
        }
        if (!newOrderPhone.trim()) {
            showError('Missing Info', 'Please enter the phone number.')
            return
        }
        if (!newOrderTable.trim()) {
            showError('Missing Info', 'Please enter a table name.')
            return
        }
        if (newOrderItems.length === 0) {
            showError('Missing Items', 'Please add at least one item to the order.')
            return
        }

        setCreatingOrder(true)
        try {
            const sessionToken = localStorage.getItem('session_token') || ''
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                    userId: user?.id,
                    phone: newOrderPhone,
                    items: newOrderItems.map(item => ({ itemId: item.menuItemId, quantity: item.quantity })),
                    tableName: newOrderTable,
                    numGuests: newOrderGuests,
                    locationType: newOrderLocation,
                    notes: `KITCHEN_ORDER | ${newOrderName} | ${newOrderPhone}`,
                })
            })
            const data = await response.json()
            if (data.success) {
                showSuccess('Order Created', `Order #${data.orderId?.slice(0, 8).toUpperCase()} created successfully!`)
                // Reset form
                setNewOrderName('')
                setNewOrderPhone('')
                setNewOrderTable('')
                setNewOrderGuests(1)
                setNewOrderLocation('indoor')
                setNewOrderItems([])
                setShowCreateOrder(false)
                await fetchOrders()
            } else {
                showError('Create Failed', data.error || 'Failed to create order')
            }
        } catch (err) {
            showError('Error', 'Failed to create order')
        } finally {
            setCreatingOrder(false)
        }
    }

    // Handle generate session bill
    const handleGenerateSessionBill = async (sessionId: string) => {
        setGeneratingBill(sessionId)
        try {
            const selectedPayment = orderPaymentMethods[sessionId] || 'cash'
            const response = await fetch('/api/bills/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, paymentMethod: selectedPayment })
            })
            const data = await response.json()
            if (data.success) {
                setBillData(data.bill)
                setBillRequests(prev => prev.filter(r => r.id !== sessionId))
                // Show bill preview modal
                if (data.bill) {
                    setBillPreview({
                        id: data.bill.id,
                        billNumber: data.bill.billNumber || data.bill.bill_number || '',
                        tableName: data.bill.sessionDetails?.tableName || data.bill.tableName || '',
                        guestName: data.bill.sessionDetails?.guestName || '',
                        items: (data.bill.items || []).map((i: any) => ({
                            item_name: i.item_name || i.itemName || i.name || '',
                            quantity: i.quantity,
                            price: Number(i.price),
                            subtotal: Number(i.subtotal) || (i.quantity * Number(i.price))
                        })),
                        itemsTotal: Number(data.bill.itemsTotal || data.bill.items_total || 0),
                        discountAmount: Number(data.bill.discountAmount || data.bill.discount_amount || 0),
                        gstAmount: Number(data.bill.gstAmount || data.bill.gst_amount || 0),
                        finalTotal: Number(data.bill.finalTotal || data.bill.final_total || 0),
                        paymentMethod: formatPaymentMethod(data.bill.paymentMethod || selectedPayment),
                        createdAt: data.bill.createdAt || new Date().toISOString(),
                        sessionDetails: data.bill.sessionDetails,
                        attendedBy: orderAttendees[data.bill.id] || orderAttendees[sessionId] || ''
                    })
                }
                showSuccess('Bill Generated', `Bill ${data.bill.billNumber || data.bill.bill_number} — ₹${data.bill.finalTotal || data.bill.final_total}`)
            } else {
                showError('Bill Failed', data.error || 'Failed to generate bill')
            }
        } catch (err) {
            showError('Error', 'Failed to generate bill')
        } finally {
            setGeneratingBill(null)
        }
    }

    // Dismiss bill request (mark as handled without generating bill)
    const dismissBillRequest = (sessionId: string) => {
        setBillRequests(prev => prev.filter(r => r.id !== sessionId))
    }

    // Helper: Parse kitchen order notes to get customer name
    function getKitchenOrderName(order: Order): string | null {
        if (order.notes && order.notes.startsWith('KITCHEN_ORDER')) {
            const parts = order.notes.split('|').map(s => s.trim())
            if (parts.length >= 2 && parts[1]) return parts[1]
        }
        return null
    }

    // Helper: Get display name for an order (respects kitchen orders)
    function getOrderDisplayName(order: Order): string {
        return getKitchenOrderName(order) || order.guest_info?.name || order.user?.name || 'Walk-in'
    }

    // Helper: Format payment method for display
    function formatPaymentMethod(method: string): string {
        const labels: Record<string, string> = {
            cash: 'Cash',
            credit: 'Credit',
            upi: 'UPI',
            card: 'Card',
            staff_payment: 'Staff',
            rider_payment: 'Rider Payment',
            silva: 'Silva',
            chandar: 'Chandar'
        }
        return labels[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }

    const filteredOrders = useMemo(() => {
        if (filter === 'all') return orders
        return orders.filter(order => {
            if (filter === 'guest') return order.guest_info !== null || order.user?.role === 'OUTSIDER'
            if (filter === 'rider') return order.user_id !== null && order.user?.role === 'RIDER'
            if (filter === 'staff') return order.user_id !== null && order.user?.role === 'STAFF'
            return true
        })
    }, [orders, filter])

    async function updateStatus(orderId: string, newStatus: string) {
        try {
            const res = await fetch('/api/orders/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus })
            })
            const json = await res.json()
            if (!json.success) {
                showError('Update Failed', 'Failed to update order status')
            } else {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o))
                if (newStatus === 'preparing') startCookingTimer(orderId)
                if (newStatus === 'ready' || newStatus === 'completed' || newStatus === 'cancelled') stopCookingTimer(orderId)
            }
        } catch (e) {
            showError('Update Failed', 'Failed to update order status')
        }
    }

    async function updateDiscount(orderId: string, amount: number) {
        try {
            const res = await fetch('/api/orders/discount', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, discountAmount: amount })
            })
            const json = await res.json()
            if (!json.success) {
                showError('Discount Failed', 'Failed to apply discount')
            } else {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, discount_amount: amount } : o))
            }
        } catch (e) {
            showError('Discount Failed', 'Failed to apply discount')
        }
    }

    async function updateItemQuantity(orderItemId: string, orderId: string, newQuantity: number) {
        if (newQuantity < 1) return
        try {
            const res = await fetch('/api/orders/items', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderItemId, quantity: newQuantity })
            })
            const json = await res.json()
            if (!json.success) showError('Update Failed', json.error || 'Failed to update quantity')
            else await fetchOrders()
        } catch (e) { showError('Update Failed', 'Failed to update quantity') }
    }

    async function deleteOrderItem(orderItemId: string, orderId: string) {
        const ok = await showConfirm('Delete Item', 'Remove this item from the order?')
        if (!ok) return
        try {
            const res = await fetch(`/api/orders/items?id=${orderItemId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!json.success) showError('Delete Failed', json.error || 'Failed to delete item')
            else await fetchOrders()
        } catch (e) { showError('Delete Failed', 'Failed to delete item') }
    }

    async function handleGenerateBill(orderId: string, paymentMethod: string = 'cash') {
        const order = [...orders, ...completedOrders].find(o => o.id === orderId)
        if (!order || !order.items?.length || order.billed) return
        setGeneratingBill(orderId)
        try {
            const sessionToken = localStorage.getItem('session_token') || ''
            const response = await fetch('/api/bills/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ orderId, paymentMethod, userId: user?.id })
            })
            const data = await response.json()
            if (data.success) {
                setBillData(data.bill)
                await fetchOrders()
                await fetchCompletedOrders()
                // Show bill preview modal
                setBillPreview({
                    id: data.bill.id,
                    billNumber: data.bill.billNumber || '',
                    tableName: data.bill.orderDetails?.tableName || order.table_name || '',
                    guestName: data.bill.guestName || getOrderDisplayName(order),
                    items: (data.bill.items || []).map((i: any) => ({
                        item_name: i.item_name || i.itemName || i.name || '',
                        quantity: i.quantity,
                        price: Number(i.price),
                        subtotal: Number(i.subtotal) || (i.quantity * Number(i.price))
                    })),
                    itemsTotal: Number(data.bill.itemsTotal || data.bill.items_total || 0),
                    discountAmount: Number(data.bill.discountAmount || data.bill.discount_amount || 0),
                    gstAmount: Number(data.bill.gstAmount || data.bill.gst_amount || 0),
                    finalTotal: Number(data.bill.finalTotal || data.bill.final_total || 0),
                    paymentMethod: formatPaymentMethod(data.bill.paymentMethod || data.bill.payment_method || paymentMethod),
                    createdAt: data.bill.createdAt || data.bill.created_at || data.bill.orderDetails?.createdAt,
                    attendedBy: orderAttendees[orderId] || ''
                })
            } else {
                showError('Bill Failed', data.error || 'Failed to generate bill')
            }
        } catch (error) {
            console.error(error)
            showError('Error', 'Failed to generate bill')
        } finally { setGeneratingBill(null) }
    }

    async function handlePrintBill(billId: string) {
        setPrintingBill(billId)
        try {
            const sessionToken = localStorage.getItem('session_token') || ''
            const response = await fetch('/api/bills/print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({ billId, userId: user?.id })
            })
            const data = await response.json()
            if (data.success) {
                const printWindow = window.open('', '_blank', 'width=400,height=600')
                if (printWindow) {
                    // Use styled HTML (not plain text) for dark thermal output
                    printWindow.document.write(data.printData.html || `<html><body><pre style="font-family:Arial,sans-serif;font-size:16px;font-weight:900;color:#000;">${data.printData.text}</pre></body></html>`)
                    printWindow.document.close()
                    printWindow.onload = () => { printWindow.focus(); printWindow.print() }
                }
            } else {
                showError('Print Failed', data.error || 'Failed to print bill')
            }
        } catch (error) {
            console.error(error)
            showError('Error', 'Failed to print bill')
        } finally { setPrintingBill(null) }
    }

    async function handleReprintBill(orderId: string) {
        setReprintingBill(orderId)
        try {
            // Fetch the bill associated with this order
            const res = await fetch(`/api/bills/lookup?orderId=${orderId}`)
            const json = await res.json()

            if (!json.success || !json.data) {
                showError('Bill Not Found', 'Could not find a bill for this order.')
                return
            }

            const bill = json.data
            const order = [...orders, ...completedOrders].find(o => o.id === orderId)

            // Use the currently selected payment method from the dropdown (if changed)
            const selectedPayment = orderPaymentMethods[orderId]
            const currentBillPayment = bill.payment_method || bill.paymentMethod || 'cash'
            const effectivePayment = selectedPayment || currentBillPayment

            // If user picked a different payment, persist it to the DB
            if (selectedPayment && selectedPayment !== currentBillPayment && bill.id) {
                fetch('/api/bills/generate', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ billId: bill.id, paymentMethod: selectedPayment })
                }).catch(err => console.error('Failed to update payment method:', err))
            }

            // Show bill preview modal for reprinting — always use the dropdown value
            setBillPreview({
                id: bill.id,
                billNumber: bill.bill_number || '',
                tableName: bill.table_name || order?.table_name || '',
                guestName: bill.guest_name || (order ? getOrderDisplayName(order) : ''),
                items: (bill.bill_items || []).map((i: any) => ({
                    item_name: i.item_name || i.itemName || i.name || '',
                    quantity: i.quantity,
                    price: Number(i.price || 0),
                    subtotal: Number(i.subtotal) || (i.quantity * Number(i.price || 0))
                })),
                itemsTotal: Number(bill.items_total || bill.itemsTotal || 0),
                discountAmount: Number(bill.discount_amount || bill.discountAmount || 0),
                gstAmount: Number(bill.gst_amount || bill.gstAmount || 0),
                finalTotal: Number(bill.final_total || bill.finalTotal || 0),
                paymentMethod: formatPaymentMethod(selectedPayment || bill.payment_method || bill.paymentMethod || 'cash'),
                createdAt: bill.created_at || bill.createdAt || order?.created_at,
                attendedBy: orderAttendees[orderId] || ''
            })
        } catch (error) {
            console.error(error)
            showError('Error', 'Failed to fetch bill for reprinting')
        } finally {
            setReprintingBill(null)
        }
    }

    async function addItemToOrder(orderId: string, menuItemId: string) {
        const menuItem = menuItems.find(m => m.id === menuItemId)
        if (!menuItem) return
        // Check if order already has this item — increment instead of creating duplicate
        const order = orders.find(o => o.id === orderId)
        const existingItem = order?.items?.find((i: any) => i.menu_item_id === menuItemId)
        if (existingItem) {
            return updateItemQuantity(existingItem.id, orderId, existingItem.quantity + 1)
        }
        try {
            const res = await fetch('/api/orders/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, menuItemId, quantity: 1, price: menuItem.price })
            })
            const json = await res.json()
            if (!json.success) showError('Add Failed', json.error || 'Failed to add item')
            else await fetchOrders()
        } catch (e) { showError('Add Failed', 'Failed to add item') }
    }

    function quickAddSpecialToOrder(specialItemId: string) {
        const existing = newOrderItems.find(item => item.menuItemId === specialItemId)
        if (existing) {
            setNewOrderItems(newOrderItems.map(item =>
                item.menuItemId === specialItemId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            setNewOrderItems([...newOrderItems, { menuItemId: specialItemId, quantity: 1 }])
        }
        showSuccess('Added to Order', `Item added to walk-in order`)
    }

    const getOrderTypeBadge = (order: Order) => {
        if (order.guest_info || order.user?.role === 'OUTSIDER') return { label: 'GUEST', color: '#9333ea', icon: User }
        if (order.user?.role === 'RIDER') return { label: 'RIDER', color: '#2563eb', icon: LayoutDashboard }
        if (order.user?.role === 'STAFF') {
            if (order.notes === 'REGULAR_STAFF_MEAL') return { label: 'REGULAR MEAL', color: '#3B82F6', icon: Shield }
            return { label: 'STAFF', color: '#059669', icon: Shield }
        }
        if (order.user?.role === 'KITCHEN') {
            if (order.notes === 'REGULAR_STAFF_MEAL') return { label: 'REGULAR MEAL', color: '#3B82F6', icon: Shield }
            return { label: 'STAFF', color: '#059669', icon: Shield }
        }
        return { label: 'UNKNOWN', color: '#6b7280', icon: Info }
    }

    if (authLoading || loading) return <Loading fullScreen message="Syncing with Kitchen..." />
    if (!user || (user.role !== 'KITCHEN' && user.role !== 'ADMIN')) return null

    return (
        <div className="fade-in" style={{ padding: 'var(--space-4)', background: 'var(--background)', minHeight: '100vh' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-6)',
                background: 'white',
                padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(1rem, 3vw, 2rem)',
                borderRadius: 'clamp(12px, 3vw, 24px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                flexWrap: 'wrap',
                gap: 'clamp(0.75rem, 2vw, 1.25rem)',
                position: 'sticky',
                top: '0',
                zIndex: 50,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: status === 'SUBSCRIBED' ? '#10B981' : '#EF4444',
                            boxShadow: status === 'SUBSCRIBED' ? '0 0 10px #10B981' : 'none',
                            animation: status === 'SUBSCRIBED' ? 'pulse 2s infinite' : 'none'
                        }} />
                        <h2 style={{
                            margin: 0,
                            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
                            fontWeight: '800',
                            color: 'var(--text)',
                            letterSpacing: '-0.02em'
                        }}>Kitchen Board</h2>
                        <button
                            onClick={handleRefreshAll}
                            disabled={refreshing}
                            style={{
                                background: 'rgba(var(--primary-rgb), 0.08)',
                                border: '1.5px solid rgba(var(--primary-rgb), 0.2)',
                                borderRadius: '10px',
                                padding: '8px',
                                cursor: refreshing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                minWidth: '44px',
                                minHeight: '44px',
                            }}
                            title="Refresh all data"
                        >
                            <RefreshCw
                                size={18}
                                color="var(--primary)"
                                style={{
                                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                                }}
                            />
                        </button>
                    </div>

                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Button
                        onClick={() => setShowCreateOrder(true)}
                        size="sm"
                        style={{
                            height: '44px',
                            padding: '0 20px',
                            borderRadius: '22px',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #8B1A1F 100%)',
                            border: 'none',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(192, 39, 45, 0.3)'
                        }}
                    >
                        <Plus size={18} strokeWidth={3} />
                        Create Order
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
                            audio.play().then(() => setAudioError(false))
                            if ('Notification' in window) Notification.requestPermission()
                        }}
                        style={{
                            width: '44px',
                            height: '44px',
                            padding: 0,
                            borderRadius: '50%',
                            background: 'rgba(var(--primary-rgb), 0.05)',
                            color: 'var(--primary)'
                        }}
                    >
                        <Volume2 size={20} />
                    </Button>
                </div>
            </div>

            {audioError && (
                <div style={{
                    background: '#FFF7ED',
                    color: '#C2410C',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #FFEDD5',
                    marginBottom: 'var(--space-4)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <Info size={16} />
                    <strong>Alert:</strong> Audio notifications are muted. Click the speaker icon to enable.
                </div>
            )}

            {/* Bill Requests Notification Panel */}
            {billRequests.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    padding: 'var(--space-4)',
                    borderRadius: '16px',
                    marginBottom: 'var(--space-4)',
                    boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <BellRing size={24} color="white" />
                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 800 }}>
                            BILL REQUESTS ({billRequests.length})
                        </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {billRequests.map((req) => (
                            <div key={req.id} style={{
                                background: 'white',
                                padding: '16px',
                                borderRadius: '12px',
                                minWidth: '250px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                                            {req.table_name}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {req.guest_name} • {req.num_guests} guests
                                        </p>
                                    </div>
                                    <Receipt size={20} color="#10B981" />
                                </div>
                                <p style={{ margin: '8px 0', fontSize: '0.8rem', color: '#666' }}>
                                    Requested {req.bill_requested_at ? new Date(req.bill_requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                                </p>
                                {/* Payment Method Dropdown for Session Bills */}
                                <div style={{ margin: '8px 0', position: 'relative' }}>
                                    <select
                                        value={orderPaymentMethods[req.id] || 'cash'}
                                        onChange={(e) => setOrderPaymentMethods(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            paddingRight: '32px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border)',
                                            background: 'var(--surface)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                            fontFamily: 'inherit',
                                            color: 'var(--text)',
                                            outline: 'none',
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--primary)'
                                            e.target.style.boxShadow = '0 0 0 2px rgba(192, 39, 45, 0.1)'
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'var(--border)'
                                            e.target.style.boxShadow = 'none'
                                        }}
                                    >
                                        {PAYMENT_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <div style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        pointerEvents: 'none',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}>
                                        <ChevronDown size={14} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <Button
                                        onClick={() => handleGenerateSessionBill(req.id)}
                                        disabled={generatingBill === req.id}
                                        size="sm"
                                        style={{
                                            flex: 1,
                                            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: 700
                                        }}
                                    >
                                        <Printer size={14} style={{ marginRight: '6px' }} />
                                        {generatingBill === req.id ? 'Generating...' : 'Generate Bill'}
                                    </Button>
                                    <Button
                                        onClick={() => dismissBillRequest(req.id)}
                                        variant="outline"
                                        size="sm"
                                        style={{ borderColor: '#ccc' }}
                                    >
                                        <XIcon size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Daily Specials Section */}
            {/* {dailySpecials.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    padding: 'var(--space-4)',
                    borderRadius: '16px',
                    marginBottom: 'var(--space-6)',
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
                    border: '2px solid #FCD34D'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '1.75rem' }}>⭐</span>
                        <h3 style={{ margin: 0, color: '#92400E', fontSize: '1.25rem', fontWeight: 800 }}>
                            Today's Specials
                        </h3>
                        <a href="/kitchen/specials" style={{ marginLeft: 'auto', padding: '8px 12px', background: 'rgba(255,255,255,0.3)', color: '#78350F', textDecoration: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#F59E0B' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#78350F' }}>
                            MANAGE →
                        </a>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '12px' }}>
                        {dailySpecials.map((special) => (
                            <div key={special.id} style={{
                                background: 'white',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '2px solid #FCD34D',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                            }}>
                                {special.menu_item.image_url && (
                                    <div style={{
                                        width: '100%',
                                        height: '120px',
                                        borderRadius: '8px',
                                        background: '#F3F4F6',
                                        backgroundImage: `url(${special.menu_item.image_url})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        border: '1px solid #E5E7EB'
                                    }} />
                                )}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px', marginBottom: '4px' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1F2937' }}>{special.menu_item.name}</h4>
                                        <span style={{ padding: '4px 8px', background: '#FEF3C7', color: '#92400E', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {special.period.toUpperCase()}
                                        </span>
                                    </div>
                                    {special.menu_item.description && <p style={{ margin: '4px 0', fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.4 }}>{special.menu_item.description}</p>}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)' }}>₹{special.menu_item.price}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )} */}

            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{
                    display: 'flex',
                    background: 'var(--surface)',
                    padding: '4px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <button
                        onClick={() => setViewTab('active')}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-xl)',
                            border: 'none',
                            background: viewTab === 'active' ? 'var(--primary)' : 'transparent',
                            color: viewTab === 'active' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Active <span style={{ opacity: 0.8, fontSize: '0.8em', background: viewTab === 'active' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '10px' }}>{orders.length}</span>
                    </button>
                    <button
                        onClick={() => {
                            setViewTab('completed')
                            fetchCompletedOrders()
                        }}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-xl)',
                            border: 'none',
                            background: viewTab === 'completed' ? 'var(--primary)' : 'transparent',
                            color: viewTab === 'completed' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        History <History size={16} />
                    </button>
                    <button
                        onClick={() => {
                            setViewTab('cancelled')
                            fetchCancelledOrders()
                        }}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: 'var(--radius-xl)',
                            border: 'none',
                            background: viewTab === 'cancelled' ? '#DC2626' : 'transparent',
                            color: viewTab === 'cancelled' ? 'white' : 'var(--text-muted)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        Cancelled <XIcon size={16} />
                    </button>
                </div>

                {viewTab === 'active' && (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        {(['all', 'rider', 'staff', 'guest'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border)',
                                    background: filter === f ? 'var(--text)' : 'var(--surface)',
                                    color: filter === f ? 'white' : 'var(--text-muted)',
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    transition: 'var(--transition)',
                                    textTransform: 'capitalize',
                                    boxShadow: filter === f ? 'var(--shadow-md)' : 'var(--shadow-sm)'
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                gap: 'clamp(1rem, 2vw, 1.5rem)',
                alignItems: 'stretch'
            }}>
                {(viewTab === 'completed' ? completedOrders : viewTab === 'cancelled' ? cancelledOrders : filteredOrders).length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-12)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>No orders found in this category.</p>
                    </div>
                ) : (
                    (viewTab === 'completed' ? completedOrders : viewTab === 'cancelled' ? cancelledOrders : filteredOrders).map(order => {
                        const badge = getOrderTypeBadge(order)
                        const TypeIcon = badge.icon

                        const statusColors: any = {
                            pending: { color: '#F59E0B', label: 'NEW ORDER', pulse: true },
                            preparing: { color: '#3B82F6', label: 'PREPARING', pulse: false },
                            ready: { color: '#10B981', label: 'READY', pulse: false },
                            completed: { color: 'var(--text-muted)', label: 'COMPLETED', pulse: false },
                            cancelled: { color: '#DC2626', label: 'CANCELLED', pulse: false }
                        }
                        const sc = statusColors[order.status] || statusColors.pending

                        return (
                            <div key={order.id} className="fade-in" style={{
                                background: 'var(--surface)',
                                borderRadius: '16px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                overflow: 'hidden',
                                border: `2px solid ${sc.color}20`,
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                minHeight: '580px',
                                height: 'fit-content'
                            }}>
                                {/* Status Bar */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${sc.color} 0%, ${sc.color}dd 100%)`,
                                    padding: '12px 20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'white', letterSpacing: '0.08em' }}>{sc.label}</span>
                                        {sc.pulse && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white', animation: 'pulse 1.5s infinite', boxShadow: '0 0 8px white' }} />}
                                    </div>
                                    <span style={{ fontWeight: 900, fontSize: '1.25rem', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {/* Cooking Timer Display */}
                                {order.status === 'preparing' && cookingTimers[order.id] && (
                                    (() => {
                                        const elapsed = timerElapsed[order.id] || 0
                                        const remaining = Math.max(0, COOKING_TIME_LIMIT - elapsed)
                                        const overdue = elapsed >= COOKING_TIME_LIMIT
                                        const warningZone = remaining <= 5 * 60 && !overdue // last 5 minutes
                                        return (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                padding: '10px 20px',
                                                background: overdue
                                                    ? 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)'
                                                    : warningZone
                                                        ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                                                        : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                                                animation: overdue ? 'timerPulse 1s infinite' : 'none',
                                                transition: 'background 0.5s ease'
                                            }}>
                                                {overdue ? (
                                                    <AlertTriangle size={18} color="white" style={{ animation: 'timerPulse 0.5s infinite' }} />
                                                ) : (
                                                    <Timer size={18} color="white" />
                                                )}
                                                <span style={{
                                                    fontWeight: 900,
                                                    fontSize: overdue ? '1.1rem' : '1rem',
                                                    color: 'white',
                                                    letterSpacing: '0.05em',
                                                    fontVariantNumeric: 'tabular-nums'
                                                }}>
                                                    {overdue
                                                        ? `OVERDUE +${formatTimer(elapsed - COOKING_TIME_LIMIT)}`
                                                        : `${formatTimer(remaining)} remaining`
                                                    }
                                                </span>
                                                {overdue && (
                                                    <button
                                                        onClick={() => {
                                                            // Dismiss alarm for this order
                                                            if (alarmAudioRef.current) {
                                                                alarmAudioRef.current.pause()
                                                                alarmAudioRef.current.currentTime = 0
                                                            }
                                                        }}
                                                        style={{
                                                            marginLeft: '8px',
                                                            background: 'rgba(255,255,255,0.2)',
                                                            border: '1px solid rgba(255,255,255,0.4)',
                                                            color: 'white',
                                                            borderRadius: '8px',
                                                            padding: '4px 10px',
                                                            fontWeight: 700,
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Dismiss
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })()
                                )}

                                {/* Header Info */}
                                <div style={{ padding: '20px 20px 16px', borderBottom: '2px solid #f0f0f0', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                    <span style={{ color: '#3B82F6' }}>{order.user?.name || 'Staff'} <span style={{ fontSize: '1rem', opacity: 0.7, display: 'block', marginTop: '4px' }}>Regular Meal</span></span>
                                                ) : order.table_name}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minHeight: '32px' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${badge.color}15`, color: badge.color, padding: '4px 10px', borderRadius: '20px', border: `1.5px solid ${badge.color}30` }}>
                                                    <TypeIcon size={14} strokeWidth={2.5} />
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{badge.label}</span>
                                                </div>
                                                {order.location_type && (
                                                    <div style={{ background: order.location_type === 'outdoor' ? '#FEF3C7' : '#DBEAFE', color: order.location_type === 'outdoor' ? '#92400E' : '#1E40AF', padding: '4px 10px', borderRadius: '20px', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', border: `1.5px solid ${order.location_type === 'outdoor' ? '#FCD34D' : '#93C5FD'}` }}>{order.location_type}</div>
                                                )}
                                                <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontWeight: 800, fontSize: '0.75rem', border: '1.5px solid rgba(var(--primary-rgb), 0.2)' }}>{order.num_guests || 1} GUESTS</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px dashed #e5e5e5', minHeight: '36px' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            <span style={{ fontWeight: 600 }}>Order for:</span> <span style={{ fontWeight: 800, color: 'var(--text)' }}>{getOrderDisplayName(order)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>#{order.id.slice(0, 8).toUpperCase()}</div>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div style={{ padding: '20px', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                    <div style={{ marginBottom: '16px', flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <Package size={16} color="var(--primary)" strokeWidth={2.5} />
                                            <p style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Order Items</p>
                                        </div>
                                        <div style={{
                                            background: '#FAFAF9',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            border: '1px solid #E7E5E4',
                                            flex: '1 1 auto',
                                            minHeight: 0,
                                            maxHeight: '280px',
                                            overflowY: 'auto',
                                            overflowX: 'hidden'
                                        }}>
                                            {editingOrderId === order.id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '12px', border: '2px dashed rgba(59, 130, 246, 0.3)', marginBottom: '6px' }}>
                                                            <Utensils size={22} color="#3B82F6" />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 900, color: '#3B82F6', fontSize: '1rem' }}>Standard Regular Meal</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>Base meal + additional items below</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {order.items?.map((item: any) => (
                                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'white', borderRadius: '10px', border: '1.5px solid #E7E5E4', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                            <span style={{ flex: 1, fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{item.menu_item?.name}</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <button onClick={() => updateItemQuantity(item.id, order.id, item.quantity - 1)} disabled={item.quantity <= 1} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #D6D3D1', background: 'white', cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '1.1rem', opacity: item.quantity <= 1 ? 0.5 : 1, transition: 'all 0.2s' }}>-</button>
                                                                <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 900, fontSize: '1rem' }}>{item.quantity}</span>
                                                                <button onClick={() => updateItemQuantity(item.id, order.id, item.quantity + 1)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #D6D3D1', background: 'white', cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem', transition: 'all 0.2s' }}>+</button>
                                                                <button onClick={() => deleteOrderItem(item.id, order.id)} style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1.5px solid #DC2626', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: 'all 0.2s' }}>🗑️</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedOrderForMenu(order.id)
                                                            setShowMenuSelector(true)
                                                        }}
                                                        style={{
                                                            padding: '12px 16px',
                                                            borderRadius: '10px',
                                                            border: '2px dashed var(--primary)',
                                                            background: 'rgba(var(--primary-rgb), 0.05)',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                            color: 'var(--primary)',
                                                            transition: 'all 0.2s ease',
                                                            fontSize: '0.95rem'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)'
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'
                                                        }}
                                                    >
                                                        <Plus size={18} strokeWidth={3} />
                                                        Add Item to Order
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '12px', border: '2px dashed rgba(59, 130, 246, 0.3)', marginBottom: '12px' }}>
                                                            <Utensils size={22} color="#3B82F6" />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 900, color: '#3B82F6', fontSize: '1rem' }}>Standard Regular Meal</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>Base meal + additional items below</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {order.items?.map((item: any, idx: number) => (
                                                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem', fontWeight: 700, padding: '10px 0', borderBottom: idx < (order.items?.length || 0) - 1 ? '1px solid #E7E5E4' : 'none' }}>
                                                            <span style={{ color: 'var(--text)' }}>{item.menu_item?.name}</span>
                                                            <span style={{ color: 'var(--primary)', fontSize: '1.05rem', fontWeight: 900 }}>x{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                        <div style={{ background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)', color: '#DC2626', padding: '14px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.9rem', borderLeft: '4px solid #EF4444', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.1)', flexShrink: 0 }}>
                                            <div style={{ fontWeight: 900, fontSize: '0.75rem', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <AlertCircle size={14} />
                                                Special Note
                                            </div>
                                            <div style={{ fontWeight: 600 }}>{order.notes}</div>
                                        </div>
                                    )}

                                    {/* Totals Section */}
                                    <div style={{ background: '#F5F5F4', borderRadius: '12px', padding: '16px', border: '1px solid #E7E5E4', flexShrink: 0, minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        {(() => {
                                            const itemsTotal = order.items?.reduce((sum, item: any) => sum + (item.price * item.quantity), 0) || 0
                                            const discountAmount = order.discount_amount > 0 ? itemsTotal * (order.discount_amount / 100) : 0
                                            const finalTotal = itemsTotal - discountAmount
                                            return (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                                        <span style={{ fontWeight: 600 }}>Items Total</span>
                                                        <span style={{ fontWeight: 700 }}>₹{itemsTotal.toFixed(2)}</span>
                                                    </div>
                                                    {order.discount_amount > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', color: '#DC2626', fontWeight: 700, marginBottom: '8px' }}>
                                                            <span>Discount ({order.discount_amount}%)</span>
                                                            <span>-₹{discountAmount.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.15rem', fontWeight: 900, marginTop: '12px', paddingTop: '12px', borderTop: '2px solid #D6D3D1' }}>
                                                        <span style={{ color: 'var(--text)' }}>Final Total</span>
                                                        <span style={{ color: 'var(--primary)', fontSize: '1.35rem' }}>₹{finalTotal.toFixed(2)}</span>
                                                    </div>
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                {viewTab === 'active' && (
                                    <div style={{ padding: '20px', background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F5 100%)', borderTop: '2px solid #E5E5E5', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                        {/* Attendee Dropdown - show when no attendee selected */}
                                        {(order.status === 'pending' || !orderAttendees[order.id]) && (
                                            <div style={{ position: 'relative', marginBottom: '4px' }}>
                                                <button
                                                    onClick={() => setAttendeeDropdownOpen(attendeeDropdownOpen === order.id ? null : order.id)}
                                                    style={{
                                                        width: '100%',
                                                        height: '44px',
                                                        borderRadius: '12px',
                                                        border: order.status === 'ready' && !orderAttendees[order.id] ? '2px solid #EF4444' : '1.5px solid #D1D5DB',
                                                        background: order.status === 'ready' && !orderAttendees[order.id] ? '#FEF2F2' : 'white',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '0 14px',
                                                        color: orderAttendees[order.id] ? 'var(--text)' : order.status === 'ready' ? '#EF4444' : '#9CA3AF',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: order.status === 'ready' && !orderAttendees[order.id] ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <User size={16} strokeWidth={2.5} />
                                                        {orderAttendees[order.id] || 'Attended by...'}
                                                    </div>
                                                    <ChevronDown size={16} style={{ transform: attendeeDropdownOpen === order.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                                </button>
                                                {attendeeDropdownOpen === order.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '48px',
                                                        left: 0,
                                                        right: 0,
                                                        background: 'white',
                                                        borderRadius: '12px',
                                                        border: '1.5px solid #D1D5DB',
                                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                                        zIndex: 50,
                                                        maxHeight: '160px',
                                                        overflowY: 'auto'
                                                    }}>
                                                        {kitchenStaff.map((staff) => (
                                                            <button
                                                                key={staff.id}
                                                                onClick={() => {
                                                                    setOrderAttendees(prev => ({ ...prev, [order.id]: staff.name }))
                                                                    setAttendeeDropdownOpen(null)
                                                                }}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '12px 14px',
                                                                    border: 'none',
                                                                    background: orderAttendees[order.id] === staff.name ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.85rem',
                                                                    color: orderAttendees[order.id] === staff.name ? 'var(--primary)' : 'var(--text)',
                                                                    transition: 'background 0.15s',
                                                                    borderBottom: '1px solid #F3F4F6',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                                                onMouseLeave={e => e.currentTarget.style.background = orderAttendees[order.id] === staff.name ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent'}
                                                            >
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: orderAttendees[order.id] === staff.name ? 'var(--primary)' : '#D1D5DB' }} />
                                                                {staff.name}
                                                            </button>
                                                        ))}
                                                        {kitchenStaff.length === 0 && (
                                                            <div style={{ padding: '10px 14px', color: '#9CA3AF', fontSize: '0.85rem', fontWeight: 600 }}>No staff found</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Show assigned attendee after cooking starts (locked) */}
                                        {order.status !== 'pending' && orderAttendees[order.id] && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '8px 14px',
                                                background: 'rgba(var(--primary-rgb), 0.05)',
                                                borderRadius: '10px',
                                                border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                                marginBottom: '4px'
                                            }}>
                                                <User size={14} color="var(--primary)" />
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                    Attended by: {orderAttendees[order.id]}
                                                </span>
                                            </div>
                                        )}

                                        {/* Primary Action Button */}
                                        <div style={{ minHeight: '56px' }}>
                                            {order.status === 'pending' && (
                                                <Button
                                                    onClick={() => updateStatus(order.id, 'preparing')}
                                                    size="lg"
                                                    style={{
                                                        width: '100%',
                                                        height: '56px',
                                                        fontWeight: 900,
                                                        fontSize: '1.05rem',
                                                        background: 'linear-gradient(135deg, var(--primary) 0%, #8B1A1F 100%)',
                                                        border: 'none',
                                                        boxShadow: '0 4px 12px rgba(192, 39, 45, 0.3)',
                                                        letterSpacing: '0.05em',
                                                        borderRadius: '12px'
                                                    }}
                                                >
                                                    START COOKING
                                                </Button>
                                            )}
                                            {order.status === 'preparing' && (
                                                <Button
                                                    onClick={() => updateStatus(order.id, 'ready')}
                                                    size="lg"
                                                    style={{
                                                        width: '100%',
                                                        height: '56px',
                                                        fontWeight: 900,
                                                        fontSize: '1.05rem',
                                                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                                        border: 'none',
                                                        color: 'white',
                                                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                                                        letterSpacing: '0.05em',
                                                        borderRadius: '12px'
                                                    }}
                                                >
                                                    MARK AS READY
                                                </Button>
                                            )}
                                            {order.status === 'ready' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <Button
                                                        onClick={() => {
                                                            if (!orderAttendees[order.id]) {
                                                                showError('Attendee Required', 'Please select who attended this order before handing over')
                                                                return
                                                            }
                                                            updateStatus(order.id, 'completed')
                                                        }}
                                                        size="lg"
                                                        variant="outline"
                                                        style={{
                                                            width: '100%',
                                                            height: '56px',
                                                            fontWeight: 900,
                                                            fontSize: '1.05rem',
                                                            color: !orderAttendees[order.id] ? '#9CA3AF' : 'var(--text)',
                                                            border: !orderAttendees[order.id] ? '2px dashed #D1D5DB' : '2px solid #D1D5DB',
                                                            background: !orderAttendees[order.id] ? '#F9FAFB' : 'white',
                                                            boxShadow: !orderAttendees[order.id] ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
                                                            letterSpacing: '0.05em',
                                                            borderRadius: '12px',
                                                            opacity: !orderAttendees[order.id] ? 0.7 : 1,
                                                            cursor: !orderAttendees[order.id] ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        HAND OVER
                                                    </Button>
                                                    {!orderAttendees[order.id] && (
                                                        <span style={{ fontSize: '0.7rem', color: '#EF4444', fontWeight: 700, textAlign: 'center' }}>
                                                            ⚠ Select &quot;Attended by&quot; first
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* 2x2 Action Grid: Discount, Edit, Print Bill, Cancel */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button
                                                onClick={async () => {
                                                    const result = await new Promise<string | null>((resolve) => {
                                                        showPopup({
                                                            type: 'confirm',
                                                            title: 'Apply Discount',
                                                            message: 'Enter discount percentage (0-100):',
                                                            confirmText: 'Apply',
                                                            cancelText: 'Cancel',
                                                            onConfirm: () => {
                                                                const input = document.getElementById('discount-input') as HTMLInputElement
                                                                const val = Math.min(Number(input?.value) || 0, 100);
                                                                resolve(val.toString());
                                                            },
                                                            onCancel: () => resolve(null),
                                                        })
                                                        setTimeout(() => {
                                                            const msgEl = document.querySelector('[class*="popupMessage"]')
                                                            if (msgEl && !document.getElementById('discount-input')) {
                                                                const inp = document.createElement('input')
                                                                inp.id = 'discount-input'
                                                                inp.type = 'number'
                                                                inp.min = '0'
                                                                inp.max = '100'
                                                                inp.placeholder = 'e.g. 10'
                                                                inp.style.cssText = 'width:calc(100% - 28px);padding:10px 14px;border:2px solid var(--border);border-radius:12px;font-size:1.1rem;font-weight:700;margin:12px 14px 0 14px;text-align:center;outline:none;box-sizing:border-box;'
                                                                inp.addEventListener('input', () => {
                                                                    let val = parseFloat(inp.value);
                                                                    if (val > 100) inp.value = '100';
                                                                    if (val < 0) inp.value = '0';
                                                                })
                                                                inp.addEventListener('focus', () => inp.style.borderColor = 'var(--primary)')
                                                                inp.addEventListener('blur', () => inp.style.borderColor = 'var(--border)')
                                                                msgEl.after(inp)
                                                                inp.focus()
                                                            }
                                                        }, 50)
                                                    })
                                                    if (result) {
                                                        const numericVal = Math.min(Math.max(parseFloat(result) || 0, 0), 100);
                                                        updateDiscount(order.id, numericVal)
                                                    }
                                                }}
                                                style={{
                                                    height: '46px',
                                                    borderRadius: '12px',
                                                    border: '1.5px solid #D1D5DB',
                                                    background: 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    color: '#6B7280',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--primary)'
                                                    e.currentTarget.style.color = 'var(--primary)'
                                                    e.currentTarget.style.transform = 'translateY(-1px)'
                                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#D1D5DB'
                                                    e.currentTarget.style.color = '#6B7280'
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <Percent size={16} strokeWidth={2.5} />
                                            </button>

                                            <button
                                                onClick={() => setEditingOrderId(editingOrderId === order.id ? null : order.id)}
                                                style={{
                                                    height: '46px',
                                                    borderRadius: '12px',
                                                    border: `1.5px solid ${editingOrderId === order.id ? '#DC2626' : '#D1D5DB'}`,
                                                    background: editingOrderId === order.id ? '#FEE2E2' : 'white',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    color: editingOrderId === order.id ? '#DC2626' : '#374151',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (editingOrderId !== order.id) {
                                                        e.currentTarget.style.background = '#F9FAFB'
                                                        e.currentTarget.style.transform = 'translateY(-1px)'
                                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (editingOrderId !== order.id) {
                                                        e.currentTarget.style.background = 'white'
                                                        e.currentTarget.style.transform = 'translateY(0)'
                                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                                                    }
                                                }}
                                            >
                                                {editingOrderId === order.id ? (
                                                    <><XIcon size={16} strokeWidth={2.5} /> Cancel</>
                                                ) : (
                                                    <><Pencil size={16} strokeWidth={2.5} /> Edit</>
                                                )}
                                            </button>

                                            {order.billed ? (
                                                <button
                                                    onClick={() => handleReprintBill(order.id)}
                                                    disabled={reprintingBill === order.id}
                                                    style={{
                                                        height: '46px',
                                                        borderRadius: '12px',
                                                        border: '1.5px solid #10B981',
                                                        background: 'linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        color: '#059669',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(-1px)'
                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'translateY(0)'
                                                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(16, 185, 129, 0.2)'
                                                    }}
                                                >
                                                    <CheckCircle2 size={16} strokeWidth={2.5} />
                                                    {reprintingBill === order.id ? '...' : 'Print Bill'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleGenerateBill(order.id, orderPaymentMethods[order.id] || 'cash')}
                                                    disabled={generatingBill === order.id || printingBill !== null}
                                                    style={{
                                                        flex: 1,
                                                        height: '46px',
                                                        borderRadius: '12px',
                                                        border: '1.5px solid #D1D5DB',
                                                        background: 'white',
                                                        cursor: generatingBill === order.id ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        color: '#374151',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        opacity: generatingBill === order.id ? 0.6 : 1,
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (generatingBill !== order.id && printingBill === null) {
                                                            e.currentTarget.style.background = '#F9FAFB'
                                                            e.currentTarget.style.transform = 'translateY(-1px)'
                                                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (generatingBill !== order.id) {
                                                            e.currentTarget.style.background = 'white'
                                                            e.currentTarget.style.transform = 'translateY(0)'
                                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                                                        }
                                                    }}
                                                >
                                                    <Printer size={16} strokeWidth={2.5} />
                                                    {generatingBill === order.id ? '...' : 'Print Bill'}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => cancelOrder(order.id)}
                                                style={{
                                                    height: '46px',
                                                    borderRadius: '12px',
                                                    border: '1.5px solid #FCA5A5',
                                                    background: '#FEF2F2',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '6px',
                                                    color: '#DC2626',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 1px 3px rgba(220,38,38,0.1)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#FEE2E2'
                                                    e.currentTarget.style.borderColor = '#DC2626'
                                                    e.currentTarget.style.transform = 'translateY(-1px)'
                                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(220,38,38,0.2)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = '#FEF2F2'
                                                    e.currentTarget.style.borderColor = '#FCA5A5'
                                                    e.currentTarget.style.transform = 'translateY(0)'
                                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(220,38,38,0.1)'
                                                }}
                                                title="Cancel Order"
                                            >
                                                <StopCircle size={16} strokeWidth={2.5} />
                                            </button>
                                        </div>

                                        {/* Row 3: Custom Payment Method Dropdown */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563', whiteSpace: 'nowrap' }}>Payment:</span>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <button
                                                    onClick={() => setPaymentDropdownOpen(paymentDropdownOpen === order.id ? null : order.id)}
                                                    style={{
                                                        width: '100%',
                                                        height: '40px',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid #D1D5DB',
                                                        background: 'white',
                                                        padding: '0 12px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        color: '#374151',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                    }}
                                                    onFocus={(e) => {
                                                        e.currentTarget.style.borderColor = 'var(--primary)'
                                                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.1)'
                                                    }}
                                                    onBlur={(e) => {
                                                        e.currentTarget.style.borderColor = '#D1D5DB'
                                                        e.currentTarget.style.boxShadow = 'none'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--primary)', display: 'flex' }}>
                                                            {PAYMENT_OPTIONS.find(o => o.value === (orderPaymentMethods[order.id] || 'cash'))?.icon}
                                                        </span>
                                                        {PAYMENT_OPTIONS.find(o => o.value === (orderPaymentMethods[order.id] || 'cash'))?.label}
                                                    </span>
                                                    <ChevronDown size={14} style={{ transform: paymentDropdownOpen === order.id ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#9CA3AF' }} />
                                                </button>

                                                {paymentDropdownOpen === order.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        bottom: '44px', // Opens upward since it is at the bottom of the card usually
                                                        left: 0,
                                                        right: 0,
                                                        background: 'white',
                                                        borderRadius: '12px',
                                                        border: '1.5px solid #D1D5DB',
                                                        boxShadow: '0 -8px 24px rgba(0,0,0,0.15)',
                                                        zIndex: 60,
                                                        maxHeight: '220px',
                                                        overflowY: 'auto',
                                                        padding: '6px'
                                                    }}>
                                                        {PAYMENT_OPTIONS.map((opt) => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => {
                                                                    setOrderPaymentMethods(prev => ({ ...prev, [order.id]: opt.value }))
                                                                    setPaymentDropdownOpen(null)
                                                                }}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    border: 'none',
                                                                    background: (orderPaymentMethods[order.id] || 'cash') === opt.value ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
                                                                    borderRadius: '8px',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.85rem',
                                                                    color: (orderPaymentMethods[order.id] || 'cash') === opt.value ? 'var(--primary)' : 'var(--text)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '10px',
                                                                    marginBottom: '2px',
                                                                    transition: 'all 0.1s'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                                                                onMouseLeave={e => e.currentTarget.style.background = (orderPaymentMethods[order.id] || 'cash') === opt.value ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent'}
                                                            >
                                                                <span style={{
                                                                    display: 'flex',
                                                                    color: (orderPaymentMethods[order.id] || 'cash') === opt.value ? 'var(--primary)' : '#6B7280'
                                                                }}>
                                                                    {opt.icon}
                                                                </span>
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {showMenuSelector && selectedOrderForMenu && (() => {
                const editOrder = orders.find(o => o.id === selectedOrderForMenu)
                const editSelectedItems = (editOrder?.items || [])
                    .filter((i: any) => i.menu_item_id)
                    .map((i: any) => ({ menuItemId: i.menu_item_id, quantity: i.quantity }))
                return (
                    <MenuItemSelector
                        items={menuItems}
                        categories={categories}
                        selectedItems={editSelectedItems}
                        onSelect={(item) => {
                            addItemToOrder(selectedOrderForMenu, item.id)
                        }}
                        onUpdateQuantity={(menuItemId, quantity) => {
                            const orderItem = editOrder?.items?.find((i: any) => i.menu_item_id === menuItemId)
                            if (orderItem) updateItemQuantity(orderItem.id, selectedOrderForMenu, quantity)
                        }}
                        onRemoveItem={(menuItemId) => {
                            const orderItem = editOrder?.items?.find((i: any) => i.menu_item_id === menuItemId)
                            if (orderItem) deleteOrderItem(orderItem.id, selectedOrderForMenu)
                        }}
                        onClose={() => {
                            setShowMenuSelector(false)
                            setSelectedOrderForMenu(null)
                        }}
                    />
                )
            })()}

            {billPreview && (
                <BillPreviewModal
                    bill={billPreview}
                    onClose={() => setBillPreview(null)}
                    userRole={user?.role}
                />
            )}

            {/* Create Order Modal */}
            {showCreateOrder && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.05)',
                    backdropFilter: 'blur(2px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: 'clamp(10px, 4vw, 40px) 16px',
                    animation: 'fadeIn 0.2s ease-out',
                }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateOrder(false); setShowNewOrderMenu(false) } }}
                >
                    <div style={{
                        background: 'white',
                        borderRadius: 'clamp(16px, 4vw, 24px)',
                        width: '100%',
                        maxWidth: '850px',
                        maxHeight: 'calc(100vh - 80px)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        {/* Modal Header — sticky */}
                        <div style={{
                            padding: 'clamp(20px, 4vw, 32px) clamp(20px, 4vw, 32px) clamp(16px, 3vw, 24px)',
                            borderBottom: '1px solid #F3F4F6',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0,
                            background: 'white',
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                                    Create Walk-in Order
                                </h2>
                                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#6B7280', fontWeight: 600 }}>Enter details below to generate a new kitchen order</p>
                            </div>
                            <button
                                onClick={() => { setShowCreateOrder(false); setShowNewOrderMenu(false) }}
                                style={{
                                    width: 'clamp(36px, 10vw, 44px)',
                                    height: 'clamp(36px, 10vw, 44px)',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: '#F3F4F6',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#6B7280',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#E5E7EB'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#F3F4F6'}
                            >
                                <XIcon size={22} />
                            </button>
                        </div>

                        {/* Modal Body — scrollable */}
                        <div style={{
                            padding: 'clamp(16px, 4vw, 32px)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'clamp(16px, 4vw, 24px)',
                            overflowY: 'auto',
                            flex: '1 1 auto',
                            background: '#F9FAFB',
                        }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                                gap: 'clamp(16px, 4vw, 24px)'
                            }}>
                                {/* Left Column: Customer & Details */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Info</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }}>CUSTOMER NAME *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                                    <input
                                                        type="text"
                                                        value={newOrderName}
                                                        onChange={(e) => setNewOrderName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                                                        placeholder="Enter customer name"
                                                        style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '0.95rem', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
                                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(169, 30, 34, 0.1)' }}
                                                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }}>PHONE NUMBER *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Phone size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                                    <input
                                                        type="tel"
                                                        value={newOrderPhone}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            if (val.length <= 10) setNewOrderPhone(val);
                                                        }}
                                                        placeholder="10-digit phone number"
                                                        maxLength={10}
                                                        style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '0.95rem', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
                                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(169, 30, 34, 0.1)' }}
                                                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <h3 style={{ margin: '0 0 16px', fontSize: '0.9rem', fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seating Details</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }}>TABLE NUMBER *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={newOrderTable}
                                                        maxLength={2}
                                                        onChange={(e) => {
                                                            // Only allow 2 digits
                                                            const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                                                            setNewOrderTable(val)
                                                        }}
                                                        placeholder="00"
                                                        style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontSize: '0.95rem', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
                                                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(169, 30, 34, 0.1)' }}
                                                        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '16px' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }}>GUESTS</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F3F4F6', padding: '4px', borderRadius: '10px' }}>
                                                        <button onClick={() => setNewOrderGuests(Math.max(1, newOrderGuests - 1))} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: 'white', cursor: 'pointer', fontWeight: 900, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>-</button>
                                                        <span style={{ flex: 1, textAlign: 'center', fontWeight: 800 }}>{newOrderGuests}</span>
                                                        <button onClick={() => setNewOrderGuests(newOrderGuests + 1)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: 'white', cursor: 'pointer', fontWeight: 900, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>+</button>
                                                    </div>
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginBottom: '6px' }}>LOCATION</label>
                                                    <div style={{ display: 'flex', gap: '2px', background: '#F3F4F6', padding: '2px', borderRadius: '10px' }}>
                                                        <button onClick={() => setNewOrderLocation('indoor')} style={{ flex: 1, height: '36px', borderRadius: '8px', border: 'none', background: newOrderLocation === 'indoor' ? 'white' : 'transparent', color: newOrderLocation === 'indoor' ? 'var(--primary)' : '#6B7280', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', boxShadow: newOrderLocation === 'indoor' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>INDOOR</button>
                                                        <button onClick={() => setNewOrderLocation('outdoor')} style={{ flex: 1, height: '36px', borderRadius: '8px', border: 'none', background: newOrderLocation === 'outdoor' ? 'white' : 'transparent', color: newOrderLocation === 'outdoor' ? 'var(--primary)' : '#6B7280', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', boxShadow: newOrderLocation === 'outdoor' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>OUTDOOR</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Order Items */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E5E7EB', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minHeight: '300px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Items</h3>
                                            <span style={{ padding: '4px 10px', background: 'rgba(169, 30, 34, 0.1)', color: 'var(--primary)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>{newOrderItems.length} ITEMS</span>
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
                                            {newOrderItems.length === 0 ? (
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: '8px', opacity: 0.6 }}>
                                                    <ShoppingBag size={32} />
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No items added yet</p>
                                                </div>
                                            ) : (
                                                newOrderItems.map((item, idx) => {
                                                    const menuItem = menuItems.find(m => m.id === item.menuItemId)
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid #F3F4F6', gap: '12px' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{menuItem?.name || 'Unknown'}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>₹{menuItem?.price || 0} x {item.quantity}</div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'white', padding: '2px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
                                                                    <button onClick={() => {
                                                                        if (item.quantity <= 1) setNewOrderItems(prev => prev.filter((_, i) => i !== idx))
                                                                        else setNewOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity - 1 } : it))
                                                                    }} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>-</button>
                                                                    <span style={{ minWidth: '16px', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem' }}>{item.quantity}</span>
                                                                    <button onClick={() => setNewOrderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280' }}>+</button>
                                                                </div>
                                                                <button onClick={() => setNewOrderItems(prev => prev.filter((_, i) => i !== idx))} style={{ width: '28px', height: '28px', borderRadius: '8px', border: 'none', background: '#FEE2E2', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><XIcon size={14} /></button>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>

                                        {dailySpecials.length > 0 && (
                                            <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%)', borderRadius: '12px', border: '2px solid #FBBF24' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.75rem', fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    ⭐ Today's Specials
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                                                    {dailySpecials.map((special) => (
                                                        <button
                                                            key={special.id}
                                                            onClick={() => quickAddSpecialToOrder(special.menu_item.id)}
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
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: '#92400E' }}>{special.menu_item.name}</div>
                                                                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>₹{special.menu_item.price} • {special.period}</div>
                                                            </div>
                                                            <Plus size={16} style={{ flexShrink: 0 }} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => setShowNewOrderMenu(true)}
                                            style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', border: '2px dashed #D1D5DB', background: '#F9FAFB', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#6B7280', fontSize: '0.9rem', transition: 'all 0.2s' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(169, 30, 34, 0.02)' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F9FAFB' }}
                                        >
                                            <Plus size={18} />
                                            Add Menu Items
                                        </button>
                                    </div>

                                    {newOrderItems.length > 0 && (
                                        <div style={{ background: 'var(--primary)', padding: '20px', borderRadius: '16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(169, 30, 34, 0.3)' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase' }}>Total Amount</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>₹{newOrderItems.reduce((sum, item) => {
                                                    const mi = menuItems.find(m => m.id === item.menuItemId)
                                                    return sum + (mi?.price || 0) * item.quantity
                                                }, 0).toFixed(0)}</div>
                                            </div>
                                            <Utensils size={32} style={{ opacity: 0.3 }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer — sticky */}
                        <div style={{
                            padding: 'clamp(12px, 2vw, 16px) clamp(16px, 3vw, 24px) clamp(16px, 3vw, 24px)',
                            borderTop: '2px solid #F3F4F6',
                            display: 'flex',
                            gap: '12px',
                            flexShrink: 0,
                            background: 'white',
                        }}>
                            <Button
                                onClick={() => {
                                    setShowCreateOrder(false)
                                    setShowNewOrderMenu(false)
                                }}
                                variant="outline"
                                style={{ flex: 1, height: 'clamp(44px, 6vw, 52px)', fontWeight: 700, borderRadius: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateKitchenOrder}
                                disabled={creatingOrder}
                                style={{
                                    flex: 2,
                                    height: 'clamp(44px, 6vw, 52px)',
                                    fontWeight: 900,
                                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, #8B1A1F 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(192, 39, 45, 0.3)',
                                    letterSpacing: '0.03em'
                                }}
                            >
                                {creatingOrder ? 'Creating...' : 'Create Order'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Menu Selector for New Order */}
            {showNewOrderMenu && (
                <MenuItemSelector
                    items={menuItems}
                    categories={categories}
                    selectedItems={newOrderItems}
                    onSelect={(item) => {
                        setNewOrderItems(prev => {
                            const existing = prev.find(i => i.menuItemId === item.id)
                            if (existing) {
                                return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i)
                            }
                            return [...prev, { menuItemId: item.id, quantity: 1 }]
                        })
                    }}
                    onUpdateQuantity={(menuItemId, quantity) => {
                        setNewOrderItems(prev => prev.map(i => i.menuItemId === menuItemId ? { ...i, quantity } : i))
                    }}
                    onRemoveItem={(menuItemId) => {
                        setNewOrderItems(prev => prev.filter(i => i.menuItemId !== menuItemId))
                    }}
                    onClose={() => setShowNewOrderMenu(false)}
                />
            )}

            <style jsx global>{`
                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.5; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.5; }
                }
                
                @keyframes timerPulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.6; }
                    100% { opacity: 1; }
                }

                @keyframes slideDown {
                    from { transform: translateY(-30px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                /* Custom scrollbar for order items */
                div[style*="overflowY: auto"]::-webkit-scrollbar {
                    width: 6px;
                }
                
                div[style*="overflowY: auto"]::-webkit-scrollbar-track {
                    background: #E7E5E4;
                    border-radius: 10px;
                }
                
                div[style*="overflowY: auto"]::-webkit-scrollbar-thumb {
                    background: #A8A29E;
                    border-radius: 10px;
                }
                
                div[style*="overflowY: auto"]::-webkit-scrollbar-thumb:hover {
                    background: #78716C;
                }
            `}</style>
        </div>
    )
}
