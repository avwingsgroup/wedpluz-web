<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Camera, CircleCheck, CircleX, IdCard, LoaderCircle, Upload } from 'lucide-vue-next'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import { cn } from '@/utils/cn'
import type { IdentityVerification, IdentityVerificationRequest } from '@/types'

/**
 * Two-step identity verification (ID number + selfie). The selfie is captured with the
 * camera (or uploaded as a fallback), uploaded to /uploads, and the backend calls the
 * identity provider (Primely, pending confirmation). The result is never decided client-side.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; done: [result: IdentityVerification] }>()
const auth = useAuthStore()
const ui = useUiStore()

const step = ref<'id' | 'selfie' | 'verifying' | 'success' | 'failed'>('id')
const idType = ref<IdentityVerificationRequest['idType']>('nin')
const idNumber = ref('')
const idError = ref<string | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const stream = ref<MediaStream | null>(null)
const selfieBlob = ref<Blob | null>(null)
const selfieUrl = ref<string | null>(null)
const cameraError = ref<string | null>(null)
const result = ref<IdentityVerification | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const types: Array<{ value: IdentityVerificationRequest['idType']; label: string; placeholder: string }> = [
  { value: 'nin', label: 'National Identification Number (NIN)', placeholder: 'Enter your NIN' },
  { value: 'passport', label: 'International Passport', placeholder: 'Enter passport number' },
  { value: 'drivers_license', label: 'Driver’s License', placeholder: 'Enter license number' },
  { value: 'resident_card', label: 'Permanent Resident Card', placeholder: 'Enter card number' },
]

watch(() => props.open, (o) => {
  if (o) {
    step.value = 'id'
    idNumber.value = ''
    selfieBlob.value = null
    selfieUrl.value = null
  } else stopCamera()
})

function toSelfie() {
  if (idNumber.value.replace(/\s/g, '').length < 8) {
    idError.value = 'Enter a valid ID number'
    return
  }
  idError.value = null
  step.value = 'selfie'
  void startCamera()
}
async function startCamera() {
  cameraError.value = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 720, height: 720 }, audio: false })
    if (video.value) {
      video.value.srcObject = stream.value
      await video.value.play()
    }
  } catch {
    cameraError.value = 'We couldn’t access your camera. Allow camera access or upload a clear selfie instead.'
  }
}
function stopCamera() {
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
}
function capture() {
  if (!video.value) return
  const canvas = document.createElement('canvas')
  canvas.width = video.value.videoWidth || 720
  canvas.height = video.value.videoHeight || 720
  canvas.getContext('2d')?.drawImage(video.value, 0, 0)
  canvas.toBlob((b) => {
    if (!b) return
    selfieBlob.value = b
    selfieUrl.value = URL.createObjectURL(b)
    stopCamera()
  }, 'image/jpeg', 0.9)
}
function onFile(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  selfieBlob.value = f
  selfieUrl.value = URL.createObjectURL(f)
}
function retake() {
  selfieBlob.value = null
  selfieUrl.value = null
  void startCamera()
}
async function submit() {
  if (!selfieBlob.value) return
  step.value = 'verifying'
  try {
    const file = new File([selfieBlob.value], 'selfie.jpg', { type: 'image/jpeg' })
    const upload = await accountApi.upload(file, 'identity_selfie')
    result.value = await accountApi.submitIdentity({ idType: idType.value, idNumber: idNumber.value.trim(), selfieUploadId: upload.id })
    await auth.refreshUser()
    step.value = result.value.status === 'verified' ? 'success' : result.value.status === 'failed' ? 'failed' : 'success'
    emit('done', result.value)
  } catch (e) {
    if (isApiError(e) && e.isValidation) {
      idError.value = e.fieldError('idNumber') ?? e.message
      step.value = 'id'
    } else {
      ui.error((e as Error).message)
      step.value = 'selfie'
    }
  }
}
onBeforeUnmount(stopCamera)
</script>

<template>
  <UiModal :open="open" size="md" @update:open="emit('update:open', $event)">
    <div v-if="step === 'id' || step === 'selfie'" class="mb-6 grid grid-cols-2 gap-3">
      <span :class="cn('flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm', step === 'id' ? 'border-brand-600 text-brand-600' : 'border-ink-200 text-ink-500')"><span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">1</span>Choose ID</span>
      <span :class="cn('flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm', step === 'selfie' ? 'border-brand-600 text-brand-600' : 'border-ink-200 text-ink-500')"><span class="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">2</span>Selfie</span>
    </div>

    <div v-if="step === 'id'">
      <p class="mb-3 font-medium">Select your ID type</p>
      <div class="space-y-2">
        <label v-for="t in types" :key="t.value" :class="cn('block cursor-pointer rounded-2xl', idType === t.value && 'border border-ink-200 p-3')">
          <span class="flex items-center justify-between py-2"><span class="text-[15px]">{{ t.label }}</span><input v-model="idType" type="radio" :value="t.value" class="h-5 w-5 accent-brand-600" /></span>
          <div v-if="idType === t.value" class="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-ink-300 p-3"><IdCard class="h-6 w-6 text-ink-400" /><UiInput v-model="idNumber" :placeholder="t.placeholder" :error="idError ?? undefined" class="flex-1" /></div>
        </label>
      </div>
    </div>

    <div v-else-if="step === 'selfie'" class="text-center">
      <h3 class="text-lg font-semibold">Take a selfie</h3>
      <p class="mt-1 text-sm text-ink-500">Make sure your face is well lit and fills the frame. Remove glasses or hats.</p>
      <div class="relative mx-auto mt-5 aspect-square w-64 overflow-hidden rounded-full border-4 border-brand-200 bg-ink-100">
        <img v-if="selfieUrl" :src="selfieUrl" alt="Selfie preview" class="h-full w-full object-cover" />
        <video v-else ref="video" playsinline muted class="h-full w-full -scale-x-100 object-cover" />
        <div v-if="!selfieUrl && !stream && !cameraError" class="absolute inset-0 flex items-center justify-center"><LoaderCircle class="h-8 w-8 animate-spin text-brand-600" /></div>
      </div>
      <p v-if="cameraError" class="mt-3 text-sm text-danger-500">{{ cameraError }}</p>
      <input ref="fileInput" type="file" accept="image/*" capture="user" class="sr-only" @change="onFile(($event.target as HTMLInputElement).files)" />
      <div class="mt-4 flex justify-center gap-3">
        <UiButton v-if="!selfieUrl && stream" @click="capture"><Camera class="h-4 w-4" />Capture</UiButton>
        <UiButton v-if="selfieUrl" variant="outline" @click="retake">Retake</UiButton>
        <UiButton v-if="!selfieUrl" variant="outline" @click="fileInput?.click()"><Upload class="h-4 w-4" />Upload instead</UiButton>
      </div>
    </div>

    <div v-else-if="step === 'verifying'" class="flex flex-col items-center py-12 text-center"><LoaderCircle class="h-12 w-12 animate-spin text-brand-600" /><h3 class="mt-4 text-xl font-semibold">Verifying identity…</h3><p class="mt-1 text-sm text-ink-500">This usually takes less than a minute.</p></div>
    <div v-else-if="step === 'success'" class="flex flex-col items-center py-10 text-center"><CircleCheck class="h-14 w-14 text-success-500" /><h3 class="mt-4 text-xl font-semibold">{{ result?.status === 'pending' ? 'Verification in progress' : 'Identity verification successful' }}</h3><p class="mt-1 text-sm text-ink-500">{{ result?.status === 'pending' ? 'We’ll notify you once your identity is confirmed.' : 'You now have a verified badge on your profile.' }}</p></div>
    <div v-else class="flex flex-col items-center py-10 text-center"><CircleX class="h-14 w-14 text-danger-500" /><h3 class="mt-4 text-xl font-semibold">Verification failed</h3><p class="mt-1 max-w-xs text-sm text-ink-500">{{ result?.failureReason ?? 'We couldn’t verify your identity.' }}</p></div>

    <template #footer>
      <UiButton v-if="step === 'id'" size="lg" block :variant="idNumber ? 'primary' : 'secondary'" :disabled="!idNumber" @click="toSelfie">Continue</UiButton>
      <div v-else-if="step === 'selfie'" class="grid w-full grid-cols-2 gap-3"><UiButton variant="secondary" size="lg" @click="step = 'id'; stopCamera()">Back</UiButton><UiButton size="lg" :disabled="!selfieBlob" @click="submit">Submit</UiButton></div>
      <UiButton v-else-if="step === 'failed'" size="lg" block @click="step = 'id'">Try again</UiButton>
      <UiButton v-else-if="step === 'success'" size="lg" block @click="emit('update:open', false)">Done</UiButton>
    </template>
  </UiModal>
</template>
