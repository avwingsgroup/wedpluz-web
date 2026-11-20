/** Static application configuration shared by web and admin targets. */
export const APP_NAME = 'Wedpluz'
export const DEFAULT_CURRENCY = 'NGN'
export const DEFAULT_LOCALE = 'en-NG'
export const DEFAULT_CITY = 'Port Harcourt'
export const DEFAULT_COUNTRY_CODE = 'NG'

export const STORAGE_KEYS = {
  accessToken: 'wp.access_token',
  refreshToken: 'wp.refresh_token',
  tokenExpiry: 'wp.token_expiry',
  audience: 'wp.audience',
  recentSearches: 'wp.recent_searches',
  recentLocations: 'wp.recent_locations',
  dismissedBanners: 'wp.dismissed_banners',
  locale: 'wp.locale',
} as const

export const PAGE_SIZES = {
  grid: 12,
  list: 20,
  feed: 15,
  admin: 25,
} as const

export const MAX_INTERESTS = 5
/** Customer codes (email verification, password reset, wallet setup, PIN) are 4 digits. */
export const OTP_LENGTH = 4
/** Admin two-factor codes come from an authenticator app (TOTP): always 6 digits, a new one every 30 seconds. */
export const ADMIN_OTP_LENGTH = 6
export const TOTP_PERIOD_SECONDS = 30
export const OTP_RESEND_SECONDS = 60
export const MAX_UPLOAD_MB = 5

export const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/wedpluz',
  instagram: 'https://instagram.com/wedpluz',
  x: 'https://x.com/wedpluz',
} as const

export const APP_STORE_LINKS = {
  ios: 'https://apps.apple.com/app/wedpluz',
  android: 'https://play.google.com/store/apps/details?id=com.wedpluz.app',
} as const
