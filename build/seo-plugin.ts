import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { PRIVATE_PATH_PREFIXES, SITE, STATIC_PAGES, formatTitle, type StaticPageSeo } from '../src/config/seo.ts'

/**
 * Build-time SEO for a client-rendered app.
 *
 * Web production build:
 *  - robots.txt  allows crawling of public pages, disallows private areas, lists sitemaps
 *  - sitemap.xml all public marketing pages (events/vendors come from backend sitemaps, see docs/seo.md)
 *  - <page>/index.html for every public marketing page with its own title, description,
 *    canonical, Open Graph/Twitter tags and a <noscript> summary, so crawlers and link-preview
 *    bots that do not execute JavaScript still see correct, page-specific metadata.
 * Staging / non-production web builds and every admin build: robots.txt disallows everything and
 * every HTML file carries `noindex, nofollow`.
 */
export interface SeoPluginOptions {
  target: 'web' | 'admin'
  mode: string
  origin: string
  /** Extra sitemap URLs (e.g. backend-generated event/vendor sitemaps), comma separated. */
  extraSitemaps?: string
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escapeXml = escapeHtml

function setTag(html: string, pattern: RegExp, replacement: string): string {
  if (!pattern.test(html)) throw new Error(`[seo] tag not found in index.html: ${pattern}`)
  return html.replace(pattern, replacement)
}

function withMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const re = new RegExp(`<meta ${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content="[^"]*" \\/>`)
  return setTag(html, re, `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`)
}

export function renderPageHtml(template: string, page: StaticPageSeo, origin: string, indexable: boolean): string {
  const url = page.path === '/' ? `${origin}/` : `${origin}${page.path}`
  const title = formatTitle(page.title)
  const social = page.title
  let html = template
  html = setTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  html = withMeta(html, 'name', 'description', page.description)
  html = withMeta(html, 'name', 'robots', indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow')
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`)
  html = withMeta(html, 'property', 'og:title', social)
  html = withMeta(html, 'property', 'og:description', page.description)
  html = withMeta(html, 'property', 'og:url', url)
  html = withMeta(html, 'name', 'twitter:title', social)
  html = withMeta(html, 'name', 'twitter:description', page.description)
  html = setTag(html, /<h1>[\s\S]*?<\/h1>/, `<h1>${escapeHtml(page.heading)}</h1>`)
  html = setTag(html, /(<\/h1>\s*<p>)[\s\S]*?(<\/p>)/, `$1${escapeHtml(page.intro)}$2`)
  return html
}

export function renderRobots(indexable: boolean, origin: string, extraSitemaps: string[]): string {
  if (!indexable) return 'User-agent: *\nDisallow: /\n'
  const lines = ['User-agent: *', 'Allow: /', ...PRIVATE_PATH_PREFIXES.map((p) => `Disallow: ${p}`), '', `Sitemap: ${origin}/sitemap.xml`, ...extraSitemaps.map((s) => `Sitemap: ${s}`)]
  return `${lines.join('\n')}\n`
}

export function renderSitemap(origin: string, lastmod: string): string {
  const urls = STATIC_PAGES.map(
    (p) => `  <url>\n    <loc>${escapeXml(p.path === '/' ? `${origin}/` : `${origin}${p.path}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority.toFixed(1)}</priority>\n  </url>`,
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function seoPlugin(options: SeoPluginOptions): Plugin {
  let config: ResolvedConfig
  const origin = options.origin.replace(/\/$/, '')
  return {
    name: 'wedpluz:seo',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir)
      const indexPath = path.join(outDir, 'index.html')
      if (!fs.existsSync(indexPath)) return
      const template = fs.readFileSync(indexPath, 'utf8')
      const indexable = options.target === 'web' && options.mode === 'production'
      const extra = (options.extraSitemaps ?? '').split(',').map((s) => s.trim()).filter(Boolean)

      fs.writeFileSync(path.join(outDir, 'robots.txt'), renderRobots(indexable, origin, extra))

      if (options.target === 'admin') {
        let html = withMeta(template, 'name', 'robots', 'noindex, nofollow')
        html = setTag(html, /<title>[\s\S]*?<\/title>/, `<title>${SITE.name} Admin</title>`)
        fs.writeFileSync(indexPath, html)
        return
      }

      fs.writeFileSync(path.join(outDir, 'sitemap.xml'), renderSitemap(origin, new Date().toISOString().slice(0, 10)))
      for (const page of STATIC_PAGES) {
        const html = renderPageHtml(template, page, origin, indexable)
        const file = page.path === '/' ? indexPath : path.join(outDir, page.path.slice(1), 'index.html')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, html)
      }
      config.logger.info(`[seo] ${indexable ? 'indexable' : 'noindex'} build: robots.txt, sitemap.xml and ${STATIC_PAGES.length} page heads for ${origin}`)
    },
  }
}
