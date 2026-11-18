<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Mail, MessageCircle, MessageSquare, Send, Smartphone } from 'lucide-vue-next'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import type { NotificationChannel } from '@/types'

const router = useRouter()
const ui = useUiStore()
const { data: templates } = useAsync(() => adminApi.notifications.templates())
const form = reactive({ name: '', channels: ['push'] as NotificationChannel[], audienceType: 'all', eventId: '', city: '', platform: 'all', templateId: '', subject: '', body: '', schedule: false, scheduledAt: '' })
const saving = ref(false)
const channels: Array<{ key: NotificationChannel; label: string; icon: unknown; limit?: number }> = [
  { key: 'push', label: 'Push', icon: Smartphone, limit: 178 },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'SMS', icon: MessageSquare, limit: 160 },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'in_app', label: 'In-app', icon: Bell },
]
const smsLimit = computed(() => (form.channels.includes('sms') ? 160 : form.channels.includes('push') ? 178 : 2000))
function toggle(c: NotificationChannel) {
  form.channels = form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c]
}
function applyTemplate(id: string) {
  const t = templates.value?.find((x) => x.id === id)
  if (!t) return
  form.subject = t.subject ?? ''
  form.body = t.body
  if (!form.channels.includes(t.channel)) form.channels.push(t.channel)
}
async function save(sendNow: boolean) {
  if (form.name.trim().length < 3 || form.body.trim().length < 5 || !form.channels.length) return ui.error('Name, at least one channel and a message are required')
  if (form.channels.includes('email') && !form.subject) return ui.error('Email campaigns need a subject')
  if (sendNow && !(await ui.confirm({ title: 'Send campaign now?', description: 'Messages go out immediately and cannot be recalled. SMS and WhatsApp incur provider costs.', confirmLabel: 'Send now' }))) return
  saving.value = true
  try {
    const c = await adminApi.notifications.createCampaign({
      name: form.name,
      channels: form.channels,
      subject: form.subject || null,
      body: form.body,
      templateId: form.templateId || null,
      scheduledAt: form.schedule && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      audience: { type: form.audienceType as 'all', filters: Object.fromEntries(Object.entries({ eventId: form.eventId, city: form.city, platform: form.platform === 'all' ? '' : form.platform }).filter(([, v]) => v)), estimatedSize: 0 },
    })
    if (sendNow) await adminApi.notifications.sendCampaign(c.id)
    ui.success(sendNow ? 'Campaign is sending' : form.schedule ? 'Campaign scheduled' : 'Draft saved')
    router.push({ name: 'admin.campaign', params: { id: c.id } })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
async function test() {
  await adminApi.notifications.test({ channel: form.channels[0] ?? 'push', body: form.body })
  ui.success('Test sent to your admin account')
}
</script>

<template>
  <div>
    <AdminPageHeader title="New campaign" :back="{ name: 'admin.campaigns' }" />
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div class="space-y-5">
        <div class="card space-y-4 p-5">
          <UiInput v-model="form.name" label="Internal name" placeholder="December events roundup" />
          <div><p class="label">Channels</p><div class="flex flex-wrap gap-2"><button v-for="c in channels" :key="c.key" type="button" :class="cn('flex items-center gap-2 rounded-xl border px-4 py-2 text-sm', form.channels.includes(c.key) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')" @click="toggle(c.key)"><component :is="c.icon" class="h-4 w-4" />{{ c.label }}</button></div></div>
        </div>
        <div class="card space-y-4 p-5">
          <h3 class="font-semibold">Audience</h3>
          <UiSelect v-model="form.audienceType" label="Send to" :options="[{ label: 'All users', value: 'all' }, { label: 'Attendees of an event', value: 'event_attendees' }, { label: 'All organizers', value: 'organizers' }, { label: 'All vendors', value: 'vendors' }, { label: 'Custom segment', value: 'segment' }]" />
          <UiInput v-if="form.audienceType === 'event_attendees'" v-model="form.eventId" label="Event ID" placeholder="evt_..." />
          <div v-if="form.audienceType === 'segment'" class="grid gap-3 sm:grid-cols-2"><UiInput v-model="form.city" label="City" placeholder="Lagos" /><UiSelect v-model="form.platform" label="Platform" :options="[{ label: 'All', value: 'all' }, { label: 'Web', value: 'web' }, { label: 'Android', value: 'android' }, { label: 'iOS', value: 'ios' }]" /></div>
          <p class="text-xs text-ink-500">Users who opted out of a channel or topic in their notification preferences are excluded automatically.</p>
        </div>
        <div class="card space-y-4 p-5">
          <div class="flex items-center justify-between"><h3 class="font-semibold">Message</h3><UiSelect v-model="form.templateId" class="!w-56" size="sm" placeholder="Start from template" :options="(templates ?? []).map((t) => ({ label: `${t.name} (${t.channel})`, value: t.id }))" @change="applyTemplate" /></div>
          <UiInput v-if="form.channels.includes('email') || form.channels.includes('push')" v-model="form.subject" label="Subject / push title" />
          <UiTextarea v-model="form.body" label="Body" :rows="6" :maxlength="smsLimit" hint="Variables: {{first_name}}, {{event_title}}, {{city}}" />
        </div>
        <div class="card space-y-3 p-5"><UiToggle v-model="form.schedule" label="Schedule for later" /><UiInput v-if="form.schedule" v-model="form.scheduledAt" type="datetime-local" label="Send at (your local time)" /></div>
      </div>
      <aside class="space-y-4">
        <div class="card p-5"><p class="text-xs font-semibold uppercase tracking-wide text-ink-400">Push preview</p><div class="mt-3 rounded-2xl bg-ink-900 p-4 text-white"><p class="text-xs text-white/60">Wedpluz · now</p><p class="mt-1 font-semibold">{{ form.subject || 'Title' }}</p><p class="mt-0.5 line-clamp-3 text-sm text-white/85">{{ form.body || 'Your message preview appears here.' }}</p></div></div>
        <div class="card space-y-2 p-5">
          <UiButton block variant="outline" :disabled="!form.body" @click="test"><Send class="h-4 w-4" />Send test to me</UiButton>
          <UiButton block variant="secondary" :loading="saving" @click="save(false)">{{ form.schedule ? 'Schedule' : 'Save draft' }}</UiButton>
          <UiButton v-if="!form.schedule" block :loading="saving" @click="save(true)">Send now</UiButton>
        </div>
      </aside>
    </div>
  </div>
</template>
