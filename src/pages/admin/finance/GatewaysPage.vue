<script setup lang="ts">
import UiBadge from '@/components/ui/UiBadge.vue'
import UiChart from '@/components/ui/UiChart.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { formatNumber } from '@/utils/format'
import type { TrendPoint } from '@/types'

const { data, loading } = useAsync(() => adminApi.finance.gateways())
const spark = (series: TrendPoint[]) => ({ grid: { left: 0, right: 0, top: 4, bottom: 0 }, xAxis: { type: 'category' as const, show: false, data: series.map((p) => p.date) }, yAxis: { type: 'value' as const, show: false, min: 60, max: 100 }, tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => `${v}%` }, series: [{ type: 'line' as const, smooth: true, showSymbol: false, areaStyle: { opacity: 0.1 }, data: series.map((p) => p.value) }] })
</script>

<template>
  <div>
    <AdminPageHeader title="Payment gateways" description="Success rate, latency and failures per provider (last 24h). Degraded providers can be disabled in Platform settings." :back="{ name: 'admin.finance' }" />
    <div v-if="loading" class="grid gap-4 md:grid-cols-2"><UiSkeleton v-for="i in 4" :key="i" class="h-52 rounded-2xl" /></div>
    <div v-else class="grid gap-4 md:grid-cols-2">
      <div v-for="g in data ?? []" :key="g.provider" class="card p-5">
        <div class="flex items-center justify-between"><h3 class="text-lg font-semibold capitalize">{{ g.provider }}</h3><UiBadge :status="g.status" /></div>
        <div class="mt-4 grid grid-cols-3 gap-3 text-center"><div><p class="text-xs text-ink-500">Success</p><p class="text-xl font-semibold" :class="g.successRate < 90 && 'text-danger-500'">{{ g.successRate }}%</p></div><div><p class="text-xs text-ink-500">Avg latency</p><p class="text-xl font-semibold">{{ (g.avgLatencyMs / 1000).toFixed(1) }}s</p></div><div><p class="text-xs text-ink-500">Volume / failures</p><p class="text-xl font-semibold">{{ formatNumber(g.volume, { compact: true }) }} <span class="text-sm text-danger-500">/ {{ g.failures }}</span></p></div></div>
        <UiChart class="mt-4" :option="spark(g.series)" height="80px" />
      </div>
    </div>
  </div>
</template>
