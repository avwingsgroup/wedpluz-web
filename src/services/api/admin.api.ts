import { request } from '@/services/http'
import type {
  AdminBookingFilters,
  AdminBookingRecord,
  AdminCommunityRecord,
  AdminEventFilters,
  AdminEventRecord,
  AdminOrganizerRecord,
  AdminUser,
  AdminUserFilters,
  AdminUserRecord,
  AuditLogEntry,
  AuthTokens,
  Banner,
  CmsPage,
  CommissionRule,
  ContentReport,
  Dispute,
  Event,
  EventCategory,
  ExecutiveDashboard,
  ExportJob,
  FinanceSummary,
  FinanceTransaction,
  GatewayHealth,
  NotificationCampaign,
  NotificationTemplate,
  Payout,
  Permission,
  PermissionKey,
  PlatformSettings,
  RefundRecord,
  ReportDefinition,
  ReportKey,
  ReportQuery,
  ReportResult,
  Role,
  SecurityLogEntry,
  Settlement,
  SupportTicket,
  TrendPoint,
  User,
  UserActivityEntry,
  UserRole,
  UserSummary,
  Vendor,
} from '@/types'

type Q = Record<string, unknown>

export interface AdminLoginResult {
  requiresTwoFactor: boolean
  admin: AdminUser | null
  tokens: AuthTokens | null
}

