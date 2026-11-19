/**
 * Generates docs/backend-handoff/openapi.yaml from the typed frontend API layer.
 *  - Operations: every `request.<verb>()` call in src/services/api/*.api.ts
 *  - Schemas:    TypeScript types converted through the compiler's type checker
 *  - Examples:   captured from the mock adapter where curated, otherwise synthesised
 * Usage: npm run openapi:generate   (node scripts/openapi/generate.mjs .)
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.resolve(process.argv[2] ?? '.')
const OUT_DIR = path.join(ROOT, 'docs', 'backend-handoff')
const SCRATCH = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const require = createRequire(path.join(ROOT, 'package.json'))
const ts = require('typescript')
const yaml = require('js-yaml')

/* ------------------------------------------------------------------ program */
const cfgPath = path.join(ROOT, 'tsconfig.app.json')
const parsed = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')) } })
const apiDir = path.join(ROOT, 'src', 'services', 'api')
const apiFiles = fs.readdirSync(apiDir).filter((f) => f.endsWith('.api.ts')).map((f) => path.join(apiDir, f))
const program = ts.createProgram({ rootNames: apiFiles, options: { ...parsed.options, noEmit: true } })
const checker = program.getTypeChecker()

/* ------------------------------------------------------------------ metadata */
const GROUPS = {
  authApi: { tag: 'Auth', prefix: 'auth' },
  accountApi: { tag: 'Account & Profile', prefix: 'account' },
  eventsApi: { tag: 'Event Discovery', prefix: 'events' },
  ticketingApi: { tag: 'Checkout & Tickets', prefix: 'ticketing' },
  organizerApi: { tag: 'Organizer Portal', prefix: 'organizer' },
  vendorsApi: { tag: 'Vendors', prefix: 'vendors' },
  communityApi: { tag: 'Communities', prefix: 'community' },
  messagingApi: { tag: 'Messaging', prefix: 'messaging' },
  notificationsApi: { tag: 'Notifications', prefix: 'notifications' },
  walletApi: { tag: 'Wallet & Subscriptions', prefix: 'wallet' },
  plannerApi: { tag: 'Pluz Planner', prefix: 'planner' },
  adminApi: { tag: 'Admin', prefix: 'admin' },
}
const ADMIN_TAGS = {
  auth: 'Admin · Auth', dashboard: 'Admin · Dashboard', users: 'Admin · Users', events: 'Admin · Events', organizers: 'Admin · Organizers & Vendors',
  bookings: 'Admin · Bookings', finance: 'Admin · Finance', moderation: 'Admin · Moderation', notifications: 'Admin · Notifications',
  settings: 'Admin · Platform Configuration', access: 'Admin · Roles, Permissions & Audit', reports: 'Admin · Reports', support: 'Admin · Support',
}

/** Catalogue endpoints: work for guests, personalise flags (isSaved, isLiked, isMine) when a token is sent. */
const OPTIONAL_AUTH = new Set([
  'eventsList', 'eventsFeatured', 'eventsUpcoming', 'eventsPopular', 'eventsPromoted', 'eventsBySlug', 'eventsRelated', 'eventsOrganizerEvents',
  'vendorsList', 'vendorsFeatured', 'vendorsBySlug', 'vendorsWorks', 'vendorsWork', 'vendorsReviews', 'accountPublicProfile',
])

const OPTIONAL = new Set([
  'eventsSuggestions', 'eventsLocationSuggest', 'eventsRelated', 'eventsOrganizerEvents', 'accountRegisterDevice', 'accountUploadSignature',
  'ticketingReleaseQuote', 'ticketingReceipt', 'ticketingDownload', 'messagingMedia', 'communityMedia', 'adminNotificationsTest',
])
const PROPOSED = {
  ticketingTransfer: 'Ticket transfer is not shown in the design handoff; the frontend supports it behind the ticket menu. Needs product approval.',
  accountIdentityVerification: 'Identity verification provider (Primely) and its API are pending confirmation.',
  accountSubmitIdentity: 'Identity verification provider (Primely) and its API are pending confirmation.',
  communityLive: 'Live streaming requires a media/SFU provider decision (e.g. LiveKit, Agora, 100ms). Contract shape may change.',
  communityStartLive: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
  communityUpdateLive: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
  communityEndLive: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
  communityJoinLive: 'Live streaming requires a media/SFU provider decision. `joinToken` is the provider room token.',
  communityLiveRequests: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
  communityRequestToJoinLive: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
  communityDecideLiveRequest: 'Live streaming requires a media/SFU provider decision. Contract shape may change.',
}
const PLANNER_NOTE = 'Pluz Planner AI features need an AI/image-generation provider decision and cost controls. Contract shape may change.'

const ADMIN_PERMS = {
  adminAuthLogin: null, adminAuthMe: null, adminAuthLogout: null,
  adminDashboard: 'dashboard.view',
  adminUsersList: 'users.view', adminUsersGet: 'users.view', adminUsersActivity: 'users.view', adminUsersTickets: 'users.view', adminUsersReports: 'users.view',
  adminUsersDeletionRequests: 'users.view', adminUsersSuspend: 'users.suspend', adminUsersReactivate: 'users.suspend', adminUsersSetRoles: 'users.manage',
  adminUsersDecideDeletionApprove: 'users.manage', adminUsersDecideDeletionReject: 'users.manage',
  adminEventsList: 'events.view', adminEventsGet: 'events.view', adminEventsCategories: 'events.view',
  adminEventsActApprove: 'events.moderate', adminEventsActReject: 'events.moderate', adminEventsActSuspend: 'events.moderate', adminEventsActRestore: 'events.moderate',
  adminEventsActFeature: 'events.feature', adminEventsActUnfeature: 'events.feature',
  adminEventsCreateCategory: 'categories.manage', adminEventsUpdateCategory: 'categories.manage', adminEventsDeleteCategory: 'categories.manage',
  adminOrganizersList: 'organizers.view', adminOrganizersGet: 'organizers.view', adminOrganizersActVerify: 'organizers.verify', adminOrganizersActReject: 'organizers.verify',
  adminOrganizersActSuspend: 'organizers.manage', adminOrganizersActReactivate: 'organizers.manage', adminOrganizersSetCommission: 'finance.commission.manage',
  adminBookingsList: 'bookings.view', adminBookingsGet: 'bookings.view', adminBookingsDisputes: 'bookings.view', adminBookingsCheckIns: 'bookings.view', adminBookingsInventory: 'bookings.view',
  adminBookingsRefund: 'refunds.approve', adminBookingsResend: 'bookings.manage', adminBookingsUpdateDispute: 'bookings.manage',
  adminFinanceSummary: 'finance.view', adminFinanceTransactions: 'finance.view', adminFinancePayouts: 'finance.view', adminFinanceCommissions: 'finance.view', adminFinanceGateways: 'finance.view',
  adminFinanceReconcile: 'finance.reconcile', adminFinanceSettlements: 'finance.settlements', adminFinanceHoldSettlement: 'finance.settlements', adminFinanceReleaseSettlement: 'finance.settlements',
  adminFinanceRequestPayout: 'finance.settlements', adminFinanceApprovePayout: 'finance.payouts.approve', adminFinanceRejectPayout: 'finance.payouts.approve',
  adminFinanceRefunds: 'refunds.view', adminFinanceDecideRefundApprove: 'refunds.approve', adminFinanceDecideRefundReject: 'refunds.approve',
  adminFinanceUpdateCommission: 'finance.commission.manage', adminFinanceCreateCommission: 'finance.commission.manage',
  adminModerationReports: 'moderation.view', adminModerationReport: 'moderation.view', adminModerationCommunities: 'moderation.view',
  adminModerationUpdateReport: 'moderation.act', adminModerationAct: 'moderation.act', adminModerationCommunityActSuspend: 'moderation.act', adminModerationCommunityActRestore: 'moderation.act', adminModerationCommunityActArchive: 'moderation.act',
  adminNotificationsCampaigns: 'notifications.view', adminNotificationsCampaign: 'notifications.view', adminNotificationsTemplates: 'notifications.view',
  adminNotificationsCreateCampaign: 'notifications.send', adminNotificationsSendCampaign: 'notifications.send', adminNotificationsCancelCampaign: 'notifications.send', adminNotificationsTest: 'notifications.send',
  adminNotificationsUpdateTemplate: 'notifications.send', adminNotificationsCreateTemplate: 'notifications.send',
  adminSettingsGet: 'settings.view', adminSettingsBanners: 'settings.view', adminSettingsPages: 'settings.view',
  adminSettingsUpdate: 'settings.manage', adminSettingsCreateBanner: 'settings.manage', adminSettingsUpdateBanner: 'settings.manage', adminSettingsDeleteBanner: 'settings.manage', adminSettingsUpdatePage: 'settings.manage',
  adminAccessPermissions: 'roles.manage', adminAccessRoles: 'roles.manage', adminAccessCreateRole: 'roles.manage', adminAccessUpdateRole: 'roles.manage', adminAccessDeleteRole: 'roles.manage',
  adminAccessAdmins: 'roles.manage', adminAccessInviteAdmin: 'roles.manage', adminAccessUpdateAdmin: 'roles.manage',
  adminAccessAuditLogs: 'audit.view', adminAccessSecurityLogs: 'audit.view',
  adminReportsDefinitions: 'reports.view', adminReportsRun: 'reports.view', adminReportsExport: 'reports.export', adminReportsExportJob: 'reports.export',
  adminSupportTickets: 'support.view', adminSupportTicket: 'support.view', adminSupportUpdate: 'support.manage', adminSupportReply: 'support.manage',
}
/** Actions that must carry a reason and be written to the audit log. */
const REASON_REQUIRED = new Set(['adminUsersSuspend', 'adminEventsActReject', 'adminEventsActSuspend', 'adminOrganizersActReject', 'adminOrganizersActSuspend', 'adminFinanceHoldSettlement', 'adminFinanceRejectPayout', 'adminBookingsRefund'])

