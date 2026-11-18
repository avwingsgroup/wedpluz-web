import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { env } from '@/config/env'
import { uuid } from '@/utils/id'
import type { AuthTokens } from '@/types/auth'
import { ApiError, normalizeError } from './errors'
import { storeFor, tokenStorage, adminTokenStorage, isAdminRequest } from './tokenStorage'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Skip the Authorization header (public endpoints). */
    skipAuth?: boolean
    /** Do not attempt a token refresh on 401. */
    skipRefresh?: boolean
    /** Internal flag preventing infinite refresh loops. */
    _retried?: boolean
  }
}

type UnauthenticatedHandler = () => void
let onUnauthenticated: UnauthenticatedHandler | null = null
let onAdminUnauthenticated: UnauthenticatedHandler | null = null

/** Registered by the auth stores so the HTTP layer never imports Pinia directly. */
export function setUnauthenticatedHandler(handler: UnauthenticatedHandler | null): void {
  onUnauthenticated = handler
}
export function setAdminUnauthenticatedHandler(handler: UnauthenticatedHandler | null): void {
  onAdminUnauthenticated = handler
}

export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
    'X-Client-Version': env.appVersion,
  },
  withCredentials: false,
})

/* ---------- request: auth header + correlation id ---------- */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.headers = config.headers ?? {}
  config.headers['X-Correlation-Id'] = uuid()
  if (!config.skipAuth) {
    const token = storeFor(config.url).getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/* ---------- response: refresh-once queue + error normalization ---------- */
let refreshPromise: Promise<AuthTokens | null> | null = null

async function refreshTokens(): Promise<AuthTokens | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null
  try {
    const { data } = await http.post<{ data: AuthTokens }>(
      '/auth/refresh',
      { refreshToken },
      { skipAuth: true, skipRefresh: true },
    )
    tokenStorage.set(data.data)
    return data.data
  } catch {
    return null
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const normalized = normalizeError(error)
    const config = (axios.isAxiosError(error) ? error.config : undefined) as AxiosRequestConfig | undefined

    // A suspended account ends the session everywhere; retrying or refreshing cannot help.
    if (normalized.code === 'ACCOUNT_SUSPENDED' && config && !config.skipAuth) {
      if (isAdminRequest(config.url)) {
        adminTokenStorage.clear()
        onAdminUnauthenticated?.()
      } else {
        tokenStorage.clear()
        onUnauthenticated?.()
      }
      return Promise.reject(normalized)
    }

    if (normalized.status === 401 && config && isAdminRequest(config.url) && !config.skipAuth) {
      adminTokenStorage.clear()
      onAdminUnauthenticated?.()
      return Promise.reject(normalized)
    }

    if (normalized.status === 401 && config && !config.skipRefresh && !config._retried && !config.skipAuth) {
      config._retried = true
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null
      })
      const tokens = await refreshPromise
      if (tokens) {
        config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${tokens.accessToken}` }
        return http.request(config)
      }
      tokenStorage.clear()
      onUnauthenticated?.()
    }

    return Promise.reject(normalized)
  },
)

/* ---------- mock adapter (development fixtures) ---------- */
// Compared against the raw env var (not `isMockApi`) so Vite replaces it at build time and the
// whole fixture adapter is tree-shaken out of builds where VITE_API_MODE=live.
if (import.meta.env.VITE_API_MODE !== 'live') {
  const ready = import('@/services/mock/adapter').then(({ createMockAdapter }) => {
    const adapter = createMockAdapter()
    http.defaults.adapter = adapter
    return adapter
  })
  // Axios resolves the adapter when a request starts, so requests made before the dynamic
  // import finishes (e.g. the session bootstrap on page load) must be re-pointed explicitly.
  http.interceptors.request.use(async (config) => {
    config.adapter = await ready
    return config
  })
}

export { ApiError }
