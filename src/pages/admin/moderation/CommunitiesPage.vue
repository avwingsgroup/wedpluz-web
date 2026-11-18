<script setup lang="ts">
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatNumber } from '@/utils/format'
import type { AdminCommunityRecord } from '@/types'

const ui = useUiStore()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.moderation.communities(q))
async function act(c: AdminCommunityRecord, action: 'suspend' | 'restore' | 'archive') {
  if (!(await ui.confirm({ title: `${action[0]!.toUpperCase()}${action.slice(1)} ${c.name}?`, description: action === 'suspend' ? 'Members can no longer post or view new messages until restored.' : undefined, variant: action === 'suspend' ? 'danger' : 'default', confirmLabel: action }))) return
  await adminApi.moderation.communityAct(c.id, action)
  void list.refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Communities" description="Event and private group chats. Monitor engagement and moderate abusive groups." :back="{ name: 'admin.moderation' }" />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'suspended', label: 'Suspended' }, { key: 'archived', label: 'Archived' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Community, owner or event" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'name', label: 'Community' }, { key: 'owner', label: 'Owner', hideBelow: 'md' }, { key: 'membersCount', label: 'Members', align: 'right' }, { key: 'messagesLast7d', label: 'Msgs (7d)', align: 'right', hideBelow: 'md' }, { key: 'reportsOpen', label: 'Open reports', align: 'right' }, { key: 'status', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No communities">
      <template #cell-name="{ row }"><div class="flex items-center gap-3"><UiAvatar :src="row.avatarUrl" :name="row.name" size="sm" /><div class="min-w-0"><p class="truncate font-medium">{{ row.name }}</p><p class="truncate text-xs text-ink-500">{{ row.event?.title ?? 'Private group' }} · since {{ formatDate(row.createdAt) }}</p></div></div></template>
      <template #cell-owner="{ row }">{{ row.owner.displayName }}</template>
      <template #cell-membersCount="{ row }">{{ formatNumber(row.membersCount) }}</template>
      <template #cell-messagesLast7d="{ row }">{{ formatNumber(row.messagesLast7d) }}</template>
      <template #cell-reportsOpen="{ row }"><span :class="row.reportsOpen ? 'font-semibold text-danger-500' : ''">{{ row.reportsOpen }}</span></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-actions="{ row }"><Can perm="moderation.act"><UiButton v-if="row.status === 'active'" size="xs" variant="outline" class="text-danger-500" @click="act(row, 'suspend')">Suspend</UiButton><UiButton v-else size="xs" variant="outline" @click="act(row, 'restore')">Restore</UiButton></Can></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
