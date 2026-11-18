<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatMoney, formatNumber } from '@/utils/format'
import type { AdminOrganizerRecord } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', type: 'all', vendorStatus: 'all', identityStatus: 'all', sort: 'grossRevenue', order: 'desc', page: 1 }, (q, signal) => adminApi.organizers.list(q, signal))
const columns = [
  { key: 'name', label: 'Organizer / vendor' },
  { key: 'type', label: 'Type', hideBelow: 'md' as const },
  { key: 'verification', label: 'Verification' },
  { key: 'eventsCount', label: 'Events', align: 'right' as const, sortable: true, hideBelow: 'lg' as const },
  { key: 'grossRevenue', label: 'Gross', align: 'right' as const, sortable: true },
  { key: 'pendingSettlement', label: 'Pending payout', align: 'right' as const, sortable: true, hideBelow: 'md' as const },
  { key: 'commissionPercent', label: 'Commission', align: 'right' as const, hideBelow: 'lg' as const },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Organizers & vendors" description="Verify businesses, configure commissions and monitor payouts."><ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="organizers" /></AdminPageHeader>
    <UiTabs class="mb-4" :model-value="list.params.value.identityStatus" :tabs="[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Awaiting verification' }, { key: 'verified', label: 'Verified' }, { key: 'failed', label: 'Rejected' }]" @update:model-value="list.set({ identityStatus: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Name, business or email" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Type" :model-value="list.params.value.type" :options="[{ label: 'All types', value: 'all' }, { label: 'Organizers', value: 'organizer' }, { label: 'Vendors', value: 'vendor' }]" @update:model-value="list.set({ type: $event })" />
      <AdminSelect label="Vendor status" :model-value="list.params.value.vendorStatus" :options="[{ label: 'Any vendor status', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Pending verification', value: 'pending_verification' }, { label: 'Suspended', value: 'suspended' }, { label: 'Rejected', value: 'rejected' }]" @update:model-value="list.set({ vendorStatus: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="columns" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" :sort="list.params.value.sort" :order="list.params.value.order === 'asc' ? 'asc' : 'desc'" clickable @update:sort="list.sortBy" @row-click="(r: AdminOrganizerRecord) => router.push({ name: 'admin.organizer', params: { id: r.id } })" @retry="list.refresh()">
      <template #cell-name="{ row }"><div class="flex items-center gap-3"><UiAvatar :src="row.user.avatarUrl" :name="row.businessName ?? row.user.displayName" size="sm" /><div class="min-w-0"><p class="truncate font-medium text-ink-900">{{ row.businessName ?? row.user.displayName }}</p><p class="truncate text-xs text-ink-500">{{ row.user.email }}</p></div></div></template>
      <template #cell-type="{ row }"><span class="text-xs capitalize">{{ row.type }}</span></template>
      <template #cell-verification="{ row }"><div class="flex flex-wrap gap-1"><UiBadge :status="row.identityStatus" size="sm" /><UiBadge v-if="row.vendorStatus" :status="row.vendorStatus" size="sm" /></div></template>
      <template #cell-eventsCount="{ row }">{{ formatNumber(row.eventsCount) }}</template>
      <template #cell-grossRevenue="{ row }">{{ formatMoney(row.grossRevenue, 'NGN', { compact: true }) }}</template>
      <template #cell-pendingSettlement="{ row }">{{ formatMoney(row.pendingSettlement, 'NGN', { compact: true }) }}</template>
      <template #cell-commissionPercent="{ row }"><span :class="row.commissionPercent !== null && 'font-medium text-brand-600'">{{ row.commissionPercent !== null ? `${row.commissionPercent}% (custom)` : 'Default' }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
