import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'
import type { AuthTokens } from '@/types/auth'

/**
 * Token persistence.
 *
 * Access tokens are short-lived bearer tokens issued by Laravel (Sanctum/Passport).
 * The refresh token (when the backend issues one) is stored alongside it. For a stricter
 * posture the backend can issue the refresh token as an HttpOnly cookie instead; the
 * client already supports that path because `refreshToken` may be null.
 *
 * Customer and admin sessions are stored separately so an admin signing in at /admin on
 * the web build never replaces (or leaks) a customer session, and vice versa.
 */
export interface TokenStore {
  getAccessToken(): string | null
  getRefreshToken(): string | null
  getExpiry(): number | null
  isExpiringSoon(thresholdMs?: number): boolean
  set(tokens: AuthTokens): void
  clear(): void
}

function createTokenStore(prefix: string): TokenStore {
  const k = (key: string) => (prefix ? `${prefix}.${key}` : key)
  const store: TokenStore = {
    getAccessToken: () => safeStorage.get(k(STORAGE_KEYS.accessToken)),
    getRefreshToken: () => safeStorage.get(k(STORAGE_KEYS.refreshToken)),
    getExpiry() {
      const raw = safeStorage.get(k(STORAGE_KEYS.tokenExpiry))
      return raw ? Number(raw) : null
    },
    isExpiringSoon(thresholdMs = 60_000) {
      const expiry = store.getExpiry()
      return expiry !== null && expiry - Date.now() < thresholdMs
    },
    set(tokens) {
      safeStorage.set(k(STORAGE_KEYS.accessToken), tokens.accessToken)
      if (tokens.refreshToken) safeStorage.set(k(STORAGE_KEYS.refreshToken), tokens.refreshToken)
      else safeStorage.remove(k(STORAGE_KEYS.refreshToken))
      const expiresAt = tokens.expiresAt ? Date.parse(tokens.expiresAt) : Date.now() + tokens.expiresIn * 1000
      safeStorage.set(k(STORAGE_KEYS.tokenExpiry), String(expiresAt))
    },
    clear() {
      safeStorage.remove(k(STORAGE_KEYS.accessToken))
      safeStorage.remove(k(STORAGE_KEYS.refreshToken))
      safeStorage.remove(k(STORAGE_KEYS.tokenExpiry))
    },
  }
  return store
}

/** Customer (web/mobile parity) session. */
export const tokenStorage = createTokenStore('')
/** Admin console session (admin audience tokens, no refresh token; re-login with 2FA). */
export const adminTokenStorage = createTokenStore('admin')

/** Admin endpoints live under /admin/* and always use the admin session. */
export function isAdminRequest(url: string | undefined): boolean {
  return !!url && /^\/?admin\//.test(url)
}
export function storeFor(url: string | undefined): TokenStore {
  return isAdminRequest(url) ? adminTokenStorage : tokenStorage
}
