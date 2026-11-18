import { beforeEach, describe, expect, it } from 'vitest'
import { adminTokenStorage, isAdminRequest, storeFor, tokenStorage } from '@/services/http/tokenStorage'

const tokens = (accessToken: string, refreshToken: string | null = 'refresh-1') => ({ accessToken, refreshToken, tokenType: 'Bearer' as const, expiresIn: 3600 })

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores customer and admin sessions independently', () => {
    tokenStorage.set(tokens('customer-token'))
    adminTokenStorage.set(tokens('admin-token', null))
    expect(tokenStorage.getAccessToken()).toBe('customer-token')
    expect(adminTokenStorage.getAccessToken()).toBe('admin-token')

    adminTokenStorage.clear()
    expect(tokenStorage.getAccessToken()).toBe('customer-token')
    expect(adminTokenStorage.getAccessToken()).toBeNull()
  })

  it('removes a stale refresh token when the backend stops issuing one', () => {
    tokenStorage.set(tokens('a', 'r1'))
    tokenStorage.set(tokens('b', null))
    expect(tokenStorage.getRefreshToken()).toBeNull()
  })

  it('tracks expiry from expiresIn or expiresAt', () => {
    tokenStorage.set({ ...tokens('a'), expiresIn: 30 })
    expect(tokenStorage.isExpiringSoon(60_000)).toBe(true)
    tokenStorage.set({ ...tokens('a'), expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
    expect(tokenStorage.isExpiringSoon(60_000)).toBe(false)
  })
})

describe('request audience routing', () => {
  it.each([
    ['/admin/users', true],
    ['admin/finance/summary', true],
    ['/administrator', false],
    ['/events/admin-gala', false],
    [undefined, false],
  ])('isAdminRequest(%j) is %s', (url, expected) => {
    expect(isAdminRequest(url)).toBe(expected)
  })

  it('selects the admin store only for /admin/* calls', () => {
    expect(storeFor('/admin/me')).toBe(adminTokenStorage)
    expect(storeFor('/me')).toBe(tokenStorage)
  })
})
