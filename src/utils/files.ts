import { MAX_UPLOAD_MB } from '@/config/app'

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const

export interface FileValidationResult {
  ok: boolean
  error?: string
}

export function validateUpload(
  file: File,
  options: { maxMb?: number; accept?: readonly string[] } = {},
): FileValidationResult {
  const maxMb = options.maxMb ?? MAX_UPLOAD_MB
  const accept = options.accept ?? IMAGE_MIME_TYPES
  if (!accept.includes(file.type)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${accept.map((t) => t.split('/')[1]).join(', ')}` }
  }
  if (file.size > maxMb * 1024 * 1024) {
    return { ok: false, error: `File is too large. Max size ${maxMb}MB` }
  }
  return { ok: true }
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Neutralises spreadsheet formula injection: values starting with = + - @ (or a tab/CR)
 * are prefixed with an apostrophe so Excel/Sheets treat them as text. Numbers are kept.
 */
export function csvCell(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  const text = String(value ?? '')
  return FORMULA_PREFIX.test(text) ? `'${text}` : text
}
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0] ?? {})
  const escape = (v: unknown) => `"${csvCell(v).replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}