const ERROR_CODES = {
  authLogin: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'ACCOUNT_SUSPENDED', 'RATE_LIMITED'],
  authRegister: ['VALIDATION_ERROR', 'CONFLICT', 'RATE_LIMITED'],
  authSocial: ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'ACCOUNT_SUSPENDED'],
  authSendOtp: ['VALIDATION_ERROR', 'RATE_LIMITED'],
  authVerifyOtp: ['OTP_INVALID', 'OTP_EXPIRED', 'RATE_LIMITED'],
  authResetPassword: ['VALIDATION_ERROR', 'OTP_INVALID', 'OTP_EXPIRED'],
  authRefresh: ['UNAUTHENTICATED'],
  accountChangePassword: ['VALIDATION_ERROR'],
  accountRequestDeletion: ['VALIDATION_ERROR', 'CONFLICT'],
  accountSubmitIdentity: ['VALIDATION_ERROR', 'CONFLICT'],
  accountUpload: ['VALIDATION_ERROR'],
  eventsRequestToAttend: ['CONFLICT', 'VALIDATION_ERROR'],
  ticketingQuote: ['TICKETS_UNAVAILABLE', 'PROMO_INVALID', 'VALIDATION_ERROR', 'IDENTITY_UNVERIFIED'],
  ticketingCreateOrder: ['TICKETS_UNAVAILABLE', 'SEAT_TAKEN', 'CONFLICT', 'PAYMENT_FAILED', 'INSUFFICIENT_FUNDS', 'VALIDATION_ERROR'],
  ticketingVerifyPayment: ['PAYMENT_FAILED', 'NOT_FOUND'],
  ticketingCancel: ['CONFLICT', 'FORBIDDEN'],
  ticketingTransfer: ['CONFLICT', 'VALIDATION_ERROR'],
  organizerPublish: ['VALIDATION_ERROR', 'IDENTITY_UNVERIFIED'],
  organizerValidateTicket: ['FORBIDDEN'],
  walletActivate: ['OTP_INVALID', 'OTP_EXPIRED', 'IDENTITY_UNVERIFIED'],
  walletSetPin: ['OTP_INVALID', 'PIN_INVALID', 'VALIDATION_ERROR'],
  walletWithdraw: ['INSUFFICIENT_FUNDS', 'PIN_INVALID', 'IDENTITY_UNVERIFIED', 'CONFLICT', 'VALIDATION_ERROR'],
  walletTopUp: ['VALIDATION_ERROR', 'CONFLICT', 'PAYMENT_FAILED'],
  walletSubscribe: ['VALIDATION_ERROR', 'CONFLICT', 'PAYMENT_FAILED'],
  messagingSend: ['FORBIDDEN', 'VALIDATION_ERROR'],
  adminAuthLogin: ['UNAUTHENTICATED', 'OTP_INVALID', 'ACCOUNT_SUSPENDED', 'RATE_LIMITED'],
  adminBookingsRefund: ['CONFLICT', 'VALIDATION_ERROR', 'PAYMENT_FAILED'],
  adminFinanceApprovePayout: ['OTP_INVALID', 'CONFLICT', 'FORBIDDEN'],
}

const NOTES = {
  authLogin: 'Returns `nextStep` when onboarding is incomplete. Rate limit: 5 attempts / minute / IP+email.',
  authRefresh: 'Rotates the refresh token. The frontend queues concurrent 401s behind a single refresh call.',
  authMe: 'Called on every page load to restore the session. Only a 401 ends the client session.',
  ticketingQuote: 'Server-side price calculation and a short inventory hold (recommended 10 minutes, returned in `expiresAt`). The frontend never computes the payable total; it only displays this quote.',
  ticketingCreateOrder: 'Converts a valid quote into an order and a provider payment intent. **Must** be idempotent on `Idempotency-Key`: replays return the original order and intent. Free orders (`paymentMethod: free`) complete immediately and return tickets.',
  ticketingVerifyPayment: 'Called when the buyer returns from the provider. The backend re-queries the provider (or relies on the webhook already received) and returns the authoritative order status. The `simulate` field is mock-only and **must be ignored** by the live API.',
  ticketingCancel: 'Refund eligibility and amount are decided by the backend from the event refund policy. The frontend only shows the outcome.',
  organizerValidateTicket: 'QR check-in. Must be atomic (row lock or conditional update) so the same ticket cannot be admitted twice from two scanners.',
  walletWithdraw: 'Requires the 4-digit wallet PIN (hashed server-side, never stored client-side). Must be idempotent on `Idempotency-Key`.',
  walletTopUp: 'Must be idempotent on `Idempotency-Key`. Wallet is credited only after provider confirmation (webhook or verify).',
  walletSubscribe: 'Must be idempotent on `Idempotency-Key`.',
  accountUpload: 'Multipart upload. Validate MIME type by content sniffing, not only the extension. Max size per purpose: avatar 5 MB, cover 10 MB, media 50 MB, document 10 MB.',
  accountUploadSignature: 'Alternative direct-to-Cloudinary/S3 upload. Returns a short-lived signed form; secrets stay on the server.',
  messagingMessages: 'Cursor pagination, newest page first; items inside a page are returned oldest → newest.',
  adminAuthLogin: 'Two-step: the first call (email + password) returns `requiresTwoFactor: true` and no tokens; the second call repeats the credentials with `otp`. Admin tokens are a separate audience from customer tokens.',
  adminFinanceApprovePayout: 'Requires a fresh 2FA code (`otp`). Approver must differ from the requester (four-eyes rule).',
  adminBookingsRefund: 'Amount in minor units, capped at the remaining refundable amount. Creates a RefundRecord processed through the original provider.',
  adminReportsExport: 'Asynchronous: returns an ExportJob. Poll `GET /admin/exports/{id}` until `ready`, then download from the signed `downloadUrl`.',
}

const IDEMPOTENT = new Set(['ticketingCreateOrder', 'walletTopUp', 'walletWithdraw', 'walletSubscribe'])

