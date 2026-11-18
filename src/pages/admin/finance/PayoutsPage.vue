<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime, formatMoney } from '@/utils/format'
import type { Payout } from '@/types'

const admin = useAdminStore()
const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.finance.payouts(q))
const approving = ref<Payout | null>(null)
const otp = ref('')
const otpError = ref<string | null>(null)
const busy = ref(false)

async function approve() {
  if (!approving.value) return
  busy.value = true
  otpError.value = null
  try {
    await adminApi.finance.approvePayout(approving.value.id, otp.value)
    ui.success('Payout approved', 'Transfer sent to the provider. Status updates via webhook.')
    approving.value = null
    void list.refresh()
  } catch (e) {
    otpError.value = (e as Error).message
    otp.value = ''
  } finally {
    busy.value = false
  }
}
async function reject(p: Payout) {
  const reason = await ui.prompt({ title: 'Reject payout', label: 'Reason', variant: 'danger', confirmLabel: 'Reject', minLength: 5 })
  if (!reason) return
  await adminApi.finance.rejectPayout(p.id, reason)
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Payouts" description="Bank transfers to organizers. Every payout needs a second approver (four-eyes) and 2FA." :back="{ name: 'admin.finance' }" />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'requested', label: 'Awaiting approval' }, { key: 'processing', label: 'Processing' }, { key: 'paid', label: 'Paid' }, { key: 'failed', label: 'Failed' }, { key: 'rejected', label: 'Rejected' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Reference or organizer" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'reference', label: 'Reference' }, { key: 'organizer', label: 'Organizer' }, { key: 'bank', label: 'Destination', hideBelow: 'lg' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'requestedBy', label: 'Requested by', hideBelow: 'md' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No payouts">
      <template #cell-reference="{ row }"><span class="font-mono text-xs">{{ row.reference }}</span><p class="text-xs text-ink-500">{{ formatDateTime(row.createdAt) }}</p></template>
      <template #cell-organizer="{ row }">{{ row.organizer.businessName ?? row.organizer.displayName }}</template>
      <template #cell-bank="{ row }"><span class="text-xs">{{ row.bankAccount.bankName }} ····{{ row.bankAccount.accountNumber.slice(-4) }} · {{ row.provider }}</span></template>
      <template #cell-amount="{ row }"><span class="font-medium">{{ formatMoney(row.amount) }}</span></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-requestedBy="{ row }"><span class="text-xs">{{ row.requestedBy ? `${row.requestedBy.firstName} ${row.requestedBy.lastName}` : 'System' }}</span></template>
      <template #cell-actions="{ row }"><Can perm="finance.payouts.approve"><div v-if="row.status === 'requested'" class="flex justify-end gap-2"><UiButton size="xs" variant="outline" @click="reject(row)">Reject</UiButton><UiButton size="xs" :disabled="row.requestedBy?.id === admin.admin?.id" :title="row.requestedBy?.id === admin.admin?.id ? 'You requested this payout' : undefined" @click="approving = row; otp = ''; otpError = null">Approve</UiButton></div></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
    <UiModal :open="!!approving" title="Approve payout" size="sm" @update:open="approving = null">
      <div v-if="approving" class="space-y-4">
        <KeyValueList :items="[{ label: 'Organizer', value: approving.organizer.businessName ?? approving.organizer.displayName }, { label: 'Amount', value: formatMoney(approving.amount) }, { label: 'Account', value: `${approving.bankAccount.accountName} · ${approving.bankAccount.bankName} ${approving.bankAccount.accountNumber}` }, { label: 'Settlements', value: approving.settlementIds.length }]" />
        <div class="text-center"><ShieldCheck class="mx-auto h-8 w-8 text-brand-600" /><p class="mt-2 text-sm text-ink-600">Enter your authenticator code to release funds</p><UiOtpInput v-model="otp" class="mt-4" :error="otpError ?? undefined" /></div>
      </div>
      <template #footer><UiButton block :disabled="otp.length < 4" :loading="busy" @click="approve">Approve &amp; send</UiButton></template>
    </UiModal>
  </div>
</template>
