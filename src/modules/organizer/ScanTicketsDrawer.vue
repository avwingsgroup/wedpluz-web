<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { CircleCheck, CircleX, QrCode, Keyboard } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { formatRelativeLong } from '@/utils/format'
import type { CheckInRecord, TicketValidationResult } from '@/types'

/**
 * QR check-in. Uses the native BarcodeDetector where available (Chrome/Android, Safari 17+)
 * and falls back to manual code entry. Validation is always performed by the backend,
 * which enforces event ownership, day, and duplicate check-ins.
 */
const props = defineProps<{ open: boolean; eventId: string }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; checkedIn: [] }>()
const video = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const manual = ref(false)
const code = ref('')
const result = ref<TicketValidationResult | null>(null)
const validating = ref(false)
const recent = ref<CheckInRecord[]>([])
const loadingRecent = ref(false)
const cameraError = ref<string | null>(null)
let raf: number | null = null
let detector: { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } | null = null
let lastCode = ''

const reasonText: Record<TicketValidationResult['reason'], string> = { ok: 'Checked in', already_checked_in: 'Already checked in', cancelled: 'Ticket cancelled', wrong_event: 'Ticket is for another event', not_found: 'Ticket not found', expired: 'Ticket expired', wrong_day: 'Not valid today' }

async function loadRecent() {
  loadingRecent.value = true
  try {
    recent.value = (await organizerApi.checkIns(props.eventId)).data.slice(0, 5)
  } finally {
    loadingRecent.value = false
  }
}
async function startCamera() {
  cameraError.value = null
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => typeof detector }).BarcodeDetector
  if (!BD) {
    manual.value = true
    cameraError.value = 'QR scanning isn’t supported on this browser. Enter the ticket code instead.'
    return
  }
  try {
    detector = new BD({ formats: ['qr_code'] })
    stream.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
      scanLoop()
    }
  } catch {
    manual.value = true
    cameraError.value = 'Camera access denied. Enter the ticket code instead.'
  }
}
function scanLoop() {
  raf = requestAnimationFrame(async () => {
    if (!video.value || !detector || validating.value) return scanLoop()
    try {
      const codes = await detector.detect(video.value)
      const value = codes[0]?.rawValue
      if (value && value !== lastCode) {
        lastCode = value
        await validate(value, 'scan')
        setTimeout(() => (lastCode = ''), 3000)
      }
    } catch {
      /* frame not ready */
    }
    scanLoop()
  })
}
function stopCamera() {
  if (raf) cancelAnimationFrame(raf)
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
}
async function validate(value: string, method: 'scan' | 'manual') {
  validating.value = true
  try {
    result.value = await organizerApi.validateTicket(props.eventId, { code: value, method })
    if (result.value.valid) {
      navigator.vibrate?.(80)
      emit('checkedIn')
      void loadRecent()
    } else navigator.vibrate?.([60, 60, 60])
    code.value = ''
  } finally {
    validating.value = false
  }
}
watch(() => props.open, (o) => {
  result.value = null
  if (o) {
    void loadRecent()
    if (!manual.value) void startCamera()
  } else stopCamera()
})
watch(manual, (m) => (m ? stopCamera() : props.open && startCamera()))
onBeforeUnmount(stopCamera)
</script>

<template>
  <UiDrawer :open="open" title="Scan Tickets" @update:open="emit('update:open', $event)">
    <div class="mx-auto max-w-sm rounded-2xl border border-ink-100 bg-ink-50 p-5 text-center">
      <div v-if="!manual" class="relative mx-auto aspect-square w-64 overflow-hidden rounded-2xl border-2 border-brand-600 bg-ink-900">
        <video ref="video" playsinline muted class="h-full w-full object-cover" />
        <div v-if="!stream" class="absolute inset-0 flex items-center justify-center"><span class="flex h-14 w-14 items-center justify-center rounded-xl bg-pink-100 text-brand-600"><QrCode class="h-7 w-7" /></span></div>
        <span class="absolute inset-x-6 top-1/2 h-0.5 animate-pulse bg-brand-500" />
      </div>
      <form v-else class="space-y-3 text-left" @submit.prevent="code && validate(code.trim(), 'manual')">
        <UiInput v-model="code" label="Ticket code" placeholder="e.g. DT78-216-M0" autocomplete="off" />
        <UiButton type="submit" block :loading="validating" :disabled="!code">Validate ticket</UiButton>
      </form>
      <p v-if="cameraError" class="mt-3 text-xs text-danger-500">{{ cameraError }}</p>
      <template v-if="!manual"><p class="mt-4 font-medium">Point camera at ticket QR</p><p class="text-sm text-ink-500">The ticket will be validated instantly</p></template>
      <button type="button" class="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline" @click="manual = !manual"><Keyboard v-if="!manual" class="h-4 w-4" /><QrCode v-else class="h-4 w-4" />{{ manual ? 'Scan QR instead' : 'Enter code manually instead' }}</button>
    </div>

    <div v-if="result" :class="['mx-auto mt-4 flex max-w-sm items-center gap-3 rounded-2xl p-4', result.valid ? 'bg-success-50' : 'bg-danger-50']" role="status" aria-live="assertive">
      <CircleCheck v-if="result.valid" class="h-8 w-8 shrink-0 text-success-500" /><CircleX v-else class="h-8 w-8 shrink-0 text-danger-500" />
      <div class="min-w-0"><p class="font-semibold">{{ reasonText[result.reason] }}</p><p v-if="result.ticket" class="truncate text-sm text-ink-600">{{ result.ticket.holderName }} · {{ result.ticket.ticketTypeName }}<template v-if="result.ticket.seat"> · {{ result.ticket.seat.tableLabel }}, {{ result.ticket.seat.seatLabel }}</template></p></div>
    </div>

    <h3 class="mt-8 font-medium">Recent check-ins</h3>
    <div class="card mt-3 divide-y divide-ink-100">
      <template v-if="loadingRecent"><div v-for="i in 3" :key="i" class="px-4"><UiSkeleton variant="row" /></div></template>
      <UiEmptyState v-else-if="!recent.length" title="No check-ins yet" compact illustration="tickets" />
      <div v-for="c in recent" v-else :key="c.id" class="flex items-center gap-3 px-4 py-3"><UiAvatar :src="c.attendee.avatarUrl" :name="c.attendee.displayName" /><div class="flex-1"><p class="text-sm">{{ c.attendee.displayName }}</p><p class="text-xs text-ink-500">{{ c.ticketTypeName }}</p></div><span class="text-sm text-ink-500">{{ formatRelativeLong(c.checkedInAt) }}</span></div>
    </div>
  </UiDrawer>
</template>
