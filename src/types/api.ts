/**
 * Transport-level contracts shared with the Laravel backend.
 * See docs/backend-handoff/api-contracts.md §1 "Response envelope".
 */

export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  lastPage: number
}

export interface CursorMeta {
  nextCursor: string | null
  prevCursor: string | null
  perPage: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface CursorResponse<T> {
  data: T[]
  meta: CursorMeta
}

export interface ApiErrorBody {
  message: string
  code: ApiErrorCode | string
  errors?: Record<string, string[]>
  correlationId?: string
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_FAILED'
  | 'TICKETS_UNAVAILABLE'
  | 'SEAT_TAKEN'
  | 'PROMO_INVALID'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'ACCOUNT_SUSPENDED'
  | 'IDENTITY_UNVERIFIED'
  | 'EMAIL_UNVERIFIED'
  | 'INSUFFICIENT_FUNDS'
  | 'PIN_INVALID'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'CANCELLED'

export interface ListQuery {
  page?: number
  perPage?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
}

export type ISODateString = string
export type Id = string
export type Currency = 'NGN' | 'USD' | 'GBP' | 'EUR'

/** Money is always an integer in minor units (kobo / cents). */
export interface Money {
  amount: number
  currency: Currency
}
