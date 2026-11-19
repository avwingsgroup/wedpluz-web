import type { Id, ISODateString } from './api'

export type UserRole = 'user' | 'vendor' | 'organizer' | 'admin'
export type UserStatus = 'active' | 'suspended' | 'deactivated' | 'pending_deletion'
export type IdentityStatus = 'unverified' | 'pending' | 'verified' | 'failed'
export type PlanTier = 'free' | 'basic' | 'premium' | 'premium_plus'
export type Audience = 'individuals' | 'businesses'

export interface UserSummary {
  id: Id
  displayName: string
  /** Null until the user completes profile setup. */
  username?: string | null
  avatarUrl: string | null
  isVerified?: boolean
  isVendor?: boolean
}

export interface User extends UserSummary {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  dateOfBirth: ISODateString | null
  emailVerifiedAt: ISODateString | null
  phoneVerifiedAt: ISODateString | null
  identityStatus: IdentityStatus
  interests: string[]
  roles: UserRole[]
  status: UserStatus
  plan: PlanTier
  locale: string
  city: string | null
  countryCode: string | null
  businessProfileId: Id | null
  walletEnabled: boolean
  createdAt: ISODateString
  lastSeenAt?: ISODateString | null
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'connections' | 'private'
  showEmail: boolean
  showPhone: boolean
  allowMessageRequests: boolean
  allowTagging: boolean
  discoverableBySearch: boolean
}

export interface NotificationPreferences {
  channels: {
    push: boolean
    email: boolean
    sms: boolean
    whatsapp: boolean
    inApp: boolean
  }
  topics: {
    eventReminders: boolean
    ticketUpdates: boolean
    messages: boolean
    communityActivity: boolean
    promotions: boolean
    collaboration: boolean
    walletActivity: boolean
  }
}

export interface Session {
  id: Id
  device: string
  browser: string
  ip: string
  location: string | null
  lastActiveAt: ISODateString
  isCurrent: boolean
}

export interface IdentityVerificationRequest {
  idType: 'nin' | 'passport' | 'drivers_license' | 'resident_card'
  idNumber: string
  selfieUploadId: Id
}

export interface IdentityVerification {
  id: Id
  status: IdentityStatus
  idType: IdentityVerificationRequest['idType']
  submittedAt: ISODateString
  reviewedAt: ISODateString | null
  failureReason: string | null
  provider: string
}

export interface AccountDeletionRequest {
  id: Id
  reason: string
  status: 'pending' | 'cancelled' | 'completed'
  requestedAt: ISODateString
  scheduledFor: ISODateString
}
