import { z } from 'zod'

/**
 * Runtime-validated environment configuration.
 * Only VITE_* values are exposed to the browser; none of them may be secrets.
 */
const envSchema = z.object({
  VITE_APP_TARGET: z.enum(['web', 'admin']).default('web'),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000/api/v1'),
  VITE_API_MODE: z.enum(['live', 'mock']).default('mock'),
  VITE_WEB_ORIGIN: z.string().default('http://localhost:5173'),
  VITE_ADMIN_ORIGIN: z.string().default('http://localhost:5174'),
  VITE_REALTIME_URL: z.string().optional().default(''),
  VITE_REALTIME_KEY: z.string().optional().default(''),
  VITE_GOOGLE_CLIENT_ID: z.string().optional().default(''),
  VITE_PAYSTACK_PUBLIC_KEY: z.string().optional().default(''),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  VITE_PAYPAL_CLIENT_ID: z.string().optional().default(''),
  VITE_GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  VITE_SENTRY_DSN: z.string().optional().default(''),
  VITE_SENTRY_ENVIRONMENT: z.string().optional().default('development'),
})

const parsed = envSchema.safeParse(import.meta.env)
if (!parsed.success) {
  // Fail loudly during development: a misconfigured environment should never ship.
  console.error('[wedpluz] Invalid environment configuration', parsed.error.flatten().fieldErrors)
}

const raw = parsed.success ? parsed.data : envSchema.parse({})

export const env = Object.freeze({
  appTarget: (typeof __APP_TARGET__ !== 'undefined' ? __APP_TARGET__ : raw.VITE_APP_TARGET) as 'web' | 'admin',
  appVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  apiBaseUrl: raw.VITE_API_BASE_URL.replace(/\/$/, ''),
  apiMode: raw.VITE_API_MODE,
  webOrigin: raw.VITE_WEB_ORIGIN.replace(/\/$/, ''),
  adminOrigin: raw.VITE_ADMIN_ORIGIN.replace(/\/$/, ''),
  realtimeUrl: raw.VITE_REALTIME_URL,
  realtimeKey: raw.VITE_REALTIME_KEY,
  googleClientId: raw.VITE_GOOGLE_CLIENT_ID,
  paystackPublicKey: raw.VITE_PAYSTACK_PUBLIC_KEY,
  stripePublishableKey: raw.VITE_STRIPE_PUBLISHABLE_KEY,
  paypalClientId: raw.VITE_PAYPAL_CLIENT_ID,
  googleMapsApiKey: raw.VITE_GOOGLE_MAPS_API_KEY,
  sentryDsn: raw.VITE_SENTRY_DSN,
  sentryEnvironment: raw.VITE_SENTRY_ENVIRONMENT,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
})

export type AppEnv = typeof env
export const isAdminTarget = env.appTarget === 'admin'
export const isMockApi = env.apiMode === 'mock'