/** Query definitions for admin list endpoints typed as a loose record on the client. */
const LIST_Q = ['search', 'page', 'perPage', 'sort', 'order']
const QUERY_OVERRIDES = {
  adminOrganizersList: [...LIST_Q, ['type', ['all', 'organizer', 'vendor', 'both']], ['vendorStatus', ['all', 'draft', 'pending_verification', 'active', 'suspended', 'rejected']], ['identityStatus', ['all', 'unverified', 'pending', 'verified', 'failed']]],
  adminBookingsDisputes: [...LIST_Q, ['status', ['all', 'open', 'investigating', 'resolved_refund', 'resolved_rejected']]],
  adminBookingsCheckIns: [...LIST_Q, 'eventId', ['result', ['all', 'ok', 'already_checked_in', 'cancelled', 'wrong_event', 'not_found', 'expired', 'wrong_day']], 'dateFrom', 'dateTo'],
  adminBookingsInventory: [...LIST_Q, 'eventId', ['lowStock', 'boolean']],
  adminFinanceTransactions: [...LIST_Q, ['type', ['all', 'ticket_sale', 'refund', 'payout', 'top_up', 'withdrawal', 'subscription', 'commission', 'chargeback']], ['provider', ['all', 'paystack', 'stripe', 'paypal', 'monnify', 'wallet', 'internal']], ['status', ['all', 'pending', 'processing', 'successful', 'failed', 'reversed']], ['reconciliationStatus', ['all', 'matched', 'unmatched', 'mismatch', 'pending']], 'dateFrom', 'dateTo'],
  adminFinanceSettlements: [...LIST_Q, ['status', ['all', 'pending', 'ready', 'on_hold', 'paid', 'failed']], 'organizerId', 'dateFrom', 'dateTo'],
  adminFinancePayouts: [...LIST_Q, ['status', ['all', 'requested', 'approved', 'processing', 'paid', 'failed', 'rejected']], 'dateFrom', 'dateTo'],
  adminFinanceRefunds: [...LIST_Q, ['status', ['all', 'requested', 'processing', 'approved', 'rejected', 'completed']], 'dateFrom', 'dateTo'],
  adminModerationReports: [...LIST_Q, ['status', ['all', 'open', 'reviewing', 'actioned', 'dismissed']], ['priority', ['all', 'low', 'medium', 'high']], ['targetType', ['all', 'user', 'message', 'community', 'event', 'vendor', 'work', 'status', 'review']], ['assigned', ['all', 'me', 'unassigned']]],
  adminModerationCommunities: [...LIST_Q, ['status', ['all', 'active', 'archived', 'suspended']]],
  adminNotificationsCampaigns: [...LIST_Q, ['status', ['all', 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']]],
  adminAccessAuditLogs: [...LIST_Q, 'module', 'actorId', 'targetType', 'targetId', 'dateFrom', 'dateTo'],
  adminAccessSecurityLogs: [...LIST_Q, ['event', ['all', 'login_success', 'login_failed', 'logout', 'password_changed', '2fa_enabled', '2fa_disabled', 'permission_denied', 'session_revoked']], 'dateFrom', 'dateTo'],
  adminSupportTickets: [...LIST_Q, ['status', ['all', 'open', 'pending', 'resolved', 'closed']], ['priority', ['all', 'low', 'medium', 'high', 'urgent']], ['category', ['all', 'payment', 'ticket', 'account', 'event', 'vendor', 'bug', 'other']], ['assigned', ['all', 'me', 'unassigned']]],
}

/* ------------------------------------------------------------------ schema conversion */
const components = {}
const componentOrigin = new Map()
const MONEY = new Set(['amount', 'price', 'total', 'subtotal', 'serviceFee', 'discount', 'fee', 'net', 'balance', 'pendingBalance', 'revenue', 'grossSales', 'refunds', 'platformCommission', 'gatewayFees', 'netPayable', 'earnings', 'minPrice', 'orderTotal', 'totalSpent', 'grossRevenue', 'pendingSettlement', 'pendingSettlements', 'totalPaidOut', 'volume', 'priceMonthly', 'priceYearly', 'dailyWithdrawalLimit', 'fixedFee', 'refundsAmount', 'minWithdrawal', 'maxWithdrawal', 'serviceFeeFixed', 'paidOut', 'walletFloat', 'gtv'])
const INTEGER_HINT = /(Count|count|Seconds|sold|quantity|remaining|perOrderLimit|signups|rank|priority|impressions|clicks|guestLimit|maxAdditionalGuests|capacity|registered|checkedIn|ticketsSold|pendingRequests|sizeBytes|width|height|members|failures|avgLatencyMs|users|sent|delivered|opened|failed|estimatedSize|expiresIn|page|perPage|lastPage|bookings|checkIns|messagesLast7d|reportsOpen|messagesInPeriod|postsInPeriod|communities|tickets|targetSignups|promoterLimit|stars|refundWindowHours|settlementDelayDays|rotation|x|y|totalSeats|reservedSeats|active|inactive|verified|upcoming|ongoing|completed|pendingReview|value|previous)$/

function isOurs(sym) {
  const d = sym?.declarations?.[0]
  if (!d) return false
  const f = d.getSourceFile().fileName.replace(/\\/g, '/')
  return f.includes('/src/types/') || f.includes('/src/services/api/')
}

function namedOf(type) {
  if (type.aliasSymbol && isOurs(type.aliasSymbol) && !(type.aliasTypeArguments?.length)) return type.aliasSymbol
  const sym = type.getSymbol?.()
  if (sym && sym.flags & ts.SymbolFlags.Interface && isOurs(sym) && !(type.typeArguments?.length)) return sym
  return null
}

const stripUndef = (types) => types.filter((t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)))

function propHints(schema, name) {
  if (!name) return schema
  if (schema.type === 'number' || (Array.isArray(schema.type) && schema.type.includes('number'))) {
    const toInt = (s) => (Array.isArray(s.type) ? { ...s, type: s.type.map((t) => (t === 'number' ? 'integer' : t)) } : { ...s, type: 'integer' })
    if (MONEY.has(name)) return { ...toInt(schema), description: 'Integer amount in minor units (kobo for NGN).' }
    if (INTEGER_HINT.test(name)) return toInt(schema)
  }
  const isStr = schema.type === 'string' || (Array.isArray(schema.type) && schema.type.includes('string'))
  if (isStr && !schema.enum) {
    if (name === 'dateOfBirth') return { ...schema, format: 'date' }
    if (/At$|^validUntil$|^scheduledFor$/.test(name)) return { ...schema, format: 'date-time' }
    if (/^(email|contactEmail|recipientEmail|supportEmail)$/.test(name)) return { ...schema, format: 'email' }
    if (/Url$/.test(name) && !/Template/.test(name)) return { ...schema, format: 'uri' }
  }
  return schema
}

function toSchema(type, ctx = {}) {
  const f = type.flags
  if (f & ts.TypeFlags.Any || f & ts.TypeFlags.Unknown) return {}
  if (f & ts.TypeFlags.Never) return { not: {} }
  if (f & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)) return { type: 'null' }
  if (f & ts.TypeFlags.Null) return { type: 'null' }
  if (f & ts.TypeFlags.StringLiteral) return { type: 'string', enum: [type.value] }
  if (f & ts.TypeFlags.NumberLiteral) return { type: 'number', enum: [type.value] }
  if (f & ts.TypeFlags.BooleanLiteral) return { type: 'boolean', enum: [checker.typeToString(type) === 'true'] }
  if (f & ts.TypeFlags.String || f & ts.TypeFlags.TemplateLiteral) return { type: 'string' }
  if (f & ts.TypeFlags.Number) return { type: 'number' }
  if (f & ts.TypeFlags.Boolean) return { type: 'boolean' }

  const named = !ctx.noRef ? namedOf(type) : null
  if (named) return refFor(named, type)

  if (type.isUnion()) {
    const parts = stripUndef(type.types)
    const hasNull = parts.some((t) => t.flags & ts.TypeFlags.Null)
    const rest = parts.filter((t) => !(t.flags & ts.TypeFlags.Null))
    const boolLits = rest.filter((t) => t.flags & ts.TypeFlags.BooleanLiteral)
    let core
    if (rest.length && rest.every((t) => t.flags & ts.TypeFlags.StringLiteral)) core = { type: 'string', enum: rest.map((t) => t.value) }
    else if (rest.length && rest.every((t) => t.flags & ts.TypeFlags.NumberLiteral)) core = { type: 'number', enum: rest.map((t) => t.value) }
    else if (boolLits.length === 2 && rest.length === 2) core = { type: 'boolean' }
    else if (rest.length === 1) core = toSchema(rest[0], ctx)
    else {
      // e.g. `string | 'all'` collapses to string; mixed object unions stay as anyOf
      const strLike = rest.filter((t) => t.flags & (ts.TypeFlags.String | ts.TypeFlags.StringLiteral))
      if (strLike.length === rest.length) core = { type: 'string' }
      else {
        const opts = []
        const seenBool = boolLits.length === 2
        for (const t of rest) {
          if (seenBool && t.flags & ts.TypeFlags.BooleanLiteral) continue
          opts.push(toSchema(t, ctx))
        }
        if (seenBool) opts.push({ type: 'boolean' })
        core = { anyOf: opts }
      }
    }
    if (!hasNull) return core
    if (core.type && !core.anyOf && typeof core.type === 'string') return { ...core, type: [core.type, 'null'], ...(core.enum ? { enum: [...core.enum, null] } : {}) }
    if (core.$ref) return { anyOf: [core, { type: 'null' }] }
    if (core.anyOf) return { anyOf: [...core.anyOf, { type: 'null' }] }
    return { anyOf: [core, { type: 'null' }] }
  }

  if (checker.isArrayType(type) || checker.isTupleType?.(type)) {
    const args = checker.getTypeArguments(type)
    return { type: 'array', items: args.length === 1 ? toSchema(args[0], ctx) : {} }
  }

  const sig = type.getCallSignatures?.()
  if (sig?.length) return {}

  if (f & ts.TypeFlags.Object || type.isIntersection()) {
    const sym = type.getSymbol?.()
    if (sym && ['File', 'Blob', 'FormData'].includes(sym.name)) return { type: 'string', format: 'binary' }
    if (sym && sym.name === 'AbortSignal') return {}
    const props = checker.getPropertiesOfType(type)
    const schema = { type: 'object', properties: {} }
    const required = []
    for (const p of props) {
      const pt = checker.getTypeOfSymbol(p)
      const optional = Boolean(p.flags & ts.SymbolFlags.Optional) || (pt.isUnion() && pt.types.some((t) => t.flags & ts.TypeFlags.Undefined))
      let s = propHints(toSchema(pt, { ...ctx, noRef: false }), p.name)
      const doc = ts.displayPartsToString(p.getDocumentationComment(checker)).trim()
      if (doc) s = s.$ref ? { allOf: [s], description: doc } : { ...s, description: doc }
      schema.properties[p.name] = s
      if (!optional) required.push(p.name)
    }
    const idx = checker.getIndexInfosOfType(type)
    if (idx.length) schema.additionalProperties = toSchema(idx[0].type, ctx)
    if (required.length) schema.required = required
    if (!props.length && !idx.length) return { type: 'object' }
    return schema
  }
  return {}
}

function refFor(sym, type) {
  let name = sym.name
  const key = sym.declarations?.[0]
  if (componentOrigin.has(name) && componentOrigin.get(name) !== key) name = `${name}_${Math.abs(hash(key.getSourceFile().fileName))}`
  if (!componentOrigin.has(name)) {
    componentOrigin.set(name, key)
    components[name] = {}
    const s = toSchema(type, { noRef: true })
    const doc = ts.displayPartsToString(sym.getDocumentationComment(checker)).trim()
    components[name] = doc ? { ...s, description: doc } : s
  }
  return { $ref: `#/components/schemas/${name}` }
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h }

/* ------------------------------------------------------------------ operation extraction */
const ops = []
const VERB = { get: 'get', getPaginated: 'get', getCursor: 'get', post: 'post', put: 'put', patch: 'patch', del: 'delete', upload: 'post' }

function findCall(node) {
  let found = null
  const visit = (n) => {
    if (found) return
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'request') { found = n; return }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const humanize = (s) => cap(s.replace(/([A-Z])/g, ' $1').toLowerCase())

function walkObject(obj, trail, group, file) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name.getText()
    const init = prop.initializer
    if (ts.isObjectLiteralExpression(init)) { walkObject(init, [...trail, name], group, file); continue }
    if (!ts.isArrowFunction(init)) continue
    const call = findCall(init.body)
    if (!call) continue
    const helper = call.expression.name.text
    const method = VERB[helper]
    const urlArg = call.arguments[0]
    // Path template
    let segments = []
    if (ts.isStringLiteral(urlArg) || ts.isNoSubstitutionTemplateLiteral(urlArg)) segments = [{ lit: urlArg.text }]
    else if (ts.isTemplateExpression(urlArg)) {
      segments.push({ lit: urlArg.head.text })
      for (const span of urlArg.templateSpans) {
        segments.push({ param: span.expression.getText(), type: checker.getTypeAtLocation(span.expression) })
        segments.push({ lit: span.literal.text })
      }
    }
    // Response type
    const typeArgs = call.typeArguments ?? []
    const resType = typeArgs[0] ? checker.getTypeFromTypeNode(typeArgs[0]) : null
    // Body / query
    let bodyType = null
    let queryType = null
    let multipart = false
    if (['post', 'put', 'patch'].includes(helper)) {
      if (typeArgs[1]) bodyType = checker.getTypeFromTypeNode(typeArgs[1])
      else if (call.arguments[1] && call.arguments[1].kind !== ts.SyntaxKind.UndefinedKeyword && call.arguments[1].getText() !== 'undefined') bodyType = checker.getTypeAtLocation(call.arguments[1])
    } else if (helper === 'upload') multipart = true
    else if (helper.startsWith('get') && call.arguments[1] && call.arguments[1].getText() !== 'undefined') {
      let a = call.arguments[1]
      if (ts.isAsExpression(a)) a = a.expression
      queryType = checker.getTypeAtLocation(a)
    }
    // Options: skipAuth / headers
    const optText = call.arguments[2]?.getText() ?? ''
    const skipAuth = /skipAuth:\s*true/.test(optText)

    const groupKey = trail[0]
    const baseId = group.prefix + trail.map(cap).join('') + cap(name)
    // Expand verb-like path params (action/decision) into concrete operations
    const verbSeg = segments.find((s) => s.param && ['action', 'decision'].includes(s.param))
    const variants = verbSeg && verbSeg.type.isUnion() ? verbSeg.type.types.map((t) => t.value) : [null]
    for (const v of variants) {
      let p = ''
      const pathParams = []
      for (const s of segments) {
        if (s.lit !== undefined) p += s.lit
        else if (verbSeg && s === verbSeg) p += v
        else {
          p += `{${s.param}}`
          pathParams.push({ name: s.param, schema: s.type.isUnion() && s.type.types.every((t) => t.flags & ts.TypeFlags.StringLiteral) ? { type: 'string', enum: s.type.types.map((t) => t.value) } : { type: 'string' } })
        }
      }
      const operationId = baseId + (v ? cap(v.replace(/_([a-z])/g, (_, c) => c.toUpperCase())) : '')
      let bodySchema = bodyType ? toSchema(bodyType) : null
      // `{ reason }` on admin actions: a reason is mandatory for the destructive variants
      if (bodySchema && v && bodySchema.properties?.reason) {
        bodySchema = JSON.parse(JSON.stringify(bodySchema))
        if (REASON_REQUIRED.has(operationId)) { bodySchema.required = ['reason']; bodySchema.properties.reason = { type: 'string', minLength: 3, maxLength: 1000 } }
        else bodySchema.properties.reason = { type: 'string', maxLength: 1000, description: 'Optional note recorded in the audit log.' }
      }
      ops.push({
        operationId, file, group, adminGroup: group.prefix === 'admin' ? groupKey ?? name : null, fn: name, trail,
        method, helper, path: p, pathParams, resType, bodySchema, queryType, multipart, skipAuth,
      })
    }
  }
}

