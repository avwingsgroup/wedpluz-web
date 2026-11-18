<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAdminList } from '@/modules/admin/useAdminList'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import type { AdminUserRecord } from '@/types'

const router = useRouter()
const ui = useUiStore()
const list = useAdminList({ search: '', page: 1 }, (q) => adminApi.users.deletionRequests(Number(q.page)))
async function decide(u: AdminUserRecord, decision: 'approve' | 'reject') {
  if (!(await ui.confirm({ title: decision === 'approve' ? `Delete ${u.displayName} now?` : 'Reject this request?', variant: decision === 'approve' ? 'danger' : 'default', confirmLabel: decision === 'approve' ? 'Delete' : 'Reject' }))) return
  await adminApi.users.decideDeletion(u.id, decision)
  ui.success(decision === 'approve' ? 'Account deleted' : 'Request rejected')
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Account deletion requests" description="Accounts are deleted automatically after the 30-day grace period. Approve early only on verified user request." />
    <UiDataTable :columns="[{ key: 'user', label: 'User' }, { key: 'requested', label: 'Requested' }, { key: 'scheduled', label: 'Scheduled for' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No pending deletion requests">
      <template #cell-user="{ row }"><button type="button" class="flex items-center gap-3 text-left" @click="router.push({ name: 'admin.user', params: { id: row.id } })"><UiAvatar :src="row.avatarUrl" :name="row.displayName" size="sm" /><div><p class="font-medium">{{ row.displayName }}</p><p class="text-xs text-ink-500">{{ row.email }}</p></div></button></template>
      <template #cell-requested="{ row }">{{ row.deletionRequest ? formatDate(row.deletionRequest.requestedAt) : '—' }}</template>
      <template #cell-scheduled="{ row }">{{ row.deletionRequest ? formatDate(row.deletionRequest.scheduledFor) : '—' }}</template>
      <template #cell-status="{ row }"><UiBadge :status="row.deletionRequest?.status ?? 'pending'" size="sm" /></template>
      <template #cell-actions="{ row }"><Can perm="users.manage"><div v-if="row.deletionRequest?.status === 'pending'" class="flex justify-end gap-2"><UiButton size="xs" variant="outline" @click="decide(row, 'reject')">Reject</UiButton><UiButton size="xs" variant="danger" @click="decide(row, 'approve')">Delete now</UiButton></div></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
