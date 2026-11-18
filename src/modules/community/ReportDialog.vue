<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleCheck } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { accountApi } from '@/services/api/account.api'
import { useUiStore } from '@/stores/ui.store'
import type { ReportReason, ReportTargetType } from '@/types'

const props = defineProps<{ open: boolean; targetType: ReportTargetType; targetId: string; allowBlock?: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; reported: [] }>()
const ui = useUiStore()
const step = ref<'reason' | 'details' | 'done'>('reason')
const reason = ref<ReportReason | null>(null)
const details = ref('')
const block = ref(false)
const submitting = ref(false)
const reasons: Array<{ label: string; value: ReportReason }> = [
  { label: 'Spam', value: 'spam' },
  { label: 'Harassment or bullying', value: 'harassment' },
  { label: 'Hate speech or symbols', value: 'hate_speech' },
  { label: 'Nudity or sexual activity', value: 'nudity' },
  { label: 'Violence or dangerous organizations', value: 'violence' },
  { label: 'Scam or fraud', value: 'scam_or_fraud' },
  { label: 'Pretending to be someone else', value: 'impersonation' },
  { label: 'False information', value: 'false_information' },
  { label: 'Intellectual property violation', value: 'intellectual_property' },
  { label: 'Something else', value: 'other' },
]
watch(() => props.open, (o) => { if (o) { step.value = 'reason'; reason.value = null; details.value = ''; block.value = false } })
async function submit() {
  if (!reason.value) return
  submitting.value = true
  try {
    await accountApi.report({ targetType: props.targetType, targetId: props.targetId, reason: reason.value, details: details.value || undefined, blockUser: block.value })
    step.value = 'done'
    emit('reported')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UiDrawer :open="open" size="sm" title="Report" @update:open="emit('update:open', $event)">
    <div v-if="step === 'reason'">
      <h3 class="text-lg font-semibold">Why are you reporting this?</h3>
      <p class="mt-1 text-sm text-ink-500">Your report is anonymous. If someone is in immediate danger, call local emergency services.</p>
      <UiRadioGroup :model-value="reason" :options="reasons" class="mt-3" @update:model-value="reason = $event as ReportReason" />
    </div>
    <div v-else-if="step === 'details'" class="space-y-4">
      <UiTextarea v-model="details" label="Tell us more (optional)" :rows="5" :maxlength="1000" placeholder="Add any details that will help our team review this report" />
      <UiCheckbox v-if="allowBlock" v-model="block" label="Also block this account" description="They won’t be able to message you or see your profile." />
    </div>
    <div v-else class="flex flex-col items-center py-10 text-center">
      <span class="flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-500"><CircleCheck class="h-8 w-8" /></span>
      <h3 class="mt-4 text-xl font-semibold">Thanks for letting us know</h3>
      <p class="mt-2 max-w-xs text-sm text-ink-500">Our moderation team will review this report. We’ll notify you if we take action.</p>
    </div>
    <template #footer>
      <UiButton v-if="step === 'reason'" block size="lg" :disabled="!reason" @click="step = 'details'">Next</UiButton>
      <div v-else-if="step === 'details'" class="grid grid-cols-2 gap-3"><UiButton variant="secondary" size="lg" @click="step = 'reason'">Back</UiButton><UiButton variant="danger" size="lg" :loading="submitting" @click="submit">Submit report</UiButton></div>
      <UiButton v-else block size="lg" @click="emit('update:open', false)">Done</UiButton>
    </template>
  </UiDrawer>
</template>
