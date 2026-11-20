import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch, dateInRange, userFromToken } from './shared'
import type { Event, SearchSuggestion } from '@/types'
import { distanceKm, parseCoords } from '@/utils/geo'

const recentSearches = ['Wedding', 'Piggyvest', 'Movie in the park']
const trendingSearches = ['Detty December', 'Bole Festival', 'Tech meetup', 'Owambe', 'Comedy night']

function publicEvents(): Event[] {
  return db.events.filter((e) => e.status === 'live' && e.visibility === 'public')
}

function applyFilters(list: Event[], q: URLSearchParams): Event[] {
  let out = list
  const search = q.get('search')
  if (search) out = out.filter((e) => textMatch([e.title, e.description, e.category.name, e.organizer.displayName, e.city], search))
  const location = q.get('location')
  const point = parseCoords(location)
  if (point) {
    const km = Math.max(1, Math.min(500, Number(q.get('distanceKm') ?? 25)))
    out = out.filter((e) => e.schedules.some((s) => s.venue?.lat != null && s.venue.lng != null && distanceKm(point, { lat: s.venue.lat, lng: s.venue.lng }) <= km))
  } else if (location) out = out.filter((e) => textMatch([e.city, e.schedules[0]?.venue?.state ?? null], location))
  const slug = q.get('categorySlug')
  if (slug && slug !== 'all') out = out.filter((e) => e.category.slug === slug)
  const mode = q.get('attendanceMode')
  if (mode && mode !== 'any') out = out.filter((e) => e.attendanceMode === mode || (mode === 'physical' && e.attendanceMode === 'hybrid'))
  if (q.get('freeOnly') === 'true') out = out.filter((e) => e.isFree)
  const from = q.get('dateFrom')
  const to = q.get('dateTo')
  if (from || to) out = out.filter((e) => dateInRange(e.startsAt, from, to))
  const tod = q.get('timeOfDay')
  if (tod && tod !== 'any') {
    out = out.filter((e) => {
      const h = new Date(e.startsAt).getHours()
      return tod === 'morning' ? h < 12 : tod === 'afternoon' ? h >= 12 && h < 17 : h >= 17
    })
  }
  const sort = q.get('sort')
  if (sort === 'date') out = [...out].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  else if (sort === 'price') out = [...out].sort((a, b) => a.minPrice - b.minPrice)
  else if (sort === 'popularity') out = [...out].sort((a, b) => b.stats.registered - a.stats.registered)
  return out
}

export function registerEventHandlers() {
  route('GET', '/categories', () => data(db.categories.map((c) => ({ ...c, eventsCount: publicEvents().filter((e) => e.category.id === c.id).length }))))

  route('GET', '/events', (req) => paginate(applyFilters(publicEvents(), req.query).map(db.toSummary), req.query, 12))

  route('GET', '/events/featured', () => data(publicEvents().filter((e) => e.isFeatured).slice(0, 8).map(db.toSummary)))
  route('GET', '/events/upcoming', (req) => data(applyFilters(publicEvents(), req.query).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 8).map(db.toSummary)))
  route('GET', '/events/popular', () => data([...publicEvents()].sort((a, b) => b.stats.registered - a.stats.registered).slice(0, 8).map(db.toSummary)))
  route('GET', '/events/promoted', () => data(publicEvents().filter((e) => e.isPromoted).map(db.toSummary)))

  route('GET', '/events/:slug', (req) => {
    const user = userFromToken(req.authToken)
    const e = db.findEvent(req.params.slug ?? '')
    if (!e || (e.status === 'draft' && e.organizer.id !== user?.id)) fail(404, 'NOT_FOUND', 'Event not found')
    const myTicket = user ? db.tickets.find((t) => t.eventId === e.id && t.status !== 'cancelled') : null
    return data({ ...e, myTicketId: myTicket?.id ?? null })
  })

  route('GET', '/events/:id/related', (req) => {
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    return data(publicEvents().filter((x) => x.id !== e.id).sort((a, b) => (a.category.id === e.category.id ? -1 : 1) - (b.category.id === e.category.id ? -1 : 1)).slice(0, 4).map(db.toSummary))
  })

  route('GET', '/events/:id/organizer-events', (req) => {
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    return paginate(publicEvents().filter((x) => x.organizer.id === e.organizer.id && x.id !== e.id).map(db.toSummary), req.query, 8)
  })

  route('POST', '/events/:id/save', (req) => {
    requireUser(req)
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    e.isSaved = true
    return data({ saved: true }, 'Event saved')
  })
  route('DELETE', '/events/:id/save', (req) => {
    requireUser(req)
    const e = db.findEvent(req.params.id ?? '')
    if (e) e.isSaved = false
    return noContent()
  })
  route('GET', '/me/saved-events', (req) => {
    requireUser(req)
    const list = db.events.filter((e) => e.isSaved && textMatch([e.title], req.query.get('search')))
    return paginate(list.map(db.toSummary), req.query, 12)
  })

  route('POST', '/events/:id/requests', (req) => {
    const user = requireUser(req)
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    const b = body<{ firstName: string; lastName: string }>(req)
    requireFields(b, ['firstName', 'lastName'])
    if (e.myRequestStatus === 'pending') fail(409, 'CONFLICT', 'You already have a pending request for this event.')
    e.myRequestStatus = 'pending'
    e.stats.pendingRequests += 1
    db.eventRequests.unshift({ id: db.nextId('req'), event: { id: e.id, title: e.title, coverUrl: e.coverUrl, startsAt: e.startsAt }, user: db.userSummary(user.id), firstName: b.firstName, lastName: b.lastName, status: 'pending', createdAt: new Date().toISOString() })
    return created({ status: 'pending' }, 'Request sent. The host will review it shortly.')
  })

  route('GET', '/search/suggestions', (req) => {
    const q = (req.query.get('q') ?? '').toLowerCase()
    const location = req.query.get('location')
    if (!q) {
      const out: SearchSuggestion[] = [
        ...recentSearches.map((s) => ({ type: 'recent' as const, label: s, value: s })),
        ...trendingSearches.map((s) => ({ type: 'trending' as const, label: s, value: s })),
      ]
      return data(out)
    }
    const out: SearchSuggestion[] = []
    for (const e of publicEvents().filter((e) => e.title.toLowerCase().includes(q) && (!location || textMatch([e.city], location))).slice(0, 5)) {
      out.push({ type: 'event', label: e.title, value: e.slug, meta: e.city ?? undefined })
    }
    for (const c of db.categories.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 2)) out.push({ type: 'category', label: c.name, value: c.slug })
    for (const v of db.vendors.filter((v) => v.businessName.toLowerCase().includes(q)).slice(0, 3)) out.push({ type: 'vendor', label: v.businessName, value: v.slug, meta: v.category.name })
    for (const city of ['Port Harcourt', 'Lagos', 'Abuja', 'Ibadan', 'Enugu'].filter((c) => c.toLowerCase().includes(q))) out.push({ type: 'location', label: city, value: city })
    return data(out)
  })

  route('GET', '/locations/suggest', (req) => {
    const q = (req.query.get('q') ?? '').toLowerCase()
    const cities = ['Port Harcourt, NG', 'Lagos, NG', 'Abuja, NG', 'Ibadan, NG', 'Enugu, NG', 'Calabar, NG', 'Owerri, NG', 'Benin City, NG', 'Kano, NG', 'Accra, GH', 'London, UK']
    return data(cities.filter((c) => c.toLowerCase().includes(q)).slice(0, 6).map((c) => ({ label: c, value: c.split(',')[0] ?? c })))
  })
}
