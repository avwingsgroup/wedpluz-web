import type { Id, ISODateString } from './api'
import type { UserSummary } from './user'

export type NotificationType =
  | 'manager_invite_accepted'
  | 'manager_invite'
  | 'vendor_invite'
  | 'collaboration_invite'
  | 'collaboration_declined'
  | 'event_request_approved'
  | 'event_request_declined'
  | 'event_request_received'
  | 'task_assigned'
  | 'ticket_purchased'
  | 'ticket_cancelled'
  | 'refund_updated'
  | 'event_reminder'
  | 'event_updated'
  | 'event_cancelled'
  | 'message_request'
  | 'community_invite'
  | 'promotion_earning'
  | 'wallet_credit'
  | 'wallet_debit'
  | 'identity_verified'
  | 'identity_failed'
  | 'system'

export type NotificationAction = 'register' | 'accept_decline' | 'view' | 'none'

export interface AppNotification {
  id: Id
  type: NotificationType
  actor: UserSummary | null
  title: string
  body: string
  /** Pre-split segments so the UI can bold entity names exactly like the designs. */
  segments: Array<{ text: string; emphasis?: boolean }>
  action: NotificationAction
  actionState: 'pending' | 'accepted' | 'declined' | 'done' | null
  data: Record<string, string>
  isRequest: boolean
  readAt: ISODateString | null
  createdAt: ISODateString
  link: string | null
}

export interface NotificationFilters {
  tab?: 'all' | 'requests'
  search?: string
  cursor?: string | null
}
