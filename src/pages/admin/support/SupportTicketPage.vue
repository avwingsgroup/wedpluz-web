<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Send, UserCheck } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import AdminSelect from '@/modules/admin/AdminSelect.vue'
import KeyValueList from '@/modules/admin/KeyValueList.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { SupportTicket } from '@/types'

const route = useRoute()
const ui = useUiStore()
const id = computed(() => String(route.params.id))
const { data: t, loading, error, refresh } = useAsync(() => adminApi.support.ticket(id.value), { watch: id })
const reply = ref('')
const sending = ref(false)
const macros = ['Thanks for reaching out. We’re looking into this and will update you within 24 hours.', 'We’ve re-sent your tickets to your email. Please check your spam folder as well.', 'Your refund has been approved and should reach your account in 3–7 business days.']

async function send() {
  if (reply.value.trim().length < 2) return
  sending.value = true
  try {
    await adminApi.support.reply(id.value, reply.value)
    reply.value = ''
    ui.success('Reply sent', 'The customer is notified by email and in-app.')
    void refresh()
  } finally {
    sending.value = false
  }
}
async function update(patch: { status?: SupportTicket['status']; priority?: SupportTicket['priority']; assignToMe?: boolean }) {
  await adminApi.support.update(id.value, patch)
  void refresh()
}
</script>

<template>
  <div>
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !t" page />
    <template v-else>
      <AdminPageHeader :title="t.subject" :back="{ name: 'admin.support' }">
        <template #meta><div class="mt-2 flex gap-2"><UiBadge :status="t.status" /><span class="font-mono text-sm text-ink-500">{{ t.reference }}</span></div></template>
        <Can perm="support.manage"><UiButton v-if="!t.assignedTo" variant="outline" size="sm" @click="update({ assignToMe: true })"><UserCheck class="h-4 w-4" />Assign to me</UiButton></Can>
      </AdminPageHeader>
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section class="space-y-4">
          <div v-for="m in t.messages" :key="m.id" :class="cn('flex gap-3', m.isStaff && 'flex-row-reverse')">
            <UiAvatar :src="m.author.avatarUrl" :name="m.author.displayName" size="sm" />
            <div :class="cn('max-w-[80%] rounded-2xl p-4', m.isStaff ? 'bg-brand-50' : 'bg-white shadow-sm')"><p class="text-xs font-medium" :class="m.isStaff ? 'text-brand-700' : 'text-ink-700'">{{ m.author.displayName }}{{ m.isStaff ? ' · Support' : '' }}</p><p class="mt-1 whitespace-pre-line text-sm">{{ m.body }}</p><p class="mt-2 text-[11px] text-ink-400">{{ formatDateTime(m.createdAt) }}</p></div>
          </div>
          <Can perm="support.manage">
            <div class="card p-4">
              <div class="mb-2 flex flex-wrap gap-2"><button v-for="m in macros" :key="m" type="button" class="chip max-w-[260px] truncate px-3 py-1" :title="m" @click="reply = m">{{ m }}</button></div>
              <UiTextarea v-model="reply" :rows="4" placeholder="Write a reply…" :maxlength="4000" />
              <div class="mt-3 flex justify-end gap-2"><UiButton variant="outline" size="sm" @click="update({ status: 'resolved' })">Mark resolved</UiButton><UiButton size="sm" :loading="sending" :disabled="!reply.trim()" @click="send"><Send class="h-4 w-4" />Send reply</UiButton></div>
            </div>
          </Can>
        </section>
        <aside class="space-y-4">
          <div class="card flex items-center gap-3 p-4"><UiAvatar :src="t.user.avatarUrl" :name="t.user.displayName" /><div class="min-w-0 flex-1"><p class="font-medium">{{ t.user.displayName }}</p><p class="truncate text-xs text-ink-500">{{ t.user.email }}</p></div><UiButton size="xs" variant="soft" :to="{ name: 'admin.user', params: { id: t.user.id } }">Profile</UiButton></div>
          <KeyValueList :items="[{ label: 'Topic', value: t.category }, { label: 'Source', value: t.source }, { label: 'Created', value: formatDateTime(t.createdAt) }, { label: 'Agent', value: t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : 'Unassigned' }]" />
          <Can perm="support.manage"><div class="card space-y-3 p-4"><p class="text-sm font-medium">Status &amp; priority</p><AdminSelect label="Status" :model-value="t.status" :options="['open', 'pending', 'resolved', 'closed'].map((s) => ({ label: s, value: s }))" @update:model-value="update({ status: $event as SupportTicket['status'] })" /><AdminSelect label="Priority" :model-value="t.priority" :options="['low', 'medium', 'high', 'urgent'].map((s) => ({ label: s, value: s }))" @update:model-value="update({ priority: $event as SupportTicket['priority'] })" /></div></Can>
        </aside>
      </div>
    </template>
  </div>
</template>
