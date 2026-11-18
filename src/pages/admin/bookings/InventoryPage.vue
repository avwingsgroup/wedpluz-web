<script setup lang="ts">
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDate, formatMoney } from '@/utils/format'
import { cn } from '@/utils/cn'

const list = useAdminList({ search: '', page: 1 }, (q) => adminApi.bookings.inventory(q))
</script>

<template>
  <div>
    <AdminPageHeader title="Ticket inventory" description="Live availability per ticket type for upcoming events." :back="{ name: 'admin.bookings' }" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Event or ticket type" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'event', label: 'Event' }, { key: 'ticketType', label: 'Ticket type' }, { key: 'price', label: 'Price', align: 'right', hideBelow: 'md' }, { key: 'sold', label: 'Sold / capacity', align: 'right' }, { key: 'sellThrough', label: 'Sell-through' }, { key: 'salesEndAt', label: 'Sales end', hideBelow: 'lg' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No live inventory">
      <template #cell-event="{ row }"><p class="line-clamp-1">{{ row.event.title }}</p><p class="text-xs text-ink-500">{{ formatDate(row.event.startsAt) }}</p></template>
      <template #cell-price="{ row }">{{ row.price === 0 ? 'Free' : formatMoney(row.price) }}</template>
      <template #cell-sold="{ row }">{{ row.sold.toLocaleString() }} / {{ row.quantity.toLocaleString() }}</template>
      <template #cell-sellThrough="{ row }"><div class="flex items-center gap-2"><div class="h-2 w-24 overflow-hidden rounded-full bg-ink-100"><div :class="cn('h-full rounded-full', row.sellThrough >= 90 ? 'bg-danger-500' : row.sellThrough >= 60 ? 'bg-warning-500' : 'bg-brand-600')" :style="{ width: `${row.sellThrough}%` }" /></div><span class="text-xs">{{ row.sellThrough }}%</span></div></template>
      <template #cell-salesEndAt="{ row }"><span class="text-xs">{{ row.salesEndAt ? formatDate(row.salesEndAt) : '—' }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