export const adminApi = {
  auth: {
    login: (payload: { email: string; password: string; otp?: string }) => request.post<AdminLoginResult>('/admin/auth/login', payload, { skipAuth: true, skipRefresh: true }),
    me: () => request.get<AdminUser>('/admin/me', undefined, { skipRefresh: true }),
    logout: () => request.post<void>('/admin/auth/logout', undefined, { skipRefresh: true }),
  },
  dashboard: (params: { from?: string; to?: string }) => request.get<ExecutiveDashboard>('/admin/dashboard', params),

  users: {
    list: (f: AdminUserFilters, signal?: AbortSignal) => request.getPaginated<AdminUserRecord>('/admin/users', f as Q, { signal }),
    get: (id: string) => request.get<AdminUserRecord & User>(`/admin/users/${id}`),
    activity: (id: string, page = 1) => request.getPaginated<UserActivityEntry>(`/admin/users/${id}/activity`, { page }),
    tickets: (id: string, page = 1) => request.getPaginated<AdminBookingRecord>(`/admin/users/${id}/tickets`, { page }),
    reports: (id: string) => request.get<ContentReport[]>(`/admin/users/${id}/reports`),
    suspend: (id: string, reason: string) => request.post<AdminUserRecord>(`/admin/users/${id}/suspend`, { reason }),
    reactivate: (id: string) => request.post<AdminUserRecord>(`/admin/users/${id}/reactivate`),
    setRoles: (id: string, roles: UserRole[]) => request.patch<AdminUserRecord>(`/admin/users/${id}/roles`, { roles }),
    decideDeletion: (id: string, decision: 'approve' | 'reject') => request.post<AdminUserRecord>(`/admin/users/${id}/deletion/${decision}`),
    deletionRequests: (page = 1) => request.getPaginated<AdminUserRecord>('/admin/deletion-requests', { page }),
  },

  events: {
    list: (f: AdminEventFilters, signal?: AbortSignal) => request.getPaginated<AdminEventRecord>('/admin/events', f as Q, { signal }),
    get: (id: string) => request.get<Event & AdminEventRecord & { bookings: AdminBookingRecord[]; reports: ContentReport[] }>(`/admin/events/${id}`),
    act: (id: string, action: 'approve' | 'reject' | 'suspend' | 'restore' | 'feature' | 'unfeature', reason?: string) => request.post<AdminEventRecord>(`/admin/events/${id}/${action}`, { reason }),
    categories: () => request.get<EventCategory[]>('/admin/categories'),
    createCategory: (payload: { name: string; icon?: string }) => request.post<EventCategory>('/admin/categories', payload),
    updateCategory: (id: string, payload: Partial<EventCategory>) => request.put<EventCategory>(`/admin/categories/${id}`, payload),
    deleteCategory: (id: string) => request.del(`/admin/categories/${id}`),
  },

  organizers: {
    list: (f: Q, signal?: AbortSignal) => request.getPaginated<AdminOrganizerRecord>('/admin/organizers', f, { signal }),
    get: (id: string) => request.get<AdminOrganizerRecord & { events: AdminEventRecord[]; settlements: Settlement[]; vendorProfile: Vendor | null }>(`/admin/organizers/${id}`),
    act: (id: string, action: 'verify' | 'reject' | 'suspend' | 'reactivate', reason?: string) => request.post<AdminOrganizerRecord>(`/admin/organizers/${id}/${action}`, { reason }),
    setCommission: (id: string, percent: number | null) => request.put<AdminOrganizerRecord>(`/admin/organizers/${id}/commission`, { percent }),
  },

  bookings: {
    list: (f: AdminBookingFilters, signal?: AbortSignal) => request.getPaginated<AdminBookingRecord>('/admin/bookings', f as Q, { signal }),
    get: (id: string) => request.get<AdminBookingRecord & { tickets: Array<{ id: string; code: string; holderName: string; status: string; checkedInAt: string | null }>; timeline: Array<{ at: string; label: string; by: string }>; dispute: Dispute | null }>(`/admin/bookings/${id}`),
    refund: (id: string, payload: { amount: number; reason: string }) => request.post<RefundRecord>(`/admin/bookings/${id}/refund`, payload),
    resend: (id: string) => request.post<{ sent: boolean }>(`/admin/bookings/${id}/resend`),
    disputes: (f: Q) => request.getPaginated<Dispute>('/admin/disputes', f),
    updateDispute: (id: string, payload: { status?: Dispute['status']; assignToMe?: boolean; note?: string }) => request.patch<Dispute>(`/admin/disputes/${id}`, payload),
    checkIns: (f: Q) => request.getPaginated<{ id: string; event: { id: string; title: string }; attendee: UserSummary; ticketCode: string; checkedInBy: UserSummary; method: string; device: string; checkedInAt: string; result: string }>('/admin/check-ins', f),
    inventory: (f: Q) => request.getPaginated<{ id: string; event: { id: string; title: string; startsAt: string }; ticketType: string; price: number; quantity: number; sold: number; remaining: number; salesEndAt: string | null; sellThrough: number }>('/admin/inventory', f),
  },

  finance: {
    summary: (params: { from?: string; to?: string }) => request.get<FinanceSummary>('/admin/finance/summary', params),
    transactions: (f: Q, signal?: AbortSignal) => request.getPaginated<FinanceTransaction>('/admin/finance/transactions', f, { signal }),
    reconcile: (id: string, payload: { status: 'matched' | 'mismatch'; note?: string }) => request.post<FinanceTransaction>(`/admin/finance/transactions/${id}/reconcile`, payload),
    settlements: (f: Q) => request.getPaginated<Settlement>('/admin/finance/settlements', f),
    holdSettlement: (id: string, reason: string) => request.post<Settlement>(`/admin/finance/settlements/${id}/hold`, { reason }),
    releaseSettlement: (id: string) => request.post<Settlement>(`/admin/finance/settlements/${id}/release`),
    payouts: (f: Q) => request.getPaginated<Payout>('/admin/finance/payouts', f),
    requestPayout: (settlementIds: string[]) => request.post<Payout>('/admin/finance/payouts', { settlementIds }),
    approvePayout: (id: string, otp: string) => request.post<Payout>(`/admin/finance/payouts/${id}/approve`, { otp }),
    rejectPayout: (id: string, reason: string) => request.post<Payout>(`/admin/finance/payouts/${id}/reject`, { reason }),
    refunds: (f: Q) => request.getPaginated<RefundRecord>('/admin/finance/refunds', f),
    decideRefund: (id: string, decision: 'approve' | 'reject') => request.post<RefundRecord>(`/admin/finance/refunds/${id}/${decision}`),
    commissions: () => request.get<CommissionRule[]>('/admin/finance/commissions'),
    updateCommission: (id: string, payload: { percent?: number; fixedFee?: number }) => request.put<CommissionRule>(`/admin/finance/commissions/${id}`, payload),
    createCommission: (payload: { scope: 'category' | 'organizer'; scopeId: string; scopeLabel: string; percent: number; fixedFee: number }) => request.post<CommissionRule>('/admin/finance/commissions', payload),
    gateways: () => request.get<Array<GatewayHealth & { series: TrendPoint[] }>>('/admin/finance/gateways'),
  },

  moderation: {
    reports: (f: Q, signal?: AbortSignal) => request.getPaginated<ContentReport>('/admin/moderation/reports', f, { signal }),
    report: (id: string) => request.get<ContentReport & { history: ContentReport[] }>(`/admin/moderation/reports/${id}`),
    updateReport: (id: string, payload: { assignToMe?: boolean; priority?: ContentReport['priority']; status?: 'reviewing' }) => request.patch<ContentReport>(`/admin/moderation/reports/${id}`, payload),
    act: (id: string, payload: { action: 'removed' | 'restored' | 'warned' | 'suspended' | 'dismissed'; note: string }) => request.post<ContentReport>(`/admin/moderation/reports/${id}/actions`, payload),
    communities: (f: Q) => request.getPaginated<AdminCommunityRecord>('/admin/communities', f),
    communityAct: (id: string, action: 'suspend' | 'restore' | 'archive') => request.post<AdminCommunityRecord>(`/admin/communities/${id}/${action}`),
  },

  notifications: {
    campaigns: (f: Q) => request.getPaginated<NotificationCampaign>('/admin/notifications/campaigns', f),
    campaign: (id: string) => request.get<NotificationCampaign & { deliveryByChannel: Array<{ channel: string; sent: number; delivered: number; opened: number; failed: number }> }>(`/admin/notifications/campaigns/${id}`),
    createCampaign: (payload: Partial<NotificationCampaign> & { name: string; body: string; channels: string[] }) => request.post<NotificationCampaign>('/admin/notifications/campaigns', payload),
    sendCampaign: (id: string) => request.post<NotificationCampaign>(`/admin/notifications/campaigns/${id}/send`),
    cancelCampaign: (id: string) => request.post<NotificationCampaign>(`/admin/notifications/campaigns/${id}/cancel`),
    test: (payload: { channel: string; body: string }) => request.post<{ sent: boolean }>('/admin/notifications/test', payload),
    templates: () => request.get<NotificationTemplate[]>('/admin/notifications/templates'),
    updateTemplate: (id: string, payload: Partial<NotificationTemplate>) => request.put<NotificationTemplate>(`/admin/notifications/templates/${id}`, payload),
    createTemplate: (payload: { key: string; name: string; channel: NotificationTemplate['channel']; subject?: string; body: string }) => request.post<NotificationTemplate>('/admin/notifications/templates', payload),
  },

  settings: {
    get: () => request.get<PlatformSettings>('/admin/settings'),
    update: (payload: Partial<PlatformSettings>) => request.put<PlatformSettings>('/admin/settings', payload),
    banners: () => request.get<Banner[]>('/admin/banners'),
    createBanner: (payload: Partial<Banner>) => request.post<Banner>('/admin/banners', payload),
    updateBanner: (id: string, payload: Partial<Banner>) => request.put<Banner>(`/admin/banners/${id}`, payload),
    deleteBanner: (id: string) => request.del(`/admin/banners/${id}`),
    pages: () => request.get<CmsPage[]>('/admin/pages'),
    updatePage: (slug: string, payload: { title?: string; content?: string }) => request.put<CmsPage>(`/admin/pages/${slug}`, payload),
  },

  access: {
    permissions: () => request.get<Permission[]>('/admin/permissions'),
    roles: () => request.get<Role[]>('/admin/roles'),
    createRole: (payload: { name: string; description?: string; permissions: PermissionKey[] }) => request.post<Role>('/admin/roles', payload),
    updateRole: (id: string, payload: Partial<Pick<Role, 'name' | 'description' | 'permissions'>>) => request.put<Role>(`/admin/roles/${id}`, payload),
    deleteRole: (id: string) => request.del(`/admin/roles/${id}`),
    admins: () => request.get<AdminUser[]>('/admin/admins'),
    inviteAdmin: (payload: { firstName: string; lastName: string; email: string; roleIds: string[] }) => request.post<AdminUser>('/admin/admins', payload),
    updateAdmin: (id: string, payload: { roleIds?: string[]; status?: 'active' | 'suspended' }) => request.patch<AdminUser>(`/admin/admins/${id}`, payload),
    auditLogs: (f: Q, signal?: AbortSignal) => request.getPaginated<AuditLogEntry>('/admin/audit-logs', f, { signal }),
    securityLogs: (f: Q) => request.getPaginated<SecurityLogEntry>('/admin/security-logs', f),
  },

  reports: {
    definitions: () => request.get<ReportDefinition[]>('/admin/reports/definitions'),
    run: (key: ReportKey, query: ReportQuery) => request.post<ReportResult, ReportQuery>(`/admin/reports/${key}/run`, query),
    export: (key: ReportKey, payload: ReportQuery & { format: 'csv' | 'xlsx' | 'pdf' }) => request.post<ExportJob>(`/admin/reports/${key}/export`, payload),
    exportJob: (id: string) => request.get<ExportJob>(`/admin/exports/${id}`),
  },

  support: {
    tickets: (f: Q) => request.getPaginated<SupportTicket>('/admin/support/tickets', f),
    ticket: (id: string) => request.get<SupportTicket & { messages: Array<{ id: string; author: UserSummary; isStaff: boolean; body: string; createdAt: string }> }>(`/admin/support/tickets/${id}`),
    update: (id: string, payload: { status?: SupportTicket['status']; priority?: SupportTicket['priority']; assignToMe?: boolean }) => request.patch<SupportTicket>(`/admin/support/tickets/${id}`, payload),
    reply: (id: string, body: string) => request.post<{ id: string; body: string }>(`/admin/support/tickets/${id}/messages`, { body }),
  },
}
