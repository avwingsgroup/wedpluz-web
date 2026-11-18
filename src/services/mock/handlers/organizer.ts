import { addDays } from 'date-fns'
import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch } from './shared'
import type { Event, EventDraftPayload, EventManager, EventTask, ManageEventSummary, OrganizerAnalytics, TicketValidationResult } from '@/types'

function myEvents(userId: string): Event[] {
  return db.events.filter((e) => e.organizer.id === userId)
}

function teamEvents(userId: string): Event[] {
  const ids = new Set<string>()
  for (const [eid, list] of Object.entries(db.managers)) if (list.some((m) => m.user.id === userId && m.status === 'accepted')) ids.add(eid)
  for (const [eid, list] of Object.entries(db.vendorAssignments)) if (list.some((v) => v.vendor.userId === userId && v.status === 'accepted')) ids.add(eid)
  for (const c of db.myCollaborations) if (c.status === 'accepted') ids.add(c.event.id)
  return db.events.filter((e) => ids.has(e.id) && e.organizer.id !== userId)
}

function manageSummary(e: Event, userId: string): ManageEventSummary {
  return {
    ...db.toSummary(e),
    myRole: e.organizer.id === userId ? 'organizer' : (db.managers[e.id] ?? []).some((m) => m.user.id === userId) ? 'manager' : 'vendor',
    stats: e.stats,
    collaboratorsCount: (db.managers[e.id] ?? []).filter((m) => m.status === 'accepted').length + (db.vendorAssignments[e.id] ?? []).filter((v) => v.status === 'accepted').length,
    communityId: e.communityId,
  }
}

function requireManaged(req: Parameters<typeof requireUser>[0]): { user: ReturnType<typeof requireUser>; event: Event } {
  const user = requireUser(req)
  const event = db.findEvent(req.params.id ?? '')
  if (!event) fail(404, 'NOT_FOUND', 'Event not found')
  const allowed = event.organizer.id === user.id || teamEvents(user.id).some((e) => e.id === event.id)
  if (!allowed) fail(403, 'FORBIDDEN', 'You do not manage this event.')
  return { user, event }
}

function applyDraft(e: Event, p: Partial<EventDraftPayload>) {
  if (p.title !== undefined) e.title = p.title
  if (p.description !== undefined) e.description = p.description
  if (p.coverUrl) e.coverUrl = p.coverUrl
  else if (p.coverUploadId) e.coverUrl = db.img(p.coverUploadId, 1200, 700)
  if (p.categoryId) {
    const c = db.categories.find((x) => x.id === p.categoryId)
    if (c) e.category = { id: c.id, name: c.name, slug: c.slug }
  }
  if (p.visibility) e.visibility = p.visibility
  if (p.approvalRequired !== undefined) e.approvalRequired = p.approvalRequired
  if (p.guestLimit !== undefined) {
    e.guestLimit = p.guestLimit
    e.stats.capacity = p.guestLimit
  }
  if (p.allowGuestInvites !== undefined) e.allowGuestInvites = p.allowGuestInvites
  if (p.maxAdditionalGuests !== undefined) e.maxAdditionalGuests = p.maxAdditionalGuests
  if (p.isAdultOnly !== undefined) e.isAdultOnly = p.isAdultOnly
  if (p.schedules) {
    e.schedules = p.schedules.map((s, i) => ({ ...s, id: s.id ?? `${e.id}_sch${i + 1}` }))
    const first = e.schedules[0]
    const last = e.schedules[e.schedules.length - 1]
    if (first) {
      e.startsAt = first.startsAt
      e.attendanceMode = first.attendanceMode
      e.city = first.venue?.city ?? e.city
    }
    e.endsAt = last?.endsAt ?? null
  }
  if (p.subEvents) e.subEvents = p.subEvents.map((s, i) => ({ ...s, id: s.id ?? `${e.id}_sub${i + 1}` }))
  if (p.ticketTypes) {
    e.ticketTypes = p.ticketTypes.map((t, i) => ({ ...t, id: t.id ?? `${e.id}_tt${i + 1}`, sold: e.ticketTypes.find((x) => x.id === t.id)?.sold ?? 0 }))
  }
  if (p.isFree !== undefined && p.isFree) e.ticketTypes = e.ticketTypes.length ? e.ticketTypes.map((t) => ({ ...t, price: 0 })) : [{ id: `${e.id}_tt_free`, name: 'Free', description: null, price: 0, currency: 'NGN', quantity: e.guestLimit ?? 1000, sold: 0, salesStartAt: null, salesEndAt: e.startsAt, perOrderLimit: 5, scheduleId: null, seatSelection: false, menuSelection: false, isEarlyBird: false, isActive: true }]
  e.isFree = e.ticketTypes.every((t) => t.price === 0)
  e.minPrice = e.ticketTypes.length ? Math.min(...e.ticketTypes.map((t) => t.price)) : 0
  if (p.organizerInfo) e.organizer = { ...e.organizer, displayName: p.organizerInfo.displayName || e.organizer.displayName, bio: p.organizerInfo.bio }
  if (p.assets) {
    for (const s of e.schedules) {
      s.hallLayoutId = p.assets.hallLayoutId
      s.menuId = p.assets.menuId
    }
  }
  e.updatedAt = new Date().toISOString()
}

