<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatRelativeLong } from '@/utils/format'
import type { ContentReport } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', status: 'open', targetType: 'all', priority: 'all', reason: 'all', page: 1 }, (q, signal) => adminApi.moderation.reports(q, signal))
const opt = (label: string, values: string[]) => [{ label, value: 'all' }, ...values.map((v) => ({ label: v.replace(/_/g, ' '), value: v }))]
</script>

<template>
  <div>
    <AdminPageHeader title="Moderation queue" description="Reports from users on web and mobile. Highest priority first."><UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.communities' }">Communities</UiButton></AdminPageHeader>
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'open', label: 'Open' }, { key: 'reviewing', label: 'In review' }, { key: 'actioned', label: 'Actioned' }, { key: 'dismissed', label: 'Dismissed' }, { key: 'all', label: 'All' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Content, reporter or reported user" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Type" :model-value="list.params.value.targetType" :options="opt('All content', ['message', 'user', 'event', 'vendor', 'work', 'community', 'status', 'review'])" @update:model-value="list.set({ targetType: $event })" />
      <AdminSelect label="Priority" :model-value="list.params.value.priority" :options="opt('Any priority', ['high', 'medium', 'low'])" @update:model-value="list.set({ priority: $event })" />
      <AdminSelect label="Reason" :model-value="list.params.value.reason" :options="opt('Any reason', ['spam', 'harassment', 'scam_or_fraud', 'nudity', 'false_information', 'impersonation'])" @update:model-value="list.set({ reason: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="[{ key: 'content', label: 'Reported content' }, { key: 'reason', label: 'Reason' }, { key: 'priority', label: 'Priority' }, { key: 'reporter', label: 'Reporter', hideBelow: 'lg' }, { key: 'assignedTo', label: 'Assignee', hideBelow: 'md' }, { key: 'createdAt', label: 'Reported', align: 'right' }]" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" clickable empty-title="Queue is clear 🎉" @row-click="(r: ContentReport) => router.push({ name: 'admin.report', params: { id: r.id } })" @retry="list.refresh()">
      <template #cell-content="{ row }"><div class="flex items-center gap-3"><img v-if="row.targetPreview.imageUrl" :src="row.targetPreview.imageUrl" alt="" class="h-10 w-10 rounded-lg object-cover" /><div class="min-w-0"><p class="truncate font-medium">{{ row.targetPreview.title }}</p><p class="truncate text-xs text-ink-500"><span class="capitalize">{{ row.targetType }}</span><template v-if="row.targetPreview.excerpt"> · “{{ row.targetPreview.excerpt }}”</template></p></div></div></template>
      <template #cell-reason="{ row }"><span class="text-xs capitalize">{{ row.reason.replace(/_/g, ' ') }}</span></template>
      <template #cell-priority="{ row }"><UiBadge :tone="row.priority === 'high' ? 'danger' : row.priority === 'medium' ? 'warning' : 'neutral'" size="sm">{{ row.priority }}</UiBadge></template>
      <template #cell-reporter="{ row }"><span class="text-xs">{{ row.reporter.displayName }}</span></template>
      <template #cell-assignedTo="{ row }"><span class="text-xs">{{ row.assignedTo ? row.assignedTo.firstName : 'Unassigned' }}</span></template>
      <template #cell-createdAt="{ row }"><span class="text-xs text-ink-500">{{ formatRelativeLong(row.createdAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
