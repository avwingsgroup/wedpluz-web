/**
 * Captures representative request/response examples from the mock adapter (the same fixtures the
 * frontend runs against in development) and writes scripts/openapi/examples.json for generate.mjs.
 * Usage: npm run openapi:examples
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(process.argv[2] ?? '.')
const SCRATCH = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const require = createRequire(path.join(ROOT, 'package.json'))
const vite = await import(pathToFileURL(require.resolve('vite')).href)

const server = await vite.createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), mode: 'development', logLevel: 'error', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' })
const { createMockAdapter } = await server.ssrLoadModule('/src/services/mock/adapter.ts')
const adapter = createMockAdapter()

async function call(method, url, { body, query, token } = {}) {
  try {
    const res = await adapter({ method, url, params: query, data: body ? JSON.stringify(body) : undefined, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    return { status: res.status, data: res.data }
  } catch (e) {
    return { status: e.response?.status ?? 0, data: e.response?.data ?? String(e) }
  }
}

function trim(v, depth = 0) {
  if (Array.isArray(v)) return v.slice(0, depth === 0 ? 2 : 2).map((x) => trim(x, depth + 1))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]))
  if (typeof v === 'string' && v.length > 280) return `${v.slice(0, 277)}...`
  return v
}

const out = {}
const errors = {}
async function rec(opId, method, url, opts = {}) {
  const res = await call(method, url, opts)
  if (res.status >= 400 || res.status === 0) {
    console.warn(`[capture] ${opId} -> ${res.status}`, JSON.stringify(res.data).slice(0, 160))
    return res
  }
  out[opId] = { ...(opts.body ? { request: opts.body } : {}), ...(res.status === 204 ? {} : { response: trim(res.data) }) }
  return res
}

/* ---- customer ---- */
const login = await rec('authLogin', 'post', '/auth/login', { body: { email: 'johnbrown@gmail.com', password: 'password123', deviceName: 'Chrome 131 on Windows' } })
const token = login.data.data.tokens.accessToken
const u = { token }
await rec('authMe', 'get', '/auth/me', u)
await rec('accountConfig', 'get', '/config')
await rec('accountSessions', 'get', '/me/sessions', u)
await rec('eventsCategories', 'get', '/categories')
await rec('eventsList', 'get', '/events', { ...u, query: { categorySlug: 'food-drinks', page: 1, perPage: 2 } })
const ev = await rec('eventsBySlug', 'get', '/events/movie-in-the-park-denim-edition', u)
const event = ev.data.data
const tt = event.ticketTypes.find((t) => t.price > 0 && !t.seatSelection) ?? event.ticketTypes[0]
const quote = await rec('ticketingQuote', 'post', '/checkout/quotes', { ...u, body: { eventId: event.id, lines: [{ ticketTypeId: tt.id, quantity: 2 }], foodLines: [], promoCode: null } })
const order = await rec('ticketingCreateOrder', 'post', '/orders', {
  ...u,
  body: { quoteId: quote.data.data.quoteId, attendee: { firstName: 'John', lastName: 'Brown', email: 'johnbrown@gmail.com', phone: '+2348012345678' }, additionalGuests: [], seats: [], paymentMethod: 'paystack', idempotencyKey: '0b6d3f4e-8a51-4c1e-9f0a-2d7b6c5e4a31', returnUrl: 'https://wedpluz.com/checkout/return' },
})
const orderId = order.data?.data?.order?.id
if (orderId) {
  await rec('ticketingVerifyPayment', 'post', `/orders/${orderId}/verify-payment`, { ...u, body: { reference: order.data.data.payment.reference } })
  // verify without simulate may stay pending in mocks; capture order too
  await rec('ticketingOrder', 'get', `/orders/${orderId}`, u)
}
await rec('ticketingMyTickets', 'get', '/me/tickets', { ...u, query: { tab: 'upcoming', page: 1 } })
await rec('ticketingTicket', 'get', '/tickets/tkt_1', u)
await rec('vendorsList', 'get', '/vendors', { ...u, query: { page: 1, perPage: 2 } })
const vl = await call('get', '/vendors', { ...u, query: { perPage: 1 } })
if (vl.data?.data?.[0]) await rec('vendorsBySlug', 'get', `/vendors/${vl.data.data[0].slug}`, u)
await rec('messagingConversations', 'get', '/conversations', { ...u, query: { tab: 'all' } })
await rec('messagingMessages', 'get', '/conversations/cv_com_tessy/messages', u)
await rec('messagingSend', 'post', '/conversations/cv_com_tessy/messages', { ...u, body: { clientId: 'c7a1f3b2-5d4e-4f6a-8b9c-0d1e2f3a4b5c', type: 'text', body: 'See you all on Saturday! 🎉', replyToId: null } })
await rec('notificationsList', 'get', '/notifications', { ...u, query: { tab: 'all' } })
await rec('notificationsUnreadCount', 'get', '/notifications/unread-count', u)
await rec('walletGet', 'get', '/wallet', u)
await rec('walletTransactions', 'get', '/wallet/transactions', { ...u, query: { page: 1 } })
await rec('walletPlans', 'get', '/plans')
await rec('organizerList', 'get', '/organizer/events', { ...u, query: { tab: 'created', page: 1 } })
await rec('organizerAnalytics', 'get', '/organizer/events/evt_tolu_shower/analytics', u)
await rec('organizerGuests', 'get', '/organizer/events/evt_tolu_shower/guests', { ...u, query: { page: 1 } })
await rec('organizerTasks', 'get', '/organizer/events/evt_tolu_shower/tasks', u)
await rec('communityGet', 'get', '/communities/com_tessy', u)

