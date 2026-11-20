import { addHours } from 'date-fns'
import { created, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, tokenFor, userFromToken } from './shared'
import type { AuthResponse, AuthTokens, User } from '@/types'

const VALID_OTP = '1234'
/**
 * Google redirect-flow states issued by the mock /auth/google/redirect → expiry time. Kept in sessionStorage because
 * the redirect is a full page load (the real backend keeps them server-side).
 */
const GOOGLE_STATES_KEY = 'wp.mock_google_states'
const googleStates = {
  read: (): Record<string, number> => {
    try {
      return JSON.parse(sessionStorage.getItem(GOOGLE_STATES_KEY) ?? '{}') as Record<string, number>
    } catch {
      return {}
    }
  },
  write: (all: Record<string, number>) => {
    try {
      sessionStorage.setItem(GOOGLE_STATES_KEY, JSON.stringify(all))
    } catch {
      /* storage blocked */
    }
  },
  set(state: string, expires: number) {
    this.write({ ...this.read(), [state]: expires })
  },
  take(state: string): number | undefined {
    const all = this.read()
    const expires = all[state]
    delete all[state]
    this.write(all)
    return expires
  },
}

function tokens(user: User): AuthTokens {
  return { accessToken: tokenFor(user.id), refreshToken: `mock-refresh-${user.id}`, tokenType: 'Bearer', expiresIn: 3600, expiresAt: addHours(new Date(), 1).toISOString() }
}

function nextStep(user: User): AuthResponse['nextStep'] {
  if (!user.emailVerifiedAt) return 'verify_email'
  if (!user.username) return 'profile_setup'
  if (user.interests.length === 0) return 'interests'
  return null
}

export function registerAuthHandlers() {
  route('POST', '/auth/login', (req) => {
    const b = body<{ email: string; password: string }>(req)
    requireFields(b, ['email', 'password'])
    const user = db.users.find((u) => u.email.toLowerCase() === b.email.toLowerCase())
    if (!user || b.password.length < 6 || b.password === 'wrongpass') {
      fail(401, 'UNAUTHENTICATED', 'Incorrect email or password.')
    }
    if (user.status === 'suspended') fail(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact support.')
    const res: AuthResponse = { user, tokens: tokens(user), nextStep: nextStep(user) }
    return data(res)
  })

  route('POST', '/auth/register', (req) => {
    const b = body<{ firstName: string; lastName: string; email: string; dateOfBirth: string; password: string; passwordConfirmation: string }>(req)
    requireFields(b, ['firstName', 'lastName', 'email', 'dateOfBirth', 'password'])
    if (db.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) {
      fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { email: ['This email is already registered.'] })
    }
    if (b.password !== b.passwordConfirmation) {
      fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { passwordConfirmation: ['Passwords do not match.'] })
    }
    const user: User = {
      id: db.nextId('usr'),
      firstName: b.firstName,
      lastName: b.lastName,
      displayName: `${b.firstName} ${b.lastName}`,
      username: undefined,
      email: b.email,
      phone: null,
      avatarUrl: null,
      dateOfBirth: b.dateOfBirth,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      identityStatus: 'unverified',
      interests: [],
      roles: ['user'],
      status: 'active',
      plan: 'free',
      locale: 'en',
      city: null,
      // Unknown until profile setup: the phone selector then defaults to the visitor's current country.
      countryCode: null,
      businessProfileId: null,
      walletEnabled: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    }
    db.users.push(user)
    const res: AuthResponse = { user, tokens: tokens(user), isNewUser: true, nextStep: 'verify_email' }
    return created(res)
  })

  // Google redirect flow, simulated: "Google" approves at once and sends the browser straight to the callback.
  // Mirrors the backend: the callback must be allowed (here: this app's own /auth/google/callback), the state is
  // kept server-side, expires after 10 minutes and works once.
  route('GET', '/auth/google/redirect', (req) => {
    const redirectUri = req.query.get('redirectUri') ?? ''
    const allowed = `${window.location.origin}/auth/google/callback`
    if (redirectUri !== allowed) fail(422, 'VALIDATION_ERROR', 'This callback URL is not allowed.', { redirectUri: ['The redirect URI is not an allowed Google callback.'] })
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
    googleStates.set(state, Date.now() + 10 * 60_000)
    const url = `${redirectUri}?${new URLSearchParams({ code: `mock-google-code-${state}`, state, scope: 'openid email profile' })}`
    return data({ url, state, redirectUri, expiresIn: 600 })
  })

  route('POST', '/auth/social', (req) => {
    const b = body<{ provider: string; idToken?: string; code?: string; state?: string }>(req)
    requireFields(b, ['provider'])
    if (!b.idToken && !b.code) fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { idToken: ['The id token field is required when code is not present.'], code: ['The code field is required when id token is not present.'] })
    if (b.code) {
      const expires = b.state ? googleStates.take(b.state) : undefined
      if (!expires || expires < Date.now() || b.code !== `mock-google-code-${b.state}`) fail(401, 'UNAUTHENTICATED', 'Your Google sign-in expired. Please try again.')
    }
    const user = db.me()
    return data<AuthResponse>({ user, tokens: tokens(user), isNewUser: false, nextStep: nextStep(user) })
  })

  route('POST', '/auth/otp/send', (req) => {
    const b = body<{ email: string; purpose: string }>(req)
    requireFields(b, ['email', 'purpose'])
    return data({ sent: true, expiresInSeconds: 600, channel: 'email' }, `We sent a 4-digit code to ${b.email}`)
  })

  route('POST', '/auth/otp/verify', (req) => {
    const b = body<{ email: string; code: string; purpose: string }>(req)
    requireFields(b, ['email', 'code', 'purpose'])
    if (b.code !== VALID_OTP) fail(422, 'OTP_INVALID', 'That code is incorrect. Please try again.', { code: ['Invalid code'] })
    const user = db.users.find((u) => u.email.toLowerCase() === b.email.toLowerCase())
    if (user && b.purpose === 'email_verification') user.emailVerifiedAt = new Date().toISOString()
    return data({ verified: true, resetToken: b.purpose === 'password_reset' ? `reset-${b.code}` : null })
  })

  route('POST', '/auth/password/forgot', (req) => {
    const b = body<{ email: string }>(req)
    requireFields(b, ['email'])
    return data({ sent: true }, 'If an account exists for that email we have sent a reset code.')
  })

  route('POST', '/auth/password/reset', (req) => {
    const b = body<{ email: string; code: string; password: string; passwordConfirmation: string }>(req)
    requireFields(b, ['email', 'code', 'password'])
    if (b.code !== VALID_OTP) fail(422, 'OTP_INVALID', 'Reset code is invalid or expired.')
    if (b.password !== b.passwordConfirmation) fail(422, 'VALIDATION_ERROR', 'Passwords do not match.', { passwordConfirmation: ['Passwords do not match.'] })
    return data({ reset: true }, 'Password updated. You can now log in.')
  })

  route('POST', '/auth/refresh', (req) => {
    const b = body<{ refreshToken: string }>(req)
    const id = b.refreshToken?.replace('mock-refresh-', '')
    const user = id ? db.findUser(id) : null
    if (!user) fail(401, 'UNAUTHENTICATED', 'Refresh token invalid.')
    return data(tokens(user))
  })

  route('POST', '/auth/logout', () => noContent())

  route('GET', '/auth/me', (req) => {
    const user = userFromToken(req.authToken)
    if (!user) fail(401, 'UNAUTHENTICATED', 'Unauthenticated.')
    return data(user)
  })

  route('GET', '/me', (req) => data(requireUser(req)))
}
