import { useState, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Minus, X } from 'lucide-react'
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

function renderDescription(description: string) {
    // Split on bullet characters or newlines to render each on its own line
    const lines = description.split(/[•·●]\s*|\n/).filter(l => l.trim())
    if (lines.length <= 1) return <span>{description}</span>
    return (
        <span>
            {lines.map((line, i) => (
                <span key={i} className={styles.descLine}>• {line.trim()}</span>
            ))}
        </span>
    )
}

export function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
    const { items: cartItems, updateQuantity } = useCart()
    const cartItem = cartItems.find(i => i.itemId === item.id)
    const quantity = cartItem?.quantity || 0
    const [imgError, setImgError] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const handleCardClick = () => {
        setIsModalOpen(true)
    }

    const handleCloseModal = (e: MouseEvent) => {
        e.stopPropagation()
        setIsModalOpen(false)
    }

    const handleOverlayClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget) {
            setIsModalOpen(false)
        }
    }

    const handleActionClick = (e: MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <>
            {/* ===== CARD ===== */}
            <div className={`${styles.card} fade-in`} onClick={handleCardClick}>
                <div className={styles.imageArea}>
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

                <div className={styles.infoArea}>
                    <div className={styles.titleRow}>
                        <h3 className={styles.name}>{item.name}</h3>
                        <span className={styles.price}>₹{item.price.toFixed(2)}</span>
                    </div>

                    {item.description && (
                        <div className={styles.description}>
                            {renderDescription(item.description.length > 100
                                ? item.description.slice(0, 100) + '…'
                                : item.description)}
                        </div>
                    )}

                    <div className={styles.actionArea} onClick={handleActionClick}>
                        {quantity === 0 ? (
                            <button
                                className={styles.addBtn}
                                onClick={() => onAdd(item)}
                                disabled={!item.available}
                            >
                                <span className={styles.addDesktopIcon}>+</span> ADD
                            </button>
                        ) : (
                            <div className={styles.qtyRow}>
                                <button
                                    className={styles.qtyBtn}
                                    onClick={() => updateQuantity(item.id, -1)}
                                    aria-label="Decrease quantity"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className={styles.qtyNum}>{quantity}</span>
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

            {isModalOpen && typeof document !== 'undefined' && createPortal(
                <div className={styles.modalOverlay} onClick={handleOverlayClick}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.closeButton} onClick={handleCloseModal} aria-label="Close">
                            <X size={22} />
                        </button>

                        <div className={styles.modalImageContainer}>
                            {item.image_url && !imgError ? (
                                <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className={styles.modalImage}
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className={styles.modalPlaceholderImage} />
                            )}
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.modalTopRow}>
                                <div className={styles.modalHeader}>
                                    <h2 className={styles.modalName}>{item.name}</h2>
                                    <p className={styles.modalPrice}>₹{item.price.toFixed(0)}</p>
                                </div>
                                <div className={styles.modalActions}>
                                    {quantity === 0 ? (
                                        <button
                                            className={styles.modalAddBtn}
                                            onClick={() => onAdd(item)}
                                            disabled={!item.available}
                                        >
                                            ADD
                                        </button>
                                    ) : (
                                        <div className={styles.modalQtyRow}>
                                            <button
                                                className={styles.modalQtyBtn}
                                                onClick={() => updateQuantity(item.id, -1)}
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus size={18} />
                                            </button>
                                            <span className={styles.modalQtyNum}>{quantity}</span>
                                            <button
                                                className={styles.modalQtyBtn}
                                                onClick={() => updateQuantity(item.id, 1)}
                                                aria-label="Increase quantity"
                                                disabled={!item.available}
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {item.description && (
                                <div className={styles.modalDescription}>
                                    {renderDescription(item.description)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