for (const sf of program.getSourceFiles()) {
  if (!apiFiles.some((f) => path.resolve(f) === path.resolve(sf.fileName))) continue
  ts.forEachChild(sf, (n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      const g = GROUPS[d.name.getText()]
      if (g && d.initializer && ts.isObjectLiteralExpression(d.initializer)) walkObject(d.initializer, [], g, path.basename(sf.fileName))
    }
  })
}

/* ------------------------------------------------------------------ build document */
const ERROR_SCHEMA_REF = { $ref: '#/components/schemas/ApiErrorBody' }
const doc = {
  openapi: '3.1.0',
  info: {
    title: 'Wedpluz Platform API (frontend contract)',
    version: '1.0.0-contract',
    summary: 'Contract the Wedpluz web app and admin console are built against. NOT a description of an implemented backend.',
    description: [
      'This specification is generated from the typed API layer of the Wedpluz web frontend (`src/services/api`).',
      'It describes what the web app and admin console **expect** from the Laravel REST API. None of these endpoints are claimed to exist yet; the backend team must confirm, adjust or reject each one.',
      '',
      '**Endpoint status** is in the `x-wedpluz-status` extension on every operation:',
      '- `required`: a designed screen or flow cannot work without it.',
      '- `optional`: the frontend degrades gracefully if it is missing.',
      '- `proposed`: shape or scope needs backend/product approval (provider not chosen, feature not in the designs).',
      '- Inbound provider webhooks are tagged **Webhooks (backend-only)**; the frontend never calls them.',
      '',
      '**Conventions**: JSON in and out; camelCase keys; ISO-8601 UTC timestamps; money as integer minor units (kobo) with a separate `currency`; IDs are opaque strings.',
      'Single resources are wrapped as `{ "data": ..., "message"?: string }`. Offset lists return `{ "data": [], "meta": PaginationMeta }`; cursor lists return `{ "data": [], "meta": CursorMeta }`. Errors use `ApiErrorBody`.',
      '',
      'See `docs/backend-handoff/*.md` for business rules, permissions, realtime events and integrations.',
    ].join('\n'),
    contact: { name: 'Wedpluz frontend team' },
  },
  servers: [
    { url: 'https://api.wedpluz.com/api/v1', description: 'Production' },
    { url: 'https://api-staging.wedpluz.com/api/v1', description: 'Staging' },
    { url: 'http://localhost:8000/api/v1', description: 'Local Laravel' },
  ],
  tags: [],
  paths: {},
  components: {
    securitySchemes: {
      customerBearer: { type: 'http', scheme: 'bearer', description: 'Customer access token (Laravel Sanctum personal access token or JWT). Issued by /auth/login, /auth/register, /auth/social; rotated by /auth/refresh.' },
      adminBearer: { type: 'http', scheme: 'bearer', description: 'Admin access token. Separate audience from customer tokens: a customer token must be rejected on /admin/* and vice versa. Issued only after 2FA.' },
    },
    parameters: {
      CorrelationId: { name: 'X-Correlation-Id', in: 'header', required: false, description: 'UUID generated per request by the client. Log it and echo it back in the response header and error bodies.', schema: { type: 'string', format: 'uuid' } },
      ClientPlatform: { name: 'X-Client-Platform', in: 'header', required: false, description: 'Calling client.', schema: { type: 'string', enum: ['web', 'android', 'ios', 'admin'] } },
      ClientVersion: { name: 'X-Client-Version', in: 'header', required: false, description: 'Semantic version of the calling client; used for forced-update checks.', schema: { type: 'string' } },
      IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, description: 'Client-generated UUID. The backend must store the first response for at least 24h and return it for any replay with the same key and user.', schema: { type: 'string', format: 'uuid' } },
    },
    responses: {
      NoContent: { description: 'Success, no body.' },
      Unauthenticated: { description: 'Missing, expired or invalid token (`UNAUTHENTICATED`).', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'Unauthenticated.', code: 'UNAUTHENTICATED', correlationId: '6f1c2b8e-0f8a-4f7e-9d0e-3b1f2a7c9d11' } } } },
      Forbidden: { description: 'Authenticated but not allowed (`FORBIDDEN`, `ACCOUNT_SUSPENDED`, `IDENTITY_UNVERIFIED`).', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'You do not have permission to perform this action.', code: 'FORBIDDEN', correlationId: '6f1c2b8e-0f8a-4f7e-9d0e-3b1f2a7c9d11' } } } },
      NotFound: { description: 'Resource does not exist or is not visible to the caller (`NOT_FOUND`).', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'Event not found.', code: 'NOT_FOUND' } } } },
      Conflict: { description: 'State conflict, e.g. duplicate action or idempotency replay with a different payload (`CONFLICT`, `SEAT_TAKEN`, `TICKETS_UNAVAILABLE`).', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'Only 2 Regular tickets are left.', code: 'TICKETS_UNAVAILABLE' } } } },
      ValidationFailed: { description: 'Validation failed (`VALIDATION_ERROR` or a domain code). `errors` maps field paths to messages.', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'The given data was invalid.', code: 'VALIDATION_ERROR', errors: { email: ['The email field must be a valid email address.'], password: ['The password field must be at least 8 characters.'] } } } } },
      RateLimited: { description: 'Too many requests (`RATE_LIMITED`). Includes `Retry-After` header.', headers: { 'Retry-After': { schema: { type: 'integer' }, description: 'Seconds until the client may retry.' } }, content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'Too many attempts. Try again in 60 seconds.', code: 'RATE_LIMITED' } } } },
      ServerError: { description: 'Unexpected server error (`SERVER_ERROR`). Never leak stack traces.', content: { 'application/json': { schema: ERROR_SCHEMA_REF, example: { message: 'Something went wrong. Please try again.', code: 'SERVER_ERROR', correlationId: '6f1c2b8e-0f8a-4f7e-9d0e-3b1f2a7c9d11' } } } },
    },
    schemas: {},
  },
  security: [{ customerBearer: [] }],
}

