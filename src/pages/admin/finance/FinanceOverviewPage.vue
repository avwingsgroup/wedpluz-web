<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Banknote, Landmark, RotateCcw, Wallet } from 'lucide-vue-next'
import UiStatCard from '@/components/ui/UiStatCard.vue'
import UiChart from '@/components/ui/UiChart.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminDateRange from '@/modules/admin/AdminDateRange.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { formatMoney, formatNumber } from '@/utils/format'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const range = ref({ from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(new Date()) })
const { data: s, error, refresh } = useAsync(() => adminApi.finance.summary(range.value), { watch: range, keepPreviousData: true })
const money = (v: number) => formatMoney(v, 'NGN', { compact: true })
const chart = computed(() => s.value && ({
  legend: { top: 0, right: 0, icon: 'circle' },
  tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => money(Number(v)) },
  xAxis: { type: 'category' as const, data: s.value.revenueByDay.map((d) => d.date.slice(5)) },
  yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => `₦${(v / 1e8).toFixed(0)}M` }, splitLine: { lineStyle: { color: '#f4f4f5' } } },
  series: [{ name: 'GTV', type: 'bar' as const, barMaxWidth: 14, data: s.value.revenueByDay.map((d) => d.gtv), itemStyle: { borderRadius: [4, 4, 0, 0] } }, { name: 'Revenue', type: 'line' as const, smooth: true, showSymbol: false, data: s.value.revenueByDay.map((d) => d.revenue) }],
}))
const providerChart = computed(() => s.value && ({ tooltip: { trigger: 'item' as const, valueFormatter: (v: unknown) => money(Number(v)) }, legend: { bottom: 0, icon: 'circle' }, series: [{ type: 'pie' as const, radius: ['55%', '80%'], center: ['50%', '42%'], label: { show: false }, data: s.value.byProvider.map((p) => ({ name: p.provider, value: p.volume })) }] }))
const links = [
  { name: 'admin.transactions', label: 'Transactions', text: 'Search and reconcile every payment' },
  { name: 'admin.settlements', label: 'Settlements', text: 'Organizer earnings ready for payout' },
  { name: 'admin.payouts', label: 'Payouts', text: 'Approve transfers (four-eyes)' },
  { name: 'admin.refunds', label: 'Refunds', text: 'Approve or reject refund requests' },
  { name: 'admin.commissions', label: 'Commissions', text: 'Platform, category and organizer rates' },
  { name: 'admin.gateways', label: 'Gateways', text: 'Provider success rates and latency' },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Finance" description="All amounts in NGN. Figures reconcile to provider settlement reports daily."><AdminDateRange :from="range.from" :to="range.to" @change="(f, t) => (range = { from: f, to: t })" /></AdminPageHeader>
    <ErrorState v-if="error && !s" :error="error" @retry="refresh" />
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStatCard label="GTV" :value="s ? money(s.gtv.value) : ''" :change="s?.gtv.changePercent" tone="brand" :icon="Banknote" :loading="!s" />
        <UiStatCard label="Platform revenue" :value="s ? money(s.platformRevenue.value) : ''" :change="s?.platformRevenue.changePercent" :icon="Wallet" :loading="!s" />
        <UiStatCard label="Pending settlements" :value="s ? money(s.pendingSettlements) : ''" :hint="s ? `${money(s.paidOut)} paid out` : ''" :icon="Landmark" :loading="!s" :to="{ name: 'admin.settlements' }" />
        <UiStatCard label="Refunds" :value="s ? money(s.refunds) : ''" :hint="s ? `Gateway fees ${money(s.gatewayFees)}` : ''" :icon="RotateCcw" :loading="!s" :to="{ name: 'admin.refunds' }" />
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-3">
        <section class="card p-5 xl:col-span-2"><h3 class="font-semibold">Volume &amp; revenue</h3><UiSkeleton v-if="!chart" class="mt-4 h-72" /><UiChart v-else :option="chart" height="300px" class="mt-2" /></section>
        <section class="card p-5"><h3 class="font-semibold">Volume by provider</h3><UiSkeleton v-if="!providerChart" class="mt-4 h-72" /><UiChart v-else :option="providerChart" height="300px" /></section>
      </div>
      <section class="card mt-4"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Providers</h3><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-ink-50 text-xs uppercase text-ink-500"><tr><th class="px-5 py-2 text-left">Provider</th><th class="px-5 py-2 text-right">Volume</th><th class="px-5 py-2 text-right">Transactions</th><th class="px-5 py-2 text-right">Success</th></tr></thead><tbody class="divide-y divide-ink-100"><tr v-for="p in s?.byProvider ?? []" :key="p.provider"><td class="px-5 py-3 capitalize">{{ p.provider }}</td><td class="px-5 py-3 text-right">{{ money(p.volume) }}</td><td class="px-5 py-3 text-right">{{ formatNumber(p.count) }}</td><td class="px-5 py-3 text-right" :class="p.successRate < 90 && 'text-danger-500 font-medium'">{{ p.successRate }}%</td></tr></tbody></table></div></section>
      <p class="mt-2 text-xs text-ink-500">Wallet float (customer balances held): {{ s ? money(s.walletFloat) : '—' }}</p>
      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><RouterLink v-for="l in links" :key="l.name" :to="{ name: l.name }" class="card flex items-center justify-between p-4 hover:shadow-card"><div><p class="font-medium">{{ l.label }}</p><p class="text-sm text-ink-500">{{ l.text }}</p></div><ArrowRight class="h-4 w-4" /></RouterLink></div>
    </template>
  </div>
</template>
