import { beforeAll, describe, expect, it } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'
import { createMockAdapter } from '@/services/mock/adapter'

/**
 * The mock adapter implements the documented contract (docs/backend-handoff) for development.
 * These tests pin the contract behaviours the UI depends on: envelopes, error codes and the
 * rule that the server, not the client, computes totals and decides check-in outcomes.
 */
let adapter: AxiosAdapter
let userToken = ''
let adminToken = ''

async function call<T = unknown>(method: string, url: string, opts: { body?: unknown; query?: Record<string, unknown>; token?: string } = {}) {
  const headers = new AxiosHeaders(opts.token ? { Authorization: `Bearer ${opts.token}` } : {})
  const config = { method, url, params: opts.query, data: opts.body ? JSON.stringify(opts.body) : undefined, headers } as InternalAxiosRequestConfig
  try {
    const res = await adapter(config)
    return { status: res.status, data: res.data as T }
  } catch (e) {
    const err = e as { response?: { status: number; data: T } }
    return { status: err.response?.status ?? 0, data: err.response?.data as T }
  }
}

beforeAll(async () => {
  adapter = createMockAdapter()
  const login = await call<{ data: { tokens: { accessToken: string } } }>('post', '/auth/login', { body: { email: 'johnbrown@gmail.com', password: 'password123' } })
  userToken = login.data.data.tokens.accessToken
  const admin = await call<{ data: { tokens: { accessToken: string } } }>('post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123', otp: '1234' } })
  adminToken = admin.data.data.tokens.accessToken
}, 30_000)

describe('mock API contract', () => {
  it('wraps single resources in { data }', async () => {
    const res = await call<{ data: { email: string } }>('get', '/auth/me', { token: userToken })
    expect(res.status).toBe(200)
    expect(res.data.data.email).toBe('johnbrown@gmail.com')
  })

  it('returns offset pagination meta on lists', async () => {
    const res = await call<{ data: unknown[]; meta: Record<string, number> }>('get', '/events', { query: { page: 1, perPage: 2 } })
    expect(res.data.data.length).toBeLessThanOrEqual(2)
    expect(Object.keys(res.data.meta).sort()).toEqual(['lastPage', 'page', 'perPage', 'total'])
  })

  it('uses the error envelope with machine-readable codes', async () => {
    const res = await call<{ message: string; code: string }>('post', '/auth/login', { body: { email: 'johnbrown@gmail.com', password: 'wrongpass' } })
    expect(res.status).toBe(401)
    expect(res.data.code).toBe('UNAUTHENTICATED')
    expect(res.data.message).toBeTruthy()
  })

  it('rejects customer tokens on admin endpoints and requires admin 2FA', async () => {
    expect((await call('get', '/admin/me', { token: userToken })).status).toBe(401)
    const step1 = await call<{ data: { requiresTwoFactor: boolean; tokens: unknown } }>('post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123' } })
    expect(step1.data.data).toMatchObject({ requiresTwoFactor: true, tokens: null })
  })

  it('computes checkout totals server-side, including the service fee', async () => {
    const ev = await call<{ data: { id: string; ticketTypes: Array<{ id: string; price: number; seatSelection: boolean }> } }>('get', '/events/movie-in-the-park-denim-edition', { token: userToken })
    const tt = ev.data.data.ticketTypes.find((t) => t.price > 0 && !t.seatSelection)!
    const q = await call<{ data: { subtotal: number; serviceFee: number; discount: number; total: number; expiresAt: string } }>('post', '/checkout/quotes', {
      token: userToken,
      body: { eventId: ev.data.data.id, lines: [{ ticketTypeId: tt.id, quantity: 2 }], foodLines: [] },
    })
    expect(q.status).toBe(200)
    const { subtotal, serviceFee, discount, total } = q.data.data
    expect(subtotal).toBe(tt.price * 2)
    expect(serviceFee).toBeGreaterThan(0)
    expect(total).toBe(subtotal - discount + serviceFee)
    expect(Number.isInteger(total)).toBe(true)
    expect(Date.parse(q.data.data.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('rejects invalid promo codes with PROMO_INVALID', async () => {
    const ev = await call<{ data: { id: string; ticketTypes: Array<{ id: string; price: number; seatSelection: boolean }> } }>('get', '/events/movie-in-the-park-denim-edition', { token: userToken })
    const tt = ev.data.data.ticketTypes.find((t) => t.price > 0 && !t.seatSelection)!
    const q = await call<{ code: string }>('post', '/checkout/quotes', { token: userToken, body: { eventId: ev.data.data.id, lines: [{ ticketTypeId: tt.id, quantity: 1 }], foodLines: [], promoCode: 'NOPE' } })
    expect(q.status).toBe(422)
    expect(q.data.code).toBe('PROMO_INVALID')
  })

  it('refuses to cancel a ticket twice', async () => {
    const tickets = await call<{ data: Array<{ id: string; status: string; orderTotal: number }> }>('get', '/me/tickets', { token: userToken, query: { tab: 'upcoming' } })
    const t = tickets.data.data.find((x) => x.status === 'valid')
    expect(t).toBeDefined()
    const first = await call('post', `/tickets/${t!.id}/cancel`, { token: userToken, body: { reason: 'personal' } })
    expect(first.status).toBe(200)
    const second = await call<{ code: string }>('post', `/tickets/${t!.id}/cancel`, { token: userToken, body: { reason: 'personal' } })
    expect(second.status).toBe(409)
    expect(second.data.code).toBe('CONFLICT')
  })

  it('enforces admin permissions server-side and audit-logs actions', async () => {
    const before = await call<{ meta: { total: number } }>('get', '/admin/audit-logs', { token: adminToken, query: { page: 1 } })
    const users = await call<{ data: Array<{ id: string; status: string }> }>('get', '/admin/users', { token: adminToken, query: { status: 'active', perPage: 5 } })
    const target = users.data.data.find((u) => u.status === 'active' && u.id !== 'usr_me')!
    const res = await call('post', `/admin/users/${target.id}/suspend`, { token: adminToken, body: { reason: 'Repeated spam reports' } })
    expect(res.status).toBe(200)
    const after = await call<{ meta: { total: number } }>('get', '/admin/audit-logs', { token: adminToken, query: { page: 1 } })
    expect(after.data.meta.total).toBe(before.data.meta.total + 1)
  })
})
