import { TOTP_PERIOD_SECONDS } from '@/config/app'
import { normalizeError } from '@/services/http'

// Shared wording for the admin authenticator-code screens (login step 2, invitation confirmation, payout approval).
// Codes are 6-digit TOTP: a new one every 30 seconds (aligned to the clock), and each works once.

/** Seconds until the authenticator app shows its next code. */
export const secondsUntilNextCode = (now = Date.now()) => TOTP_PERIOD_SECONDS - (Math.floor(now / 1000) % TOTP_PERIOD_SECONDS)

/** Keeps digits only, so "482 917" or "482-917" becomes "482917" (sent as a string: leading zeros survive). */
export const cleanOtp = (raw: string) => raw.replace(/\D/g, '')

export const REUSED_CODE_MESSAGE = (now = Date.now()) =>
  `You just used this code. Wait for the next code from your authenticator app — a new one appears in ${secondsUntilNextCode(now)}s.`

export type AdminOtpOutcome =
  | { kind: 'invalid_code'; message: string }
  | { kind: 'credentials'; message: string }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'other'; message: string }

/**
 * Maps an API error from a code screen to what to show:
 * - 422 OTP_INVALID → wrong, expired or already-used code: clear the boxes and ask for the current code;
 * - 401 → (login step 2) the email or password no longer match: back to step 1;
 * - 429 → too many attempts: the API's message already says how long to wait.
 */
export function adminOtpOutcome(error: unknown): AdminOtpOutcome {
  const err = normalizeError(error)
  if (err.code === 'OTP_INVALID' || err.errors.otp) {
    return { kind: 'invalid_code', message: 'That code didn’t work. Enter the current code from your authenticator app.' }
  }
  if (err.status === 401) return { kind: 'credentials', message: 'Your email or password no longer match. Sign in again.' }
  if (err.status === 429) return { kind: 'rate_limited', message: err.message || 'Too many attempts. Please wait a moment and try again.' }
  return { kind: 'other', message: err.message || 'Something went wrong. Please try again.' }
}
