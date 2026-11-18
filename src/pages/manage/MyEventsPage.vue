<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounce } from '@vueuse/core'
import { Info, Search, X, Check } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { useAsync } from '@/composables/useAsync'
import { useQueryParams } from '@/composables/useQueryParams'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'

const ui = useUiStore()
const params = useQueryParams({ tab: 'created', status: 'all' })
const searchOpen = ref(false)
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => organizerApi.list({ tab: params.value.tab as 'created' | 'team', status: params.value.status, search: debounced.value || undefined, page }), { watch: [params, debounced] })
const { data: invites, refresh: refreshInvites } = useAsync(() => organizerApi.collaborations())
const pendingInvites = computed(() => (invites.value ?? []).filter((i) => i.status === 'pending'))
watch(() => params.value.tab, () => (params.value = { ...params.value, status: 'all' }))

async function respond(id: string, status: 'accepted' | 'declined') {
  await organizerApi.respondCollaboration(id, status)
  ui.success(status === 'accepted' ? 'You joined the event team' : 'Invite declined')
  void refreshInvites()
  void list.refresh()
}
const statusTabs = computed(() => params.value.tab === 'created'
  ? [{ key: 'all', label: 'All events' }, { key: 'live', label: 'Live' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'draft', label: 'Draft' }]
  : [{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'completed', label: 'Completed' }])
</script>

<template>
  <div class="container-app pb-10 pt-12">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-3xl md:text-4xl">My Events</h1>
      <div class="flex items-center gap-3">
        <div v-if="searchOpen" class="relative"><input v-model="search" type="search" placeholder="Search your events" class="field h-11 w-56 rounded-full pr-9" aria-label="Search events" /><button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" aria-label="Close search" @click="searchOpen = false; search = ''"><X class="h-4 w-4" /></button></div>
        <button v-else type="button" class="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200" aria-label="Search events" @click="searchOpen = true"><Search class="h-5 w-5" /></button>
        <UiButton size="lg" :to="{ name: 'manage.create' }">Create Event</UiButton>
      </div>
    </div>

    <UiTabs class="mt-8" variant="stretch" :model-value="params.tab" :tabs="[{ key: 'created', label: 'Created' }, { key: 'team', label: 'Team', count: pendingInvites.length || undefined }]" @update:model-value="params = { ...params, tab: $event }" />
    <p v-if="params.tab === 'team'" class="mt-3 flex items-center gap-1.5 text-xs text-ink-500"><Info class="h-3.5 w-3.5" />Events you help manage as a manager, vendor or collaborator.</p>

    <div v-if="params.tab === 'team' && pendingInvites.length" class="mt-6 space-y-2">
      <div v-for="inv in pendingInvites" :key="inv.id" class="card flex items-center gap-3 p-3">
        <img :src="inv.event.coverUrl" alt="" class="h-12 w-12 rounded-lg object-cover" />
        <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ inv.event.title }}</p><p class="flex items-center gap-1 text-xs text-ink-500"><UiAvatar :src="inv.event.organizer.avatarUrl" :name="inv.event.organizer.displayName" size="xs" />{{ inv.event.organizer.displayName }} invited you · {{ formatDate(inv.invitedAt) }}</p></div>
        <UiButton size="sm" @click="respond(inv.id, 'accepted')"><Check class="h-4 w-4" />Accept</UiButton><UiButton size="sm" variant="outline" @click="respond(inv.id, 'declined')">Decline</UiButton>
      </div>
    </div>

    <UiTabs class="mt-6" variant="pill" :model-value="params.status" :tabs="statusTabs" @update:model-value="params = { ...params, status: $event }" />
    <div class="mt-6">
      <ErrorState v-if="list.error.value" :error="list.error.value" @retry="list.refresh()" />
      <EventGrid v-else :events="list.items.value" :loading="list.loading.value" variant="manage" :columns="3" :skeleton-count="6" :empty-title="params.tab === 'team' ? 'No team events' : 'No events yet'" :empty-description="params.tab === 'team' ? 'When an organizer adds you as a manager or vendor, the event appears here.' : 'Create your first event to start selling tickets.'">
        <template #empty-action><UiButton v-if="params.tab === 'created'" :to="{ name: 'manage.create' }">Create Event</UiButton></template>
      </EventGrid>
      <div v-if="list.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
  </div>
</template>
