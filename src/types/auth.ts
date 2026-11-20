import type { ISODateString } from './api'
import type { User } from './user'

export interface AuthTokens {
  accessToken: string
  refreshToken: string | null
  tokenType: 'Bearer'
  expiresIn: number
  expiresAt?: ISODateString
}

export interface LoginPayload {
  email: string
  password: string
  deviceName?: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  dateOfBirth: string
  password: string
  passwordConfirmation: string
  acceptedTerms: true
}

/**
 * Google sign-in. Either an ID token from Google Identity Services (One Tap), or the authorization `code` + `state`
 * from the redirect flow started with GET /auth/google/redirect (the backend keeps the state and PKCE verifier).
 */
export type SocialAuthPayload =
  | { provider: 'google'; idToken: string; deviceName?: string }
  | { provider: 'google'; code: string; state: string; deviceName?: string }

/** GET /auth/google/redirect: where to send the browser to start Google sign-in. */
export interface GoogleAuthRedirect {
  /** Google's consent URL (carries client id, state, PKCE challenge and the callback). */
  url: string
  state: string
  /** The callback Google returns to; must be an allowed frontend URL. */
  redirectUri: string
  /** Seconds before the state expires. */
  expiresIn: number
}

export interface AuthResponse {
  user: User
  tokens: AuthTokens
  /** True when the account was created by this request (social sign-in). */
  isNewUser?: boolean
  /** Which onboarding step remains, if any. */
  nextStep?: 'verify_email' | 'profile_setup' | 'interests' | null
}

export interface VerifyOtpPayload {
  email: string
  code: string
  purpose: 'email_verification' | 'password_reset' | 'wallet_setup' | 'business_email'
}

export interface ResetPasswordPayload {
  email: string
  code: string
  password: string
  passwordConfirmation: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  password: string
  passwordConfirmation: string
}

export interface ProfileSetupPayload {
  username: string
  phone?: string
  city?: string
  countryCode?: string
  avatarUploadId?: string
}