const ERROR_ENUM = ['VALIDATION_ERROR', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED', 'PAYMENT_REQUIRED', 'PAYMENT_FAILED', 'TICKETS_UNAVAILABLE', 'SEAT_TAKEN', 'PROMO_INVALID', 'OTP_INVALID', 'OTP_EXPIRED', 'ACCOUNT_SUSPENDED', 'IDENTITY_UNVERIFIED', 'EMAIL_UNVERIFIED', 'INSUFFICIENT_FUNDS', 'PIN_INVALID', 'SERVER_ERROR']
const fixedSchemas = {
  PaginationMeta: { type: 'object', required: ['page', 'perPage', 'total', 'lastPage'], properties: { page: { type: 'integer', minimum: 1 }, perPage: { type: 'integer', minimum: 1, maximum: 100 }, total: { type: 'integer', minimum: 0 }, lastPage: { type: 'integer', minimum: 1 } } },
  CursorMeta: { type: 'object', required: ['nextCursor', 'perPage'], properties: { nextCursor: { type: ['string', 'null'], description: 'Opaque cursor for the next (older) page; null when exhausted.' }, prevCursor: { type: ['string', 'null'] }, perPage: { type: 'integer' } } },
  ApiErrorBody: { type: 'object', required: ['message', 'code'], properties: { message: { type: 'string', description: 'Human-readable, safe to show to end users.' }, code: { type: 'string', description: 'Machine-readable error code. Known values are listed in the enum; clients must tolerate unknown codes.', examples: ERROR_ENUM }, errors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } }, description: 'Field-level validation messages keyed by dotted field path (e.g. `attendee.email`, `lines.0.quantity`).' }, correlationId: { type: 'string' } } },
}

const tagSet = new Map()
function tagFor(op) {
  if (op.group.prefix === 'admin') return ADMIN_TAGS[op.adminGroup] ?? 'Admin'
  return op.group.tag
}
const TAG_DESCRIPTIONS = {
  Auth: 'Customer sign-up, sign-in, OTP and password flows.',
  'Account & Profile': 'Current user profile, settings, privacy, sessions, uploads, CMS pages, support and account deletion.',
  'Event Discovery': 'Public event catalogue, search and saved events.',
  'Checkout & Tickets': 'Quotes, orders, payments, tickets, cancellations and refunds.',
  'Organizer Portal': 'Event creation and management for organizers, managers and vendors.',
  Vendors: 'Vendor marketplace and the signed-in user’s vendor (business) profile.',
  Communities: 'Event communities, members, statuses and live sessions.',
  Messaging: 'Direct and community conversations.',
  Notifications: 'In-app notification inbox.',
  'Wallet & Subscriptions': 'Wallet balance, top-ups, withdrawals, bank accounts and premium plans.',
  'Pluz Planner': 'AI-assisted planning assets: menus, hall layouts, designs and chat.',
  'Webhooks (backend-only)': 'Inbound callbacks from external providers. Not called by any Wedpluz client. Verify signatures before trusting payloads.',
  System: 'Operational endpoints.',
}

function envelope(op) {
  const t = op.resType
  const isVoid = !t || t.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined)
  if (op.helper === 'getPaginated') return { status: '200', schema: { type: 'object', required: ['data', 'meta'], properties: { data: { type: 'array', items: toSchema(t) }, meta: { $ref: '#/components/schemas/PaginationMeta' } } } }
  if (op.helper === 'getCursor') return { status: '200', schema: { type: 'object', required: ['data', 'meta'], properties: { data: { type: 'array', items: toSchema(t) }, meta: { $ref: '#/components/schemas/CursorMeta' } } } }
  if (isVoid) return { status: '204', schema: null }
  const created = op.method === 'post' && /^(create|add|register|invite|start|submit|request(?!ToAttend)|upload|join(?!Live))/i.test(op.fn) && !/^requestPayout/.test(op.fn)
  return { status: created ? '201' : '200', schema: { type: 'object', required: ['data'], properties: { data: toSchema(t), message: { type: 'string' } } } }
}

function queryParams(op) {
  const out = []
  const o = QUERY_OVERRIDES[op.operationId]
  if (o) {
    for (const q of o) {
      const [name, spec] = Array.isArray(q) ? q : [q, null]
      let schema = { type: 'string' }
      if (name === 'page' || name === 'perPage') schema = name === 'perPage' ? { type: 'integer', minimum: 1, maximum: 100, default: 20 } : { type: 'integer', minimum: 1, default: 1 }
      else if (name === 'order') schema = { type: 'string', enum: ['asc', 'desc'] }
      else if (/^date(From|To)$/.test(name)) schema = { type: 'string', format: 'date' }
      else if (spec === 'boolean') schema = { type: 'boolean' }
      else if (Array.isArray(spec)) schema = { type: 'string', enum: spec, default: 'all' }
      out.push({ name, in: 'query', required: false, schema })
    }
    return out
  }
  if (!op.queryType) return out
  const s = toSchema(op.queryType, { noRef: true })
  for (const [name, ps] of Object.entries(s.properties ?? {})) {
    let schema = ps.$ref ? resolveRef(ps.$ref) : ps
    if (Array.isArray(schema.type)) schema = { ...schema, type: schema.type.find((t) => t !== 'null') }
    if (schema.enum) schema = { ...schema, enum: schema.enum.filter((e) => e !== null) }
    if (name === 'page') schema = { type: 'integer', minimum: 1, default: 1 }
    if (name === 'perPage') schema = { type: 'integer', minimum: 1, maximum: 100, default: 20 }
    if (/^date(From|To)$/.test(name)) schema = { type: 'string', format: 'date' }
    if (name === 'from' || name === 'to') schema = { type: 'string', format: 'date' }
    out.push({ name, in: 'query', required: (s.required ?? []).includes(name) && !['cursor'].includes(name), schema })
  }
  return out
}
function resolveRef(ref) { return components[ref.split('/').pop()] ?? {} }

function statusOf(op) {
  if (op.group.prefix === 'planner') return ['proposed', PLANNER_NOTE]
  if (PROPOSED[op.operationId]) return ['proposed', PROPOSED[op.operationId]]
  if (OPTIONAL.has(op.operationId)) return ['optional', null]
  return ['required', null]
}

const examples = fs.existsSync(path.join(SCRATCH, 'examples.json')) ? JSON.parse(fs.readFileSync(path.join(SCRATCH, 'examples.json'), 'utf8')) : {}

