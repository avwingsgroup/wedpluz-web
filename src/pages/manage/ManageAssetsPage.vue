<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { LayoutGrid, List, Plus, Settings2, UtensilsCrossed, Armchair } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import SeatMap from '@/modules/checkout/SeatMap.vue'
import { organizerApi, type ManagedEvent } from '@/services/api/organizer.api'
import { plannerApi } from '@/services/api/planner.api'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { HallLayout, PlannerMenu } from '@/types'

const route = useRoute()
const ui = useUiStore()
const id = String(route.params.id)
const event = ref<ManagedEvent | null>(null)
const layouts = ref<HallLayout[]>([])
const menus = ref<PlannerMenu[]>([])
const loading = ref(true)
const scheduleIndex = ref(0)
const view = ref<'grid' | 'list'>('grid')
const picker = ref<'hall' | 'menu' | null>(null)
const preview = ref<HallLayout | null>(null)

onMounted(async () => {
  try {
    ;[event.value, layouts.value, menus.value] = await Promise.all([organizerApi.get(id), plannerApi.hallLayouts(), plannerApi.menus()])
  } finally {
    loading.value = false
  }
})
const schedule = computed(() => event.value?.schedules[scheduleIndex.value])
const hall = computed(() => layouts.value.find((h) => h.id === schedule.value?.hallLayoutId) ?? null)
const menu = computed(() => menus.value.find((m) => m.id === schedule.value?.menuId) ?? null)

async function assign(kind: 'hall' | 'menu', assetId: string | null) {
  if (!event.value || !schedule.value) return
  const schedules = event.value.schedules.map((s, i) => (i === scheduleIndex.value ? { ...s, [kind === 'hall' ? 'hallLayoutId' : 'menuId']: assetId } : s))
  try {
    const updated = await organizerApi.update(id, { schedules })
    event.value = { ...event.value, schedules: updated.schedules }
    picker.value = null
    ui.success(kind === 'hall' ? 'Hall layout assigned' : 'Menu assigned')
  } catch (e) {
    ui.error((e as Error).message)
  }
}
</script>

