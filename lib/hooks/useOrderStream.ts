'use client'

import { useEffect, useRef } from 'react'

export type OrderStreamEvent = {
  type: 'order_created' | 'order_updated'
  id?: string
  [key: string]: unknown
}

export function useOrderStream(
  onEvent: (event: OrderStreamEvent) => void,
  enabled = true,
) {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    if (!enabled) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let unmounted = false

    function connect() {
      if (unmounted) return
      es = new EventSource('/api/orders/stream')

      es.addEventListener('order_created', (e: MessageEvent) => {
        try { onEventRef.current({ ...JSON.parse(e.data), type: 'order_created' }) } catch {}
      })

      es.addEventListener('order_updated', (e: MessageEvent) => {
        try { onEventRef.current({ ...JSON.parse(e.data), type: 'order_updated' }) } catch {}
      })

      es.onerror = () => {
        es?.close()
        es = null
        if (!unmounted) {
          // Browser also auto-reconnects, but we add our own backoff
          reconnectTimer = setTimeout(connect, 3_000)
        }
      }
    }

    connect()

    return () => {
      unmounted = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [enabled])
}