const index = []
for (const op of ops) {
  const tag = tagFor(op)
  tagSet.set(tag, true)
  const isAdmin = op.path.startsWith('/admin')
  const perm = isAdmin ? ADMIN_PERMS[op.operationId] : undefined
  if (isAdmin && perm === undefined) console.warn('[gen] no admin permission mapping for', op.operationId)
  const [status, statusNote] = statusOf(op)
  const env = envelope(op)
  const params = [
    ...op.pathParams.map((p) => ({ name: p.name, in: 'path', required: true, schema: p.schema })),
    ...queryParams(op),
    ...(IDEMPOTENT.has(op.operationId) ? [{ $ref: '#/components/parameters/IdempotencyKey' }] : []),
    { $ref: '#/components/parameters/CorrelationId' },
    { $ref: '#/components/parameters/ClientPlatform' },
    { $ref: '#/components/parameters/ClientVersion' },
  ]
  let security
  if (op.skipAuth) security = []
  else if (isAdmin) security = [{ adminBearer: [] }]
  else if (OPTIONAL_AUTH.has(op.operationId)) security = [{}, { customerBearer: [] }]
  const descr = []
  descr.push(`**Status:** \`${status}\`${statusNote ? ` — ${statusNote}` : ''}. Not implemented until confirmed by the backend team.`)
  if (op.skipAuth) descr.push('**Auth:** public.')
  else if (isAdmin) descr.push(`**Auth:** admin token${perm ? `; permission \`${perm}\`` : ' (any active admin)'}. Enforced server-side; the console only hides controls.`)
  else if (OPTIONAL_AUTH.has(op.operationId)) descr.push('**Auth:** optional. Guests get the public view; with a customer token, personal flags (`isSaved`, `isLiked`, `isMine`, `myTicketId`, `myRequestStatus`) are populated.')
  else descr.push('**Auth:** customer token.')
  if (REASON_REQUIRED.has(op.operationId)) descr.push('**Audit:** a `reason` is required and must be stored in the audit log with before/after state.')
  else if (isAdmin && op.method !== 'get') descr.push('**Audit:** write an audit log entry (actor, action, target, before/after, IP, correlation id).')
  if (NOTES[op.operationId]) descr.push(NOTES[op.operationId])
  if (ERROR_CODES[op.operationId]) descr.push(`**Domain error codes:** ${ERROR_CODES[op.operationId].map((c) => `\`${c}\``).join(', ')}.`)
  descr.push(`_Frontend call: \`${op.file.replace('.ts', '')} → ${[...op.trail, op.fn].join('.')}\`_`)

  const responses = {}
  const ex = examples[op.operationId]
  if (env.schema) {
    const media = { schema: env.schema }
    if (ex?.response) media.example = ex.response
    else media.example = synth(env.schema, null, 0)
    responses[env.status] = { description: env.status === '201' ? 'Created' : 'OK', content: { 'application/json': media } }
  } else responses['204'] = { $ref: '#/components/responses/NoContent' }
  if (security === undefined || (security.length && !security.every((s) => !Object.keys(s).length))) {
    if (!(security?.length === 2)) responses['401'] = { $ref: '#/components/responses/Unauthenticated' }
  }
  if (isAdmin && !op.skipAuth) responses['403'] = { $ref: '#/components/responses/Forbidden' }
  else if (!op.skipAuth && (op.method !== 'get' || op.path.includes('/organizer/'))) responses['403'] = { $ref: '#/components/responses/Forbidden' }
  if (op.pathParams.length) responses['404'] = { $ref: '#/components/responses/NotFound' }
  if ((ERROR_CODES[op.operationId] ?? []).some((c) => ['CONFLICT', 'SEAT_TAKEN', 'TICKETS_UNAVAILABLE'].includes(c))) responses['409'] = { $ref: '#/components/responses/Conflict' }
  if (op.bodySchema || op.multipart || params.some((p) => p.in === 'query')) responses['422'] = { $ref: '#/components/responses/ValidationFailed' }
  if (op.path.startsWith('/auth') || op.path.startsWith('/admin/auth') || /otp|withdraw|resolve/i.test(op.path)) responses['429'] = { $ref: '#/components/responses/RateLimited' }
  responses['500'] = { $ref: '#/components/responses/ServerError' }

  const operation = {
    operationId: op.operationId,
    summary: summaryOf(op),
    description: descr.join('\n\n'),
    tags: [tag],
    'x-wedpluz-status': status,
    ...(perm ? { 'x-wedpluz-permission': perm } : {}),
    ...(IDEMPOTENT.has(op.operationId) ? { 'x-wedpluz-idempotent': true } : {}),
    ...(security !== undefined ? { security } : {}),
    parameters: params,
  }
  if (op.bodySchema) {
    const media = { schema: op.bodySchema }
    media.example = ex?.request ?? synth(op.bodySchema, null, 0)
    operation.requestBody = { required: true, content: { 'application/json': media } }
  } else if (op.multipart) {
    operation.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file', 'purpose'], properties: { file: { type: 'string', format: 'binary' }, purpose: { type: 'string', enum: ['avatar', 'cover', 'event_cover', 'event_gallery', 'vendor_work', 'message_attachment', 'status', 'identity_selfie', 'task_attachment', 'planner_reference', 'document'] } } }, encoding: { file: { contentType: 'image/jpeg, image/png, image/webp, image/gif, video/mp4, audio/webm, audio/mpeg, application/pdf' } } } } }
  }
  operation.responses = responses
  doc.paths[op.path] ??= {}
  if (doc.paths[op.path][op.method]) console.warn('[gen] duplicate', op.method, op.path, op.operationId)
  doc.paths[op.path][op.method] = operation

  index.push({ operationId: op.operationId, method: op.method.toUpperCase(), path: op.path, tag, status, auth: op.skipAuth ? 'public' : isAdmin ? 'admin' : OPTIONAL_AUTH.has(op.operationId) ? 'optional' : 'customer', permission: perm ?? null, idempotent: IDEMPOTENT.has(op.operationId), pagination: op.helper === 'getPaginated' ? 'offset' : op.helper === 'getCursor' ? 'cursor' : null, request: describeSchema(op.bodySchema, op.multipart), response: describeResponse(env), query: params.filter((p) => p.in === 'query').map((p) => p.name), errors: ERROR_CODES[op.operationId] ?? [], summary: operation.summary })
}

function loadSummaries() { return Object.fromEntries(fs.readFileSync(path.join(SCRATCH, 'summaries.map.txt'), 'utf8').split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean).map((l) => l.split(' | ').map((x) => x.trim()))) }
var SUMMARY_CACHE
function summaryOf(op) {
  SUMMARY_CACHE ??= loadSummaries()
  if (SUMMARY_CACHE[op.operationId]) return SUMMARY_CACHE[op.operationId]
  console.warn('[gen] missing summary for', op.operationId)
  const generic = ['list', 'get', 'create', 'update', 'remove', 'act', 'categories', 'communityAct', 'decideDeletion', 'decideRefund']
  const noun = op.adminGroup ? op.adminGroup : op.group.prefix
  const base = humanize(op.fn)
  const v = op.operationId.match(/(Approve|Reject|Suspend|Restore|Feature|Unfeature|Verify|Reactivate|Archive)$/)?.[1]
  if (v && /(act|communityAct|decide)/i.test(op.fn)) return `${v} ${op.fn === 'communityAct' ? 'community' : op.fn.startsWith('decide') ? op.fn.replace('decide', '').toLowerCase() : singular(noun)}`
  if (generic.includes(op.fn)) return `${base} ${noun === 'auth' ? '' : noun}`.trim().replace(/\s+/g, ' ')
  return base
}
function singular(s) { return s.replace(/ies$/, 'y').replace(/s$/, '') }

function describeSchema(s, multipart) {
  if (multipart) return 'multipart/form-data { file, purpose }'
  if (!s) return null
  if (s.$ref) return s.$ref.split('/').pop()
  if (s.type === 'object' && s.properties) return `{ ${Object.keys(s.properties).map((k) => (s.required?.includes(k) ? k : `${k}?`)).join(', ')} }`
  return s.type ?? 'object'
}
function describeResponse(env) {
  if (!env.schema) return '204 No Content'
  const d = env.schema.properties.data
  const inner = d.type === 'array' ? `${describeSchema(d.items)}[]` : describeSchema(d)
  if (env.schema.properties.meta) return `${inner} + meta(${env.schema.properties.meta.$ref.split('/').pop().replace('Meta', '').toLowerCase()})`
  return inner ?? 'null'
}

