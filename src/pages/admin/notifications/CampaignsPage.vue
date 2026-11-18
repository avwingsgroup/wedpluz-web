<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminFilterBar from '@/modules/admin/AdminFilterBar.vue'
import Can from '@/modules/admin/Can.vue'
import { useAdminList } from '@/modules/admin/useAdminList'
import { adminApi } from '@/services/api/admin.api'
import { formatDateTime, formatNumber, formatPercent } from '@/utils/format'
import type { NotificationCampaign } from '@/types'

const router = useRouter()
const list = useAdminList({ search: '', status: 'all', page: 1 }, (q) => adminApi.notifications.campaigns(q))
const rate = (a: number, b: number) => (b ? formatPercent((a / b) * 100, 1) : '—')
</script>

<template>
  <div>
    <AdminPageHeader title="Notification campaigns" description="Push, email, SMS, WhatsApp and in-app broadcasts.">
      <UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.templates' }">Templates</UiButton>
      <Can perm="notifications.send"><UiButton size="sm" :to="{ name: 'admin.campaign.new' }"><Plus class="h-4 w-4" />New campaign</UiButton></Can>
    </AdminPageHeader>
    <UiTabs class="mb-4" :model-value="list.params.value.status" :tabs="[{ key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' }, { key: 'scheduled', label: 'Scheduled' }, { key: 'sending', label: 'Sending' }, { key: 'sent', label: 'Sent' }]" @update:model-value="list.set({ status: $event })" />
    <AdminFilterBar :search="list.params.value.search" placeholder="Campaign name or subject" @update:search="list.set({ search: $event })" @reset="list.reset()" />
    <UiDataTable :columns="[{ key: 'name', label: 'Campaign' }, { key: 'channels', label: 'Channels' }, { key: 'audience', label: 'Audience', align: 'right', hideBelow: 'md' }, { key: 'delivered', label: 'Delivered', align: 'right', hideBelow: 'lg' }, { key: 'opened', label: 'Open rate', align: 'right', hideBelow: 'lg' }, { key: 'status', label: 'Status' }, { key: 'when', label: 'When', align: 'right', hideBelow: 'md' }]" :rows="list.rows.value" :loading="list.loading.value" clickable empty-title="No campaigns" @row-click="(r: NotificationCampaign) => router.push({ name: 'admin.campaign', params: { id: r.id } })">
      <template #cell-name="{ row }"><p class="font-medium">{{ row.name }}</p><p class="truncate text-xs text-ink-500">{{ row.subject ?? row.body }}</p></template>
      <template #cell-channels="{ row }"><div class="flex flex-wrap gap-1"><UiBadge v-for="c in row.channels" :key="c" size="sm" tone="brand">{{ c.replace('_', '-') }}</UiBadge></div></template>
      <template #cell-audience="{ row }">{{ formatNumber(row.audience.estimatedSize) }}</template>
      <template #cell-delivered="{ row }">{{ rate(row.stats.delivered, row.stats.sent) }}</template>
      <template #cell-opened="{ row }">{{ rate(row.stats.opened, row.stats.delivered) }}</template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-when="{ row }"><span class="text-xs text-ink-500">{{ row.sentAt ? formatDateTime(row.sentAt) : row.scheduledAt ? `Scheduled ${formatDateTime(row.scheduledAt)}` : formatDateTime(row.createdAt) }}</span></template>
    </UiDataTable>
    <UiPagination class="mt-4" :page="list.meta.value.page" :last-page="list.meta.value.lastPage" :total="list.meta.value.total" :per-page="list.meta.value.perPage" @update:page="list.set({ page: $event })" />
  </div>
</template>
