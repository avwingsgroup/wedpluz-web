<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDebounce } from '@vueuse/core'
import { Calendar, MapPin, Search, Ticket as TicketIcon } from 'lucide-vue-next'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import TicketDetailModal from '@/modules/tickets/TicketDetailModal.vue'
import { ticketingApi } from '@/services/api/ticketing.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { formatDateRange, formatMoney } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const tab = ref<'upcoming' | 'past' | 'cancelled'>((route.query.tab as 'upcoming') || 'upcoming')
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => ticketingApi.myTickets({ tab: tab.value, search: debounced.value || undefined, page }), { watch: [tab, debounced] })

const openId = computed(() => (route.params.id ? String(route.params.id) : null))
function open(id: string) {
  router.push({ name: 'ticket', params: { id }, query: route.query })
}
function close() {
  router.push({ name: 'tickets', query: { tab: tab.value } })
}
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t } }))
// After checkout we land with ?order=… — open the first ticket of that order once loaded.
watch(() => list.items.value, (items) => {
  const order = route.query.order
  if (order && !openId.value) {
    const t = items.find((i) => i.orderId === order)
    if (t) open(t.id)
  }
})
const emptyCopy = computed(() => ({
  upcoming: { title: 'No Tickets', description: 'You haven’t registered for any upcoming events yet' },
  past: { title: 'No past events', description: 'Events you attended will show up here.' },
  cancelled: { title: 'No cancelled tickets', description: 'Tickets you cancel and their refunds will appear here.' },
})[tab.value])
</script>

<template>
  <div class="container-app pb-10">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-3xl md:text-4xl">My Tickets</h1>
      <label class="relative w-full sm:w-80"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search..." class="field rounded-xl pl-10" aria-label="Search tickets" /></label>
    </div>
    <UiTabs v-model="tab" variant="stretch" class="mt-8" :tabs="[{ key: 'upcoming', label: 'Upcoming events' }, { key: 'past', label: 'Past events' }, { key: 'cancelled', label: 'Cancelled' }]" />

    <div class="mt-8">
      <ErrorState v-if="list.error.value" :error="list.error.value" @retry="list.refresh()" />
      <div v-else-if="list.loading.value" class="grid gap-4 md:grid-cols-2"><UiSkeleton v-for="i in 4" :key="i" class="h-32 rounded-2xl" /></div>
      <UiEmptyState v-else-if="list.isEmpty.value" v-bind="emptyCopy" illustration="tickets">
        <UiButton v-if="tab === 'upcoming'" :to="{ name: 'events' }">Discover events</UiButton>
      </UiEmptyState>
      <div v-else class="grid gap-4 md:grid-cols-2">
        <button v-for="t in list.items.value" :key="t.id" type="button" class="card card-hover flex gap-4 p-3 text-left" @click="open(t.id)">
          <img :src="t.event.coverUrl" :alt="t.event.title" loading="lazy" class="h-28 w-28 shrink-0 rounded-xl object-cover" />
          <div class="min-w-0 flex-1 py-1">
            <div class="flex items-start justify-between gap-2">
              <h3 class="line-clamp-2 font-semibold">{{ t.event.title }}</h3>
              <UiBadge v-if="t.status === 'cancelled'" :status="t.refund?.status === 'completed' ? 'refunded' : t.refund ? 'refund_processing' : 'cancelled'" size="sm" />
              <UiBadge v-else-if="t.checkedInCount" tone="success" size="sm">Checked in</UiBadge>
            </div>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-ink-500"><Calendar class="h-3.5 w-3.5" />{{ formatDateRange(t.event.startsAt, t.event.endsAt) }}</p>
            <p v-if="t.event.city" class="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500"><MapPin class="h-3.5 w-3.5" />{{ t.event.city }}</p>
            <p class="mt-2 flex items-center gap-1.5 text-sm"><TicketIcon class="h-3.5 w-3.5 text-brand-600" />{{ t.ticketCount }} ticket{{ t.ticketCount > 1 ? 's' : '' }} · {{ t.orderTotal === 0 ? 'Free' : formatMoney(t.orderTotal, t.currency) }}</p>
          </div>
        </button>
      </div>
      <div v-if="list.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
    <TicketDetailModal :ticket-id="openId" @close="close" @updated="list.refresh()" />
  </div>
</template>
