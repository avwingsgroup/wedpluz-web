import { APP_NAME } from '@/config/app'

export interface SeoMeta {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'article' | 'event'
  noIndex?: boolean
  jsonLd?: Record<string, unknown>
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}

/** Lightweight SEO helper for an SPA. For full crawlability pair with prerendering (see docs/deployment.md). */
export function applySeo(meta: SeoMeta): void {
  if (typeof document === 'undefined') return
  const title = meta.title ? `${meta.title} | ${APP_NAME}` : APP_NAME
  document.title = title
  if (meta.description) {
    upsertMeta('meta[name="description"]', { name: 'description', content: meta.description })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: meta.description })
  }
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: meta.type ?? 'website' })
  if (meta.url) upsertMeta('meta[property="og:url"]', { property: 'og:url', content: meta.url })
  if (meta.image) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: meta.image })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: meta.noIndex ? 'noindex,nofollow' : 'index,follow' })

  const existing = document.getElementById('wp-jsonld')
  if (existing) existing.remove()
  if (meta.jsonLd) {
    const script = document.createElement('script')
    script.id = 'wp-jsonld'
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(meta.jsonLd)
    document.head.appendChild(script)
  }
}
