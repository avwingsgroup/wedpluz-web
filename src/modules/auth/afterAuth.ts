import type { RouteLocationRaw } from 'vue-router'
import type { AuthResponse } from '@/types'

const NEXT_STEP_ROUTES: Record<NonNullable<AuthResponse['nextStep']>, string> = {
  verify_email: 'auth.verify-email',
  profile_setup: 'auth.profile-setup',
  interests: 'auth.interests',
}

/** Where to go after signing in: an unfinished onboarding step first, then the page the user came from, else home. */
export function destinationAfterAuth(res: Pick<AuthResponse, 'nextStep'>, returnTo?: string | null): RouteLocationRaw {
  if (res.nextStep) return { name: NEXT_STEP_ROUTES[res.nextStep] }
  return returnTo || { name: 'home' }
}
