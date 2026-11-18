import { describe, expect, it } from 'vitest'
import { escapeHtml, plainTextToHtml, sanitizeRichText } from '@/utils/sanitize'

describe('sanitizeRichText', () => {
  it('keeps whitelisted formatting tags', () => {
    expect(sanitizeRichText('<p>Hello <strong>world</strong></p>')).toBe('<p>Hello <strong>world</strong></p>')
  })

  it('drops script elements, keeping only inert text', () => {
    const out = sanitizeRichText('<p>Hi</p><script>alert(1)</script>')
    expect(out).not.toContain('<script')
    expect(out).toContain('<p>Hi</p>')
  })

  it('strips event handler attributes', () => {
    const out = sanitizeRichText('<p onclick="steal()">Click</p>')
    expect(out).toBe('<p>Click</p>')
  })

  it('replaces non-whitelisted elements such as img with their text', () => {
    const out = sanitizeRichText('<img src=x onerror="alert(1)">caption')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('onerror')
  })

  it('removes javascript: links but keeps safe links hardened', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
    const safe = sanitizeRichText('<a href="https://wedpluz.com">site</a>')
    expect(safe).toContain('href="https://wedpluz.com"')
    expect(safe).toContain('rel="noopener noreferrer nofollow"')
    expect(safe).toContain('target="_blank"')
  })

  it('strips style attributes', () => {
    expect(sanitizeRichText('<p style="background:url(evil)">x</p>')).toBe('<p>x</p>')
  })
})

describe('escapeHtml / plainTextToHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;')
  })

  it('turns paragraphs and line breaks into escaped HTML', () => {
    expect(plainTextToHtml('Line 1\nLine 2\n\n<b>Next</b>')).toBe('<p>Line 1<br>Line 2</p><p>&lt;b&gt;Next&lt;/b&gt;</p>')
  })
})
