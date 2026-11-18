<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { CirclePlus, EllipsisVertical, MessageCircle, Search, Trash2, UserRound } from 'lucide-vue-next'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { useManagedEvent } from '@/modules/organizer/useManagedEvent'
import { organizerApi } from '@/services/api/organizer.api'
import { vendorsApi } from '@/services/api/vendors.api'
import { messagingApi } from '@/services/api/messaging.api'
import { useUiStore } from '@/stores/ui.store'
import type { EventVendorAssignment, VendorSummary } from '@/types'

const router = useRouter()
const ui = useUiStore()
const { event, isOrganizer } = useManagedEvent()
const items = ref<EventVendorAssignment[]>([])
const loading = ref(true)
const search = ref('')
const addOpen = ref(false)
const vendorSearch = ref('')
const results = ref<VendorSummary[]>([])
const role = ref('')
const inviting = ref<string | null>(null)

async function load() {
  if (!event.value) return
  loading.value = true
  try {
    items.value = await organizerApi.vendors(event.value.id, search.value || undefined)
  } finally {
    loading.value = false
  }
}
onMounted(load)
const debouncedLoad = useDebounceFn(load, 250)
const findVendors = useDebounceFn(async () => {
  results.value = (await vendorsApi.list({ search: vendorSearch.value || undefined, perPage: 8 })).data
}, 250)
async function invite(v: VendorSummary) {
  if (!event.value) return
  inviting.value = v.id
  try {
    items.value.push(await organizerApi.inviteVendor(event.value.id, { vendorId: v.id, role: role.value || undefined }))
    ui.success(`${v.businessName} invited`)
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    inviting.value = null
  }
}
async function remove(a: EventVendorAssignment) {
  if (!event.value || !(await ui.confirm({ title: `Remove ${a.vendor.businessName}?`, variant: 'danger', confirmLabel: 'Remove' }))) return
  await organizerApi.removeVendor(event.value.id, a.id)
  items.value = items.value.filter((x) => x.id !== a.id)
}
async function message(a: EventVendorAssignment) {
  const c = await messagingApi.start(a.vendor.userId)
  router.push({ name: 'messages', params: { id: c.id } })
}
async function messageAll() {
  if (event.value?.communityId) router.push({ name: 'messages', params: { id: `cv_${event.value.communityId}` } })
  else ui.info('Activate the event community to message all vendors at once')
}
</script>

<template>
  <div v-if="event">
    <div class="flex items-center justify-between"><p>Your Vendors ({{ items.filter((i) => i.status !== 'declined').length }})</p><UiButton v-if="isOrganizer" variant="link" @click="addOpen = true; findVendors()"><CirclePlus class="h-5 w-5" />Add Vendors</UiButton></div>
    <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" class="inline-flex items-center gap-2 font-medium text-brand-600" @click="messageAll"><MessageCircle class="h-5 w-5" />Message all Vendors</button><label class="relative w-full sm:w-72"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search ..." class="field rounded-full pl-10" aria-label="Search vendors" @input="debouncedLoad" /></label></div>
    <div class="mt-6 space-y-3">
      <template v-if="loading"><UiSkeleton v-for="i in 3" :key="i" class="h-16 rounded-2xl" /></template>
      <UiEmptyState v-else-if="!items.length" title="No vendors yet" description="Invite photographers, caterers and decorators to collaborate on this event." illustration="search"><UiButton v-if="isOrganizer" @click="addOpen = true; findVendors()">Add Vendors</UiButton></UiEmptyState>
      <div v-for="a in items" v-else :key="a.id" class="card flex items-center gap-3 p-3">
        <UiAvatar :src="a.vendor.avatarUrl" :name="a.vendor.businessName" />
        <div class="min-w-0 flex-1"><p class="truncate">{{ a.vendor.businessName }}</p><p class="flex items-center gap-1 text-sm text-ink-500"><UserRound class="h-3.5 w-3.5" />{{ a.role ?? a.vendor.category }}</p></div>
        <UiBadge v-if="a.status !== 'accepted'" :status="a.status" size="sm" />
        <UiDropdown :items="[{ label: 'Message', icon: MessageCircle, onClick: () => message(a) }, { label: 'View profile', onClick: () => router.push({ name: 'vendors' }) }, { label: 'Remove', icon: Trash2, danger: true, hidden: !isOrganizer, onClick: () => remove(a) }]"><template #trigger><button type="button" class="rounded-full p-2 hover:bg-ink-100" aria-label="Vendor actions"><EllipsisVertical class="h-4 w-4" /></button></template></UiDropdown>
      </div>
    </div>
    <UiDrawer v-model:open="addOpen" title="Add vendors" size="sm">
      <UiInput v-model="vendorSearch" placeholder="Search vendors by name or category" @update:model-value="findVendors" />
      <UiInput v-model="role" class="mt-3" placeholder="Role (optional), e.g. Photography" />
      <ul class="mt-4 divide-y divide-ink-100">
        <li v-for="v in results" :key="v.id" class="flex items-center gap-3 py-3"><UiAvatar :src="v.avatarUrl" :name="v.businessName" /><div class="min-w-0 flex-1"><p class="truncate font-medium">{{ v.businessName }}</p><p class="text-xs text-ink-500">{{ v.category.name }} · {{ v.location }}</p></div><UiButton size="xs" :disabled="items.some((i) => i.vendor.id === v.id)" :loading="inviting === v.id" @click="invite(v)">{{ items.some((i) => i.vendor.id === v.id) ? 'Added' : 'Invite' }}</UiButton></li>
      </ul>
    </UiDrawer>
  </div>
</template>
