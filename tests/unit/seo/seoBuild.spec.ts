import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderPageHtml, renderRobots, renderSitemap } from '../../../build/seo-plugin'
import { STATIC_PAGES } from '@/config/seo'

const template = readFileSync(resolve(__dirname, '../../../index.html'), 'utf8').replace(/%VITE_WEB_ORIGIN%/g, 'https://wedpluz.com')
const about = STATIC_PAGES.find((p) => p.path === '/about')!

describe('build-time SEO output', () => {
  it('renders page-specific heads for non-JS crawlers and link previews', () => {
    const html = renderPageHtml(template, about, 'https://wedpluz.com', true)
    expect(html).toContain('<title>About Wedpluz</title>')
    expect(html).toContain('<link rel="canonical" href="https://wedpluz.com/about" />')
    expect(html).toContain('<meta property="og:url" content="https://wedpluz.com/about" />')
    expect(html).toContain(`<meta name="description" content="${about.description}" />`)
    expect(html).toContain(`<h1>${about.heading}</h1>`)
    expect(html).toMatch(/<meta name="robots" content="index, follow/)
  })

  it('escapes HTML in generated values', () => {
    const html = renderPageHtml(template, { ...about, title: 'Tickets & <More>' }, 'https://wedpluz.com', true)
    expect(html).toContain('<title>Tickets &amp; &lt;More&gt; | Wedpluz</title>')
  })

  it('marks every page noindex on non-production builds', () => {
    expect(renderPageHtml(template, about, 'https://staging.wedpluz.com', false)).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(renderRobots(false, 'https://staging.wedpluz.com', [])).toBe('User-agent: *\nDisallow: /\n')
  })

  it('lists private areas and all sitemaps in robots.txt', () => {
    const robots = renderRobots(true, 'https://wedpluz.com', ['https://api.wedpluz.com/sitemaps/events.xml'])
    expect(robots).toContain('Disallow: /checkout')
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Sitemap: https://wedpluz.com/sitemap.xml')
    expect(robots).toContain('Sitemap: https://api.wedpluz.com/sitemaps/events.xml')
    expect(robots).not.toMatch(/Disallow: \/events/)
  })

  it('produces a valid sitemap for every public marketing page', () => {
    const xml = renderSitemap('https://wedpluz.com', '2026-11-19')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml.match(/<url>/g)).toHaveLength(STATIC_PAGES.length)
    expect(xml).toContain('<loc>https://wedpluz.com/</loc>')
    expect(xml).toContain('<loc>https://wedpluz.com/vendors</loc>')
  })
})
