<script setup lang="ts">
import { useRouter } from 'vue-router'
import { TriangleAlert } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDateTime, formatMoney } from '@/utils/format'
import type { AdminBookingRecord } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', status: 'all', provider: 'all', dateFrom: '', dateTo: '', page: 1 }, (q, signal) => adminApi.bookings.list(q, signal))
const columns = [
  { key: 'reference', label: 'Reference' },
  { key: 'event', label: 'Event' },
  { key: 'buyer', label: 'Buyer', hideBelow: 'md' as const },
  { key: 'total', label: 'Total', align: 'right' as const },
  { key: 'provider', label: 'Payment', hideBelow: 'lg' as const },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created', align: 'right' as const, hideBelow: 'md' as const },
]
</script>

<template>
  <div>
    <AdminPageHeader title="Bookings" description="Every ticket order across web, Android and iOS. Payment status comes from provider webhooks.">
      <UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.disputes' }">Disputes</UiButton>
      <ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="bookings" :map="(r) => ({ reference: r.reference, status: r.status, total: Number(r.total) / 100, provider: r.provider, providerReference: r.providerReference, createdAt: r.createdAt })" />
    </AdminPageHeader>
    <AdminFilterBar :search="list.params.value.search" placeholder="Reference, buyer, email, event, provider ref" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Status" :model-value="list.params.value.status" :options="[{ label: 'All statuses', value: 'all' }, ...['paid', 'pending', 'awaiting_payment', 'failed', 'cancelled', 'refund_processing', 'refunded'].map((s) => ({ label: s.replace(/_/g, ' '), value: s }))]" @update:model-value="list.set({ status: $event })" />
      <AdminSelect label="Provider" :model-value="list.params.value.provider" :options="[{ label: 'All providers', value: 'all' }, ...['paystack', 'stripe', 'paypal', 'monnify', 'wallet', 'none'].map((s) => ({ label: s === 'none' ? 'Free' : s, value: s }))]" @update:model-value="list.set({ provider: $event })" />
      <input type="date" class="field h-10 w-40 py-0 text-sm" :value="list.params.value.dateFrom" aria-label="From date" @change="list.set({ dateFrom: ($event.target as HTMLInputElement).value })" />
      <input type="date" class="field h-10 w-40 py-0 text-sm" :value="list.params.value.dateTo" aria-label="To date" @change="list.set({ dateTo: ($event.target as HTMLInputElement).value })" />
    </AdminFilterBar>
    <UiDataTable :columns="columns" :rows="list.rows.value" :loading="list.loading.value" :error="list.error.value?.message" clickable empty-title="No bookings found" @row-click="(r: AdminBookingRecord) => router.push({ name: 'admin.booking', params: { id: r.id } })" @retry="list.refresh()">
      <template #cell-reference="{ row }"><span class="flex items-center gap-1 font-mono text-xs">{{ row.reference }}<TriangleAlert v-if="row.disputeId" class="h-3.5 w-3.5 text-danger-500" aria-label="Disputed" /></span></template>
      <template #cell-event="{ row }"><span class="line-clamp-1">{{ row.event.title }}</span><span class="text-xs text-ink-500">{{ row.ticketsCount }} ticket{{ row.ticketsCount > 1 ? 's' : '' }} · {{ row.source.toUpperCase() }}</span></template>
      <template #cell-buyer="{ row }"><p class="truncate">{{ row.buyer.displayName }}</p><p class="truncate text-xs text-ink-500">{{ row.buyer.email }}</p></template>
      <template #cell-total="{ row }">{{ row.total === 0 ? 'Free' : formatMoney(row.total) }}</template>
      <template #cell-provider="{ row }"><span class="text-xs capitalize">{{ row.provider === 'none' ? '—' : row.provider }}</span></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-createdAt="{ row }"><span class="text-xs text-ink-500">{{ formatDateTime(row.createdAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
