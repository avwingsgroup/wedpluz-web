import axios, { type AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/types/api'

/**
 * Normalized application error. Every failure that leaves the HTTP layer is an ApiError,
 * so UI code never has to inspect Axios internals.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | string
  readonly errors: Record<string, string[]>
  readonly correlationId: string | null
  readonly isNetwork: boolean
  readonly isCancelled: boolean

  constructor(init: {
    message: string
    status: number
    code: ApiErrorCode | string
    errors?: Record<string, string[]>
    correlationId?: string | null
    isNetwork?: boolean
    isCancelled?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.errors = init.errors ?? {}
    this.correlationId = init.correlationId ?? null
    this.isNetwork = init.isNetwork ?? false
    this.isCancelled = init.isCancelled ?? false
  }

  get isUnauthenticated(): boolean {
    return this.status === 401
  }
  get isForbidden(): boolean {
    return this.status === 403
  }
  get isNotFound(): boolean {
    return this.status === 404
  }
  get isValidation(): boolean {
    return this.status === 422
  }
  get isRateLimited(): boolean {
    return this.status === 429
  }

  /** First validation message for a given field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0]
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'The request could not be processed.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'We could not find what you were looking for.',
  409: 'This action conflicts with the current state. Please refresh and try again.',
  422: 'Please check the highlighted fields.',
  429: 'Too many attempts. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again shortly.',
  502: 'The service is temporarily unavailable.',
  503: 'The service is temporarily unavailable.',
}

export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) return error

  if (axios.isCancel(error)) {
    return new ApiError({ message: 'Request cancelled', status: 0, code: 'CANCELLED', isCancelled: true })
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<Partial<ApiErrorBody>>
    const status = axiosError.response?.status ?? 0
    const body = axiosError.response?.data
    if (!axiosError.response) {
      return new ApiError({
        message: 'Network error. Check your connection and try again.',
        status: 0,
        code: 'NETWORK_ERROR',
        isNetwork: true,
      })
    }
    return new ApiError({
      message: body?.message || DEFAULT_MESSAGES[status] || 'Unexpected error',
      status,
      code: body?.code ?? codeFromStatus(status),
      errors: body?.errors,
      correlationId: body?.correlationId ?? (axiosError.response.headers?.['x-correlation-id'] as string | undefined) ?? null,
    })
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message, status: 0, code: 'SERVER_ERROR' })
  }
  return new ApiError({ message: 'Unexpected error', status: 0, code: 'SERVER_ERROR' })
}

function codeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'VALIDATION_ERROR'
    case 429:
      return 'RATE_LIMITED'
    default:
      return 'SERVER_ERROR'
  }
}
