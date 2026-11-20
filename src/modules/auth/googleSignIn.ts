import { authApi } from '@/services/api/auth.api'
import { env } from '@/config/env'

// Google sign-in, redirect flow (works for everyone, including people not signed in to Google in this browser):
//   1. GET /auth/google/redirect?redirectUri=<origin>/auth/google/callback → Google's consent URL. The backend keeps
//      the state and the PKCE verifier, so the browser never sees the client secret.
//   2. The browser goes to Google, then returns to /auth/google/callback?code=…&state=…
//   3. GoogleCallbackPage sends { provider: 'google', code, state } to POST /auth/social.
// Before leaving we remember where to come back to and the state we expect (sessionStorage: this tab only).

const PENDING_KEY = 'wp.google_sign_in'

interface PendingGoogleSignIn {
  state: string
  returnTo: string | null
  startedAt: number
}

export const googleCallbackUrl = () => `${(env.webOrigin || window.location.origin).replace(/\/+$/, '')}/auth/google/callback`

/** Only same-site paths ("/tickets?x=1"), never "//host" or "/\host", which browsers treat as other sites. */
export function safeReturnPath(value: unknown): string | null {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : null
}

/** Asks the backend for Google's consent URL and navigates there. Resolves only if navigation fails. */
export async function startGoogleRedirect(returnTo?: unknown): Promise<void> {
  const res = await authApi.googleRedirect(googleCallbackUrl())
  const pending: PendingGoogleSignIn = { state: res.state, returnTo: safeReturnPath(returnTo), startedAt: Date.now() }
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    /* storage blocked: the backend still validates the state */
  }
  window.location.assign(res.url)
}

/**
 * Reads and clears what startGoogleRedirect stored. `stateMatches` is false when this tab started a sign-in with a
 * different state (a stale or forged callback); null when nothing was stored (new tab, storage blocked), in which
 * case the backend's own state check decides.
 */
export function consumePendingGoogleSignIn(state: string | null): { returnTo: string | null; stateMatches: boolean | null } {
  let pending: PendingGoogleSignIn | null = null
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as PendingGoogleSignIn | null
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    pending = null
  }
  if (!pending) return { returnTo: null, stateMatches: null }
  return { returnTo: safeReturnPath(pending.returnTo), stateMatches: pending.state === state }
}
