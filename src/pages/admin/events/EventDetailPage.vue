<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Ban, Check, ExternalLink, RotateCcw, Star, X } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { env } from '@/config/env'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatTimeRange } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: e, loading, error, refresh } = useAsync(() => adminApi.events.get(id.value), { watch: id })

async function act(action: 'approve' | 'reject' | 'suspend' | 'restore' | 'feature' | 'unfeature') {
  let reason: string | undefined
  if (action === 'reject' || action === 'suspend') {
    const r = await ui.prompt({ title: action === 'reject' ? 'Reject event' : 'Suspend event', description: action === 'suspend' ? 'Ticket sales stop immediately and the event is hidden. Existing ticket holders are notified.' : undefined, label: 'Reason (sent to the organizer and logged)', variant: 'danger', confirmLabel: action === 'reject' ? 'Reject' : 'Suspend', minLength: 10 })
    if (!r) return
    reason = r
  }
  await adminApi.events.act(id.value, action, reason)
  ui.success(`Event ${action === 'feature' ? 'featured' : action === 'unfeature' ? 'unfeatured' : `${action}d`.replace('ed', 'ed')}`)
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !e" page />
    <template v-else>
      <AdminPageHeader :title="e.title" :back="{ name: 'admin.events' }">
        <template #meta><div class="mt-2 flex flex-wrap items-center gap-2"><UiBadge :status="e.status" /><UiBadge v-if="e.isFeatured" tone="warning">Featured</UiBadge><UiBadge v-if="e.isPromoted" tone="brand">Promoted</UiBadge><span class="text-sm text-ink-500">{{ e.category.name }} · created via {{ e.source.toUpperCase() }}</span></div></template>
        <UiButton variant="outline" size="sm" :href="`${env.webOrigin}/events/${e.slug}`"><ExternalLink class="h-4 w-4" />View public page</UiButton>
        <Can perm="events.feature"><UiButton v-if="e.status === 'live'" variant="outline" size="sm" @click="act(e.isFeatured ? 'unfeature' : 'feature')"><Star class="h-4 w-4" />{{ e.isFeatured ? 'Unfeature' : 'Feature' }}</UiButton></Can>
        <Can perm="events.moderate">
          <template v-if="e.status === 'pending_review'"><UiButton size="sm" @click="act('approve')"><Check class="h-4 w-4" />Approve</UiButton><UiButton size="sm" variant="danger" @click="act('reject')"><X class="h-4 w-4" />Reject</UiButton></template>
          <UiButton v-else-if="e.status === 'live'" size="sm" variant="danger" @click="act('suspend')"><Ban class="h-4 w-4" />Suspend</UiButton>
          <UiButton v-else-if="e.status === 'suspended' || e.status === 'rejected'" size="sm" @click="act('restore')"><RotateCcw class="h-4 w-4" />Restore</UiButton>
        </Can>
      </AdminPageHeader>
      <div v-if="e.rejectionReason" class="mb-4 rounded-2xl bg-danger-50 p-4 text-sm"><strong>Rejection reason:</strong> {{ e.rejectionReason }}</div>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section class="space-y-6">
          <img :src="e.coverUrl" alt="" class="aspect-[16/6] w-full rounded-2xl object-cover" />
          <div class="grid gap-4 sm:grid-cols-4">
            <div class="card p-4"><p class="text-xs text-ink-500">Tickets sold</p><p class="mt-1 text-xl font-semibold">{{ formatNumber(e.ticketsSold) }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Revenue</p><p class="mt-1 text-xl font-semibold">{{ formatMoney(e.revenue, 'NGN', { compact: true }) }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Checked in</p><p class="mt-1 text-xl font-semibold">{{ formatNumber(e.stats.checkedIn) }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Reports</p><p class="mt-1 text-xl font-semibold" :class="e.reportsCount ? 'text-danger-500' : ''">{{ e.reportsCount }}</p></div>
          </div>
          <div class="card p-5"><h3 class="font-semibold">Description</h3><p class="mt-2 whitespace-pre-line text-sm text-ink-700">{{ e.description }}</p></div>
          <div class="card"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Ticket types</h3><div class="overflow-x-auto"><table class="w-full text-sm"><tbody class="divide-y divide-ink-100"><tr v-for="t in e.ticketTypes" :key="t.id"><td class="px-5 py-3">{{ t.name }}</td><td class="px-5 py-3 text-right">{{ t.price === 0 ? 'Free' : formatMoney(t.price) }}</td><td class="px-5 py-3 text-right text-ink-500">{{ t.sold }}/{{ t.quantity }}</td></tr></tbody></table></div></div>
          <div><h3 class="mb-3 font-semibold">Recent bookings</h3>
            <UiDataTable :columns="[{ key: 'reference', label: 'Reference' }, { key: 'buyer', label: 'Buyer' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'status', label: 'Status' }]" :rows="e.bookings" clickable empty-title="No bookings yet" @row-click="(r) => router.push({ name: 'admin.booking', params: { id: r.id } })">
              <template #cell-buyer="{ row }">{{ row.buyer.displayName }}</template><template #cell-total="{ row }">{{ formatMoney(row.total) }}</template><template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
            </UiDataTable>
          </div>
        </section>
        <aside class="space-y-4">
          <div class="card flex items-center gap-3 p-4"><UiAvatar :src="e.organizer.avatarUrl" :name="e.organizer.displayName" /><div class="min-w-0 flex-1"><p class="font-medium">{{ e.organizer.displayName }}</p><p class="text-xs text-ink-500">Organizer · {{ e.organizer.eventsCount }} events</p></div><UiButton size="xs" variant="soft" :to="{ name: 'admin.organizers', query: { search: e.organizer.displayName } }">Open</UiButton></div>
          <KeyValueList title="Details" :items="[{ label: 'Visibility', value: e.visibility }, { label: 'Approval required', value: e.approvalRequired ? 'Yes' : 'No' }, { label: 'Guest limit', value: e.guestLimit }, { label: '18+', value: e.isAdultOnly ? 'Yes' : 'No' }, { label: 'Submitted', value: e.submittedAt ? formatDateTime(e.submittedAt) : '—' }, { label: 'Reviewed by', value: e.reviewedBy?.displayName }, { label: 'Event ID', value: e.id, mono: true }]" />
          <div class="card"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Schedule</h3><div v-for="s in e.schedules" :key="s.id" class="border-b border-ink-100 px-5 py-3 text-sm last:border-0"><p class="font-medium">{{ s.label ?? formatDate(s.startsAt) }}</p><p class="text-ink-500">{{ formatDate(s.startsAt) }} · {{ formatTimeRange(s.startsAt, s.endsAt) }}</p><p class="capitalize text-ink-500">{{ s.attendanceMode }}<template v-if="s.venue"> · {{ s.venue.name }}, {{ s.venue.state }}</template></p></div></div>
          <div v-if="e.reports.length" class="card"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Reports</h3><RouterLink v-for="r in e.reports" :key="r.id" :to="{ name: 'admin.report', params: { id: r.id } }" class="flex justify-between px-5 py-3 text-sm hover:bg-ink-50"><span class="capitalize">{{ r.reason.replace(/_/g, ' ') }}</span><UiBadge :status="r.status" size="sm" /></RouterLink></div>
        </aside>
      </div>
    </template>
  </div>
</template>
