import pg from 'pg'
import { sseManager } from './manager'

let reconnectTimer: ReturnType<typeof setTimeout> | null = null

async function connectListener() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

  client.on('error', (err) => {
    console.error('[PG NOTIFY] Client error:', err.message)
    client.end().catch(() => {})
    scheduleReconnect()
  })

  await client.connect()
  await client.query('LISTEN orders_events')

  client.on('notification', (msg) => {
    if (msg.channel !== 'orders_events' || !msg.payload) return
    try {
      const event = JSON.parse(msg.payload) as { type: string; [key: string]: unknown }
      sseManager.broadcast(event.type, event)
    } catch {
      // malformed payload — ignore
    }
  })

  // Clear any pending reconnect timer now that we're connected
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  console.log('[PG NOTIFY] Listening on channel: orders_events')
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try {
      await connectListener()
    } catch (e) {
      console.error('[PG NOTIFY] Reconnect failed:', (e as Error).message)
      scheduleReconnect()
    }
  }, 3_000)
}

// Boot exactly once per Node.js process
const g = globalThis as unknown as { __pgListenerStarted?: boolean }
if (!g.__pgListenerStarted) {
  g.__pgListenerStarted = true
  connectListener().catch((e) => {
    console.error('[PG NOTIFY] Initial connect failed:', (e as Error).message)
    scheduleReconnect()
  })
}
