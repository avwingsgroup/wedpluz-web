<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleX } from 'lucide-vue-next'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { communityApi } from '@/services/api/community.api'
import { useUiStore } from '@/stores/ui.store'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const failed = ref<string | null>(null)
onMounted(async () => {
  try {
    const c = await communityApi.joinByCode(String(route.params.code))
    ui.success(`Welcome to ${c.name}`)
    router.replace({ name: 'messages', params: { id: `cv_${c.id}` } })
  } catch (e) {
    failed.value = (e as Error).message
  }
})
</script>

<template>
  <div class="container-app py-16 text-center">
    <UiSpinner v-if="!failed" page label="Joining community…" />
    <div v-else><CircleX class="mx-auto h-12 w-12 text-danger-500" /><h1 class="mt-4 text-xl">Can’t join this community</h1><p class="mt-1 text-sm text-ink-500">{{ failed }}</p><UiButton class="mt-6" :to="{ name: 'messages' }">Go to messages</UiButton></div>
  </div>
</template>
