import type { Currency, Id, ISODateString } from './api'
import type { EventStatus, EventSummary } from './event'
import type { OrderStatus, RefundStatus } from './ticketing'
import type { IdentityStatus, PlanTier, User, UserRole, UserStatus, UserSummary } from './user'
import type { VendorStatus } from './vendor'
import type { TransactionStatus } from './wallet'

/* ---------- RBAC ---------- */

export type PermissionKey =
  | 'dashboard.view'
  | 'users.view'
  | 'users.manage'
  | 'users.suspend'
  | 'events.view'
  | 'events.moderate'
  | 'events.feature'
  | 'categories.manage'
  | 'organizers.view'
  | 'organizers.verify'
  | 'organizers.manage'
  | 'bookings.view'
  | 'bookings.manage'
  | 'refunds.view'
  | 'refunds.approve'
  | 'finance.view'
  | 'finance.reconcile'
  | 'finance.settlements'
  | 'finance.payouts.approve'
  | 'finance.commission.manage'
  | 'moderation.view'
  | 'moderation.act'
  | 'notifications.view'
  | 'notifications.send'
  | 'settings.view'
  | 'settings.manage'
  | 'roles.manage'
  | 'audit.view'
  | 'reports.view'
  | 'reports.export'
  | 'support.view'
  | 'support.manage'

export interface Permission {
  key: PermissionKey
  module: string
  label: string
  description: string
  isSensitive: boolean
}

export interface Role {
  id: Id
  name: string
  slug: string
  description: string
  permissions: PermissionKey[]
  isSystem: boolean
  membersCount: number
  createdAt: ISODateString
}

export interface AdminUser {
  id: Id
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  roles: Pick<Role, 'id' | 'name' | 'slug'>[]
  permissions: PermissionKey[]
  status: 'active' | 'suspended' | 'invited'
  twoFactorEnabled: boolean
  lastLoginAt: ISODateString | null
  createdAt: ISODateString
}

export interface AuditLogEntry {
  id: Id
  actor: Pick<AdminUser, 'id' | 'firstName' | 'lastName' | 'email' | 'avatarUrl'> | null
  action: string
  module: string
  targetType: string
  targetId: Id | null
  targetLabel: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string
  userAgent: string
  correlationId: string
  createdAt: ISODateString
}

export interface SecurityLogEntry {
  id: Id
  actor: Pick<AdminUser, 'id' | 'email'> | null
  event: 'login_success' | 'login_failed' | 'logout' | 'password_changed' | '2fa_enabled' | '2fa_disabled' | 'permission_denied' | 'session_revoked'
  ip: string
  location: string | null
  userAgent: string
  createdAt: ISODateString
}

/* ---------- Dashboard ---------- */

export interface TrendPoint {
  date: string
  value: number
}

export interface KpiValue {
  value: number
  previous: number
  changePercent: number
  trend: TrendPoint[]
}

export interface ExecutiveDashboard {
  period: { from: string; to: string }
  users: { total: number; active: number; inactive: number; newInPeriod: KpiValue; verified: number }
  events: { total: number; upcoming: number; ongoing: number; completed: number; pendingReview: number; createdInPeriod: KpiValue }
  tickets: { sold: KpiValue; bookings: KpiValue; checkIns: number }
  finance: { gtv: KpiValue; platformRevenue: KpiValue; pendingSettlements: number; refundsAmount: number; refundsCount: number; currency: Currency }
  community: { communities: number; messagesInPeriod: number; postsInPeriod: number; reportsOpen: number }
  recentActivity: AuditLogEntry[]
  alerts: SystemAlert[]
  topEvents: Array<{ event: EventSummary; ticketsSold: number; revenue: number }>
  acquisitionBySource: Array<{ source: 'web' | 'android' | 'ios'; users: number }>
  gatewayHealth: GatewayHealth[]
}

export interface SystemAlert {
  id: Id
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  link: string | null
  createdAt: ISODateString
}

