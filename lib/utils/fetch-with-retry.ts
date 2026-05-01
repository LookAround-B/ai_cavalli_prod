export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options)
      // Retry on 5xx but not on 4xx (client errors are permanent)
      if (res.status >= 500 && attempt < maxRetries - 1) {
        throw new Error(`HTTP ${res.status}`)
      }
      return res
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e // never retry aborts
      lastError = e as Error
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500))
      }
    }
  }

  throw lastError ?? new Error('fetch failed')
}
