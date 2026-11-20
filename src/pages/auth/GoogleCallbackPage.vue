<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CircleAlert, CircleX } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'
import { normalizeError } from '@/services/http'
import { consumePendingGoogleSignIn, startGoogleRedirect } from '@/modules/auth/googleSignIn'
import { destinationAfterAuth } from '@/modules/auth/afterAuth'

// Google sends the browser back here with ?code=…&state=… (or ?error=access_denied when the person cancels).
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const status = ref<'working' | 'cancelled' | 'error'>('working')
const message = ref('')
const retrying = ref(false)
let returnTo: string | null = null

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

onMounted(async () => {
  const code = str(route.query.code)
  const state = str(route.query.state)
  const error = str(route.query.error)
  const pending = consumePendingGoogleSignIn(state)
  returnTo = pending.returnTo

  // The code is single-use, but keep it out of the address bar, history and error reports all the same.
  if (code || state || error) await router.replace({ name: 'auth.google-callback' })

  if (error) {
    status.value = error === 'access_denied' ? 'cancelled' : 'error'
    message.value = error === 'access_denied' ? 'You closed Google sign-in before it finished.' : 'Google couldn’t complete the sign-in. Please try again.'
    return
  }
  if (!code || !state) {
    if (auth.isAuthenticated) return void router.replace(returnTo || { name: 'home' })
    status.value = 'error'
    message.value = 'This sign-in link is incomplete. Start again from the log in page.'
    return
  }
  if (pending.stateMatches === false) {
    // This tab started a different sign-in: refuse a stale or forged callback without calling the API.
    status.value = 'error'
    message.value = 'This sign-in link has expired or was opened from another tab. Please try again.'
    return
  }

  try {
    const res = await auth.loginWithGoogle({ code, state })
    await router.replace(destinationAfterAuth(res, returnTo))
  } catch (e) {
    status.value = 'error'
    message.value = normalizeError(e).message || 'We couldn’t sign you in with Google. Please try again.'
  }
})

async function retry() {
  retrying.value = true
  try {
    await startGoogleRedirect(returnTo)
  } catch (e) {
    retrying.value = false
    message.value = normalizeError(e).message
  }
}
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <RouterLink :to="{ name: 'home' }" class="rounded-lg" aria-label="Wedpluz home"><BrandLogo size="xl" /></RouterLink>

    <div v-if="status === 'working'" class="mt-12 flex flex-col items-center" role="status" aria-live="polite">
      <UiSpinner class="h-8 w-8 text-brand-600" />
      <h1 class="mt-5 text-2xl tracking-normal text-[#333740]">Signing you in with Google…</h1>
      <p class="mt-2 text-sm text-ink-500">This only takes a moment.</p>
    </div>

    <div v-else class="mt-12 flex w-full flex-col items-center" role="alert">
      <span :class="status === 'cancelled' ? 'flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-600' : 'flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500'">
        <CircleX v-if="status === 'cancelled'" class="h-7 w-7" /><CircleAlert v-else class="h-7 w-7" />
      </span>
      <h1 class="mt-5 text-2xl tracking-normal text-[#333740]">{{ status === 'cancelled' ? 'Google sign-in cancelled' : 'Couldn’t sign in with Google' }}</h1>
      <p class="mt-2 max-w-sm text-sm text-ink-500">{{ message }}</p>
      <div class="mt-8 flex w-full max-w-sm flex-col gap-3">
        <UiButton size="lg" block :loading="retrying" @click="retry">Try Google again</UiButton>
        <UiButton size="lg" block variant="outline" :to="{ name: 'auth.login-email', query: returnTo ? { redirect: returnTo } : undefined }">Log in with email instead</UiButton>
      </div>
      <p class="mt-8 text-sm text-ink-500">Still stuck? <RouterLink :to="{ name: 'help', hash: '#contact' }" class="font-medium text-brand-600 hover:underline">Contact support</RouterLink></p>
    </div>
  </div>
</template>
