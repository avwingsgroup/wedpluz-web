<script setup lang="ts">
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDateTime } from '@/utils/format'

const list = useAdminList({ search: '', event: 'all', page: 1 }, (q) => adminApi.access.securityLogs(q))
const tone = (e: string) => (e === 'login_failed' || e === 'permission_denied' ? 'danger' : e === 'login_success' ? 'success' : 'neutral')
</script>

<template>
  <div>
    <AdminPageHeader title="Login & security log" description="Authentication events for admin accounts. Repeated failures trigger an alert and temporary lockout." :back="{ name: 'admin.audit' }" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Email, IP or location" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Event" :model-value="list.params.value.event" :options="[{ label: 'All events', value: 'all' }, ...['login_success', 'login_failed', 'logout', 'password_changed', '2fa_enabled', '2fa_disabled', 'permission_denied', 'session_revoked'].map((e) => ({ label: e.replace(/_/g, ' '), value: e }))]" @update:model-value="list.set({ event: $event })" />
    </AdminFilterBar>
    <UiDataTable :columns="[{ key: 'createdAt', label: 'Time' }, { key: 'actor', label: 'Account' }, { key: 'event', label: 'Event' }, { key: 'ip', label: 'IP' }, { key: 'location', label: 'Location', hideBelow: 'md' }, { key: 'userAgent', label: 'Device', hideBelow: 'lg' }]" :rows="list.rows.value" :loading="list.loading.value" dense>
      <template #cell-createdAt="{ row }"><span class="text-xs">{{ formatDateTime(row.createdAt) }}</span></template>
      <template #cell-actor="{ row }"><span class="text-sm">{{ row.actor?.email ?? 'Unknown' }}</span></template>
      <template #cell-event="{ row }"><UiBadge :tone="tone(row.event)" size="sm">{{ row.event.replace(/_/g, ' ') }}</UiBadge></template>
      <template #cell-ip="{ row }"><span class="font-mono text-xs">{{ row.ip }}</span></template>
      <template #cell-userAgent="{ row }"><span class="text-xs text-ink-500">{{ row.userAgent }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
