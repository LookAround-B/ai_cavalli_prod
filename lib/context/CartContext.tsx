'use client'

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'

export interface CartItem {
    itemId: string
    name: string
    price: number
    quantity: number
    notes?: string
}

interface CartContextType {
    items: CartItem[]
    addToCart: (item: any) => void
    removeFromCart: (itemId: string) => void
    updateQuantity: (itemId: string, delta: number) => void
    clearCart: () => void
    total: number
    editingOrderId: string | null
    setEditingOrderId: (orderId: string | null) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            const saved = localStorage.getItem('cart')
            return saved ? JSON.parse(saved) : []
        } catch {
            localStorage.removeItem('cart')
            return []
        }
    })
    const [editingOrderId, setEditingOrderId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null
        try {
            return localStorage.getItem('editing_order_id')
        } catch {
            localStorage.removeItem('editing_order_id')
            return null
        }
    })

    // Save to local storage on change
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(items))
    }, [items])

    const addToCart = useCallback((newItem: any) => {
        setItems(prev => {
            const existing = prev.find(i => i.itemId === newItem.id)
            if (existing) {
                return prev.map(i => i.itemId === newItem.id
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                )
            }
            return [...prev, { itemId: newItem.id, name: newItem.name, price: newItem.price, quantity: 1 }]
        })
    }, [])

    const removeFromCart = useCallback((itemId: string) => {
        setItems(prev => prev.filter(i => i.itemId !== itemId))
    }, [])

    const updateQuantity = useCallback((itemId: string, delta: number) => {
        setItems(prev => prev.map(i => {
            if (i.itemId === itemId) {
                const newQty = Math.max(0, i.quantity + delta)
                return { ...i, quantity: newQty }
            }
            return i
        }).filter(i => i.quantity > 0))
    }, [])

    const clearCart = useCallback(() => {
        setItems([])
        setEditingOrderId(null)
        localStorage.removeItem('editing_order_id')
    }, [])

    const handleSetEditingOrderId = useCallback((orderId: string | null) => {
        setEditingOrderId(orderId)
        if (orderId) {
            localStorage.setItem('editing_order_id', orderId)
        } else {
            localStorage.removeItem('editing_order_id')
        }
    }, [])

    const total = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    }, [items])

    const value = useMemo(() => ({
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        total,
        editingOrderId,
        setEditingOrderId: handleSetEditingOrderId,
    }), [items, addToCart, removeFromCart, updateQuantity, clearCart, total, editingOrderId, handleSetEditingOrderId])

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => {
    const context = useContext(CartContext)
    if (!context) throw new Error('useCart must be used within CartProvider')
    return context
}
