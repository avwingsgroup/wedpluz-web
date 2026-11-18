<script setup lang="ts">
import { computed, ref } from 'vue'
import { Send } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney } from '@/utils/format'
import type { Settlement } from '@/types'

const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.finance.settlements(q))
const selected = ref<string[]>([])
const readySelected = computed(() => list.rows.value.filter((s) => selected.value.includes(s.id) && s.status === 'ready' && !s.payoutId))
const total = computed(() => readySelected.value.reduce((a, s) => a + s.netPayable, 0))

async function hold(s: Settlement) {
  const reason = await ui.prompt({ title: 'Hold settlement', description: 'The organizer is notified and the payout is blocked until released.', label: 'Reason', minLength: 5, presets: ['Open dispute on bookings', 'High refund rate under review', 'KYC documents expired', 'Event cancelled'] })
  if (!reason) return
  await adminApi.finance.holdSettlement(s.id, reason)
  void list.refresh()
}
async function release(s: Settlement) {
  await adminApi.finance.releaseSettlement(s.id)
  ui.success('Settlement released')
  void list.refresh()
}
async function requestPayout() {
  if (!(await ui.confirm({ title: `Request payout of ${formatMoney(total.value)}?`, description: `${readySelected.value.length} settlement(s). A second finance admin must approve before funds move.`, confirmLabel: 'Request payout' }))) return
  try {
    await adminApi.finance.requestPayout(readySelected.value.map((s) => s.id))
    ui.success('Payout requested', 'Awaiting second approval in Payouts.')
    selected.value = []
    void list.refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Settlements" description="Net organizer earnings per event: gross sales − refunds − commission − gateway fees. Eligible after the settlement delay." :back="{ name: 'admin.finance' }" />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'ready', label: 'Ready' }, { key: 'on_hold', label: 'On hold' }, { key: 'paid', label: 'Paid' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Reference, organizer or event" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <template #actions><Can perm="finance.settlements"><UiButton v-if="readySelected.length" size="sm" @click="requestPayout"><Send class="h-4 w-4" />Pay out {{ formatMoney(total, 'NGN', { compact: true }) }}</UiButton></Can></template>
    </AdminFilterBar>
    <UiDataTable v-model:selected="selected" selectable :columns="[{ key: 'organizer', label: 'Organizer' }, { key: 'event', label: 'Event', hideBelow: 'md' }, { key: 'grossSales', label: 'Gross', align: 'right', hideBelow: 'lg' }, { key: 'deductions', label: 'Deductions', align: 'right', hideBelow: 'lg' }, { key: 'netPayable', label: 'Net payable', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'eligibleAt', label: 'Eligible', hideBelow: 'md' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No settlements">
      <template #cell-organizer="{ row }"><p class="font-medium">{{ row.organizer.businessName ?? row.organizer.displayName }}</p><p class="font-mono text-xs text-ink-500">{{ row.reference }}</p></template>
      <template #cell-event="{ row }"><span class="line-clamp-1">{{ row.event.title }}</span></template>
      <template #cell-grossSales="{ row }">{{ formatMoney(row.grossSales) }}</template>
      <template #cell-deductions="{ row }"><span class="text-xs text-ink-500" :title="`Refunds ${formatMoney(row.refunds)} · Commission ${formatMoney(row.platformCommission)} · Fees ${formatMoney(row.gatewayFees)}`">−{{ formatMoney(row.refunds + row.platformCommission + row.gatewayFees) }}</span></template>
      <template #cell-netPayable="{ row }"><span class="font-medium">{{ formatMoney(row.netPayable) }}</span></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /><p v-if="row.holdReason" class="mt-0.5 max-w-[160px] truncate text-[11px] text-amber-700" :title="row.holdReason">{{ row.holdReason }}</p></template>
      <template #cell-eligibleAt="{ row }"><span class="text-xs">{{ formatDate(row.eligibleAt) }}</span></template>
      <template #cell-actions="{ row }"><Can perm="finance.settlements"><UiDropdown v-if="row.status !== 'paid'" :items="[{ label: 'Hold', hidden: row.status === 'on_hold', onClick: () => hold(row) }, { label: 'Release', hidden: row.status !== 'on_hold', onClick: () => release(row) }]" width="w-40"><template #trigger><UiButton size="xs" variant="outline">Actions</UiButton></template></UiDropdown></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
