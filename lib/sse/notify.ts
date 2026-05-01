import { prisma } from '@/lib/database/prisma'

// pg_notify hard limit is 8000 bytes
const PG_NOTIFY_LIMIT = 7_500

export async function notifyOrderEvent(type: string, payload: Record<string, unknown>) {
  try {
    const full = JSON.stringify({ type, ...payload })

    let data: string
    if (Buffer.byteLength(full, 'utf8') > PG_NOTIFY_LIMIT) {
      // Payload too large — send a stub; clients will fetch the single order themselves
      data = JSON.stringify({ type, id: payload.id, _needsFetch: true })
    } else {
      data = full
    }

    await prisma.$executeRaw`SELECT pg_notify('orders_events', ${data})`
  } catch (e) {
    // Non-fatal — SSE must never block a mutation
    console.error('[NOTIFY] pg_notify failed:', (e as Error).message)
  }
}
