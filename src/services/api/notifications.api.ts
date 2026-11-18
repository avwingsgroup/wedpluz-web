import { request } from '@/services/http'
import type { AppNotification, NotificationFilters } from '@/types'

export const notificationsApi = {
  list: (filters: NotificationFilters = {}) => request.getCursor<AppNotification>('/notifications', filters as Record<string, unknown>),
  unreadCount: () => request.get<{ count: number; requests: number }>('/notifications/unread-count'),
  markAllRead: () => request.post<void>('/notifications/read-all'),
  markRead: (id: string) => request.patch<AppNotification | null>(`/notifications/${id}/read`),
  act: (id: string, action: 'accept' | 'decline' | 'register') => request.post<AppNotification>(`/notifications/${id}/actions`, { action }),
  remove: (id: string) => request.del(`/notifications/${id}`),
}
