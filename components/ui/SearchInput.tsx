import { Search } from 'lucide-react'
import styles from './SearchInput.module.css'

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onSearch: (value: string) => void
}

function sanitizeSearchInput(value: string): string {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .slice(0, 200)
}

export function SearchInput({ onSearch, ...props }: SearchInputProps) {
    return (
        <div className={styles.container}>
            <Search className={styles.icon} size={20} />
            <input
                className={styles.input}
                onChange={(e) => onSearch(sanitizeSearchInput(e.target.value))}
                maxLength={200}
                {...props}
            />
        </div>
    )
}
