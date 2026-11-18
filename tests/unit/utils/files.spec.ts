import { describe, expect, it } from 'vitest'
import { csvCell, formatBytes, validateUpload } from '@/utils/files'

const file = (type: string, sizeBytes: number) => new File([new Uint8Array(sizeBytes)], 'upload', { type })

describe('validateUpload', () => {
  it('accepts allowed image types within the size limit', () => {
    expect(validateUpload(file('image/png', 1024))).toEqual({ ok: true })
  })

  it('rejects unsupported MIME types', () => {
    const res = validateUpload(file('application/x-msdownload', 10))
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/Unsupported file type/)
  })

  it('rejects files over the limit', () => {
    const res = validateUpload(file('image/jpeg', 2 * 1024 * 1024 + 1), { maxMb: 2 })
    expect(res).toEqual({ ok: false, error: 'File is too large. Max size 2MB' })
  })

  it('honours a custom accept list', () => {
    expect(validateUpload(file('application/pdf', 10), { accept: ['application/pdf'] }).ok).toBe(true)
  })
})

describe('csvCell (formula injection guard)', () => {
  it.each(['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])('prefixes %j with an apostrophe', (value) => {
    expect(csvCell(value)).toBe(`'${value}`)
  })

  it('leaves ordinary text and numbers untouched', () => {
    expect(csvCell('Luxury Wedding Gala')).toBe('Luxury Wedding Gala')
    expect(csvCell('2026-12-07')).toBe('2026-12-07')
    expect(csvCell(-1500)).toBe('-1500')
    expect(csvCell(null)).toBe('')
  })
})

describe('formatBytes', () => {
  it('uses B, KB and MB', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
