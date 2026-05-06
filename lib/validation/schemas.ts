/**
 * Centralized Zod validation schemas for all API request payloads.
 * These schemas enforce strict input types and sanitize data before processing.
 */
import { z } from 'zod'

// ============================================================
// Shared Primitives
// ============================================================

const phoneSchema = z.string()
    .transform(v => v.replace(/\D/g, '').slice(0, 10))
    .pipe(z.string().min(1, 'Phone number is required'))

const phoneOptionalSchema = z.string()
    .transform(v => v.replace(/\D/g, '').slice(0, 10))
    .optional()
    .default('')

const pinSchema = z.string()
    .transform(v => v.replace(/\D/g, '').slice(0, 6))
    .pipe(z.string().min(4, 'PIN must be at least 4 digits'))

const safeString = z.string()
    .transform(v => v.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').trim())

const safeStringOptional = safeString.optional().default('')

const idSchema = z.string()
    .transform(v => v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
    .pipe(z.string().min(1, 'ID is required'))

const idOptionalSchema = z.string()
    .transform(v => v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
    .optional()

const emailSchema = z.string().email().max(254).transform(v => v.trim().toLowerCase())
const emailOptionalSchema = z.string().email().max(254).transform(v => v.trim().toLowerCase()).optional().or(z.literal(''))

const imageUrlSchema = z.string().transform(v => {
    const trimmed = v.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('data:image/')) return trimmed
    try {
        const url = new URL(trimmed)
        if (['http:', 'https:'].includes(url.protocol)) return trimmed
    } catch { /* invalid URL */ }
    return ''
}).optional().default('')

const urlSchema = z.string().transform(v => {
    const trimmed = v.trim()
    if (!trimmed) return ''
    try {
        const url = new URL(trimmed)
        if (['http:', 'https:'].includes(url.protocol)) return trimmed
    } catch { /* invalid URL */ }
    return ''
}).optional().default('')

const notesSchema = z.string()
    .max(500)
    .transform(v => v.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, '').trim())
    .optional()
    .default('')

// ============================================================
// Enum schemas (matching Prisma enums)
// ============================================================

const userRoleSchema = z.enum(['ADMIN', 'KITCHEN', 'RIDER', 'STAFF', 'OUTSIDER'])
const orderStatusSchema = z.enum(['pending', 'preparing', 'ready', 'completed', 'cancelled'])
const locationTypeSchema = z.enum(['indoor', 'outdoor']).optional()
const specialPeriodSchema = z.enum(['breakfast', 'lunch'])
const paymentMethodSchema = z.enum(['cash', 'credit', 'upi', 'card', 'staff_payment', 'rider_payment', 'silva', 'chandar']).optional().default('cash')

// ============================================================
// Auth Schemas
// ============================================================

export const loginSchema = z.object({
    phone: phoneSchema,
    pin: pinSchema,
    role: z.string().optional(),
    action: z.string().optional(),
})

export const guestLoginSchema = z.object({
    name: safeString.pipe(z.string().min(1, 'Name is required').max(50)),
    phone: phoneSchema.pipe(z.string().length(10, 'Phone must be 10 digits')),
    table_name: safeString.optional().default('Walk-in'),
    num_guests: z.number().int().min(1).max(50).optional().default(1),
})

// ============================================================
// Order Schemas
// ============================================================

const orderItemSchema = z.object({
    itemId: idSchema,
    quantity: z.number().int().min(1).max(100),
    notes: notesSchema,
    name: safeStringOptional,
    price: z.number().min(0).optional(),
})

export const createOrderSchema = z.object({
    userId: idOptionalSchema,
    phone: phoneOptionalSchema,
    items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    tableName: safeString.optional().default('Walk-in'),
    numGuests: z.number().int().min(1).max(50).optional().default(1),
    locationType: locationTypeSchema,
    notes: notesSchema,
    riderPaidNow: z.boolean().optional().default(false),
    sessionId: idOptionalSchema,
})

export const updateOrderSchema = z.object({
    orderId: idSchema,
    userId: idOptionalSchema,
    items: z.array(z.object({
        itemId: idSchema,
        quantity: z.number().int().min(1).max(100),
        name: safeStringOptional,
        price: z.number().min(0).optional(),
    })),
    notes: notesSchema,
    riderPaidNow: z.boolean().optional().default(false),
})

export const updateOrderStatusSchema = z.object({
    orderId: idSchema,
    status: orderStatusSchema,
})

export const updateOrderDiscountSchema = z.object({
    orderId: idSchema,
    discountAmount: z.number().min(0).max(100).default(0),
})

// ============================================================
// Order Items Schemas
// ============================================================

export const addOrderItemSchema = z.object({
    orderId: idSchema,
    menuItemId: idSchema,
    quantity: z.number().int().min(1).max(100).optional().default(1),
    price: z.number().min(0).optional(),
})

export const updateOrderItemSchema = z.object({
    orderItemId: idSchema,
    quantity: z.number().int().min(1).max(100),
})

// ============================================================
// Menu Item Schemas
// ============================================================

export const createMenuItemSchema = z.object({
    name: safeString.pipe(z.string().min(1, 'Name is required').max(200)),
    description: safeStringOptional.pipe(z.string().max(1000)),
    price: z.number().min(0, 'Price must be positive').max(999999),
    category_id: idSchema,
    image_url: imageUrlSchema,
    available: z.boolean().optional().default(true),
})

export const updateMenuItemSchema = createMenuItemSchema.extend({
    id: idSchema,
})

export const toggleMenuItemSchema = z.object({
    id: idSchema,
    available: z.boolean(),
})

export const bulkPriceIncreaseSchema = z.object({
    action: z.enum(['preview', 'apply']),
    percentage: z.number().min(0.01, 'Percentage must be at least 0.01').max(100, 'Percentage cannot exceed 100'),
    userId: idOptionalSchema,
    reason: safeStringOptional.pipe(z.string().max(500)),
    targetType: z.enum(['all', 'category', 'products']).optional().default('all'),
    categoryId: idOptionalSchema,
    itemIds: z.array(z.string().transform(v => v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))).optional().default([]),
})

