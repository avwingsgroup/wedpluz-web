<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ClipboardList, Plus } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import TaskEditorDrawer from '@/modules/organizer/TaskEditorDrawer.vue'
import { useManagedEvent } from '@/modules/organizer/useManagedEvent'
import { organizerApi } from '@/services/api/organizer.api'
import { formatDate } from '@/utils/format'
import type { EventTask, UserSummary } from '@/types'

const { event } = useManagedEvent()
const tasks = ref<EventTask[]>([])
const people = ref<UserSummary[]>([])
const loading = ref(true)
const editorOpen = ref(false)
const editing = ref<EventTask | null>(null)
onMounted(async () => {
  if (!event.value) return
  try {
    const [t, m, v] = await Promise.all([organizerApi.tasks(event.value.id, { sort: 'due' }), organizerApi.managers(event.value.id), organizerApi.vendors(event.value.id)])
    tasks.value = t
    people.value = [...m.filter((x) => x.status === 'accepted').map((x) => x.user), ...v.filter((x) => x.status === 'accepted').map((x) => ({ id: x.vendor.userId, displayName: x.vendor.businessName, avatarUrl: x.vendor.avatarUrl }))]
  } finally {
    loading.value = false
  }
})
const upcoming = computed(() => tasks.value.filter((t) => t.status !== 'done').slice(0, 8))
const counts = computed(() => ({ todo: tasks.value.filter((t) => t.status === 'todo').length, in_progress: tasks.value.filter((t) => t.status === 'in_progress').length, done: tasks.value.filter((t) => t.status === 'done').length }))
function onSaved(t: EventTask) {
  const i = tasks.value.findIndex((x) => x.id === t.id)
  if (i >= 0) tasks.value[i] = t
  else tasks.value.unshift(t)
}
</script>

<template>
  <div v-if="event">
    <div class="grid gap-4 sm:grid-cols-3">
      <div v-for="[k, l] in [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']]" :key="k" class="card p-4"><p class="text-sm text-ink-500">{{ l }}</p><p class="mt-1 text-2xl font-semibold">{{ counts[k as keyof typeof counts] }}</p></div>
    </div>
    <div class="mt-6 flex items-center justify-between"><h2 class="font-medium">Upcoming tasks</h2><div class="flex gap-2"><UiButton variant="outline" size="sm" :to="{ name: 'manage.checklist', params: { id: event.id } }"><ClipboardList class="h-4 w-4" />Open board</UiButton><UiButton size="sm" @click="editing = null; editorOpen = true"><Plus class="h-4 w-4" />Create task</UiButton></div></div>
    <div class="mt-3">
      <template v-if="loading"><UiSkeleton v-for="i in 4" :key="i" variant="row" /></template>
      <UiEmptyState v-else-if="!tasks.length" title="No tasks yet" description="Plan your event with a checklist and assign tasks to your managers and vendors." illustration="generic"><UiButton @click="editing = null; editorOpen = true">Create task</UiButton></UiEmptyState>
      <div v-else class="card divide-y divide-ink-100">
        <button v-for="t in upcoming" :key="t.id" type="button" class="flex w-full items-center gap-3 p-4 text-left hover:bg-ink-50" @click="editing = t; editorOpen = true">
          <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ t.title }}</p><p :class="t.isOverdue ? 'text-xs text-danger-500' : 'text-xs text-ink-500'">{{ t.dueAt ? `${t.isOverdue ? 'Overdue' : 'Due'} ${formatDate(t.dueAt)}` : 'No due date' }}</p></div>
          <UiBadge :status="t.status" size="sm" />
          <span class="flex -space-x-2"><UiAvatar v-for="a in t.assignees.slice(0, 3)" :key="a.id" :src="a.avatarUrl" :name="a.displayName" size="xs" class="rounded-full ring-2 ring-white" /></span>
        </button>
      </div>
    </div>
    <TaskEditorDrawer v-model:open="editorOpen" :event-id="event.id" :task="editing" :people="people" can-edit @saved="onSaved" @deleted="(id) => (tasks = tasks.filter((t) => t.id !== id))" />
  </div>
</template>
