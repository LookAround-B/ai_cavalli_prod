'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import styles from './Popup.module.css'

interface LoginRequiredModalProps {
    isOpen: boolean
    onClose?: () => void
    message?: string
}

/**
 * Modal shown when user tries to order without being logged in
 */
export function LoginRequiredModal({
    isOpen,
    onClose,
    message = 'You need to login before placing an order'
}: LoginRequiredModalProps) {
    const router = useRouter()
    const [visible, setVisible] = useState(isOpen)

    useEffect(() => {
        setVisible(isOpen)
    }, [isOpen])

    if (!visible) return null

    const handleProceed = () => {
        setVisible(false)
        if (onClose) onClose()
        router.push('/login')
    }

    const handleClose = () => {
        setVisible(false)
        if (onClose) onClose()
    }

    return (
        <div className={styles.popupOverlay} onClick={handleClose}>
            <div className={styles.popupBox} onClick={(e) => e.stopPropagation()}>
                <div className={styles.iconWrap}>
                    <div className={`${styles.iconCircle} ${styles.warning}`}>
                        <LogIn size={28} />
                    </div>
                </div>
                <div className={styles.popupContent}>
                    <h3 className={styles.popupTitle}>Login Required</h3>
                    <p className={styles.popupMessage}>{message}</p>
                </div>
                <div className={styles.popupActions}>
                    <button
                        className={`${styles.popupBtn} ${styles.btnSecondary}`}
                        onClick={handleClose}
                    >
                        Cancel
                    </button>
                    <button
                        className={`${styles.popupBtn} ${styles.btnPrimary}`}
                        onClick={handleProceed}
                    >
                        Proceed to Login
                    </button>
                </div>
            </div>
        </div>
    )
}
