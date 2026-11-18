<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CircleCheck } from 'lucide-vue-next'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useCountdown } from '@/composables/useCountdown'
import { authApi } from '@/services/api/auth.api'
import { isApiError } from '@/services/http'
import { useUiStore } from '@/stores/ui.store'
import { OTP_RESEND_SECONDS } from '@/config/app'
import type { VerifyOtpPayload } from '@/types'

/** Reusable 4-digit code step shared by email verification, password reset and wallet setup. */
const props = withDefaults(defineProps<{ email: string; purpose: VerifyOtpPayload['purpose']; title?: string; autoSend?: boolean; successTitle?: string }>(), { title: 'Verify your email', autoSend: true, successTitle: 'Code correct' })
const emit = defineEmits<{ verified: [resetToken: string | null] }>()
const ui = useUiStore()
const code = ref('')
const error = ref<string | null>(null)
const verifying = ref(false)
const sending = ref(false)
const sent = ref(false)
const done = ref(false)
const countdown = useCountdown(OTP_RESEND_SECONDS)

async function send(showToast = false) {
  sending.value = true
  try {
    await authApi.sendOtp(props.email, props.purpose)
    sent.value = true
    countdown.start()
    if (showToast) ui.success('Code sent', `We sent a new code to ${props.email}`)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    sending.value = false
  }
}
async function verify() {
  if (code.value.length < 4 || verifying.value) return
  verifying.value = true
  error.value = null
  try {
    const res = await authApi.verifyOtp({ email: props.email, code: code.value, purpose: props.purpose })
    done.value = true
    setTimeout(() => emit('verified', res.resetToken), 700)
  } catch (e) {
    error.value = isApiError(e) ? e.message : 'Could not verify the code'
    code.value = ''
  } finally {
    verifying.value = false
  }
}
onMounted(() => {
  if (props.autoSend) void send()
  else countdown.start()
})
</script>

<template>
  <div class="text-center">
    <template v-if="done">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-500"><CircleCheck class="h-9 w-9" /></span>
      <h1 class="mt-4 text-2xl">{{ successTitle }}</h1>
    </template>
    <template v-else>
      <h1 class="text-2xl">{{ title }}</h1>
      <p class="mt-1 text-sm text-ink-500">Enter the 4-digit code we sent to {{ email }}</p>
      <UiOtpInput v-model="code" class="mt-8" :error="error ?? undefined" :disabled="verifying" @complete="verify" />
      <p class="mt-8 text-sm text-ink-500">
        Didn’t get a code?
        <span v-if="countdown.active.value" class="font-medium text-brand-600">{{ countdown.label.value }}</span>
        <button v-else type="button" class="font-medium text-brand-600 hover:underline" :disabled="sending" @click="send(true)">Resend code</button>
      </p>
      <UiButton size="lg" block class="mt-4" :disabled="code.length < 4" :loading="verifying" :variant="code.length < 4 ? 'secondary' : 'primary'" @click="verify">Continue</UiButton>
      <p class="mt-4 text-xs text-ink-400">Dev hint: the mock code is 1234</p>
    </template>
  </div>
</template>
