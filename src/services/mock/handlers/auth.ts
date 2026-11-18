import { addHours } from 'date-fns'
import { created, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, tokenFor, userFromToken } from './shared'
import type { AuthResponse, AuthTokens, User } from '@/types'

const VALID_OTP = '1234'

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
      countryCode: 'NG',
      businessProfileId: null,
      walletEnabled: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    }
    db.users.push(user)
    const res: AuthResponse = { user, tokens: tokens(user), isNewUser: true, nextStep: 'verify_email' }
    return created(res)
  })

  route('POST', '/auth/social', (req) => {
    const b = body<{ provider: string; idToken: string }>(req)
    requireFields(b, ['provider', 'idToken'])
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
