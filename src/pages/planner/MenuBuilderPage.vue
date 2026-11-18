<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GripVertical, Plus, Trash2, Eye, Pencil } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiMoneyInput from '@/components/ui/UiMoneyInput.vue'
import UiModal from '@/components/ui/UiModal.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiImageUploader from '@/components/ui/UiImageUploader.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { plannerApi } from '@/services/api/planner.api'
import { useUiStore } from '@/stores/ui.store'
import { formatMoney } from '@/utils/format'
import { uuid } from '@/utils/id'
import type { PlannerMenu, PlannerMenuSection } from '@/types'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = ref<string | null>(route.params.id ? String(route.params.id) : null)
const loading = ref(!!id.value)
const saving = ref(false)
const mode = ref<'edit' | 'preview'>('edit')
const menu = reactive<Pick<PlannerMenu, 'name' | 'sections'>>({ name: 'Untitled menu', sections: [] })
const dishOpen = ref(false)
const dishSection = ref<string>('')
const dishIndex = ref<number | null>(null)
const dish = reactive({ name: '', description: '', price: 0 as number | null, imageUrl: null as string | null })

onMounted(async () => {
  if (!id.value) {
    menu.sections = [{ id: uuid(), title: 'Main dishes', items: [] }]
    return
  }
  try {
    const m = await plannerApi.menu(id.value)
    menu.name = m.name
    menu.sections = m.sections
  } finally {
    loading.value = false
  }
})
const dishCount = computed(() => menu.sections.reduce((a, s) => a + s.items.length, 0))
function addSection() {
  menu.sections.push({ id: uuid(), title: 'New section', items: [] })
}
function openDish(section: PlannerMenuSection, index: number | null) {
  dishSection.value = section.id
  dishIndex.value = index
  const existing = index === null ? null : section.items[index]
  Object.assign(dish, existing ? { name: existing.name, description: existing.description ?? '', price: existing.price, imageUrl: existing.imageUrl } : { name: '', description: '', price: null, imageUrl: null })
  dishOpen.value = true
}
function saveDish() {
  if (dish.name.trim().length < 2 || !dish.price) return ui.error('Add a name and price')
  const s = menu.sections.find((x) => x.id === dishSection.value)
  if (!s) return
  const item = { id: dishIndex.value === null ? uuid() : s.items[dishIndex.value]!.id, name: dish.name, description: dish.description || null, price: dish.price, imageUrl: dish.imageUrl }
  if (dishIndex.value === null) s.items.push(item)
  else s.items[dishIndex.value] = item
  dishOpen.value = false
}
async function save() {
  if (!dishCount.value) return ui.error('Add at least one dish')
  saving.value = true
  try {
    const saved = id.value ? await plannerApi.updateMenu(id.value, { ...menu }) : await plannerApi.createMenu({ ...menu })
    if (!id.value) {
      id.value = saved.id
      router.replace({ name: 'planner.menu', params: { id: saved.id } })
    }
    ui.success('Menu saved')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container-app max-w-4xl pb-10 pt-8">
    <UiBackButton :to="{ name: 'planner' }" />
    <UiSpinner v-if="loading" page />
    <template v-else>
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <input v-model="menu.name" class="border-0 bg-transparent p-0 font-display text-3xl font-bold focus:ring-0" aria-label="Menu name" />
        <div class="flex gap-2"><UiTabs v-model="mode" variant="segment" size="sm" :tabs="[{ key: 'edit', label: 'Edit', icon: Pencil }, { key: 'preview', label: 'Preview', icon: Eye }]" /><UiButton :loading="saving" @click="save">Save menu</UiButton></div>
      </div>
      <p class="mt-1 text-sm text-ink-500">{{ dishCount }} dishes · assign this menu to an event under Event Assets so guests can pre-order.</p>

      <div v-if="mode === 'preview'" class="mx-auto mt-8 max-w-xl rounded-3xl bg-[#fbf6ef] p-8 shadow-card">
        <h2 class="text-center font-display text-3xl tracking-wide">{{ menu.name }}</h2>
        <section v-for="s in menu.sections" :key="s.id" class="mt-8"><h3 class="border-b border-ink-300 pb-1 text-center text-sm font-semibold uppercase tracking-[0.2em]">{{ s.title }}</h3><div v-for="it in s.items" :key="it.id" class="mt-4 flex items-start gap-4"><img v-if="it.imageUrl" :src="it.imageUrl" alt="" class="h-14 w-14 rounded-full object-cover" /><div class="flex-1"><p class="font-semibold uppercase">{{ it.name }}</p><p class="text-xs text-ink-500">{{ it.description }}</p></div><span class="font-display text-xl">{{ (it.price / 100).toLocaleString() }}</span></div></section>
      </div>

      <div v-else class="mt-8 space-y-6">
        <UiEmptyState v-if="!menu.sections.length" title="Empty menu" description="Start by adding a section like Starters or Main dishes." compact />
        <section v-for="(s, si) in menu.sections" :key="s.id" class="card p-4">
          <div class="flex items-center gap-2"><GripVertical class="h-4 w-4 text-ink-300" /><input v-model="s.title" class="flex-1 border-0 p-0 font-semibold focus:ring-0" aria-label="Section title" /><button type="button" class="text-danger-500" aria-label="Delete section" @click="menu.sections.splice(si, 1)"><Trash2 class="h-4 w-4" /></button></div>
          <ul class="mt-3 divide-y divide-ink-100">
            <li v-for="(it, ii) in s.items" :key="it.id" class="flex items-center gap-3 py-2.5"><img v-if="it.imageUrl" :src="it.imageUrl" alt="" class="h-10 w-10 rounded-lg object-cover" /><div class="min-w-0 flex-1"><p class="truncate font-medium">{{ it.name }}</p><p class="truncate text-xs text-ink-500">{{ it.description }}</p></div><span class="text-sm">{{ formatMoney(it.price) }}</span><button type="button" class="p-1" aria-label="Edit dish" @click="openDish(s, ii)"><Pencil class="h-4 w-4" /></button><button type="button" class="p-1 text-danger-500" aria-label="Delete dish" @click="s.items.splice(ii, 1)"><Trash2 class="h-4 w-4" /></button></li>
          </ul>
          <UiButton variant="soft" size="sm" class="mt-3" @click="openDish(s, null)"><Plus class="h-4 w-4" />Add dish</UiButton>
        </section>
        <button type="button" class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-600 py-4 font-medium text-brand-600 hover:bg-brand-50" @click="addSection"><Plus class="h-5 w-5" />Add section</button>
      </div>
    </template>
    <UiModal v-model:open="dishOpen" :title="dishIndex === null ? 'Add dish' : 'Edit dish'">
      <div class="space-y-4"><UiImageUploader v-model="dish.imageUrl" purpose="menu_item" aspect="square" class="w-32" /><UiInput v-model="dish.name" label="Dish name" placeholder="Jollof Rice" /><UiTextarea v-model="dish.description" label="Description" :rows="2" :maxlength="200" /><UiMoneyInput v-model="dish.price" label="Price" /></div>
      <template #footer><UiButton block size="lg" @click="saveDish">Save dish</UiButton></template>
    </UiModal>
  </div>
</template>
