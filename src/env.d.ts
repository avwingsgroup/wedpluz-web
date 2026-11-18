/// <reference types="vite/client" />

declare const __APP_TARGET__: 'web' | 'admin'
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_APP_TARGET?: 'web' | 'admin'
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_MODE?: 'live' | 'mock'
  readonly VITE_WEB_ORIGIN?: string
  readonly VITE_ADMIN_ORIGIN?: string
  readonly VITE_REALTIME_URL?: string
  readonly VITE_REALTIME_KEY?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_PAYSTACK_PUBLIC_KEY?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_PAYPAL_CLIENT_ID?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_FIREBASE_CONFIG_JSON?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
