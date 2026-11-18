<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDebounce } from '@vueuse/core'
import { ChevronDown, ChevronRight, Clock, Download, Search } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import RequestsDrawer from '@/modules/organizer/RequestsDrawer.vue'
import { useManagedEvent } from '@/modules/organizer/useManagedEvent'
import { organizerApi } from '@/services/api/organizer.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { downloadCsv } from '@/utils/files'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { GuestListEntry } from '@/types'

const { event, refresh } = useManagedEvent()
const filter = ref<'pending' | 'approved' | 'attendees' | 'checked_in' | 'not_checked_in'>('attendees')
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => organizerApi.guests(event.value!.id, { filter: filter.value, search: debounced.value || undefined, page }), { watch: [filter, debounced] })
const requestsOpen = ref(false)
const detail = ref<GuestListEntry | null>(null)
const stats = computed(() => event.value?.stats)
const attendeeLabel = computed(() => ({ attendees: 'Attendees', checked_in: 'Checked in', not_checked_in: 'Not checked in' } as Record<string, string>)[filter.value] ?? 'Attendees')
function exportCsv() {
  downloadCsv(list.items.value.map((g) => ({ name: g.user.displayName, ticket: g.ticketTypeName, status: g.ticketStatus, checkedInAt: g.checkedInAt ?? '', payment: g.paymentStatus })), `${event.value?.slug ?? 'guests'}-guests.csv`)
}
</script>

<template>
  <div v-if="event && stats">
    <div class="grid overflow-hidden rounded-2xl bg-[#a8135f] text-white sm:grid-cols-2">
      <div class="border-white/20 p-5 sm:border-r"><p class="text-sm">Total registered</p><p class="mt-2 text-2xl font-bold">{{ stats.registered.toLocaleString() }}</p><p class="mt-1 text-sm">{{ stats.capacity ? `of ${stats.capacity.toLocaleString()} slots` : 'No capacity limit' }}</p></div>
      <div class="p-5"><p class="text-sm">Checked in</p><p class="mt-2 text-2xl font-bold">{{ stats.checkedIn.toLocaleString() }}</p><p class="mt-1 text-sm"><strong>{{ Math.max(0, stats.registered - stats.checkedIn).toLocaleString() }}</strong> Remaining</p></div>
    </div>
    <button v-if="event.approvalRequired" type="button" class="card mt-5 flex w-full items-center gap-3 p-4 text-left" @click="requestsOpen = true"><Clock class="h-5 w-5 text-ink-500" /><span class="text-ink-500">Pending · Awaiting approval</span><span class="rounded-full bg-pink-50 px-2.5 py-0.5 text-sm font-semibold text-brand-600">{{ stats.pendingRequests }}</span><ChevronRight class="ml-auto h-4 w-4" /></button>

    <div class="mt-6 flex items-center justify-between"><h2 class="font-medium">Guest lists</h2><UiButton variant="ghost" size="sm" :disabled="!list.items.value.length" @click="exportCsv"><Download class="h-4 w-4" />Export CSV</UiButton></div>
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="event.approvalRequired" type="button" :class="cn('pill-tab', filter === 'pending' && 'pill-tab-active')" @click="filter = 'pending'">Pending</button>
        <button v-if="event.approvalRequired" type="button" :class="cn('pill-tab', filter === 'approved' && 'pill-tab-active')" @click="filter = 'approved'">Approved</button>
        <UiDropdown align="left" width="w-48">
          <template #trigger><button type="button" :class="cn('pill-tab inline-flex items-center gap-2', ['attendees', 'checked_in', 'not_checked_in'].includes(filter) && 'pill-tab-active')">{{ attendeeLabel }}<ChevronDown class="h-4 w-4" /></button></template>
          <template #default="{ close }"><button v-for="o in [['attendees', 'All attendees'], ['checked_in', 'Checked in'], ['not_checked_in', 'Not checked in']]" :key="o[0]" type="button" class="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-ink-50" @click="filter = o[0] as typeof filter; close()">{{ o[1] }}</button></template>
        </UiDropdown>
      </div>
      <label class="relative w-full sm:w-72"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search ..." class="field rounded-full pl-10" aria-label="Search guests" /></label>
    </div>
    <div class="card mt-6 overflow-hidden">
      <template v-if="list.loading.value"><div v-for="i in 6" :key="i" class="px-4"><UiSkeleton variant="row" /></div></template>
      <UiEmptyState v-else-if="list.isEmpty.value" title="No guests here" description="Guests appear once they register or request to attend." compact illustration="tickets" />
      <button v-for="g in list.items.value" v-else :key="g.id" type="button" class="flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-ink-50" @click="detail = g">
        <UiAvatar :src="g.user.avatarUrl" :name="g.user.displayName" />
        <div class="min-w-0 flex-1"><p class="truncate">{{ g.user.displayName }}</p><p class="text-sm text-ink-500">{{ g.ticketTypeName }}<template v-if="g.subEventTitle"> · {{ g.subEventTitle }}</template></p></div>
        <span v-if="g.paymentStatus === 'unpaid'" class="rounded-full bg-warning-50 px-2.5 py-1 text-xs text-amber-700">Unpaid</span>
        <span :class="cn('rounded-full px-2.5 py-1 text-sm', g.ticketStatus === 'checked_in' ? 'bg-success-50 text-success-600' : 'bg-ink-50 text-ink-700')">{{ g.ticketStatus === 'checked_in' ? 'Checked in' : 'Not Checked in' }}</span>
      </button>
      <div v-if="list.hasMore.value" class="p-3"><UiButton variant="secondary" block :loading="list.loadingMore.value" @click="list.loadMore()">Load More</UiButton></div>
    </div>
    <RequestsDrawer v-model:open="requestsOpen" :event-id="event.id" @changed="refresh(); list.refresh()" />
    <UiModal :open="!!detail" title="Guest details" size="sm" @update:open="detail = null">
      <div v-if="detail" class="space-y-4">
        <div class="flex items-center gap-3"><UiAvatar :src="detail.user.avatarUrl" :name="detail.user.displayName" size="lg" /><div><p class="font-semibold">{{ detail.user.displayName }}</p><p class="text-sm text-ink-500">{{ detail.ticketTypeName }}</p></div></div>
        <dl class="divide-y divide-ink-100 text-sm">
          <div class="flex justify-between py-2"><dt class="text-ink-500">Request</dt><dd><UiBadge :status="detail.requestStatus ?? 'approved'" size="sm" /></dd></div>
          <div class="flex justify-between py-2"><dt class="text-ink-500">Payment</dt><dd><UiBadge :status="detail.paymentStatus === 'unpaid' ? 'pending' : 'paid'" size="sm">{{ detail.paymentStatus }}</UiBadge></dd></div>
          <div class="flex justify-between py-2"><dt class="text-ink-500">Check-in</dt><dd>{{ detail.checkedInAt ? formatDateTime(detail.checkedInAt) : 'Not checked in' }}</dd></div>
          <div v-if="detail.subEventTitle" class="flex justify-between py-2"><dt class="text-ink-500">Sub-event</dt><dd>{{ detail.subEventTitle }}</dd></div>
        </dl>
      </div>
    </UiModal>
  </div>
</template>
