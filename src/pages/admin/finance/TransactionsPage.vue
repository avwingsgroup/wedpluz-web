<script setup lang="ts">
import { ref } from 'vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatMoney } from '@/utils/format'
import type { FinanceTransaction } from '@/types'

const ui = useUiStore()
const list = useAdminList({ search: '', type: 'all', provider: 'all', status: 'all', reconciliationStatus: 'all', dateFrom: '', dateTo: '', page: 1 }, (q, signal) => adminApi.finance.transactions(q, signal))
const detail = ref<FinanceTransaction | null>(null)
const opt = (label: string, values: string[]) => [{ label, value: 'all' }, ...values.map((v) => ({ label: v.replace(/_/g, ' '), value: v }))]
async function reconcile(status: 'matched' | 'mismatch') {
  if (!detail.value) return
  const note = await ui.prompt({ title: status === 'matched' ? 'Mark as matched' : 'Flag mismatch', label: 'Reconciliation note', placeholder: 'Matched against Paystack settlement report 2026-11-14', minLength: 5 })
  if (!note) return
  detail.value = await adminApi.finance.reconcile(detail.value.id, { status, note })
  ui.success('Reconciliation recorded')
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Transactions" description="Ledger of all money movement: ticket sales, refunds, payouts, top-ups, withdrawals and subscriptions." :back="{ name: 'admin.finance' }"><ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="transactions" :map="(r) => ({ reference: r.reference, providerReference: r.providerReference, type: r.type, provider: r.provider, amount: Number(r.amount) / 100, fee: Number(r.fee) / 100, status: r.status, reconciliation: r.reconciliationStatus, createdAt: r.createdAt })" /></AdminPageHeader>
    <AdminFilterBar :search="list.params.value.search" placeholder="Reference, provider ref, user or event" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Type" :model-value="list.params.value.type" :options="opt('All types', ['ticket_sale', 'refund', 'payout', 'top_up', 'withdrawal', 'subscription', 'commission', 'chargeback'])" @update:model-value="list.set({ type: $event })" />
      <AdminSelect label="Provider" :model-value="list.params.value.provider" :options="opt('All providers', ['paystack', 'stripe', 'paypal', 'monnify', 'wallet'])" @update:model-value="list.set({ provider: $event })" />
      <AdminSelect label="Status" :model-value="list.params.value.status" :options="opt('All statuses', ['successful', 'pending', 'failed', 'reversed'])" @update:model-value="list.set({ status: $event })" />
      <AdminSelect label="Reconciliation" :model-value="list.params.value.reconciliationStatus" :options="opt('Any reconciliation', ['matched', 'unmatched', 'mismatch', 'pending'])" @update:model-value="list.set({ reconciliationStatus: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="[{ key: 'reference', label: 'Reference' }, { key: 'type', label: 'Type' }, { key: 'provider', label: 'Provider', hideBelow: 'md' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'net', label: 'Net', align: 'right', hideBelow: 'lg' }, { key: 'status', label: 'Status' }, { key: 'reconciliationStatus', label: 'Recon', hideBelow: 'md' }, { key: 'createdAt', label: 'Date', align: 'right', hideBelow: 'lg' }]" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" clickable dense @row-click="(r: FinanceTransaction) => (detail = r)" @retry="list.refresh()">
      <template #cell-reference="{ row }"><span class="font-mono text-xs">{{ row.reference }}</span></template>
      <template #cell-type="{ row }"><span class="text-xs capitalize">{{ row.type.replace(/_/g, ' ') }}</span></template>
      <template #cell-provider="{ row }"><span class="text-xs capitalize">{{ row.provider }}</span></template>
      <template #cell-amount="{ row }">{{ formatMoney(row.amount) }}</template>
      <template #cell-net="{ row }">{{ formatMoney(row.net) }}</template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-reconciliationStatus="{ row }"><UiBadge :status="row.reconciliationStatus" size="sm" /></template>
      <template #cell-createdAt="{ row }"><span class="text-xs text-ink-500">{{ formatDateTime(row.createdAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
    <UiDrawer :open="!!detail" :title="detail?.reference" size="sm" @update:open="detail = null">
      <template v-if="detail">
        <KeyValueList :items="[{ label: 'Type', value: detail.type.replace(/_/g, ' ') }, { label: 'Amount', value: formatMoney(detail.amount) }, { label: 'Fee', value: formatMoney(detail.fee) }, { label: 'Net', value: formatMoney(detail.net) }, { label: 'Status', value: detail.status }, { label: 'Provider', value: detail.provider }, { label: 'Provider ref', value: detail.providerReference, mono: true }, { label: 'User', value: detail.user?.displayName }, { label: 'Event', value: detail.event?.title }, { label: 'Created', value: formatDateTime(detail.createdAt) }, { label: 'Reconciliation', value: detail.reconciliationStatus }]" />
      </template>
      <template v-if="detail" #footer><Can perm="finance.reconcile"><div class="grid grid-cols-2 gap-3"><UiButton variant="outline" @click="reconcile('mismatch')">Flag mismatch</UiButton><UiButton @click="reconcile('matched')">Mark matched</UiButton></div></Can></template>
    </UiDrawer>
  </div>
</template>
