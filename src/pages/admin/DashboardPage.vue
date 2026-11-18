<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, Banknote, CalendarDays, CircleAlert, Flag, Info, RefreshCw, Ticket, TriangleAlert, Users, Wallet } from 'lucide-vue-next'
import UiStatCard from '@/components/ui/UiStatCard.vue'
import UiChart from '@/components/ui/UiChart.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminDateRange from '@/modules/admin/AdminDateRange.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useAdminStore } from '@/stores/admin.store'
import { formatMoney, formatNumber, formatRelativeLong } from '@/utils/format'
import { cn } from '@/utils/cn'

const router = useRouter()
const admin = useAdminStore()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const range = ref({ from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(new Date()) })
const { data: d, loading, error, refresh } = useAsync(() => adminApi.dashboard(range.value), { watch: range, keepPreviousData: true })
const money = (v: number) => formatMoney(v, 'NGN', { compact: true })

const revenueChart = computed(() => d.value && ({
  legend: { top: 0, right: 0, icon: 'circle' },
  xAxis: { type: 'category' as const, data: d.value.finance.gtv.trend.map((p) => p.date.slice(5)), axisLine: { lineStyle: { color: '#eaebec' } } },
  yAxis: [{ type: 'value' as const, axisLabel: { formatter: (v: number) => `₦${(v / 100 / 1e6).toFixed(1)}M` }, splitLine: { lineStyle: { color: '#f4f4f5' } } }],
  series: [
    { name: 'GTV', type: 'line' as const, smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, data: d.value.finance.gtv.trend.map((p) => p.value) },
    { name: 'Platform revenue', type: 'line' as const, smooth: true, showSymbol: false, data: d.value.finance.platformRevenue.trend.map((p) => p.value) },
  ],
  tooltip: { trigger: 'axis' as const, valueFormatter: (v: unknown) => money(Number(v)) },
}))
const ticketsChart = computed(() => d.value && ({
  xAxis: { type: 'category' as const, data: d.value.tickets.sold.trend.map((p) => p.date.slice(5)), axisLine: { lineStyle: { color: '#eaebec' } } },
  yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#f4f4f5' } } },
  series: [{ name: 'Tickets sold', type: 'bar' as const, barMaxWidth: 14, itemStyle: { borderRadius: [4, 4, 0, 0] }, data: d.value.tickets.sold.trend.map((p) => p.value) }],
}))
const sourceChart = computed(() => d.value && ({
  tooltip: { trigger: 'item' as const },
  legend: { bottom: 0, icon: 'circle' },
  series: [{ type: 'pie' as const, radius: ['55%', '80%'], center: ['50%', '42%'], label: { show: false }, data: d.value.acquisitionBySource.map((s) => ({ name: s.source === 'ios' ? 'iOS' : s.source === 'android' ? 'Android' : 'Web', value: s.users })) }],
}))
const eventStatusChart = computed(() => d.value && ({
  tooltip: { trigger: 'item' as const },
  legend: { bottom: 0, icon: 'circle' },
  series: [{ type: 'pie' as const, radius: ['55%', '80%'], center: ['50%', '42%'], label: { show: false }, data: [{ name: 'Upcoming', value: d.value.events.upcoming }, { name: 'Ongoing', value: d.value.events.ongoing }, { name: 'Completed', value: d.value.events.completed }, { name: 'Pending review', value: d.value.events.pendingReview }] }],
}))
const alertIcon = { critical: CircleAlert, warning: TriangleAlert, info: Info }
/** Alert links from the API are relative to the admin root; prefix when mounted under /admin. */
const adminBase = router.resolve({ name: 'admin.dashboard' }).path.replace(/\/$/, '')
const adminPath = (link: string) => `${adminBase}${link}`
</script>

