<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import { Check, Copy, KeyRound, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-vue-next'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import AdminAuthShell from '@/modules/admin/AdminAuthShell.vue'
import { adminOtpOutcome, cleanOtp } from '@/modules/admin/adminOtp'
import { useForm } from '@/composables/useForm'
import { adminApi, type AdminInvitationEnrolment } from '@/services/api/admin.api'
import { normalizeError } from '@/services/http'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'
import { ADMIN_OTP_LENGTH } from '@/config/app'
import { isMockApi } from '@/config/env'

// The invitation email links to <admin origin>/accept-invite?token=… (AdminAccessController::invite).
//   1. POST /admin/auth/invitations/accept  { token, password } → { secret, otpauthUri }
//   2. POST /admin/auth/invitations/confirm { token, otp }      → admin + tokens (signed in)
const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const ui = useUiStore()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token.trim() : ''))
const step = ref<'password' | 'enrol' | 'invalid'>(token.value ? 'password' : 'invalid')
const invalidMessage = ref('This invitation link is incomplete. Open the link from your invitation email again.')
const enrolment = ref<AdminInvitationEnrolment | null>(null)

function invitationProblem(e: unknown): boolean {
  const err = normalizeError(e)
  if (err.status === 403 || err.status === 404) {
    invalidMessage.value = err.message || 'This invitation is invalid or has expired.'
    step.value = 'invalid'
    return true
  }
  return false
}

