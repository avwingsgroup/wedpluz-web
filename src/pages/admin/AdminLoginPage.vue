<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck } from 'lucide-vue-next'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import AdminAuthShell from '@/modules/admin/AdminAuthShell.vue'
import { adminOtpOutcome, cleanOtp } from '@/modules/admin/adminOtp'
import { useForm } from '@/composables/useForm'
import { useAdminStore } from '@/stores/admin.store'
import { loginSchema } from '@/validations'
import { ADMIN_OTP_LENGTH } from '@/config/app'
import { isMockApi } from '@/config/env'

// Step 1: email + password → { requiresTwoFactor: true }. Step 2: the same plus the 6-digit authenticator code.
const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const needsOtp = ref(false)
const otp = ref('')
const otpError = ref<string | null>(null)
const verifying = ref(false)
const otpInput = ref<InstanceType<typeof UiOtpInput> | null>(null)
const redirectTo = () => (typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//') ? route.query.redirect : { name: 'admin.dashboard' })

const form = useForm({
  initialValues: { email: isMockApi ? 'admin@wedpluz.com' : '', password: '' },
  schema: loginSchema,
  toastErrors: false,
  onSubmit: (v) => admin.login(v),
  onSuccess: (res) => {
    if (res.requiresTwoFactor) {
      otp.value = ''
      otpError.value = null
      needsOtp.value = true
      return
    }
    router.replace(redirectTo())
  },
})

async function verify() {
  const code = cleanOtp(otp.value)
  if (code.length !== ADMIN_OTP_LENGTH || verifying.value) {
    otpError.value = `Enter the ${ADMIN_OTP_LENGTH}-digit code from your authenticator app.`
    return
  }
  otpError.value = null
  verifying.value = true
  try {
    await admin.login({ email: form.values.email, password: form.values.password, otp: code })
    await router.replace(redirectTo())
  } catch (e) {
    const outcome = adminOtpOutcome(e)
    if (outcome.kind === 'credentials') {
      // The password changed (or the account) since step 1: start again.
      backToStep1()
      form.formError.value = outcome.message
      return
    }
    otpError.value = outcome.message
    if (outcome.kind === 'invalid_code') otpInput.value?.clear()
  } finally {
    verifying.value = false
  }
}

function backToStep1() {
  needsOtp.value = false
  otp.value = ''
  otpError.value = null
}
</script>

<template>
  <AdminAuthShell>
    <template v-if="!needsOtp">
      <h1 class="mt-8 text-2xl">Sign in to the admin console</h1>
      <p class="mt-1 text-sm text-ink-500">Restricted to authorised Wedpluz staff. All activity is logged.</p>
      <form class="mt-6 space-y-4" novalidate @submit.prevent="form.submit()">
        <UiInput v-model="form.values.email" type="email" label="Work email" autocomplete="username" :error="form.fieldError('email')" />
        <UiInput v-model="form.values.password" type="password" label="Password" autocomplete="current-password" :error="form.fieldError('password')" />
        <p v-if="form.formError.value" class="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">{{ form.formError.value }}</p>
        <UiButton type="submit" block size="lg" :loading="form.submitting.value">Continue</UiButton>
      </form>
      <p v-if="isMockApi" class="mt-4 text-center text-xs text-ink-400">Mock mode: any password of 6+ characters, 2FA code 123456</p>
    </template>
    <form v-else novalidate @submit.prevent="verify">
      <span class="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600"><ShieldCheck class="h-7 w-7" /></span>
      <h1 class="mt-4 text-center text-2xl">Two-factor authentication</h1>
      <p class="mt-1 text-center text-sm text-ink-500">Enter the {{ ADMIN_OTP_LENGTH }}-digit code from your authenticator app.</p>
      <UiOtpInput ref="otpInput" v-model="otp" :length="ADMIN_OTP_LENGTH" label="Authentication code" class="mt-6" :disabled="verifying" :error="otpError ?? undefined" @complete="verify" />
      <UiButton type="submit" block size="lg" class="mt-6" :disabled="otp.length < ADMIN_OTP_LENGTH" :loading="verifying">Verify</UiButton>
      <button type="button" class="mt-3 w-full text-center text-sm text-ink-500 hover:text-ink-900" @click="backToStep1">Use a different account</button>
    </form>
  </AdminAuthShell>
</template>
