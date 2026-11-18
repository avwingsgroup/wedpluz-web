import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { adminApi } from '@/services/api/admin.api'
import { adminTokenStorage as tokenStorage, isApiError, setAdminUnauthenticatedHandler } from '@/services/http'
import type { AdminUser, PermissionKey } from '@/types'

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

  async function login(payload: { email: string; password: string; otp?: string }) {
    const res = await adminApi.auth.login(payload)
    if (!res.requiresTwoFactor && res.tokens && res.admin) {
      tokenStorage.set(res.tokens)
      admin.value = res.admin
      status.value = 'authenticated'
    }
    return res
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

  return { admin, status, sidebarCollapsed, isAuthenticated, isReady, permissions, can, canAny, bootstrap, login, logout }
})
