<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { Lock, Plus, Trash2, TriangleAlert } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { cn } from '@/utils/cn'
import type { PermissionKey, Role } from '@/types'

const ui = useUiStore()
const { data: roles, loading, refresh } = useAsync(() => adminApi.access.roles())
const { data: perms } = useAsync(() => adminApi.access.permissions())
const active = ref<Role | null>(null)
const creating = ref(false)
const form = reactive({ name: '', description: '', permissions: [] as PermissionKey[] })
const saving = ref(false)
const grouped = computed(() => {
  const g: Record<string, NonNullable<typeof perms.value>> = {}
  for (const p of perms.value ?? []) (g[p.module] ??= []).push(p)
  return g
})
function select(r: Role | null) {
  active.value = r
  creating.value = !r
  Object.assign(form, r ? { name: r.name, description: r.description, permissions: [...r.permissions] } : { name: '', description: '', permissions: [] })
}
function toggle(k: PermissionKey, v: boolean) {
  form.permissions = v ? [...form.permissions, k] : form.permissions.filter((p) => p !== k)
}
function toggleModule(module: string, v: boolean) {
  const keys = (grouped.value[module] ?? []).map((p) => p.key)
  form.permissions = v ? [...new Set([...form.permissions, ...keys])] : form.permissions.filter((p) => !keys.includes(p))
}
async function save() {
  if (form.name.trim().length < 2) return ui.error('Name the role')
  const sensitive = (perms.value ?? []).filter((p) => p.isSensitive && form.permissions.includes(p.key) && !active.value?.permissions.includes(p.key))
  if (sensitive.length && !(await ui.confirm({ title: 'Grant sensitive permissions?', description: `This role will gain: ${sensitive.map((p) => p.label).join(', ')}. Members can move money or remove content.`, confirmLabel: 'Grant' }))) return
  saving.value = true
  try {
    const r = active.value ? await adminApi.access.updateRole(active.value.id, { ...form }) : await adminApi.access.createRole({ ...form })
    ui.success('Role saved')
    await refresh()
    select(r)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
async function remove() {
  if (!active.value || !(await ui.confirm({ title: `Delete ${active.value.name}?`, variant: 'danger', confirmLabel: 'Delete' }))) return
  try {
    await adminApi.access.deleteRole(active.value.id)
    select(null)
    creating.value = false
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Roles & permissions" description="Module-level access control. Sensitive permissions (money movement, suspensions, content removal) are flagged."><UiButton variant="outline" size="sm" rounded="xl" :to="{ name: 'admin.admins' }">Administrators</UiButton><UiButton size="sm" @click="select(null)"><Plus class="h-4 w-4" />New role</UiButton></AdminPageHeader>
    <div class="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <nav class="card h-fit p-2">
        <template v-if="loading"><UiSkeleton v-for="i in 4" :key="i" class="m-2 h-12 rounded-xl" /></template>
        <button v-for="r in roles ?? []" :key="r.id" type="button" :class="cn('block w-full rounded-xl px-3 py-2.5 text-left', active?.id === r.id ? 'bg-brand-50' : 'hover:bg-ink-50')" @click="select(r)"><span class="flex items-center gap-2 font-medium">{{ r.name }}<Lock v-if="r.isSystem" class="h-3.5 w-3.5 text-ink-400" /></span><span class="text-xs text-ink-500">{{ r.membersCount }} members · {{ r.permissions.length }} permissions</span></button>
      </nav>
      <section v-if="active || creating" class="card p-6">
        <div v-if="active?.isSystem" class="mb-4 flex items-center gap-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-600"><Lock class="h-4 w-4" />System role. It cannot be edited or deleted.</div>
        <fieldset :disabled="active?.isSystem" class="space-y-5">
          <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.name" label="Role name" /><UiInput v-model="form.description" label="Description" /></div>
          <div v-for="(list, module) in grouped" :key="module" class="rounded-2xl border border-ink-100 p-4">
            <div class="mb-3 flex items-center justify-between"><p class="font-semibold">{{ module }}</p><UiCheckbox :model-value="list.every((p) => form.permissions.includes(p.key))" label="All" @update:model-value="toggleModule(module, $event)" /></div>
            <div class="grid gap-3 sm:grid-cols-2"><UiCheckbox v-for="p in list" :key="p.key" :model-value="form.permissions.includes(p.key)" @update:model-value="toggle(p.key, $event)"><span class="flex items-center gap-1.5">{{ p.label }}<TriangleAlert v-if="p.isSensitive" class="h-3.5 w-3.5 text-amber-600" aria-label="Sensitive" /></span><span class="block font-mono text-[11px] text-ink-400">{{ p.key }}</span></UiCheckbox></div>
          </div>
        </fieldset>
        <div v-if="!active?.isSystem" class="mt-6 flex justify-between"><UiButton v-if="active" variant="ghost" class="text-danger-500" @click="remove"><Trash2 class="h-4 w-4" />Delete role</UiButton><span v-else /><UiButton :loading="saving" @click="save">{{ active ? 'Save role' : 'Create role' }}</UiButton></div>
        <p v-if="active" class="mt-4 text-xs text-ink-500"><UiBadge size="sm" tone="info">Note</UiBadge> Permission changes apply on the members’ next request; the API is the source of truth.</p>
      </section>
      <section v-else class="card flex items-center justify-center p-10 text-sm text-ink-500">Select a role to view or edit its permissions</section>
    </div>
  </div>
</template>
