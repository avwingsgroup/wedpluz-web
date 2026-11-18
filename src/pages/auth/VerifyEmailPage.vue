<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import OtpStep from '@/modules/auth/OtpStep.vue'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()
const email = computed(() => auth.user?.email ?? auth.pendingEmail ?? '')

async function onVerified() {
  await auth.refreshUser().catch(() => undefined)
  auth.pendingStep = !auth.user?.username ? 'profile_setup' : auth.user.interests.length ? null : 'interests'
  router.push(auth.pendingStep === 'profile_setup' ? { name: 'auth.profile-setup' } : auth.pendingStep === 'interests' ? { name: 'auth.interests' } : { name: 'home' })
}
</script>

<template>
  <div class="rounded-3xl bg-white p-8 shadow-[0_20px_60px_-30px_rgba(39,4,39,0.25)]">
    <OtpStep v-if="email" :email="email" purpose="email_verification" @verified="onVerified" />
    <div v-else class="text-center">
      <p class="text-ink-500">We couldn’t find a pending verification.</p>
      <RouterLink :to="{ name: 'auth.login' }" class="mt-3 inline-block font-semibold text-brand-600">Back to login</RouterLink>
    </div>
  </div>
</template>