<template>
  <div class="container-app pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.overview', params: { id } }" />
    <h1 class="mt-6 text-3xl">Event Assets</h1>
    <p class="mt-1 text-sm text-ink-500">Hall layouts and menus used for seat selection and food pre-orders.</p>
    <div v-if="loading" class="mt-8 grid gap-4 md:grid-cols-2"><UiSkeleton class="h-64 rounded-2xl" /><UiSkeleton class="h-64 rounded-2xl" /></div>
    <template v-else-if="event">
      <UiTabs v-if="event.schedules.length > 1" class="mt-6" variant="pill" :model-value="String(scheduleIndex)" :tabs="event.schedules.map((s, i) => ({ key: String(i), label: `${s.label ?? `Day ${i + 1}`} · ${formatDate(s.startsAt)}` }))" @update:model-value="scheduleIndex = Number($event)" />
      <div class="mt-6 grid gap-6 md:grid-cols-2">
        <section class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-ink-100 p-4"><h2 class="flex items-center gap-2 font-medium"><Armchair class="h-5 w-5" />Hall layout</h2><div class="flex gap-2"><UiButton v-if="hall" size="xs" variant="ghost" @click="preview = hall"><Settings2 class="h-4 w-4" />View</UiButton><UiButton size="xs" variant="soft" @click="picker = 'hall'">{{ hall ? 'Change' : 'Select' }}</UiButton></div></div>
          <div v-if="hall"><img :src="hall.thumbnailUrl ?? ''" alt="" class="aspect-video w-full bg-ink-100 object-cover" /><div class="flex justify-between p-4 text-sm"><span class="font-medium">{{ hall.name }}</span><span class="text-ink-500">{{ hall.totalSeats }} seats · {{ hall.reservedSeats }} reserved</span></div></div>
          <UiEmptyState v-else title="No hall layout" description="Select a layout so guests can choose seats." compact illustration="generic"><UiButton size="sm" @click="picker = 'hall'">Select layout</UiButton></UiEmptyState>
        </section>
        <section class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-ink-100 p-4"><h2 class="flex items-center gap-2 font-medium"><UtensilsCrossed class="h-5 w-5" />Menu</h2><UiButton size="xs" variant="soft" @click="picker = 'menu'">{{ menu ? 'Change' : 'Select' }}</UiButton></div>
          <div v-if="menu" class="divide-y divide-ink-100"><div v-for="sec in menu.sections" :key="sec.id" class="p-4"><p class="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">{{ sec.title }}</p><div v-for="it in sec.items" :key="it.id" class="flex justify-between py-1 text-sm"><span>{{ it.name }}</span><span class="text-ink-500">{{ formatMoney(it.price) }}</span></div></div></div>
          <UiEmptyState v-else title="No menu" description="Add a menu so guests can pre-order food." compact illustration="generic"><UiButton size="sm" @click="picker = 'menu'">Select menu</UiButton></UiEmptyState>
        </section>
      </div>
    </template>

    <UiDrawer :open="!!picker" :title="picker === 'hall' ? 'Select a hall layout' : 'Select Menu'" @update:open="picker = null">
      <div class="mb-4 flex items-center justify-between"><UiButton size="sm" variant="outline" :to="picker === 'hall' ? { name: 'planner.hall' } : { name: 'planner.menu' }"><Plus class="h-4 w-4" />Create new</UiButton><div class="flex gap-1"><button type="button" :class="cn('rounded-lg p-2', view === 'grid' && 'bg-ink-100')" aria-label="Grid view" @click="view = 'grid'"><LayoutGrid class="h-4 w-4" /></button><button type="button" :class="cn('rounded-lg p-2', view === 'list' && 'bg-ink-100')" aria-label="List view" @click="view = 'list'"><List class="h-4 w-4" /></button></div></div>
      <template v-if="picker === 'hall'">
        <UiEmptyState v-if="!layouts.length" title="No layouts yet" description="Build one with the Pluz planner hall layout tool." compact />
        <div :class="view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'">
          <button v-for="h in layouts" :key="h.id" type="button" :class="cn('card overflow-hidden text-left', view === 'list' && 'flex items-center gap-3 p-2', hall?.id === h.id && 'ring-2 ring-brand-600')" @click="assign('hall', h.id)"><img :src="h.thumbnailUrl ?? ''" alt="" :class="view === 'grid' ? 'aspect-[4/3] w-full object-cover' : 'h-14 w-14 rounded-lg object-cover'" /><div :class="view === 'grid' && 'p-3'"><p class="font-medium">{{ h.name }}</p><p class="text-xs text-ink-500">{{ h.totalSeats }} seats</p></div></button>
        </div>
      </template>
      <template v-else>
        <UiEmptyState v-if="!menus.length" title="No menus yet" compact />
        <div :class="view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'">
          <button v-for="m in menus" :key="m.id" type="button" :class="cn('card p-4 text-left', menu?.id === m.id && 'ring-2 ring-brand-600')" @click="assign('menu', m.id)"><p class="font-medium">{{ m.name }}</p><p class="text-xs text-ink-500">{{ m.sections.reduce((a, s) => a + s.items.length, 0) }} dishes</p></button>
        </div>
      </template>
      <template v-if="(picker === 'hall' && hall) || (picker === 'menu' && menu)" #footer><UiButton variant="ghost" class="text-danger-500" block @click="assign(picker!, null)">Remove from this day</UiButton></template>
    </UiDrawer>
    <UiDrawer :open="!!preview" :title="preview?.name" size="lg" :padded="false" @update:open="preview = null">
      <SeatMap v-if="preview" class="h-[70vh]" :layout="preview" schedule-id="" :selected="[]" :max="0" readonly />
    </UiDrawer>
  </div>
</template>
