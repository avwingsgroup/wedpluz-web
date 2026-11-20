import { afterEach, describe, expect, it, vi } from 'vitest'
import { countryByIso } from '@/data/countries'
import { detectCountry, flagEmoji, formatNational, normaliseNational, parsePhone, phoneProblem, toE164 } from '@/utils/phone'
import { intlPhoneSchema } from '@/validations/common'

const NG = countryByIso('NG')!
const GB = countryByIso('GB')!
const CI = countryByIso('CI')!

afterEach(() => vi.restoreAllMocks())

const mockTimeZone = (timeZone: string) =>
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat)

describe('detectCountry', () => {
  it('prefers an explicit hint', () => {
    expect(detectCountry(['gh'])).toBe('GH')
    expect(detectCountry([null, 'XX', 'KE'])).toBe('KE')
  })
  it('uses the time zone, which beats an en-US browser language', () => {
    mockTimeZone('Africa/Lagos')
    expect(detectCountry()).toBe('NG')
    mockTimeZone('Europe/London')
    expect(detectCountry()).toBe('GB')
  })
  it('falls back to Nigeria for an unknown time zone and no locale region', () => {
    mockTimeZone('Etc/UTC')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en'])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en')
    expect(detectCountry()).toBe('NG')
  })
  it('uses the locale region when the time zone is unknown', () => {
    mockTimeZone('Etc/UTC')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CM'])
    expect(detectCountry()).toBe('CM')
  })
})

describe('toE164 / normaliseNational', () => {
  it('drops the trunk 0, spaces and a repeated calling code', () => {
    expect(toE164(NG, '0801 234 5678')).toBe('+2348012345678')
    expect(toE164(NG, '8012345678')).toBe('+2348012345678')
    expect(toE164(NG, '+234 801 234 5678')).toBe('+2348012345678')
    expect(toE164(NG, '002348012345678')).toBe('+2348012345678')
    expect(toE164(GB, '07700 900123')).toBe('+447700900123')
    expect(toE164(NG, '')).toBe('')
  })
  it('keeps the leading 0 where it is part of the number', () => {
    expect(normaliseNational(CI, '0701020304')).toBe('0701020304')
  })
})

describe('parsePhone', () => {
  it('splits E.164 into country and national number', () => {
    expect(parsePhone('+2348012345678')).toEqual({ country: NG, national: '8012345678' })
    expect(parsePhone('+447700900123')?.country.iso2).toBe('GB')
  })
  it('resolves shared calling codes to the main country unless another is preferred', () => {
    expect(parsePhone('+14165550123')?.country.iso2).toBe('US')
    expect(parsePhone('+14165550123', 'CA')?.country.iso2).toBe('CA')
  })
  it('ignores values that are not international numbers', () => {
    expect(parsePhone('08012345678')).toBeNull()
    expect(parsePhone('')).toBeNull()
  })
})

describe('phoneProblem and intlPhoneSchema', () => {
  it('accepts valid numbers and empty input', () => {
    expect(phoneProblem('+2348012345678')).toBeNull()
    expect(phoneProblem('')).toBeNull()
    expect(intlPhoneSchema.safeParse('+447700900123').success).toBe(true)
  })
  it('explains a wrong length for the country', () => {
    expect(phoneProblem('+234801234567')).toBe('Nigeria numbers have 10 digits after +234')
    expect(phoneProblem('+44770090')).toBe('United Kingdom numbers have 9 or 10 digits after +44')
    const res = intlPhoneSchema.safeParse('+23480123')
    expect(res.success).toBe(false)
  })
  it('rejects garbage', () => {
    expect(phoneProblem('12345')).toBe('Enter a valid phone number')
  })
})

describe('display helpers', () => {
  it('formats national numbers in groups', () => {
    expect(formatNational('8012345678')).toBe('801 234 5678')
    expect(formatNational('12345')).toBe('123 45')
  })
  it('builds flag emoji from ISO codes', () => {
    expect(flagEmoji('ng')).toBe('🇳🇬')
  })
})
