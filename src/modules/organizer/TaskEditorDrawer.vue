<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Paperclip, Trash2 } from 'lucide-vue-next'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { EventTask, TaskStatus, UserSummary } from '@/types'

const props = defineProps<{ open: boolean; eventId: string; task: EventTask | null; defaultStatus?: TaskStatus; people: UserSummary[]; canEdit: boolean }>()
const emit = defineEmits<{ 'update:open': [v: boolean]; saved: [t: EventTask]; deleted: [id: string] }>()
const ui = useUiStore()
const form = reactive({ title: '', description: '', status: 'todo' as TaskStatus, dueAt: '', assigneeIds: [] as string[] })
const error = ref<string | null>(null)
const saving = ref(false)
const editing = ref(true)
watch(() => props.open, (o) => {
  if (!o) return
  error.value = null
  editing.value = !props.task
  Object.assign(form, props.task ? { title: props.task.title, description: props.task.description ?? '', status: props.task.status, dueAt: props.task.dueAt?.slice(0, 10) ?? '', assigneeIds: props.task.assignees.map((a) => a.id) } : { title: '', description: '', status: props.defaultStatus ?? 'todo', dueAt: '', assigneeIds: [] })
})
function toggleAssignee(id: string) {
  form.assigneeIds = form.assigneeIds.includes(id) ? form.assigneeIds.filter((x) => x !== id) : [...form.assigneeIds, id]
}
async function save() {
  if (form.title.trim().length < 2) {
    error.value = 'Give the task a title'
    return
  }
  saving.value = true
  try {
    const payload = { title: form.title, description: form.description || null, status: form.status, dueAt: form.dueAt ? new Date(`${form.dueAt}T17:00:00`).toISOString() : null, assigneeIds: form.assigneeIds }
    const t = props.task ? await organizerApi.updateTask(props.eventId, props.task.id, payload) : await organizerApi.createTask(props.eventId, payload)
    emit('saved', t)
    emit('update:open', false)
    ui.success(props.task ? 'Task updated' : 'Task created')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
async function setStatus(s: TaskStatus) {
  if (!props.task) return
  form.status = s
  emit('saved', await organizerApi.updateTask(props.eventId, props.task.id, { status: s }))
}
async function remove() {
  if (!props.task || !(await ui.confirm({ title: 'Delete this task?', variant: 'danger', confirmLabel: 'Delete' }))) return
  await organizerApi.deleteTask(props.eventId, props.task.id)
  emit('deleted', props.task.id)
  emit('update:open', false)
}
const statusTabs = [{ key: 'todo', label: 'To do' }, { key: 'in_progress', label: 'In progress' }, { key: 'done', label: 'Done' }]
const assignees = computed(() => props.people.filter((p) => form.assigneeIds.includes(p.id)))
</script>

<template>
  <UiDrawer :open="open" size="sm" :title="task ? (editing ? 'Edit task' : 'Task details') : 'Create task'" @update:open="emit('update:open', $event)">
    <div v-if="task && !editing" class="space-y-5">
      <h3 class="text-xl font-semibold">{{ task.title }}</h3>
      <UiTabs :model-value="form.status" variant="segment" size="sm" class="w-fit" :tabs="statusTabs" @update:model-value="setStatus($event as TaskStatus)" />
      <p class="whitespace-pre-line text-sm text-ink-700">{{ task.description || 'No description' }}</p>
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between"><dt class="text-ink-500">Due</dt><dd :class="task.isOverdue && 'text-danger-500'">{{ task.dueAt ? formatDate(task.dueAt) : '—' }}{{ task.isOverdue ? ' · Overdue' : '' }}</dd></div>
        <div class="flex justify-between"><dt class="text-ink-500">Assigned to</dt><dd class="flex -space-x-2"><UiAvatar v-for="a in task.assignees" :key="a.id" :src="a.avatarUrl" :name="a.displayName" size="sm" class="ring-2 ring-white rounded-full" /></dd></div>
        <div class="flex justify-between"><dt class="text-ink-500">Created by</dt><dd>{{ task.createdBy.displayName }}</dd></div>
      </dl>
      <div v-if="task.attachments.length"><p class="mb-2 text-sm font-medium">Attachments</p><a v-for="a in task.attachments" :key="a.id" :href="a.url" class="flex items-center gap-2 py-1 text-sm text-brand-600"><Paperclip class="h-4 w-4" />{{ a.name }}</a></div>
    </div>
    <div v-else class="space-y-4">
      <UiInput v-model="form.title" label="Title" placeholder="Book photographer" :error="error ?? undefined" />
      <UiTextarea v-model="form.description" label="Description" :rows="4" :maxlength="2000" />
      <div><p class="label">Status</p><UiTabs v-model="form.status" variant="segment" size="sm" class="w-fit" :tabs="statusTabs" /></div>
      <UiInput v-model="form.dueAt" type="date" label="Due date" />
      <div>
        <p class="label">Assign to</p>
        <div class="flex flex-wrap gap-2"><button v-for="p in people" :key="p.id" type="button" :class="cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', form.assigneeIds.includes(p.id) ? 'border-brand-600 bg-brand-50' : 'border-ink-200')" @click="toggleAssignee(p.id)"><UiAvatar :src="p.avatarUrl" :name="p.displayName" size="xs" />{{ p.displayName }}</button></div>
        <p v-if="!people.length" class="text-xs text-ink-500">Add managers or vendors to assign tasks.</p>
        <p v-else-if="assignees.length" class="mt-2 text-xs text-ink-500">{{ assignees.length }} assigned · they’ll be notified</p>
      </div>
    </div>
    <template v-if="canEdit" #footer>
      <div v-if="task && !editing" class="flex gap-3"><UiButton variant="ghost" class="text-danger-500" @click="remove"><Trash2 class="h-4 w-4" /></UiButton><UiButton block @click="editing = true">Edit task</UiButton></div>
      <UiButton v-else block size="lg" :loading="saving" @click="save">{{ task ? 'Save changes' : 'Create task' }}</UiButton>
    </template>
  </UiDrawer>
</template>
