<script setup lang="ts">
import { ref } from 'vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import ExportButton from '@/modules/admin/ExportButton.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDateTime } from '@/utils/format'
import type { AuditLogEntry } from '@/types'

const list = useAdminList({ search: '', module: 'all', dateFrom: '', dateTo: '', page: 1 }, (q, signal) => adminApi.access.auditLogs(q, signal))
const detail = ref<AuditLogEntry | null>(null)
</script>

<template>
  <div>
    <AdminPageHeader title="Audit log" description="Immutable record of every administrative action. Retained for 7 years."><ExportButton :rows="list.rows.value as unknown as Record<string, unknown>[]" filename="audit-log" :map="(r) => ({ at: r.createdAt, actor: (r.actor as AuditLogEntry['actor'])?.email ?? 'system', action: r.action, module: r.module, target: r.targetLabel, ip: r.ip, correlationId: r.correlationId })" /></AdminPageHeader>
    <AdminFilterBar :search="list.params.value.search" placeholder="Action, target, admin email or correlation ID" :active-count="list.activeCount.value" @update:search="list.set({ search: $event })" @reset="list.reset()">
      <AdminSelect label="Module" :model-value="list.params.value.module" :options="[{ label: 'All modules', value: 'all' }, ...['users', 'events', 'organizers', 'bookings', 'finance', 'moderation', 'notifications', 'settings', 'access'].map((m) => ({ label: m, value: m }))]" @update:model-value="list.set({ module: $event })" />
      <input type="date" class="field h-10 w-40 py-0 text-sm" :value="list.params.value.dateFrom" aria-label="From date" @change="list.set({ dateFrom: ($event.target as HTMLInputElement).value })" />
      <input type="date" class="field h-10 w-40 py-0 text-sm" :value="list.params.value.dateTo" aria-label="To date" @change="list.set({ dateTo: ($event.target as HTMLInputElement).value })" />
    </AdminFilterBar>
    <UiDataTable :columns="[{ key: 'createdAt', label: 'Time' }, { key: 'actor', label: 'Admin' }, { key: 'action', label: 'Action' }, { key: 'target', label: 'Target', hideBelow: 'md' }, { key: 'ip', label: 'IP', hideBelow: 'lg' }]" :rows="list.rows.value" :loading="list.loading.value" clickable dense @row-click="(r: AuditLogEntry) => (detail = r)">
      <template #cell-createdAt="{ row }"><span class="text-xs">{{ formatDateTime(row.createdAt) }}</span></template>
      <template #cell-actor="{ row }"><div class="flex items-center gap-2"><UiAvatar :src="row.actor?.avatarUrl" :name="row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : 'System'" size="xs" /><span class="text-sm">{{ row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : 'System' }}</span></div></template>
      <template #cell-action="{ row }"><UiBadge size="sm" tone="neutral">{{ row.module }}</UiBadge> <span class="font-mono text-xs">{{ row.action }}</span></template>
      <template #cell-target="{ row }"><span class="line-clamp-1 text-sm">{{ row.targetLabel ?? row.targetId }}</span></template>
      <template #cell-ip="{ row }"><span class="font-mono text-xs">{{ row.ip }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
    <UiDrawer :open="!!detail" title="Audit entry" size="sm" @update:open="detail = null">
      <template v-if="detail">
        <KeyValueList :items="[{ label: 'Action', value: detail.action, mono: true }, { label: 'Module', value: detail.module }, { label: 'Admin', value: detail.actor?.email ?? 'System' }, { label: 'Target', value: `${detail.targetType}: ${detail.targetLabel ?? detail.targetId}` }, { label: 'Time', value: formatDateTime(detail.createdAt) }, { label: 'IP', value: detail.ip, mono: true }, { label: 'User agent', value: detail.userAgent }, { label: 'Correlation ID', value: detail.correlationId, mono: true }]" />
        <div v-if="detail.before || detail.after" class="mt-4 grid gap-3 sm:grid-cols-2"><div><p class="mb-1 text-xs font-semibold text-ink-500">Before</p><pre class="overflow-x-auto rounded-xl bg-ink-50 p-3 text-xs">{{ JSON.stringify(detail.before, null, 2) }}</pre></div><div><p class="mb-1 text-xs font-semibold text-ink-500">After</p><pre class="overflow-x-auto rounded-xl bg-ink-50 p-3 text-xs">{{ JSON.stringify(detail.after, null, 2) }}</pre></div></div>
      </template>
    </UiDrawer>
  </div>
</template>