/* ---- errors ---- */
const badLogin = await call('post', '/auth/login', { body: { email: 'johnbrown@gmail.com', password: 'wrongpass' } })
errors.login = badLogin
const badRegister = await call('post', '/auth/register', { body: { firstName: '', email: 'not-an-email' } })
errors.validation = badRegister

/* ---- admin ---- */
const step1 = await call('post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123' } })
errors.adminStep1 = step1
const adm = await rec('adminAuthLogin', 'post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123', otp: '123456' } })
const at = adm.data?.data?.tokens?.accessToken
if (!at) {
  // mock OTP is a fixed development code; try the documented one
  const again = await rec('adminAuthLogin', 'post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123', otp: '1234' } })
  if (again.data?.data?.tokens) out.adminAuthLogin.request.otp = '123456'
}
const adminToken = (await call('post', '/admin/auth/login', { body: { email: 'admin@wedpluz.com', password: 'password123', otp: '1234' } })).data.data.tokens.accessToken
const a = { token: adminToken }
await rec('adminAuthMe', 'get', '/admin/me', a)
await rec('adminDashboard', 'get', '/admin/dashboard', { ...a, query: { from: '2026-10-17', to: '2026-11-16' } })
await rec('adminUsersList', 'get', '/admin/users', { ...a, query: { status: 'all', page: 1, perPage: 2 } })
await rec('adminEventsList', 'get', '/admin/events', { ...a, query: { status: 'pending_review', page: 1, perPage: 2 } })
const bl = await rec('adminBookingsList', 'get', '/admin/bookings', { ...a, query: { page: 1, perPage: 2 } })
const bk = bl.data?.data?.find((b) => b.status === 'paid')
if (bk) await rec('adminBookingsRefund', 'post', `/admin/bookings/${bk.id}/refund`, { ...a, body: { amount: Math.round(bk.total / 2), reason: 'Customer could not attend; partial refund approved by support lead.' } })
await rec('adminFinanceSummary', 'get', '/admin/finance/summary', { ...a, query: { from: '2026-10-17', to: '2026-11-16' } })
await rec('adminFinanceSettlements', 'get', '/admin/finance/settlements', { ...a, query: { page: 1, perPage: 2 } })
await rec('adminFinancePayouts', 'get', '/admin/finance/payouts', { ...a, query: { page: 1, perPage: 2 } })
await rec('adminModerationReports', 'get', '/admin/moderation/reports', { ...a, query: { status: 'open', page: 1, perPage: 2 } })
await rec('adminAccessRoles', 'get', '/admin/roles', a)
await rec('adminAccessAuditLogs', 'get', '/admin/audit-logs', { ...a, query: { page: 1, perPage: 2 } })
await rec('adminReportsRun', 'post', '/admin/reports/revenue/run', { ...a, body: { from: '2026-10-17', to: '2026-11-16', groupBy: 'week' } })
await rec('adminReportsExport', 'post', '/admin/reports/revenue/export', { ...a, body: { from: '2026-10-17', to: '2026-11-16', groupBy: 'week', format: 'csv' } })
await rec('adminSettingsGet', 'get', '/admin/settings', a)

// The OTP in published examples is a placeholder; the mock accepts its own development code.
if (out.adminAuthLogin?.request) out.adminAuthLogin.request.otp = '123456'

fs.writeFileSync(path.join(SCRATCH, 'examples.json'), JSON.stringify(out, null, 2))
// error examples are maintained by hand in error-handling.md
console.log('captured', Object.keys(out).length, 'examples')
await server.close()
process.exit(0)
