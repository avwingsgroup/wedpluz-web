<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ShieldCheck, ShieldOff, UserPlus } from 'lucide-vue-next'
import UiDataTable from '@/components/ui/UiDataTable.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'
import { formatRelativeLong } from '@/utils/format'
import type { AdminUser } from '@/types'

const me = useAdminStore()
const ui = useUiStore()
const { data, loading, refresh } = useAsync(() => adminApi.access.admins())
const { data: roles } = useAsync(() => adminApi.access.roles())
const inviteOpen = ref(false)
const rolesFor = ref<AdminUser | null>(null)
const form = reactive({ firstName: '', lastName: '', email: '', roleIds: [] as string[] })
const roleIds = ref<string[]>([])

function openInvite() {
  Object.assign(form, { firstName: '', lastName: '', email: '', roleIds: [] })
  inviteOpen.value = true
}
async function invite() {
  if (!form.firstName || !form.lastName || !/^\S+@\S+$/.test(form.email) || !form.roleIds.length) return ui.error('Name, email and at least one role are required')
  try {
    await adminApi.access.inviteAdmin({ ...form })
    inviteOpen.value = false
    ui.success('Invitation sent', 'They must set a password and enable 2FA on first login.')
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
async function saveRoles() {
  if (!rolesFor.value) return
  await adminApi.access.updateAdmin(rolesFor.value.id, { roleIds: roleIds.value })
  rolesFor.value = null
  ui.success('Roles updated')
  void refresh()
}
async function setStatus(a: AdminUser, status: 'active' | 'suspended') {
  if (!(await ui.confirm({ title: `${status === 'suspended' ? 'Suspend' : 'Reactivate'} ${a.firstName}?`, description: status === 'suspended' ? 'All their sessions are revoked immediately.' : undefined, variant: status === 'suspended' ? 'danger' : 'default', confirmLabel: status === 'suspended' ? 'Suspend' : 'Reactivate' }))) return
  try {
    await adminApi.access.updateAdmin(a.id, { status })
    void refresh()
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Administrators" description="Staff accounts with access to this console." :back="{ name: 'admin.roles' }"><UiButton size="sm" @click="openInvite"><UserPlus class="h-4 w-4" />Invite admin</UiButton></AdminPageHeader>
    <UiDataTable :columns="[{ key: 'name', label: 'Admin' }, { key: 'roles', label: 'Roles' }, { key: 'twoFactorEnabled', label: '2FA' }, { key: 'status', label: 'Status' }, { key: 'lastLoginAt', label: 'Last login', hideBelow: 'md' }, { key: 'actions', label: '', align: 'right' }]" :rows="data ?? []" :loading="loading">
      <template #cell-name="{ row }"><div class="flex items-center gap-3"><UiAvatar :src="row.avatarUrl" :name="`${row.firstName} ${row.lastName}`" size="sm" /><div><p class="font-medium">{{ row.firstName }} {{ row.lastName }}<span v-if="row.id === me.admin?.id" class="ml-1 text-xs text-ink-500">(you)</span></p><p class="text-xs text-ink-500">{{ row.email }}</p></div></div></template>
      <template #cell-roles="{ row }"><div class="flex flex-wrap gap-1"><UiBadge v-for="r in row.roles" :key="r.id" tone="brand" size="sm">{{ r.name }}</UiBadge></div></template>
      <template #cell-twoFactorEnabled="{ row }"><ShieldCheck v-if="row.twoFactorEnabled" class="h-4 w-4 text-success-500" aria-label="Enabled" /><ShieldOff v-else class="h-4 w-4 text-danger-500" aria-label="Disabled" /></template>
      <template #cell-status="{ row }"><UiBadge :status="row.status" size="sm" /></template>
      <template #cell-lastLoginAt="{ row }"><span class="text-xs text-ink-500">{{ row.lastLoginAt ? formatRelativeLong(row.lastLoginAt) : 'Never' }}</span></template>
      <template #cell-actions="{ row }"><UiDropdown v-if="row.id !== me.admin?.id" :items="[{ label: 'Change roles', onClick: () => { rolesFor = row; roleIds = row.roles.map((r: { id: string }) => r.id) } }, { label: 'Suspend', danger: true, hidden: row.status === 'suspended', onClick: () => setStatus(row, 'suspended') }, { label: 'Reactivate', hidden: row.status !== 'suspended', onClick: () => setStatus(row, 'active') }]" width="w-44"><template #trigger><UiButton size="xs" variant="outline">Manage</UiButton></template></UiDropdown></template>
    </UiDataTable>
    <UiModal v-model:open="inviteOpen" title="Invite administrator" size="sm">
      <div class="space-y-4"><div class="grid grid-cols-2 gap-3"><UiInput v-model="form.firstName" label="First name" /><UiInput v-model="form.lastName" label="Last name" /></div><UiInput v-model="form.email" type="email" label="Work email" /><div><p class="label">Roles</p><div class="space-y-2"><UiCheckbox v-for="r in roles ?? []" :key="r.id" :model-value="form.roleIds.includes(r.id)" :label="r.name" :description="r.description" @update:model-value="(v) => (form.roleIds = v ? [...form.roleIds, r.id] : form.roleIds.filter((x) => x !== r.id))" /></div></div></div>
      <template #footer><UiButton block @click="invite">Send invitation</UiButton></template>
    </UiModal>
    <UiModal :open="!!rolesFor" :title="`Roles for ${rolesFor?.firstName}`" size="sm" @update:open="rolesFor = null">
      <div class="space-y-2"><UiCheckbox v-for="r in roles ?? []" :key="r.id" :model-value="roleIds.includes(r.id)" :label="r.name" @update:model-value="(v) => (roleIds = v ? [...roleIds, r.id] : roleIds.filter((x) => x !== r.id))" /></div>
      <template #footer><UiButton block :disabled="!roleIds.length" @click="saveRoles">Save</UiButton></template>
    </UiModal>
  </div>
</template>
