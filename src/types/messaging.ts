import type { Id, ISODateString } from './api'
import type { EventSummary } from './event'
import type { UserSummary } from './user'

export type ConversationType = 'direct' | 'community' | 'request'
export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'file' | 'event_promo' | 'system'

export interface MessageAttachment {
  id: Id
  type: 'image' | 'video' | 'audio' | 'file'
  url: string
  thumbnailUrl: string | null
  name: string | null
  sizeBytes: number | null
  durationSeconds: number | null
  waveform?: number[]
}

export interface MessageReaction {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface Message {
  id: Id
  conversationId: Id
  sender: UserSummary
  type: MessageType
  body: string | null
  attachments: MessageAttachment[]
  replyTo: Pick<Message, 'id' | 'sender' | 'body' | 'type'> | null
  reactions: MessageReaction[]
  event: Pick<EventSummary, 'id' | 'slug' | 'title' | 'coverUrl' | 'startsAt' | 'minPrice' | 'isFree' | 'currency'> | null
  isPinned: boolean
  isStarred: boolean
  isMine: boolean
  deletedBy: 'none' | 'sender' | 'admin'
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: ISODateString
  clientId?: string
}

export interface Conversation {
  id: Id
  type: ConversationType
  title: string
  avatarUrl: string | null
  participants: UserSummary[]
  communityId: Id | null
  lastMessage: Pick<Message, 'id' | 'body' | 'type' | 'sender' | 'createdAt'> | null
  unreadCount: number
  isPinned: boolean
  isMuted: boolean
  isArchived: boolean
  isRequest: boolean
  updatedAt: ISODateString
}

export interface SendMessagePayload {
  clientId: string
  type: MessageType
  body?: string
  attachmentUploadIds?: string[]
  replyToId?: Id | null
  eventId?: Id | null
}

export interface MessageFilters {
  tab?: 'all' | 'unread' | 'communities' | 'requests'
  search?: string
  cursor?: string | null
}

export interface TypingEvent {
  conversationId: Id
  user: UserSummary
  isTyping: boolean
}
