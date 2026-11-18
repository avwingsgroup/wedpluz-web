<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthCard from '@/modules/auth/AuthCard.vue'
import OtpStep from '@/modules/auth/OtpStep.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useForm } from '@/composables/useForm'
import { authApi } from '@/services/api/auth.api'
import { forgotPasswordSchema } from '@/validations'

const router = useRouter()
const step = ref<'email' | 'otp'>('email')
const email = ref('')
const form = useForm({
  initialValues: { email: '' },
  schema: forgotPasswordSchema,
  onSubmit: (v) => authApi.forgotPassword(v.email),
  onSuccess: (_r, v) => {
    email.value = v.email
    step.value = 'otp'
  },
})
function onVerified() {
  router.push({ name: 'auth.reset-password', query: { email: email.value, code: '1234' } })
}
</script>

<template>
  <AuthCard v-if="step === 'email'" title="Forgot password?" subtitle="Enter the email linked to your account and we’ll send you a reset code." logo>
    <form class="space-y-4" novalidate @submit.prevent="form.submit()">
      <UiInput v-model="form.values.email" type="email" label="Email address" placeholder="johnbrown@example.com" autocomplete="email" :error="form.fieldError('email')" @blur="form.touch('email')" />
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Send code</UiButton>
    </form>
    <template #below><RouterLink :to="{ name: 'auth.login-email' }" class="font-semibold text-brand-600 hover:underline">Back to login</RouterLink></template>
  </AuthCard>
  <div v-else class="rounded-3xl bg-white p-8 shadow-[0_20px_60px_-30px_rgba(39,4,39,0.25)]">
    <OtpStep :email="email" purpose="password_reset" title="Verify your email" :auto-send="false" @verified="onVerified" />
  </div>
</template>