export function registerOrganizerHandlers() {
  route('GET', '/organizer/events', (req) => {
    const user = requireUser(req)
    const tab = req.query.get('tab') ?? 'created'
    const status = req.query.get('status')
    let list = tab === 'team' ? teamEvents(user.id) : myEvents(user.id)
    if (status && status !== 'all') list = list.filter((e) => (status === 'active' ? e.status === 'live' : e.status === status))
    list = list.filter((e) => textMatch([e.title], req.query.get('search')))
    return paginate(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((e) => manageSummary(e, user.id)), req.query, 12)
  })

  route('POST', '/organizer/events', (req) => {
    const user = requireUser(req)
    const p = body<Partial<EventDraftPayload>>(req)
    const id = db.nextId('evt')
    const e: Event = {
      id,
      slug: `${(p.title ?? 'untitled-event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.slice(-4)}`,
      title: p.title ?? 'Untitled event',
      description: p.description ?? '',
      coverUrl: p.coverUrl ?? db.img(id, 1200, 700),
      category: db.categories[0] ? { id: db.categories[0].id, name: db.categories[0].name, slug: db.categories[0].slug } : { id: 'cat_social', name: 'Social activities', slug: 'social-activities' },
      startsAt: addDays(new Date(), 30).toISOString(),
      endsAt: null,
      attendanceMode: 'physical',
      city: user.city,
      isFree: true,
      minPrice: 0,
      currency: 'NGN',
      status: 'draft',
      isSaved: false,
      isFeatured: false,
      isPromoted: false,
      visibility: 'public',
      approvalRequired: false,
      guestLimit: null,
      allowGuestInvites: false,
      maxAdditionalGuests: 0,
      isAdultOnly: false,
      organizer: { ...db.userSummary(user.id), bio: null, eventsCount: myEvents(user.id).length + 1 },
      schedules: [],
      subEvents: [],
      ticketTypes: [],
      menu: [],
      promotion: { enabled: false, commissionPercent: 0, targetSignups: null, promoterLimit: null, promotersCount: 0 },
      stats: { registered: 0, checkedIn: 0, capacity: null, pendingRequests: 0, revenue: 0, ticketsSold: 0 },
      gallery: [],
      tags: [],
      communityId: null,
      myRequestStatus: 'none',
      myTicketId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
    }
    applyDraft(e, p)
    db.events.unshift(e)
    return created(e, 'Draft saved')
  })

  route('GET', '/organizer/events/:id', (req) => {
    const { event, user } = requireManaged(req)
    return data({ ...event, manage: manageSummary(event, user.id) })
  })

  route('PUT', '/organizer/events/:id', (req) => {
    const { event } = requireManaged(req)
    applyDraft(event, body<Partial<EventDraftPayload>>(req))
    return data(event, 'Changes saved')
  })

  route('POST', '/organizer/events/:id/publish', (req) => {
    const { event } = requireManaged(req)
    const errors: Record<string, string[]> = {}
    if (!event.title) errors.title = ['Add a title']
    if (!event.schedules.length) errors.schedules = ['Add at least one date']
    if (!event.ticketTypes.length) errors.ticketTypes = ['Add at least one ticket type or mark the event as free']
    if (Object.keys(errors).length) fail(422, 'VALIDATION_ERROR', 'Complete the event before publishing.', errors)
    event.status = 'live'
    event.publishedAt = new Date().toISOString()
    if (!event.communityId) {
      event.communityId = `com_${event.id}`
      db.communities.unshift({ id: event.communityId, eventId: event.id, event: { id: event.id, slug: event.slug, title: event.title, coverUrl: event.coverUrl, startsAt: event.startsAt, isPromoted: false }, name: event.title, description: null, avatarUrl: event.coverUrl, membersCount: 1, onlineCount: 1, myRole: 'owner', permissions: { membersCanSendMessages: true, membersCanPostStatus: true, membersCanInvite: false, membersCanGoLive: false, requireApprovalToJoin: false }, inviteLink: `https://wedpluz.com/c/join/${event.id.toUpperCase()}`, isArchived: false, isMuted: false, isPinned: false, createdAt: new Date().toISOString() })
    }
    return data(event, 'Your event is live!')
  })

  route('DELETE', '/organizer/events/:id', (req) => {
    const { event } = requireManaged(req)
    if (event.stats.ticketsSold > 0 && event.status !== 'draft') fail(409, 'CONFLICT', 'Events with sold tickets cannot be deleted. Cancel the event instead.')
    db.events.splice(db.events.indexOf(event), 1)
    return noContent()
  })

  route('PATCH', '/organizer/events/:id/status', (req) => {
    const { event } = requireManaged(req)
    const b = body<{ status: 'completed' | 'cancelled'; cancellationReason?: string }>(req)
    requireFields(b, ['status'])
    if (b.status === 'cancelled' && !b.cancellationReason) fail(422, 'VALIDATION_ERROR', 'Tell your guests why the event is cancelled.', { cancellationReason: ['Required'] })
    event.status = b.status
    return data(event, b.status === 'cancelled' ? 'Event cancelled. Refunds are being processed.' : 'Event marked as complete')
  })

  route('GET', '/organizer/events/:id/analytics', (req) => {
    const { event } = requireManaged(req)
    const res: OrganizerAnalytics = {
      revenue: event.stats.revenue,
      ticketsSold: event.stats.ticketsSold,
      checkedIn: event.stats.checkedIn,
      capacity: event.stats.capacity,
      byTicketType: event.ticketTypes.map((t) => ({ ticketTypeId: t.id, name: t.name, price: t.price, sold: t.sold, quantity: t.quantity, revenue: t.sold * t.price, salesEndAt: t.salesEndAt })),
      salesByDay: Array.from({ length: 14 }, (_, i) => ({ date: addDays(new Date(), i - 13).toISOString().slice(0, 10), tickets: db.between(5, 90), revenue: db.between(5, 90) * (event.minPrice || 100000) })),
      recentBuyers: db.guestList.slice(0, 5).map((g, i) => ({ user: g.user, ticketTypeName: g.ticketTypeName, purchasedAt: addDays(new Date(), -i).toISOString() })),
    }
    return data(res)
  })

  route('GET', '/organizer/events/:id/guests', (req) => {
    requireManaged(req)
    const filter = req.query.get('filter') ?? 'attendees'
    let list = db.guestList
    if (filter === 'pending') list = list.filter((g) => g.requestStatus === 'pending')
    else if (filter === 'approved') list = list.filter((g) => g.requestStatus === 'approved')
    else if (filter === 'checked_in') list = list.filter((g) => g.ticketStatus === 'checked_in')
    else if (filter === 'not_checked_in') list = list.filter((g) => g.ticketStatus !== 'checked_in')
    list = list.filter((g) => textMatch([g.user.displayName, g.ticketTypeName], req.query.get('search')))
    return paginate(list, req.query, 10)
  })

  route('GET', '/organizer/events/:id/requests', (req) => {
    const { event } = requireManaged(req)
    return paginate(db.eventRequests.filter((r) => r.event.id === event.id && r.status === (req.query.get('status') ?? 'pending')), req.query, 20)
  })
  route('PATCH', '/organizer/events/:id/requests/:requestId', (req) => {
    const { event } = requireManaged(req)
    const r = db.eventRequests.find((x) => x.id === req.params.requestId)
    if (!r) fail(404, 'NOT_FOUND', 'Request not found')
    const b = body<{ status: 'approved' | 'declined' }>(req)
    r.status = b.status
    event.stats.pendingRequests = Math.max(0, event.stats.pendingRequests - 1)
    return data(r, b.status === 'approved' ? 'Request approved' : 'Request declined')
  })
  route('POST', '/organizer/events/:id/requests/bulk', (req) => {
    const { event } = requireManaged(req)
    const b = body<{ ids: string[]; status: 'approved' | 'declined' }>(req)
    for (const r of db.eventRequests) if (b.ids?.includes(r.id)) r.status = b.status
    event.stats.pendingRequests = db.eventRequests.filter((r) => r.event.id === event.id && r.status === 'pending').length
    return data({ updated: b.ids?.length ?? 0 })
  })

  route('GET', '/organizer/events/:id/check-ins', (req) => {
    requireManaged(req)
    return paginate(db.checkIns, req.query, 20)
  })
  route('POST', '/organizer/events/:id/check-ins', (req) => {
    const { event, user } = requireManaged(req)
    const b = body<{ code: string; method: 'scan' | 'manual' }>(req)
    requireFields(b, ['code'])
    const code = b.code.trim().toUpperCase()
    const ticket = db.tickets.find((t) => t.code === code || t.qrPayload === b.code)
    let result: TicketValidationResult
    if (!ticket) {
      result = { valid: false, reason: 'not_found', ticket: null, attendee: null }
    } else if (ticket.eventId !== event.id && !code.startsWith('TS')) {
      result = { valid: false, reason: 'wrong_event', ticket: { id: ticket.id, code: ticket.code, holderName: ticket.holderName, ticketTypeName: ticket.ticketTypeName, checkedInAt: ticket.checkedInAt, seat: ticket.seat }, attendee: db.userSummary(db.ME_ID) }
    } else if (ticket.status === 'checked_in') {
      result = { valid: false, reason: 'already_checked_in', ticket: { id: ticket.id, code: ticket.code, holderName: ticket.holderName, ticketTypeName: ticket.ticketTypeName, checkedInAt: ticket.checkedInAt, seat: ticket.seat }, attendee: db.userSummary(db.ME_ID) }
    } else if (ticket.status === 'cancelled') {
      result = { valid: false, reason: 'cancelled', ticket: { id: ticket.id, code: ticket.code, holderName: ticket.holderName, ticketTypeName: ticket.ticketTypeName, checkedInAt: null, seat: ticket.seat }, attendee: db.userSummary(db.ME_ID) }
    } else {
      ticket.status = 'checked_in'
      ticket.checkedInAt = new Date().toISOString()
      event.stats.checkedIn += 1
      db.checkIns.unshift({ id: db.nextId('ci'), ticketCode: ticket.code, attendee: db.userSummary(db.ME_ID), ticketTypeName: ticket.ticketTypeName, checkedInAt: ticket.checkedInAt, checkedInBy: db.userSummary(user.id), method: b.method ?? 'manual' })
      result = { valid: true, reason: 'ok', ticket: { id: ticket.id, code: ticket.code, holderName: ticket.holderName, ticketTypeName: ticket.ticketTypeName, checkedInAt: ticket.checkedInAt, seat: ticket.seat }, attendee: db.userSummary(db.ME_ID) }
    }
    // Generic demo codes: any code starting with "TS" validates against the demo guest list.
    if (!ticket && code.startsWith('TS')) {
      const guest = db.guestList[db.between(0, 10)]!
      db.checkIns.unshift({ id: db.nextId('ci'), ticketCode: code, attendee: guest.user, ticketTypeName: guest.ticketTypeName, checkedInAt: new Date().toISOString(), checkedInBy: db.userSummary(user.id), method: b.method ?? 'manual' })
      event.stats.checkedIn += 1
      result = { valid: true, reason: 'ok', ticket: { id: db.nextId('tkt'), code, holderName: guest.user.displayName, ticketTypeName: guest.ticketTypeName, checkedInAt: new Date().toISOString(), seat: null }, attendee: guest.user }
    }
    return data(result)
  })

  route('GET', '/organizer/events/:id/managers', (req) => {
    const { event } = requireManaged(req)
    return data((db.managers[event.id] ?? []).filter((m) => m.status !== 'removed' && textMatch([m.user.displayName], req.query.get('search'))))
  })
  route('POST', '/organizer/events/:id/managers', (req) => {
    const { event } = requireManaged(req)
    const b = body<{ userId?: string; email?: string; access: 'full' | 'partial'; permissions: EventManager['permissions'] }>(req)
    if (!b.userId && !b.email) fail(422, 'VALIDATION_ERROR', 'Choose a user or enter an email', { userId: ['Required'] })
    const u = b.userId ? db.findUser(b.userId) : db.users.find((x) => x.email === b.email)
    const mgr: EventManager = { id: db.nextId('mgr'), user: u ? db.userSummary(u.id) : { id: db.nextId('usr'), displayName: b.email ?? 'Invited user', avatarUrl: null }, access: b.access ?? 'full', permissions: b.access === 'partial' ? b.permissions ?? [] : ['manage_guests', 'scan_tickets', 'manage_tasks', 'manage_vendors', 'manage_assets', 'view_revenue', 'edit_event', 'manage_community'], status: 'pending', invitedAt: new Date().toISOString(), respondedAt: null }
    ;(db.managers[event.id] ??= []).push(mgr)
    return created(mgr, 'Invite sent')
  })
  route('PATCH', '/organizer/events/:id/managers/:managerId', (req) => {
    const { event } = requireManaged(req)
    const m = (db.managers[event.id] ?? []).find((x) => x.id === req.params.managerId)
    if (!m) fail(404, 'NOT_FOUND', 'Manager not found')
    Object.assign(m, body(req))
    return data(m, 'Access updated')
  })
  route('DELETE', '/organizer/events/:id/managers/:managerId', (req) => {
    const { event } = requireManaged(req)
    const list = db.managers[event.id] ?? []
    const idx = list.findIndex((x) => x.id === req.params.managerId)
    if (idx >= 0) list.splice(idx, 1)
    return noContent()
  })

  route('GET', '/organizer/events/:id/vendors', (req) => {
    const { event } = requireManaged(req)
    return data((db.vendorAssignments[event.id] ?? []).filter((v) => textMatch([v.vendor.businessName], req.query.get('search'))))
  })
  route('POST', '/organizer/events/:id/vendors', (req) => {
    const { event } = requireManaged(req)
    const b = body<{ vendorId: string; role?: string }>(req)
    requireFields(b, ['vendorId'])
    const v = db.findVendor(b.vendorId)
    if (!v) fail(404, 'NOT_FOUND', 'Vendor not found')
    const a = { id: db.nextId('va'), vendor: { id: v.id, businessName: v.businessName, category: v.category.name, avatarUrl: v.avatarUrl, userId: v.userId }, role: b.role ?? null, status: 'pending' as const, invitedAt: new Date().toISOString() }
    ;(db.vendorAssignments[event.id] ??= []).push(a)
    return created(a, 'Vendor invited')
  })
  route('DELETE', '/organizer/events/:id/vendors/:assignmentId', (req) => {
    const { event } = requireManaged(req)
    const list = db.vendorAssignments[event.id] ?? []
    const idx = list.findIndex((x) => x.id === req.params.assignmentId)
    if (idx >= 0) list.splice(idx, 1)
    return noContent()
  })

  route('GET', '/organizer/events/:id/tasks', (req) => {
    const { event } = requireManaged(req)
    let list = db.tasks.filter((t) => t.eventId === event.id || event.id === 'evt_tolu_shower')
    const assignee = req.query.get('assigneeId')
    if (assignee) list = list.filter((t) => t.assignees.some((a) => a.id === assignee))
    list = list.filter((t) => textMatch([t.title], req.query.get('search')))
    if (req.query.get('sort') === 'due') list = [...list].sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
    return data(list)
  })
  route('POST', '/organizer/events/:id/tasks', (req) => {
    const { event, user } = requireManaged(req)
    const b = body<{ title: string; description?: string; status?: EventTask['status']; dueAt?: string; assigneeIds?: string[] }>(req)
    requireFields(b, ['title'])
    const t: EventTask = { id: db.nextId('task'), eventId: event.id, title: b.title, description: b.description ?? null, status: b.status ?? 'todo', dueAt: b.dueAt ?? null, assignees: (b.assigneeIds ?? []).map(db.userSummary), attachments: [], createdBy: db.userSummary(user.id), createdAt: new Date().toISOString(), completedAt: null, isOverdue: false }
    db.tasks.unshift(t)
    return created(t, 'Task created')
  })
  route('PATCH', '/organizer/events/:id/tasks/:taskId', (req) => {
    requireManaged(req)
    const t = db.tasks.find((x) => x.id === req.params.taskId)
    if (!t) fail(404, 'NOT_FOUND', 'Task not found')
    const b = body<{ title?: string; description?: string; status?: EventTask['status']; dueAt?: string | null; assigneeIds?: string[] }>(req)
    if (b.title !== undefined) t.title = b.title
    if (b.description !== undefined) t.description = b.description
    if (b.dueAt !== undefined) t.dueAt = b.dueAt
    if (b.assigneeIds) t.assignees = b.assigneeIds.map(db.userSummary)
    if (b.status) {
      t.status = b.status
      t.completedAt = b.status === 'done' ? new Date().toISOString() : null
    }
    t.isOverdue = Boolean(t.dueAt && t.dueAt < new Date().toISOString() && t.status !== 'done')
    return data(t)
  })
  route('DELETE', '/organizer/events/:id/tasks/:taskId', (req) => {
    requireManaged(req)
    const idx = db.tasks.findIndex((x) => x.id === req.params.taskId)
    if (idx >= 0) db.tasks.splice(idx, 1)
    return noContent()
  })

  route('GET', '/organizer/events/:id/activity', (req) => {
    requireManaged(req)
    const role = req.query.get('role')
    return paginate(db.activityLog.filter((a) => !role || role === 'all' || a.actorRole === role), req.query, 20)
  })

  route('GET', '/organizer/events/:id/promotion', (req) => {
    const { event } = requireManaged(req)
    return data(event.promotion)
  })
  route('PUT', '/organizer/events/:id/promotion', (req) => {
    const { event } = requireManaged(req)
    const b = body<Partial<Event['promotion']>>(req)
    if (b.enabled && (b.commissionPercent === undefined || b.commissionPercent <= 0 || b.commissionPercent > 50)) {
      fail(422, 'VALIDATION_ERROR', 'Set a commission between 1% and 50%.', { commissionPercent: ['Set a commission between 1% and 50%.'] })
    }
    Object.assign(event.promotion, b)
    event.isPromoted = Boolean(event.promotion.enabled)
    return data(event.promotion, event.isPromoted ? 'Promotion published' : 'Promotion turned off')
  })
  route('GET', '/organizer/events/:id/promoters', (req) => {
    const { event } = requireManaged(req)
    const list = event.isPromoted ? db.users.slice(4, 16).map((u, i) => ({ rank: i + 1, user: db.userSummary(u.id), signups: Math.max(0, 48 - i * 4), earnings: Math.max(0, 48 - i * 4) * 5000 })) : []
    return data(list)
  })

  route('GET', '/organizer/events/:id/community', (req) => {
    const { event } = requireManaged(req)
    const c = db.communities.find((x) => x.eventId === event.id) ?? null
    return data(c)
  })
  route('PUT', '/organizer/events/:id/community', (req) => {
    const { event } = requireManaged(req)
    const b = body<{ enabled: boolean; permissions?: Partial<(typeof db.communities)[number]['permissions']> }>(req)
    let c = db.communities.find((x) => x.eventId === event.id)
    if (b.enabled && !c) {
      c = { id: `com_${event.id}`, eventId: event.id, event: { id: event.id, slug: event.slug, title: event.title, coverUrl: event.coverUrl, startsAt: event.startsAt, isPromoted: event.isPromoted }, name: event.title, description: null, avatarUrl: event.coverUrl, membersCount: 1, onlineCount: 1, myRole: 'owner', permissions: { membersCanSendMessages: true, membersCanPostStatus: true, membersCanInvite: false, membersCanGoLive: false, requireApprovalToJoin: false }, inviteLink: `https://wedpluz.com/c/join/${event.id.toUpperCase()}`, isArchived: false, isMuted: false, isPinned: false, createdAt: new Date().toISOString() }
      db.communities.unshift(c)
      event.communityId = c.id
    }
    if (c && b.permissions) Object.assign(c.permissions, b.permissions)
    if (c && !b.enabled) c.isArchived = true
    return data(c ?? null, b.enabled ? 'Community activated' : 'Community archived')
  })

  route('GET', '/me/collaborations', (req) => {
    requireUser(req)
    return data(db.myCollaborations)
  })
  route('PATCH', '/me/collaborations/:id', (req) => {
    requireUser(req)
    const c = db.myCollaborations.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Invite not found')
    const b = body<{ status: 'accepted' | 'declined' }>(req)
    ;(c as { status: string }).status = b.status
    return data(c)
  })

  route('GET', '/me/promotions', (req) => {
    requireUser(req)
    const status = req.query.get('status') ?? 'active'
    return paginate(db.promoterEnrollments.filter((p) => (status === 'past' ? p.status === 'past' : p.status !== 'past') && textMatch([p.event.title], req.query.get('search'))), req.query, 12)
  })
  route('GET', '/me/promotions/:id', (req) => {
    requireUser(req)
    const p = db.promoterEnrollments.find((x) => x.id === req.params.id)
    if (!p) fail(404, 'NOT_FOUND', 'Promotion not found')
    return data(p)
  })
  route('POST', '/events/:id/promotions/join', (req) => {
    const user = requireUser(req)
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    if (!e.isPromoted) fail(409, 'CONFLICT', 'This event is not open for promotion.')
    if (user.plan === 'free') fail(402, 'PAYMENT_REQUIRED', 'Promoting events is a Premium feature. Upgrade to continue.')
    const existing = db.promoterEnrollments.find((p) => p.event.id === e.id)
    if (existing) return data(existing)
    const p = { id: db.nextId('pe'), event: db.toSummary(e), commissionPercent: e.promotion.commissionPercent, shareLink: `https://wedpluz.com/events/${e.slug}?ref=${user.username?.toUpperCase() ?? 'ME'}`, shareCode: user.username?.toUpperCase() ?? 'ME', signups: 0, targetSignups: e.promotion.targetSignups, earnings: 0, withdrawable: false, status: 'active' as const, joinedAt: new Date().toISOString() }
    db.promoterEnrollments.unshift(p)
    e.promotion.promotersCount += 1
    return created(p, 'You’re now promoting this event. Share your link to start earning.')
  })
}
