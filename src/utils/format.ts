import { format, formatDistanceToNowStrict, isSameDay, isSameMonth, isSameYear, parseISO } from 'date-fns'
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/config/app'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function getCurrencyFormatter(currency: string, maximumFractionDigits = 0): Intl.NumberFormat {
  const key = `${currency}:${maximumFractionDigits}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits,
      minimumFractionDigits: 0,
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter
}

/** Amounts are always transported as minor units (kobo/cents) to avoid floating point drift. */
export function formatMoney(minor: number, currency: string = DEFAULT_CURRENCY, options: { compact?: boolean } = {}): string {
  const major = minor / 100
  if (options.compact && Math.abs(major) >= 1_000_000) {
    const symbol = getCurrencyFormatter(currency).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''
    return `${symbol}${(major / 1_000_000).toFixed(major % 1_000_000 === 0 ? 0 : 1)}M`
  }
  if (options.compact && Math.abs(major) >= 10_000) {
    const symbol = getCurrencyFormatter(currency).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''
    return `${symbol}${(major / 1_000).toFixed(major % 1_000 === 0 ? 0 : 1)}K`
  }
  return getCurrencyFormatter(currency, Number.isInteger(major) ? 0 : 2).format(major)
}

export function formatPriceLabel(minor: number, currency?: string, fromPrefix = false): string {
  if (minor <= 0) return 'Free'
  return fromPrefix ? `From ${formatMoney(minor, currency)}` : formatMoney(minor, currency)
}

export function formatNumber(value: number, options: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options.compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(value)
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

function ordinal(day: number): string {
  const s = ['th', 'st', 'nd', 'rd'] as const
  const v = day % 100
  return `${day}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

/** "7th Dec, 2025" */
export function formatDate(value: string | Date): string {
  const d = toDate(value)
  return `${ordinal(d.getDate())} ${format(d, 'MMM, yyyy')}`
}

/** "Tues 4th Nov, 2025" */
export function formatDateWithDay(value: string | Date): string {
  const d = toDate(value)
  return `${format(d, 'EEE')} ${ordinal(d.getDate())} ${format(d, 'MMM, yyyy')}`
}

/** "6th Sept - 19th Oct, 2025" or "16th - 18th Dec, 2025" */
export function formatDateRange(start: string | Date, end?: string | Date | null): string {
  const s = toDate(start)
  if (!end) return formatDate(s)
  const e = toDate(end)
  if (isSameDay(s, e)) return formatDate(s)
  if (isSameMonth(s, e)) return `${ordinal(s.getDate())} - ${ordinal(e.getDate())} ${format(e, 'MMM, yyyy')}`
  if (isSameYear(s, e)) return `${ordinal(s.getDate())} ${format(s, 'MMM')} - ${ordinal(e.getDate())} ${format(e, 'MMM, yyyy')}`
  return `${formatDate(s)} - ${formatDate(e)}`
}

/** "4:00pm" */
export function formatTime(value: string | Date): string {
  return format(toDate(value), 'h:mmaaa')
}

/** "4:00pm - 6:00pm WAT" */
export function formatTimeRange(start: string | Date, end?: string | Date | null, tz = 'WAT'): string {
  return end ? `${formatTime(start)} - ${formatTime(end)} ${tz}` : `${formatTime(start)} ${tz}`
}

export function formatDateTime(value: string | Date): string {
  return format(toDate(value), 'MMM d, yyyy . h:mmaaa')
}

export function formatRelative(value: string | Date): string {
  const text = formatDistanceToNowStrict(toDate(value), { addSuffix: false })
  return text
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, ' m')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ weeks?/, 'w')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')
}

export function formatRelativeLong(value: string | Date): string {
  return `${formatDistanceToNowStrict(toDate(value))} ago`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  if (user.length <= 2) return `${user[0] ?? ''}***@${domain}`
  return `${user.slice(0, 2)}***@${domain}`
}
