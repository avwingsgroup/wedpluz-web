<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChartColumn, Download, FileSpreadsheet, FileText, Play } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiChart from '@/components/ui/UiChart.vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminDateRange from '@/modules/admin/AdminDateRange.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatMoney, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { ReportKey, ReportResult } from '@/types'

const ui = useUiStore()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const { data: defs, loading: defsLoading } = useAsync(() => adminApi.reports.definitions())
const key = ref<ReportKey>('ticket_sales')
const range = ref({ from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(new Date()) })
const groupBy = ref('day')
const result = ref<ReportResult | null>(null)
const running = ref(false)
const exporting = ref<string | null>(null)
const def = computed(() => defs.value?.find((d) => d.key === key.value))
watch(def, (d) => d && !d.dimensions.includes(groupBy.value) && (groupBy.value = d.dimensions[0] ?? 'day'))

async function run() {
  running.value = true
  try {
    result.value = await adminApi.reports.run(key.value, { ...range.value, groupBy: groupBy.value as 'day' })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    running.value = false
  }
}
watch([key, range, groupBy], run, { immediate: true })
function fmt(type: string, v: unknown) {
  const n = Number(v)
  if (type === 'money') return formatMoney(n, 'NGN', { compact: true })
  if (type === 'percent') return `${n}%`
  if (type === 'number') return formatNumber(n)
  return String(v ?? '')
}
const chart = computed(() => result.value && ({
  legend: { top: 0, icon: 'circle' },
  tooltip: { trigger: 'axis' as const },
  xAxis: { type: 'category' as const, data: result.value.series[0]?.points.map((p) => p.date) ?? [] },
  yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f4f4f5' } } },
  series: result.value.series.map((s, i) => ({ name: s.name, type: i === 0 ? ('bar' as const) : ('line' as const), smooth: true, barMaxWidth: 18, data: s.points.map((p) => p.value) })),
}))
async function exportReport(format: 'csv' | 'xlsx' | 'pdf') {
  exporting.value = format
  try {
    let job = await adminApi.reports.export(key.value, { ...range.value, groupBy: groupBy.value as 'day', format })
    for (let i = 0; i < 20 && job.status !== 'ready' && job.status !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      job = await adminApi.reports.exportJob(job.id)
    }
    if (job.status === 'ready' && job.downloadUrl) {
      const a = document.createElement('a')
      a.href = job.downloadUrl
      a.download = `wedpluz-${key.value}-${range.value.from}-${range.value.to}.${format}`
      a.click()
      ui.success('Export ready')
    } else ui.error('Export failed. Try again.')
  } finally {
    exporting.value = null
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Reports & analytics" description="Aggregated reports across web, Android and iOS. Large exports are generated asynchronously." />
    <div class="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <nav class="card h-fit p-2">
        <template v-if="defsLoading"><UiSkeleton v-for="i in 6" :key="i" class="m-2 h-12 rounded-xl" /></template>
        <button v-for="d in defs ?? []" :key="d.key" type="button" :class="cn('block w-full rounded-xl px-3 py-2.5 text-left', key === d.key ? 'bg-brand-50' : 'hover:bg-ink-50')" @click="key = d.key"><span class="block text-sm font-medium" :class="key === d.key && 'text-brand-700'">{{ d.name }}</span><span class="block text-xs text-ink-500">{{ d.description }}</span></button>
      </nav>
      <section class="min-w-0 space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <AdminDateRange :from="range.from" :to="range.to" @change="(f, t) => (range = { from: f, to: t })" />
          <AdminSelect v-if="def" label="Group by" :model-value="groupBy" :options="def.dimensions.map((d) => ({ label: `By ${d}`, value: d }))" @update:model-value="groupBy = $event" />
          <UiButton variant="outline" size="sm" :loading="running" @click="run"><Play class="h-4 w-4" />Run</UiButton>
          <Can perm="reports.export"><div class="ml-auto flex gap-2"><UiButton v-for="f in def?.exportFormats ?? []" :key="f" variant="outline" size="sm" rounded="xl" :loading="exporting === f" @click="exportReport(f)"><FileSpreadsheet v-if="f !== 'pdf'" class="h-4 w-4" /><FileText v-else class="h-4 w-4" />{{ f.toUpperCase() }}</UiButton></div></Can>
        </div>
        <div v-if="running && !result" class="space-y-4"><UiSkeleton class="h-72 rounded-2xl" /><UiSkeleton class="h-64 rounded-2xl" /></div>
        <UiEmptyState v-else-if="!result" title="Choose a report" illustration="generic" />
        <template v-else>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div v-for="c in result.columns.slice(1)" :key="c.key" class="card p-4"><p class="text-xs text-ink-500">{{ c.label }} {{ c.type === 'percent' ? '(avg)' : '(total)' }}</p><p class="mt-1 text-xl font-semibold">{{ fmt(c.type, result.totals[c.key]) }}</p></div></div>
          <div class="card p-5"><h3 class="flex items-center gap-2 font-semibold"><ChartColumn class="h-4 w-4" />{{ def?.name }}</h3><UiChart v-if="chart" :option="chart" height="300px" class="mt-2" :loading="running" /></div>
          <UiDataTable :columns="result.columns.map((c) => ({ key: c.key, label: c.label, align: c.type === 'string' ? 'left' : 'right' }))" :rows="result.rows.map((r, i) => ({ ...r, id: String(i) }) as Record<string, string | number | null>)" dense>
            <template v-for="c in result.columns" :key="c.key" #[`cell-${c.key}`]="{ row }">{{ fmt(c.type, row[c.key]) }}</template>
          </UiDataTable>
          <p class="flex items-center gap-1 text-xs text-ink-500"><Download class="h-3.5 w-3.5" />Exports include all rows for the selected period and are available for 24 hours.</p>
        </template>
      </section>
    </div>
  </div>
</template>
