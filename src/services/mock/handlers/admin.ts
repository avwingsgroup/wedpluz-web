import { addDays, subDays } from 'date-fns'
import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, dateInRange, requireAdmin, requireFields, sortBy, textMatch } from './shared'
import type { AdminUser, AuditLogEntry, ExecutiveDashboard, FinanceSummary, KpiValue, PermissionKey, ReportResult, Role, TrendPoint } from '@/types'

const VALID_OTP = '1234'
const exportJobs = new Map<string, { id: string; status: 'ready'; format: 'csv' | 'xlsx' | 'pdf'; downloadUrl: string; expiresAt: string }>()

function can(admin: AdminUser, perm: PermissionKey) {
  if (!admin.permissions.includes(perm)) fail(403, 'FORBIDDEN', `Missing permission: ${perm}`)
}

function audit(admin: AdminUser, action: string, module: string, targetType: string, targetId: string | null, targetLabel: string | null, before: Record<string, unknown> | null = null, after: Record<string, unknown> | null = null) {
  const entry: AuditLogEntry = { id: db.nextId('aud'), actor: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email, avatarUrl: admin.avatarUrl }, action, module, targetType, targetId, targetLabel, before, after, ip: '105.112.33.1', userAgent: 'Mozilla/5.0 Chrome/131', correlationId: db.nextId('corr'), createdAt: new Date().toISOString() }
  db.auditLogs.unshift(entry)
  return entry
}

function trend(days: number, base: number, variance: number): TrendPoint[] {
  return Array.from({ length: days }, (_, i) => ({ date: subDays(new Date(), days - 1 - i).toISOString().slice(0, 10), value: Math.max(0, Math.round(base + (db.rand() - 0.5) * variance + i * (base / days) * 0.2)) }))
}
function kpi(days: number, base: number, variance: number): KpiValue {
  const t = trend(days, base, variance)
  const value = t.reduce((a, p) => a + p.value, 0)
  const previous = Math.round(value * (0.8 + db.rand() * 0.3))
  return { value, previous, changePercent: previous ? Number((((value - previous) / previous) * 100).toFixed(1)) : 0, trend: t }
}
function periodDays(q: URLSearchParams) {
  const from = q.get('from')
  const to = q.get('to')
  if (from && to) return Math.max(1, Math.min(365, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1))
  return 30
}
function period(q: URLSearchParams) {
  const days = periodDays(q)
  return { from: q.get('from') ?? subDays(new Date(), days - 1).toISOString().slice(0, 10), to: q.get('to') ?? new Date().toISOString().slice(0, 10), days }
}

