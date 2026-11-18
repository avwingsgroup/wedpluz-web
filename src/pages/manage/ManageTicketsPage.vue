<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDebounce } from '@vueuse/core'
import { Eye, EyeOff, Search } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiChart from '@/components/ui/UiChart.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useAsync } from '@/composables/useAsync'
import { formatDate, formatMoney } from '@/utils/format'

const route = useRoute()
const id = String(route.params.id)
const { data, loading, error, refresh } = useAsync(() => organizerApi.analytics(id))
const hidden = ref(false)
const search = ref('')
const debounced = useDebounce(search, 200)
const visible = ref(5)
const buyers = computed(() => (data.value?.recentBuyers ?? []).filter((b) => !debounced.value || b.user.displayName.toLowerCase().includes(debounced.value.toLowerCase())))
const chart = computed(() => ({
  xAxis: { type: 'category' as const, data: (data.value?.salesByDay ?? []).map((d) => d.date.slice(5)), axisLine: { lineStyle: { color: '#eaebec' } } },
  yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f4f4f5' } } },
  series: [{ name: 'Tickets', type: 'bar' as const, data: (data.value?.salesByDay ?? []).map((d) => d.tickets), itemStyle: { borderRadius: [6, 6, 0, 0] }, barMaxWidth: 22 }],
}))
</script>

<template>
  <div class="container-app pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.overview', params: { id } }" />
    <h1 class="mt-6 text-3xl md:text-4xl">Tickets</h1>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <div v-else-if="loading || !data" class="mt-8 space-y-4"><UiSkeleton class="h-36 rounded-2xl" /><div class="grid gap-4 sm:grid-cols-2"><UiSkeleton class="h-24 rounded-2xl" /><UiSkeleton class="h-24 rounded-2xl" /></div></div>
    <template v-else>
      <div class="brand-pattern mt-8 rounded-2xl p-6 text-white">
        <p class="flex items-center gap-2 text-sm">Revenue <button type="button" :aria-label="hidden ? 'Show revenue' : 'Hide revenue'" @click="hidden = !hidden"><EyeOff v-if="hidden" class="h-4 w-4" /><Eye v-else class="h-4 w-4" /></button></p>
        <p class="mt-3 text-3xl font-bold">{{ hidden ? '₦•••••' : formatMoney(data.revenue, 'NGN', { compact: true }) }}</p>
        <p class="mt-2 text-sm">across all event types · settled 3 days after the event, minus commission &amp; fees</p>
      </div>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div class="card p-4"><p class="text-sm text-ink-500">Total Sold</p><p class="mt-1 text-xl">{{ data.ticketsSold.toLocaleString() }}</p><p class="text-sm text-ink-500">{{ data.capacity ? `of ${data.capacity.toLocaleString()} slots` : 'No limit' }}</p></div>
        <div class="card p-4"><p class="text-sm text-ink-500">Checked in</p><p class="mt-1 text-xl">{{ data.checkedIn.toLocaleString() }}</p><p class="text-sm text-ink-500"><strong>{{ Math.max(0, data.ticketsSold - data.checkedIn).toLocaleString() }}</strong> Remaining</p></div>
      </div>
      <div class="card mt-6 p-5"><h2 class="mb-2 font-medium">Sales in the last 14 days</h2><UiChart :option="chart" height="220px" /></div>
      <h2 class="mt-8">By Ticket Type</h2>
      <div class="card mt-3 divide-y divide-ink-100">
        <div v-for="t in data.byTicketType" :key="t.ticketTypeId" class="flex items-start justify-between gap-4 p-4">
          <div><p>{{ t.name }}</p><p class="text-sm text-ink-500">Sales end: {{ t.salesEndAt ? formatDate(t.salesEndAt) : '—' }} · {{ t.price === 0 ? 'Free' : formatMoney(t.price) }}</p><div class="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-ink-100"><div class="h-full bg-brand-600" :style="{ width: `${Math.min(100, (t.sold / Math.max(1, t.quantity)) * 100)}%` }" /></div></div>
          <div class="text-right"><p>{{ t.sold.toLocaleString() }}/{{ t.quantity.toLocaleString() }}</p><p class="mt-1 text-sm text-brand-600">{{ formatMoney(t.revenue, 'NGN', { compact: true }) }}</p></div>
        </div>
      </div>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2>Recent Buyers</h2><label class="relative w-full sm:w-72"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search ..." class="field rounded-full pl-10" aria-label="Search buyers" /></label></div>
      <div class="card mt-3 divide-y divide-ink-100">
        <div v-for="b in buyers.slice(0, visible)" :key="b.user.id + b.purchasedAt" class="flex items-center gap-3 px-4 py-3"><UiAvatar :src="b.user.avatarUrl" :name="b.user.displayName" /><div><p class="text-sm">{{ b.user.displayName }}</p><p class="text-sm text-ink-500">{{ b.ticketTypeName }} · {{ formatDate(b.purchasedAt) }}</p></div></div>
        <p v-if="!buyers.length" class="p-6 text-center text-sm text-ink-500">No buyers yet</p>
        <div v-if="buyers.length > visible" class="p-3"><UiButton variant="secondary" block @click="visible += 10">Load more</UiButton></div>
      </div>
    </template>
  </div>
</template>
