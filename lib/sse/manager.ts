type SSEClient = {
  controller: ReadableStreamDefaultController
  role: string
  userId?: string
}

class SSEManager {
  private clients = new Map<string, SSEClient>()

  add(id: string, client: SSEClient) {
    this.clients.set(id, client)
  }

  remove(id: string) {
    this.clients.delete(id)
  }

  broadcast(event: string, data: object) {
    const encoded = new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(encoded)
      } catch {
        this.clients.delete(id)
      }
    }
  }

  get clientCount() {
    return this.clients.size
  }
}

const g = globalThis as unknown as { __sseManager?: SSEManager }
export const sseManager: SSEManager = g.__sseManager ?? (g.__sseManager = new SSEManager())
