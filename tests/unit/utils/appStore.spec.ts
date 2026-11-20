import { describe, expect, it } from 'vitest'
import { detectMobilePlatform, storeLinkForDevice } from '@/utils/appStore'
import { APP_STORE_LINKS } from '@/config/app'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

describe('app store links', () => {
  it('detects phones', () => {
    expect(detectMobilePlatform(IPHONE)).toBe('ios')
    expect(detectMobilePlatform(ANDROID)).toBe('android')
    expect(detectMobilePlatform(WINDOWS)).toBeNull()
  })
  it('sends Apple devices to the App Store and everyone else to Google Play', () => {
    expect(storeLinkForDevice(IPHONE)).toBe(APP_STORE_LINKS.ios)
    expect(storeLinkForDevice(MAC)).toBe(APP_STORE_LINKS.ios)
    expect(storeLinkForDevice(ANDROID)).toBe(APP_STORE_LINKS.android)
    expect(storeLinkForDevice(WINDOWS)).toBe(APP_STORE_LINKS.android)
  })
})
