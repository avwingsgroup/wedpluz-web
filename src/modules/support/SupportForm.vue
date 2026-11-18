<script setup lang="ts">
import { z } from 'zod'
import { CircleCheck } from 'lucide-vue-next'
import { ref } from 'vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useForm } from '@/composables/useForm'
import { accountApi } from '@/services/api/account.api'

const sent = ref<string | null>(null)
const schema = z.object({ subject: z.string().trim().min(4, 'Add a short subject'), category: z.string().min(1, 'Choose a topic'), message: z.string().trim().min(20, 'Describe the issue in at least 20 characters') })
const form = useForm({
  initialValues: { subject: '', category: '', message: '' },
  schema,
  onSubmit: (v) => accountApi.createSupportTicket(v),
  onSuccess: (t) => (sent.value = t.reference),
})
</script>

<template>
  <div v-if="sent" class="card flex flex-col items-center p-8 text-center">
    <span class="flex h-14 w-14 items-center justify-center rounded-full bg-success-50 text-success-500"><CircleCheck class="h-7 w-7" /></span>
    <h3 class="mt-3 text-lg font-semibold">Request received</h3>
    <p class="mt-1 text-sm text-ink-500">Reference <strong>{{ sent }}</strong>. We usually reply within 24 hours by email.</p>
    <UiButton class="mt-4" variant="outline" @click="sent = null; form.reset()">Send another</UiButton>
  </div>
  <form v-else class="space-y-4" novalidate @submit.prevent="form.submit()">
    <UiSelect v-model="form.values.category" label="Topic" placeholder="What do you need help with?" :options="[{ label: 'Payments & refunds', value: 'payment' }, { label: 'Tickets', value: 'ticket' }, { label: 'My account', value: 'account' }, { label: 'Events', value: 'event' }, { label: 'Vendors', value: 'vendor' }, { label: 'Report a bug', value: 'bug' }, { label: 'Something else', value: 'other' }]" :error="form.fieldError('category')" />
    <UiInput v-model="form.values.subject" label="Subject" :error="form.fieldError('subject')" @blur="form.touch('subject')" />
    <UiTextarea v-model="form.values.message" label="Message" :rows="6" :maxlength="2000" placeholder="Include order or ticket references if relevant" :error="form.fieldError('message')" @blur="form.touch('message')" />
    <UiButton type="submit" size="lg" :loading="form.submitting.value">Send message</UiButton>
  </form>
</template>
