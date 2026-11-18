<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessagesSquare } from 'lucide-vue-next'
import UiModal from '@/components/ui/UiModal.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useUiStore } from '@/stores/ui.store'
import type { Community, CommunityPermissions } from '@/types'

const props = defineProps<{ open: boolean; eventId: string }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; changed: [] }>()
const router = useRouter()
const ui = useUiStore()
const community = ref<Community | null>(null)
const loading = ref(false)
const busy = ref(false)
watch(() => props.open, async (o) => {
  if (!o) return
  loading.value = true
  try {
    community.value = await organizerApi.community(props.eventId)
  } finally {
    loading.value = false
  }
})
async function activate() {
  busy.value = true
  try {
    community.value = await organizerApi.updateCommunity(props.eventId, { enabled: true })
    ui.success('Community activated', 'Ticket holders join automatically.')
    emit('changed')
  } finally {
    busy.value = false
  }
}
async function setPerm(k: keyof CommunityPermissions, v: boolean) {
  community.value = await organizerApi.updateCommunity(props.eventId, { enabled: true, permissions: { [k]: v } })
}
</script>

<template>
  <UiModal :open="open" title="Community" @update:open="emit('update:open', $event)">
    <UiSpinner v-if="loading" />
    <div v-else-if="!community || community.isArchived" class="text-center">
      <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600"><MessagesSquare class="h-6 w-6" /></span>
      <h3 class="mt-4 text-lg font-semibold">Activate a community</h3>
      <p class="mt-1 text-sm text-ink-500">Give guests, vendors and managers a group chat for updates, statuses and live sessions.</p>
      <UiButton class="mt-5" :loading="busy" @click="activate">Activate community</UiButton>
    </div>
    <div v-else class="space-y-4">
      <p class="text-sm text-ink-500">Group chat settings for <strong>{{ community.name }}</strong> · {{ community.membersCount }} members</p>
      <div class="card divide-y divide-ink-100">
        <div class="p-4"><UiToggle :model-value="community.permissions.membersCanSendMessages" label="Members can send messages" @update:model-value="setPerm('membersCanSendMessages', $event)" /></div>
        <div class="p-4"><UiToggle :model-value="community.permissions.membersCanPostStatus" label="Members can post status" @update:model-value="setPerm('membersCanPostStatus', $event)" /></div>
        <div class="p-4"><UiToggle :model-value="community.permissions.membersCanInvite" label="Members can invite" @update:model-value="setPerm('membersCanInvite', $event)" /></div>
        <div class="p-4"><UiToggle :model-value="community.permissions.membersCanGoLive" label="Members can go live" @update:model-value="setPerm('membersCanGoLive', $event)" /></div>
      </div>
      <UiButton block variant="outline" @click="router.push({ name: 'messages', params: { id: `cv_${community.id}` } })">Open community chat</UiButton>
    </div>
  </UiModal>
</template>
