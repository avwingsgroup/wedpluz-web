import { onScopeDispose } from 'vue'
import { env } from '@/config/env'

/**
 * Realtime bridge. The backend is expected to broadcast over Laravel Reverb / Pusher protocol
 * (see docs/backend-handoff/realtime-events.md). When VITE_REALTIME_URL is empty the app
 * degrades to polling, so no feature depends on a socket being available.
 *
 * The implementation intentionally uses the native WebSocket so the client library can be
 * swapped (laravel-echo + pusher-js or socket.io-client) once the backend transport is final.
 */
type Handler = (payload: unknown) => void

class RealtimeClient {
  private socket: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private retry = 0
  private token: string | null = null

  connect(token: string | null) {
    this.token = token
    if (!env.realtimeUrl || this.socket) return
    try {
      const url = new URL(env.realtimeUrl)
      if (env.realtimeKey) url.searchParams.set('key', env.realtimeKey)
      if (token) url.searchParams.set('token', token)
      this.socket = new WebSocket(url.toString())
      this.socket.onmessage = (evt) => {
        try {
          const frame = JSON.parse(evt.data) as { event: string; channel?: string; data: unknown }
          const { event, channel } = frame
          // Pusher-protocol servers (Laravel Reverb) send `data` as a JSON string.
          let data = frame.data
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data)
            } catch {
              /* plain string payload */
            }
          }
          const key = channel ? `${channel}:${event}` : event
          this.handlers.get(key)?.forEach((h) => h(data))
          this.handlers.get(event)?.forEach((h) => h(data))
        } catch {
          /* ignore malformed frames */
        }
      }
      this.socket.onclose = () => {
        this.socket = null
        const delay = Math.min(30_000, 1000 * 2 ** this.retry++)
        window.setTimeout(() => this.connect(this.token), delay)
      }
      this.socket.onopen = () => {
        this.retry = 0
      }
    } catch {
      this.socket = null
    }
  }

  disconnect() {
    this.socket?.close()
    this.socket = null
  }

  subscribe(key: string, handler: Handler): () => void {
    if (!this.handlers.has(key)) this.handlers.set(key, new Set())
    this.handlers.get(key)!.add(handler)
    return () => this.handlers.get(key)?.delete(handler)
  }

  get isEnabled() {
    return Boolean(env.realtimeUrl)
  }
}

export const realtime = new RealtimeClient()

/** Subscribe to a realtime event for the lifetime of the current component/effect scope. */
export function useRealtimeEvent<T = unknown>(key: string, handler: (payload: T) => void) {
  const off = realtime.subscribe(key, handler as Handler)
  onScopeDispose(off)
}
