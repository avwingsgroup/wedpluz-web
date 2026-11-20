/**
 * Safe rendering helpers for user generated content.
 * We never use v-html with raw user input. Rich text from the backend is restricted
 * to a small whitelist of tags and all attributes except href (http/https/mailto, or a same-site "/path") are stripped.
 */
const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'A', 'H2', 'H3', 'H4', 'BLOCKQUOTE'])

export function sanitizeRichText(html: string): string {
  if (typeof DOMParser === 'undefined') return escapeHtml(html)
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        const text = doc.createTextNode(child.textContent ?? '')
        child.replaceWith(text)
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/i.test(attr.value)) {
          child.setAttribute('rel', 'noopener noreferrer nofollow')
          child.setAttribute('target', '_blank')
          continue
        }
        // Same-site paths ("/terms", "/help#contact") stay in the app. "//host" and "/\host" are rejected because
        // browsers treat both as links to another site.
        if (child.tagName === 'A' && attr.name === 'href' && /^\/(?![/\\])/.test(attr.value)) continue
        child.removeAttribute(attr.name)
      }
      walk(child)
    }
  }
  walk(root)
  return root.innerHTML
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Turns plain text with newlines into paragraphs (escaped). */
export function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
