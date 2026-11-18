import type { AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import type { ApiResponse, CursorResponse, PaginatedResponse } from '@/types/api'
import { http } from './client'
import { ApiError } from './errors'

export interface RequestOptions extends Omit<AxiosRequestConfig, 'url' | 'method' | 'data' | 'params'> {
  /** Optional runtime validation of the response payload (zod). Fails loudly in dev, soft-logs in prod. */
  schema?: ZodType
}

function validate<T>(data: T, schema: ZodType | undefined, url: string): T {
  if (!schema) return data
  const result = schema.safeParse(data)
  if (result.success) return result.data as T
  const message = `[api] Response validation failed for ${url}`
  if (import.meta.env.DEV) {
    console.error(message, result.error.issues)
    throw new ApiError({ message, status: 0, code: 'SERVER_ERROR' })
  }
  console.warn(message, result.error.issues)
  return data
}

/** Unwraps `{ data }` envelopes. */
export async function get<T>(url: string, params?: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
  const { schema, ...config } = options
  const res = await http.get<ApiResponse<T>>(url, { ...config, params: compactParams(params) })
  return validate(res.data?.data as T, schema, url)
}

export async function getPaginated<T>(
  url: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<PaginatedResponse<T>> {
  const { schema, ...config } = options
  const res = await http.get<PaginatedResponse<T>>(url, { ...config, params: compactParams(params) })
  return validate(res.data, schema, url)
}

export async function getCursor<T>(
  url: string,
  params?: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<CursorResponse<T>> {
  const { schema, ...config } = options
  const res = await http.get<CursorResponse<T>>(url, { ...config, params: compactParams(params) })
  return validate(res.data, schema, url)
}

export async function post<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
  const { schema, ...config } = options
  const res = await http.post<ApiResponse<T>>(url, body, config)
  return validate(res.data?.data as T, schema, url)
}

export async function put<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
  const { schema, ...config } = options
  const res = await http.put<ApiResponse<T>>(url, body, config)
  return validate(res.data?.data as T, schema, url)
}

export async function patch<T, B = unknown>(url: string, body?: B, options: RequestOptions = {}): Promise<T> {
  const { schema, ...config } = options
  const res = await http.patch<ApiResponse<T>>(url, body, config)
  return validate(res.data?.data as T, schema, url)
}

export async function del<T = void>(url: string, options: RequestOptions = {}): Promise<T> {
  const { schema, ...config } = options
  const res = await http.delete<ApiResponse<T>>(url, config)
  return validate(res.data?.data as T, schema, url)
}

export async function upload<T>(
  url: string,
  formData: FormData,
  options: RequestOptions & { onProgress?: (percent: number) => void } = {},
): Promise<T> {
  const { schema, onProgress, ...config } = options
  const res = await http.post<ApiResponse<T>>(url, formData, {
    ...config,
    headers: { ...(config.headers ?? {}), 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100))
    },
  })
  return validate(res.data?.data as T, schema, url)
}

/** Drops undefined / null / '' / 'all' so URLs stay clean and cache keys stable. */
export function compactParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!params) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue
    out[key] = value
  }
  return out
}
