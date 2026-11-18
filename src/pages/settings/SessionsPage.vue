<script setup lang="ts">
import { Monitor, Smartphone } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatRelativeLong } from '@/utils/format'

const ui = useUiStore()
const { data: sessions, loading, refresh } = useAsync(() => accountApi.sessions())
async function revoke(id: string) {
  await accountApi.revokeSession(id)
  ui.success('Device signed out')
  void refresh()
}
async function revokeAll() {
  if (!(await ui.confirm({ title: 'Sign out of all other devices?', confirmLabel: 'Sign out others' }))) return
  await accountApi.revokeOtherSessions()
  ui.success('Signed out of other devices')
  void refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3"><h2 class="text-3xl">Devices &amp; sessions</h2><UiButton variant="outline" size="sm" :disabled="(sessions?.length ?? 0) < 2" @click="revokeAll">Sign out others</UiButton></div>
    <p class="mt-2 text-sm text-ink-500">Devices currently signed in to your account, including the Android and iOS apps.</p>
    <div class="card mt-6 divide-y divide-ink-100">
      <template v-if="loading"><div v-for="i in 3" :key="i" class="p-4"><UiSkeleton variant="row" /></div></template>
      <div v-for="s in sessions ?? []" v-else :key="s.id" class="flex items-center gap-4 p-4">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-ink-100"><Smartphone v-if="/iphone|pixel|android/i.test(s.device)" class="h-5 w-5" /><Monitor v-else class="h-5 w-5" /></span>
        <div class="min-w-0 flex-1"><p class="font-medium">{{ s.device }} · {{ s.browser }} <UiBadge v-if="s.isCurrent" tone="success" size="sm">This device</UiBadge></p><p class="text-xs text-ink-500">{{ s.location ?? 'Unknown location' }} · {{ s.ip }} · active {{ formatRelativeLong(s.lastActiveAt) }}</p></div>
        <UiButton v-if="!s.isCurrent" size="sm" variant="ghost" class="text-danger-500" @click="revoke(s.id)">Sign out</UiButton>
      </div>
    </div>
  </div>
</template>