/* ------------------------------------------------------------------ backend-only paths */
const webhook = (provider, header, verification, status, note) => ({
  post: {
    operationId: `webhook${cap(provider)}`,
    summary: `${cap(provider)} webhook`,
    tags: ['Webhooks (backend-only)'],
    'x-wedpluz-status': status,
    description: `**Status:** \`${status}\`. Inbound callback from ${cap(provider)}; never called by Wedpluz clients.\n\n**Verification:** ${verification}\n\n${note}\n\nProcess asynchronously (queue on Redis) and respond 200 quickly. Deduplicate on the provider event id; webhook delivery is at-least-once.`,
    security: [],
    parameters: header ? [{ name: header, in: 'header', required: true, schema: { type: 'string' }, description: 'Provider signature header.' }] : [],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true, description: 'Provider-defined payload.' } } } },
    responses: { 200: { description: 'Accepted.' }, 400: { description: 'Malformed payload.' }, 401: { description: 'Signature verification failed.' } },
  },
})
doc.paths['/webhooks/paystack'] = webhook('paystack', 'x-paystack-signature', 'HMAC-SHA512 of the raw body with the Paystack secret key, compared to `x-paystack-signature`. Optionally restrict to Paystack IPs.', 'required', 'Events: `charge.success`, `refund.processed`, `refund.failed`, `transfer.success`, `transfer.failed`, `transfer.reversed`.')
doc.paths['/webhooks/stripe'] = webhook('stripe', 'Stripe-Signature', 'Use the Stripe SDK `Webhook::constructEvent` with the endpoint signing secret; reject timestamps older than 5 minutes.', 'required', 'Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `invoice.paid` (subscriptions).')
doc.paths['/webhooks/paypal'] = webhook('paypal', 'PAYPAL-TRANSMISSION-SIG', 'Call PayPal `POST /v1/notifications/verify-webhook-signature` with the transmission headers and webhook id.', 'required', 'Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `CUSTOMER.DISPUTE.CREATED`.')
doc.paths['/webhooks/monnify'] = webhook('monnify', 'monnify-signature', 'HMAC-SHA512 of the raw body with the Monnify client secret, compared to `monnify-signature`. Optionally restrict to Monnify IPs.', 'required', 'Events: `SUCCESSFUL_TRANSACTION`, `SUCCESSFUL_DISBURSEMENT`, `FAILED_DISBURSEMENT`, `REVERSED_DISBURSEMENT`, `SUCCESSFUL_REFUND`.')
doc.paths['/webhooks/primely'] = webhook('primely', null, 'To be confirmed with the identity provider (Primely, pending confirmation).', 'proposed', 'Identity verification result. Updates `IdentityVerification.status` and emits `identity.updated`.')
doc.paths['/webhooks/zeptomail'] = webhook('zeptomail', null, 'ZeptoMail webhook authentication key configured per webhook.', 'optional', 'Bounce and complaint events; mark emails undeliverable and update campaign delivery stats.')
doc.paths['/webhooks/termii'] = webhook('termii', null, 'Shared secret query parameter or IP allow-list (Termii does not sign payloads).', 'optional', 'SMS delivery reports for OTP and campaign messages.')
doc.paths['/webhooks/twilio'] = webhook('twilio', 'X-Twilio-Signature', 'Validate `X-Twilio-Signature` with the Twilio auth token and full request URL.', 'optional', 'Status callbacks for backup SMS / WhatsApp messages.')
doc.paths['/webhooks/whatsapp'] = {
  ...webhook('whatsapp', 'X-Hub-Signature-256', 'HMAC-SHA256 of the raw body with the Meta app secret, compared to `X-Hub-Signature-256`.', 'optional', 'Message status updates from the WhatsApp Business Cloud API.'),
  get: { operationId: 'webhookWhatsappVerify', summary: 'WhatsApp webhook verification handshake', tags: ['Webhooks (backend-only)'], 'x-wedpluz-status': 'optional', security: [], parameters: [{ name: 'hub.mode', in: 'query', required: true, schema: { type: 'string' } }, { name: 'hub.verify_token', in: 'query', required: true, schema: { type: 'string' } }, { name: 'hub.challenge', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Echoes `hub.challenge` as text/plain when the verify token matches.', content: { 'text/plain': { schema: { type: 'string' } } } }, 403: { description: 'Verify token mismatch.' } } },
}
doc.paths['/broadcasting/auth'] = {
  post: {
    operationId: 'broadcastingAuth', summary: 'Authorise a private realtime channel', tags: ['System'], 'x-wedpluz-status': 'proposed',
    description: '**Status:** `proposed`. Needed once realtime is enabled (Laravel Reverb / Pusher protocol). Authorises `private-*` and `presence-*` channel subscriptions. See realtime-events.md.',
    security: [{ customerBearer: [] }, { adminBearer: [] }],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['socket_id', 'channel_name'], properties: { socket_id: { type: 'string' }, channel_name: { type: 'string' } } }, example: { socket_id: '123.456', channel_name: 'private-user.usr_me' } } } },
    responses: { 200: { description: 'Channel signature.', content: { 'application/json': { schema: { type: 'object', properties: { auth: { type: 'string' }, channel_data: { type: 'string' } } }, example: { auth: 'app-key:signature' } } } }, 401: { $ref: '#/components/responses/Unauthenticated' }, 403: { $ref: '#/components/responses/Forbidden' } },
  },
}
doc.paths['/health'] = { get: { operationId: 'health', summary: 'Liveness/readiness probe', tags: ['System'], 'x-wedpluz-status': 'optional', description: '**Status:** `optional`. Used by uptime monitoring and deploy checks. Must not expose versions of dependencies.', security: [], responses: { 200: { description: 'Up. `degraded` means the API serves requests but a background dependency (queue worker, scheduler) is behind.', content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ok', 'degraded'] }, checks: { type: 'object', additionalProperties: { type: 'string' }, description: 'Per-dependency state, e.g. `database: ok`, `queue: stale`.' } } }, example: { status: 'ok', checks: { database: 'ok', redis: 'ok', cache: 'ok', queue: 'ok', scheduler: 'ok' } } } } } } } }
for (const t of ['Webhooks (backend-only)', 'System']) tagSet.set(t, true)

/* ------------------------------------------------------------------ proposed social contracts */
// The brief lists social feeds, posts/comments and followers as API modules, but the web designs
// contain none of them. These are proposals for backend/product approval (and the mobile apps);
// the current web build does not call them.
const SOCIAL_TAG = 'Proposed · Social graph & feed'
tagSet.set(SOCIAL_TAG, true)
TAG_DESCRIPTIONS[SOCIAL_TAG] = 'Not used by the current web build and not in the designs. Proposed so feeds, posts, comments and followers share conventions with the rest of the API if product approves them.'
Object.assign(components, {
  Post: { type: 'object', required: ['id', 'author', 'body', 'media', 'reactions', 'commentsCount', 'createdAt'], properties: { id: { type: 'string' }, communityId: { type: ['string', 'null'] }, eventId: { type: ['string', 'null'] }, author: { $ref: '#/components/schemas/UserSummary' }, body: { type: ['string', 'null'], maxLength: 5000 }, media: { type: 'array', items: { $ref: '#/components/schemas/MediaItem' } }, reactions: { type: 'array', items: { $ref: '#/components/schemas/MessageReaction' } }, commentsCount: { type: 'integer' }, isMine: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, editedAt: { type: ['string', 'null'], format: 'date-time' } } },
  PostComment: { type: 'object', required: ['id', 'postId', 'author', 'body', 'createdAt'], properties: { id: { type: 'string' }, postId: { type: 'string' }, parentId: { type: ['string', 'null'], description: 'One level of replies.' }, author: { $ref: '#/components/schemas/UserSummary' }, body: { type: 'string', maxLength: 2000 }, likesCount: { type: 'integer' }, isLiked: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' } } },
  FollowState: { type: 'object', required: ['following', 'followersCount'], properties: { following: { type: 'boolean' }, followersCount: { type: 'integer' }, status: { type: 'string', enum: ['following', 'requested', 'none'], description: '`requested` when the target profile is private.' } } },
})
const proposedOp = (operationId, summary, extra) => ({
  operationId, summary, tags: [SOCIAL_TAG], 'x-wedpluz-status': 'proposed',
  description: '**Status:** `proposed`. Not called by the current web build. Requires product and backend approval before implementation.',
  security: [{ customerBearer: [] }],
  ...extra,
  responses: { ...extra.responses, 401: { $ref: '#/components/responses/Unauthenticated' }, 500: { $ref: '#/components/responses/ServerError' } },
})
const listOf = (ref, kind = 'CursorMeta') => ({ type: 'object', required: ['data', 'meta'], properties: { data: { type: 'array', items: { $ref: `#/components/schemas/${ref}` } }, meta: { $ref: `#/components/schemas/${kind}` } } })
const one = (ref) => ({ type: 'object', required: ['data'], properties: { data: { $ref: `#/components/schemas/${ref}` } } })
const idParam = (name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })
const cursorQ = [{ name: 'cursor', in: 'query', required: false, schema: { type: 'string' } }, { name: 'perPage', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } }]
const okList = (ref, kind) => ({ 200: { description: 'OK', content: { 'application/json': { schema: listOf(ref, kind) } } } })
const okOne = (ref, code = 200) => ({ [code]: { description: code === 201 ? 'Created' : 'OK', content: { 'application/json': { schema: one(ref) } } } })
const postBody = { required: true, content: { 'application/json': { schema: { type: 'object', properties: { body: { type: 'string', maxLength: 5000 }, mediaUploadIds: { type: 'array', items: { type: 'string' }, maxItems: 10 } } }, example: { body: 'Who else is coming to the gala? 💃', mediaUploadIds: [] } } } }
doc.paths['/feed'] = { get: proposedOp('socialFeed', 'Get my home feed (posts from communities and people I follow)', { parameters: cursorQ, responses: okList('Post') }) }
doc.paths['/communities/{id}/posts'] = {
  get: proposedOp('socialCommunityPosts', 'List community posts', { parameters: [idParam('id'), ...cursorQ], responses: { ...okList('Post'), 403: { $ref: '#/components/responses/Forbidden' }, 404: { $ref: '#/components/responses/NotFound' } } }),
  post: proposedOp('socialCreatePost', 'Create a community post', { parameters: [idParam('id')], requestBody: postBody, responses: { ...okOne('Post', 201), 403: { $ref: '#/components/responses/Forbidden' }, 422: { $ref: '#/components/responses/ValidationFailed' } } }),
}
doc.paths['/posts/{id}'] = { delete: proposedOp('socialDeletePost', 'Delete my post (or moderate as community admin)', { parameters: [idParam('id')], responses: { 204: { $ref: '#/components/responses/NoContent' }, 403: { $ref: '#/components/responses/Forbidden' }, 404: { $ref: '#/components/responses/NotFound' } } }) }
doc.paths['/posts/{id}/reactions'] = { post: proposedOp('socialReactToPost', 'Toggle a reaction on a post', { parameters: [idParam('id')], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['emoji'], properties: { emoji: { type: 'string', maxLength: 16 } } }, example: { emoji: '❤️' } } } }, responses: { ...okOne('Post'), 404: { $ref: '#/components/responses/NotFound' } } }) }
doc.paths['/posts/{id}/comments'] = {
  get: proposedOp('socialPostComments', 'List comments on a post', { parameters: [idParam('id'), ...cursorQ], responses: { ...okList('PostComment'), 404: { $ref: '#/components/responses/NotFound' } } }),
  post: proposedOp('socialCreateComment', 'Comment on a post', { parameters: [idParam('id')], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['body'], properties: { body: { type: 'string', minLength: 1, maxLength: 2000 }, parentId: { type: ['string', 'null'] } } }, example: { body: 'Count me in!', parentId: null } } } }, responses: { ...okOne('PostComment', 201), 404: { $ref: '#/components/responses/NotFound' }, 422: { $ref: '#/components/responses/ValidationFailed' } } }),
}
doc.paths['/comments/{id}'] = { delete: proposedOp('socialDeleteComment', 'Delete my comment', { parameters: [idParam('id')], responses: { 204: { $ref: '#/components/responses/NoContent' }, 403: { $ref: '#/components/responses/Forbidden' }, 404: { $ref: '#/components/responses/NotFound' } } }) }
doc.paths['/users/{id}/follow'] = {
  post: proposedOp('socialFollow', 'Follow a user', { parameters: [idParam('id')], responses: { ...okOne('FollowState'), 404: { $ref: '#/components/responses/NotFound' } } }),
  delete: proposedOp('socialUnfollow', 'Unfollow a user', { parameters: [idParam('id')], responses: { ...okOne('FollowState'), 404: { $ref: '#/components/responses/NotFound' } } }),
}
doc.paths['/users/{id}/followers'] = { get: proposedOp('socialFollowers', "List a user's followers", { parameters: [idParam('id'), ...cursorQ], responses: { ...okList('UserSummary'), 403: { $ref: '#/components/responses/Forbidden' }, 404: { $ref: '#/components/responses/NotFound' } } }) }
doc.paths['/users/{id}/following'] = { get: proposedOp('socialFollowing', 'List who a user follows', { parameters: [idParam('id'), ...cursorQ], responses: { ...okList('UserSummary'), 403: { $ref: '#/components/responses/Forbidden' }, 404: { $ref: '#/components/responses/NotFound' } } }) }
for (const [p, item] of Object.entries(doc.paths)) {
  for (const op of Object.values(item)) {
    if (![SOCIAL_TAG, 'Webhooks (backend-only)', 'System'].includes(op.tags?.[0])) continue
    for (const media of Object.values(op.responses)) {
      const c = media.content?.['application/json']
      if (c && c.example === undefined) c.example = synth(c.schema, null, 0)
    }
    const isHook = op.tags[0] !== SOCIAL_TAG
    index.push({ operationId: op.operationId, method: Object.keys(item).find((m) => item[m] === op).toUpperCase(), path: p, tag: op.tags[0], status: op['x-wedpluz-status'], auth: op.security?.length === 0 ? (op.tags[0] === 'System' ? 'public' : 'signature') : 'customer', permission: null, idempotent: false, pagination: op.parameters?.some((x) => x.name === 'cursor') ? 'cursor' : null, request: op.requestBody ? describeSchema(op.requestBody.content['application/json'].schema) : null, response: isHook ? (op.responses[200]?.description ?? '200') : op.responses[204] ? '204 No Content' : socialResponse(op), query: (op.parameters ?? []).filter((x) => x.in === 'query').map((x) => x.name), errors: [], summary: op.summary })
  }
}

