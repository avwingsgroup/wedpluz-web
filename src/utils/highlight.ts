export interface TextSegment {
  text: string
  match: boolean
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Splits text into plain/matched segments for rendering search highlights without v-html. */
export function highlightSegments(text: string, query: string): TextSegment[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/(ing|ed|es|s)$/i, ''))
    .filter((t) => t.length > 2)
  if (!terms.length) return [{ text, match: false }]
  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi')
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: terms.some((t) => t.toLowerCase() === part.toLowerCase()) }))
}
