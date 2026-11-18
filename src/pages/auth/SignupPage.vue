<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Mail } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import AuthCard from '@/modules/auth/AuthCard.vue'
import GoogleButton from '@/modules/auth/GoogleButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useForm } from '@/composables/useForm'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { registerSchema, type RegisterForm } from '@/validations'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const mode = ref<'choose' | 'email'>(route.query.method === 'email' ? 'email' : 'choose')

const form = useForm<RegisterForm>({
  initialValues: { firstName: '', lastName: '', email: '', dateOfBirth: '', password: '', passwordConfirmation: '' },
  schema: registerSchema,
  onSubmit: (v) => auth.register({ ...v, acceptedTerms: true }),
  onSuccess: () => router.push({ name: 'auth.verify-email' }),
})

async function onGoogle(idToken: string) {
  try {
    const res = await auth.loginWithGoogle(idToken)
    router.push(res.nextStep ? { name: { verify_email: 'auth.verify-email', profile_setup: 'auth.profile-setup', interests: 'auth.interests' }[res.nextStep] } : { name: 'home' })
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div v-if="mode === 'choose'" class="flex flex-col items-center text-center">
    <BrandLogo size="xl" />
    <h1 class="mt-12 text-2xl">Create your account</h1>
    <div class="mt-5 w-full space-y-3">
      <UiButton variant="outline" size="lg" block @click="mode = 'email'"><Mail class="h-5 w-5" /> Sign up with Email</UiButton>
      <GoogleButton label="Sign up with Google" @token="onGoogle" />
    </div>
    <p class="mt-10 text-sm text-ink-500">Already have an account? <RouterLink :to="{ name: 'auth.login' }" class="font-semibold text-brand-600 hover:underline">Log in</RouterLink></p>
    <p class="mt-10 max-w-xs text-xs text-ink-500">By continuing, you agree to Wedpluz’s <RouterLink :to="{ name: 'terms' }" class="text-brand-600 underline">Terms of use</RouterLink> and <RouterLink :to="{ name: 'privacy' }" class="text-brand-600 underline">Privacy policy</RouterLink></p>
  </div>
  <AuthCard v-else title="Let’s get started" subtitle="Please enter your details to create your account." logo>
    <form class="space-y-4" novalidate @submit.prevent="form.submit()">
      <div class="grid grid-cols-2 gap-3">
        <UiInput v-model="form.values.firstName" label="First Name" placeholder="John" autocomplete="given-name" :error="form.fieldError('firstName')" @blur="form.touch('firstName')" />
        <UiInput v-model="form.values.lastName" label="Last Name" placeholder="Brown" autocomplete="family-name" :error="form.fieldError('lastName')" @blur="form.touch('lastName')" />
      </div>
      <UiInput v-model="form.values.email" type="email" label="Email address" placeholder="johnbrown@example.com" autocomplete="email" :error="form.fieldError('email')" @blur="form.touch('email')" />
      <UiInput v-model="form.values.dateOfBirth" type="date" label="Date of Birth" :max="new Date().toISOString().slice(0, 10)" autocomplete="bday" :error="form.fieldError('dateOfBirth')" @blur="form.touch('dateOfBirth')" />
      <UiInput v-model="form.values.password" type="password" label="Password" placeholder="At least 8 characters" autocomplete="new-password" :error="form.fieldError('password')" @blur="form.touch('password')" />
      <UiInput v-model="form.values.passwordConfirmation" type="password" label="Confirm password" placeholder="Repeat your password" autocomplete="new-password" :error="form.fieldError('passwordConfirmation')" @blur="form.touch('passwordConfirmation')" />
      <UiButton type="submit" size="lg" block :loading="form.submitting.value" class="!mt-8">Continue</UiButton>
    </form>
    <template #below>By continuing, you agree to Wedpluz’s <RouterLink :to="{ name: 'terms' }" class="text-brand-600 underline">Terms of use</RouterLink> and <RouterLink :to="{ name: 'privacy' }" class="text-brand-600 underline">Privacy policy</RouterLink></template>
  </AuthCard>
</template>
