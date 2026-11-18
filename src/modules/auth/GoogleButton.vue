<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import { env, isMockApi } from '@/config/env'
import { useUiStore } from '@/stores/ui.store'

/**
 * Google Identity Services button. In mock mode (no client id) it emits a fake token so the
 * flow can be exercised end-to-end; the backend exchanges the id_token for a session.
 */
const props = defineProps<{ label: string; loading?: boolean }>()
const emit = defineEmits<{ token: [idToken: string] }>()
const ui = useUiStore()
const ready = ref(false)

declare global {
  interface Window {
    google?: { accounts: { id: { initialize: (c: Record<string, unknown>) => void; prompt: () => void } } }
  }
}

onMounted(() => {
  if (!env.googleClientId) return
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.onload = () => {
    window.google?.accounts.id.initialize({ client_id: env.googleClientId, callback: (res: { credential: string }) => emit('token', res.credential), ux_mode: 'popup' })
    ready.value = true
  }
  document.head.appendChild(script)
})

function click() {
  if (env.googleClientId && ready.value) window.google?.accounts.id.prompt()
  else if (isMockApi) emit('token', 'mock-google-id-token')
  else ui.error('Google sign-in is not configured', 'Set VITE_GOOGLE_CLIENT_ID to enable it.')
}
</script>

<template>
  <UiButton variant="outline" size="lg" block :loading="props.loading" @click="click">
    <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3.3 14.7 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12S6.6 21.7 12 21.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" /><path fill="#4285F4" d="M21.3 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.2 1.1-.9 2.1-1.8 2.8l2.9 2.3c1.7-1.6 2.7-3.9 2.7-7.4z" /><path fill="#FBBC05" d="M6 14.3a5.8 5.8 0 0 1 0-4.6L3 7.4a9.7 9.7 0 0 0 0 9.2l3-2.3z" /><path fill="#34A853" d="M12 21.7c2.7 0 4.9-.9 6.6-2.4l-2.9-2.3c-.8.6-1.9 1-3.7 1-3.9 0-5.3-2.6-5.5-4L3 16.6c1.6 3.1 4.9 5.1 9 5.1z" /></svg>
    {{ label }}
  </UiButton>
</template>
