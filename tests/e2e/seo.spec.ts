import { expect, test, type Page } from '@playwright/test'
import { loginAsUser } from './helpers'

/** Reads the SEO-relevant head state after the SPA has rendered a page. */
async function head(page: Page) {
  return page.evaluate(() => {
    const meta = (sel: string) => document.head.querySelector(sel)?.getAttribute('content') ?? null
    const ld = document.head.querySelector('script[data-seo="jsonld"]')?.textContent
    const graph = ld ? (JSON.parse(ld)['@graph'] as Array<Record<string, unknown>>) : []
    return {
      title: document.title,
      description: meta('meta[name="description"]'),
      robots: meta('meta[name="robots"]'),
      canonical: document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ?? null,
      ogTitle: meta('meta[property="og:title"]'),
      ogImage: meta('meta[property="og:image"]'),
      ogUrl: meta('meta[property="og:url"]'),
      twitterCard: meta('meta[name="twitter:card"]'),
      types: graph.map((n) => n['@type']),
      graph,
      h1Count: document.querySelectorAll('h1').length,
    }
  })
}

test.describe('SEO', () => {
  test('event pages expose Event + BreadcrumbList structured data and page-specific tags', async ({ page }) => {
    await page.goto('/events/movie-in-the-park-denim-edition?ref=PROMO1')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(async () => (await head(page)).types).toEqual(['Event', 'BreadcrumbList'])
    const h = await head(page)
    expect(h.title).toMatch(/^Movie in the park .* \| Wedpluz$/)
    expect(h.canonical).toMatch(/\/events\/movie-in-the-park-denim-edition$/)
    expect(h.ogUrl).toBe(h.canonical)
    expect(h.ogImage).toMatch(/^https?:\/\//)
    expect(h.twitterCard).toBe('summary_large_image')
    expect(h.description!.length).toBeLessThanOrEqual(158)
    expect(h.h1Count).toBe(1)
    const event = h.graph[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(event.startDate).toBeTruthy()
    expect(event.offers.length).toBeGreaterThan(0)
  })

  test('vendor profiles expose LocalBusiness structured data', async ({ page }) => {
    await page.goto('/vendors')
    await page.locator('main a[href^="/vendors/"]').first().click()
    await expect.poll(async () => (await head(page)).types).toEqual(['LocalBusiness', 'BreadcrumbList'])
    expect((await head(page)).title).toMatch(/ – .* in .* \| Wedpluz$/)
  })

  test('category listings are indexable landing pages; filtered views are noindex', async ({ page }) => {
    await page.goto('/events?categorySlug=food-drinks&timeOfDay=evening&utm_source=newsletter')
    await expect.poll(async () => (await head(page)).title).toMatch(/Food .*Events/i)
    const filtered = await head(page)
    // Canonical points at the clean category landing page; the filtered view carries no structured data.
    expect(filtered.canonical).toMatch(/\/events\?categorySlug=food-drinks$/)
    expect(filtered.types).toEqual([])

    await page.goto('/events?categorySlug=food-drinks')
    await expect.poll(async () => (await head(page)).types).toContain('BreadcrumbList')
    expect((await head(page)).canonical).toMatch(/\/events\?categorySlug=food-drinks$/)
  })

  test('home exposes Organization and WebSite (sitelinks search) data', async ({ page }) => {
    await page.goto('/')
    await expect.poll(async () => (await head(page)).types).toEqual(['Organization', 'WebSite'])
    const h = await head(page)
    expect(h.title).toBe('Wedpluz – Discover Events, Tickets & Vendors in Nigeria')
    expect(h.h1Count).toBe(1)
  })

  test('FAQs expose FAQPage data', async ({ page }) => {
    await page.goto('/faqs')
    await expect.poll(async () => (await head(page)).types).toEqual(['FAQPage'])
  })

  test('private pages are noindex without canonical or structured data', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/tickets')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const h = await head(page)
    expect(h.robots).toBe('noindex, nofollow')
    expect(h.canonical).toBeNull()
    expect(h.types).toEqual([])
    expect(h.title).toBe('My Tickets | Wedpluz')
  })

  test('navigating away resets page-specific tags', async ({ page }) => {
    await page.goto('/events/movie-in-the-park-denim-edition')
    await expect.poll(async () => (await head(page)).types).toContain('Event')
    await page.getByRole('link', { name: 'Hire Vendors' }).first().click()
    await expect(page).toHaveURL(/\/vendors$/)
    await expect.poll(async () => (await head(page)).types).not.toContain('Event')
    const h = await head(page)
    expect(h.ogImage).toMatch(/\/og\/wedpluz-default\.jpg$/)
    expect(h.canonical).toMatch(/\/vendors$/)
  })

  test('static SEO assets are served', async ({ request }) => {
    for (const path of ['/site.webmanifest', '/og/wedpluz-default.jpg', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
    }
  })
})
