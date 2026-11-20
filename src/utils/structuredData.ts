import { SITE, toDescription } from '@/config/seo'
import { absoluteUrl, type JsonLd } from '@/utils/seo'
import type { Event, EventSummary, Vendor } from '@/types'

/**
 * schema.org builders (Google rich results: Event, LocalBusiness, BreadcrumbList, ItemList,
 * FAQPage, Organization, WebSite). Nodes are returned without @context; applySeo wraps them
 * in a single @graph. Only public data is used: online event links, ticket holders and
 * contact details that are not already shown publicly never appear here.
 */

const ORG_ID = () => absoluteUrl('/#organization')
const SITE_ID = () => absoluteUrl('/#website')

export function organizationLd(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID(),
    name: SITE.name,
    url: absoluteUrl('/'),
    logo: { '@type': 'ImageObject', url: absoluteUrl(SITE.logoPath), width: 512, height: 512 },
    image: absoluteUrl(SITE.defaultImage.path),
    description: SITE.defaultDescription,
    sameAs: [...SITE.sameAs],
    areaServed: { '@type': 'Country', name: 'Nigeria' },
  }
}

/** WebSite with a sitelinks search box pointing at the events search. */
export function websiteLd(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID(),
    name: SITE.name,
    url: absoluteUrl('/'),
    inLanguage: SITE.language,
    publisher: { '@id': ORG_ID() },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/events')}?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  }
}

export function itemListLd(name: string, items: Array<{ name: string; path: string; image?: string | null }>): JsonLd {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(item.path), name: item.name, ...(item.image ? { image: item.image } : {}) })),
  }
}

export function faqLd(entries: Array<{ question: string; answer: string }>): JsonLd | null {
  const valid = entries.filter((e) => e.question.trim() && e.answer.trim())
  if (!valid.length) return null
  return {
    '@type': 'FAQPage',
    mainEntity: valid.map((e) => ({ '@type': 'Question', name: e.question.trim(), acceptedAnswer: { '@type': 'Answer', text: toDescription(e.answer, 1000) } })),
  }
}

/** Parses CMS FAQ content written as <h3>Question</h3><p>Answer</p>… into question/answer pairs. */
export function parseFaqHtml(html: string): Array<{ question: string; answer: string }> {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const out: Array<{ question: string; answer: string }> = []
  let current: { question: string; answer: string } | null = null
  for (const node of Array.from(doc.body.firstElementChild?.children ?? [])) {
    if (/^H[2-4]$/.test(node.tagName)) {
      if (current) out.push(current)
      current = { question: node.textContent ?? '', answer: '' }
    } else if (current) {
      current.answer = `${current.answer} ${node.textContent ?? ''}`.trim()
    }
  }
  if (current) out.push(current)
  return out
}

const money = (minor: number) => (minor / 100).toFixed(2)

const STATUS: Record<string, string> = {
  live: 'https://schema.org/EventScheduled',
  completed: 'https://schema.org/EventScheduled',
  cancelled: 'https://schema.org/EventCancelled',
}
const ATTENDANCE: Record<string, string> = {
  physical: 'https://schema.org/OfflineEventAttendanceMode',
  online: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
}

/** Event rich result (Google Search "Events" experience). */
export function eventLd(event: Event): JsonLd {
  const url = absoluteUrl(`/events/${event.slug}`)
  const schedules = [...event.schedules].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const first = schedules[0]
  const last = schedules[schedules.length - 1]
  const venue = schedules.find((s) => s.venue)?.venue ?? null
  const place = venue
    ? {
        '@type': 'Place',
        name: venue.name,
        address: { '@type': 'PostalAddress', streetAddress: venue.address, addressLocality: venue.city, addressRegion: venue.state, addressCountry: venue.countryCode || SITE.country },
        ...(venue.lat !== null && venue.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: venue.lat, longitude: venue.lng } } : {}),
      }
    : null
  // The real meeting link is only revealed to ticket holders; the event page is the public entry point.
  const virtual = { '@type': 'VirtualLocation', url }
  const location = event.attendanceMode === 'online' ? virtual : event.attendanceMode === 'hybrid' ? [place ?? virtual, virtual] : (place ?? virtual)

  const activeTickets = event.ticketTypes.filter((t) => t.isActive)
  const offers = activeTickets.map((t) => ({
    '@type': 'Offer',
    name: t.name,
    url,
    price: money(t.price),
    priceCurrency: t.currency,
    availability: t.sold >= t.quantity ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    ...(t.salesStartAt || event.publishedAt ? { validFrom: t.salesStartAt ?? event.publishedAt } : {}),
  }))

  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    name: event.title,
    description: toDescription(event.description, 500),
    url,
    image: [event.coverUrl, ...event.gallery.slice(0, 3)].filter(Boolean),
    startDate: first?.startsAt ?? event.startsAt,
    ...(last?.endsAt || event.endsAt ? { endDate: last?.endsAt ?? event.endsAt } : {}),
    eventStatus: STATUS[event.status] ?? 'https://schema.org/EventScheduled',
    eventAttendanceMode: ATTENDANCE[event.attendanceMode] ?? ATTENDANCE.physical,
    location,
    organizer: { '@type': event.organizer.isVendor ? 'Organization' : 'Person', name: event.organizer.displayName },
    ...(offers.length ? { offers } : {}),
    isAccessibleForFree: event.isFree,
    ...(event.isAdultOnly ? { typicalAgeRange: '18-' } : {}),
    inLanguage: SITE.language,
  }
}

/** Vendor profile as a LocalBusiness with marketplace reviews (allowed: reviews are of third-party businesses). */
export function vendorLd(vendor: Vendor): JsonLd {
  const url = absoluteUrl(`/vendors/${vendor.slug}`)
  const reviews = vendor.reviews.slice(0, 5).map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author.displayName },
    datePublished: r.createdAt.slice(0, 10),
    reviewBody: toDescription(r.comment, 500),
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
  }))
  return {
    '@type': 'LocalBusiness',
    '@id': `${url}#business`,
    name: vendor.businessName,
    description: toDescription(vendor.description, 500),
    url,
    image: [vendor.coverUrl, vendor.avatarUrl, ...vendor.featuredWorks.map((w) => w.url)].filter(Boolean).slice(0, 5),
    ...(vendor.avatarUrl ? { logo: vendor.avatarUrl } : {}),
    address: { '@type': 'PostalAddress', addressLocality: vendor.location, addressCountry: SITE.country },
    areaServed: vendor.location,
    knowsAbout: vendor.category.name,
    ...(vendor.contactPhone ? { telephone: vendor.contactPhone } : {}),
    ...(vendor.website ? { sameAs: [vendor.website, ...Object.values(vendor.socials).filter(Boolean)] } : Object.values(vendor.socials).some(Boolean) ? { sameAs: Object.values(vendor.socials).filter(Boolean) } : {}),
    ...(vendor.ratingsCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(vendor.rating.toFixed(1)), reviewCount: vendor.ratingsCount, bestRating: 5, worstRating: 1 } } : {}),
    ...(reviews.length ? { review: reviews } : {}),
  }
}

export function eventListItems(events: EventSummary[]) {
  return events.map((e) => ({ name: e.title, path: `/events/${e.slug}`, image: e.coverUrl }))
}
