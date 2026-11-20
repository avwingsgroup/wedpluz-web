import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { STORAGE_KEYS } from '@/config/app'
import { authApi } from '@/services/api/auth.api'
import { accountApi } from '@/services/api/account.api'
import { isApiError, setUnauthenticatedHandler, tokenStorage } from '@/services/http'
import { safeStorage } from '@/utils/storage'
import type { AuthResponse, Audience, LoginPayload, RegisterPayload, User, UserRole } from '@/types'

/**
 * Authentication & session state for the public web app.
 * Admin sessions live in `admin.store.ts` and use a separate token audience.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'guest'>('idle')
  const pendingStep = ref<AuthResponse['nextStep']>(null)
  const pendingEmail = ref<string | null>(null)
  const audience = ref<Audience>((safeStorage.get(STORAGE_KEYS.audience) as Audience) || 'individuals')
  const redirectAfterLogin = ref<string | null>(null)

  const isAuthenticated = computed(() => status.value === 'authenticated' && !!user.value)
  const isReady = computed(() => status.value !== 'idle' && status.value !== 'loading')
  const roles = computed<UserRole[]>(() => user.value?.roles ?? [])
  const isVendor = computed(() => roles.value.includes('vendor') || !!user.value?.businessProfileId)
  const isOrganizer = computed(() => roles.value.includes('organizer'))
  const isPremium = computed(() => !!user.value && user.value.plan !== 'free')
  const isIdentityVerified = computed(() => user.value?.identityStatus === 'verified')
  const displayName = computed(() => user.value?.displayName ?? '')

  function applyAuth(res: AuthResponse) {
    tokenStorage.set(res.tokens)
    user.value = res.user
    status.value = 'authenticated'
    pendingStep.value = res.nextStep ?? null
    pendingEmail.value = res.user.email
  }

  /** Restores the session from a stored token on app boot. */
  async function bootstrap(): Promise<void> {
    if (status.value !== 'idle') return
    const token = tokenStorage.getAccessToken()
    if (!token) {
      status.value = 'guest'
      return
    }
    status.value = 'loading'
    try {
      user.value = await authApi.me()
      status.value = 'authenticated'
    } catch (e) {
      // Only an explicit 401 ends the session. Network errors (offline, API down) keep the
      // stored token so the user is still signed in once connectivity returns.
      if (isApiError(e) && e.isUnauthenticated) tokenStorage.clear()
      user.value = null
      status.value = 'guest'
    }
  }

  async function login(payload: LoginPayload) {
    const res = await authApi.login({ ...payload, deviceName: navigator.userAgent.slice(0, 80) })
    applyAuth(res)
    return res
  }

  async function register(payload: RegisterPayload) {
    const res = await authApi.register(payload)
    applyAuth(res)
    return res
  }

  /** Google sign-in with a One Tap ID token, or the redirect flow's code + state. */
  async function loginWithGoogle(credential: string | { code: string; state: string }) {
    const deviceName = navigator.userAgent.slice(0, 80)
    const res = await authApi.social(typeof credential === 'string' ? { provider: 'google', idToken: credential, deviceName } : { provider: 'google', ...credential, deviceName })
    applyAuth(res)
    return res
  }

  async function refreshUser() {
    if (!isAuthenticated.value) return
    user.value = await accountApi.me()
  }

  function setUser(next: User) {
    user.value = next
  }

  async function logout(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      try {
        await authApi.logout()
      } catch {
        /* token may already be invalid */
      }
    }
    tokenStorage.clear()
    user.value = null
    status.value = 'guest'
    pendingStep.value = null
  }

  function setAudience(next: Audience) {
    audience.value = next
    safeStorage.set(STORAGE_KEYS.audience, next)
  }

  function hasRole(role: UserRole) {
    return roles.value.includes(role)
  }

  // Let the HTTP layer force a logout when refresh fails.
  setUnauthenticatedHandler(() => {
    if (status.value === 'authenticated') void logout({ silent: true })
  })

  return {
    user, status, pendingStep, pendingEmail, audience, redirectAfterLogin,
    isAuthenticated, isReady, roles, isVendor, isOrganizer, isPremium, isIdentityVerified, displayName,
    bootstrap, login, register, loginWithGoogle, refreshUser, setUser, logout, setAudience, hasRole,
  }
})
