import { APP_STORE_LINKS } from '@/config/app'

export type MobilePlatform = 'ios' | 'android' | null

/** Best-effort platform sniff for choosing an app-store link; never used for anything security-relevant. */
export function detectMobilePlatform(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): MobilePlatform {
  if (/android/i.test(ua)) return 'android'
  // iPadOS 13+ reports itself as "Macintosh" but has touch.
  const touchMac = /macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  if (/iphone|ipad|ipod/i.test(ua) || touchMac) return 'ios'
  return null
}

/** Store link for the current device: App Store on Apple devices (incl. desktop Safari/macOS), Google Play otherwise. */
export function storeLinkForDevice(ua?: string): string {
  const platform = detectMobilePlatform(ua)
  if (platform) return APP_STORE_LINKS[platform]
  const agent = ua ?? (typeof navigator === 'undefined' ? '' : navigator.userAgent)
  return /macintosh|mac os x/i.test(agent) ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android
}
