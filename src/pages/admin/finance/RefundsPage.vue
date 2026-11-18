<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatMoney } from '@/utils/format'
import type { RefundRecord } from '@/types'

const router = useRouter()
const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.finance.refunds(q))
async function decide(r: RefundRecord, decision: 'approve' | 'reject') {
  if (!(await ui.confirm({ title: decision === 'approve' ? `Approve ${formatMoney(r.amount)} refund?` : 'Reject this refund?', description: decision === 'approve' ? `Funds return to the buyer via ${r.provider}. Organizer settlement is reduced accordingly.` : 'The buyer is notified and the ticket stays valid.', variant: decision === 'approve' ? 'default' : 'danger', confirmLabel: decision === 'approve' ? 'Approve' : 'Reject' }))) return
  await adminApi.finance.decideRefund(r.id, decision)
  ui.success(decision === 'approve' ? 'Refund approved' : 'Refund rejected')
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Refunds" description="Refund eligibility is enforced by the backend (refund window, organizer policy, check-in status)." :back="{ name: 'admin.finance' }" />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'requested', label: 'Requested' }, { key: 'processing', label: 'Processing' }, { key: 'approved', label: 'Approved' }, { key: 'completed', label: 'Completed' }, { key: 'rejected', label: 'Rejected' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Refund ref, booking ref or buyer" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'reference', label: 'Refund' }, { key: 'booking', label: 'Booking' }, { key: 'buyer', label: 'Buyer', hideBelow: 'md' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'reason', label: 'Reason', hideBelow: 'lg' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No refunds">
      <template #cell-reference="{ row }"><span class="font-mono text-xs">{{ row.reference }}</span><p class="text-xs text-ink-500">{{ formatDateTime(row.requestedAt) }}</p></template>
      <template #cell-booking="{ row }"><button type="button" class="text-left" @click="router.push({ name: 'admin.booking', params: { id: row.booking.id } })"><span class="font-mono text-xs text-brand-600">{{ row.booking.reference }}</span><span class="block max-w-[200px] truncate text-xs text-ink-500">{{ row.booking.event.title }}</span></button></template>
      <template #cell-buyer="{ row }">{{ row.booking.buyer.displayName }}</template>
      <template #cell-amount="{ row }">{{ formatMoney(row.amount) }}</template>
      <template #cell-reason="{ row }"><span class="text-xs">{{ row.reason }}</span></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-actions="{ row }"><Can perm="refunds.approve"><div v-if="row.status === 'requested' || row.status === 'processing'" class="flex justify-end gap-2"><UiButton size="xs" variant="outline" @click="decide(row, 'reject')">Reject</UiButton><UiButton size="xs" @click="decide(row, 'approve')">Approve</UiButton></div></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
