<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import Can from '@/modules/admin/Can.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatNumber } from '@/utils/format'
import type { Banner } from '@/types'

const ui = useUiStore()
const { data, loading, refresh } = useAsync(() => adminApi.settings.banners())
const open = ref(false)
const editing = ref<Banner | null>(null)
const form = reactive<Partial<Banner>>({})
const placements = [{ label: 'Home: hero', value: 'home_hero' }, { label: 'Home: inline cards', value: 'home_inline' }, { label: 'Events: top', value: 'events_top' }, { label: 'Vendors: top', value: 'vendors_top' }, { label: 'Mobile app home', value: 'app_home' }]
function edit(b: Banner | null) {
  editing.value = b
  Object.assign(form, b ? { ...b, startsAt: b.startsAt?.slice(0, 10) ?? '', endsAt: b.endsAt?.slice(0, 10) ?? '' } : { title: '', subtitle: '', imageUrl: null, ctaLabel: '', ctaUrl: '', placement: 'home_inline', audience: 'all', startsAt: '', endsAt: '', isActive: true, priority: 1 })
  open.value = true
}
async function save() {
  if (!form.title) return ui.error('Title is required')
  const payload = { ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null }
  if (editing.value) await adminApi.settings.updateBanner(editing.value.id, payload)
  else await adminApi.settings.createBanner(payload)
  open.value = false
  ui.success('Banner saved')
  void refresh()
}
async function remove(b: Banner) {
  if (!(await ui.confirm({ title: `Delete “${b.title}”?`, variant: 'danger', confirmLabel: 'Delete' }))) return
  await adminApi.settings.deleteBanner(b.id)
  void refresh()
}
</script>

<template>
  <div>
    <AdminPageHeader title="Promotional banners" description="Shown on web and in the mobile apps by placement and audience." :back="{ name: 'admin.settings' }"><Can perm="settings.manage"><UiButton size="sm" @click="edit(null)"><Plus class="h-4 w-4" />New banner</UiButton></Can></AdminPageHeader>
    <div v-if="loading" class="grid gap-4 md:grid-cols-2"><UiSkeleton v-for="i in 3" :key="i" class="h-40 rounded-2xl" /></div>
    <UiEmptyState v-else-if="!data?.length" title="No banners" compact />
    <div v-else class="grid gap-4 md:grid-cols-2">
      <div v-for="b in data" :key="b.id" class="card overflow-hidden">
        <div class="relative h-28 bg-brand-100"><img v-if="b.imageUrl" :src="b.imageUrl" alt="" class="h-full w-full object-cover" /><div class="absolute inset-0 flex flex-col justify-center p-4" :class="b.imageUrl && 'bg-black/40 text-white'"><p class="font-semibold">{{ b.title }}</p><p class="line-clamp-1 text-sm opacity-80">{{ b.subtitle }}</p></div></div>
        <div class="flex items-center gap-2 p-4 text-sm"><UiBadge :tone="b.isActive ? 'success' : 'neutral'" size="sm">{{ b.isActive ? 'Active' : 'Inactive' }}</UiBadge><span class="text-xs text-ink-500">{{ placements.find((p) => p.value === b.placement)?.label }} · {{ b.audience }}</span><span class="ml-auto text-xs text-ink-500">{{ formatNumber(b.impressions, { compact: true }) }} views · {{ b.impressions ? ((b.clicks / b.impressions) * 100).toFixed(1) : 0 }}% CTR</span></div>
        <div class="flex items-center justify-between border-t border-ink-100 px-4 py-2 text-xs text-ink-500"><span>{{ b.startsAt ? formatDate(b.startsAt) : 'Always' }}{{ b.endsAt ? ` → ${formatDate(b.endsAt)}` : '' }}</span><Can perm="settings.manage"><div class="flex"><button type="button" class="p-2" aria-label="Edit" @click="edit(b)"><Pencil class="h-4 w-4" /></button><button type="button" class="p-2 text-danger-500" aria-label="Delete" @click="remove(b)"><Trash2 class="h-4 w-4" /></button></div></Can></div>
      </div>
    </div>
    <UiDrawer v-model:open="open" :title="editing ? 'Edit banner' : 'New banner'">
      <div class="space-y-4">
        <UiImageUploader v-model="form.imageUrl" purpose="banner" aspect="banner" label="Image (optional)" />
        <UiInput v-model="form.title" label="Title" /><UiInput v-model="form.subtitle" label="Subtitle" />
        <div class="grid gap-3 sm:grid-cols-2"><UiInput v-model="form.ctaLabel" label="Button label" /><UiInput v-model="form.ctaUrl" label="Button link" placeholder="/events?search=december" /></div>
        <div class="grid gap-3 sm:grid-cols-2"><UiSelect v-model="form.placement" label="Placement" :options="placements" /><UiSelect v-model="form.audience" label="Audience" :options="['all', 'individuals', 'businesses', 'guests'].map((a) => ({ label: a, value: a }))" /></div>
        <div class="grid gap-3 sm:grid-cols-2"><UiInput v-model="form.startsAt" type="date" label="Starts" /><UiInput v-model="form.endsAt" type="date" label="Ends" /></div>
        <UiInput :model-value="form.priority" type="number" label="Priority (lower shows first)" @update:model-value="form.priority = Number($event)" />
        <UiToggle :model-value="!!form.isActive" label="Active" @update:model-value="form.isActive = $event" />
      </div>
      <template #footer><UiButton block @click="save">Save banner</UiButton></template>
    </UiDrawer>
  </div>
</template>
