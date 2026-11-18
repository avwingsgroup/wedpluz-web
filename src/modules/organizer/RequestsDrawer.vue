<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, X } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useUiStore } from '@/stores/ui.store'
import { formatRelativeLong } from '@/utils/format'
import type { EventRequest } from '@/types'

const props = defineProps<{ open: boolean; eventId: string }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; changed: [] }>()
const ui = useUiStore()
const items = ref<EventRequest[]>([])
const loading = ref(false)
const selected = ref<string[]>([])
const busy = ref<string | null>(null)

watch(() => props.open, async (o) => {
  if (!o) return
  loading.value = true
  selected.value = []
  try {
    items.value = (await organizerApi.requests(props.eventId)).data
  } finally {
    loading.value = false
  }
})
async function decide(r: EventRequest, status: 'approved' | 'declined') {
  busy.value = r.id
  try {
    await organizerApi.decideRequest(props.eventId, r.id, status)
    items.value = items.value.filter((x) => x.id !== r.id)
    emit('changed')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = null
  }
}
async function bulk(status: 'approved' | 'declined') {
  const ids = selected.value.length ? selected.value : items.value.map((i) => i.id)
  busy.value = 'bulk'
  try {
    await organizerApi.bulkDecide(props.eventId, ids, status)
    items.value = items.value.filter((x) => !ids.includes(x.id))
    selected.value = []
    ui.success(`${ids.length} request${ids.length > 1 ? 's' : ''} ${status}`)
    emit('changed')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UiDrawer :open="open" title="Pending · Awaiting approval" size="sm" @update:open="emit('update:open', $event)">
    <template v-if="loading"><UiSkeleton v-for="i in 5" :key="i" variant="row" /></template>
    <UiEmptyState v-else-if="!items.length" title="All caught up" description="New attendee requests will appear here." compact />
    <ul v-else class="divide-y divide-ink-100">
      <li v-for="r in items" :key="r.id" class="flex items-center gap-3 py-3">
        <input v-model="selected" type="checkbox" :value="r.id" class="h-4 w-4 accent-brand-600" :aria-label="`Select ${r.firstName}`" />
        <UiAvatar :src="r.user.avatarUrl" :name="`${r.firstName} ${r.lastName}`" />
        <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ r.firstName }} {{ r.lastName }}</p><p class="text-xs text-ink-500">Requested {{ formatRelativeLong(r.createdAt) }}</p></div>
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-success-50 text-success-600 disabled:opacity-40" :disabled="!!busy" aria-label="Approve" @click="decide(r, 'approved')"><Check class="h-4 w-4" /></button>
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-danger-50 text-danger-500 disabled:opacity-40" :disabled="!!busy" aria-label="Decline" @click="decide(r, 'declined')"><X class="h-4 w-4" /></button>
      </li>
    </ul>
    <template v-if="items.length" #footer>
      <div class="grid grid-cols-2 gap-3"><UiButton variant="outline" :loading="busy === 'bulk'" @click="bulk('declined')">Decline {{ selected.length || 'all' }}</UiButton><UiButton :loading="busy === 'bulk'" @click="bulk('approved')">Approve {{ selected.length || 'all' }}</UiButton></div>
    </template>
  </UiDrawer>
</template>
