import type { Id, ISODateString } from './api'
import type { EventSummary } from './event'
import type { UserSummary } from './user'

export type CommunityRole = 'owner' | 'co_admin' | 'member' | 'none'

export interface CommunityPermissions {
  membersCanSendMessages: boolean
  membersCanPostStatus: boolean
  membersCanInvite: boolean
  membersCanGoLive: boolean
  requireApprovalToJoin: boolean
}

export interface Community {
  id: Id
  eventId: Id | null
  event: Pick<EventSummary, 'id' | 'slug' | 'title' | 'coverUrl' | 'startsAt' | 'isPromoted'> | null
  name: string
  description: string | null
  avatarUrl: string | null
  membersCount: number
  onlineCount: number
  myRole: CommunityRole
  permissions: CommunityPermissions
  inviteLink: string
  isArchived: boolean
  isMuted: boolean
  isPinned: boolean
  createdAt: ISODateString
}

export interface CommunityMember {
  id: Id
  user: UserSummary
  role: CommunityRole
  joinedAt: ISODateString
  isVendor: boolean
  isOnline: boolean
}

export interface StatusPost {
  id: Id
  communityId: Id
  author: UserSummary
  mediaUrl: string
  mediaType: 'image' | 'video'
  caption: string | null
  likesCount: number
  viewsCount: number
  isLiked: boolean
  viewedByMe: boolean
  expiresAt: ISODateString
  createdAt: ISODateString
}

export interface LiveSession {
  id: Id
  communityId: Id
  host: UserSummary
  title: string | null
  status: 'scheduled' | 'live' | 'ended'
  viewersCount: number
  startedAt: ISODateString | null
  endedAt: ISODateString | null
  joinToken: string | null
  audioEnabled: boolean
  videoEnabled: boolean
}

export interface LiveRequest {
  id: Id
  user: UserSummary
  status: 'pending' | 'accepted' | 'declined'
  createdAt: ISODateString
}

export type ReportTargetType = 'user' | 'message' | 'community' | 'event' | 'vendor' | 'work' | 'status' | 'review'

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'nudity'
  | 'violence'
  | 'scam_or_fraud'
  | 'impersonation'
  | 'false_information'
  | 'intellectual_property'
  | 'other'

export interface ReportPayload {
  targetType: ReportTargetType
  targetId: Id
  reason: ReportReason
  details?: string
  blockUser?: boolean
}

export interface CommunityCreatePayload {
  eventId: Id | null
  name: string
  description: string | null
  avatarUploadId: string | null
  permissions: Partial<CommunityPermissions>
}
