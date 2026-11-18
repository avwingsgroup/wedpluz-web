<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { isAdminTarget, isMockApi } from '@/config/env'
import { useAuthStore } from '@/stores/auth.store'
import { useBadgeStore } from '@/stores/notifications.store'
import { realtime } from '@/composables/useRealtime'
import { tokenStorage } from '@/services/http'
import ToastHost from '@/components/feedback/ToastHost.vue'
import ConfirmDialog from '@/components/feedback/ConfirmDialog.vue'
import PromptDialog from '@/components/feedback/PromptDialog.vue'

const auth = useAuthStore()
const badges = useBadgeStore()

onMounted(() => {
  if (!isAdminTarget) {
    watch(
      () => auth.isAuthenticated,
      (ok) => {
        if (ok) {
          badges.start()
          realtime.connect(tokenStorage.getAccessToken())
        } else {
          badges.stop()
          realtime.disconnect()
        }
      },
      { immediate: true },
    )
  }
})
</script>

<template>
  <RouterView />
  <ToastHost />
  <ConfirmDialog />
  <PromptDialog />
  <!-- Mock fixtures must never be mistaken for live data, so mock mode is always labelled. -->
  <div
    v-if="isMockApi"
    class="pointer-events-none fixed bottom-3 left-3 z-[60] rounded-full bg-amber-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg"
    role="status"
    data-testid="mock-mode-badge"
  >
    Mock data
  </div>
</template>
