import { defineStore } from 'pinia'
import { ref } from 'vue'
import { messagingApi } from '@/services/api/messaging.api'
import { notificationsApi } from '@/services/api/notifications.api'
import { realtime } from '@/composables/useRealtime'

/** Realtime events that change a badge count (see docs/backend-handoff/realtime-events.md). */
const BADGE_EVENTS = ['notification.created', 'notification.read', 'message.created', 'conversation.read'] as const

/** Lightweight badge counters polled on an interval and refreshed by realtime events. */
export const useBadgeStore = defineStore('badges', () => {
  const unreadNotifications = ref(0)
  const pendingRequests = ref(0)
  const unreadMessages = ref(0)
  let timer: number | null = null
  let unsubscribe: Array<() => void> = []

  async function refresh() {
    try {
      const [n, m] = await Promise.all([notificationsApi.unreadCount(), messagingApi.unreadCount()])
      unreadNotifications.value = n.count
      pendingRequests.value = n.requests
      unreadMessages.value = m.count
    } catch {
      /* non-critical */
    }
  }

  function start(intervalMs = 60_000) {
    stop()
    void refresh()
    timer = window.setInterval(() => void refresh(), intervalMs)
    // Polling is the fallback; when a socket is connected these events refresh counts immediately.
    unsubscribe = BADGE_EVENTS.map((e) => realtime.subscribe(e, () => void refresh()))
  }
  function stop() {
    if (timer) window.clearInterval(timer)
    timer = null
    unsubscribe.forEach((off) => off())
    unsubscribe = []
    unreadNotifications.value = 0
    pendingRequests.value = 0
    unreadMessages.value = 0
  }

  return { unreadNotifications, pendingRequests, unreadMessages, refresh, start, stop }
})
