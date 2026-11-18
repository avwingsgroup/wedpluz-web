<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatRelativeLong } from '@/utils/format'
import type { SupportTicket } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', status: 'open', category: 'all', priority: 'all', page: 1 }, (q) => adminApi.support.tickets(q))
</script>

<template>
  <div>
    <AdminPageHeader title="Customer support" description="Requests from the web Help center, mobile apps and support email." />
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'open', label: 'Open' }, { key: 'pending', label: 'Awaiting customer' }, { key: 'resolved', label: 'Resolved' }, { key: 'closed', label: 'Closed' }, { key: 'all', label: 'All' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Reference, subject or customer" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Category" :model-value="list.params.value.category" :options="[{ label: 'All topics', value: 'all' }, ...['payment', 'ticket', 'account', 'event', 'vendor', 'bug', 'other'].map((c) => ({ label: c, value: c }))]" @update:model-value="list.set({ category: $event })" />
      <AdminSelect label="Priority" :model-value="list.params.value.priority" :options="[{ label: 'Any priority', value: 'all' }, ...['urgent', 'high', 'medium', 'low'].map((c) => ({ label: c, value: c }))]" @update:model-value="list.set({ priority: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="[{ key: 'subject', label: 'Request' }, { key: 'user', label: 'Customer', hideBelow: 'md' }, { key: 'category', label: 'Topic', hideBelow: 'lg' }, { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'assignedTo', label: 'Agent', hideBelow: 'lg' }, { key: 'updatedAt', label: 'Updated', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" clickable empty-title="No requests here" @row-click="(r: SupportTicket) => router.push({ name: 'admin.support.ticket', params: { id: r.id } })">
      <template #cell-subject="{ row }"><p class="font-medium">{{ row.subject }}</p><p class="font-mono text-xs text-ink-500">{{ row.reference }} · {{ row.source }}</p></template>
      <template #cell-user="{ row }"><p class="text-sm">{{ row.user.displayName }}</p><p class="text-xs text-ink-500">{{ row.user.email }}</p></template>
      <template #cell-category="{ row }"><span class="text-xs capitalize">{{ row.category }}</span></template>
      <template #cell-priority="{ row }"><UiBadge :tone="row.priority === 'urgent' || row.priority === 'high' ? 'danger' : row.priority === 'medium' ? 'warning' : 'neutral'" size="sm">{{ row.priority }}</UiBadge></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-assignedTo="{ row }"><span class="text-xs">{{ row.assignedTo?.firstName ?? 'Unassigned' }}</span></template>
      <template #cell-updatedAt="{ row }"><span class="text-xs text-ink-500">{{ formatRelativeLong(row.updatedAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
