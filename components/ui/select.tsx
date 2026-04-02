import clsx from 'clsx'
import styles from './Input.module.css'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    error?: string
}

export function Select({ className, label, error, children, ...props }: SelectProps) {
    return (
        <div className={clsx(styles.container, className)}>
            {label && <label className={styles.label}>{label}</label>}
            <select
                className={clsx(styles.input, error && styles.hasError)}
                {...props}
            >
                {children}
            </select>
            {error && <span className={styles.error}>{error}</span>}
        </div>
    )
}
