import clsx from 'clsx'
import styles from './Button.module.css'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
}

export function Button({
    className,
    variant = 'primary',
    size = 'md',
    isLoading,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            className={clsx(
                styles.button,
                styles[variant],
                styles[size],
                isLoading && styles.loading,
                className
            )}
            disabled={props.disabled || isLoading}
            {...props}
        >
            {isLoading ? <span className={styles.spinner} /> : children}
        </button>
    )
}