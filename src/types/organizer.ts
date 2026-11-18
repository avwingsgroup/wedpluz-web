import type { Id, ISODateString } from './api'
import type { EventSummary } from './event'
import type { UserSummary } from './user'

export type CollaboratorAccess = 'full' | 'partial'
export type CollaboratorStatus = 'pending' | 'accepted' | 'declined' | 'removed'

export type ManagerPermission =
  | 'manage_guests'
  | 'scan_tickets'
  | 'manage_tasks'
  | 'manage_vendors'
  | 'manage_assets'
  | 'view_revenue'
  | 'edit_event'
  | 'manage_community'

export interface EventManager {
  id: Id
  user: UserSummary
  access: CollaboratorAccess
  permissions: ManagerPermission[]
  status: CollaboratorStatus
  invitedAt: ISODateString
  respondedAt: ISODateString | null
}

export interface EventVendorAssignment {
  id: Id
  vendor: { id: Id; businessName: string; category: string; avatarUrl: string | null; userId: Id }
  role: string | null
  status: CollaboratorStatus
  invitedAt: ISODateString
}

export interface EventCollaboration {
  id: Id
  event: Pick<EventSummary, 'id' | 'title' | 'coverUrl' | 'startsAt' | 'organizer'>
  status: CollaboratorStatus
  invitedAt: ISODateString
}

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface EventTask {
  id: Id
  eventId: Id
  title: string
  description: string | null
  status: TaskStatus
  dueAt: ISODateString | null
  assignees: UserSummary[]
  attachments: Array<{ id: Id; name: string; url: string }>
  createdBy: UserSummary
  createdAt: ISODateString
  completedAt: ISODateString | null
  isOverdue: boolean
}

export interface TaskPayload {
  title: string
  description?: string | null
  status?: TaskStatus
  dueAt?: string | null
  assigneeIds?: Id[]
  attachmentUploadIds?: string[]
}

export interface ActivityLogEntry {
  id: Id
  actor: UserSummary
  actorRole: 'organizer' | 'manager' | 'vendor' | 'system'
  action: string
  description: string
  createdAt: ISODateString
}

export interface PromoterEnrollment {
  id: Id
  event: EventSummary
  commissionPercent: number
  shareLink: string
  shareCode: string
  signups: number
  targetSignups: number | null
  earnings: number
  withdrawable: boolean
  status: 'active' | 'past' | 'paused'
  joinedAt: ISODateString
}

export interface PromoterBoardEntry {
  rank: number
  user: UserSummary
  signups: number
  earnings: number
}

export interface ManageEventSummary extends EventSummary {
  myRole: 'organizer' | 'manager' | 'vendor'
  stats: { registered: number; checkedIn: number; capacity: number | null; pendingRequests: number; revenue: number; ticketsSold: number }
  collaboratorsCount: number
  communityId: Id | null
}

export interface OrganizerAnalytics {
  revenue: number
  ticketsSold: number
  checkedIn: number
  capacity: number | null
  byTicketType: Array<{ ticketTypeId: Id; name: string; price: number; sold: number; quantity: number; revenue: number; salesEndAt: string | null }>
  salesByDay: Array<{ date: string; tickets: number; revenue: number }>
  recentBuyers: Array<{ user: UserSummary; ticketTypeName: string; purchasedAt: ISODateString }>
}

export interface EventSettingsPayload {
  status?: 'completed' | 'cancelled'
  cancellationReason?: string
  communityEnabled?: boolean
}
