<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'
import { env, isMockApi } from '@/config/env'
import { useUiStore } from '@/stores/ui.store'
import { normalizeError } from '@/services/http'
import { startGoogleRedirect } from './googleSignIn'

/**
 * "Continue with Google".
 * - The button uses the backend's redirect flow (GET /auth/google/redirect → Google → /auth/google/callback), which
 *   works for everyone, including people who are not signed in to Google in this browser.
 * - When VITE_GOOGLE_CLIENT_ID is set (live API), Google One Tap is also offered: people already signed in to Google
 *   see "Continue as …" and the ID token is sent to POST /auth/social (the `token` event). It is an extra, never the
 *   only way in: if Google suppresses the prompt, nothing changes.
 * The client secret never reaches the browser; only the public client id does.
 */
const props = withDefaults(defineProps<{ label: string; loading?: boolean; context?: 'signin' | 'signup' }>(), { loading: false, context: 'signin' })
const emit = defineEmits<{ token: [idToken: string] }>()
const route = useRoute()
const ui = useUiStore()
const redirecting = ref(false)

interface GsiId {
  initialize: (config: Record<string, unknown>) => void
  prompt: () => void
  cancel: () => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GsiId } }
  }
}

async function click() {
  if (redirecting.value) return
  redirecting.value = true
  try {
    await startGoogleRedirect(route.query.redirect)
    // Navigation is under way; keep the spinner until the page unloads.
  } catch (e) {
    redirecting.value = false
    const err = normalizeError(e)
    if (err.errors.redirectUri) ui.error('Google sign-in isn’t available here yet', `This address (${window.location.origin}) is not an allowed Google callback. Use email for now.`)
    else ui.error('Couldn’t reach Google sign-in', err.message)
  }
}

// ---- One Tap (optional enhancement) -----------------------------------------------------------------------------------
const GSI_SRC = 'https://accounts.google.com/gsi/client'
let oneTapStarted = false
function startOneTap() {
  const id = window.google?.accounts.id
  if (!id || oneTapStarted) return
  oneTapStarted = true
  id.initialize({
    client_id: env.googleClientId,
    callback: (res: { credential?: string }) => res.credential && emit('token', res.credential),
    context: props.context,
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
    use_fedcm_for_prompt: true,
  })
  id.prompt()
}
// Coming back from Google with the Back button restores this page from the bfcache: clear the spinner.
const onPageShow = (e: PageTransitionEvent) => e.persisted && (redirecting.value = false)
onMounted(() => {
  window.addEventListener('pageshow', onPageShow)
  if (!env.googleClientId || isMockApi) return
  if (window.google?.accounts?.id) return startOneTap()
  let script = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
  if (!script) {
    script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }
  script.addEventListener('load', startOneTap, { once: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('pageshow', onPageShow)
  if (oneTapStarted) window.google?.accounts.id.cancel()
})
</script>

<template>
  <UiButton variant="outline" size="lg" block :loading="props.loading || redirecting" @click="click">
    <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" /><path fill="#4285F4" d="M21.3 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.2 1.1-.9 2.1-1.8 2.8l2.9 2.3c1.7-1.6 2.7-3.9 2.7-7.4z" /><path fill="#FBBC05" d="M6 14.3a5.8 5.8 0 0 1 0-4.6L3 7.4a9.7 9.7 0 0 0 0 9.2l3-2.3z" /><path fill="#34A853" d="M12 21.7c2.7 0 4.9-.9 6.6-2.4l-2.9-2.3c-.8.6-1.9 1-3.7 1-3.9 0-5.3-2.6-5.5-4L3 16.6c1.6 3.1 4.9 5.1 9 5.1z" /></svg>
    {{ label }}
  </UiButton>
</template>
