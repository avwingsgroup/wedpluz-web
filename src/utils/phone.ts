import { COUNTRIES, MAIN_FOR_DIAL, TIMEZONE_COUNTRY, countryByIso, type Country } from '@/data/countries'

/** Countries whose numbers keep their leading 0 after the calling code (Italian landlines and its neighbours). */
const KEEPS_LEADING_ZERO = new Set(['IT', 'VA', 'SM', 'CI'])
const FALLBACK_COUNTRY = 'NG'

const digits = (s: string) => s.replace(/\D/g, '')

/** 🇳🇬 from "NG". Windows doesn't draw flag emoji (it shows the letters), so callers should check `canShowFlagEmoji`. */
export const flagEmoji = (iso2: string) => String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
export const canShowFlagEmoji = () => typeof navigator === 'undefined' || !/Windows/i.test(navigator.userAgent)

/**
 * The visitor's current country, without a network call: an explicit hint (saved profile, backend IP lookup) first,
 * then the device time zone (reliable even when the browser language is en-US), then the browser locale's region,
 * then Nigeria.
 */
export function detectCountry(hints: Array<string | null | undefined> = []): string {
  for (const h of hints) if (countryByIso(h)) return h!.toUpperCase()
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TIMEZONE_COUNTRY[tz]) return TIMEZONE_COUNTRY[tz]!
  } catch {
    /* Intl unavailable */
  }
  const langs = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language]
  for (const l of langs) {
    const region = /[-_]([A-Za-z]{2})\b/.exec(l ?? '')?.[1]
    if (region && countryByIso(region)) return region.toUpperCase()
  }
  return FALLBACK_COUNTRY
}

/** Splits an E.164 number into country + national digits. Shared codes (+1, +44…) prefer `preferredIso` when it matches. */
export function parsePhone(value: string | null | undefined, preferredIso?: string | null): { country: Country; national: string } | null {
  const d = digits(value ?? '')
  if (!value?.trim().startsWith('+') || d.length < 4) return null
  const preferred = countryByIso(preferredIso)
  if (preferred && d.startsWith(preferred.dial)) return { country: preferred, national: d.slice(preferred.dial.length) }
  for (let len = 3; len >= 1; len--) {
    const dial = d.slice(0, len)
    const matches = COUNTRIES.filter((c) => c.dial === dial)
    if (matches.length) {
      const country = matches.find((c) => c.iso2 === MAIN_FOR_DIAL[dial]) ?? matches[0]!
      return { country, national: d.slice(len) }
    }
  }
  return null
}

/** National digits as the user would type them, normalised: no spaces, no trunk 0, no repeated calling code. */
export function normaliseNational(country: Country, input: string): string {
  let d = digits(input)
  const typedFull = input.trim().startsWith('+') || input.trim().startsWith('00')
  if (input.trim().startsWith('00')) d = d.slice(2)
  if (typedFull && d.startsWith(country.dial)) d = d.slice(country.dial.length)
  else if (!typedFull && d.startsWith(country.dial) && d.length > Math.max(...(country.lengths ?? [10]))) d = d.slice(country.dial.length)
  if (d.startsWith('0') && !KEEPS_LEADING_ZERO.has(country.iso2)) d = d.replace(/^0+/, '')
  return d
}

/** E.164 ("+2348012345678"), or '' when nothing was typed. */
export function toE164(country: Country, input: string): string {
  const national = normaliseNational(country, input)
  return national ? `+${country.dial}${national}` : ''
}

/** Human-readable problem with an E.164 number for its country, or null when it looks valid. */
export function phoneProblem(e164: string, preferredIso?: string | null): string | null {
  if (!e164) return null
  const parsed = parsePhone(e164, preferredIso)
  if (!parsed) return 'Enter a valid phone number'
  const { country, national } = parsed
  const total = country.dial.length + national.length
  if (country.lengths && !country.lengths.includes(national.length)) {
    const want = country.lengths.length === 1 ? `${country.lengths[0]} digits` : `${country.lengths.slice(0, -1).join(', ')} or ${country.lengths.at(-1)} digits`
    return `${country.name} numbers have ${want} after +${country.dial}`
  }
  if (national.length < 4 || total > 15) return 'Enter a valid phone number'
  return null
}

/** Groups national digits for display: 801 234 5678. */
export function formatNational(national: string): string {
  const d = digits(national)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}
