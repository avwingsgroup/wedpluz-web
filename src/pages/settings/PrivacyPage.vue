<script setup lang="ts">
import { ref, watch } from 'vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import type { PrivacySettings } from '@/types'

const ui = useUiStore()
const { data, loading } = useAsync(() => accountApi.privacy())
const local = ref<PrivacySettings | null>(null)
watch(data, (d) => (local.value = d ? { ...d } : null))
async function save(patch: Partial<PrivacySettings>) {
  if (!local.value) return
  const prev = { ...local.value }
  Object.assign(local.value, patch)
  try {
    await accountApi.updatePrivacy(patch)
  } catch (e) {
    local.value = prev
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <h2 class="text-3xl">Privacy settings</h2>
    <div v-if="loading || !local" class="mt-6 space-y-3"><UiSkeleton v-for="i in 5" :key="i" class="h-14 rounded-xl" /></div>
    <div v-else class="mt-6 space-y-6">
      <section class="card p-5"><UiRadioGroup :model-value="local.profileVisibility" label="Who can see your profile?" :options="[{ label: 'Everyone', value: 'public' }, { label: 'People I’ve connected with', value: 'connections' }, { label: 'Only me', value: 'private' }]" @update:model-value="save({ profileVisibility: $event as PrivacySettings['profileVisibility'] })" /></section>
      <section class="card divide-y divide-ink-100">
        <div class="p-5"><UiToggle :model-value="local.showEmail" label="Show my email on my profile" @update:model-value="save({ showEmail: $event })" /></div>
        <div class="p-5"><UiToggle :model-value="local.showPhone" label="Show my phone number on my profile" @update:model-value="save({ showPhone: $event })" /></div>
        <div class="p-5"><UiToggle :model-value="local.allowMessageRequests" label="Allow message requests" description="People you don’t know can send you a request to chat." @update:model-value="save({ allowMessageRequests: $event })" /></div>
        <div class="p-5"><UiToggle :model-value="local.allowTagging" label="Allow others to tag me" @update:model-value="save({ allowTagging: $event })" /></div>
        <div class="p-5"><UiToggle :model-value="local.discoverableBySearch" label="Appear in search results" @update:model-value="save({ discoverableBySearch: $event })" /></div>
      </section>
      <p class="text-xs text-ink-500">Read our <RouterLink :to="{ name: 'privacy' }" class="text-brand-600 underline">Privacy policy</RouterLink> to learn how we use your data. To export your data, contact support.</p>
    </div>
  </div>
</template>
