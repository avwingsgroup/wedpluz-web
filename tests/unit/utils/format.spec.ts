import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatPercent,
  formatPriceLabel,
  formatTime,
  initials,
  maskEmail,
  pluralize,
  truncate,
} from '@/utils/format'

describe('formatMoney', () => {
  it('converts minor units (kobo) to naira without decimals for whole amounts', () => {
    expect(formatMoney(500000)).toBe('₦5,000')
  })

  it('keeps two decimals for fractional amounts', () => {
    expect(formatMoney(123456)).toBe('₦1,234.56')
  })

  it('formats compact thousands and millions', () => {
    expect(formatMoney(1_500_000_00, 'NGN', { compact: true })).toBe('₦1.5M')
    expect(formatMoney(25_000_00, 'NGN', { compact: true })).toBe('₦25K')
    expect(formatMoney(5_000_00, 'NGN', { compact: true })).toBe('₦5,000')
  })

  it('supports other currencies', () => {
    expect(formatMoney(1999, 'USD')).toBe('$19.99')
  })
})

describe('formatPriceLabel', () => {
  it('labels zero and negative prices as Free', () => {
    expect(formatPriceLabel(0)).toBe('Free')
  })
  it('adds the From prefix for ranges', () => {
    expect(formatPriceLabel(250000, 'NGN', true)).toBe('From ₦2,500')
  })
})

describe('date formatting (design copy)', () => {
  it('uses ordinal days like the designs: "7th Dec, 2026"', () => {
    expect(formatDate('2026-12-07T18:00:00')).toBe('7th Dec, 2026')
    expect(formatDate('2026-12-01T18:00:00')).toBe('1st Dec, 2026')
    expect(formatDate('2026-12-22T18:00:00')).toBe('22nd Dec, 2026')
    expect(formatDate('2026-12-13T18:00:00')).toBe('13th Dec, 2026')
  })

  it('collapses ranges within the same month', () => {
    expect(formatDateRange('2026-12-16T10:00:00', '2026-12-18T10:00:00')).toBe('16th - 18th Dec, 2026')
  })

  it('spans months within the same year', () => {
    expect(formatDateRange('2026-09-06T10:00:00', '2026-10-19T10:00:00')).toBe('6th Sep - 19th Oct, 2026')
  })

  it('treats same-day ranges as a single date', () => {
    expect(formatDateRange('2026-12-07T10:00:00', '2026-12-07T22:00:00')).toBe('7th Dec, 2026')
  })

  it('formats times in lowercase 12h', () => {
    expect(formatTime('2026-12-07T16:00:00')).toBe('4:00pm')
  })
})

describe('text helpers', () => {
  it('builds initials from the first two words', () => {
    expect(initials('Geoffery  Admin Usir')).toBe('GA')
    expect(initials('')).toBe('')
  })

  it('truncates with an ellipsis', () => {
    expect(truncate('Luxury Wedding Gala', 10)).toBe('Luxury We…')
    expect(truncate('Short', 10)).toBe('Short')
  })

  it('pluralizes with formatted counts', () => {
    expect(pluralize(1, 'ticket')).toBe('1 ticket')
    expect(pluralize(1200, 'ticket')).toBe('1,200 tickets')
  })

  it('masks emails for display', () => {
    expect(maskEmail('johnbrown@gmail.com')).toBe('jo***@gmail.com')
    expect(maskEmail('ab@x.com')).toBe('a***@x.com')
  })

  it('formats percentages', () => {
    expect(formatPercent(12.345, 1)).toBe('12.3%')
  })
})
