/* eslint-disable @typescript-eslint/no-explicit-any -- these tests walk arbitrary JSON-LD trees */
import { describe, expect, it } from 'vitest'
import { breadcrumbLd, eventLd, faqLd, itemListLd, organizationLd, parseFaqHtml, vendorLd, websiteLd } from '@/utils/structuredData'
import { events, vendors } from '@/services/mock/db'
import type { Event } from '@/types'

const ORIGIN = 'http://localhost:5173'
const byId = (id: string) => structuredClone(events.find((e) => e.id === id)!) as Event

describe('Event structured data', () => {
  it('maps a paid physical event to a complete schema.org Event', () => {
    const e = byId('evt_movie')
    const ld = eventLd(e) as Record<string, any>
    expect(ld['@type']).toBe('Event')
    expect(ld.url).toBe(`${ORIGIN}/events/${e.slug}`)
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled')
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
    expect(ld.location['@type']).toBe('Place')
    expect(ld.location.address).toMatchObject({ '@type': 'PostalAddress', addressCountry: 'NG' })
    expect(ld.offers.length).toBeGreaterThan(0)
    // Prices are decimal strings in major units, never kobo.
    expect(ld.offers[0].price).toMatch(/^\d+\.\d{2}$/)
    expect(Number(ld.offers[0].price) * 100).toBe(e.ticketTypes.find((t) => t.isActive)!.price)
    expect(ld.description.length).toBeLessThanOrEqual(500)
  })

  it('never exposes the private meeting link for online events', () => {
    const e = byId('evt_movie')
    e.attendanceMode = 'online'
    e.schedules = e.schedules.map((s) => ({ ...s, attendanceMode: 'online', venue: null, online: { platform: 'zoom', link: 'https://zoom.us/j/secret' } }))
    const ld = eventLd(e) as Record<string, any>
    expect(ld.location).toEqual({ '@type': 'VirtualLocation', url: `${ORIGIN}/events/${e.slug}` })
    expect(JSON.stringify(ld)).not.toContain('zoom.us')
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode')
  })

  it('marks cancelled and sold-out events correctly', () => {
    const e = byId('evt_movie')
    e.status = 'cancelled'
    e.ticketTypes = e.ticketTypes.map((t) => ({ ...t, sold: t.quantity }))
    const ld = eventLd(e) as Record<string, any>
    expect(ld.eventStatus).toBe('https://schema.org/EventCancelled')
    expect(ld.offers.every((o: any) => o.availability === 'https://schema.org/SoldOut')).toBe(true)
  })
})

describe('Vendor structured data', () => {
  it('describes a vendor as a LocalBusiness with ratings only when reviewed', () => {
    const v = structuredClone(vendors[0]!)
    const ld = vendorLd(v) as Record<string, any>
    expect(ld['@type']).toBe('LocalBusiness')
    expect(ld.url).toBe(`${ORIGIN}/vendors/${v.slug}`)
    if (v.ratingsCount > 0) expect(ld.aggregateRating).toMatchObject({ reviewCount: v.ratingsCount, bestRating: 5 })
    const unrated = vendorLd({ ...v, ratingsCount: 0, reviews: [] }) as Record<string, any>
    expect(unrated.aggregateRating).toBeUndefined()
    expect(unrated.review).toBeUndefined()
  })
})

describe('site-level and helper nodes', () => {
  it('exposes the sitelinks search box on the events search', () => {
    const ld = websiteLd() as Record<string, any>
    expect(ld.potentialAction.target.urlTemplate).toBe(`${ORIGIN}/events?search={search_term_string}`)
    expect((organizationLd() as Record<string, any>).logo.url).toBe(`${ORIGIN}/icons/icon-512.png`)
  })

  it('numbers breadcrumb and list items from 1 with absolute URLs', () => {
    const crumbs = breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }]) as Record<string, any>
    expect(crumbs.itemListElement.map((i: any) => [i.position, i.item])).toEqual([[1, `${ORIGIN}/`], [2, `${ORIGIN}/events`]])
    const list = itemListLd('Upcoming', [{ name: 'Gala', path: '/events/gala' }]) as Record<string, any>
    expect(list.numberOfItems).toBe(1)
  })

  it('turns CMS FAQ markup into a FAQPage', () => {
    const qa = parseFaqHtml('<h3>How do I get my ticket?</h3><p>Under My Tickets.</p><p>Also by email.</p><h3>Refunds?</h3><p>Within the window.</p>')
    expect(qa).toEqual([
      { question: 'How do I get my ticket?', answer: 'Under My Tickets. Also by email.' },
      { question: 'Refunds?', answer: 'Within the window.' },
    ])
    const ld = faqLd(qa) as Record<string, any>
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity[0].acceptedAnswer.text).toBe('Under My Tickets. Also by email.')
    expect(faqLd([])).toBeNull()
  })
})
