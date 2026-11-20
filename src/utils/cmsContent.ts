import type { FaqItem, FaqTopic } from '@/content/faqs'

// Helpers for CMS-managed pages (About, Terms, Privacy, FAQs). The CMS is the source of truth once the team has
// written real content there; until then the API returns a one-line placeholder and the pages fall back to the
// curated copy shipped with the app.

const textOf = (html: string) => {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ')
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.textContent ?? ''
}

/** Minimum amount of real text (characters) before CMS content replaces the built-in copy. */
export const AUTHORED_MIN_CHARS = 400

/** True when the CMS document has real content rather than the seeded one-line placeholder. */
export function isAuthoredCms(html: string | null | undefined, minChars = AUTHORED_MIN_CHARS): boolean {
  if (!html) return false
  return textOf(html).replace(/\s+/g, ' ').trim().length >= minChars
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'section'
  )
}

export interface DocHeading {
  id: string
  text: string
  level: 2 | 3
}

export interface PreparedDocument {
  html: string
  headings: DocHeading[]
  readingMinutes: number
}

/**
 * Adds stable, unique ids to h2/h3 headings (for the table of contents and deep links) and estimates reading time.
 * Input must already be sanitised; this only adds `id` attributes.
 */
export function prepareDocument(html: string): PreparedDocument {
  const words = textOf(html).trim().split(/\s+/).filter(Boolean).length
  const readingMinutes = Math.max(1, Math.round(words / 220))
  if (typeof DOMParser === 'undefined') return { html, headings: [], readingMinutes }
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return { html, headings: [], readingMinutes }
  const used = new Set<string>()
  const headings: DocHeading[] = []
  for (const el of Array.from(root.querySelectorAll('h2, h3'))) {
    const text = (el.textContent ?? '').trim()
    if (!text) continue
    let id = el.id || slugify(text)
    for (let n = 2; used.has(id); n++) id = `${slugify(text)}-${n}`
    used.add(id)
    el.id = id
    headings.push({ id, text, level: el.tagName === 'H2' ? 2 : 3 })
  }
  return { html: root.innerHTML, headings, readingMinutes }
}

/**
 * Parses a CMS FAQ document into topics: `h2` starts a topic, `h3` (or `h4`) starts a question and the following
 * blocks are its answer. Documents without `h2` become a single "General" topic.
 */
export function parseFaqTopics(html: string): FaqTopic[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const topics: FaqTopic[] = []
  let topic: FaqTopic | null = null
  let item: FaqItem | null = null
  const ensureTopic = () => {
    if (!topic) {
      topic = { id: 'general', title: 'General', description: '', icon: 'sparkles', items: [] }
      topics.push(topic)
    }
    return topic
  }
  for (const node of Array.from(doc.body.firstElementChild?.children ?? [])) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (node.tagName === 'H2') {
      topic = { id: slugify(text), title: text, description: '', icon: 'sparkles', items: [] }
      topics.push(topic)
      item = null
    } else if (node.tagName === 'H3' || node.tagName === 'H4') {
      item = { id: slugify(text), question: text, answer: '' }
      ensureTopic().items.push(item)
    } else if (item) {
      item.answer = item.answer ? `${item.answer}\n\n${text}` : text
    }
  }
  return topics.filter((t) => t.items.length)
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')

const STOP_WORDS = new Set(['a', 'an', 'the', 'i', 'my', 'do', 'how', 'to', 'is', 'can', 'of', 'for', 'and', 'what', 'in', 'on', 'it', 'me', 'why'])

export interface FaqSearchResult {
  item: FaqItem
  topic: FaqTopic
  score: number
}

/** Ranks FAQ answers for a free-text query: question matches outweigh answer matches; all terms must match. */
export function searchFaqs(query: string, topics: FaqTopic[], limit = 20): FaqSearchResult[] {
  const terms = normalise(query)
    .split(/[^a-z0-9₦]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  if (!terms.length) return []
  const results: FaqSearchResult[] = []
  for (const topic of topics) {
    for (const item of topic.items) {
      const q = normalise(item.question)
      const a = normalise(item.answer)
      const t = normalise(topic.title)
      let score = 0
      let all = true
      for (const term of terms) {
        // simple stemming: "refunds" matches "refund", "cancelling" matches "cancel"
        const stem = term.replace(/(ing|ed|es|s)$/, '')
        const root = stem.length >= 3 ? stem : term
        const inQ = q.includes(root)
        const inA = a.includes(root)
        const inT = t.includes(root)
        if (!inQ && !inA && !inT) {
          all = false
          break
        }
        score += (inQ ? 5 : 0) + (inA ? 2 : 0) + (inT ? 1 : 0)
      }
      if (all) results.push({ item, topic, score: score + (q.includes(normalise(query).trim()) ? 10 : 0) })
    }
  }
  return results.sort((x, y) => y.score - x.score).slice(0, limit)
}