function socialResponse(op) {
  const sc = (op.responses[201] ?? op.responses[200])?.content?.['application/json']?.schema
  const d = sc?.properties?.data
  if (!d) return 'object'
  return d.type === 'array' ? `${d.items.$ref.split('/').pop()}[] + meta(cursor)` : d.$ref.split('/').pop()
}

/* ------------------------------------------------------------------ synthesised examples */
function synth(s, name, depth) {
  if (!s || depth > 12) return null
  if (s.example !== undefined) return s.example
  if (s.$ref) return synth(components[s.$ref.split('/').pop()] ?? fixedSchemas[s.$ref.split('/').pop()], name, depth + 1)
  if (s.allOf) return synth(s.allOf[0], name, depth + 1)
  if (s.anyOf) return synth(s.anyOf.find((x) => x.type !== 'null') ?? s.anyOf[0], name, depth + 1)
  if (s.enum) return s.enum.find((e) => e !== null && e !== 'all') ?? s.enum[0]
  const type = Array.isArray(s.type) ? s.type.find((t) => t !== 'null') : s.type
  if (type === 'object') {
    if (!s.properties) return {}
    const o = {}
    for (const [k, v] of Object.entries(s.properties)) o[k] = synth(v, k, depth + 1)
    return o
  }
  if (type === "array") return depth > 9 ? [] : [synth(s.items, name, depth + 1)]
  if (type === 'integer' || type === 'number') {
    if (MONEY.has(name)) return 1500000
    if (/Percent|percent/.test(name ?? '')) return 10
    if (type === 'number' && /rating|average/i.test(name ?? '')) return 4.6
    return /page$/i.test(name ?? '') ? 1 : 12
  }
  if (type === 'boolean') return name ? /^(is|has|can|members|allow|show|require)/.test(name) === false : false
  if (type === 'null') return null
  if (type === 'string') {
    if (s.format === 'date-time') return '2026-12-12T18:00:00Z'
    if (s.format === 'date') return '2026-12-12'
    if (s.format === 'email') return 'ada.obi@example.com'
    if (s.format === 'uri') return 'https://res.cloudinary.com/wedpluz/image/upload/v1/sample.jpg'
    if (s.format === 'uuid') return '6f1c2b8e-0f8a-4f7e-9d0e-3b1f2a7c9d11'
    if (!name) return 'string'
    if (name === 'id' || name.endsWith('Id')) return `${name === 'id' ? 'res' : name.replace(/Id$/, '').slice(0, 3)}_01J9Z8K3`
    if (name === 'currency') return 'NGN'
    if (/name$/i.test(name)) return 'Ada Obi'
    if (name === 'slug') return 'luxury-wedding-gala'
    if (name === 'title') return 'Luxury Wedding Gala'
    if (/reference$/i.test(name)) return 'WPZ-7Q3K9X'
    if (name === 'code') return 'WPZ-TKT-8H2D'
    if (/(token|Token)$/.test(name)) return 'eyJhbGciOi...redacted'
    if (/(description|body|content|message|comment|details|note|reason|bio|caption|excerpt)$/i.test(name)) return 'Example text'
    if (/(link|url)$/i.test(name)) return 'https://wedpluz.com/events/luxury-wedding-gala'
    if (/phone/i.test(name)) return '+2348012345678'
    if (/city|location/i.test(name)) return 'Lagos'
    return 'string'
  }
  return null
}

/* ------------------------------------------------------------------ finalise */
doc.components.schemas = { ...fixedSchemas, ...Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))) }
const order = ['Auth', 'Account & Profile', 'Event Discovery', 'Checkout & Tickets', 'Organizer Portal', 'Vendors', 'Communities', 'Messaging', 'Notifications', 'Wallet & Subscriptions', 'Pluz Planner', ...Object.values(ADMIN_TAGS), SOCIAL_TAG, 'Webhooks (backend-only)', 'System']
doc.tags = order.filter((t) => tagSet.has(t)).map((name) => ({ name, description: TAG_DESCRIPTIONS[name] ?? (name.startsWith('Admin') ? `Admin console: ${name.replace('Admin · ', '')}. Requires an admin token and the listed permission.` : undefined) }))

fs.mkdirSync(OUT_DIR, { recursive: true })
const header = '# Generated from the typed frontend API layer (src/services/api) by the frontend team.\n# This is a CONTRACT PROPOSAL, not documentation of an implemented backend.\n# Every operation carries x-wedpluz-status: required | optional | proposed.\n# Regenerate with: npm run openapi:generate (do not edit by hand).\n'
fs.writeFileSync(path.join(OUT_DIR, 'openapi.yaml'), header + yaml.dump(doc, { noRefs: true, lineWidth: 140, sortKeys: false }))
fs.writeFileSync(path.join(SCRATCH, 'endpoint-index.json'), JSON.stringify(index, null, 2))
console.log(`operations: ${ops.length}, paths: ${Object.keys(doc.paths).length}, schemas: ${Object.keys(doc.components.schemas).length}`)
console.log('status counts', index.reduce((a, o) => ((a[o.status] = (a[o.status] ?? 0) + 1), a), {}))

/* ------------------------------------------------------------------ api-contracts.md tables */
// Fills <!-- endpoints:<Tag> --> ... <!-- /endpoints --> regions so the prose doc never drifts
// from the spec.
const contractsPath = path.join(OUT_DIR, 'api-contracts.md')
if (fs.existsSync(contractsPath)) {
  const esc = (v) => String(v ?? '').replace(/\|/g, '\|')
  const authCell = (o) => {
    const base = o.auth === 'admin' ? (o.permission ? `admin · \`${o.permission}\`` : 'admin') : o.auth
    return o.idempotent ? `${base} · Idempotency-Key` : base
  }
  const reqCell = (o) => [o.request ? esc(o.request) : null, o.query.length ? `query: ${o.query.join(', ')}` : null].filter(Boolean).join('<br>') || '—'
  const table = (tag) => {
    const rows = index.filter((o) => o.tag === tag)
    if (!rows.length) return `_No operations for ${tag}._`
    return ['| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |', '|---|---|---|---|---|---|---|---|',
      ...rows.map((o) => `| ${o.method} | \`${esc(o.path)}\` | ${esc(o.summary)} | ${authCell(o)} | ${o.status} | ${reqCell(o)} | ${esc(o.response)} | ${o.errors.map((c) => `\`${c}\``).join(' ') || '—'} |`)].join('\n')
  }
  let md = fs.readFileSync(contractsPath, 'utf8')
  md = md.replace(/<!-- endpoints:(.+?) -->[\s\S]*?<!-- \/endpoints -->/g, (_, tag) => `<!-- endpoints:${tag} -->\n${table(tag.trim())}\n<!-- /endpoints -->`)
  fs.writeFileSync(contractsPath, md)
  console.log('api-contracts.md tables refreshed')
}
