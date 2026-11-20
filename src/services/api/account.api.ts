import { request } from '@/services/http'
import type {
  AccountDeletionRequest,
  BannerPlacement,
  PublicBanner,
  ChangePasswordPayload,
  CmsPage,
  IdentityVerification,
  IdentityVerificationRequest,
  NotificationPreferences,
  PrivacySettings,
  ProfileSetupPayload,
  ReportPayload,
  Session,
  SupportTicket,
  Upload,
  UploadSignature,
  User,
  UserSummary,
} from '@/types'

export interface PublicProfile extends UserSummary {
  city: string | null
  interests: string[]
  joinedAt: string
  eventsCount: number
}

export interface PublicConfig {
  features: Record<string, boolean>
  payments: { enabledProviders: string[]; serviceFeePercent: number }
  support: { email: string; phone: string; whatsapp: string }
  /** Proposed: the visitor's country from the request IP (e.g. CF-IPCountry), ISO 3166-1 alpha-2. Optional. */
  geo?: { countryCode: string | null }
  app: { minAndroidVersion: string; minIosVersion: string; forceUpdate: boolean; androidStoreUrl: string; iosStoreUrl: string }
}

export const accountApi = {
  me: () => request.get<User>('/me'),
  update: (payload: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'dateOfBirth' | 'city' | 'countryCode' | 'avatarUrl' | 'username' | 'locale'>>) =>
    request.patch<User>('/me', payload),
  profileSetup: (payload: ProfileSetupPayload) => request.post<User, ProfileSetupPayload>('/me/profile-setup', payload),
  interests: () => request.get<Array<{ label: string; slug: string }>>('/interests', undefined, { skipAuth: true }),
  updateInterests: (interests: string[]) => request.put<User>('/me/interests', { interests }),
  changePassword: (payload: ChangePasswordPayload) => request.put<{ updated: boolean }, ChangePasswordPayload>('/me/password', payload),
  privacy: () => request.get<PrivacySettings>('/me/privacy'),
  updatePrivacy: (payload: Partial<PrivacySettings>) => request.put<PrivacySettings>('/me/privacy', payload),
  notificationPreferences: () => request.get<NotificationPreferences>('/me/notification-preferences'),
  updateNotificationPreferences: (payload: Partial<NotificationPreferences>) => request.put<NotificationPreferences>('/me/notification-preferences', payload),
  sessions: () => request.get<Session[]>('/me/sessions'),
  revokeSession: (id: string) => request.del(`/me/sessions/${id}`),
  revokeOtherSessions: () => request.del('/me/sessions'),
  identityVerification: () => request.get<IdentityVerification | null>('/me/identity-verification'),
  submitIdentity: (payload: IdentityVerificationRequest) => request.post<IdentityVerification, IdentityVerificationRequest>('/me/identity-verification', payload),
  deletionRequest: () => request.get<AccountDeletionRequest | null>('/me/deletion-request'),
  requestDeletion: (payload: { reason: string; password: string }) => request.post<AccountDeletionRequest>('/me/deletion-request', payload),
  cancelDeletion: () => request.del('/me/deletion-request'),
  upload: (file: File, purpose: string, onProgress?: (p: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('purpose', purpose)
    return request.upload<Upload>('/uploads', fd, { onProgress })
  },
  uploadSignature: (purpose: string) => request.post<UploadSignature>('/uploads/sign', { purpose }),
  publicProfile: (id: string) => request.get<PublicProfile>(`/users/${id}`),
  /** Live banners for a placement, highest priority first (render in the order received). Public and cacheable for 5 minutes. */
  banners: (placement: BannerPlacement, audience?: PublicBanner['audience']) => request.get<PublicBanner[]>('/banners', { placement, audience }, { skipAuth: true }),
  page: (slug: CmsPage['slug']) => request.get<CmsPage>(`/pages/${slug}`, undefined, { skipAuth: true }),
  createSupportTicket: (payload: { subject: string; category: string; message: string }) => request.post<SupportTicket>('/support/tickets', payload),
  supportTickets: () => request.get<SupportTicket[]>('/support/tickets'),
  report: (payload: ReportPayload) => request.post<{ id: string; status: string }, ReportPayload>('/reports', payload),
  config: () => request.get<PublicConfig>('/config', undefined, { skipAuth: true }),
  registerDevice: (payload: { token: string; platform: 'web' }) => request.post<{ registered: boolean }>('/me/devices', payload),
}
