<script setup lang="ts">
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDateTime } from '@/utils/format'

const list = useAdminList({ search: '', page: 1 }, (q) => adminApi.bookings.checkIns(q))
const resultLabel: Record<string, string> = { ok: 'Valid', already_checked_in: 'Duplicate scan', not_found: 'Not found' }
</script>

<template>
  <div>
    <AdminPageHeader title="QR ticket validations" description="Every scan from organizer apps and the web scanner. Repeated failures may indicate ticket fraud." :back="{ name: 'admin.bookings' }" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Event, attendee or ticket code" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'checkedInAt', label: 'Time' }, { key: 'event', label: 'Event' }, { key: 'attendee', label: 'Attendee' }, { key: 'ticketCode', label: 'Ticket', hideBelow: 'md' }, { key: 'scanner', label: 'Scanned by', hideBelow: 'lg' }, { key: 'result', label: 'Result' }]" :rows="list.rows.value" :loading="list.loading.value" empty-title="No scans">
      <template #cell-checkedInAt="{ row }"><span class="text-xs">{{ formatDateTime(row.checkedInAt) }}</span></template>
      <template #cell-event="{ row }"><span class="line-clamp-1">{{ row.event.title }}</span></template>
      <template #cell-attendee="{ row }"><div class="flex items-center gap-2"><UiAvatar :src="row.attendee.avatarUrl" :name="row.attendee.displayName" size="xs" />{{ row.attendee.displayName }}</div></template>
      <template #cell-ticketCode="{ row }"><span class="font-mono text-xs">{{ row.ticketCode }}</span></template>
      <template #cell-scanner="{ row }"><span class="text-xs">{{ row.checkedInBy.displayName }} · {{ row.method }} · {{ row.device }}</span></template>
      <template #cell-result="{ row }"><UiBadge :tone="row.result === 'ok' ? 'success' : 'danger'" size="sm">{{ resultLabel[row.result] ?? row.result }}</UiBadge></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
