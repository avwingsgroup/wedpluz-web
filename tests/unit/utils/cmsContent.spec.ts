import { describe, expect, it } from 'vitest'
import { isAuthoredCms, parseFaqTopics, prepareDocument, searchFaqs, slugify } from '@/utils/cmsContent'
import { highlightSegments } from '@/utils/highlight'
import { FAQ_TOPICS } from '@/content/faqs'
import { PRIVACY, TERMS } from '@/content/legal'

describe('isAuthoredCms', () => {
  it('treats the seeded one-line placeholder as not authored', () => {
    expect(isAuthoredCms('<p>Terms and conditions content is managed by the Wedpluz team in the admin console.</p>')).toBe(false)
    expect(isAuthoredCms('')).toBe(false)
    expect(isAuthoredCms(null)).toBe(false)
  })
  it('accepts real documents', () => {
    expect(isAuthoredCms(`<h2>1. Intro</h2><p>${'Real legal text. '.repeat(40)}</p>`)).toBe(true)
  })
})

describe('prepareDocument', () => {
  it('adds unique ids to h2/h3 and builds the outline', () => {
    const doc = prepareDocument('<h2>1. About</h2><p>x</p><h3>Fees &amp; prices</h3><h2>About</h2><h2>1. About</h2>')
    expect(doc.headings).toEqual([
      { id: '1-about', text: '1. About', level: 2 },
      { id: 'fees-and-prices', text: 'Fees & prices', level: 3 },
      { id: 'about', text: 'About', level: 2 },
      { id: '1-about-2', text: '1. About', level: 2 },
    ])
    expect(doc.html).toContain('<h2 id="1-about">')
    expect(doc.readingMinutes).toBe(1)
  })
  it('gives the built-in legal documents a full outline', () => {
    expect(prepareDocument(TERMS.html).headings.filter((h) => h.level === 2)).toHaveLength(16)
    expect(prepareDocument(PRIVACY.html).headings.filter((h) => h.level === 2)).toHaveLength(15)
  })
})

describe('slugify', () => {
  it('produces url-safe ids', () => {
    expect(slugify('What’s a “service fee”?')).toBe('what-s-a-service-fee')
    expect(slugify('Café & crème')).toBe('cafe-and-creme')
    expect(slugify('***')).toBe('section')
  })
})

describe('parseFaqTopics', () => {
  it('groups questions under h2 topics', () => {
    const topics = parseFaqTopics('<h2>Tickets</h2><h3>Where is my ticket?</h3><p>Under My Tickets.</p><p>Also by email.</p><h2>Refunds</h2><h3>Can I cancel?</h3><p>Yes.</p>')
    expect(topics.map((t) => t.title)).toEqual(['Tickets', 'Refunds'])
    expect(topics[0]!.items[0]).toEqual({ id: 'where-is-my-ticket', question: 'Where is my ticket?', answer: 'Under My Tickets.\n\nAlso by email.' })
  })
  it('falls back to a General topic without h2', () => {
    const topics = parseFaqTopics('<h3>Q1</h3><p>A1</p><h3>Q2</h3><p>A2</p>')
    expect(topics).toHaveLength(1)
    expect(topics[0]!.title).toBe('General')
    expect(topics[0]!.items).toHaveLength(2)
  })
})

describe('searchFaqs', () => {
  it('ranks question matches first and stems simple plurals', () => {
    const results = searchFaqs('refunds', FAQ_TOPICS)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.item.question.toLowerCase()).toContain('refund')
  })
  it('requires every meaningful term to match', () => {
    expect(searchFaqs('withdraw money', FAQ_TOPICS)[0]!.item.id).toBe('withdraw')
    expect(searchFaqs('zzzz nothing', FAQ_TOPICS)).toEqual([])
    expect(searchFaqs('how do I', FAQ_TOPICS)).toEqual([])
  })
})

describe('FAQ content', () => {
  it('has unique ids across all topics', () => {
    const ids = FAQ_TOPICS.flatMap((t) => t.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('highlightSegments', () => {
  it('marks matching terms case-insensitively', () => {
    expect(highlightSegments('Cancel a Ticket', 'tickets')).toEqual([
      { text: 'Cancel a ', match: false },
      { text: 'Ticket', match: true },
    ])
    expect(highlightSegments('No query', '')).toEqual([{ text: 'No query', match: false }])
  })
})
