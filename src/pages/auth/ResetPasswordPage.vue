<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck } from 'lucide-vue-next'
import AuthCard from '@/modules/auth/AuthCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useForm } from '@/composables/useForm'
import { authApi } from '@/services/api/auth.api'
import { resetPasswordSchema } from '@/validations'

const route = useRoute()
const done = ref(false)
const email = String(route.query.email ?? '')
const code = String(route.query.code ?? '')
const form = useForm({
  initialValues: { password: '', passwordConfirmation: '' },
  schema: resetPasswordSchema,
  onSubmit: (v) => authApi.resetPassword({ email, code, ...v }),
  onSuccess: () => (done.value = true),
})
</script>

<template>
  <div v-if="done" class="rounded-3xl bg-white p-8 text-center shadow-[0_20px_60px_-30px_rgba(39,4,39,0.25)]">
    <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success-500"><CircleCheck class="h-9 w-9" /></span>
    <h1 class="mt-4 text-2xl">Password reset successful</h1>
    <p class="mt-1 text-sm text-ink-500">You can now log in with your new password.</p>
    <UiButton size="lg" block class="mt-8" :to="{ name: 'auth.login-email' }">Log in</UiButton>
  </div>
  <AuthCard v-else title="Reset password" subtitle="Choose a strong password you don’t use elsewhere." logo>
    <form class="space-y-4" novalidate @submit.prevent="form.submit()">
      <UiInput v-model="form.values.password" type="password" label="New password" autocomplete="new-password" :error="form.fieldError('password')" @blur="form.touch('password')" />
      <UiInput v-model="form.values.passwordConfirmation" type="password" label="Confirm new password" autocomplete="new-password" :error="form.fieldError('passwordConfirmation')" @blur="form.touch('passwordConfirmation')" />
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Reset password</UiButton>
    </form>
  </AuthCard>
</template>
