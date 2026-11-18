<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatMoney } from '@/utils/format'
import type { Dispute } from '@/types'

const router = useRouter()
const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.bookings.disputes(q))
async function update(d: Dispute, patch: { status?: Dispute['status']; assignToMe?: boolean }) {
  let note: string | undefined
  if (patch.status?.startsWith('resolved')) {
    const n = await ui.prompt({ title: 'Resolution note', label: 'What was decided and why?', minLength: 10, confirmLabel: 'Resolve' })
    if (!n) return
    note = n
  }
  await adminApi.bookings.updateDispute(d.id, { ...patch, note })
  ui.success('Dispute updated')
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Booking disputes" description="Chargebacks and customer claims. Resolve with a refund from the booking or reject with evidence." :back="{ name: 'admin.bookings' }" />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'investigating', label: 'Investigating' }, { key: 'resolved_refund', label: 'Refunded' }, { key: 'resolved_rejected', label: 'Rejected' }]" @update:model-value="list.set({ status: $event })" />
    <UiDataTable :columns="[{ key: 'booking', label: 'Booking' }, { key: 'type', label: 'Type' }, { key: 'raisedBy', label: 'Raised by', hideBelow: 'md' }, { key: 'assignedTo', label: 'Assignee', hideBelow: 'md' }, { key: 'status', label: 'Status' }, { key: 'updatedAt', label: 'Updated', hideBelow: 'lg' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No disputes">
      <template #cell-booking="{ row }"><button type="button" class="text-left" @click="router.push({ name: 'admin.booking', params: { id: row.booking.id } })"><span class="font-mono text-xs text-brand-600">{{ row.booking.reference }}</span><span class="block text-xs text-ink-500">{{ formatMoney(row.booking.total) }}</span></button></template>
      <template #cell-type="{ row }"><span class="capitalize">{{ row.type.replace(/_/g, ' ') }}</span></template>
      <template #cell-raisedBy="{ row }">{{ row.raisedBy.displayName }}</template>
      <template #cell-assignedTo="{ row }">{{ row.assignedTo ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}` : '—' }}</template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-updatedAt="{ row }"><span class="text-xs text-ink-500">{{ formatDateTime(row.updatedAt) }}</span></template>
      <template #cell-actions="{ row }"><Can perm="bookings.manage"><UiDropdown :items="[{ label: 'Assign to me', onClick: () => update(row, { assignToMe: true }) }, { label: 'Mark investigating', onClick: () => update(row, { status: 'investigating' }) }, { label: 'Resolve: refund issued', onClick: () => update(row, { status: 'resolved_refund' }) }, { label: 'Resolve: reject claim', danger: true, onClick: () => update(row, { status: 'resolved_rejected' }) }]" width="w-56"><template #trigger><UiButton size="xs" variant="outline">Actions</UiButton></template></UiDropdown></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
