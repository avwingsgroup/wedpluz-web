import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch, userFromToken } from './shared'
import type { Vendor, VendorWork } from '@/types'

function toSummary(v: Vendor) {
  const { coverUrl: _c, description: _d, contactEmail: _e, contactPhone: _p, website: _w, socials: _s, status: _st, reviews: _r, promos: _pr, joinedAt: _j, isMine: _m, ...rest } = v
  return rest
}

export function registerVendorHandlers() {
  route('GET', '/vendor-categories', () => data(db.vendorCategories))
  route('GET', '/business-categories', () => data(db.businessCategories.map((name) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }))))

  route('GET', '/vendors', (req) => {
    const q = req.query
    let list = db.vendors.filter((v) => v.status === 'active')
    list = list.filter((v) => textMatch([v.businessName, v.category.name, v.description], q.get('search')))
    if (q.get('location')) list = list.filter((v) => textMatch([v.location], q.get('location')))
    const slug = q.get('categorySlug')
    if (slug && slug !== 'all') list = list.filter((v) => v.category.slug === slug)
    const minRating = Number(q.get('minRating') ?? 0)
    if (minRating) list = list.filter((v) => v.rating >= minRating)
    const availability = q.get('availability')
    if (availability && availability !== 'any') list = list.filter((v) => v.availability === availability)
    if (q.get('sort') === 'rating') list = [...list].sort((a, b) => b.rating - a.rating)
    if (q.get('sort') === 'newest') list = [...list].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    return paginate(list.map(toSummary), q, 10)
  })

  // Mirrors the live API: featured vendors carry a headline and cover for the home page cards.
  const HEADLINES: Record<string, string> = { ven_beayouwedz: 'Bridal wear rentals', ven_bestchefz: 'Caterer', ven_shotitmoi: 'Photographer', ven_yournextevent: 'Event Planner', ven_chinedu: 'Rental provider' }
  route('GET', '/vendors/featured', () => data(db.vendors.filter((v) => v.status === 'active').slice(0, 6).map((v) => ({ ...toSummary(v), headline: HEADLINES[v.id] ?? v.category.name, coverUrl: v.coverUrl }))))

  route('GET', '/vendors/:slug', (req) => {
    const user = userFromToken(req.authToken)
    const v = db.findVendor(req.params.slug ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    return data({ ...v, isMine: v.userId === user?.id })
  })

  route('GET', '/vendors/:id/works', (req) => {
    const v = db.findVendor(req.params.id ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    return paginate(db.works.filter((w) => w.vendorId === v.id), req.query, 12)
  })

  route('GET', '/works/:id', (req) => {
    const w = db.works.find((x) => x.id === req.params.id)
    if (!w) fail(404, 'NOT_FOUND', 'Work not found')
    const v = db.findVendor(w.vendorId)!
    return data({ ...w, vendor: toSummary(v) })
  })
  route('POST', '/works/:id/like', (req) => {
    requireUser(req)
    const w = db.works.find((x) => x.id === req.params.id)
    if (!w) fail(404, 'NOT_FOUND', 'Work not found')
    w.isLiked = !w.isLiked
    w.likesCount += w.isLiked ? 1 : -1
    return data({ liked: w.isLiked, likesCount: w.likesCount })
  })

  route('GET', '/vendors/:id/reviews', (req) => {
    const v = db.findVendor(req.params.id ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    const dist = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: v.reviews.filter((r) => Math.round(r.rating) === stars).length + (stars === 5 ? 40 : stars === 4 ? 12 : 2) }))
    return data({ items: v.reviews, summary: { average: v.rating, total: v.ratingsCount, distribution: dist } })
  })
  route('POST', '/vendors/:id/reviews', (req) => {
    const user = requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    const b = body<{ rating: number; comment: string }>(req)
    requireFields(b, ['rating', 'comment'])
    if (v.reviews.some((r) => r.author.id === user.id)) fail(409, 'CONFLICT', 'You have already reviewed this vendor. Edit your review instead.')
    const r = { id: db.nextId('rev'), author: db.userSummary(user.id), rating: b.rating, comment: b.comment, createdAt: new Date().toISOString(), updatedAt: null, isMine: true }
    v.reviews.unshift(r)
    v.ratingsCount += 1
    return created(r, 'Thanks for your review!')
  })
  route('PUT', '/vendors/:id/reviews/:reviewId', (req) => {
    requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    const r = v?.reviews.find((x) => x.id === req.params.reviewId)
    if (!v || !r) fail(404, 'NOT_FOUND', 'Review not found')
    if (!r.isMine) fail(403, 'FORBIDDEN', 'You can only edit your own review.')
    const b = body<{ rating: number; comment: string }>(req)
    Object.assign(r, { rating: b.rating ?? r.rating, comment: b.comment ?? r.comment, updatedAt: new Date().toISOString() })
    return data(r, 'Review updated')
  })
  route('DELETE', '/vendors/:id/reviews/:reviewId', (req) => {
    requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    if (v) {
      const idx = v.reviews.findIndex((x) => x.id === req.params.reviewId && x.isMine)
      if (idx >= 0) v.reviews.splice(idx, 1)
    }
    return noContent()
  })

  route('POST', '/vendors/:id/save', (req) => {
    requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    v.isSaved = true
    return data({ saved: true }, 'Vendor saved')
  })
  route('DELETE', '/vendors/:id/save', (req) => {
    requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    if (v) v.isSaved = false
    return noContent()
  })
  route('GET', '/me/saved-vendors', (req) => {
    requireUser(req)
    return paginate(db.vendors.filter((v) => v.isSaved && textMatch([v.businessName], req.query.get('search'))).map(toSummary), req.query, 12)
  })

  route('POST', '/vendors/:id/contact', (req) => {
    const user = requireUser(req)
    const v = db.findVendor(req.params.id ?? '')
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    if (v.userId === user.id) fail(409, 'CONFLICT', 'You cannot message your own business.')
    let c = db.conversations.find((x) => x.type === 'direct' && x.participants.some((p) => p.id === v.userId))
    if (!c) {
      c = { id: db.nextId('cv'), type: 'direct', title: v.businessName, avatarUrl: v.avatarUrl, participants: [db.userSummary(v.userId)], communityId: null, lastMessage: null, unreadCount: 0, isPinned: false, isMuted: false, isArchived: false, isRequest: false, updatedAt: new Date().toISOString() }
      db.conversations.unshift(c)
    }
    return data({ conversationId: c.id })
  })

  /* ---- my business account ---- */
  route('GET', '/me/vendor-profile', (req) => {
    const user = requireUser(req)
    const v = db.vendors.find((x) => x.userId === user.id)
    return data(v ? { ...v, isMine: true } : null)
  })
  route('POST', '/me/vendor-profile', (req) => {
    const user = requireUser(req)
    if (db.vendors.some((x) => x.userId === user.id)) fail(409, 'CONFLICT', 'You already have a business account.')
    const b = body<{ businessName: string; location: string; categoryId: string; description: string; avatarUploadId?: string }>(req)
    requireFields(b, ['businessName', 'location', 'categoryId', 'description'])
    const category = db.vendorCategories.find((c) => c.id === b.categoryId || c.slug === b.categoryId) ?? { id: b.categoryId, name: b.categoryId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), slug: b.categoryId }
    const v: Vendor = {
      id: db.nextId('ven'), userId: user.id, businessName: b.businessName, slug: b.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category, location: b.location, avatarUrl: b.avatarUploadId ? db.img(b.avatarUploadId, 300, 300) : user.avatarUrl, coverUrl: null,
      rating: 0, ratingsCount: 0, likesCount: 0, isVerified: false, isSaved: false, featuredWorks: [], availability: 'available', description: b.description, contactEmail: user.email, contactPhone: user.phone, website: null, socials: {}, status: 'active', worksCount: 0, reviews: [], promos: [], joinedAt: new Date().toISOString(), isMine: true,
    }
    db.vendors.unshift(v)
    user.businessProfileId = v.id
    user.isVendor = true
    if (!user.roles.includes('vendor')) user.roles.push('vendor')
    return created(v, 'Your business profile is live!')
  })
  route('PUT', '/me/vendor-profile', (req) => {
    const user = requireUser(req)
    const v = db.vendors.find((x) => x.userId === user.id)
    if (!v) fail(404, 'NOT_FOUND', 'No business account yet')
    const b = body<Record<string, unknown>>(req)
    if (b.categoryId) {
      const c = db.vendorCategories.find((x) => x.id === b.categoryId || x.slug === b.categoryId)
      if (c) v.category = c
    }
    if (b.avatarUploadId) v.avatarUrl = db.img(String(b.avatarUploadId), 300, 300)
    if (b.coverUploadId) v.coverUrl = db.img(String(b.coverUploadId), 1440, 400)
    for (const k of ['businessName', 'location', 'description', 'contactEmail', 'contactPhone', 'website', 'availability'] as const) if (k in b) (v as unknown as Record<string, unknown>)[k] = b[k]
    return data(v, 'Business profile updated')
  })
  route('DELETE', '/me/vendor-profile', (req) => {
    const user = requireUser(req)
    const idx = db.vendors.findIndex((x) => x.userId === user.id)
    if (idx >= 0) db.vendors.splice(idx, 1)
    user.businessProfileId = null
    user.isVendor = false
    user.roles = user.roles.filter((r) => r !== 'vendor')
    return noContent()
  })
  route('POST', '/me/vendor-profile/works', (req) => {
    const user = requireUser(req)
    const v = db.vendors.find((x) => x.userId === user.id)
    if (!v) fail(404, 'NOT_FOUND', 'No business account yet')
    const b = body<{ title: string; description: string; mediaUploadIds: string[] }>(req)
    requireFields(b, ['title'])
    if (!b.mediaUploadIds?.length) fail(422, 'VALIDATION_ERROR', 'Add at least one photo or video.', { mediaUploadIds: ['Add at least one photo or video.'] })
    const w: VendorWork = { id: db.nextId('work'), vendorId: v.id, title: b.title, description: b.description ?? '', media: b.mediaUploadIds.map((id, i) => ({ id: `${id}_${i}`, type: 'image', url: db.img(id, 900, 900), thumbnailUrl: db.img(id, 400, 400) })), likesCount: 0, isLiked: false, createdAt: new Date().toISOString() }
    db.works.unshift(w)
    v.worksCount += 1
    v.featuredWorks = db.works.filter((x) => x.vendorId === v.id).slice(0, 4).flatMap((x) => x.media.slice(0, 1))
    return created(w, 'Work published')
  })
  route('PUT', '/me/vendor-profile/works/:workId', (req) => {
    requireUser(req)
    const w = db.works.find((x) => x.id === req.params.workId)
    if (!w) fail(404, 'NOT_FOUND', 'Work not found')
    const b = body<{ title?: string; description?: string }>(req)
    if (b.title) w.title = b.title
    if (b.description !== undefined) w.description = b.description
    return data(w, 'Work updated')
  })
  route('DELETE', '/me/vendor-profile/works/:workId', (req) => {
    requireUser(req)
    const idx = db.works.findIndex((x) => x.id === req.params.workId)
    if (idx >= 0) {
      const v = db.findVendor(db.works[idx]!.vendorId)
      db.works.splice(idx, 1)
      if (v) v.worksCount = Math.max(0, v.worksCount - 1)
    }
    return noContent()
  })
  route('POST', '/me/vendor-profile/promos', (req) => {
    const user = requireUser(req)
    const v = db.vendors.find((x) => x.userId === user.id)
    if (!v) fail(404, 'NOT_FOUND', 'No business account yet')
    const b = body<{ title: string; description: string; discountPercent?: number; validUntil?: string }>(req)
    requireFields(b, ['title', 'description'])
    const p = { id: db.nextId('promo'), title: b.title, description: b.description, discountPercent: b.discountPercent ?? null, validUntil: b.validUntil ?? null, coverUrl: null }
    v.promos.unshift(p)
    return created(p, 'Promo published')
  })
  route('DELETE', '/me/vendor-profile/promos/:promoId', (req) => {
    const user = requireUser(req)
    const v = db.vendors.find((x) => x.userId === user.id)
    if (v) {
      const idx = v.promos.findIndex((p) => p.id === req.params.promoId)
      if (idx >= 0) v.promos.splice(idx, 1)
    }
    return noContent()
  })
}
