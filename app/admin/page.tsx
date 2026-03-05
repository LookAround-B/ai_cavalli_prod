'use client'

import { useEffect, useState } from 'react'
import {
    TrendingUp,
    ShoppingBag,
    Clock,
    Download,
    Settings,
    Users,
    FileText,
    ArrowUpRight,
    ArrowDownRight,
    Menu as MenuIcon,
    PieChart as PieChartIcon,
    BarChart2,
    Sparkles,
    Activity,
    DollarSign,
    Package,
    ChefHat,
    LogOut
} from 'lucide-react'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    LineChart,
    Line
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useCart } from '@/lib/context/CartContext'
import { AdminPageHeader } from '@/components/layout/AdminPageHeader'

interface Order {
    id: string
    total: number
    status: string
    created_at: string
    table_name: string
    num_guests: number | null
    discount_amount: number
    user?: { role: string }
    guest_info?: any
    items?: any[]
}

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        growth: 12.5,
        avgOrderValue: 0,
        todayRevenue: 0
    })

    const [recentOrders, setRecentOrders] = useState<Order[]>([])
    const [allOrders, setAllOrders] = useState<Order[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [revenueData, setRevenueData] = useState<any[]>([])
    const [categoryData, setCategoryData] = useState<any[]>([])
    const [demographicData, setDemographicData] = useState<any[]>([])
    const [hourlyData, setHourlyData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { logout } = useAuth()
    const { clearCart } = useCart()

    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(1)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0]
    })

    // Separate state for Export Data
    const [exportStartDate, setExportStartDate] = useState(() => {
        const d = new Date()
        d.setDate(1)
        return d.toISOString().split('T')[0]
    })
    const [exportEndDate, setExportEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0]
    })

    useEffect(() => {
        fetchData()
    }, [startDate, endDate])

    async function fetchData() {
        setLoading(true)
        try {
            const res = await fetch(`/api/orders?all=true&startDate=${startDate}&endDate=${endDate}`)
            const json = await res.json()
            const orders: any[] = json.success ? json.data : null

            if (orders) {
                const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0)
                const today = new Date().toLocaleDateString()
                const todayRevenue = orders
                    .filter(o => new Date(o.created_at).toLocaleDateString() === today)
                    .reduce((sum, o) => sum + (o.total || 0), 0)

                const pending = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length
                const avgVal = orders.length > 0 ? (totalRevenue / orders.length).toFixed(2) : '0'

                setStats({
                    totalOrders: orders.length,
                    totalRevenue,
                    pendingOrders: pending,
                    growth: 12.5,
                    avgOrderValue: parseFloat(avgVal),
                    todayRevenue
                })
                setAllOrders(orders)
                setRecentOrders(orders.slice(0, 10))

                // 1. Process Revenue Data
                const dailyRevenue: { [key: string]: { date: string, amount: number, orders: number, rawDate: string } } = {}
                orders.forEach(o => {
                    const dateObj = new Date(o.created_at)
                    const dateKey = dateObj.toISOString().split('T')[0]
                    const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                    if (!dailyRevenue[dateKey]) {
                        dailyRevenue[dateKey] = { date: dateDisplay, amount: 0, orders: 0, rawDate: dateKey }
                    }
                    dailyRevenue[dateKey].amount += (o.total || 0)
                    dailyRevenue[dateKey].orders++
                })
                setRevenueData(Object.values(dailyRevenue).sort((a, b) => a.rawDate.localeCompare(b.rawDate)).slice(-30))

                // 2. Process Demographic Data (User role: RIDER -> UI label: Rider)
                const demographics = { rider: 0, staff: 0, guest: 0 }
                orders.forEach(o => {
                    const role = o.user?.role || 'guest'
                    if (role === 'RIDER') demographics.rider++
                    else if (role === 'staff') demographics.staff++
                    else demographics.guest++
                })
                setDemographicData([
                    { name: 'Riders', value: demographics.rider, color: '#C0272D' },
                    { name: 'Staff', value: demographics.staff, color: '#D97706' },
                    { name: 'Guests', value: demographics.guest, color: '#15803D' }
                ])

                // 3. Process Category Data
                const categories: { [key: string]: number } = {}
                orders.forEach(o => {
                    o.items?.forEach((item: any) => {
                        const catName = item.menu_item?.category?.name || 'Other'
                        categories[catName] = (categories[catName] || 0) + item.quantity
                    })
                })
                const catChart = Object.entries(categories)
                    .map(([name, count], idx) => ({
                        name,
                        count,
                        color: ['#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6'][idx % 5]
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                setCategoryData(catChart)

                // 4. Process Hourly Activity
                const hourly: { [key: string]: number } = {}
                orders.filter(o => new Date(o.created_at).toLocaleDateString() === today).forEach(o => {
                    const hour = new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric' })
                    hourly[hour] = (hourly[hour] || 0) + 1
                })
                const hourlyChart = Object.entries(hourly).map(([hour, orders]) => ({ hour, orders }))
                setHourlyData(hourlyChart.length > 0 ? hourlyChart : [{ hour: 'Now', orders: 0 }])
            }
        } catch (e) { console.error('fetchData error:', e) }
        setLoading(false)
    }

    function downloadCSV() {
        fetch(`/api/orders?all=true&startDate=${exportStartDate}&endDate=${exportEndDate}`)
            .then(res => res.json())
            .then(json => {
                const data = json.success ? json.data : null
                if (!data) return
                const headers = ['Customer Name', 'Parent Name', 'Phone Number', 'Role', 'Guests', 'Items Ordered', 'Money Spent (₹)', 'Timestamp']
                const rows = data.map((o: any) => {
                    const role = o.user?.role || (o.guest_info ? 'guest' : 'unknown')
                    const name = o.user?.name || o.guest_info?.name || 'Guest'
                    const parentName = o.user?.role === 'RIDER' ? (o.user?.parent_name || 'N/A') : ''
                    const phone = o.user?.phone || o.guest_info?.phone || 'N/A'
                    const guests = o.num_guests || 1
                    const itemSummary = o.items ? o.items.map((i: any) => `${i.menu_item?.name} (x${i.quantity})`).join('; ') : 'No items'
                    const finalTotal = (o.total - (o.discount_amount || 0)).toFixed(2)
                    const timestamp = new Date(o.created_at).toLocaleString()
                    return [`"${name}"`, `"${parentName}"`, `"${phone}"`, role === 'RIDER' ? 'RIDER' : role.toUpperCase(), guests, `"${itemSummary}"`, finalTotal, `"${timestamp}"`]
                })
                const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n')
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `detailed_orders_report_${new Date().toISOString().split('T')[0]}.csv`
                a.click()
                window.URL.revokeObjectURL(url)
            })
            .catch(e => console.error('downloadCSV error:', e))
    }

    if (loading) return <Loading />

    return (
        <div style={{
            minHeight: '100vh',
            background: 'rgb(245, 245, 245)',
            padding: 'clamp(1rem, 3vw, 2rem)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
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

            <div style={{ maxWidth: '1600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <div style={{ marginBottom: 'clamp(1.5rem, 5vw, 3rem)' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                        <AdminPageHeader title="Command Center" subtitle="Real-time system analytics and control" icon={Activity} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap' }}>
                            {/* Dashboard Stats Date Range */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.7)',
                                padding: 'clamp(6px, 1.5vw, 10px) clamp(10px, 2vw, 20px)',
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                flex: '1 1 auto',
                                minWidth: '280px'
                            }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b' }}>STATS</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#1f2937', fontWeight: '600', outline: 'none', fontSize: '0.85rem', width: 'auto' }}
                                />
                                <span style={{ color: '#cbd5e1' }}>to</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#1f2937', fontWeight: '600', outline: 'none', fontSize: '0.85rem', width: 'auto' }}
                                />
                            </div>

                            {/* Export Date Range Group */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'white',
                                padding: 'clamp(6px, 1.5vw, 10px) clamp(10px, 2vw, 20px)',
                                borderRadius: '12px',
                                border: '1px solid rgba(var(--primary-rgb), 0.2)',
                                boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.1)',
                                flex: '1 1 auto',
                                minWidth: '320px',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '0.05em' }}>EXPORT</span>
                                <input
                                    type="date"
                                    value={exportStartDate}
                                    onChange={(e) => setExportStartDate(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#1f2937', fontWeight: '600', outline: 'none', fontSize: '0.85rem' }}
                                />
                                <span style={{ color: '#cbd5e1' }}>|</span>
                                <input
                                    type="date"
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                    style={{ background: 'transparent', border: 'none', color: '#1f2937', fontWeight: '600', outline: 'none', fontSize: '0.85rem' }}
                                />
                                <button onClick={downloadCSV} style={{
                                    background: 'var(--primary)',
                                    border: 'none',
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flex: '1 1 auto',
                                    justifyContent: 'center',
                                    marginTop: 'clamp(0px, 0vw, 4px)',
                                    transition: 'all 0.3s ease',
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    <Download size={14} />
                                    Export
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Live Status Bar */}
                    <div style={{
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: '12px',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 12px #10B981',
                            animation: 'pulse 2s infinite'
                        }} />
                        <span style={{ color: '#10B981', fontWeight: '700', fontSize: '0.9rem' }}>
                            System Active • Last updated: {new Date().toLocaleTimeString()}
                        </span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <StatCard
                        label="Total Revenue"
                        value={`₹${stats.totalRevenue.toLocaleString()}`}
                        icon={<DollarSign size={24} />}
                        color="#10B981"
                        trend="+12.5%"
                        subtitle="vs last month"
                        sparkline={[40, 45, 42, 48, 52, 55, 58]}
                    />
                    <StatCard
                        label="Total Orders"
                        value={stats.totalOrders.toString()}
                        icon={<ShoppingBag size={24} />}
                        color="#3B82F6"
                        trend="+8.2%"
                        subtitle="growth rate"
                        sparkline={[30, 35, 32, 40, 45, 48, 50]}
                    />
                    <StatCard
                        label="Active Orders"
                        value={stats.pendingOrders.toString()}
                        icon={<Clock size={24} />}
                        color="#F59E0B"
                        trend="-2"
                        subtitle="since last hour"
                        sparkline={[15, 12, 14, 10, 12, 9, 8]}
                    />
                    <StatCard
                        label="Avg Order Value"
                        value={`₹${stats.avgOrderValue}`}
                        icon={<TrendingUp size={24} />}
                        color="#8B5CF6"
                        trend="+5.3%"
                        subtitle="per transaction"
                        sparkline={[32, 34, 33, 35, 36, 37, 36]}
                    />
                </div>

                {/* Main Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Revenue Chart */}
                    <ChartCard title="Revenue Analytics" icon={<TrendingUp size={20} />} color="#10B981">
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#64748b"
                                    style={{ fontSize: '12px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    style={{ fontSize: '12px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        backdropFilter: 'blur(10px)',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fill="url(#revenueGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Hourly Activity */}
                    <ChartCard title="Today's Activity" icon={<Activity size={20} />} color="#3B82F6">
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis
                                    dataKey="hour"
                                    stroke="#64748b"
                                    style={{ fontSize: '11px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    style={{ fontSize: '11px', fontWeight: '600' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="#3B82F6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3B82F6', r: 5 }}
                                    activeDot={{ r: 7 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                {/* Secondary Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Demographics Donut */}
                    <ChartCard title="Order Demographics" icon={<PieChartIcon size={20} />} color="#8B5CF6">
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={demographicData}
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {demographicData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
                            {demographicData.map((d, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: d.color }} />
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </ChartCard>

                    {/* Category Performance */}
                    <ChartCard title="Top Categories" icon={<Package size={20} />} color="#F59E0B">
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={categoryData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    width={80}
                                    style={{ fontSize: '11px', fontWeight: '700', fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15,23,42,0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600'
                                    }}
                                    itemStyle={{ color: '#fff' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={18}>
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* Quick Actions */}
                    <div style={{
                        background: 'white',
                        border: '1px solid rgba(var(--primary-rgb), 0.15)',
                        borderRadius: '24px',
                        padding: '2rem',
                        boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.05)',
                        transition: 'all 0.4s ease'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Sparkles size={20} color="#C0272D" />
                            <h3 style={{ margin: 0, fontWeight: '800', color: '#1f2937', fontSize: '1.1rem' }}>Quick Actions</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <ActionButton icon={<MenuIcon size={16} />} label="Menu Management" href="/admin/menu" />
                            <ActionButton icon={<FileText size={16} />} label="Announcements" href="/admin/cms" />
                            <ActionButton icon={<Users size={16} />} label="User Control" href="/admin/users" />
                            <ActionButton icon={<ChefHat size={16} />} label="Kitchen Display" href="/kitchen" />
                            <ActionButton
                                icon={<LogOut size={16} />}
                                label="Logout"
                                onClick={() => { clearCart(); logout(); }}
                            />
                        </div>
                    </div>
                </div>

                {/* Recent Orders Table */}
                <div style={{
                    background: 'white',
                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.05)',
                    transition: 'all 0.4s ease'
                }}>
                    <div style={{
                        padding: 'clamp(1rem, 4vw, 2rem)',
                        borderBottom: '1px solid rgba(var(--primary-rgb), 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        background: 'linear-gradient(to right, rgba(var(--primary-rgb), 0.02), transparent)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                background: 'rgba(var(--primary-rgb), 0.1)',
                                padding: '8px',
                                borderRadius: '10px',
                                color: 'var(--primary)'
                            }}>
                                <ShoppingBag size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontWeight: '800', color: 'var(--text)', fontSize: '1.25rem', letterSpacing: '-0.01em' }}>
                                Recent Transactions
                            </h3>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(var(--primary-rgb), 0.02)' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order ID</th>
                                    <th style={{ textAlign: 'left', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Table/Rider</th>
                                    <th style={{ textAlign: 'left', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Details</th>
                                    <th style={{ textAlign: 'left', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                                    <th style={{ textAlign: 'right', padding: '1rem clamp(1rem, 3vw, 2rem)', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                                            <div style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '1rem' }}>
                                                <ShoppingBag size={48} strokeWidth={1} style={{ margin: '0 auto' }} />
                                            </div>
                                            <p style={{ color: 'var(--text-muted)', fontWeight: '500' }}>No transactions found for this period</p>
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr key={order.id} style={{
                                            borderTop: '1px solid rgba(var(--primary-rgb), 0.05)',
                                            transition: 'all 0.2s ease',
                                        }} className="transaction-row">
                                            <td style={{ padding: '1rem clamp(1rem, 3vw, 2rem)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.85rem',
                                                        fontWeight: '700',
                                                        color: 'var(--primary)'
                                                    }}>
                                                        #{order.id.slice(0, 8).toUpperCase()}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {order.id.slice(0, 4)}...</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem clamp(1rem, 3vw, 2rem)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: 'rgba(var(--primary-rgb), 0.05)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'var(--primary)', fontSize: '0.8rem', fontWeight: '800'
                                                    }}>
                                                        {order.table_name ? order.table_name[0] : 'R'}
                                                    </div>
                                                    <span style={{ fontWeight: '700', color: 'var(--text)' }}>{order.table_name || 'Rider Order'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem clamp(1rem, 3vw, 2rem)' }}>
                                                <StatusBadge status={order.status} />
                                            </td>
                                            <td style={{ padding: '1rem clamp(1rem, 3vw, 2rem)' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: '700' }}>
                                                        {order.num_guests || 1} Guests
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Confirmed</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem clamp(1rem, 3vw, 2rem)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    <Clock size={14} />
                                                    <span style={{ fontWeight: '600' }}>
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1.5rem 2rem', textAlign: 'right' }}>
                                                <span style={{
                                                    fontWeight: '800',
                                                    color: '#10B981',
                                                    fontSize: '1.1rem',
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    padding: '4px 12px',
                                                    borderRadius: '8px'
                                                }}>
                                                    ₹{order.total.toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div style={{
                        padding: '1.25rem 2rem',
                        borderTop: '1px solid rgba(var(--primary-rgb), 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(var(--primary-rgb), 0.01)'
                    }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                            Showing page <span style={{ color: 'var(--primary)' }}>{currentPage}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    background: 'white',
                                    color: currentPage === 1 ? '#cbd5e1' : 'var(--text)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (currentPage !== 1) e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'
                                }}
                                onMouseLeave={(e) => {
                                    if (currentPage !== 1) e.currentTarget.style.background = 'white'
                                }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={recentOrders.length < 10}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    background: 'white',
                                    color: recentOrders.length < 10 ? '#cbd5e1' : 'var(--text)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: recentOrders.length < 10 ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (recentOrders.length >= 10) e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.05)'
                                }}
                                onMouseLeave={(e) => {
                                    if (recentOrders.length >= 10) e.currentTarget.style.background = 'white'
                                }}
                            >
                                Next Page
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .transaction-row:hover {
                    background: rgba(var(--primary-rgb), 0.035) !important;
                    transform: scale(1.002);
                }
                .transaction-row:hover td {
                    color: var(--text) !important;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                /* Responsive table on mobile */
                @media (max-width: 768px) {
                    table {
                        font-size: 0.85rem;
                    }
                    th, td {
                        padding: 12px 16px !important;
                    }
                }
                
                @media (max-width: 640px) {
                    /* Stack stat cards on mobile */
                    [style*="gridTemplateColumns"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    )
}

function StatCard({ label, value, icon, color, trend, subtitle, sparkline }: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    trend: string;
    subtitle: string;
    sparkline: number[];
}) {
    return (
        <div style={{
            background: 'white',
            border: '1px solid rgba(var(--primary-rgb), 0.15)',
            borderRadius: '24px',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.05)',
            transition: 'all 0.4s ease'
        }}>
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`, filter: 'blur(20px)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                    padding: '12px',
                    borderRadius: '14px',
                    boxShadow: `0 4px 12px ${color}30`
                }}>
                    <div style={{ color }}>{icon}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: '800',
                        color: trend.startsWith('+') ? '#10B981' : '#EF4444',
                        background: trend.startsWith('+') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {trend}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {label}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1f2937', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {value}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '600' }}>
                {subtitle}
            </div>

            {/* Mini Sparkline */}
            <svg width="100%" height="40" style={{ marginTop: '16px' }}>
                <polyline
                    points={sparkline.map((val, idx) => `${(idx / (sparkline.length - 1)) * 100}%,${40 - (val / (Math.max(...sparkline) || 1)) * 35}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.4"
                />
            </svg>
        </div>
    )
}

function ChartCard({ title, icon, color, children }: {
    title: string;
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{
            background: 'white',
            border: '1px solid rgba(var(--primary-rgb), 0.15)',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.05)',
            transition: 'all 0.4s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                    padding: '10px',
                    borderRadius: '12px'
                }}>
                    <div style={{ color }}>{icon}</div>
                </div>
                <h3 style={{ margin: 0, fontWeight: '800', color: '#1f2937', fontSize: '1.1rem' }}>{title}</h3>
            </div>
            {children}
        </div>
    )
}

function ActionButton({ icon, label, href, onClick }: { icon: React.ReactNode, label: string, href?: string, onClick?: () => void }) {
    const Component = href ? Link : 'button'
    return (
        <Component
            href={href as any}
            onClick={onClick}
            style={{
                background: 'rgba(var(--primary-rgb), 0.03)',
                border: '1px solid rgba(var(--primary-rgb), 0.1)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: 'var(--text)',
                fontWeight: '700',
                fontSize: '0.95rem',
                width: '100%',
                textAlign: 'left',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={(e: any) => {
                e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)'
                e.currentTarget.style.transform = 'translateX(5px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--primary-rgb), 0.1)'
            }}
            onMouseLeave={(e: any) => {
                e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.03)'
                e.currentTarget.style.transform = 'translateX(0)'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'
            }}
        >
            <div style={{
                background: 'white',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                color: 'var(--primary)'
            }}>
                {icon}
            </div>
            <span>{label}</span>
        </Component>
    )
}

function StatusBadge({ status }: { status: string }) {
    const statusConfig: Record<string, { bg: string, border: string, color: string, label: string }> = {
        pending: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#F59E0B', label: 'Pending' },
        preparing: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#3B82F6', label: 'Preparing' },
        ready: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', color: '#10B981', label: 'Ready' },
        completed: { bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)', color: '#64748b', label: 'Completed' }
    }

    const config = statusConfig[status] || statusConfig.completed

    return (
        <span style={{
            background: config.bg,
            border: `1px solid ${config.border}`,
            color: config.color,
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'inline-block'
        }}>
            {config.label}
        </span>
    )
}