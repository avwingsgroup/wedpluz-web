<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, Star, X } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney, formatNumber } from '@/utils/format'
import type { AdminEventRecord } from '@/types'

const router = useRouter()
const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', categoryId: 'all', attendanceMode: 'all', featured: false, sort: 'startsAt', order: 'desc', page: 1 }, (q, signal) => adminApi.events.list(q, signal))
const { data: categories } = useAsync(() => adminApi.events.categories())
const selected = ref<string[]>([])
const columns = [
  { key: 'title', label: 'Event', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'startsAt', label: 'Date', sortable: true, hideBelow: 'md' as const },
  { key: 'ticketsSold', label: 'Tickets', align: 'right' as const, sortable: true, hideBelow: 'lg' as const },
  { key: 'revenue', label: 'Revenue', align: 'right' as const, sortable: true, hideBelow: 'md' as const },
  { key: 'source', label: 'Source', hideBelow: 'lg' as const },
  { key: 'actions', label: '', align: 'right' as const },
]
const statusTabs = [{ key: 'all', label: 'All' }, { key: 'pending_review', label: 'Pending review' }, { key: 'live', label: 'Live' }, { key: 'completed', label: 'Completed' }, { key: 'suspended', label: 'Suspended' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'rejected', label: 'Rejected' }]
const pendingSelected = computed(() => list.rows.value.filter((r) => selected.value.includes(r.id) && r.status === 'pending_review'))

async function approve(e: AdminEventRecord) {
  await adminApi.events.act(e.id, 'approve')
  ui.success(`${e.title} approved`, 'The organizer has been notified.')
  void list.refresh()
}
async function reject(e: AdminEventRecord) {
  const reason = await ui.prompt({ title: `Reject “${e.title}”`, label: 'Reason (sent to the organizer)', variant: 'danger', confirmLabel: 'Reject event', minLength: 10, presets: ['Incomplete or misleading description', 'Prohibited content', 'Suspected fraud', 'Duplicate event', 'Cover image violates guidelines'] })
  if (!reason) return
  await adminApi.events.act(e.id, 'reject', reason)
  ui.success('Event rejected')
  void list.refresh()
}
async function bulkApprove() {
  for (const e of pendingSelected.value) await adminApi.events.act(e.id, 'approve')
  ui.success(`${pendingSelected.value.length} events approved`)
  selected.value = []
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Events" description="Review, approve, feature and monitor events from every client.">
      <UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.categories' }">Categories</UiButton>
      <ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="events" :map="(r) => ({ id: r.id, title: r.title, status: r.status, startsAt: r.startsAt, ticketsSold: r.ticketsSold, revenue: Number(r.revenue) / 100 })" />
    </AdminPageHeader>
    <UiTabs class="mb-4" variant="underline" :model-value="list.params.value.status" :tabs="statusTabs" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Title, organizer or city" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Category" :model-value="list.params.value.categoryId" :options="[{ label: 'All categories', value: 'all' }, ...(categories ?? []).map((c) => ({ label: c.name, value: c.id }))]" @update:model-value="list.set({ categoryId: $event })" />
      <AdminSelect label="Mode" :model-value="list.params.value.attendanceMode" :options="[{ label: 'All modes', value: 'all' }, { label: 'Physical', value: 'physical' }, { label: 'Online', value: 'online' }, { label: 'Hybrid', value: 'hybrid' }]" @update:model-value="list.set({ attendanceMode: $event })" />
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="h-4 w-4 accent-brand-600" :checked="list.params.value.featured" @change="list.set({ featured: ($event.target as HTMLInputElement).checked })" />Featured only</label>
      <template #actions><Can perm="events.moderate"><UiButton v-if="pendingSelected.length" size="sm" @click="bulkApprove"><Check class="h-4 w-4" />Approve {{ pendingSelected.length }}</UiButton></Can></template>
    </AdminFilterBar>
    <UiDataTable v-model:selected="selected" selectable :columns="columns" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" :sort="list.params.value.sort" :order="list.params.value.order === 'asc' ? 'asc' : 'desc'" clickable empty-title="No events match these filters" @update:sort="list.sortBy" @row-click="(r: AdminEventRecord) => router.push({ name: 'admin.event', params: { id: r.id } })" @retry="list.refresh()">
      <template #cell-title="{ row }"><div class="flex items-center gap-3"><img :src="row.coverUrl" alt="" class="h-10 w-14 rounded-lg object-cover" /><div class="min-w-0"><p class="flex items-center gap-1 truncate font-medium text-ink-900"><Star v-if="row.isFeatured" class="h-3.5 w-3.5 fill-warning-500 text-warning-500" />{{ row.title }}</p><p class="truncate text-xs text-ink-500">{{ row.organizer.displayName }} · {{ row.category.name }} · {{ row.city ?? row.attendanceMode }}</p></div></div></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-startsAt="{ row }"><span class="text-xs">{{ formatDate(row.startsAt) }}</span></template>
      <template #cell-ticketsSold="{ row }">{{ formatNumber(row.ticketsSold) }}</template>
      <template #cell-revenue="{ row }">{{ formatMoney(row.revenue, 'NGN', { compact: true }) }}</template>
      <template #cell-source="{ row }"><span class="text-xs uppercase text-ink-500">{{ row.source }}</span></template>
      <template #cell-actions="{ row }"><Can perm="events.moderate"><div v-if="row.status === 'pending_review'" class="flex justify-end gap-1" @click.stop><button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-success-50 text-success-600" aria-label="Approve" @click="approve(row)"><Check class="h-4 w-4" /></button><button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-danger-50 text-danger-500" aria-label="Reject" @click="reject(row)"><X class="h-4 w-4" /></button></div></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