export function registerAdminHandlers() {
  /* ---- admin auth ---- */
  route('POST', '/admin/auth/login', (req) => {
    const b = body<{ email: string; password: string; otp?: string }>(req)
    requireFields(b, ['email', 'password'])
    const admin = db.adminUsers.find((a) => a.email.toLowerCase() === b.email.toLowerCase())
    if (!admin || b.password.length < 6 || b.password === 'wrongpass') fail(401, 'UNAUTHENTICATED', 'Incorrect email or password.')
    if (admin.status !== 'active') fail(403, 'ACCOUNT_SUSPENDED', 'This admin account is not active.')
    if (admin.twoFactorEnabled && !b.otp) return data({ requiresTwoFactor: true, admin: null, tokens: null })
    if (admin.twoFactorEnabled && b.otp !== VALID_OTP) fail(422, 'OTP_INVALID', 'Invalid authentication code.', { otp: ['Invalid code'] })
    admin.lastLoginAt = new Date().toISOString()
    db.securityLogs.unshift({ id: db.nextId('sec'), actor: { id: admin.id, email: admin.email }, event: 'login_success', ip: '105.112.33.1', location: 'Port Harcourt, NG', userAgent: 'Chrome 131 / Windows', createdAt: new Date().toISOString() })
    return data({ requiresTwoFactor: false, admin, tokens: { accessToken: `mock-admin-${admin.id}`, refreshToken: null, tokenType: 'Bearer', expiresIn: 3600 } })
  })
  route('GET', '/admin/me', (req) => data(requireAdmin(req)))
  route('POST', '/admin/auth/logout', () => noContent())

  /* ---- dashboard ---- */
  route('GET', '/admin/dashboard', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'dashboard.view')
    const p = period(req.query)
    const liveEvents = db.events.filter((e) => e.status === 'live')
    const now = new Date().toISOString()
    const res: ExecutiveDashboard = {
      period: { from: p.from, to: p.to },
      users: { total: 48210 + db.users.length, active: 31200, inactive: 17010, newInPeriod: kpi(p.days, 120, 60), verified: 12400 },
      events: { total: db.events.length + 1800, upcoming: liveEvents.filter((e) => e.startsAt > now).length + 240, ongoing: 18, completed: db.events.filter((e) => e.status === 'completed').length + 1500, pendingReview: db.events.filter((e) => e.status === 'pending_review').length, createdInPeriod: kpi(p.days, 14, 10) },
      tickets: { sold: kpi(p.days, 820, 400), bookings: kpi(p.days, 310, 150), checkIns: 18400 },
      finance: { gtv: kpi(p.days, 48_000_000, 30_000_000), platformRevenue: kpi(p.days, 2_400_000, 1_500_000), pendingSettlements: db.settlements.filter((s) => s.status === 'pending' || s.status === 'ready').reduce((a, s) => a + s.netPayable, 0), refundsAmount: db.refundRecords.reduce((a, r) => a + r.amount, 0), refundsCount: db.refundRecords.length, currency: 'NGN' },
      community: { communities: db.communities.length + 900, messagesInPeriod: 182000, postsInPeriod: 9100, reportsOpen: db.contentReports.filter((r) => r.status === 'open').length },
      recentActivity: db.auditLogs.slice(0, 8),
      alerts: [
        { id: 'al_1', severity: 'critical', title: 'PayPal success rate dropped to 81%', description: '19 failed captures in the last hour. Provider status page reports degraded performance.', link: '/finance/gateways', createdAt: new Date().toISOString() },
        { id: 'al_2', severity: 'warning', title: `${db.events.filter((e) => e.status === 'pending_review').length} events awaiting review for more than 24h`, description: 'Organizers are notified of SLA breaches after 48h.', link: '/events?status=pending_review', createdAt: subDays(new Date(), 1).toISOString() },
        { id: 'al_3', severity: 'info', title: 'Settlement run scheduled', description: `${db.settlements.filter((s) => s.status === 'ready').length} settlements ready for payout approval.`, link: '/finance/settlements', createdAt: subDays(new Date(), 1).toISOString() },
      ],
      topEvents: [...db.events].sort((a, b) => b.stats.revenue - a.stats.revenue).slice(0, 5).map((e) => ({ event: db.toSummary(e), ticketsSold: e.stats.ticketsSold, revenue: e.stats.revenue })),
      acquisitionBySource: [{ source: 'android', users: 21400 }, { source: 'web', users: 15800 }, { source: 'ios', users: 11010 }],
      gatewayHealth: [
        { provider: 'paystack', successRate: 97.8, avgLatencyMs: 820, volume: 14200, failures: 312, status: 'operational' },
        { provider: 'monnify', successRate: 96.1, avgLatencyMs: 1100, volume: 6100, failures: 238, status: 'operational' },
        { provider: 'stripe', successRate: 98.9, avgLatencyMs: 640, volume: 1900, failures: 21, status: 'operational' },
        { provider: 'paypal', successRate: 81.2, avgLatencyMs: 2400, volume: 640, failures: 120, status: 'degraded' },
      ],
    }
    return data(res)
  })

  /* ---- users ---- */
  route('GET', '/admin/users', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'users.view')
    const q = req.query
    let list = db.adminUserRecords.filter((u) => textMatch([u.displayName, u.email, u.username, u.phone], q.get('search')))
    for (const [key, field] of [['status', 'status'], ['identityStatus', 'identityStatus'], ['plan', 'plan'], ['source', 'signupSource']] as const) {
      const v = q.get(key)
      if (v && v !== 'all') list = list.filter((u) => (u as unknown as Record<string, unknown>)[field] === v)
    }
    const role = q.get('role')
    if (role && role !== 'all') list = list.filter((u) => u.roles.includes(role as 'user'))
    list = list.filter((u) => dateInRange(u.createdAt, q.get('dateFrom'), q.get('dateTo')))
    list = sortBy(list, q.get('sort') ?? 'createdAt', (q.get('order') as 'asc' | 'desc') ?? 'desc')
    return paginate(list, q, 25)
  })
  route('GET', '/admin/users/:id', (req) => {
    can(requireAdmin(req), 'users.view')
    const u = db.adminUserRecords.find((x) => x.id === req.params.id)
    if (!u) fail(404, 'NOT_FOUND', 'User not found')
    return data({ ...u, ...db.findUser(u.id) })
  })
  route('GET', '/admin/users/:id/activity', (req) => {
    can(requireAdmin(req), 'users.view')
    const items = Array.from({ length: 24 }, (_, i) => ({ id: `ua_${i}`, type: db.pick(['login', 'ticket.purchased', 'event.viewed', 'message.sent', 'event.saved', 'profile.updated', 'wallet.top_up']), description: db.pick(['Logged in from Android', 'Bought 2 tickets for Bole Festival', 'Viewed Piggyvest Open House', 'Sent a message to Shot it moi', 'Saved Luxury Wedding Gala', 'Updated profile photo', 'Topped up wallet with ₦5,000']), source: db.pick(['web', 'android', 'ios']), createdAt: subDays(new Date(), i).toISOString() }))
    return paginate(items, req.query, 20)
  })
  route('GET', '/admin/users/:id/tickets', (req) => {
    can(requireAdmin(req), 'users.view')
    return paginate(db.adminBookings.filter((b) => b.buyer.id === req.params.id), req.query, 20)
  })
  route('GET', '/admin/users/:id/reports', (req) => {
    can(requireAdmin(req), 'users.view')
    return data(db.contentReports.filter((r) => r.reportedUser?.id === req.params.id || r.reporter.id === req.params.id))
  })
  route('POST', '/admin/users/:id/suspend', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'users.suspend')
    const u = db.adminUserRecords.find((x) => x.id === req.params.id)
    const raw = db.findUser(req.params.id ?? '')
    if (!u || !raw) fail(404, 'NOT_FOUND', 'User not found')
    const b = body<{ reason: string }>(req)
    requireFields(b, ['reason'])
    u.status = raw.status = 'suspended'
    u.suspendedReason = b.reason
    audit(admin, 'user.suspended', 'users', 'user', u.id, u.displayName, { status: 'active' }, { status: 'suspended', reason: b.reason })
    return data(u, 'Account suspended')
  })
  route('POST', '/admin/users/:id/reactivate', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'users.suspend')
    const u = db.adminUserRecords.find((x) => x.id === req.params.id)
    const raw = db.findUser(req.params.id ?? '')
    if (!u || !raw) fail(404, 'NOT_FOUND', 'User not found')
    u.status = raw.status = 'active'
    u.suspendedReason = null
    audit(admin, 'user.reactivated', 'users', 'user', u.id, u.displayName)
    return data(u, 'Account reactivated')
  })
  route('PATCH', '/admin/users/:id/roles', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'users.manage')
    const u = db.adminUserRecords.find((x) => x.id === req.params.id)
    const raw = db.findUser(req.params.id ?? '')
    if (!u || !raw) fail(404, 'NOT_FOUND', 'User not found')
    const b = body<{ roles: typeof u.roles }>(req)
    const before = [...u.roles]
    u.roles = raw.roles = b.roles
    audit(admin, 'user.roles_updated', 'users', 'user', u.id, u.displayName, { roles: before }, { roles: b.roles })
    return data(u, 'Roles updated')
  })
  route('POST', '/admin/users/:id/deletion/:decision', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'users.manage')
    const u = db.adminUserRecords.find((x) => x.id === req.params.id)
    if (!u?.deletionRequest) fail(404, 'NOT_FOUND', 'No deletion request')
    u.deletionRequest.status = req.params.decision === 'approve' ? 'completed' : 'cancelled'
    if (req.params.decision === 'approve') u.status = 'deactivated'
    audit(admin, `deletion.${req.params.decision}d`, 'users', 'user', u.id, u.displayName)
    return data(u)
  })
  route('GET', '/admin/deletion-requests', (req) => {
    can(requireAdmin(req), 'users.view')
    return paginate(db.adminUserRecords.filter((u) => u.deletionRequest), req.query, 25)
  })

  /* ---- events ---- */
  route('GET', '/admin/events', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'events.view')
    const q = req.query
    let list = db.adminEventRecords.filter((e) => textMatch([e.title, e.organizer.displayName, e.city], q.get('search')))
    const status = q.get('status')
    if (status && status !== 'all') list = list.filter((e) => e.status === status)
    const catId = q.get('categoryId')
    if (catId && catId !== 'all') list = list.filter((e) => e.category.id === catId)
    const mode = q.get('attendanceMode')
    if (mode && mode !== 'all') list = list.filter((e) => e.attendanceMode === mode)
    if (q.get('featured') === 'true') list = list.filter((e) => e.isFeatured)
    list = list.filter((e) => dateInRange(e.startsAt, q.get('dateFrom'), q.get('dateTo')))
    list = sortBy(list, q.get('sort') ?? 'startsAt', (q.get('order') as 'asc' | 'desc') ?? 'desc')
    return paginate(list, q, 25)
  })
  route('GET', '/admin/events/:id', (req) => {
    can(requireAdmin(req), 'events.view')
    const e = db.findEvent(req.params.id ?? '')
    const rec = db.adminEventRecords.find((x) => x.id === req.params.id)
    if (!e || !rec) fail(404, 'NOT_FOUND', 'Event not found')
    return data({ ...e, ...rec, organizer: e.organizer, bookings: db.adminBookings.filter((b) => b.event.id === e.id).slice(0, 10), reports: db.contentReports.filter((r) => r.targetType === 'event' && r.targetId === e.id) })
  })
  for (const action of ['approve', 'reject', 'suspend', 'restore', 'feature', 'unfeature'] as const) {
    route('POST', `/admin/events/:id/${action}`, (req) => {
      const admin = requireAdmin(req)
      can(admin, action === 'feature' || action === 'unfeature' ? 'events.feature' : 'events.moderate')
      const e = db.findEvent(req.params.id ?? '')
      const rec = db.adminEventRecords.find((x) => x.id === req.params.id)
      if (!e || !rec) fail(404, 'NOT_FOUND', 'Event not found')
      const b = body<{ reason?: string }>(req)
      if ((action === 'reject' || action === 'suspend') && !b.reason) fail(422, 'VALIDATION_ERROR', 'A reason is required and will be sent to the organizer.', { reason: ['Required'] })
      const before = { status: e.status, isFeatured: e.isFeatured }
      if (action === 'approve' || action === 'restore') e.status = rec.status = 'live'
      if (action === 'reject') { e.status = rec.status = 'rejected'; rec.rejectionReason = b.reason ?? null }
      if (action === 'suspend') e.status = rec.status = 'suspended'
      if (action === 'feature') e.isFeatured = rec.isFeatured = true
      if (action === 'unfeature') e.isFeatured = rec.isFeatured = false
      rec.reviewedBy = db.userSummary(db.ME_ID)
      audit(admin, `event.${action}d`.replace('dd', 'd'), 'events', 'event', e.id, e.title, before, { status: e.status, isFeatured: e.isFeatured, reason: b.reason })
      return data(rec, `Event ${action}d`.replace('dd', 'd'))
    })
  }
  route('GET', '/admin/categories', (req) => {
    can(requireAdmin(req), 'events.view')
    return data(db.categories.map((c) => ({ ...c, eventsCount: db.events.filter((e) => e.category.id === c.id).length })))
  })
  route('POST', '/admin/categories', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'categories.manage')
    const b = body<{ name: string; icon?: string }>(req)
    requireFields(b, ['name'])
    const c = { id: db.nextId('cat'), name: b.name, slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), icon: b.icon ?? 'sparkles', isActive: true }
    db.categories.push(c)
    audit(admin, 'category.created', 'events', 'category', c.id, c.name)
    return created(c, 'Category created')
  })
  route('PUT', '/admin/categories/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'categories.manage')
    const c = db.categories.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Category not found')
    Object.assign(c, body(req))
    audit(admin, 'category.updated', 'events', 'category', c.id, c.name)
    return data(c, 'Category updated')
  })
  route('DELETE', '/admin/categories/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'categories.manage')
    const idx = db.categories.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) {
      if (db.events.some((e) => e.category.id === req.params.id)) fail(409, 'CONFLICT', 'Category is in use. Deactivate it instead.')
      audit(admin, 'category.deleted', 'events', 'category', req.params.id ?? null, db.categories[idx]?.name ?? null)
      db.categories.splice(idx, 1)
    }
    return noContent()
  })

  /* ---- organizers ---- */
  route('GET', '/admin/organizers', (req) => {
    can(requireAdmin(req), 'organizers.view')
    const q = req.query
    let list = db.adminOrganizers.filter((o) => textMatch([o.user.displayName, o.user.email, o.businessName], q.get('search')))
    const type = q.get('type')
    if (type && type !== 'all') list = list.filter((o) => o.type === type || o.type === 'both')
    const vs = q.get('vendorStatus')
    if (vs && vs !== 'all') list = list.filter((o) => o.vendorStatus === vs)
    const ids = q.get('identityStatus')
    if (ids && ids !== 'all') list = list.filter((o) => o.identityStatus === ids)
    list = sortBy(list, q.get('sort') ?? 'grossRevenue', (q.get('order') as 'asc' | 'desc') ?? 'desc')
    return paginate(list, q, 25)
  })
  route('GET', '/admin/organizers/:id', (req) => {
    can(requireAdmin(req), 'organizers.view')
    const o = db.adminOrganizers.find((x) => x.id === req.params.id)
    if (!o) fail(404, 'NOT_FOUND', 'Organizer not found')
    return data({ ...o, events: db.adminEventRecords.filter((e) => e.organizer.id === o.user.id), settlements: db.settlements.filter((s) => s.organizer.id === o.user.id), vendorProfile: db.vendors.find((v) => v.userId === o.user.id) ?? null })
  })
  for (const action of ['verify', 'reject', 'suspend', 'reactivate'] as const) {
    route('POST', `/admin/organizers/:id/${action}`, (req) => {
      const admin = requireAdmin(req)
      can(admin, action === 'verify' || action === 'reject' ? 'organizers.verify' : 'organizers.manage')
      const o = db.adminOrganizers.find((x) => x.id === req.params.id)
      if (!o) fail(404, 'NOT_FOUND', 'Organizer not found')
      const b = body<{ reason?: string }>(req)
      const u = db.findUser(o.user.id)
      const v = db.vendors.find((x) => x.userId === o.user.id)
      if (action === 'verify') { o.identityStatus = 'verified'; if (u) { u.identityStatus = 'verified'; u.isVerified = true } if (v) { v.status = 'active'; v.isVerified = true; o.vendorStatus = 'active' } for (const d of o.verificationDocuments) d.status = 'approved' }
      if (action === 'reject') { o.identityStatus = 'failed'; if (u) u.identityStatus = 'failed'; if (v) { v.status = 'rejected'; o.vendorStatus = 'rejected' } }
      if (action === 'suspend') { if (v) { v.status = 'suspended'; o.vendorStatus = 'suspended' } }
      if (action === 'reactivate') { if (v) { v.status = 'active'; o.vendorStatus = 'active' } }
      audit(admin, `organizer.${action}`, 'organizers', 'organizer', o.id, o.businessName ?? o.user.displayName, null, { reason: b.reason })
      return data(o, `Organizer ${action === 'verify' ? 'verified' : action === 'reject' ? 'rejected' : action + 'd'}`)
    })
  }
  route('PUT', '/admin/organizers/:id/commission', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.commission.manage')
    const o = db.adminOrganizers.find((x) => x.id === req.params.id)
    if (!o) fail(404, 'NOT_FOUND', 'Organizer not found')
    const b = body<{ percent: number | null }>(req)
    const before = o.commissionPercent
    o.commissionPercent = b.percent
    audit(admin, 'commission.updated', 'finance', 'organizer', o.id, o.businessName ?? o.user.displayName, { percent: before }, { percent: b.percent })
    return data(o, 'Commission updated')
  })

  /* ---- bookings ---- */
  route('GET', '/admin/bookings', (req) => {
    can(requireAdmin(req), 'bookings.view')
    const q = req.query
    let list = db.adminBookings.filter((b) => textMatch([b.reference, b.buyer.displayName, b.buyer.email, b.event.title, b.providerReference], q.get('search')))
    const status = q.get('status')
    if (status && status !== 'all') list = list.filter((b) => b.status === status)
    const provider = q.get('provider')
    if (provider && provider !== 'all') list = list.filter((b) => b.provider === provider)
    if (q.get('eventId')) list = list.filter((b) => b.event.id === q.get('eventId'))
    list = list.filter((b) => dateInRange(b.createdAt, q.get('dateFrom'), q.get('dateTo')))
    return paginate(list, q, 25)
  })
  route('GET', '/admin/bookings/:id', (req) => {
    can(requireAdmin(req), 'bookings.view')
    const b = db.adminBookings.find((x) => x.id === req.params.id)
    if (!b) fail(404, 'NOT_FOUND', 'Booking not found')
    return data({ ...b, tickets: Array.from({ length: b.ticketsCount }, (_, i) => ({ id: `${b.id}_t${i}`, code: `${b.reference.slice(-4)}-${100 + i}-X${i}`, holderName: i === 0 ? b.buyer.displayName : `Guest ${i}`, status: i < b.checkedInCount ? 'checked_in' : b.status === 'paid' ? 'valid' : 'cancelled', checkedInAt: i < b.checkedInCount ? new Date().toISOString() : null })), timeline: [{ at: b.createdAt, label: 'Order created', by: 'system' }, { at: b.createdAt, label: `Payment ${b.status === 'failed' ? 'failed' : 'initiated'} via ${b.provider}`, by: 'system' }, ...(b.status === 'paid' ? [{ at: b.createdAt, label: 'Payment confirmed by webhook', by: 'system' }, { at: b.createdAt, label: 'Tickets issued and emailed', by: 'system' }] : [])], dispute: db.disputes.find((d) => d.id === b.disputeId) ?? null })
  })
  route('POST', '/admin/bookings/:id/refund', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'refunds.approve')
    const b = db.adminBookings.find((x) => x.id === req.params.id)
    if (!b) fail(404, 'NOT_FOUND', 'Booking not found')
    const p = body<{ amount: number; reason: string }>(req)
    requireFields(p, ['amount', 'reason'])
    if (p.amount > b.total) fail(422, 'VALIDATION_ERROR', 'Refund cannot exceed the order total.', { amount: ['Refund cannot exceed the order total.'] })
    b.status = 'refund_processing'
    const r = { id: db.nextId('rfd'), reference: `WP-RF-${db.between(1000, 9999)}`, booking: { id: b.id, reference: b.reference, event: b.event, buyer: b.buyer }, amount: p.amount, currency: 'NGN' as const, reason: p.reason, status: 'processing' as const, requestedAt: new Date().toISOString(), decidedBy: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }, decidedAt: new Date().toISOString(), provider: b.provider }
    db.refundRecords.unshift(r)
    audit(admin, 'refund.initiated', 'finance', 'booking', b.id, b.reference, null, { amount: p.amount, reason: p.reason })
    return created(r, 'Refund initiated')
  })
  route('POST', '/admin/bookings/:id/resend', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'bookings.manage')
    const b = db.adminBookings.find((x) => x.id === req.params.id)
    if (!b) fail(404, 'NOT_FOUND', 'Booking not found')
    audit(admin, 'booking.tickets_resent', 'bookings', 'booking', b.id, b.reference)
    return data({ sent: true }, `Tickets re-sent to ${b.buyer.email}`)
  })
  route('GET', '/admin/disputes', (req) => {
    can(requireAdmin(req), 'bookings.view')
    const status = req.query.get('status')
    return paginate(db.disputes.filter((d) => !status || status === 'all' || d.status === status), req.query, 25)
  })
  route('PATCH', '/admin/disputes/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'bookings.manage')
    const d = db.disputes.find((x) => x.id === req.params.id)
    if (!d) fail(404, 'NOT_FOUND', 'Dispute not found')
    const b = body<{ status?: typeof d.status; assignToMe?: boolean; note?: string }>(req)
    if (b.assignToMe) d.assignedTo = { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }
    if (b.status) d.status = b.status
    d.updatedAt = new Date().toISOString()
    audit(admin, 'dispute.updated', 'bookings', 'dispute', d.id, d.booking.reference, null, { status: d.status })
    return data(d, 'Dispute updated')
  })
  route('GET', '/admin/check-ins', (req) => {
    can(requireAdmin(req), 'bookings.view')
    const items = Array.from({ length: 60 }, (_, i) => { const e = db.pick(db.events); return { id: `aci_${i}`, event: { id: e.id, title: e.title }, attendee: db.userSummary(db.pick(db.users).id), ticketCode: `${e.id.slice(-3).toUpperCase()}-${100 + i}`, checkedInBy: db.userSummary('usr_bestchefz'), method: db.pick(['scan', 'scan', 'manual']), device: db.pick(['android', 'ios', 'web']), checkedInAt: subDays(new Date(), i / 10).toISOString(), result: db.pick(['ok', 'ok', 'ok', 'already_checked_in', 'not_found']) } })
    return paginate(items.filter((c) => textMatch([c.event.title, c.attendee.displayName, c.ticketCode], req.query.get('search'))), req.query, 25)
  })
  route('GET', '/admin/inventory', (req) => {
    can(requireAdmin(req), 'bookings.view')
    const rows = db.events.filter((e) => e.status === 'live').flatMap((e) => e.ticketTypes.map((t) => ({ id: t.id, event: { id: e.id, title: e.title, startsAt: e.startsAt }, ticketType: t.name, price: t.price, quantity: t.quantity, sold: t.sold, remaining: t.quantity - t.sold, salesEndAt: t.salesEndAt, sellThrough: t.quantity ? Math.round((t.sold / t.quantity) * 100) : 0 })))
    return paginate(rows.filter((r) => textMatch([r.event.title, r.ticketType], req.query.get('search'))), req.query, 25)
  })

  /* ---- finance ---- */
  route('GET', '/admin/finance/summary', (req) => {
    can(requireAdmin(req), 'finance.view')
    const p = period(req.query)
    const res: FinanceSummary = { period: { from: p.from, to: p.to }, currency: 'NGN', gtv: kpi(p.days, 48_000_000, 30_000_000), platformRevenue: kpi(p.days, 2_400_000, 1_500_000), gatewayFees: 18_400_000, refunds: db.refundRecords.reduce((a, r) => a + r.amount, 0), pendingSettlements: db.settlements.filter((s) => s.status !== 'paid').reduce((a, s) => a + s.netPayable, 0), paidOut: db.payouts.filter((x) => x.status === 'paid').reduce((a, x) => a + x.amount, 0), walletFloat: 412_000_000, byProvider: [{ provider: 'paystack', volume: 820_000_000, count: 14200, successRate: 97.8 }, { provider: 'monnify', volume: 310_000_000, count: 6100, successRate: 96.1 }, { provider: 'stripe', volume: 140_000_000, count: 1900, successRate: 98.9 }, { provider: 'paypal', volume: 52_000_000, count: 640, successRate: 81.2 }, { provider: 'wallet', volume: 96_000_000, count: 4100, successRate: 99.6 }], revenueByDay: trend(p.days, 48_000_000, 30_000_000).map((t) => ({ date: t.date, gtv: t.value, revenue: Math.round(t.value * 0.05) })) }
    return data(res)
  })
  route('GET', '/admin/finance/transactions', (req) => {
    can(requireAdmin(req), 'finance.view')
    const q = req.query
    let list = db.financeTransactions.filter((t) => textMatch([t.reference, t.providerReference, t.user?.displayName, t.event?.title], q.get('search')))
    for (const key of ['type', 'provider', 'status', 'reconciliationStatus'] as const) { const v = q.get(key); if (v && v !== 'all') list = list.filter((t) => t[key] === v) }
    list = list.filter((t) => dateInRange(t.createdAt, q.get('dateFrom'), q.get('dateTo')))
    return paginate(list, q, 25)
  })
  route('POST', '/admin/finance/transactions/:id/reconcile', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.reconcile')
    const t = db.financeTransactions.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Transaction not found')
    const b = body<{ status: 'matched' | 'mismatch'; note?: string }>(req)
    t.reconciliationStatus = b.status ?? 'matched'
    audit(admin, 'transaction.reconciled', 'finance', 'transaction', t.id, t.reference, null, { status: t.reconciliationStatus, note: b.note })
    return data(t, 'Transaction reconciled')
  })
  route('GET', '/admin/finance/settlements', (req) => {
    can(requireAdmin(req), 'finance.settlements')
    const q = req.query
    let list = db.settlements.filter((s) => textMatch([s.reference, s.organizer.displayName, s.organizer.businessName, s.event.title], q.get('search')))
    const status = q.get('status')
    if (status && status !== 'all') list = list.filter((s) => s.status === status)
    return paginate(list, q, 25)
  })
  route('POST', '/admin/finance/settlements/:id/hold', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.settlements')
    const s = db.settlements.find((x) => x.id === req.params.id)
    if (!s) fail(404, 'NOT_FOUND', 'Settlement not found')
    const b = body<{ reason: string }>(req)
    requireFields(b, ['reason'])
    s.status = 'on_hold'
    s.holdReason = b.reason
    audit(admin, 'settlement.held', 'finance', 'settlement', s.id, s.reference, null, { reason: b.reason })
    return data(s, 'Settlement placed on hold')
  })
  route('POST', '/admin/finance/settlements/:id/release', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.settlements')
    const s = db.settlements.find((x) => x.id === req.params.id)
    if (!s) fail(404, 'NOT_FOUND', 'Settlement not found')
    s.status = 'ready'
    s.holdReason = null
    audit(admin, 'settlement.released', 'finance', 'settlement', s.id, s.reference)
    return data(s, 'Settlement released')
  })
  route('GET', '/admin/finance/payouts', (req) => {
    can(requireAdmin(req), 'finance.view')
    const status = req.query.get('status')
    return paginate(db.payouts.filter((p) => (!status || status === 'all' || p.status === status) && textMatch([p.reference, p.organizer.displayName, p.organizer.businessName], req.query.get('search'))), req.query, 25)
  })
  route('POST', '/admin/finance/payouts', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.settlements')
    const b = body<{ settlementIds: string[] }>(req)
    if (!b.settlementIds?.length) fail(422, 'VALIDATION_ERROR', 'Select at least one settlement.')
    const sel = db.settlements.filter((s) => b.settlementIds.includes(s.id) && s.status === 'ready')
    if (!sel.length) fail(409, 'CONFLICT', 'Only settlements in "ready" status can be paid out.')
    const first = sel[0]!
    const p = { id: db.nextId('po'), reference: `WP-PO-${db.between(1000, 9999)}`, settlementIds: sel.map((s) => s.id), organizer: first.organizer, bankAccount: { bankName: 'GTBank', accountNumber: '0123456789', accountName: first.organizer.displayName.toUpperCase() }, amount: sel.reduce((a, s) => a + s.netPayable, 0), currency: 'NGN' as const, provider: 'monnify' as const, status: 'requested' as const, requestedBy: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }, approvedBy: null, failureReason: null, createdAt: new Date().toISOString(), completedAt: null }
    db.payouts.unshift(p)
    for (const s of sel) s.payoutId = p.id
    audit(admin, 'payout.requested', 'finance', 'payout', p.id, p.reference, null, { amount: p.amount })
    return created(p, 'Payout requested. A second approver must approve it.')
  })
  route('POST', '/admin/finance/payouts/:id/approve', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.payouts.approve')
    const p = db.payouts.find((x) => x.id === req.params.id)
    if (!p) fail(404, 'NOT_FOUND', 'Payout not found')
    if (p.requestedBy?.id === admin.id) fail(403, 'FORBIDDEN', 'Four-eyes rule: the requester cannot approve their own payout.')
    const b = body<{ otp: string }>(req)
    if (b.otp !== VALID_OTP) fail(422, 'OTP_INVALID', 'Enter your authenticator code to approve.', { otp: ['Invalid code'] })
    p.status = 'processing'
    p.approvedBy = { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }
    setTimeout(() => { p.status = 'paid'; p.completedAt = new Date().toISOString(); for (const s of db.settlements) if (p.settlementIds.includes(s.id)) { s.status = 'paid'; s.paidAt = p.completedAt } }, 5000)
    audit(admin, 'payout.approved', 'finance', 'payout', p.id, p.reference, null, { amount: p.amount })
    return data(p, 'Payout approved and sent to the provider')
  })
  route('POST', '/admin/finance/payouts/:id/reject', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.payouts.approve')
    const p = db.payouts.find((x) => x.id === req.params.id)
    if (!p) fail(404, 'NOT_FOUND', 'Payout not found')
    const b = body<{ reason: string }>(req)
    requireFields(b, ['reason'])
    p.status = 'rejected'
    p.failureReason = b.reason
    for (const s of db.settlements) if (p.settlementIds.includes(s.id)) s.payoutId = null
    audit(admin, 'payout.rejected', 'finance', 'payout', p.id, p.reference, null, { reason: b.reason })
    return data(p, 'Payout rejected')
  })
  route('GET', '/admin/finance/refunds', (req) => {
    can(requireAdmin(req), 'refunds.view')
    const status = req.query.get('status')
    return paginate(db.refundRecords.filter((r) => (!status || status === 'all' || r.status === status) && textMatch([r.reference, r.booking.reference, r.booking.buyer.displayName], req.query.get('search'))), req.query, 25)
  })
  route('POST', '/admin/finance/refunds/:id/:decision', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'refunds.approve')
    const r = db.refundRecords.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Refund not found')
    const approve = req.params.decision === 'approve'
    r.status = approve ? 'completed' : 'rejected'
    r.decidedBy = { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }
    r.decidedAt = new Date().toISOString()
    const bk = db.adminBookings.find((b) => b.id === r.booking.id)
    if (bk) bk.status = approve ? 'refunded' : 'paid'
    audit(admin, approve ? 'refund.approved' : 'refund.rejected', 'finance', 'refund', r.id, r.reference, null, { amount: r.amount })
    return data(r, approve ? 'Refund approved' : 'Refund rejected')
  })
  route('GET', '/admin/finance/commissions', (req) => {
    can(requireAdmin(req), 'finance.view')
    return data(db.commissionRules)
  })
  route('PUT', '/admin/finance/commissions/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.commission.manage')
    const r = db.commissionRules.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Rule not found')
    const b = body<{ percent?: number; fixedFee?: number }>(req)
    if (b.percent !== undefined && (b.percent < 0 || b.percent > 30)) fail(422, 'VALIDATION_ERROR', 'Commission must be between 0% and 30%.', { percent: ['Between 0 and 30'] })
    const before = { percent: r.percent, fixedFee: r.fixedFee }
    Object.assign(r, b, { updatedAt: new Date().toISOString(), updatedBy: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName } })
    audit(admin, 'commission.updated', 'finance', 'commission_rule', r.id, r.scopeLabel, before, { percent: r.percent, fixedFee: r.fixedFee })
    return data(r, 'Commission rule updated')
  })
  route('POST', '/admin/finance/commissions', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'finance.commission.manage')
    const b = body<{ scope: 'category' | 'organizer'; scopeId: string; scopeLabel: string; percent: number; fixedFee: number }>(req)
    requireFields(b, ['scope', 'scopeId', 'percent'])
    const r = { id: db.nextId('cr'), scope: b.scope, scopeId: b.scopeId, scopeLabel: b.scopeLabel ?? b.scopeId, percent: b.percent, fixedFee: b.fixedFee ?? 0, currency: 'NGN' as const, effectiveFrom: new Date().toISOString(), updatedBy: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }, updatedAt: new Date().toISOString() }
    db.commissionRules.push(r)
    audit(admin, 'commission.created', 'finance', 'commission_rule', r.id, r.scopeLabel, null, { percent: r.percent })
    return created(r, 'Commission rule created')
  })
  route('GET', '/admin/finance/gateways', (req) => {
    can(requireAdmin(req), 'finance.view')
    return data([
      { provider: 'paystack', successRate: 97.8, avgLatencyMs: 820, volume: 14200, failures: 312, status: 'operational', series: trend(14, 97, 3) },
      { provider: 'monnify', successRate: 96.1, avgLatencyMs: 1100, volume: 6100, failures: 238, status: 'operational', series: trend(14, 96, 4) },
      { provider: 'stripe', successRate: 98.9, avgLatencyMs: 640, volume: 1900, failures: 21, status: 'operational', series: trend(14, 98, 2) },
      { provider: 'paypal', successRate: 81.2, avgLatencyMs: 2400, volume: 640, failures: 120, status: 'degraded', series: trend(14, 88, 14) },
    ])
  })

  /* ---- moderation ---- */
  route('GET', '/admin/moderation/reports', (req) => {
    can(requireAdmin(req), 'moderation.view')
    const q = req.query
    let list = db.contentReports.filter((r) => textMatch([r.targetPreview.title, r.reporter.displayName, r.reportedUser?.displayName, r.reason], q.get('search')))
    for (const key of ['status', 'targetType', 'priority', 'reason'] as const) { const v = q.get(key); if (v && v !== 'all') list = list.filter((r) => r[key] === v) }
    return paginate(list, q, 25)
  })
  route('GET', '/admin/moderation/reports/:id', (req) => {
    can(requireAdmin(req), 'moderation.view')
    const r = db.contentReports.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Report not found')
    return data({ ...r, history: db.contentReports.filter((x) => x.reportedUser?.id === r.reportedUser?.id && x.id !== r.id).slice(0, 5) })
  })
  route('PATCH', '/admin/moderation/reports/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'moderation.view')
    const r = db.contentReports.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Report not found')
    const b = body<{ assignToMe?: boolean; priority?: typeof r.priority; status?: 'reviewing' }>(req)
    if (b.assignToMe) r.assignedTo = { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }
    if (b.priority) r.priority = b.priority
    if (b.status) r.status = b.status
    return data(r)
  })
  route('POST', '/admin/moderation/reports/:id/actions', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'moderation.act')
    const r = db.contentReports.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Report not found')
    const b = body<{ action: 'removed' | 'restored' | 'warned' | 'suspended' | 'dismissed'; note: string }>(req)
    requireFields(b, ['action', 'note'])
    r.status = b.action === 'dismissed' ? 'dismissed' : 'actioned'
    r.resolution = { action: b.action, note: b.note, by: `${admin.firstName} ${admin.lastName}`, at: new Date().toISOString() }
    if (b.action === 'suspended' && r.reportedUser) { const u = db.findUser(r.reportedUser.id); if (u) u.status = 'suspended'; const rec = db.adminUserRecords.find((x) => x.id === r.reportedUser?.id); if (rec) rec.status = 'suspended' }
    audit(admin, `content.${b.action}`, 'moderation', r.targetType, r.targetId, r.targetPreview.title, null, { note: b.note })
    return data(r, `Report ${b.action}`)
  })
  route('GET', '/admin/communities', (req) => {
    can(requireAdmin(req), 'moderation.view')
    const status = req.query.get('status')
    return paginate(db.adminCommunities.filter((c) => (!status || status === 'all' || c.status === status) && textMatch([c.name, c.owner.displayName, c.event?.title], req.query.get('search'))), req.query, 25)
  })
  route('POST', '/admin/communities/:id/:action', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'moderation.act')
    const c = db.adminCommunities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    const action = req.params.action
    c.status = action === 'suspend' ? 'suspended' : action === 'archive' ? 'archived' : 'active'
    audit(admin, `community.${action}`, 'moderation', 'community', c.id, c.name)
    return data(c, `Community ${action}d`.replace('dd', 'd'))
  })

  /* ---- notifications ---- */
  route('GET', '/admin/notifications/campaigns', (req) => {
    can(requireAdmin(req), 'notifications.view')
    const status = req.query.get('status')
    return paginate(db.campaigns.filter((c) => (!status || status === 'all' || c.status === status) && textMatch([c.name, c.subject], req.query.get('search'))), req.query, 25)
  })
  route('GET', '/admin/notifications/campaigns/:id', (req) => {
    can(requireAdmin(req), 'notifications.view')
    const c = db.campaigns.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Campaign not found')
    return data({ ...c, deliveryByChannel: c.channels.map((ch) => ({ channel: ch, sent: Math.round(c.stats.sent / c.channels.length), delivered: Math.round(c.stats.delivered / c.channels.length), opened: Math.round(c.stats.opened / c.channels.length), failed: Math.round(c.stats.failed / c.channels.length) })) })
  })
  route('POST', '/admin/notifications/campaigns', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'notifications.send')
    const b = body<{ name: string; channels: string[]; audience: Record<string, unknown>; subject?: string; body: string; scheduledAt?: string | null; templateId?: string | null }>(req)
    requireFields(b, ['name', 'body'])
    if (!b.channels?.length) fail(422, 'VALIDATION_ERROR', 'Choose at least one channel.', { channels: ['Choose at least one channel.'] })
    const c = { id: db.nextId('cmp'), name: b.name, channels: b.channels as ('push' | 'email')[], audience: { type: (b.audience?.type as 'all') ?? 'all', filters: (b.audience?.filters as Record<string, string>) ?? {}, estimatedSize: db.between(500, 50000) }, templateId: b.templateId ?? null, subject: b.subject ?? null, body: b.body, status: (b.scheduledAt ? 'scheduled' : 'draft') as 'draft', scheduledAt: b.scheduledAt ?? null, sentAt: null, stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 }, createdBy: { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }, createdAt: new Date().toISOString() }
    db.campaigns.unshift(c)
    audit(admin, 'campaign.created', 'notifications', 'campaign', c.id, c.name)
    return created(c, 'Campaign saved')
  })
  route('POST', '/admin/notifications/campaigns/:id/send', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'notifications.send')
    const c = db.campaigns.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Campaign not found')
    c.status = 'sending'
    setTimeout(() => { c.status = 'sent'; c.sentAt = new Date().toISOString(); c.stats = { sent: c.audience.estimatedSize, delivered: Math.round(c.audience.estimatedSize * 0.96), opened: Math.round(c.audience.estimatedSize * 0.38), clicked: Math.round(c.audience.estimatedSize * 0.12), failed: Math.round(c.audience.estimatedSize * 0.04) } }, 4000)
    audit(admin, 'campaign.sent', 'notifications', 'campaign', c.id, c.name, null, { audience: c.audience.estimatedSize })
    return data(c, 'Campaign is sending')
  })
  route('POST', '/admin/notifications/campaigns/:id/cancel', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'notifications.send')
    const c = db.campaigns.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Campaign not found')
    c.status = 'cancelled'
    audit(admin, 'campaign.cancelled', 'notifications', 'campaign', c.id, c.name)
    return data(c, 'Campaign cancelled')
  })
  route('POST', '/admin/notifications/test', (req) => {
    can(requireAdmin(req), 'notifications.send')
    return data({ sent: true }, 'Test notification sent to your account')
  })
  route('GET', '/admin/notifications/templates', (req) => {
    can(requireAdmin(req), 'notifications.view')
    return data(db.templates)
  })
  route('PUT', '/admin/notifications/templates/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'notifications.send')
    const t = db.templates.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Template not found')
    Object.assign(t, body(req), { updatedAt: new Date().toISOString() })
    audit(admin, 'template.updated', 'notifications', 'template', t.id, t.name)
    return data(t, 'Template saved')
  })
  route('POST', '/admin/notifications/templates', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'notifications.send')
    const b = body<{ key: string; name: string; channel: 'email'; subject?: string; body: string }>(req)
    requireFields(b, ['key', 'name', 'channel', 'body'])
    const t = { id: db.nextId('tpl'), key: b.key, name: b.name, channel: b.channel, subject: b.subject ?? null, body: b.body, variables: [...new Set([...b.body.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1] as string))], isActive: true, updatedAt: new Date().toISOString() }
    db.templates.push(t)
    audit(admin, 'template.created', 'notifications', 'template', t.id, t.name)
    return created(t, 'Template created')
  })

  /* ---- settings / cms ---- */
  route('GET', '/admin/settings', (req) => { can(requireAdmin(req), 'settings.view'); return data(db.settings) })
  route('PUT', '/admin/settings', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'settings.manage')
    const b = body<Partial<typeof db.settings>>(req)
    const next = { ...db.settings, ...b, general: { ...db.settings.general, ...(b.general ?? {}) }, payments: { ...db.settings.payments, ...(b.payments ?? {}) }, features: { ...db.settings.features, ...(b.features ?? {}) }, app: { ...db.settings.app, ...(b.app ?? {}) }, legal: { ...db.settings.legal, ...(b.legal ?? {}) } }
    audit(admin, 'settings.updated', 'settings', 'settings', null, Object.keys(b).join(', '), null, b as Record<string, unknown>)
    db.setSettings(next)
    return data(next, 'Settings saved')
  })
  route('GET', '/admin/banners', (req) => { can(requireAdmin(req), 'settings.view'); return data(db.banners) })
  route('POST', '/admin/banners', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'settings.manage')
    const b = body<Partial<(typeof db.banners)[number]>>(req)
    requireFields(b as Record<string, unknown>, ['title', 'placement'])
    const bn = { id: db.nextId('bn'), title: b.title ?? '', subtitle: b.subtitle ?? null, imageUrl: b.imageUrl ?? null, ctaLabel: b.ctaLabel ?? null, ctaUrl: b.ctaUrl ?? null, placement: b.placement ?? 'home_inline', audience: b.audience ?? 'all', startsAt: b.startsAt ?? null, endsAt: b.endsAt ?? null, isActive: b.isActive ?? true, priority: b.priority ?? db.banners.length + 1, impressions: 0, clicks: 0 } as (typeof db.banners)[number]
    db.banners.push(bn)
    audit(admin, 'banner.created', 'settings', 'banner', bn.id, bn.title)
    return created(bn, 'Banner created')
  })
  route('PUT', '/admin/banners/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'settings.manage')
    const bn = db.banners.find((x) => x.id === req.params.id)
    if (!bn) fail(404, 'NOT_FOUND', 'Banner not found')
    Object.assign(bn, body(req))
    audit(admin, 'banner.updated', 'settings', 'banner', bn.id, bn.title)
    return data(bn, 'Banner saved')
  })
  route('DELETE', '/admin/banners/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'settings.manage')
    const idx = db.banners.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) { audit(admin, 'banner.deleted', 'settings', 'banner', req.params.id ?? null, db.banners[idx]?.title ?? null); db.banners.splice(idx, 1) }
    return noContent()
  })
  route('GET', '/admin/pages', (req) => { can(requireAdmin(req), 'settings.view'); return data(db.cmsPages) })
  route('PUT', '/admin/pages/:slug', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'settings.manage')
    const p = db.cmsPages.find((x) => x.slug === req.params.slug)
    if (!p) fail(404, 'NOT_FOUND', 'Page not found')
    const b = body<{ title?: string; content?: string }>(req)
    if (b.title) p.title = b.title
    if (b.content !== undefined) p.content = b.content
    p.updatedAt = new Date().toISOString()
    p.updatedBy = `${admin.firstName} ${admin.lastName}`
    if (p.slug === 'terms') db.settings.legal.termsUpdatedAt = p.updatedAt
    if (p.slug === 'privacy') db.settings.legal.privacyUpdatedAt = p.updatedAt
    audit(admin, 'page.updated', 'settings', 'page', p.id, p.title)
    return data(p, 'Page published')
  })

  /* ---- roles / admins / logs ---- */
  route('GET', '/admin/permissions', (req) => { requireAdmin(req); return data(db.permissions) })
  route('GET', '/admin/roles', (req) => { requireAdmin(req); return data(db.roles) })
  route('POST', '/admin/roles', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'roles.manage')
    const b = body<{ name: string; description?: string; permissions: PermissionKey[] }>(req)
    requireFields(b, ['name'])
    const r: Role = { id: db.nextId('role'), name: b.name, slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), description: b.description ?? '', permissions: b.permissions ?? [], isSystem: false, membersCount: 0, createdAt: new Date().toISOString() }
    db.roles.push(r)
    audit(admin, 'role.created', 'access', 'role', r.id, r.name, null, { permissions: r.permissions })
    return created(r, 'Role created')
  })
  route('PUT', '/admin/roles/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'roles.manage')
    const r = db.roles.find((x) => x.id === req.params.id)
    if (!r) fail(404, 'NOT_FOUND', 'Role not found')
    if (r.isSystem) fail(403, 'FORBIDDEN', 'System roles cannot be edited.')
    const before = { permissions: [...r.permissions] }
    Object.assign(r, body(req))
    for (const a of db.adminUsers) if (a.roles.some((x) => x.id === r.id)) a.permissions = [...new Set(a.roles.flatMap((x) => db.roles.find((rr) => rr.id === x.id)?.permissions ?? []))]
    audit(admin, 'role.updated', 'access', 'role', r.id, r.name, before, { permissions: r.permissions })
    return data(r, 'Role updated')
  })
  route('DELETE', '/admin/roles/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'roles.manage')
    const idx = db.roles.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) {
      if (db.roles[idx]?.isSystem) fail(403, 'FORBIDDEN', 'System roles cannot be deleted.')
      if ((db.roles[idx]?.membersCount ?? 0) > 0) fail(409, 'CONFLICT', 'Reassign members before deleting this role.')
      audit(admin, 'role.deleted', 'access', 'role', req.params.id ?? null, db.roles[idx]?.name ?? null)
      db.roles.splice(idx, 1)
    }
    return noContent()
  })
  route('GET', '/admin/admins', (req) => { can(requireAdmin(req), 'roles.manage'); return data(db.adminUsers) })
  route('POST', '/admin/admins', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'roles.manage')
    const b = body<{ firstName: string; lastName: string; email: string; roleIds: string[] }>(req)
    requireFields(b, ['firstName', 'lastName', 'email'])
    if (db.adminUsers.some((a) => a.email === b.email)) fail(422, 'VALIDATION_ERROR', 'An admin with this email exists.', { email: ['Already exists'] })
    const rs = db.roles.filter((r) => b.roleIds?.includes(r.id))
    const a: AdminUser = { id: db.nextId('adm'), firstName: b.firstName, lastName: b.lastName, email: b.email, avatarUrl: null, roles: rs.map((r) => ({ id: r.id, name: r.name, slug: r.slug })), permissions: [...new Set(rs.flatMap((r) => r.permissions))], status: 'invited', twoFactorEnabled: false, lastLoginAt: null, createdAt: new Date().toISOString() }
    db.adminUsers.push(a)
    for (const r of rs) r.membersCount += 1
    audit(admin, 'admin.invited', 'access', 'admin', a.id, a.email, null, { roles: rs.map((r) => r.name) })
    return created(a, 'Invitation sent')
  })
  route('PATCH', '/admin/admins/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'roles.manage')
    const a = db.adminUsers.find((x) => x.id === req.params.id)
    if (!a) fail(404, 'NOT_FOUND', 'Admin not found')
    const b = body<{ roleIds?: string[]; status?: 'active' | 'suspended' }>(req)
    if (a.id === admin.id && b.status === 'suspended') fail(409, 'CONFLICT', 'You cannot suspend yourself.')
    if (b.roleIds) { const rs = db.roles.filter((r) => b.roleIds?.includes(r.id)); a.roles = rs.map((r) => ({ id: r.id, name: r.name, slug: r.slug })); a.permissions = [...new Set(rs.flatMap((r) => r.permissions))] }
    if (b.status) a.status = b.status
    audit(admin, 'admin.updated', 'access', 'admin', a.id, a.email, null, b as Record<string, unknown>)
    return data(a, 'Admin updated')
  })
  route('GET', '/admin/audit-logs', (req) => {
    can(requireAdmin(req), 'audit.view')
    const q = req.query
    let list = db.auditLogs.filter((l) => textMatch([l.action, l.targetLabel, l.actor?.email, l.correlationId], q.get('search')))
    const mod = q.get('module')
    if (mod && mod !== 'all') list = list.filter((l) => l.module === mod)
    const actor = q.get('actorId')
    if (actor) list = list.filter((l) => l.actor?.id === actor)
    list = list.filter((l) => dateInRange(l.createdAt, q.get('dateFrom'), q.get('dateTo')))
    return paginate(list, q, 25)
  })
  route('GET', '/admin/security-logs', (req) => {
    can(requireAdmin(req), 'audit.view')
    const ev = req.query.get('event')
    return paginate(db.securityLogs.filter((l) => (!ev || ev === 'all' || l.event === ev) && textMatch([l.actor?.email, l.ip, l.location], req.query.get('search'))), req.query, 25)
  })

  /* ---- reports ---- */
  route('GET', '/admin/reports/definitions', (req) => {
    can(requireAdmin(req), 'reports.view')
    return data([
      { key: 'user_acquisition', name: 'User acquisition', description: 'New sign-ups by source, city and plan', dimensions: ['day', 'week', 'month', 'source', 'city'], metrics: ['signups', 'verified', 'activated'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'user_engagement', name: 'User engagement', description: 'Active users, sessions and retention', dimensions: ['day', 'week', 'month', 'source'], metrics: ['dau', 'wau', 'mau', 'sessions'], exportFormats: ['csv', 'xlsx'] },
      { key: 'event_performance', name: 'Event performance', description: 'Views, conversions and check-ins per event', dimensions: ['category', 'city', 'organizer'], metrics: ['views', 'tickets', 'conversion', 'checkIns'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'ticket_sales', name: 'Ticket sales', description: 'Tickets sold and GTV over time', dimensions: ['day', 'week', 'month', 'category'], metrics: ['tickets', 'gtv', 'avgOrder'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'revenue', name: 'Revenue', description: 'Platform revenue by stream', dimensions: ['day', 'week', 'month'], metrics: ['commission', 'serviceFees', 'subscriptions', 'promotions'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'organizer_performance', name: 'Organizer performance', description: 'Top organizers by sales and ratings', dimensions: ['organizer'], metrics: ['events', 'tickets', 'gtv', 'refundRate'], exportFormats: ['csv', 'xlsx'] },
      { key: 'payments', name: 'Payments', description: 'Gateway volumes, success rates and fees', dimensions: ['day', 'provider'], metrics: ['volume', 'successRate', 'fees'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'settlements', name: 'Settlements', description: 'Settlement and payout status by organizer', dimensions: ['organizer', 'month'], metrics: ['gross', 'commission', 'net', 'paid'], exportFormats: ['csv', 'xlsx', 'pdf'] },
      { key: 'community_engagement', name: 'Community engagement', description: 'Messages, statuses and live sessions', dimensions: ['day', 'week', 'month'], metrics: ['messages', 'statuses', 'liveSessions', 'activeCommunities'], exportFormats: ['csv', 'xlsx'] },
    ])
  })
  route('POST', '/admin/reports/:key/run', (req) => {
    can(requireAdmin(req), 'reports.view')
    const b = body<{ from: string; to: string; groupBy?: string }>(req)
    const groupBy = b.groupBy ?? 'day'
    const days = Math.max(1, Math.min(90, Math.round((Date.parse(b.to ?? '') - Date.parse(b.from ?? '')) / 86400000) + 1 || 30))
    const key = req.params.key as ReportResult['key']
    const dims: Record<string, string[]> = { source: ['web', 'android', 'ios'], city: ['Port Harcourt', 'Lagos', 'Abuja', 'Ibadan'], category: db.categories.map((c) => c.name).slice(0, 8), provider: ['paystack', 'monnify', 'stripe', 'paypal', 'wallet'], organizer: db.adminOrganizers.slice(0, 10).map((o) => o.businessName ?? o.user.displayName) }
    const labels = dims[groupBy] ?? Array.from({ length: groupBy === 'month' ? 6 : groupBy === 'week' ? 8 : days }, (_, i) => (groupBy === 'month' ? subDays(new Date(), (5 - i) * 30).toISOString().slice(0, 7) : subDays(new Date(), (groupBy === 'week' ? (7 - i) * 7 : days - 1 - i)).toISOString().slice(0, 10)))
    const metricsByKey: Record<string, Array<[string, string, 'number' | 'money' | 'percent']>> = {
      user_acquisition: [['signups', 'Sign-ups', 'number'], ['verified', 'Verified', 'number'], ['activated', 'Activated', 'number']],
      user_engagement: [['dau', 'DAU', 'number'], ['sessions', 'Sessions', 'number'], ['retention', 'D7 retention', 'percent']],
      event_performance: [['views', 'Views', 'number'], ['tickets', 'Tickets', 'number'], ['conversion', 'Conversion', 'percent'], ['checkIns', 'Check-ins', 'number']],
      ticket_sales: [['tickets', 'Tickets', 'number'], ['gtv', 'GTV', 'money'], ['avgOrder', 'Avg order', 'money']],
      revenue: [['commission', 'Commission', 'money'], ['serviceFees', 'Service fees', 'money'], ['subscriptions', 'Subscriptions', 'money'], ['promotions', 'Promotions', 'money']],
      organizer_performance: [['events', 'Events', 'number'], ['tickets', 'Tickets', 'number'], ['gtv', 'GTV', 'money'], ['refundRate', 'Refund rate', 'percent']],
      payments: [['volume', 'Volume', 'money'], ['count', 'Transactions', 'number'], ['successRate', 'Success rate', 'percent'], ['fees', 'Fees', 'money']],
      settlements: [['gross', 'Gross', 'money'], ['commission', 'Commission', 'money'], ['net', 'Net payable', 'money'], ['paid', 'Paid out', 'money']],
      community_engagement: [['messages', 'Messages', 'number'], ['statuses', 'Statuses', 'number'], ['liveSessions', 'Live sessions', 'number'], ['activeCommunities', 'Active communities', 'number']],
    }
    const metrics = metricsByKey[key] ?? metricsByKey.ticket_sales!
    const rows = labels.map((label) => { const row: Record<string, string | number | null> = { [groupBy]: label }; for (const [k, , type] of metrics) row[k] = type === 'percent' ? Number((40 + db.rand() * 55).toFixed(1)) : type === 'money' ? db.between(50, 900) * 100000 : db.between(20, 900); return row })
    const totals: Record<string, number> = {}
    for (const [k, , type] of metrics) totals[k] = type === 'percent' ? Number((rows.reduce((a, r) => a + Number(r[k]), 0) / rows.length).toFixed(1)) : rows.reduce((a, r) => a + Number(r[k]), 0)
    const res: ReportResult = { key, period: { from: b.from, to: b.to }, groupBy, columns: [{ key: groupBy, label: groupBy[0]!.toUpperCase() + groupBy.slice(1), type: 'string' }, ...metrics.map(([k, label, type]) => ({ key: k, label, type }))], rows, totals, series: metrics.slice(0, 2).map(([k, label]) => ({ name: label, points: rows.map((r) => ({ date: String(r[groupBy]), value: Number(r[k]) })) })) }
    return data(res)
  })
  route('POST', '/admin/reports/:key/export', (req) => {
    can(requireAdmin(req), 'reports.export')
    const b = body<{ format: 'csv' | 'xlsx' | 'pdf' }>(req)
    const job = { id: db.nextId('exp'), status: 'ready' as const, format: b.format ?? 'csv', downloadUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(`Wedpluz export ${req.params.key} (${b.format})`)}`, expiresAt: addDays(new Date(), 1).toISOString() }
    exportJobs.set(job.id, job)
    return created(job)
  })
  route('GET', '/admin/exports/:id', (req) => {
    requireAdmin(req)
    const job = exportJobs.get(req.params.id ?? '')
    if (!job) fail(404, 'NOT_FOUND', 'Export not found')
    return data(job)
  })

  /* ---- support ---- */
  route('GET', '/admin/support/tickets', (req) => {
    can(requireAdmin(req), 'support.view')
    const q = req.query
    let list = db.supportTickets.filter((t) => textMatch([t.reference, t.subject, t.user.displayName, t.user.email], q.get('search')))
    for (const key of ['status', 'category', 'priority'] as const) { const v = q.get(key); if (v && v !== 'all') list = list.filter((t) => t[key] === v) }
    return paginate(list, q, 25)
  })
  route('GET', '/admin/support/tickets/:id', (req) => {
    can(requireAdmin(req), 'support.view')
    const t = db.supportTickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    return data({ ...t, messages: [{ id: 'sm_1', author: t.user, isStaff: false, body: 'Hi, I paid for 2 tickets but only received one email. Reference WP-ORD-8012.', createdAt: t.createdAt }, ...(t.messagesCount > 1 ? [{ id: 'sm_2', author: { id: 'adm_5', displayName: 'Seun Lawal', avatarUrl: null }, isStaff: true, body: 'Thanks for reaching out. We are checking the order now.', createdAt: t.updatedAt }] : [])] })
  })
  route('PATCH', '/admin/support/tickets/:id', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'support.manage')
    const t = db.supportTickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    const b = body<{ status?: typeof t.status; priority?: typeof t.priority; assignToMe?: boolean }>(req)
    if (b.assignToMe) t.assignedTo = { id: admin.id, firstName: admin.firstName, lastName: admin.lastName }
    if (b.status) t.status = b.status
    if (b.priority) t.priority = b.priority
    t.updatedAt = new Date().toISOString()
    return data(t, 'Ticket updated')
  })
  route('POST', '/admin/support/tickets/:id/messages', (req) => {
    const admin = requireAdmin(req)
    can(admin, 'support.manage')
    const t = db.supportTickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    const b = body<{ body: string }>(req)
    requireFields(b, ['body'])
    t.messagesCount += 1
    t.status = 'pending'
    t.updatedAt = new Date().toISOString()
    return created({ id: db.nextId('sm'), author: { id: admin.id, displayName: `${admin.firstName} ${admin.lastName}`, avatarUrl: admin.avatarUrl }, isStaff: true, body: b.body, createdAt: t.updatedAt }, 'Reply sent')
  })
}
