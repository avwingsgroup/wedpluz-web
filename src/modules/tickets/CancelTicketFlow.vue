<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleCheck } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import { ticketingApi } from '@/services/api/ticketing.api'
import { useUiStore } from '@/stores/ui.store'
import { formatMoney } from '@/utils/format'
import type { CancelReason, Ticket } from '@/types'

const props = defineProps<{ open: boolean; ticket: Ticket }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; cancelled: [ticket: Ticket] }>()
const ui = useUiStore()

const step = ref<'reason' | 'confirm' | 'done'>('reason')
const reason = ref<CancelReason | null>(null)
const note = ref('')
const submitting = ref(false)
const result = ref<Ticket | null>(null)

const reasons = [
  { label: 'Event no longer interests me', value: 'no_longer_interested' },
  { label: 'Bad Weather / Unforeseen Conditions', value: 'bad_weather' },
  { label: 'Technical or Venue Problems', value: 'technical_or_venue' },
  { label: 'Booked the wrong event', value: 'wrong_event' },
  { label: 'Scheduling Conflict', value: 'scheduling_conflict' },
  { label: 'Health or Safety Concerns', value: 'health_or_safety' },
  { label: 'Personal Reasons', value: 'personal' },
  { label: 'Other', value: 'other' },
]
watch(() => props.open, (o) => { if (o) { step.value = 'reason'; reason.value = null; note.value = ''; result.value = null } })

async function confirm() {
  if (!reason.value) return
  submitting.value = true
  try {
    result.value = await ticketingApi.cancel(props.ticket.id, { reason: reason.value, note: note.value || undefined })
    step.value = 'done'
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}
function finish() {
  if (result.value) emit('cancelled', result.value)
  emit('update:open', false)
}
</script>

<template>
  <UiDrawer :open="open" size="sm" :title="step === 'done' ? '' : 'Cancel Ticket'" @update:open="emit('update:open', $event)">
    <div v-if="step === 'reason'">
      <h3 class="text-2xl font-bold">Select a reason</h3>
      <p class="mt-1 text-sm text-ink-500">Could you share the reason for the cancellation? This would help us understand the situation better.</p>
      <UiRadioGroup :model-value="reason" :options="reasons" class="mt-4" @update:model-value="reason = $event as CancelReason" />
      <UiTextarea v-if="reason === 'other'" v-model="note" class="mt-3" placeholder="Tell us more (optional)" :rows="3" :maxlength="300" />
    </div>
    <div v-else-if="step === 'confirm'" class="space-y-4">
      <h3 class="text-2xl font-bold">Cancel this ticket?</h3>
      <p class="text-sm text-ink-500">{{ ticket.event.title }}</p>
      <div class="card space-y-2 p-4 text-sm">
        <div class="flex justify-between"><span class="text-ink-500">Ticket</span><span>{{ ticket.ticketTypeName }} · {{ ticket.code }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">Paid</span><span>{{ ticket.orderTotal === 0 ? 'Free' : formatMoney(ticket.orderTotal, ticket.currency) }}</span></div>
        <div v-if="ticket.orderTotal > 0" class="flex justify-between font-medium"><span>Refund (subject to organizer policy)</span><span>{{ formatMoney(ticket.orderTotal, ticket.currency) }}</span></div>
      </div>
      <p class="text-xs text-ink-500">Cancelling releases your seat immediately. Refund eligibility and the final amount are confirmed by Wedpluz after review, and this cannot be undone.</p>
    </div>
    <div v-else class="flex flex-col items-center py-10 text-center">
      <span class="flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-500"><CircleCheck class="h-8 w-8" /></span>
      <h3 class="mt-4 text-2xl font-bold">Ticket cancelled</h3>
      <p class="mt-2 max-w-xs text-sm text-ink-500">{{ ticket.orderTotal > 0 ? 'Your refund is being processed. We’ll notify you when it is complete.' : 'You’re no longer registered for this event.' }}</p>
    </div>
    <template #footer>
      <UiButton v-if="step === 'reason'" variant="danger" size="lg" block :disabled="!reason" @click="step = 'confirm'">Cancel Ticket</UiButton>
      <div v-else-if="step === 'confirm'" class="grid grid-cols-2 gap-3">
        <UiButton variant="secondary" size="lg" @click="step = 'reason'">Back</UiButton>
        <UiButton variant="danger" size="lg" :loading="submitting" @click="confirm">Yes, cancel</UiButton>
      </div>
      <UiButton v-else size="lg" block @click="finish">Done</UiButton>
    </template>
  </UiDrawer>
</template>
