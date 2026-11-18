<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { CircleCheck, EllipsisVertical, MessagesSquare, Pencil, Share2, Trash2, Ban, Activity } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import ManageEventHeader from '@/modules/organizer/ManageEventHeader.vue'
import { provideManagedEvent } from '@/modules/organizer/useManagedEvent'
import { organizerApi } from '@/services/api/organizer.api'
import { useAsync } from '@/composables/useAsync'
import { useShare } from '@/composables/useClipboardShare'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const { share } = useShare()
const id = computed(() => String(route.params.id))
const { data: event, loading, error, refresh } = useAsync(() => organizerApi.get(id.value), { watch: id })
const isOrganizer = computed(() => event.value?.organizer.id === auth.user?.id)
provideManagedEvent({ event, refresh, isOrganizer })

const tabs = [
  { key: 'manage.overview', label: 'Overview' },
  { key: 'manage.tasks', label: 'Tasks' },
  { key: 'manage.vendors', label: 'Vendors' },
  { key: 'manage.guests', label: 'Guests' },
  { key: 'manage.managers', label: 'Managers' },
]
const cancelOpen = ref(false)
const cancelReason = ref('')
const busy = ref(false)

async function markComplete() {
  if (!(await ui.confirm({ title: 'Mark event as complete?', description: 'Ticket sales close and settlement is scheduled. This cannot be undone.', confirmLabel: 'Mark complete' }))) return
  await organizerApi.setStatus(id.value, { status: 'completed' })
  ui.success('Event marked as complete')
  void refresh()
}
async function cancelEvent() {
  if (cancelReason.value.trim().length < 10) return ui.error('Tell your guests why (at least 10 characters)')
  busy.value = true
  try {
    await organizerApi.setStatus(id.value, { status: 'cancelled', cancellationReason: cancelReason.value })
    cancelOpen.value = false
    ui.success('Event cancelled', 'Guests are notified and refunds are processed automatically.')
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (!event.value) return
  if (!(await ui.confirm({ title: 'Delete this event?', description: 'Only events without sold tickets can be deleted.', variant: 'danger', confirmLabel: 'Delete', requireText: 'DELETE' }))) return
  try {
    await organizerApi.remove(id.value)
    ui.success('Event deleted')
    router.push({ name: 'manage.events' })
  } catch (e) {
    ui.error((e as Error).message)
  }
}
const menu = computed(() => [
  { label: 'Edit event', icon: Pencil, hidden: !isOrganizer.value, onClick: () => router.push({ name: 'manage.edit', params: { id: id.value } }) },
  { label: 'Activity log', icon: Activity, onClick: () => router.push({ name: 'manage.activity', params: { id: id.value } }) },
  { label: 'Mark as complete', icon: CircleCheck, hidden: !isOrganizer.value || event.value?.status !== 'live', onClick: markComplete },
  { divider: true, label: '', hidden: !isOrganizer.value },
  { label: 'Cancel event', icon: Ban, danger: true, hidden: !isOrganizer.value || event.value?.status !== 'live', onClick: () => { cancelReason.value = ''; cancelOpen.value = true } },
  { label: 'Delete event', icon: Trash2, danger: true, hidden: !isOrganizer.value, onClick: remove },
])
</script>

<template>
  <div class="container-app pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.events' }" />
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading && !event" page />
    <template v-else-if="event">
      <div class="mt-6 flex items-center justify-between gap-3">
        <h1 class="text-2xl">Manage Event</h1>
        <div class="flex gap-3">
          <button v-if="event.communityId" type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200" aria-label="Open community chat" @click="router.push({ name: 'messages', params: { id: `cv_${event.communityId}` } })"><MessagesSquare class="h-5 w-5" /></button>
          <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200" aria-label="Share event" @click="share(`/events/${event.slug}`, event.title)"><Share2 class="h-5 w-5" /></button>
          <UiDropdown :items="menu"><template #trigger><button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-ink-200" aria-label="Event settings"><EllipsisVertical class="h-5 w-5" /></button></template></UiDropdown>
        </div>
      </div>
      <ManageEventHeader :event="event" class="mt-6" />
      <UiTabs class="mt-6" variant="stretch" :model-value="String(route.name)" :tabs="tabs" @update:model-value="router.push({ name: $event, params: { id } })" />
      <div class="mt-6"><RouterView /></div>
    </template>
    <UiModal v-model:open="cancelOpen" title="Cancel event">
      <p class="text-sm text-ink-500">All ticket holders will be notified and paid tickets refunded automatically (gateway fees may apply). Your community will be archived.</p>
      <UiTextarea v-model="cancelReason" class="mt-4" label="Message to your guests" :rows="4" :maxlength="500" placeholder="Due to unforeseen circumstances…" />
      <template #footer><UiButton variant="secondary" @click="cancelOpen = false">Keep event</UiButton><UiButton variant="danger" :loading="busy" @click="cancelEvent">Cancel event</UiButton></template>
    </UiModal>
  </div>
</template>
