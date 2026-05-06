import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { sseManager } from '@/lib/sse/manager'

// Boot the PG listener once per process
import '@/lib/sse/pg-listener'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const clientId = randomUUID()

  const stream = new ReadableStream({
    start(controller) {
      sseManager.add(clientId, { controller, role: 'stream' })

      // Confirm connection
      const connected = new TextEncoder().encode(
        `event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`,
      )
      try { controller.enqueue(connected) } catch { return }

      // Heartbeat every 25 s — keeps the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        sseManager.remove(clientId)
        try { controller.close() } catch {}
      })
    },
    cancel() {
      sseManager.remove(clientId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
