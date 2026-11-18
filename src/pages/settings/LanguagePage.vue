<script setup lang="ts">
import { ref } from 'vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import { accountApi } from '@/services/api/account.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'

const auth = useAuthStore()
const ui = useUiStore()
const locale = ref(auth.user?.locale ?? 'en')
const options = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr', description: 'Coming soon', disabled: true },
  { label: 'Yorùbá', value: 'yo', description: 'Coming soon', disabled: true },
  { label: 'Igbo', value: 'ig', description: 'Coming soon', disabled: true },
  { label: 'Hausa', value: 'ha', description: 'Coming soon', disabled: true },
]
async function set(v: string) {
  locale.value = v
  safeStorage.set(STORAGE_KEYS.locale, v)
  auth.setUser(await accountApi.update({ locale: v }))
  ui.success('Language updated')
}
</script>

<template>
  <div>
    <h2 class="text-3xl">Language</h2>
    <div class="card mt-6 px-5"><UiRadioGroup :model-value="locale" :options="options" variant="check" @update:model-value="set" /></div>
    <p class="mt-3 text-xs text-ink-500">Additional languages will be enabled once translations are approved. The app is structured for i18n (see docs/frontend-architecture.md).</p>
  </div>
</template>
