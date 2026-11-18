import type { MockRequest } from '../adapter'
import { fail } from '../adapter'
import * as db from '../db'
import type { User } from '@/types'

export const tokenFor = (userId: string) => `mock-token-${userId}`

export function userFromToken(token: string | null): User | null {
  if (!token?.startsWith('mock-token-')) return null
  const id = token.slice('mock-token-'.length)
  return db.findUser(id) ?? null
}

/** Resolves the authenticated user or throws 401 exactly like the backend. */
export function requireUser(req: MockRequest): User {
  const user = userFromToken(req.authToken)
  if (!user) fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')
  if (user.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.')
  return user
}

export function requireAdmin(req: MockRequest) {
  if (!req.authToken?.startsWith('mock-admin-')) fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')
  const id = req.authToken.slice('mock-admin-'.length)
  const admin = db.adminUsers.find((a) => a.id === id)
  if (!admin) fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')
  return admin
}

export function body<T = Record<string, unknown>>(req: MockRequest): T {
  return (req.body ?? {}) as T
}

export function requireFields(payload: Record<string, unknown>, fields: string[]) {
  const errors: Record<string, string[]> = {}
  for (const f of fields) {
    const v = payload[f]
    if (v === undefined || v === null || v === '') errors[f] = [`The ${f} field is required.`]
  }
  if (Object.keys(errors).length) fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', errors)
}

export function textMatch(haystack: Array<string | null | undefined>, needle: string | null): boolean {
  if (!needle) return true
  const n = needle.toLowerCase()
  return haystack.some((h) => h?.toLowerCase().includes(n))
}

export function sortBy<T>(items: T[], key: string | null, order: 'asc' | 'desc' = 'desc'): T[] {
  if (!key) return items
  const dir = order === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    if (av === bv) return 0
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    return (av > bv ? 1 : -1) * dir
  })
}

export function dateInRange(value: string, from: string | null, to: string | null): boolean {
  if (from && value < from) return false
  if (to && value > `${to}T23:59:59`) return false
  return true
}