<template>
  <div>
    <AdminPageHeader :title="`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${admin.admin?.firstName}`" description="Platform health across web, Android and iOS.">
      <AdminDateRange :from="range.from" :to="range.to" @change="(f, t) => (range = { from: f, to: t })" />
      <UiButton variant="outline" size="sm" icon-only aria-label="Refresh" @click="refresh"><RefreshCw :class="cn('h-4 w-4', loading && 'animate-spin')" /></UiButton>
    </AdminPageHeader>

    <ErrorState v-if="error && !d" :error="error" @retry="refresh" />
    <template v-else>
      <!-- alerts -->
      <div v-if="d?.alerts.length" class="mb-6 space-y-2">
        <component :is="a.link ? 'router-link' : 'div'" v-for="a in d.alerts" :key="a.id" :to="a.link ? adminPath(a.link) : undefined" :class="cn('flex items-start gap-3 rounded-2xl border p-4', a.severity === 'critical' ? 'border-danger-500/40 bg-danger-50' : a.severity === 'warning' ? 'border-warning-500/40 bg-warning-50' : 'border-info-500/30 bg-info-50')">
          <component :is="alertIcon[a.severity]" :class="cn('mt-0.5 h-5 w-5 shrink-0', a.severity === 'critical' ? 'text-danger-500' : a.severity === 'warning' ? 'text-amber-600' : 'text-info-500')" />
          <div class="min-w-0 flex-1"><p class="font-medium">{{ a.title }}</p><p class="text-sm text-ink-600">{{ a.description }}</p></div>
          <span class="shrink-0 text-xs text-ink-500">{{ formatRelativeLong(a.createdAt) }}</span>
        </component>
      </div>

      <!-- KPIs -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStatCard label="Gross transaction volume" :value="d ? money(d.finance.gtv.value) : ''" :change="d?.finance.gtv.changePercent" hint="vs previous period" :icon="Banknote" tone="brand" :loading="!d" :to="{ name: 'admin.finance' }" />
        <UiStatCard label="Platform revenue" :value="d ? money(d.finance.platformRevenue.value) : ''" :change="d?.finance.platformRevenue.changePercent" hint="commission + fees" :icon="Wallet" :loading="!d" />
        <UiStatCard label="Tickets sold" :value="d ? formatNumber(d.tickets.sold.value) : ''" :change="d?.tickets.sold.changePercent" :hint="d ? `${formatNumber(d.tickets.bookings.value)} bookings` : ''" :icon="Ticket" :loading="!d" />
        <UiStatCard label="Registered users" :value="d ? formatNumber(d.users.total, { compact: true }) : ''" :change="d?.users.newInPeriod.changePercent" :hint="d ? `+${formatNumber(d.users.newInPeriod.value)} new` : ''" :icon="Users" :loading="!d" :to="{ name: 'admin.users' }" />
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiStatCard label="Active users" :value="d ? formatNumber(d.users.active, { compact: true }) : ''" :hint="d ? `${formatNumber(d.users.inactive, { compact: true })} inactive · ${formatNumber(d.users.verified, { compact: true })} verified` : ''" :loading="!d" />
        <UiStatCard label="Events" :value="d ? formatNumber(d.events.total) : ''" :hint="d ? `${d.events.upcoming} upcoming · ${d.events.ongoing} ongoing` : ''" :icon="CalendarDays" :loading="!d" :to="{ name: 'admin.events' }" />
        <UiStatCard label="Pending settlements" :value="d ? money(d.finance.pendingSettlements) : ''" :hint="d ? `${d.finance.refundsCount} refunds · ${money(d.finance.refundsAmount)}` : ''" :loading="!d" :to="{ name: 'admin.settlements' }" />
        <UiStatCard label="Open reports" :value="d ? d.community.reportsOpen : ''" :hint="d ? `${formatNumber(d.community.messagesInPeriod, { compact: true })} messages · ${formatNumber(d.community.communities)} communities` : ''" :icon="Flag" :loading="!d" :to="{ name: 'admin.moderation' }" />
      </div>

      <div class="mt-6 grid gap-4 xl:grid-cols-3">
        <section class="card p-5 xl:col-span-2"><h3 class="font-semibold">Revenue trend</h3><UiSkeleton v-if="!revenueChart" class="mt-4 h-72" /><UiChart v-else :option="revenueChart" height="290px" class="mt-2" /></section>
        <section class="card p-5"><h3 class="font-semibold">Sign-ups by platform</h3><UiSkeleton v-if="!sourceChart" class="mt-4 h-72" /><UiChart v-else :option="sourceChart" height="290px" /></section>
      </div>
      <div class="mt-4 grid gap-4 xl:grid-cols-3">
        <section class="card p-5 xl:col-span-2"><h3 class="font-semibold">Tickets sold per day</h3><UiSkeleton v-if="!ticketsChart" class="mt-4 h-60" /><UiChart v-else :option="ticketsChart" height="240px" class="mt-2" /></section>
        <section class="card p-5"><h3 class="font-semibold">Events by status</h3><UiSkeleton v-if="!eventStatusChart" class="mt-4 h-60" /><UiChart v-else :option="eventStatusChart" height="240px" /></section>
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-3">
        <section class="card min-w-0 xl:col-span-2">
          <div class="flex items-center justify-between border-b border-ink-100 px-5 py-4"><h3 class="font-semibold">Top events</h3><RouterLink :to="{ name: 'admin.events', query: { sort: 'revenue' } }" class="text-sm text-brand-600 hover:underline">View all</RouterLink></div>
          <div class="overflow-x-auto"><table class="w-full text-sm"><tbody class="divide-y divide-ink-100">
            <tr v-for="t in d?.topEvents ?? []" :key="t.event.id" class="cursor-pointer hover:bg-ink-50" @click="router.push({ name: 'admin.event', params: { id: t.event.id } })"><td class="px-5 py-3"><div class="flex items-center gap-3"><img :src="t.event.coverUrl" alt="" class="h-10 w-10 rounded-lg object-cover" /><div class="min-w-0"><p class="truncate font-medium">{{ t.event.title }}</p><p class="text-xs text-ink-500">{{ t.event.organizer.displayName }}</p></div></div></td><td class="px-5 py-3 text-right text-ink-500">{{ formatNumber(t.ticketsSold) }} tickets</td><td class="px-5 py-3 text-right font-medium">{{ money(t.revenue) }}</td></tr>
          </tbody></table></div>
        </section>
        <section class="card">
          <div class="flex items-center justify-between border-b border-ink-100 px-5 py-4"><h3 class="font-semibold">Payment gateways</h3><RouterLink :to="{ name: 'admin.gateways' }" class="text-sm text-brand-600 hover:underline">Details</RouterLink></div>
          <ul class="divide-y divide-ink-100"><li v-for="g in d?.gatewayHealth ?? []" :key="g.provider" class="flex items-center gap-3 px-5 py-3"><span class="flex-1 font-medium capitalize">{{ g.provider }}</span><span class="text-sm text-ink-500">{{ g.successRate }}%</span><UiBadge :status="g.status" size="sm" /></li></ul>
        </section>
      </div>

      <section class="card mt-4">
        <div class="flex items-center justify-between border-b border-ink-100 px-5 py-4"><h3 class="flex items-center gap-2 font-semibold"><Activity class="h-4 w-4" />Recent admin activity</h3><RouterLink v-if="admin.can('audit.view')" :to="{ name: 'admin.audit' }" class="text-sm text-brand-600 hover:underline">Audit log</RouterLink></div>
        <ul class="divide-y divide-ink-100"><li v-for="a in d?.recentActivity ?? []" :key="a.id" class="flex items-center gap-3 px-5 py-3 text-sm"><UiAvatar :src="a.actor?.avatarUrl" :name="a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : 'System'" size="sm" /><p class="min-w-0 flex-1 truncate"><strong class="font-medium">{{ a.actor?.firstName ?? 'System' }}</strong> <span class="text-ink-500">{{ a.action.replace('.', ' ').replace(/_/g, ' ') }}</span> {{ a.targetLabel }}</p><span class="shrink-0 text-xs text-ink-400">{{ formatRelativeLong(a.createdAt) }}</span></li></ul>
      </section>
    </template>
  </div>
</template>
