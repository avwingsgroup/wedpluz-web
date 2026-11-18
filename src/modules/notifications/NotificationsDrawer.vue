<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, UserRound } from 'lucide-vue-next'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { useDebounceFn } from '@vueuse/core'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { notificationsApi } from '@/services/api/notifications.api'
import { useBadgeStore } from '@/stores/notifications.store'
import { useUiStore } from '@/stores/ui.store'
import { useCheckoutStore } from '@/stores/checkout.store'
import { eventsApi } from '@/services/api/events.api'
import { formatDateTime } from '@/utils/format'
import type { AppNotification } from '@/types'
import { cn } from '@/utils/cn'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean] }>()
const router = useRouter()
const badges = useBadgeStore()
const ui = useUiStore()
const checkout = useCheckoutStore()

const tab = ref<'all' | 'requests'>('all')
const search = ref('')
const showSearch = ref(false)
const items = ref<AppNotification[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const acting = ref<string | null>(null)

async function load(reset = true) {
  if (reset) {
    loading.value = true
    cursor.value = null
  } else loadingMore.value = true
  try {
    const res = await notificationsApi.list({ tab: tab.value, search: search.value || undefined, cursor: reset ? null : cursor.value })
    items.value = reset ? res.data : [...items.value, ...res.data]
    cursor.value = res.meta.nextCursor
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}
const debouncedLoad = useDebounceFn(() => load(true), 250)
watch(() => props.open, (o) => o && load(true))
watch(tab, () => load(true))
watch(search, () => debouncedLoad())

const groups = computed(() => {
  const today: AppNotification[] = []
  const yesterday: AppNotification[] = []
  const earlier: AppNotification[] = []
  for (const n of items.value) {
    const d = parseISO(n.createdAt)
    if (isToday(d)) today.push(n)
    else if (isYesterday(d)) yesterday.push(n)
    else earlier.push(n)
  }
  return [{ label: 'Today', items: today }, { label: 'Yesterday', items: yesterday }, { label: 'Earlier', items: earlier }].filter((g) => g.items.length)
})

async function markAllRead() {
  await notificationsApi.markAllRead()
  items.value = items.value.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
  void badges.refresh()
}
async function openNotification(n: AppNotification) {
  if (!n.readAt) {
    n.readAt = new Date().toISOString()
    void notificationsApi.markRead(n.id).catch(() => undefined)
    void badges.refresh()
  }
  if (n.link) {
    emit('update:open', false)
    router.push(n.link)
  }
}
async function act(n: AppNotification, action: 'accept' | 'decline' | 'register') {
  acting.value = n.id
  try {
    if (action === 'register' && n.data.slug) {
      const event = await eventsApi.bySlug(n.data.slug)
      await notificationsApi.act(n.id, action)
      emit('update:open', false)
      checkout.begin(event)
      return
    }
    const updated = await notificationsApi.act(n.id, action)
    items.value = items.value.map((x) => (x.id === n.id ? updated : x))
    ui.success(action === 'accept' ? 'Invite accepted' : action === 'decline' ? 'Invite declined' : 'Done')
    void badges.refresh()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    acting.value = null
  }
}
</script>

<template>
  <UiDrawer :open="open" size="sm" :padded="false" @update:open="emit('update:open', $event)">
    <template #header>
      <div class="-mt-2 flex items-center gap-2">
        <h2 class="text-xl font-bold">Notifications</h2>
        <span v-if="badges.unreadNotifications" class="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">{{ badges.unreadNotifications }}</span>
        <button type="button" class="ml-auto flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100" aria-label="Search notifications" @click="showSearch = !showSearch"><Search class="h-5 w-5" /></button>
      </div>
    </template>
    <div class="px-6">
      <input v-if="showSearch" v-model="search" type="search" placeholder="Search notifications…" class="field mb-3 h-10" />
      <div class="flex items-center justify-between">
        <UiTabs v-model="tab" variant="pill" size="sm" :tabs="[{ key: 'all', label: 'All' }, { key: 'requests', label: 'Requests', count: badges.pendingRequests || undefined }]" />
        <button v-if="badges.unreadNotifications" type="button" class="text-xs font-medium text-brand-600 hover:underline" @click="markAllRead">Mark all as read</button>
      </div>
    </div>
    <div class="mt-4 space-y-5 px-6 pb-6">
      <template v-if="loading"><UiSkeleton v-for="i in 5" :key="i" variant="row" /></template>
      <UiEmptyState v-else-if="!items.length" title="You’re all caught up" description="New notifications about your events, tickets and collaborations will show up here." illustration="chat" compact />
      <section v-for="g in groups" v-else :key="g.label">
        <h3 class="mb-2 text-sm font-semibold text-ink-900">{{ g.label }}</h3>
        <ul class="space-y-2">
          <li v-for="n in g.items" :key="n.id" :class="cn('relative rounded-2xl border border-ink-100 bg-white p-4 transition-colors', !n.readAt && 'border-brand-100 bg-brand-50/30')">
            <button type="button" class="flex w-full items-start gap-3 text-left" @click="openNotification(n)">
              <UiAvatar v-if="n.actor" :src="n.actor.avatarUrl" :name="n.actor.displayName" size="md" :square="n.type.startsWith('event') || n.type.startsWith('collaboration')" />
              <span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500"><UserRound class="h-5 w-5" /></span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm text-ink-700"><template v-for="(s, i) in n.segments" :key="i"><strong v-if="s.emphasis" class="font-semibold text-ink-900">{{ s.text }}</strong><template v-else>{{ s.text }}</template></template></span>
                <span class="mt-1 block text-xs text-ink-400">{{ formatDateTime(n.createdAt) }}</span>
              </span>
              <span v-if="!n.readAt" class="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
            </button>
            <div v-if="n.action === 'register' && n.actionState === 'pending'" class="mt-3 pl-13"><UiButton size="sm" rounded="xl" :loading="acting === n.id" @click="act(n, 'register')">Register</UiButton></div>
            <div v-else-if="n.action === 'accept_decline' && n.actionState === 'pending'" class="mt-3 flex gap-2 pl-13">
              <UiButton size="sm" rounded="xl" :loading="acting === n.id" @click="act(n, 'accept')">Accept</UiButton>
              <UiButton size="sm" rounded="xl" variant="outline" :disabled="acting === n.id" @click="act(n, 'decline')">Decline</UiButton>
            </div>
            <p v-else-if="n.actionState && n.actionState !== 'pending'" class="mt-2 pl-13 text-xs capitalize text-ink-500">{{ n.actionState }}</p>
          </li>
        </ul>
      </section>
      <UiButton v-if="cursor" variant="secondary" block :loading="loadingMore" @click="load(false)">Load more</UiButton>
    </div>
  </UiDrawer>
</template>

<style scoped>
.pl-13 {
  padding-left: 3.25rem;
}
</style>
