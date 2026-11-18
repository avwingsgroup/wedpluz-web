<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BadgeCheck, Ban, RotateCcw, Shield } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatDateTime, formatMoney } from '@/utils/format'
import type { UserRole } from '@/types'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: user, loading, error, refresh } = useAsync(() => adminApi.users.get(id.value), { watch: id })
const tab = ref<'overview' | 'activity' | 'bookings' | 'reports'>('overview')
const { data: activity, loading: activityLoading } = useAsync(() => adminApi.users.activity(id.value), { watch: id })
const { data: bookings, loading: bookingsLoading } = useAsync(() => adminApi.users.tickets(id.value), { watch: id })
const { data: reports } = useAsync(() => adminApi.users.reports(id.value), { watch: id })
const rolesOpen = ref(false)
const roles = ref<UserRole[]>([])

async function suspend() {
  const reason = await ui.prompt({ title: 'Suspend account', description: 'The user is signed out on all devices and cannot log in on web or mobile until reactivated.', label: 'Reason (sent to the user and logged)', variant: 'danger', confirmLabel: 'Suspend', minLength: 10, presets: ['Repeated spam reports', 'Fraudulent payments', 'Harassment of other users', 'Impersonation'] })
  if (!reason) return
  await adminApi.users.suspend(id.value, reason)
  ui.success('Account suspended')
  void refresh()
}
async function reactivate() {
  if (!(await ui.confirm({ title: 'Reactivate this account?', confirmLabel: 'Reactivate' }))) return
  await adminApi.users.reactivate(id.value)
  ui.success('Account reactivated')
  void refresh()
}
async function saveRoles() {
  await adminApi.users.setRoles(id.value, roles.value)
  rolesOpen.value = false
  ui.success('Roles updated')
  void refresh()
}
async function decideDeletion(decision: 'approve' | 'reject') {
  if (!(await ui.confirm({ title: decision === 'approve' ? 'Approve deletion now?' : 'Reject deletion request?', description: decision === 'approve' ? 'Personal data will be anonymised. Financial records are retained for compliance.' : undefined, variant: decision === 'approve' ? 'danger' : 'default', confirmLabel: decision === 'approve' ? 'Delete account' : 'Reject' }))) return
  await adminApi.users.decideDeletion(id.value, decision)
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !user" page />
    <template v-else>
      <AdminPageHeader :title="user.displayName" :back="{ name: 'admin.users' }">
        <template #meta><div class="mt-2 flex flex-wrap items-center gap-2"><UiBadge :status="user.status" /><UiBadge :status="user.identityStatus" /><span class="text-sm text-ink-500">Joined {{ formatDate(user.createdAt) }} via {{ user.signupSource.toUpperCase() }}</span></div></template>
        <Can perm="users.manage"><UiButton variant="outline" size="sm" @click="roles = [...user.roles]; rolesOpen = true"><Shield class="h-4 w-4" />Roles</UiButton></Can>
        <Can perm="users.suspend">
          <UiButton v-if="user.status === 'suspended'" size="sm" @click="reactivate"><RotateCcw class="h-4 w-4" />Reactivate</UiButton>
          <UiButton v-else variant="danger" size="sm" @click="suspend"><Ban class="h-4 w-4" />Suspend</UiButton>
        </Can>
      </AdminPageHeader>

      <div v-if="user.status === 'suspended' && user.suspendedReason" class="mb-4 rounded-2xl border border-danger-500/40 bg-danger-50 p-4 text-sm"><strong>Suspended:</strong> {{ user.suspendedReason }}</div>
      <div v-if="user.deletionRequest?.status === 'pending'" class="mb-4 flex flex-col gap-3 rounded-2xl border border-warning-500/40 bg-warning-50 p-4 text-sm sm:flex-row sm:items-center"><p class="flex-1">Deletion requested {{ formatDate(user.deletionRequest.requestedAt) }}, scheduled for {{ formatDate(user.deletionRequest.scheduledFor) }}.</p><Can perm="users.manage"><div class="flex gap-2"><UiButton size="sm" variant="outline" @click="decideDeletion('reject')">Reject</UiButton><UiButton size="sm" variant="danger" @click="decideDeletion('approve')">Delete now</UiButton></div></Can></div>

      <div class="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="space-y-4">
          <div class="card flex flex-col items-center p-6 text-center"><UiAvatar :src="user.avatarUrl" :name="user.displayName" size="xl" /><p class="mt-3 flex items-center gap-1 font-semibold">{{ user.displayName }}<BadgeCheck v-if="user.isVerified" class="h-4 w-4 fill-success-500 text-white" /></p><p class="text-sm text-ink-500">@{{ user.username ?? '—' }}</p></div>
          <KeyValueList title="Account" :items="[{ label: 'Email', value: user.email }, { label: 'Email verified', value: user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'No' }, { label: 'Phone', value: user.phone }, { label: 'City', value: user.city }, { label: 'Plan', value: user.plan }, { label: 'Roles', value: user.roles.join(', ') }, { label: 'Last seen', value: user.lastSeenAt ? formatDateTime(user.lastSeenAt) : '—' }, { label: 'User ID', value: user.id, mono: true }]" />
        </aside>
        <section>
          <div class="grid gap-4 sm:grid-cols-4">
            <div class="card p-4"><p class="text-xs text-ink-500">Tickets</p><p class="mt-1 text-xl font-semibold">{{ user.ticketsCount }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Events created</p><p class="mt-1 text-xl font-semibold">{{ user.eventsCount }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Total spent</p><p class="mt-1 text-xl font-semibold">{{ formatMoney(user.totalSpent) }}</p></div>
            <div class="card p-4"><p class="text-xs text-ink-500">Reports</p><p class="mt-1 text-xl font-semibold" :class="user.reportsCount ? 'text-danger-500' : ''">{{ user.reportsCount }}</p></div>
          </div>
          <UiTabs v-model="tab" class="mt-6" :tabs="[{ key: 'overview', label: 'Overview' }, { key: 'activity', label: 'Activity' }, { key: 'bookings', label: 'Bookings', count: bookings?.meta.total }, { key: 'reports', label: 'Reports', count: reports?.length }]" />
          <div class="mt-4">
            <div v-if="tab === 'overview'" class="card p-5 text-sm"><p class="font-medium">Interests</p><div class="mt-2 flex flex-wrap gap-2"><span v-for="i in user.interests" :key="i" class="chip">{{ i }}</span><span v-if="!user.interests.length" class="text-ink-500">None</span></div></div>
            <div v-else-if="tab === 'activity'" class="card divide-y divide-ink-100"><p v-if="activityLoading" class="p-4 text-sm text-ink-500">Loading…</p><div v-for="a in activity?.data ?? []" :key="a.id" class="flex items-center gap-3 px-4 py-3 text-sm"><span class="w-16 text-xs uppercase text-ink-400">{{ a.source }}</span><span class="flex-1">{{ a.description }}</span><span class="text-xs text-ink-500">{{ formatDateTime(a.createdAt) }}</span></div></div>
            <UiDataTable v-else-if="tab === 'bookings'" :columns="[{ key: 'reference', label: 'Reference' }, { key: 'event', label: 'Event' }, { key: 'total', label: 'Total', align: 'right' }, { key: 'status', label: 'Status' }]" :rows="bookings?.data ?? []" :loading="bookingsLoading" clickable empty-title="No bookings" @row-click="(r) => router.push({ name: 'admin.booking', params: { id: r.id } })">
              <template #cell-event="{ row }">{{ row.event.title }}</template><template #cell-total="{ row }">{{ formatMoney(row.total) }}</template><template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
            </UiDataTable>
            <div v-else class="card divide-y divide-ink-100"><p v-if="!reports?.length" class="p-6 text-center text-sm text-ink-500">No reports involving this user</p><RouterLink v-for="r in reports ?? []" :key="r.id" :to="{ name: 'admin.report', params: { id: r.id } }" class="flex items-center gap-3 px-4 py-3 text-sm hover:bg-ink-50"><UiBadge :status="r.status" size="sm" /><span class="flex-1 capitalize">{{ r.reason.replace(/_/g, ' ') }} · {{ r.targetType }}</span><span class="text-xs text-ink-500">{{ r.reporter.id === user.id ? 'Reported by user' : 'Against user' }}</span></RouterLink></div>
          </div>
        </section>
      </div>
      <UiModal v-model:open="rolesOpen" title="Platform roles" size="sm">
        <div class="space-y-3"><UiCheckbox v-for="r in (['organizer', 'vendor'] as UserRole[])" :key="r" :model-value="roles.includes(r)" :label="r[0]!.toUpperCase() + r.slice(1)" @update:model-value="(v) => (roles = v ? [...roles, r] : roles.filter((x) => x !== r))" /><p class="text-xs text-ink-500">All accounts keep the base “user” role. Admin access is managed under Access &amp; audit.</p></div>
        <template #footer><UiButton block @click="saveRoles">Save roles</UiButton></template>
      </UiModal>
    </template>
  </div>
</template>
