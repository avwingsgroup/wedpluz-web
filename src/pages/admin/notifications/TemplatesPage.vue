<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import type { NotificationChannel, NotificationTemplate } from '@/types'

const ui = useUiStore()
const { data, loading, refresh } = useAsync(() => adminApi.notifications.templates())
const open = ref(false)
const editing = ref<NotificationTemplate | null>(null)
const form = reactive({ key: '', name: '', channel: 'email' as NotificationChannel, subject: '', body: '', isActive: true })
const variables = computed(() => [...new Set([...form.body.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]))])
function edit(t: NotificationTemplate | null) {
  editing.value = t
  Object.assign(form, t ? { key: t.key, name: t.name, channel: t.channel, subject: t.subject ?? '', body: t.body, isActive: t.isActive } : { key: '', name: '', channel: 'email', subject: '', body: '', isActive: true })
  open.value = true
}
async function save() {
  if (!form.key || !form.name || !form.body) return ui.error('Key, name and body are required')
  if (editing.value) await adminApi.notifications.updateTemplate(editing.value.id, { name: form.name, subject: form.subject || null, body: form.body, isActive: form.isActive })
  else await adminApi.notifications.createTemplate({ key: form.key, name: form.name, channel: form.channel, subject: form.subject || undefined, body: form.body })
  open.value = false
  ui.success('Template saved')
  void refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Notification templates" description="Transactional templates used by the backend (ZeptoMail, Termii/Twilio, WhatsApp Business, FCM)." :back="{ name: 'admin.campaigns' }"><Can perm="notifications.send"><UiButton size="sm" @click="edit(null)"><Plus class="h-4 w-4" />New template</UiButton></Can></AdminPageHeader>
    <UiDataTable :columns="[{ key: 'name', label: 'Template' }, { key: 'channel', label: 'Channel' }, { key: 'variables', label: 'Variables', hideBelow: 'lg' }, { key: 'isActive', label: 'Status' }, { key: 'updatedAt', label: 'Updated', hideBelow: 'md' }, { key: 'actions', label: '', align: 'right' }]" :rows="data ?? []" :loading="loading">
      <template #cell-name="{ row }"><p class="font-medium">{{ row.name }}</p><p class="font-mono text-xs text-ink-500">{{ row.key }}</p></template>
      <template #cell-channel="{ row }"><UiBadge tone="brand" size="sm">{{ row.channel }}</UiBadge></template>
      <template #cell-variables="{ row }"><span class="font-mono text-xs">{{ row.variables.join(', ') }}</span></template>
      <template #cell-isActive="{ row }"><UiBadge :tone="row.isActive ? 'success' : 'neutral'" size="sm">{{ row.isActive ? 'Active' : 'Disabled' }}</UiBadge></template>
      <template #cell-updatedAt="{ row }"><span class="text-xs">{{ formatDate(row.updatedAt) }}</span></template>
      <template #cell-actions="{ row }"><Can perm="notifications.send"><button type="button" class="p-2" aria-label="Edit template" @click="edit(row)"><Pencil class="h-4 w-4" /></button></Can></template>
    </UiDataTable>
    <UiDrawer v-model:open="open" :title="editing ? 'Edit template' : 'New template'">
      <div class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2"><UiInput v-model="form.key" label="Key" placeholder="ticket.purchased" :disabled="!!editing" /><UiSelect v-model="form.channel" label="Channel" :disabled="!!editing" :options="['email', 'push', 'sms', 'whatsapp', 'in_app'].map((c) => ({ label: c, value: c }))" /></div>
        <UiInput v-model="form.name" label="Name" />
        <UiInput v-if="form.channel === 'email' || form.channel === 'push'" v-model="form.subject" label="Subject / title" />
        <UiTextarea v-model="form.body" label="Body" :rows="8" hint="Use {{variable}} placeholders. WhatsApp templates must also be approved in Meta Business Manager." />
        <p class="text-xs text-ink-500">Detected variables: <span class="font-mono">{{ variables.join(', ') || 'none' }}</span></p>
        <UiToggle v-if="editing" v-model="form.isActive" label="Active" />
      </div>
      <template #footer><UiButton block @click="save">Save template</UiButton></template>
    </UiDrawer>
  </div>
</template>