export interface GatewayHealth {
  provider: 'paystack' | 'stripe' | 'paypal' | 'monnify'
  successRate: number
  avgLatencyMs: number
  volume: number
  failures: number
  status: 'operational' | 'degraded' | 'down'
}

/* ---------- Users ---------- */

export interface AdminUserRecord extends User {
  ticketsCount: number
  eventsCount: number
  reportsCount: number
  totalSpent: number
  signupSource: 'web' | 'android' | 'ios'
  suspendedReason: string | null
  deletionRequest: { requestedAt: ISODateString; scheduledFor: ISODateString; status: 'pending' | 'cancelled' | 'completed' } | null
}

export interface AdminUserFilters {
  search?: string
  status?: UserStatus | 'all'
  role?: UserRole | 'all'
  identityStatus?: IdentityStatus | 'all'
  plan?: PlanTier | 'all'
  source?: 'web' | 'android' | 'ios' | 'all'
  dateFrom?: string
  dateTo?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

export interface UserActivityEntry {
  id: Id
  type: string
  description: string
  source: 'web' | 'android' | 'ios'
  createdAt: ISODateString
}

/* ---------- Events ---------- */

export interface AdminEventRecord extends EventSummary {
  ticketsSold: number
  revenue: number
  reportsCount: number
  submittedAt: ISODateString | null
  reviewedBy: UserSummary | null
  rejectionReason: string | null
  source: 'web' | 'android' | 'ios'
}

export interface AdminEventFilters {
  search?: string
  status?: EventStatus | 'all'
  categoryId?: Id | 'all'
  attendanceMode?: 'physical' | 'online' | 'hybrid' | 'all'
  featured?: boolean
  dateFrom?: string
  dateTo?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

/* ---------- Organizers / Vendors ---------- */

export interface AdminOrganizerRecord {
  id: Id
  user: UserSummary & { email: string }
  businessName: string | null
  type: 'organizer' | 'vendor' | 'both'
  vendorStatus: VendorStatus | null
  identityStatus: IdentityStatus
  eventsCount: number
  ticketsSold: number
  grossRevenue: number
  commissionPercent: number | null
  pendingSettlement: number
  totalPaidOut: number
  rating: number | null
  joinedAt: ISODateString
  verificationDocuments: Array<{ id: Id; type: string; url: string; status: 'pending' | 'approved' | 'rejected' }>
}

/* ---------- Bookings ---------- */

export interface AdminBookingRecord {
  id: Id
  reference: string
  event: Pick<EventSummary, 'id' | 'title' | 'slug' | 'coverUrl' | 'startsAt'>
  buyer: UserSummary & { email: string }
  ticketsCount: number
  total: number
  serviceFee: number
  currency: Currency
  status: OrderStatus
  paymentMethod: string
  provider: string
  providerReference: string | null
  checkedInCount: number
  source: 'web' | 'android' | 'ios'
  createdAt: ISODateString
  disputeId: Id | null
}

export interface AdminBookingFilters {
  search?: string
  status?: OrderStatus | 'all'
  eventId?: Id
  provider?: string | 'all'
  dateFrom?: string
  dateTo?: string
  page?: number
  perPage?: number
}

export interface Dispute {
  id: Id
  booking: Pick<AdminBookingRecord, 'id' | 'reference' | 'total' | 'currency'>
  raisedBy: UserSummary
  type: 'chargeback' | 'not_received' | 'duplicate' | 'quality' | 'other'
  status: 'open' | 'investigating' | 'resolved_refund' | 'resolved_rejected'
  description: string
  assignedTo: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  createdAt: ISODateString
  updatedAt: ISODateString
}

/* ---------- Finance ---------- */

export interface FinanceTransaction {
  id: Id
  reference: string
  providerReference: string | null
  type: 'ticket_sale' | 'refund' | 'payout' | 'top_up' | 'withdrawal' | 'subscription' | 'commission' | 'chargeback'
  provider: 'paystack' | 'stripe' | 'paypal' | 'monnify' | 'wallet' | 'internal'
  amount: number
  fee: number
  net: number
  currency: Currency
  status: TransactionStatus
  reconciliationStatus: 'matched' | 'unmatched' | 'mismatch' | 'pending'
  user: UserSummary | null
  event: Pick<EventSummary, 'id' | 'title'> | null
  createdAt: ISODateString
  settledAt: ISODateString | null
}

export interface Settlement {
  id: Id
  reference: string
  organizer: UserSummary & { email: string; businessName: string | null }
  event: Pick<EventSummary, 'id' | 'title' | 'startsAt'>
  grossSales: number
  refunds: number
  platformCommission: number
  gatewayFees: number
  netPayable: number
  currency: Currency
  status: 'pending' | 'ready' | 'on_hold' | 'paid' | 'failed'
  holdReason: string | null
  eligibleAt: ISODateString
  paidAt: ISODateString | null
  payoutId: Id | null
}

export interface Payout {
  id: Id
  reference: string
  settlementIds: Id[]
  organizer: UserSummary & { businessName: string | null }
  bankAccount: { bankName: string; accountNumber: string; accountName: string }
  amount: number
  currency: Currency
  provider: 'monnify' | 'paystack' | 'manual'
  status: 'requested' | 'approved' | 'processing' | 'paid' | 'failed' | 'rejected'
  requestedBy: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  approvedBy: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  failureReason: string | null
  createdAt: ISODateString
  completedAt: ISODateString | null
}

export interface RefundRecord {
  id: Id
  reference: string
  booking: Pick<AdminBookingRecord, 'id' | 'reference' | 'event' | 'buyer'>
  amount: number
  currency: Currency
  reason: string
  status: RefundStatus
  requestedAt: ISODateString
  decidedBy: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  decidedAt: ISODateString | null
  provider: string
}

export interface CommissionRule {
  id: Id
  scope: 'platform' | 'category' | 'organizer'
  scopeId: Id | null
  scopeLabel: string
  percent: number
  fixedFee: number
  currency: Currency
  effectiveFrom: ISODateString
  updatedBy: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  updatedAt: ISODateString
}

export interface FinanceSummary {
  period: { from: string; to: string }
  currency: Currency
  gtv: KpiValue
  platformRevenue: KpiValue
  gatewayFees: number
  refunds: number
  pendingSettlements: number
  paidOut: number
  walletFloat: number
  byProvider: Array<{ provider: string; volume: number; count: number; successRate: number }>
  revenueByDay: Array<{ date: string; gtv: number; revenue: number }>
}

/* ---------- Moderation ---------- */

export interface ContentReport {
  id: Id
  targetType: 'user' | 'message' | 'community' | 'event' | 'vendor' | 'work' | 'status' | 'review'
  targetId: Id
  targetPreview: { title: string; excerpt: string | null; imageUrl: string | null; link: string | null }
  reporter: UserSummary
  reportedUser: UserSummary | null
  reason: string
  details: string | null
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed'
  priority: 'low' | 'medium' | 'high'
  assignedTo: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  resolution: { action: 'removed' | 'restored' | 'warned' | 'suspended' | 'dismissed'; note: string; by: string; at: ISODateString } | null
  createdAt: ISODateString
}

export interface AdminCommunityRecord {
  id: Id
  name: string
  avatarUrl: string | null
  event: Pick<EventSummary, 'id' | 'title'> | null
  owner: UserSummary
  membersCount: number
  messagesLast7d: number
  reportsOpen: number
  status: 'active' | 'archived' | 'suspended'
  createdAt: ISODateString
}

/* ---------- Notifications ---------- */

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app'

export interface NotificationTemplate {
  id: Id
  key: string
  name: string
  channel: NotificationChannel
  subject: string | null
  body: string
  variables: string[]
  isActive: boolean
  updatedAt: ISODateString
}

export interface NotificationCampaign {
  id: Id
  name: string
  channels: NotificationChannel[]
  audience: { type: 'all' | 'segment' | 'event_attendees' | 'organizers' | 'vendors' | 'custom'; filters: Record<string, string>; estimatedSize: number }
  templateId: Id | null
  subject: string | null
  body: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
  scheduledAt: ISODateString | null
  sentAt: ISODateString | null
  stats: { sent: number; delivered: number; opened: number; clicked: number; failed: number }
  createdBy: Pick<AdminUser, 'id' | 'firstName' | 'lastName'>
  createdAt: ISODateString
}

/* ---------- Platform configuration ---------- */

export interface PlatformSettings {
  general: { platformName: string; supportEmail: string; supportPhone: string; supportWhatsapp: string; defaultCurrency: Currency; defaultCountry: string; timezone: string; maintenanceMode: boolean }
  payments: { enabledProviders: Array<'paystack' | 'stripe' | 'paypal' | 'monnify' | 'wallet'>; defaultProvider: string; serviceFeePercent: number; serviceFeeFixed: number; passFeesToBuyer: boolean; refundWindowHours: number; settlementDelayDays: number; minWithdrawal: number; maxWithdrawal: number }
  features: Record<string, boolean>
  app: { minAndroidVersion: string; minIosVersion: string; forceUpdate: boolean; androidStoreUrl: string; iosStoreUrl: string }
  legal: { termsUrl: string; privacyUrl: string; termsUpdatedAt: ISODateString; privacyUpdatedAt: ISODateString }
}

export interface Banner {
  id: Id
  title: string
  subtitle: string | null
  imageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  placement: 'home_hero' | 'home_inline' | 'events_top' | 'vendors_top' | 'app_home'
  audience: 'all' | 'individuals' | 'businesses' | 'guests'
  startsAt: ISODateString | null
  endsAt: ISODateString | null
  isActive: boolean
  priority: number
  impressions: number
  clicks: number
}

export interface CmsPage {
  id: Id
  slug: 'about' | 'terms' | 'privacy' | 'faqs' | 'help' | 'contact'
  title: string
  content: string
  updatedAt: ISODateString
  updatedBy: string | null
}

/* ---------- Support ---------- */

export interface SupportTicket {
  id: Id
  reference: string
  user: UserSummary & { email: string }
  subject: string
  category: 'payment' | 'ticket' | 'account' | 'event' | 'vendor' | 'bug' | 'other'
  status: 'open' | 'pending' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo: Pick<AdminUser, 'id' | 'firstName' | 'lastName'> | null
  source: 'web' | 'android' | 'ios' | 'email'
  messagesCount: number
  createdAt: ISODateString
  updatedAt: ISODateString
}

/* ---------- Reports ---------- */

export type ReportKey =
  | 'user_acquisition'
  | 'user_engagement'
  | 'event_performance'
  | 'ticket_sales'
  | 'revenue'
  | 'organizer_performance'
  | 'payments'
  | 'settlements'
  | 'community_engagement'

export interface ReportDefinition {
  key: ReportKey
  name: string
  description: string
  dimensions: string[]
  metrics: string[]
  exportFormats: Array<'csv' | 'xlsx' | 'pdf'>
}

export interface ReportResult {
  key: ReportKey
  period: { from: string; to: string }
  groupBy: string
  columns: Array<{ key: string; label: string; type: 'string' | 'number' | 'money' | 'percent' | 'date' }>
  rows: Array<Record<string, string | number | null>>
  totals: Record<string, number>
  series: Array<{ name: string; points: TrendPoint[] }>
}

export interface ReportQuery {
  from: string
  to: string
  groupBy?: 'day' | 'week' | 'month' | 'category' | 'city' | 'source' | 'organizer' | 'provider'
  filters?: Record<string, string>
}

export interface ExportJob {
  id: Id
  status: 'queued' | 'processing' | 'ready' | 'failed'
  format: 'csv' | 'xlsx' | 'pdf'
  downloadUrl: string | null
  expiresAt: ISODateString | null
}
