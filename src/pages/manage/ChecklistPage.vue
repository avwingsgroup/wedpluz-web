<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDebounce } from '@vueuse/core'
import { CalendarClock, CirclePlus, Paperclip, Plus, Search, UserRound } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import TaskEditorDrawer from '@/modules/organizer/TaskEditorDrawer.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { EventTask, TaskStatus, UserSummary } from '@/types'

/** Kanban checklist with native drag & drop (keyboard users move cards via the task drawer). */
const route = useRoute()
const ui = useUiStore()
const eventId = String(route.params.id)
const tasks = ref<EventTask[]>([])
const people = ref<UserSummary[]>([])
const loading = ref(true)
const search = ref('')
const debounced = useDebounce(search, 200)
const assignee = ref<string | null>(null)
const sort = ref<'due' | 'created'>('due')
const editorOpen = ref(false)
const editing = ref<EventTask | null>(null)
const defaultStatus = ref<TaskStatus>('todo')
const dragId = ref<string | null>(null)
const overCol = ref<TaskStatus | null>(null)

onMounted(async () => {
  try {
    const [t, m, v] = await Promise.all([organizerApi.tasks(eventId), organizerApi.managers(eventId), organizerApi.vendors(eventId)])
    tasks.value = t
    people.value = [...m.filter((x) => x.status === 'accepted').map((x) => x.user), ...v.filter((x) => x.status === 'accepted').map((x) => ({ id: x.vendor.userId, displayName: x.vendor.businessName, avatarUrl: x.vendor.avatarUrl }))]
  } finally {
    loading.value = false
  }
})
const columns: Array<{ key: TaskStatus; label: string; color: string; border: string }> = [
  { key: 'todo', label: 'To do', color: 'bg-brand-600', border: 'border-l-brand-600' },
  { key: 'in_progress', label: 'In progress', color: 'bg-warning-500', border: 'border-l-warning-500' },
  { key: 'done', label: 'Done', color: 'bg-success-500', border: 'border-l-success-500' },
]
const filtered = computed(() => {
  let list = tasks.value.filter((t) => (!debounced.value || t.title.toLowerCase().includes(debounced.value.toLowerCase())) && (!assignee.value || t.assignees.some((a) => a.id === assignee.value)))
  list = [...list].sort((a, b) => (sort.value === 'due' ? (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9') : b.createdAt.localeCompare(a.createdAt)))
  return list
})
const byStatus = (s: TaskStatus) => filtered.value.filter((t) => t.status === s)

async function drop(status: TaskStatus) {
  overCol.value = null
  const t = tasks.value.find((x) => x.id === dragId.value)
  dragId.value = null
  if (!t || t.status === status) return
  const prev = t.status
  t.status = status
  try {
    Object.assign(t, await organizerApi.updateTask(eventId, t.id, { status }))
  } catch (e) {
    t.status = prev
    ui.error((e as Error).message)
  }
}
function open(t: EventTask | null, status: TaskStatus = 'todo') {
  editing.value = t
  defaultStatus.value = status
  editorOpen.value = true
}
function onSaved(t: EventTask) {
  const i = tasks.value.findIndex((x) => x.id === t.id)
  if (i >= 0) tasks.value[i] = t
  else tasks.value.unshift(t)
}
const assigneeLabel = computed(() => people.value.find((p) => p.id === assignee.value)?.displayName ?? 'All staffs')
</script>

<template>
  <div class="min-h-screen">
    <div class="bg-ink-50/80">
      <div class="container-app flex flex-wrap items-center gap-4 py-5">
        <UiBackButton :to="{ name: 'manage.tasks', params: { id: eventId } }" />
        <h1 class="text-2xl">Checklist</h1>
        <label class="relative ml-auto w-full sm:w-72"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search ..." class="field rounded-full pl-10" aria-label="Search tasks" /></label>
        <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white" aria-label="Create task" @click="open(null)"><Plus class="h-5 w-5" /></button>
      </div>
    </div>
    <div class="texture-band min-h-[70vh] py-10">
      <div class="container-app grid gap-6 md:grid-cols-3">
        <section v-for="col in columns" :key="col.key" :class="cn('overflow-hidden rounded-2xl bg-white shadow-card transition-shadow', overCol === col.key && 'ring-2 ring-brand-300')" @dragover.prevent="overCol = col.key" @dragleave="overCol = null" @drop.prevent="drop(col.key)">
          <div :class="['h-1.5', col.color]" />
          <h2 class="px-4 pt-4 text-lg">{{ col.label }} <span class="text-sm font-normal text-ink-500">({{ byStatus(col.key).length }})</span></h2>
          <div class="space-y-2.5 p-4">
            <template v-if="loading"><UiSkeleton v-for="i in 3" :key="i" class="h-20 rounded-xl" /></template>
            <button v-for="t in byStatus(col.key)" v-else :key="t.id" type="button" draggable="true" :class="cn('block w-full cursor-grab rounded-xl border border-l-4 border-ink-100 bg-white p-3 text-left shadow-sm transition hover:shadow-card active:cursor-grabbing', col.border, dragId === t.id && 'opacity-50')" @dragstart="dragId = t.id" @dragend="dragId = null; overCol = null" @click="open(t)">
              <p class="font-medium">{{ t.title }}</p>
              <div class="mt-2 flex items-center gap-3 text-xs">
                <span :class="cn('flex items-center gap-1', t.isOverdue ? 'text-danger-600' : 'text-ink-500')"><CalendarClock class="h-3.5 w-3.5" />{{ t.dueAt ? `${t.isOverdue ? 'Overdue' : 'Due'} ${formatDate(t.dueAt).replace(/,.*$/, '')}` : 'No date' }}</span>
                <span v-if="t.attachments.length" class="flex items-center gap-1 text-ink-500"><Paperclip class="h-3.5 w-3.5" />{{ t.attachments.length }}</span>
                <span class="ml-auto flex -space-x-2"><UiAvatar v-for="a in t.assignees.slice(0, 3)" :key="a.id" :src="a.avatarUrl" :name="a.displayName" size="xs" class="rounded-full ring-2 ring-white" /></span>
              </div>
            </button>
          </div>
          <button type="button" class="flex w-full items-center gap-2 bg-ink-50 px-4 py-3 text-ink-500 hover:text-ink-900" @click="open(null, col.key)"><CirclePlus class="h-5 w-5" />Add card</button>
        </section>
      </div>
      <div class="sticky bottom-6 mt-10 flex justify-center">
        <div class="flex gap-3 rounded-full bg-white p-2 shadow-float">
          <UiDropdown align="left" width="w-56">
            <template #trigger><button type="button" class="flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-sm"><UserRound class="h-4 w-4" />{{ assigneeLabel }}</button></template>
            <template #default="{ close }"><button type="button" class="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-ink-50" @click="assignee = null; close()">All staffs</button><button v-for="p in people" :key="p.id" type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-ink-50" @click="assignee = p.id; close()"><UiAvatar :src="p.avatarUrl" :name="p.displayName" size="xs" />{{ p.displayName }}</button></template>
          </UiDropdown>
          <button type="button" class="flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-sm" @click="sort = sort === 'due' ? 'created' : 'due'"><CalendarClock class="h-4 w-4" />{{ sort === 'due' ? 'Due date' : 'Newest' }}</button>
        </div>
      </div>
    </div>
    <TaskEditorDrawer v-model:open="editorOpen" :event-id="eventId" :task="editing" :default-status="defaultStatus" :people="people" can-edit @saved="onSaved" @deleted="(id) => (tasks = tasks.filter((t) => t.id !== id))" />
  </div>
</template>
