<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import AuthCard from '@/modules/auth/AuthCard.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth.store'
import { loginSchema, type LoginForm } from '@/validations'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const form = useForm<LoginForm, Awaited<ReturnType<typeof auth.login>>>({
  initialValues: { email: '', password: '' },
  schema: loginSchema,
  onSubmit: (v) => auth.login(v),
  onSuccess: (res) => {
    if (res.nextStep) router.push({ name: { verify_email: 'auth.verify-email', profile_setup: 'auth.profile-setup', interests: 'auth.interests' }[res.nextStep] })
    else router.push((route.query.redirect as string) || auth.redirectAfterLogin || { name: 'home' })
  },
})
</script>

<template>
  <AuthCard title="Login" subtitle="Please enter your details to login to your account." logo>
    <form class="space-y-4" novalidate @submit.prevent="form.submit()">
      <UiInput v-model="form.values.email" type="email" label="Email address" placeholder="johnbrown@example.com" autocomplete="email" :error="form.fieldError('email')" @blur="form.touch('email')" />
      <div>
        <UiInput v-model="form.values.password" type="password" label="Password" placeholder="Your password" autocomplete="current-password" :error="form.fieldError('password')" @blur="form.touch('password')" />
        <RouterLink :to="{ name: 'auth.forgot-password' }" class="mt-2 inline-block text-sm text-brand-600 hover:underline">Forgot password?</RouterLink>
      </div>
      <p v-if="form.formError.value && !Object.keys(form.errors.value).length" class="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-600" role="alert">{{ form.formError.value }}</p>
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Log in</UiButton>
    </form>
    <template #below>Don’t have an account? <RouterLink :to="{ name: 'auth.signup' }" class="font-semibold text-brand-600 hover:underline">Sign up</RouterLink></template>
  </AuthCard>
</template>
