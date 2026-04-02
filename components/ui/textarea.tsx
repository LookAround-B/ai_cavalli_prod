import clsx from 'clsx'
import styles from './Input.module.css'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string
    error?: string
}

export function Textarea({ className, label, error, ...props }: TextareaProps) {
    return (
        <div className={clsx(styles.container, className)}>
            {label && <label className={styles.label}>{label}</label>}
            <textarea
                className={clsx(styles.input, error && styles.hasError)}
                {...props}
            />
            {error && <span className={styles.error}>{error}</span>}
        </div>
    )
}
