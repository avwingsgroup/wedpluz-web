<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDownAZ, Clock, EllipsisVertical, Plus, Trash2, Pencil } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import { plannerApi } from '@/services/api/planner.api'
import { useAsync } from '@/composables/useAsync'
import { useUiStore } from '@/stores/ui.store'
import { formatDate } from '@/utils/format'
import type { PlannerAssetSummary } from '@/types'

const router = useRouter()
const ui = useUiStore()
const type = ref('all')
const sort = ref<'recent' | 'name'>('recent')
const { data, loading, refresh } = useAsync(() => plannerApi.assets({ type: type.value, sort: sort.value }), { watch: [type, sort] })
const labels: Record<string, string> = { menu: 'Menu', hall_layout: 'Hall layout', cake_design: 'Cake design', event_branding: 'Branding' }
function open(a: PlannerAssetSummary) {
  if (a.type === 'menu') router.push({ name: 'planner.menu', params: { id: a.id } })
  else if (a.type === 'hall_layout') router.push({ name: 'planner.hall', params: { id: a.id } })
  else if (a.thumbnailUrl) window.open(a.thumbnailUrl, '_blank', 'noopener')
}
async function remove(a: PlannerAssetSummary) {
  if (!(await ui.confirm({ title: `Delete “${a.name}”?`, description: 'Events using this asset will lose it.', variant: 'danger', confirmLabel: 'Delete' }))) return
  await plannerApi.deleteAsset(a.id)
  ui.success('Asset deleted')
  void refresh()
}
</script>

<template>
  <div class="container-app pb-10 pt-8">
    <UiBackButton :to="{ name: 'planner' }" />
    <div class="mt-6 flex flex-wrap items-center justify-between gap-3"><h1 class="text-3xl">Assets</h1><div class="flex gap-2"><UiButton variant="outline" size="sm" @click="sort = sort === 'recent' ? 'name' : 'recent'"><ArrowDownAZ v-if="sort === 'name'" class="h-4 w-4" /><Clock v-else class="h-4 w-4" />{{ sort === 'name' ? 'A–Z' : 'Recent' }}</UiButton><UiButton size="sm" :to="{ name: 'planner' }"><Plus class="h-4 w-4" />Create</UiButton></div></div>
    <UiTabs v-model="type" variant="pill" class="mt-6" :tabs="[{ key: 'all', label: 'All' }, { key: 'menu', label: 'Menus' }, { key: 'hall_layout', label: 'Hall layouts' }, { key: 'cake_design', label: 'Cakes' }, { key: 'event_branding', label: 'Branding' }]" />
    <div class="mt-6">
      <div v-if="loading" class="grid grid-cols-2 gap-4 md:grid-cols-4"><UiSkeleton v-for="i in 8" :key="i" class="aspect-[4/3] rounded-2xl" /></div>
      <UiEmptyState v-else-if="!data?.length" title="No assets yet" description="Menus, hall layouts and designs you create in Pluz planner are saved here." illustration="generic"><UiButton :to="{ name: 'planner' }">Open Pluz planner</UiButton></UiEmptyState>
      <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div v-for="a in data" :key="a.id" class="card group overflow-hidden">
          <button type="button" class="block w-full" @click="open(a)"><img :src="a.thumbnailUrl ?? ''" :alt="a.name" loading="lazy" class="aspect-[4/3] w-full bg-ink-100 object-cover transition group-hover:opacity-90" /></button>
          <div class="flex items-start gap-2 p-3"><div class="min-w-0 flex-1"><p class="truncate font-medium">{{ a.name }}</p><p class="text-xs text-ink-500">{{ labels[a.type] }} · {{ formatDate(a.updatedAt) }}</p></div>
            <UiDropdown :items="[{ label: 'Open', icon: Pencil, onClick: () => open(a) }, { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(a) }]" width="w-40"><template #trigger><button type="button" class="rounded-full p-1 hover:bg-ink-100" aria-label="Asset options"><EllipsisVertical class="h-4 w-4" /></button></template></UiDropdown>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
