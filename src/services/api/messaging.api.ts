import { request } from '@/services/http'
import type { Community, Conversation, Message, MessageAttachment, MessageFilters, SendMessagePayload, UserSummary } from '@/types'

export interface ConversationDetail extends Conversation {
  community: Community | null
  pinnedMessages: Message[]
}

export interface ConversationMediaItem extends MessageAttachment {
  messageId: string
  sender: UserSummary
  createdAt: string
}

export const messagingApi = {
  conversations: (filters: MessageFilters = {}, signal?: AbortSignal) => request.get<{ items: Conversation[]; requestsCount: number }>('/conversations', filters as Record<string, unknown>, { signal }),
  start: (userId: string) => request.post<Conversation>('/conversations', { userId }),
  conversation: (id: string) => request.get<ConversationDetail>(`/conversations/${id}`),
  messages: (id: string, cursor?: string | null) => request.getCursor<Message>(`/conversations/${id}/messages`, { cursor }),
  send: (id: string, payload: SendMessagePayload) => request.post<Message, SendMessagePayload>(`/conversations/${id}/messages`, payload),
  deleteMessage: (id: string) => request.del<Message>(`/messages/${id}`),
  react: (id: string, emoji: string) => request.post<Message>(`/messages/${id}/reactions`, { emoji }),
  star: (id: string) => request.post<Message>(`/messages/${id}/star`),
  pin: (id: string) => request.post<Message>(`/messages/${id}/pin`),
  setFlags: (id: string, payload: { isPinned?: boolean; isMuted?: boolean; isArchived?: boolean }) => request.patch<Conversation>(`/conversations/${id}`, payload),
  remove: (id: string) => request.del(`/conversations/${id}`),
  markRead: (id: string) => request.post<void>(`/conversations/${id}/read`),
  respondRequest: (id: string, action: 'accept' | 'decline') => request.patch<Conversation>(`/conversations/${id}/request`, { action }),
  media: (id: string) => request.get<ConversationMediaItem[]>(`/conversations/${id}/media`),
  unreadCount: () => request.get<{ count: number }>('/messages/unread-count'),
}
