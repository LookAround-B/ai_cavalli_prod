import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from './button'
import styles from './MenuItemCard.module.css'
import { useCart } from '@/lib/context/CartContext'

export interface MenuItem {
    id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    available: boolean
}

interface MenuItemCardProps {
    item: MenuItem
    onAdd: (item: MenuItem) => void
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
    const { items: cartItems, updateQuantity } = useCart()
    const cartItem = cartItems.find(i => i.itemId === item.id)
    const quantity = cartItem?.quantity || 0
    const [imgError, setImgError] = useState(false)

    return (
        <div className={`${styles.card} fade-in`}>
            <div className={styles.imageContainer}>
                {item.image_url && !imgError ? (
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className={styles.image}
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className={styles.placeholderImage} />
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.header}>
                    <h3 className={styles.name}>{item.name}</h3>
                    <span className={styles.price}>₹{item.price.toFixed(2)}</span>
                </div>

                <p className={styles.description}>{item.description}</p>

                <div className={styles.actions}>
                    {quantity === 0 ? (
                        <Button
                            size="sm"
                            onClick={() => onAdd(item)}
                            disabled={!item.available}
                            className={styles.addButton}
                        >
                            <Plus size={16} style={{ marginRight: '4px' }} />
                            Add
                        </Button>
                    ) : (
                        <div className={styles.quantityControls}>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => updateQuantity(item.id, -1)}
                                aria-label="Decrease quantity"
                            >
                                <Minus size={16} />
                            </button>
                            <span className={styles.quantity}>{quantity}</span>
                            <button
                                className={styles.qtyBtn}
                                onClick={() => updateQuantity(item.id, 1)}
                                aria-label="Increase quantity"
                                disabled={!item.available}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
