<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Ban, Send } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiStatCard from '@/components/ui/UiStatCard.vue'
import UiChart from '@/components/ui/UiChart.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatNumber } from '@/utils/format'

const route = useRoute()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: c, loading, error, refresh } = useAsync(() => adminApi.notifications.campaign(id.value), { watch: id })
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—')
const chart = computed(() => c.value && ({ legend: { top: 0, icon: 'circle' }, tooltip: { trigger: 'axis' as const }, xAxis: { type: 'category' as const, data: c.value.deliveryByChannel.map((d) => d.channel) }, yAxis: { type: 'value' as const }, series: [{ name: 'Delivered', type: 'bar' as const, data: c.value.deliveryByChannel.map((d) => d.delivered) }, { name: 'Opened', type: 'bar' as const, data: c.value.deliveryByChannel.map((d) => d.opened) }, { name: 'Failed', type: 'bar' as const, data: c.value.deliveryByChannel.map((d) => d.failed) }] }))
async function send() {
  if (!(await ui.confirm({ title: 'Send campaign now?', confirmLabel: 'Send' }))) return
  await adminApi.notifications.sendCampaign(id.value)
  ui.success('Sending…')
  setTimeout(refresh, 4500)
  void refresh()
}
async function cancel() {
  if (!(await ui.confirm({ title: 'Cancel this campaign?', variant: 'danger', confirmLabel: 'Cancel campaign' }))) return
  await adminApi.notifications.cancelCampaign(id.value)
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !c" page />
    <template v-else>
      <AdminPageHeader :title="c.name" :back="{ name: 'admin.campaigns' }">
        <template #meta><div class="mt-2 flex gap-2"><UiBadge :status="c.status" /><UiBadge v-for="ch in c.channels" :key="ch" tone="brand">{{ ch }}</UiBadge></div></template>
        <Can perm="notifications.send"><template v-if="c.status === 'draft' || c.status === 'scheduled'"><UiButton size="sm" @click="send"><Send class="h-4 w-4" />Send now</UiButton><UiButton size="sm" variant="outline" @click="cancel"><Ban class="h-4 w-4" />Cancel</UiButton></template></Can>
      </AdminPageHeader>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <UiStatCard label="Audience" :value="formatNumber(c.audience.estimatedSize)" />
        <UiStatCard label="Sent" :value="formatNumber(c.stats.sent)" />
        <UiStatCard label="Delivered" :value="formatNumber(c.stats.delivered)" :hint="pct(c.stats.delivered, c.stats.sent)" />
        <UiStatCard label="Opened" :value="formatNumber(c.stats.opened)" :hint="pct(c.stats.opened, c.stats.delivered)" />
        <UiStatCard label="Clicked" :value="formatNumber(c.stats.clicked)" :hint="pct(c.stats.clicked, c.stats.opened)" />
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section class="card p-5"><h3 class="font-semibold">Delivery by channel</h3><UiChart v-if="chart && c.stats.sent" :option="chart" height="260px" class="mt-2" /><p v-else class="py-10 text-center text-sm text-ink-500">Statistics appear after sending.</p></section>
        <aside class="space-y-4">
          <KeyValueList :items="[{ label: 'Audience', value: c.audience.type.replace(/_/g, ' ') }, { label: 'Filters', value: Object.entries(c.audience.filters).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None' }, { label: 'Created by', value: `${c.createdBy.firstName} ${c.createdBy.lastName}` }, { label: 'Created', value: formatDateTime(c.createdAt) }, { label: 'Scheduled', value: c.scheduledAt ? formatDateTime(c.scheduledAt) : '—' }, { label: 'Sent', value: c.sentAt ? formatDateTime(c.sentAt) : '—' }, { label: 'Failed', value: formatNumber(c.stats.failed) }]" />
          <div class="card p-5"><p class="text-xs font-semibold uppercase tracking-wide text-ink-400">Message</p><p v-if="c.subject" class="mt-2 font-semibold">{{ c.subject }}</p><p class="mt-1 whitespace-pre-line text-sm">{{ c.body }}</p></div>
        </aside>
      </div>
    </template>
  </div>
</template>
