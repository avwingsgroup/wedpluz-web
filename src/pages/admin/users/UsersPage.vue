<script setup lang="ts">
import { useRouter } from 'vue-router'
import { BadgeCheck } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDate, formatMoney } from '@/utils/format'
import type { AdminUserRecord } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', status: 'all', role: 'all', identityStatus: 'all', plan: 'all', source: 'all', sort: 'createdAt', order: 'desc', page: 1 }, (q, signal) => adminApi.users.list(q, signal))
const columns = [
  { key: 'displayName', label: 'User', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'identityStatus', label: 'Identity', hideBelow: 'md' as const },
  { key: 'roles', label: 'Roles', hideBelow: 'lg' as const },
  { key: 'plan', label: 'Plan', hideBelow: 'lg' as const },
  { key: 'signupSource', label: 'Source', hideBelow: 'lg' as const },
  { key: 'totalSpent', label: 'Spent', align: 'right' as const, sortable: true, hideBelow: 'md' as const },
  { key: 'createdAt', label: 'Joined', sortable: true, align: 'right' as const },
]
const opts = (label: string, values: string[]) => [{ label, value: 'all' }, ...values.map((v) => ({ label: v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), value: v }))]
</script>

<template>
  <div>
    <AdminPageHeader title="Users" :description="`${list.meta.value.total.toLocaleString()} accounts across web, Android and iOS`">
      <ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="users" :map="(r) => ({ id: r.id, name: r.displayName, email: r.email, status: r.status, identity: r.identityStatus, plan: r.plan, source: r.signupSource, joined: r.createdAt })" />
    </AdminPageHeader>
    <AdminFilterBar :search="list.params.value.search" placeholder="Name, email, username or phone" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Status" :model-value="list.params.value.status" :options="opts('All statuses', ['active', 'suspended', 'deactivated', 'pending_deletion'])" @update:model-value="list.set({ status: $event })" />
      <AdminSelect label="Role" :model-value="list.params.value.role" :options="opts('All roles', ['user', 'organizer', 'vendor'])" @update:model-value="list.set({ role: $event })" />
      <AdminSelect label="Identity" :model-value="list.params.value.identityStatus" :options="opts('Any identity', ['verified', 'pending', 'unverified', 'failed'])" @update:model-value="list.set({ identityStatus: $event })" />
      <AdminSelect label="Plan" :model-value="list.params.value.plan" :options="opts('All plans', ['free', 'basic', 'premium', 'premium_plus'])" @update:model-value="list.set({ plan: $event })" />
      <AdminSelect label="Source" :model-value="list.params.value.source" :options="opts('All platforms', ['web', 'android', 'ios'])" @update:model-value="list.set({ source: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="columns" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" :sort="list.params.value.sort" :order="list.params.value.order === 'asc' ? 'asc' : 'desc'" clickable empty-title="No users match these filters" @update:sort="list.sortBy" @row-click="(r: AdminUserRecord) => router.push({ name: 'admin.user', params: { id: r.id } })" @retry="list.refresh()">
      <template #cell-displayName="{ row }"><div class="flex items-center gap-3"><UiAvatar :src="row.avatarUrl" :name="row.displayName" size="sm" /><div class="min-w-0"><p class="flex items-center gap-1 truncate font-medium text-ink-900">{{ row.displayName }}<BadgeCheck v-if="row.isVerified" class="h-4 w-4 fill-success-500 text-white" /></p><p class="truncate text-xs text-ink-500">{{ row.email }}</p></div></div></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-identityStatus="{ row }"><UiBadge :status="row.identityStatus" size="sm" /></template>
      <template #cell-roles="{ row }"><span class="text-xs capitalize">{{ row.roles.filter((r: string) => r !== 'user').join(', ') || 'User' }}</span></template>
      <template #cell-plan="{ row }"><span class="text-xs capitalize">{{ row.plan.replace('_', ' ') }}</span></template>
      <template #cell-signupSource="{ row }"><span class="text-xs uppercase text-ink-500">{{ row.signupSource }}</span></template>
      <template #cell-totalSpent="{ row }">{{ formatMoney(row.totalSpent) }}</template>
      <template #cell-createdAt="{ row }"><span class="text-xs text-ink-500">{{ formatDate(row.createdAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
