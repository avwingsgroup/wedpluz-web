import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { adminApi } from '@/services/api/admin.api'
import { adminTokenStorage as tokenStorage, isApiError, setAdminUnauthenticatedHandler } from '@/services/http'
import type { AdminLoginResult } from '@/services/api/admin.api'
import type { AdminUser, PermissionKey } from '@/types'
import { TOTP_PERIOD_SECONDS } from '@/config/app'

/**
 * Admin dashboard session. Admin tokens are issued with an `admin` audience by the backend;
 * the frontend permission checks are a usability layer only — the API enforces every rule.
 */
export const useAdminStore = defineStore('admin', () => {
  const admin = ref<AdminUser | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'guest'>('idle')
  const sidebarCollapsed = ref(false)

  const isAuthenticated = computed(() => status.value === 'authenticated' && !!admin.value)
  const isReady = computed(() => status.value === 'authenticated' || status.value === 'guest')
  const permissions = computed<Set<PermissionKey>>(() => new Set(admin.value?.permissions ?? []))

  function can(...keys: PermissionKey[]): boolean {
    if (!admin.value) return false
    return keys.every((k) => permissions.value.has(k))
  }
  function canAny(...keys: PermissionKey[]): boolean {
    if (!admin.value) return false
    return keys.some((k) => permissions.value.has(k))
  }

  async function bootstrap() {
    if (status.value !== 'idle') return
    if (!tokenStorage.getAccessToken()) {
      status.value = 'guest'
      return
    }
    status.value = 'loading'
    try {
      admin.value = await adminApi.auth.me()
      status.value = 'authenticated'
    } catch (e) {
      if (isApiError(e) && e.isUnauthenticated) tokenStorage.clear()
      status.value = 'guest'
    }
  }

  // Each authenticator code works once: the API refuses a code (and earlier ones) after it has been used. We remember
  // the last code used here, so reusing it straight away (e.g. sign in, then approve a payout) can be explained as
  // "wait for the next code" instead of a generic error. Kept in sessionStorage (this tab only) so a refresh doesn't
  // forget it; a used code is worthless once its 30-second window has passed, so storing it carries no risk.
  const LAST_OTP_KEY = 'wp.admin_last_otp'
  const readLastOtp = (): { code: string; at: number } | null => {
    try {
      return JSON.parse(sessionStorage.getItem(LAST_OTP_KEY) ?? 'null') as { code: string; at: number } | null
    } catch {
      return null
    }
  }
  const lastOtp = ref<{ code: string; at: number } | null>(readLastOtp())
  function rememberOtp(code: string) {
    lastOtp.value = { code, at: Date.now() }
    try {
      sessionStorage.setItem(LAST_OTP_KEY, JSON.stringify(lastOtp.value))
    } catch {
      /* storage blocked: the in-memory copy still works */
    }
  }
  /** True when this code was just used: the API accepts the previous, current and next 30-second window. */
  function isRecentlyUsedOtp(code: string): boolean {
    return !!lastOtp.value && lastOtp.value.code === code && Date.now() - lastOtp.value.at < TOTP_PERIOD_SECONDS * 3 * 1000
  }

  function applyLogin(res: AdminLoginResult, otp?: string) {
    if (!res.requiresTwoFactor && res.tokens && res.admin) {
      tokenStorage.set(res.tokens)
      admin.value = res.admin
      status.value = 'authenticated'
      if (otp) rememberOtp(otp)
    }
    return res
  }

  async function login(payload: { email: string; password: string; otp?: string }) {
    return applyLogin(await adminApi.auth.login(payload), payload.otp)
  }

  async function confirmInvitation(token: string, otp: string) {
    return applyLogin(await adminApi.auth.confirmInvitation({ token, otp }), otp)
  }

  async function logout() {
    try {
      await adminApi.auth.logout()
    } catch {
      /* ignore */
    }
    tokenStorage.clear()
    admin.value = null
    status.value = 'guest'
  }

  // Admin token rejected (expired / revoked / role removed): drop the session; the guard redirects to login.
  setAdminUnauthenticatedHandler(() => {
    admin.value = null
    status.value = 'guest'
  })

  return { admin, status, sidebarCollapsed, isAuthenticated, isReady, permissions, can, canAny, bootstrap, login, confirmInvitation, logout, rememberOtp, isRecentlyUsedOtp }
})
