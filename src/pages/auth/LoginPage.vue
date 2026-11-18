<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Mail } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import UiButton from '@/components/ui/UiButton.vue'
import GoogleButton from '@/modules/auth/GoogleButton.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const loading = ref(false)

async function onGoogle(idToken: string) {
  loading.value = true
  try {
    const res = await auth.loginWithGoogle(idToken)
    if (res.nextStep) router.push({ name: { verify_email: 'auth.verify-email', profile_setup: 'auth.profile-setup', interests: 'auth.interests' }[res.nextStep] })
    else router.push((route.query.redirect as string) || { name: 'home' })
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <BrandLogo size="xl" />
    <h1 class="mt-12 text-2xl">Log in to Wedpluz</h1>
    <div class="mt-5 w-full space-y-3">
      <UiButton variant="outline" size="lg" block :to="{ name: 'auth.login-email', query: route.query }"><Mail class="h-5 w-5" /> Log in with Email</UiButton>
      <GoogleButton label="Log in with Google" :loading="loading" @token="onGoogle" />
    </div>
    <p class="mt-10 text-sm text-ink-500">Don’t have an account? <RouterLink :to="{ name: 'auth.signup', query: route.query }" class="font-semibold text-brand-600 hover:underline">Sign up</RouterLink></p>
    <p class="mt-10 max-w-xs text-xs text-ink-500">By continuing, you agree to Wedpluz’s <RouterLink :to="{ name: 'terms' }" class="text-brand-600 underline">Terms of use</RouterLink> and <RouterLink :to="{ name: 'privacy' }" class="text-brand-600 underline">Privacy policy</RouterLink></p>
  </div>
</template>
