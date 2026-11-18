<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { CircleUser, CirclePlus, EllipsisVertical, MessageCircle, Search, Shield, Trash2 } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import { useManagedEvent } from '@/modules/organizer/useManagedEvent'
import { organizerApi } from '@/services/api/organizer.api'
import { messagingApi } from '@/services/api/messaging.api'
import { useUiStore } from '@/stores/ui.store'
import type { EventManager, ManagerPermission } from '@/types'

const router = useRouter()
const ui = useUiStore()
const { event, isOrganizer } = useManagedEvent()
const items = ref<EventManager[]>([])
const loading = ref(true)
const search = ref('')
const drawerOpen = ref(false)
const editing = ref<EventManager | null>(null)
const form = reactive({ email: '', access: 'full' as 'full' | 'partial', permissions: [] as ManagerPermission[] })
const saving = ref(false)
const permissionLabels: Record<ManagerPermission, string> = { manage_guests: 'Manage guests & approvals', scan_tickets: 'Scan tickets', manage_tasks: 'Manage checklist', manage_vendors: 'Manage vendors', manage_assets: 'Manage assets', view_revenue: 'View revenue', edit_event: 'Edit event details', manage_community: 'Manage community' }

async function load() {
  if (!event.value) return
  loading.value = true
  try {
    items.value = await organizerApi.managers(event.value.id, search.value || undefined)
  } finally {
    loading.value = false
  }
}
onMounted(load)
const debouncedLoad = useDebounceFn(load, 250)
function openInvite() {
  editing.value = null
  Object.assign(form, { email: '', access: 'full', permissions: [] })
  drawerOpen.value = true
}
function openEdit(m: EventManager) {
  editing.value = m
  Object.assign(form, { email: m.user.displayName, access: m.access, permissions: [...m.permissions] })
  drawerOpen.value = true
}
async function save() {
  if (!event.value) return
  if (!editing.value && !/^\S+@\S+\.\S+$/.test(form.email)) return ui.error('Enter the manager’s email')
  if (form.access === 'partial' && !form.permissions.length) return ui.error('Choose at least one permission')
  saving.value = true
  try {
    if (editing.value) {
      const updated = await organizerApi.updateManager(event.value.id, editing.value.id, { access: form.access, permissions: form.permissions })
      items.value = items.value.map((m) => (m.id === updated.id ? updated : m))
      ui.success('Access updated')
    } else {
      items.value.push(await organizerApi.inviteManager(event.value.id, { email: form.email, access: form.access, permissions: form.permissions }))
      ui.success('Invite sent', 'They’ll get a notification to accept.')
    }
    drawerOpen.value = false
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
async function remove(m: EventManager) {
  if (!event.value || !(await ui.confirm({ title: `Remove ${m.user.displayName}?`, description: 'They will lose access to this event immediately.', variant: 'danger', confirmLabel: 'Remove' }))) return
  await organizerApi.removeManager(event.value.id, m.id)
  items.value = items.value.filter((x) => x.id !== m.id)
}
async function message(m: EventManager) {
  const c = await messagingApi.start(m.user.id)
  router.push({ name: 'messages', params: { id: c.id } })
}
</script>

<template>
  <div v-if="event">
    <div class="flex items-center justify-between"><p>Your Managers ({{ items.length }})</p><UiButton v-if="isOrganizer" variant="link" @click="openInvite"><CirclePlus class="h-5 w-5" />Add Managers</UiButton></div>
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" class="inline-flex items-center gap-2 font-medium text-brand-600" @click="event.communityId ? router.push({ name: 'messages', params: { id: `cv_${event.communityId}` } }) : ui.info('Activate the event community to message all managers')"><MessageCircle class="h-5 w-5" />Message all Managers</button><label class="relative w-full sm:w-72"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search ..." class="field rounded-full pl-10" aria-label="Search managers" @input="debouncedLoad" /></label></div>
    <div class="mt-6 space-y-3">
      <template v-if="loading"><UiSkeleton v-for="i in 2" :key="i" class="h-16 rounded-2xl" /></template>
      <UiEmptyState v-else-if="!items.length" title="No managers yet" description="Add people you trust to help scan tickets, approve guests and run the event." illustration="generic"><UiButton v-if="isOrganizer" @click="openInvite">Add Managers</UiButton></UiEmptyState>
      <div v-for="m in items" v-else :key="m.id" class="card flex items-center gap-3 p-3">
        <UiAvatar :src="m.user.avatarUrl" :name="m.user.displayName" />
        <div class="min-w-0 flex-1"><p class="truncate">{{ m.user.displayName }}</p><p class="flex items-center gap-1 text-sm text-ink-500"><CircleUser class="h-3.5 w-3.5" />{{ m.access === 'full' ? 'Full access' : `Partial access · ${m.permissions.length} permissions` }}</p></div>
        <span v-if="m.status === 'pending'" class="text-sm text-ink-500">Pending</span>
        <span v-else-if="m.status === 'declined'" class="text-sm text-danger-500">Declined</span>
        <UiDropdown :items="[{ label: 'Message', icon: MessageCircle, onClick: () => message(m) }, { label: 'Edit access', icon: Shield, hidden: !isOrganizer, onClick: () => openEdit(m) }, { label: 'Remove', icon: Trash2, danger: true, hidden: !isOrganizer, onClick: () => remove(m) }]"><template #trigger><button type="button" class="rounded-full p-2 hover:bg-ink-100" aria-label="Manager actions"><EllipsisVertical class="h-4 w-4" /></button></template></UiDropdown>
      </div>
    </div>
    <UiDrawer v-model:open="drawerOpen" size="sm" :title="editing ? 'Manager’s info' : 'Add managers'">
      <div class="space-y-5">
        <UiInput v-if="!editing" v-model="form.email" type="email" label="Email address" placeholder="manager@example.com" hint="They must have (or create) a Wedpluz account" />
        <div v-else class="flex items-center gap-3"><UiAvatar :src="editing.user.avatarUrl" :name="editing.user.displayName" size="lg" /><p class="font-semibold">{{ editing.user.displayName }}</p></div>
        <div><p class="label">Access</p><UiTabs v-model="form.access" variant="segment" class="w-fit" :tabs="[{ key: 'full', label: 'Full access' }, { key: 'partial', label: 'Partial access' }]" /></div>
        <div v-if="form.access === 'partial'" class="space-y-3 rounded-2xl bg-ink-50 p-4"><UiCheckbox v-for="(label, key) in permissionLabels" :key="key" :model-value="form.permissions.includes(key)" :label="label" @update:model-value="(v) => (form.permissions = v ? [...form.permissions, key] : form.permissions.filter((p) => p !== key))" /></div>
        <p v-else class="text-sm text-ink-500">Full access managers can do everything except delete or cancel the event and change payouts.</p>
      </div>
      <template #footer><UiButton block size="lg" :loading="saving" @click="save">{{ editing ? 'Save access' : 'Send invite' }}</UiButton></template>
    </UiDrawer>
  </div>
</template>
