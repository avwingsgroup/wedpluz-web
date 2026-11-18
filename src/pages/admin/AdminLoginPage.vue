<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiOtpInput from '@/components/ui/UiOtpInput.vue'
import { useForm } from '@/composables/useForm'
import { useAdminStore } from '@/stores/admin.store'
import { loginSchema } from '@/validations'
import { isMockApi } from '@/config/env'

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const needsOtp = ref(false)
const otp = ref('')
const otpError = ref<string | null>(null)

const form = useForm({
  initialValues: { email: isMockApi ? 'admin@wedpluz.com' : '', password: '' },
  schema: loginSchema,
  toastErrors: false,
  onSubmit: (v) => admin.login({ ...v, otp: needsOtp.value ? otp.value : undefined }),
  onSuccess: (res) => {
    if (res.requiresTwoFactor) {
      needsOtp.value = true
      return
    }
    router.replace((route.query.redirect as string) || { name: 'admin.dashboard' })
  },
})
async function verify() {
  otpError.value = null
  await form.submit()
  if (form.formError.value) otpError.value = form.formError.value
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-brand-950 px-4" style="background-image: radial-gradient(circle at 20% 20%, rgba(155,17,155,.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(231,37,127,.25), transparent 40%)">
    <div class="w-full max-w-md rounded-3xl bg-white p-8 shadow-dialog">
      <div class="flex items-center justify-between"><BrandLogo /><span class="rounded-md bg-brand-950 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Admin</span></div>
      <template v-if="!needsOtp">
        <h1 class="mt-8 text-2xl">Sign in to the admin console</h1>
        <p class="mt-1 text-sm text-ink-500">Restricted to authorised Wedpluz staff. All activity is logged.</p>
        <form class="mt-6 space-y-4" novalidate @submit.prevent="form.submit()">
          <UiInput v-model="form.values.email" type="email" label="Work email" autocomplete="username" :error="form.fieldError('email')" />
          <UiInput v-model="form.values.password" type="password" label="Password" autocomplete="current-password" :error="form.fieldError('password')" />
          <p v-if="form.formError.value" class="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-600" role="alert">{{ form.formError.value }}</p>
          <UiButton type="submit" block size="lg" :loading="form.submitting.value">Continue</UiButton>
        </form>
        <p v-if="isMockApi" class="mt-4 text-center text-xs text-ink-400">Mock mode: any password of 6+ characters, 2FA code 1234</p>
      </template>
      <template v-else>
        <span class="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600"><ShieldCheck class="h-7 w-7" /></span>
        <h1 class="mt-4 text-center text-2xl">Two-factor authentication</h1>
        <p class="mt-1 text-center text-sm text-ink-500">Enter the 4-digit code from your authenticator app.</p>
        <UiOtpInput v-model="otp" class="mt-6" :error="otpError ?? undefined" @complete="verify" />
        <UiButton block size="lg" class="mt-6" :disabled="otp.length < 4" :loading="form.submitting.value" @click="verify">Verify</UiButton>
        <button type="button" class="mt-3 w-full text-center text-sm text-ink-500 hover:text-ink-900" @click="needsOtp = false; otp = ''">Use a different account</button>
      </template>
    </div>
  </div>
</template>
