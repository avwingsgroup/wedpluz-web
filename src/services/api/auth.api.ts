import { request } from '@/services/http'
import type { AuthResponse, AuthTokens, GoogleAuthRedirect, LoginPayload, RegisterPayload, ResetPasswordPayload, SocialAuthPayload, User, VerifyOtpPayload } from '@/types'

export const authApi = {
  login: (payload: LoginPayload) => request.post<AuthResponse, LoginPayload>('/auth/login', payload, { skipAuth: true, skipRefresh: true }),
  register: (payload: RegisterPayload) => request.post<AuthResponse, RegisterPayload>('/auth/register', payload, { skipAuth: true }),
  social: (payload: SocialAuthPayload) => request.post<AuthResponse, SocialAuthPayload>('/auth/social', payload, { skipAuth: true }),
  /** Starts the Google redirect flow. `redirectUri` must be on the backend's allowlist (else 422). */
  googleRedirect: (redirectUri: string) => request.get<GoogleAuthRedirect>('/auth/google/redirect', { redirectUri }, { skipAuth: true }),
  sendOtp: (email: string, purpose: VerifyOtpPayload['purpose']) =>
    request.post<{ sent: boolean; expiresInSeconds: number; channel: string }>('/auth/otp/send', { email, purpose }, { skipAuth: true }),
  verifyOtp: (payload: VerifyOtpPayload) => request.post<{ verified: boolean; resetToken: string | null }, VerifyOtpPayload>('/auth/otp/verify', payload, { skipAuth: true }),
  forgotPassword: (email: string) => request.post<{ sent: boolean }>('/auth/password/forgot', { email }, { skipAuth: true }),
  resetPassword: (payload: ResetPasswordPayload) => request.post<{ reset: boolean }, ResetPasswordPayload>('/auth/password/reset', payload, { skipAuth: true }),
  refresh: (refreshToken: string) => request.post<AuthTokens>('/auth/refresh', { refreshToken }, { skipAuth: true, skipRefresh: true }),
  logout: () => request.post<void>('/auth/logout', undefined, { skipRefresh: true }),
  me: (signal?: AbortSignal) => request.get<User>('/auth/me', undefined, { signal, skipRefresh: false }),
}
