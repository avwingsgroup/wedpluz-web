<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Ban, CircleCheck, EyeOff, RotateCcw, TriangleAlert, UserCheck } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: r, loading, error, refresh } = useAsync(() => adminApi.moderation.report(id.value), { watch: id })

async function act(action: 'removed' | 'restored' | 'warned' | 'suspended' | 'dismissed') {
  const labels = { removed: 'Remove content', restored: 'Restore content', warned: 'Warn user', suspended: 'Suspend user', dismissed: 'Dismiss report' }
  const note = await ui.prompt({ title: labels[action], description: action === 'suspended' ? 'The reported account is suspended on all platforms.' : undefined, label: 'Moderator note (logged; shared with the user for warnings/removals)', variant: ['removed', 'suspended'].includes(action) ? 'danger' : 'default', confirmLabel: labels[action], minLength: 5 })
  if (!note) return
  await adminApi.moderation.act(id.value, { action, note })
  ui.success('Action recorded')
  void refresh()
}
async function assign() {
  await adminApi.moderation.updateReport(id.value, { assignToMe: true, status: 'reviewing' })
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !r" page />
    <template v-else>
      <AdminPageHeader :title="`Report · ${r.reason.replace(/_/g, ' ')}`" :back="{ name: 'admin.moderation' }">
        <template #meta><div class="mt-2 flex gap-2"><UiBadge :status="r.status" /><UiBadge :tone="r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warning' : 'neutral'">{{ r.priority }} priority</UiBadge></div></template>
        <Can perm="moderation.view"><UiButton v-if="!r.assignedTo" variant="outline" size="sm" @click="assign"><UserCheck class="h-4 w-4" />Assign to me</UiButton></Can>
      </AdminPageHeader>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section class="space-y-4">
          <div class="card p-5">
            <p class="text-xs font-semibold uppercase tracking-wide text-ink-400">Reported {{ r.targetType }}</p>
            <div class="mt-3 flex gap-4"><img v-if="r.targetPreview.imageUrl" :src="r.targetPreview.imageUrl" alt="" class="h-32 w-32 rounded-xl object-cover" /><div><p class="text-lg font-semibold">{{ r.targetPreview.title }}</p><p v-if="r.targetPreview.excerpt" class="mt-2 rounded-xl bg-ink-50 p-3 text-sm italic">“{{ r.targetPreview.excerpt }}”</p></div></div>
          </div>
          <div class="card p-5"><p class="text-sm font-medium">Reporter’s details</p><p class="mt-1 text-sm text-ink-600">{{ r.details ?? 'No additional details provided.' }}</p></div>
          <div v-if="r.resolution" class="card border-success-500/30 bg-success-50 p-5 text-sm"><p class="flex items-center gap-2 font-semibold capitalize"><CircleCheck class="h-4 w-4 text-success-600" />{{ r.resolution.action }} by {{ r.resolution.by }}</p><p class="mt-1">{{ r.resolution.note }}</p><p class="mt-1 text-xs text-ink-500">{{ formatDateTime(r.resolution.at) }}</p></div>
          <Can perm="moderation.act">
            <div v-if="r.status !== 'actioned' && r.status !== 'dismissed'" class="card p-5">
              <p class="mb-3 font-semibold">Take action</p>
              <div class="flex flex-wrap gap-2">
                <UiButton variant="danger" size="sm" @click="act('removed')"><EyeOff class="h-4 w-4" />Remove content</UiButton>
                <UiButton variant="outline" size="sm" @click="act('warned')"><TriangleAlert class="h-4 w-4" />Warn user</UiButton>
                <UiButton variant="outline" size="sm" class="text-danger-500" @click="act('suspended')"><Ban class="h-4 w-4" />Suspend user</UiButton>
                <UiButton variant="ghost" size="sm" @click="act('dismissed')">Dismiss</UiButton>
              </div>
            </div>
            <UiButton v-else-if="r.resolution?.action === 'removed'" variant="outline" size="sm" @click="act('restored')"><RotateCcw class="h-4 w-4" />Restore content</UiButton>
          </Can>
          <div v-if="r.history.length" class="card"><h3 class="border-b border-ink-100 px-5 py-3 font-semibold">Other reports against this user ({{ r.history.length }})</h3><button v-for="h in r.history" :key="h.id" type="button" class="flex w-full justify-between px-5 py-3 text-left text-sm hover:bg-ink-50" @click="router.push({ name: 'admin.report', params: { id: h.id } })"><span class="capitalize">{{ h.reason.replace(/_/g, ' ') }} · {{ h.targetType }}</span><UiBadge :status="h.status" size="sm" /></button></div>
        </section>
        <aside class="space-y-4">
          <div v-if="r.reportedUser" class="card flex items-center gap-3 p-4"><UiAvatar :src="r.reportedUser.avatarUrl" :name="r.reportedUser.displayName" /><div class="min-w-0 flex-1"><p class="text-xs text-ink-500">Reported user</p><p class="truncate font-medium">{{ r.reportedUser.displayName }}</p></div><UiButton size="xs" variant="soft" :to="{ name: 'admin.user', params: { id: r.reportedUser.id } }">Profile</UiButton></div>
          <KeyValueList :items="[{ label: 'Reporter', value: r.reporter.displayName }, { label: 'Reported', value: formatDateTime(r.createdAt) }, { label: 'Assignee', value: r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : 'Unassigned' }, { label: 'Target ID', value: r.targetId, mono: true }]" />
        </aside>
      </div>
    </template>
  </div>
</template>
