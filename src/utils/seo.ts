import { env } from '@/config/env'
import { CANONICAL_QUERY_PARAMS, SITE, formatTitle, isPrivatePath, staticPageFor, toDescription } from '@/config/seo'

/**
 * Document head manager for the SPA.
 *
 * Every navigation resets the head to route defaults (router afterEach), and pages refine it
 * with `useSeo`. Each call writes the complete tag set, so values from a previous page never
 * leak into the next one. Crawlers that do not run JavaScript get per-page HTML generated at
 * build time (vite.config.ts) and, for events/vendors, the backend share endpoint (docs/seo.md).
 */
export type JsonLd = Record<string, unknown>

export interface SeoMeta {
  /** Page title without the site suffix; the suffix is added automatically. */
  title?: string
  description?: string
  /** Absolute URL or site path. Defaults to the branded 1200×630 share image. */
  image?: string | null
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  /** Absolute URL or site path. Defaults to the current path plus whitelisted query params. */
  canonical?: string
  type?: 'website' | 'article' | 'profile'
  /** Keep this page out of search results (still lets crawlers follow its links). */
  noIndex?: boolean
  /** One or more schema.org nodes (without @context); emitted as a single @graph. */
  jsonLd?: JsonLd | JsonLd[]
}

export interface SeoContext {
  path: string
  query: URLSearchParams
  /** Only production builds may be indexed; dev, test and staging are always noindex. */
  indexable: boolean
}

export const INDEXABLE_BUILD = import.meta.env.MODE === 'production' && __APP_TARGET__ !== 'admin'

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  return `${env.webOrigin}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

/** Canonical URL: no trailing slash, only parameters that define a distinct landing page. */
export function canonicalFor(path: string, query: URLSearchParams): string {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : '/'
  const params = new URLSearchParams()
  for (const key of CANONICAL_QUERY_PARAMS[clean] ?? []) {
    const value = query.get(key)?.trim()
    if (!value || value === 'all' || (key === 'page' && value === '1')) continue
    params.set(key, value)
  }
  const qs = params.toString()
  return `${env.webOrigin}${clean === '/' ? '/' : clean}${qs ? `?${qs}` : ''}`
}

export function robotsFor(meta: Pick<SeoMeta, 'noIndex'>, ctx: SeoContext): string {
  if (!ctx.indexable || isPrivatePath(ctx.path)) return 'noindex, nofollow'
  if (meta.noIndex) return 'noindex, follow'
  return 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
}

function currentContext(): SeoContext {
  return { path: window.location.pathname, query: new URLSearchParams(window.location.search), indexable: INDEXABLE_BUILD }
}

function setMeta(key: 'name' | 'property', id: string, content: string | null | undefined) {
  const selector = `meta[${key}="${id}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (content === null || content === undefined || content === '') {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(key, id)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!href) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

export function applySeo(meta: SeoMeta = {}, ctx: SeoContext = currentContext()): void {
  if (typeof document === 'undefined') return
  const page = staticPageFor(ctx.path)
  const rawTitle = meta.title ?? page?.title
  const title = formatTitle(rawTitle)
  const socialTitle = rawTitle && rawTitle !== SITE.homeTitle ? rawTitle : SITE.homeTitle
  const description = toDescription(meta.description || page?.description || SITE.defaultDescription)
  const canonical = meta.canonical ? absoluteUrl(meta.canonical) : canonicalFor(ctx.path, ctx.query)
  const robots = robotsFor(meta, ctx)
  const isDefaultImage = !meta.image
  const image = absoluteUrl(meta.image || SITE.defaultImage.path)
  const imageAlt = meta.imageAlt ?? (isDefaultImage ? SITE.defaultImage.alt : socialTitle)

  document.title = title
  setMeta('name', 'description', description)
  setMeta('name', 'robots', robots)
  setLink('canonical', robots.startsWith('noindex') && isPrivatePath(ctx.path) ? null : canonical)

  setMeta('property', 'og:site_name', SITE.name)
  setMeta('property', 'og:locale', SITE.locale)
  setMeta('property', 'og:type', meta.type ?? 'website')
  setMeta('property', 'og:title', socialTitle)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', canonical)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:alt', imageAlt)
  setMeta('property', 'og:image:width', isDefaultImage ? String(SITE.defaultImage.width) : meta.imageWidth ? String(meta.imageWidth) : null)
  setMeta('property', 'og:image:height', isDefaultImage ? String(SITE.defaultImage.height) : meta.imageHeight ? String(meta.imageHeight) : null)

  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:site', SITE.twitterHandle)
  setMeta('name', 'twitter:title', socialTitle)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', image)
  setMeta('name', 'twitter:image:alt', imageAlt)

  document.head.querySelectorAll('script[data-seo="jsonld"]').forEach((el) => el.remove())
  const nodes = meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : []
  // Emitted on staging too (so the Rich Results Test can validate it), never on private or noindexed pages.
  if (nodes.length && !isPrivatePath(ctx.path) && !meta.noIndex) {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.seo = 'jsonld'
    // `<` is escaped so user content can never close the script element.
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')
    document.head.appendChild(script)
  }
}
