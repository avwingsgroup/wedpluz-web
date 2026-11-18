import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ApiError, isApiError, normalizeError } from '@/services/http/errors'

function axiosErrorWith(status: number, data: unknown, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  const response = { status, data, statusText: String(status), headers, config } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response)
}

describe('normalizeError', () => {
  it('keeps the Laravel envelope: message, code, field errors and correlation id', () => {
    const err = normalizeError(
      axiosErrorWith(422, {
        message: 'Please check the highlighted fields.',
        code: 'VALIDATION_ERROR',
        errors: { email: ['The email has already been taken.'] },
        correlationId: 'abc-123',
      }),
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(422)
    expect(err.isValidation).toBe(true)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fieldError('email')).toBe('The email has already been taken.')
    expect(err.correlationId).toBe('abc-123')
  })

  it('preserves domain codes used by checkout', () => {
    const err = normalizeError(axiosErrorWith(409, { message: 'Seat T4-S3 was just taken.', code: 'SEAT_TAKEN' }))
    expect(err.code).toBe('SEAT_TAKEN')
    expect(err.message).toBe('Seat T4-S3 was just taken.')
  })

  it('derives a code and a friendly message when the body is missing', () => {
    const err = normalizeError(axiosErrorWith(403, undefined))
    expect(err.code).toBe('FORBIDDEN')
    expect(err.isForbidden).toBe(true)
    expect(err.message).toBe('You do not have permission to perform this action.')
  })

  it('falls back to the correlation id response header', () => {
    const err = normalizeError(axiosErrorWith(500, { message: 'Boom' }, { 'x-correlation-id': 'hdr-1' }))
    expect(err.correlationId).toBe('hdr-1')
    expect(err.code).toBe('SERVER_ERROR')
  })

  it('flags network failures without a response', () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
    const err = normalizeError(new AxiosError('Network Error', 'ERR_NETWORK', config))
    expect(err.isNetwork).toBe(true)
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.status).toBe(0)
  })

  it('flags cancelled requests', () => {
    const err = normalizeError(new axios.CanceledError())
    expect(err.isCancelled).toBe(true)
    expect(err.code).toBe('CANCELLED')
  })

  it('returns ApiError instances unchanged and wraps plain errors', () => {
    const original = new ApiError({ message: 'x', status: 404, code: 'NOT_FOUND' })
    expect(normalizeError(original)).toBe(original)
    const wrapped = normalizeError(new Error('kaput'))
    expect(isApiError(wrapped)).toBe(true)
    expect(wrapped.message).toBe('kaput')
  })

  it('exposes status helpers', () => {
    expect(new ApiError({ message: '', status: 401, code: 'UNAUTHENTICATED' }).isUnauthenticated).toBe(true)
    expect(new ApiError({ message: '', status: 429, code: 'RATE_LIMITED' }).isRateLimited).toBe(true)
    expect(new ApiError({ message: '', status: 404, code: 'NOT_FOUND' }).isNotFound).toBe(true)
  })
})
