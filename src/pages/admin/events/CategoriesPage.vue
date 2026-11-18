<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import type { EventCategory } from '@/types'

const ui = useUiStore()
const { data, loading, refresh } = useAsync(() => adminApi.events.categories())
const open = ref(false)
const editing = ref<EventCategory | null>(null)
const form = reactive({ name: '', icon: 'sparkles', isActive: true })
const icons = ['party', 'palette', 'dumbbell', 'bus', 'briefcase', 'cpu', 'music', 'graduation', 'rings', 'users', 'sparkles', 'utensils']
function edit(c: EventCategory | null) {
  editing.value = c
  Object.assign(form, c ? { name: c.name, icon: c.icon, isActive: c.isActive } : { name: '', icon: 'sparkles', isActive: true })
  open.value = true
}
async function save() {
  if (form.name.trim().length < 2) return ui.error('Enter a category name')
  if (editing.value) await adminApi.events.updateCategory(editing.value.id, { ...form })
  else await adminApi.events.createCategory({ name: form.name, icon: form.icon })
  open.value = false
  ui.success('Category saved', 'Mobile apps pick up changes on next launch.')
  void refresh()
}
async function remove(c: EventCategory) {
  if (!(await ui.confirm({ title: `Delete ${c.name}?`, description: 'Categories in use cannot be deleted; deactivate them instead.', variant: 'danger', confirmLabel: 'Delete' }))) return
  try {
    await adminApi.events.deleteCategory(c.id)
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
async function toggle(c: EventCategory) {
  await adminApi.events.updateCategory(c.id, { isActive: !c.isActive })
  void refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Event categories" description="Used for discovery tabs, filters and interests on web and mobile." :back="{ name: 'admin.events' }"><Can perm="categories.manage"><UiButton size="sm" @click="edit(null)"><Plus class="h-4 w-4" />New category</UiButton></Can></AdminPageHeader>
    <UiDataTable :columns="[{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'eventsCount', label: 'Events', align: 'right' }, { key: 'isActive', label: 'Status' }, { key: 'actions', label: '', align: 'right' }]" :rows="data ?? []" :loading="loading">
      <template #cell-slug="{ row }"><span class="font-mono text-xs">{{ row.slug }}</span></template>
      <template #cell-isActive="{ row }"><UiBadge :tone="row.isActive ? 'success' : 'neutral'" size="sm">{{ row.isActive ? 'Active' : 'Hidden' }}</UiBadge></template>
      <template #cell-actions="{ row }"><Can perm="categories.manage"><div class="flex justify-end gap-1"><UiButton size="xs" variant="ghost" @click="toggle(row)">{{ row.isActive ? 'Hide' : 'Show' }}</UiButton><button type="button" class="p-2" aria-label="Edit" @click="edit(row)"><Pencil class="h-4 w-4" /></button><button type="button" class="p-2 text-danger-500" aria-label="Delete" @click="remove(row)"><Trash2 class="h-4 w-4" /></button></div></Can></template>
    </UiDataTable>
    <UiModal v-model:open="open" :title="editing ? 'Edit category' : 'New category'" size="sm">
      <div class="space-y-4"><UiInput v-model="form.name" label="Name" /><div><p class="label">Icon key</p><div class="flex flex-wrap gap-2"><button v-for="i in icons" :key="i" type="button" :class="['chip px-3 py-1', form.icon === i && 'border-brand-600 bg-brand-50 text-brand-700']" @click="form.icon = i">{{ i }}</button></div></div><UiToggle v-if="editing" v-model="form.isActive" label="Visible in apps" /></div>
      <template #footer><UiButton block @click="save">Save</UiButton></template>
    </UiModal>
  </div>
</template>
