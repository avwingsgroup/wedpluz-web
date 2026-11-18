<script setup lang="ts">
import { ref, watch } from 'vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import type { NotificationPreferences } from '@/types'

const ui = useUiStore()
const { data, loading } = useAsync(() => accountApi.notificationPreferences())
const local = ref<NotificationPreferences | null>(null)
watch(data, (d) => (local.value = d ? structuredClone(d) : null))
const channels: Array<[keyof NotificationPreferences['channels'], string, string]> = [['push', 'Push notifications', 'On this browser and your phone'], ['email', 'Email', 'Receipts, tickets and important updates'], ['sms', 'SMS', 'Time-sensitive alerts only'], ['whatsapp', 'WhatsApp', 'Event reminders and ticket delivery'], ['inApp', 'In-app', 'The bell icon in Wedpluz']]
const topics: Array<[keyof NotificationPreferences['topics'], string]> = [['eventReminders', 'Event reminders'], ['ticketUpdates', 'Ticket & refund updates'], ['messages', 'New messages'], ['communityActivity', 'Community activity'], ['collaboration', 'Collaboration & team invites'], ['walletActivity', 'Wallet activity'], ['promotions', 'Promotions & recommendations']]
async function set(group: 'channels' | 'topics', key: string, value: boolean) {
  if (!local.value) return
  ;(local.value[group] as Record<string, boolean>)[key] = value
  try {
    await accountApi.updateNotificationPreferences({ [group]: local.value[group] } as Partial<NotificationPreferences>)
    if (group === 'channels' && key === 'push' && value && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  } catch (e) {
    ;(local.value[group] as Record<string, boolean>)[key] = !value
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <h2 class="text-3xl">Notifications</h2>
    <div v-if="loading || !local" class="mt-6 space-y-3"><UiSkeleton v-for="i in 6" :key="i" class="h-14 rounded-xl" /></div>
    <template v-else>
      <h3 class="mt-8 text-sm text-ink-500">Channels</h3>
      <div class="card mt-3 divide-y divide-ink-100"><div v-for="[k, label, desc] in channels" :key="k" class="p-5"><UiToggle :model-value="local.channels[k]" :label="label" :description="desc" @update:model-value="set('channels', k, $event)" /></div></div>
      <h3 class="mt-8 text-sm text-ink-500">What to notify me about</h3>
      <div class="card mt-3 divide-y divide-ink-100"><div v-for="[k, label] in topics" :key="k" class="p-5"><UiToggle :model-value="local.topics[k]" :label="label" @update:model-value="set('topics', k, $event)" /></div></div>
      <p class="mt-4 text-xs text-ink-500">Security and payment notices are always sent.</p>
    </template>
  </div>
</template>