// ============================================================
// Bill Schemas
// ============================================================

export const generateBillSchema = z.object({
    orderId: idSchema,
    paymentMethod: paymentMethodSchema,
    userId: idOptionalSchema,
})

export const updateBillPaymentSchema = z.object({
    billId: idSchema,
    paymentMethod: paymentMethodSchema,
})

export const printBillSchema = z.object({
    billId: idSchema,
    userId: idOptionalSchema,
})

export const requestBillSchema = z.object({
    sessionId: idSchema,
    userId: idOptionalSchema,
})

export const sessionBillSchema = z.object({
    sessionId: idSchema,
    paymentMethod: paymentMethodSchema,
})

export const userBillSchema = z.object({
    userId: idSchema,
    paymentMethod: paymentMethodSchema,
})

// ============================================================
// Admin User Schemas
// ============================================================

export const createUserSchema = z.object({
    name: safeString.pipe(z.string().min(1, 'Name is required').max(100)),
    phone: phoneOptionalSchema,
    email: emailOptionalSchema,
    pin: z.string().min(4).max(20).optional().default('123456'),
    role: userRoleSchema,
    parent_name: safeStringOptional,
})

export const updateUserSchema = z.object({
    id: idSchema,
    name: safeString.pipe(z.string().min(1).max(100)),
    phone: phoneOptionalSchema,
    email: emailOptionalSchema,
    pin: z.string().min(4).max(20).optional(),
    role: userRoleSchema,
    parent_name: safeStringOptional,
})

export const deleteUserSchema = z.object({
    id: idSchema,
})

export const adminUserActionSchema = z.object({
    action: z.enum(['create', 'update', 'delete']),
    userData: z.record(z.string(), z.unknown()),
})

// ============================================================
// Announcement Schemas
// ============================================================

export const createAnnouncementSchema = z.object({
    title: safeString.pipe(z.string().min(1, 'Title is required').max(200)),
    description: safeStringOptional.pipe(z.string().max(2000)),
    link: urlSchema,
    image_url: imageUrlSchema,
    active: z.boolean().optional().default(true),
})

export const deleteAnnouncementSchema = z.object({
    id: idSchema,
})

export const adminAnnouncementActionSchema = z.object({
    action: z.enum(['create', 'delete']),
    payload: z.record(z.string(), z.unknown()),
})

// ============================================================
// Kitchen Specials Schemas
// ============================================================

export const createSpecialSchema = z.object({
    menu_item_id: idSchema,
    period: specialPeriodSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

// ============================================================
// Query Parameter Schemas (for GET endpoints)
// ============================================================

export const billLookupQuerySchema = z.object({
    sessionId: idOptionalSchema,
    orderId: idOptionalSchema,
    orderIds: z.string().transform(v =>
        v.split(',').map(id => id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)).filter(Boolean)
    ).optional(),
    guestName: safeString.pipe(z.string().max(50)).optional(),
})

export const ordersQuerySchema = z.object({
    userId: idOptionalSchema,
    orderId: idOptionalSchema,
    status: z.string().transform(v => {
        const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled']
        return v.split(',').map(s => s.trim().toLowerCase()).filter(s => allowed.includes(s))
    }).optional(),
    limit: z.string().optional().default('100').transform(v => {
        const n = parseInt(v, 10)
        if (isNaN(n) || n < 1) return 100
        return Math.min(n, 500)
    }),
    all: z.enum(['true', 'false']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const sessionEndSchema = z.object({
    sessionId: idSchema,
    paymentMethod: paymentMethodSchema,
})

// ============================================================
// Helper: Parse and validate a request body
// ============================================================

export async function validateBody<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
        const body = await request.json()
        const result = schema.safeParse(body)
        if (!result.success) {
            const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
            return { success: false, error: `Validation failed: ${errors}` }
        }
        return { success: true, data: result.data }
    } catch {
        return { success: false, error: 'Invalid JSON body' }
    }
}

/**
 * Parse and validate URL search params against a Zod schema.
 */
export function validateQuery<T>(
    searchParams: URLSearchParams,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
    const raw: Record<string, string> = {}
    searchParams.forEach((value, key) => {
        raw[key] = value
    })
    const result = schema.safeParse(raw)
    if (!result.success) {
        const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        return { success: false, error: `Query validation failed: ${errors}` }
    }
    return { success: true, data: result.data }
}