// ---- step 1: password ------------------------------------------------------------------------------------------------
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(128, 'Use at most 128 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })

const form = useForm({
  initialValues: { password: '', confirm: '' },
  schema: passwordSchema,
  toastErrors: false,
  // An invalid or expired invitation (403) switches to the "unavailable" screen; other errors show on the form.
  onSubmit: (v) =>
    adminApi.auth.acceptInvitation({ token: token.value, password: v.password }).catch((e: unknown) => {
      if (invitationProblem(e)) return null
      throw e
    }),
  onSuccess: (res) => {
    if (!res) return
    enrolment.value = res
    step.value = 'enrol'
  },
})

// ---- step 2: authenticator --------------------------------------------------------------------------------------------
const qrUrl = ref<string | null>(null)
const copied = ref(false)
const otp = ref('')
const otpError = ref<string | null>(null)
const confirming = ref(false)
const otpInput = ref<InstanceType<typeof UiOtpInput> | null>(null)
const groupedSecret = computed(() => (enrolment.value?.secret ?? '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim())

watch(enrolment, async (e) => {
  qrUrl.value = null
  if (!e) return
  try {
    // Generated in the browser: the secret never goes to a third-party QR service.
    const { default: QRCode } = await import('qrcode')
    qrUrl.value = await QRCode.toDataURL(e.otpauthUri, { width: 440, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    qrUrl.value = null
  }
})

async function copySecret() {
  try {
    await navigator.clipboard.writeText((enrolment.value?.secret ?? '').replace(/\s/g, ''))
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    ui.error('Couldn’t copy', 'Select the key and copy it manually.')
  }
}

async function confirm() {
  const code = cleanOtp(otp.value)
  if (code.length !== ADMIN_OTP_LENGTH || confirming.value) return
  otpError.value = null
  confirming.value = true
  try {
    await admin.confirmInvitation(token.value, code)
    ui.success('Welcome to the admin console', 'Two-factor authentication is on for your account.')
    await router.replace({ name: 'admin.dashboard' })
  } catch (e) {
    if (invitationProblem(e)) return
    const outcome = adminOtpOutcome(e)
    otpError.value =
      outcome.kind === 'invalid_code' ? `${outcome.message} If it keeps failing, make sure your phone sets its time automatically.` : outcome.message
    if (outcome.kind === 'invalid_code') otpInput.value?.clear()
  } finally {
    confirming.value = false
  }
}

function startOver() {
  enrolment.value = null
  otp.value = ''
  otpError.value = null
  form.reset()
  step.value = 'password'
}
</script>

<template>
  <AdminAuthShell>
    <!-- invalid or expired -->
    <div v-if="step === 'invalid'" class="mt-8 text-center" role="alert">
      <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger-500"><ShieldAlert class="h-7 w-7" /></span>
      <h1 class="mt-4 text-2xl">Invitation unavailable</h1>
      <p class="mt-2 text-sm text-ink-500">{{ invalidMessage }}</p>
      <p class="mt-2 text-sm text-ink-500">Invitations expire after a while. Ask an administrator to send a new one.</p>
      <UiButton class="mt-6" variant="outline" block :to="{ name: 'admin.login' }">Go to admin sign-in</UiButton>
    </div>

    <!-- step 1: password -->
    <template v-else-if="step === 'password'">
      <p class="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Step 1 of 2</p>
      <h1 class="mt-1 text-2xl">Accept your invitation</h1>
      <p class="mt-1 text-sm text-ink-500">Choose a password for the Wedpluz admin console. Next you’ll set up two-factor authentication.</p>
      <form class="mt-6 space-y-4" novalidate @submit.prevent="form.submit()">
        <UiInput v-model="form.values.password" type="password" label="New password" autocomplete="new-password" hint="At least 12 characters, with letters and numbers." :error="form.fieldError('password')" @blur="form.touch('password')" />
        <UiInput v-model="form.values.confirm" type="password" label="Confirm password" autocomplete="new-password" :error="form.fieldError('confirm')" @blur="form.touch('confirm')" />
        <p v-if="form.formError.value" class="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">{{ form.formError.value }}</p>
        <UiButton type="submit" block size="lg" :loading="form.submitting.value">Continue</UiButton>
      </form>
    </template>

    <!-- step 2: authenticator -->
    <form v-else novalidate @submit.prevent="confirm">
      <p class="mt-8 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">Step 2 of 2</p>
      <h1 class="mt-1 text-2xl">Set up two-factor authentication</h1>
      <ol class="mt-4 space-y-3 text-sm text-ink-600">
        <li class="flex gap-3"><Smartphone class="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>Open an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Authy.</span></li>
        <li class="flex gap-3"><ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><span>Scan this QR code, or enter the setup key.</span></li>
      </ol>
      <div class="mt-5 flex flex-col items-center rounded-2xl border border-ink-200 p-4">
        <img v-if="qrUrl" :src="qrUrl" alt="QR code to add Wedpluz admin to your authenticator app" width="176" height="176" class="h-44 w-44" />
        <div v-else class="h-44 w-44 animate-pulse rounded-xl bg-ink-100" aria-hidden="true" />
        <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-500"><KeyRound class="h-3.5 w-3.5" />Setup key</p>
        <div class="mt-1 flex items-center gap-2">
          <code class="select-all break-all rounded-lg bg-ink-50 px-2.5 py-1 text-sm font-medium tracking-wide text-ink-900">{{ groupedSecret }}</code>
          <button type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900" :aria-label="copied ? 'Setup key copied' : 'Copy setup key'" @click="copySecret">
            <Check v-if="copied" class="h-4 w-4 text-success-500" /><Copy v-else class="h-4 w-4" />
          </button>
        </div>
      </div>
      <p class="mt-5 text-center text-sm text-ink-600">Enter the {{ ADMIN_OTP_LENGTH }}-digit code the app shows.</p>
      <UiOtpInput ref="otpInput" v-model="otp" :length="ADMIN_OTP_LENGTH" label="Authentication code" class="mt-3" :autofocus="false" :disabled="confirming" :error="otpError ?? undefined" @complete="confirm" />
      <UiButton type="submit" block size="lg" class="mt-6" :disabled="otp.length < ADMIN_OTP_LENGTH" :loading="confirming">Confirm and sign in</UiButton>
      <button type="button" class="mt-3 w-full text-center text-sm text-ink-500 hover:text-ink-900" @click="startOver">Start again with a new setup key</button>
      <p v-if="isMockApi" class="mt-3 text-center text-xs text-ink-400">Mock mode: code 123456</p>
    </form>
  </AdminAuthShell>
</template>
