import { beforeEach, describe, expect, it } from 'vitest'
import { formatTitle, isPrivatePath, staticPageFor, toDescription, SITE, STATIC_PAGES } from '@/config/seo'
import { applySeo, canonicalFor, robotsFor, type SeoContext } from '@/utils/seo'

const ORIGIN = 'http://localhost:5173'
const ctx = (path: string, query = '', indexable = true): SeoContext => ({ path, query: new URLSearchParams(query), indexable })
const meta = (sel: string) => document.head.querySelector<HTMLMetaElement>(sel)?.getAttribute('content') ?? null

describe('config/seo helpers', () => {
  it('suffixes titles with the brand once', () => {
    expect(formatTitle('Events Near You')).toBe('Events Near You | Wedpluz')
    expect(formatTitle('About Wedpluz')).toBe('About Wedpluz')
    expect(formatTitle(undefined)).toBe(SITE.homeTitle)
  })

  it('builds plain-text descriptions cut at a word boundary', () => {
    const d = toDescription(`<p>${'Celebrate with friends and family at the gala. '.repeat(10)}</p>`)
    expect(d.length).toBeLessThanOrEqual(158)
    expect(d.endsWith('…')).toBe(true)
    expect(d).not.toMatch(/<|>/)
    expect(toDescription('Short &amp; sweet')).toBe('Short & sweet')
  })

  it('classifies private areas without false positives', () => {
    for (const p of ['/auth/login', '/tickets', '/tickets/tkt_1', '/settings/account', '/u/usr_1', '/manage/events/1', '/c/join/abc', '/admin']) expect(isPrivatePath(p)).toBe(true)
    for (const p of ['/', '/events', '/events/gala', '/vendors/shot-it-moi', '/about', '/authors']) expect(isPrivatePath(p)).toBe(false)
  })

  it('keeps curated titles and descriptions within search-result limits', () => {
    for (const page of [...STATIC_PAGES, { path: 'default', title: SITE.homeTitle, description: SITE.defaultDescription }]) {
      expect(formatTitle(page.title).length, `${page.path} title`).toBeLessThanOrEqual(60)
      expect(page.description.length, `${page.path} description`).toBeGreaterThanOrEqual(50)
      expect(page.description.length, `${page.path} description`).toBeLessThanOrEqual(158)
    }
  })

  it('finds curated metadata for static pages, ignoring trailing slashes', () => {
    expect(staticPageFor('/pricing/')?.title).toMatch(/Pricing/)
    expect(staticPageFor('/events/gala')).toBeUndefined()
  })
})

describe('canonical and robots', () => {
  it('keeps only landing-page parameters in canonicals', () => {
    expect(canonicalFor('/events', new URLSearchParams('categorySlug=weddings&timeOfDay=evening&page=1&utm_source=x'))).toBe(`${ORIGIN}/events?categorySlug=weddings`)
    expect(canonicalFor('/events/', new URLSearchParams('page=3&location=Lagos'))).toBe(`${ORIGIN}/events?location=Lagos&page=3`)
    expect(canonicalFor('/events/gala', new URLSearchParams('ref=JOHN'))).toBe(`${ORIGIN}/events/gala`)
    expect(canonicalFor('/', new URLSearchParams('utm_source=pwa'))).toBe(`${ORIGIN}/`)
  })

  it('never indexes private pages or non-production builds', () => {
    expect(robotsFor({}, ctx('/events'))).toMatch(/^index, follow/)
    expect(robotsFor({ noIndex: true }, ctx('/events'))).toBe('noindex, follow')
    expect(robotsFor({}, ctx('/wallet'))).toBe('noindex, nofollow')
    expect(robotsFor({}, ctx('/events', '', false))).toBe('noindex, nofollow')
  })
})

describe('applySeo', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('writes the full tag set for a public page', () => {
    applySeo({ title: 'Luxury Wedding Gala – Lagos', description: 'Black-tie gala.', image: 'https://res.cloudinary.com/x/gala.jpg' }, ctx('/events/luxury-wedding-gala', 'ref=AB'))
    expect(document.title).toBe('Luxury Wedding Gala – Lagos | Wedpluz')
    expect(meta('meta[name="description"]')).toBe('Black-tie gala.')
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${ORIGIN}/events/luxury-wedding-gala`)
    expect(meta('meta[property="og:title"]')).toBe('Luxury Wedding Gala – Lagos')
    expect(meta('meta[property="og:url"]')).toBe(`${ORIGIN}/events/luxury-wedding-gala`)
    expect(meta('meta[property="og:image"]')).toBe('https://res.cloudinary.com/x/gala.jpg')
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image')
    expect(meta('meta[property="og:image:width"]')).toBeNull()
  })

  it('falls back to the branded share image with dimensions', () => {
    applySeo({}, ctx('/about'))
    expect(meta('meta[property="og:image"]')).toBe(`${ORIGIN}/og/wedpluz-default.jpg`)
    expect(meta('meta[property="og:image:width"]')).toBe('1200')
    expect(document.title).toBe('About Wedpluz')
  })

  it('resets stale values between pages', () => {
    applySeo({ title: 'Gala', description: 'Gala description', image: 'https://cdn/x.jpg', jsonLd: { '@type': 'Event', name: 'Gala' } }, ctx('/events/gala'))
    applySeo({}, ctx('/vendors'))
    expect(meta('meta[name="description"]')).toBe(staticPageFor('/vendors')?.description)
    expect(meta('meta[property="og:image"]')).toBe(`${ORIGIN}/og/wedpluz-default.jpg`)
    expect(document.head.querySelectorAll('script[data-seo="jsonld"]')).toHaveLength(0)
  })

  it('emits JSON-LD as one escaped @graph and never on private pages', () => {
    applySeo({ jsonLd: [{ '@type': 'Event', name: '</script><b>x' }, { '@type': 'BreadcrumbList' }] }, ctx('/events/gala'))
    const script = document.head.querySelector('script[data-seo="jsonld"]')!
    expect(script.textContent).not.toContain('</script>')
    const graph = JSON.parse(script.textContent!)
    expect(graph['@context']).toBe('https://schema.org')
    expect(graph['@graph']).toHaveLength(2)

    applySeo({ jsonLd: { '@type': 'Thing' } }, ctx('/tickets'))
    expect(document.head.querySelector('script[data-seo="jsonld"]')).toBeNull()
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('keeps JSON-LD on staging builds so it can be validated before launch', () => {
    applySeo({ jsonLd: { '@type': 'Event' } }, ctx('/events/gala', '', false))
    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow')
    expect(document.head.querySelector('script[data-seo="jsonld"]')).not.toBeNull()
  })
})
