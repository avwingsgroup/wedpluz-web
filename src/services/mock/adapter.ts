import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosError, type AxiosHeaders } from 'axios'
import type { ApiErrorBody } from '@/types/api'
import { registerAllHandlers } from './handlers'
import { uuid } from '@/utils/id'

/**
 * Development-only mock transport.
 *
 * It plugs into Axios as an adapter, so every interceptor (auth header, correlation id,
 * token refresh, error normalization) runs exactly as it does against the Laravel API.
 * Handlers are keyed by METHOD + path pattern and return the same envelopes the backend will.
 *
 * Enabled with VITE_API_MODE=mock. It is never bundled when VITE_API_MODE=live.
 */

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface MockRequest {
  method: MockMethod
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
  authToken: string | null
}

export interface MockReply {
  status?: number
  body?: unknown
  headers?: Record<string, string>
  delayMs?: number
}

export type MockHandler = (req: MockRequest) => MockReply | Promise<MockReply>

interface Route {
  method: MockMethod
  pattern: RegExp
  keys: string[]
  handler: MockHandler
}

const routes: Route[] = []

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = []
  const source = path
    .replace(/\//g, '\\/')
    .replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key)
      return '([^\\/?#]+)'
    })
  return { pattern: new RegExp(`^${source}\\/?$`), keys }
}

export function route(method: MockMethod, path: string, handler: MockHandler): void {
  const { pattern, keys } = compile(path)
  routes.push({ method, pattern, keys, handler })
}

export class MockHttpError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message)
  }
}

export function fail(status: number, code: string, message: string, errors?: Record<string, string[]>): never {
  throw new MockHttpError(status, { message, code, errors, correlationId: uuid() })
}

export function ok(body: unknown, status = 200): MockReply {
  return { status, body }
}

export function data<T>(payload: T, message?: string): MockReply {
  return { status: 200, body: { data: payload, message } }
}

export function created<T>(payload: T, message?: string): MockReply {
  return { status: 201, body: { data: payload, message } }
}

export function noContent(): MockReply {
  return { status: 204, body: undefined }
}

export function paginate<T>(items: T[], query: URLSearchParams, defaultPerPage = 12): MockReply {
  const page = Math.max(1, Number(query.get('page') ?? 1))
  const perPage = Math.min(100, Math.max(1, Number(query.get('perPage') ?? defaultPerPage)))
  const start = (page - 1) * perPage
  return {
    status: 200,
    body: {
      data: items.slice(start, start + perPage),
      meta: { page, perPage, total: items.length, lastPage: Math.max(1, Math.ceil(items.length / perPage)) },
    },
  }
}

export function cursorPage<T extends { id: string }>(items: T[], query: URLSearchParams, perPage = 20): MockReply {
  const cursor = query.get('cursor')
  const startIndex = cursor ? items.findIndex((i) => i.id === cursor) + 1 : 0
  const slice = items.slice(startIndex, startIndex + perPage)
  const last = slice[slice.length - 1]
  const hasMore = startIndex + perPage < items.length
  return {
    status: 200,
    body: { data: slice, meta: { nextCursor: hasMore && last ? last.id : null, prevCursor: null, perPage } },
  }
}

let registered = false

function latency(): number {
  // Realistic but snappy latency so loading states are visible during development.
  return 120 + Math.round(Math.random() * 280)
}

export function createMockAdapter(): AxiosAdapter {
  if (!registered) {
    registerAllHandlers()
    registered = true
  }

  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toUpperCase() as MockMethod
    const url = new URL(config.url ?? '/', 'http://mock.local/api/v1/')
    const base = new URL(config.baseURL ?? 'http://mock.local/api/v1').pathname.replace(/\/$/, '')
    let path = url.pathname
    if (base && path.startsWith(base)) path = path.slice(base.length)
    if (!path.startsWith('/')) path = `/${path}`

    const query = new URLSearchParams(url.search)
    for (const [k, v] of Object.entries(config.params ?? {})) {
      if (v !== undefined && v !== null) query.set(k, String(v))
    }

    const headers: Record<string, string> = {}
    const h = config.headers as AxiosHeaders | Record<string, unknown>
    for (const [k, v] of Object.entries(h ?? {})) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v
    }
    const authHeader = headers['authorization']
    const authToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    let body: unknown = config.data
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        /* keep raw */
      }
    }

    const match = routes.find((r) => r.method === method && r.pattern.test(path))
    const makeResponse = (status: number, payload: unknown, extraHeaders: Record<string, string> = {}): AxiosResponse => ({
      data: payload,
      status,
      statusText: String(status),
      headers: { 'x-correlation-id': headers['x-correlation-id'] ?? uuid(), ...extraHeaders },
      config,
      request: {},
    })

    if (config.signal?.aborted) {
      throw new AxiosError('canceled', 'ERR_CANCELED', config)
    }

    if (!match) {
      console.warn(`[mock] No handler for ${method} ${path}`)
      const payload: ApiErrorBody = { message: `Mock route not implemented: ${method} ${path}`, code: 'NOT_FOUND' }
      throw new AxiosError(payload.message, 'ERR_BAD_REQUEST', config, {}, makeResponse(404, payload))
    }

    const params: Record<string, string> = {}
    const m = match.pattern.exec(path)
    match.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(m?.[i + 1] ?? '')
    })

    try {
      const reply = await match.handler({ method, path, params, query, body, headers, authToken })
      await new Promise((r) => setTimeout(r, reply.delayMs ?? latency()))
      const status = reply.status ?? 200
      const response = makeResponse(status, reply.body, reply.headers)
      if (status >= 400) {
        throw new AxiosError(String((reply.body as ApiErrorBody)?.message ?? 'Error'), 'ERR_BAD_RESPONSE', config, {}, response)
      }
      return response
    } catch (error) {
      if (error instanceof MockHttpError) {
        await new Promise((r) => setTimeout(r, latency()))
        const response = makeResponse(error.status, error.body)
        throw new AxiosError(error.message, error.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, {}, response)
      }
      throw error
    }
  }
}
