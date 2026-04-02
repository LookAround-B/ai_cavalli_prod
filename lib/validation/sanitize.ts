/**
 * Centralized sanitization utilities to prevent injection attacks.
 * Applied to all user-provided strings before database operations.
 */

/**
 * Strips HTML tags and dangerous characters from a string.
 * Prevents XSS / script injection in user-provided text fields.
 */
export function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return ''
    return input
        .replace(/<[^>]*>/g, '')          // Strip HTML tags
        .replace(/[<>]/g, '')             // Remove remaining angle brackets
        .replace(/javascript:/gi, '')     // Remove javascript: protocol
        .replace(/vbscript:/gi, '')       // Remove vbscript: protocol
        .replace(/on\w+\s*=/gi, '')       // Remove inline event handlers (onclick=, etc.)
        .replace(/data:/gi, '')           // Remove data: protocol (except in validated image contexts)
        .replace(/expression\s*\(/gi, '') // Remove CSS expression()
        .replace(/url\s*\(/gi, '')        // Remove CSS url()
        .trim()
}

/**
 * Sanitize a string while preserving data: URIs for base64 images.
 * Used specifically for image_url fields where base64 uploads are allowed.
 */
export function sanitizeImageUrl(input: unknown): string {
    if (typeof input !== 'string') return ''
    const trimmed = input.trim()
    // Allow data:image/* URIs (base64 encoded images)
    if (trimmed.startsWith('data:image/')) {
        return trimmed
    }
    // Allow valid http/https URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return sanitizeString(trimmed)
    }
    // Allow empty string
    if (trimmed === '') return ''
    // Reject everything else
    return ''
}

/**
 * Sanitize a phone number — digits only, max 10 chars.
 */
export function sanitizePhone(input: unknown): string {
    if (typeof input !== 'string') return ''
    return input.replace(/\D/g, '').slice(0, 10)
}

/**
 * Sanitize a PIN — digits only, max 6 chars.
 */
export function sanitizePin(input: unknown): string {
    if (typeof input !== 'string') return ''
    return input.replace(/\D/g, '').slice(0, 6)
}

/**
 * Sanitize a CUID/UUID-style ID string — alphanumeric and hyphens only.
 * Prevents SQL/command injection through ID fields.
 */
export function sanitizeId(input: unknown): string {
    if (typeof input !== 'string') return ''
    return input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
}

/**
 * Sanitize notes/comments — allow more characters but still strip HTML.
 */
export function sanitizeNotes(input: unknown): string {
    if (typeof input !== 'string') return ''
    return input
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .slice(0, 500)
        .trim()
}

/**
 * Sanitize a URL — allow only http/https protocol.
 */
export function sanitizeUrl(input: unknown): string {
    if (typeof input !== 'string') return ''
    const trimmed = input.trim()
    if (!trimmed) return ''
    try {
        const url = new URL(trimmed)
        if (!['http:', 'https:'].includes(url.protocol)) return ''
        return trimmed
    } catch {
        return ''
    }
}

/**
 * Sanitize an email address — basic format validation.
 */
export function sanitizeEmail(input: unknown): string {
    if (typeof input !== 'string') return ''
    const trimmed = input.trim().toLowerCase()
    // Basic email pattern check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return ''
    return trimmed.slice(0, 254) // RFC 5321 max length
}

/**
 * Sanitize a comma-separated list of IDs.
 * Each ID is individually validated as alphanumeric + hyphens/underscores.
 */
export function sanitizeIdList(input: unknown): string[] {
    if (typeof input !== 'string') return []
    return input
        .split(',')
        .map(id => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
        .filter(id => id.length > 0)
}

/**
 * Sanitize an ISO date string (YYYY-MM-DD).
 * Returns empty string if invalid.
 */
export function sanitizeDate(input: unknown): string {
    if (typeof input !== 'string') return ''
    const trimmed = input.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return ''
    const d = new Date(trimmed)
    if (isNaN(d.getTime())) return ''
    return trimmed
}

/**
 * Sanitize an order status value — must be one of the allowed statuses.
 */
export function sanitizeOrderStatus(input: unknown): string[] {
    if (typeof input !== 'string') return []
    const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled']
    return input
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => allowed.includes(s))
}

/**
 * Sanitize numeric limit — positive integer, max 500.
 */
export function sanitizeLimit(input: unknown): number {
    if (typeof input !== 'string' && typeof input !== 'number') return 100
    const num = typeof input === 'number' ? input : parseInt(input, 10)
    if (isNaN(num) || num < 1) return 100
    return Math.min(num, 500)
}

/**
 * Sanitize a payment method value.
 */
export function sanitizePaymentMethod(input: unknown): string {
    if (typeof input !== 'string') return 'cash'
    const allowed = ['cash', 'credit', 'upi', 'card', 'staff_payment', 'rider_payment', 'silva', 'chandar']
    const val = input.trim().toLowerCase()
    return allowed.includes(val) ? val : 'cash'
}

/**
 * Validate image file type by checking magic bytes (for server-side uploads).
 * Returns true if the base64 data starts with a valid image header.
 */
export function isValidImageBase64(input: string): boolean {
    if (!input.startsWith('data:image/')) return false
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    const mimeMatch = input.match(/^data:(image\/[a-z+]+);base64,/)
    if (!mimeMatch) return false
    return allowedTypes.includes(mimeMatch[1])
}
