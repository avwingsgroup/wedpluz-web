<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Circle, Copy, House, Minus, Plus, RectangleHorizontal, Rows3, Save, StickyNote, Star, Trash2, Undo2, Lock } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import { plannerApi } from '@/services/api/planner.api'
import { useUiStore } from '@/stores/ui.store'
import { uuid } from '@/utils/id'
import { cn } from '@/utils/cn'
import type { HallFixture, HallLayout, HallTable } from '@/types'

/**
 * Hall layout editor (SVG). Drag tables/fixtures, edit seats, mark reserved seats and colour
 * tables. The resulting JSON is what the seat picker renders at checkout, and is the contract
 * documented as `HallLayout` in the OpenAPI spec.
 */
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const id = ref<string | null>(route.params.id ? String(route.params.id) : null)
const loading = ref(!!id.value)
const saving = ref(false)
const layout = reactive<Omit<HallLayout, 'id' | 'updatedAt' | 'thumbnailUrl'>>({ name: 'Untitled layout', width: 1200, height: 900, totalSeats: 0, reservedSeats: 0, tables: [], fixtures: [] })
const selectedId = ref<string | null>(null)
const zoom = ref(1)
const history = ref<string[]>([])
const svg = ref<SVGSVGElement | null>(null)
let drag: { id: string; kind: 'table' | 'fixture'; dx: number; dy: number } | null = null
const COLORS = [null, '#9b119b', '#e7257f', '#3b6ff2', '#22a847', '#f5b544']

onMounted(async () => {
  if (!id.value) return
  try {
    const h = await plannerApi.hallLayout(id.value)
    Object.assign(layout, { name: h.name, width: h.width, height: h.height, tables: h.tables, fixtures: h.fixtures })
  } finally {
    loading.value = false
  }
})
const totals = computed(() => ({ seats: layout.tables.reduce((a, t) => a + t.seats.length, 0), reserved: layout.tables.reduce((a, t) => a + t.seats.filter((s) => s.status === 'reserved').length, 0) }))
const selectedTable = computed(() => layout.tables.find((t) => t.id === selectedId.value) ?? null)
const selectedFixture = computed(() => layout.fixtures.find((f) => f.id === selectedId.value) ?? null)

function snapshot() {
  history.value = [...history.value.slice(-29), JSON.stringify({ tables: layout.tables, fixtures: layout.fixtures })]
}
function undo() {
  const prev = history.value.pop()
  if (!prev) return
  const s = JSON.parse(prev) as Pick<HallLayout, 'tables' | 'fixtures'>
  layout.tables = s.tables
  layout.fixtures = s.fixtures
}
function makeSeats(tableId: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${tableId}_s${i + 1}`, label: `Seat ${i + 1}`, status: 'available' as const, ticketTypeId: null }))
}
function addTable(shape: HallTable['shape']) {
  snapshot()
  const tid = `t_${uuid().slice(0, 6)}`
  const n = layout.tables.filter((t) => t.shape !== 'row').length + 1
  const dims = shape === 'round' ? { width: 90, height: 90 } : shape === 'rectangle' ? { width: 80, height: 170 } : { width: 30, height: 300 }
  layout.tables.push({ id: tid, label: shape === 'row' ? `Row ${layout.tables.filter((t) => t.shape === 'row').length + 1}` : `Table ${n}`, shape, x: layout.width / 2 - dims.width / 2, y: layout.height / 2 - dims.height / 2, rotation: 0, color: null, seats: makeSeats(tid, shape === 'row' ? 10 : 8), ...dims })
  selectedId.value = tid
}
function addFixture(type: HallFixture['type']) {
  snapshot()
  const fid = `f_${uuid().slice(0, 6)}`
  const labels: Record<string, string> = { stage: 'Stage', dance_floor: 'Dance Floor', dj: 'DJ', cake: 'Cake Table', entrance: 'Entrance', note: 'Note', special: 'Special area' }
  layout.fixtures.push({ id: fid, label: labels[type] ?? type, type, x: layout.width / 2 - 70, y: 120, width: type === 'dj' || type === 'cake' ? 70 : 160, height: type === 'entrance' ? 40 : type === 'dj' || type === 'cake' ? 70 : 110 })
  selectedId.value = fid
}
function toSvgPoint(e: PointerEvent) {
  const pt = svg.value!.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  return pt.matrixTransform(svg.value!.getScreenCTM()!.inverse())
}
function startDrag(e: PointerEvent, idv: string, kind: 'table' | 'fixture') {
  selectedId.value = idv
  const item = kind === 'table' ? layout.tables.find((t) => t.id === idv) : layout.fixtures.find((f) => f.id === idv)
  if (!item) return
  snapshot()
  const p = toSvgPoint(e)
  drag = { id: idv, kind, dx: p.x - item.x, dy: p.y - item.y }
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!drag) return
  const p = toSvgPoint(e)
  const item = drag.kind === 'table' ? layout.tables.find((t) => t.id === drag!.id) : layout.fixtures.find((f) => f.id === drag!.id)
  if (!item) return
  item.x = Math.round(Math.max(0, Math.min(layout.width - item.width, p.x - drag.dx)) / 10) * 10
  item.y = Math.round(Math.max(0, Math.min(layout.height - item.height, p.y - drag.dy)) / 10) * 10
}
function endDrag() {
  drag = null
}
function setSeatCount(n: number) {
  const t = selectedTable.value
  if (!t || n < 1 || n > 40) return
  snapshot()
  const existing = t.seats.slice(0, n)
  t.seats = [...existing, ...makeSeats(t.id, n).slice(existing.length)]
}
function toggleSeatReserved(seatId: string) {
  const t = selectedTable.value
  const s = t?.seats.find((x) => x.id === seatId)
  if (!s || s.status === 'taken') return
  s.status = s.status === 'reserved' ? 'available' : 'reserved'
}
function duplicate() {
  const t = selectedTable.value
  if (!t) return
  snapshot()
  const tid = `t_${uuid().slice(0, 6)}`
  layout.tables.push({ ...JSON.parse(JSON.stringify(t)), id: tid, label: `${t.label} copy`, x: Math.min(layout.width - t.width, t.x + 40), y: Math.min(layout.height - t.height, t.y + 40), seats: makeSeats(tid, t.seats.length) })
  selectedId.value = tid
}
function removeSelected() {
  if (!selectedId.value) return
  snapshot()
  layout.tables = layout.tables.filter((t) => t.id !== selectedId.value)
  layout.fixtures = layout.fixtures.filter((f) => f.id !== selectedId.value)
  selectedId.value = null
}
function seatPositions(t: HallTable) {
  const n = t.seats.length
  if (t.shape === 'round') {
    const r = t.width / 2 + 12
    return t.seats.map((seat, i) => ({ seat, x: t.x + t.width / 2 + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), y: t.y + t.height / 2 + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2) }))
  }
  if (t.shape === 'row') return t.seats.map((seat, i) => ({ seat, x: t.x + t.width / 2, y: t.y + (t.height / n) * (i + 0.5) }))
  const per = Math.ceil(n / 2)
  return t.seats.map((seat, i) => ({ seat, x: i < per ? t.x - 12 : t.x + t.width + 12, y: t.y + (t.height / per) * ((i % per) + 0.5) }))
}
async function save() {
  if (!layout.tables.length) return ui.error('Add at least one table or row')
  saving.value = true
  try {
    const payload = { ...layout, totalSeats: totals.value.seats, reservedSeats: totals.value.reserved }
    const saved = id.value ? await plannerApi.updateHallLayout(id.value, payload) : await plannerApi.createHallLayout(payload)
    if (!id.value) {
      id.value = saved.id
      router.replace({ name: 'planner.hall', params: { id: saved.id } })
    }
    ui.success('Layout saved')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    saving.value = false
  }
}
function onKey(e: KeyboardEvent) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.value && !(e.target instanceof HTMLInputElement)) removeSelected()
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') undo()
}
</script>

<template>
  <div class="mx-auto max-w-[1440px] px-4 py-6 sm:px-6" tabindex="-1" @keydown="onKey">
    <div class="flex flex-wrap items-center gap-3">
      <UiBackButton :to="{ name: 'planner' }" />
      <input v-model="layout.name" class="border-0 bg-transparent p-0 font-display text-2xl font-bold focus:ring-0" aria-label="Layout name" />
      <span class="text-sm text-ink-500">{{ totals.seats }} seats · {{ totals.reserved }} reserved</span>
      <div class="ml-auto flex gap-2"><UiButton variant="outline" size="sm" :disabled="!history.length" @click="undo"><Undo2 class="h-4 w-4" />Undo</UiButton><UiButton size="sm" :loading="saving" @click="save"><Save class="h-4 w-4" />Save layout</UiButton></div>
    </div>
    <UiSpinner v-if="loading" page />
    <div v-else class="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
      <aside class="card space-y-1 p-3">
        <p class="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-400">Tables</p>
        <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="addTable('round')"><Circle class="h-4 w-4" />Round table</button>
        <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="addTable('rectangle')"><RectangleHorizontal class="h-4 w-4" />Rectangular table</button>
        <button type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="addTable('row')"><Rows3 class="h-4 w-4" />Chair rows</button>
        <p class="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Custom additions</p>
        <button v-for="f in ([['stage', 'Stage'], ['dance_floor', 'Dance floor'], ['dj', 'DJ booth'], ['cake', 'Cake table'], ['entrance', 'Entrance'], ['special', 'Special area'], ['note', 'Note']] as const)" :key="f[0]" type="button" class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-ink-50" @click="addFixture(f[0])"><StickyNote v-if="f[0] === 'note'" class="h-4 w-4" /><Star v-else class="h-4 w-4" />{{ f[1] }}</button>
      </aside>

      <div class="relative min-h-[560px] overflow-hidden rounded-2xl bg-[#efe6dd]" style="background-image: radial-gradient(circle, rgba(0,0,0,.08) 1px, transparent 1.5px); background-size: 28px 28px">
        <svg ref="svg" class="h-full w-full touch-none select-none" :viewBox="`0 0 ${layout.width} ${layout.height}`" :style="{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform .15s' }" @pointermove="onMove" @pointerup="endDrag" @pointerleave="endDrag" @click.self="selectedId = null">
          <g v-for="f in layout.fixtures" :key="f.id" class="cursor-move" @pointerdown.stop="startDrag($event, f.id, 'fixture')">
            <rect :x="f.x" :y="f.y" :width="f.width" :height="f.height" rx="10" :fill="f.type === 'note' ? '#fff7e6' : f.type === 'special' ? '#eef4ff' : '#fdf4fd'" :stroke="selectedId === f.id ? '#e7257f' : '#9b119b'" :stroke-width="selectedId === f.id ? 3 : 1.5" :stroke-dasharray="f.type === 'entrance' ? '6 4' : undefined" />
            <text :x="f.x + f.width / 2" :y="f.y + f.height / 2" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="#21242a" pointer-events="none">{{ f.label }}</text>
          </g>
          <g v-for="t in layout.tables" :key="t.id" class="cursor-move" @pointerdown.stop="startDrag($event, t.id, 'table')">
            <circle v-if="t.shape === 'round'" :cx="t.x + t.width / 2" :cy="t.y + t.height / 2" :r="t.width / 2" fill="#fff" :stroke="selectedId === t.id ? '#e7257f' : t.color ?? '#8f949c'" :stroke-width="selectedId === t.id ? 3 : 2" />
            <rect v-else :x="t.x" :y="t.y" :width="t.width" :height="t.height" rx="6" fill="#fff" :stroke="selectedId === t.id ? '#e7257f' : t.color ?? '#8f949c'" :stroke-width="selectedId === t.id ? 3 : 2" />
            <text :x="t.x + t.width / 2" :y="t.y + t.height / 2" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="#3c4048" pointer-events="none">{{ t.label }}</text>
            <circle v-for="p in seatPositions(t)" :key="p.seat.id" :cx="p.x" :cy="p.y" r="7" :fill="p.seat.status === 'reserved' ? '#f5b544' : p.seat.status === 'taken' ? '#bcbdc0' : (t.color ?? '#ff6a2a')" stroke="#fff" stroke-width="1.5" pointer-events="none" />
          </g>
        </svg>
        <div class="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl bg-white p-1.5 shadow-float">
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-ink-100" aria-label="Zoom in" @click="zoom = Math.min(2, zoom + 0.1)"><Plus class="h-4 w-4" /></button>
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-label="Reset zoom" @click="zoom = 1"><House class="h-4 w-4" /></button>
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-ink-100" aria-label="Zoom out" @click="zoom = Math.max(0.5, zoom - 0.1)"><Minus class="h-4 w-4" /></button>
        </div>
        <p v-if="!layout.tables.length && !layout.fixtures.length" class="pointer-events-none absolute inset-0 flex items-center justify-center text-ink-500">Add tables and areas from the left panel</p>
      </div>

      <aside class="card p-4">
        <template v-if="selectedTable">
          <h3 class="font-semibold">Layout settings</h3>
          <div class="mt-4 space-y-4">
            <UiInput v-model="selectedTable.label" label="Label" />
            <UiInput :model-value="selectedTable.seats.length" type="number" min="1" max="40" label="Total seats" @update:model-value="setSeatCount(Number($event))" />
            <div><p class="label">Colour</p><div class="flex gap-2"><button v-for="c in COLORS" :key="String(c)" type="button" :class="cn('h-7 w-7 rounded-full border-2', selectedTable.color === c ? 'border-ink-900' : 'border-white ring-1 ring-ink-200')" :style="{ background: c ?? '#ff6a2a' }" :aria-label="c ?? 'Default colour'" @click="selectedTable.color = c" /></div></div>
            <div><p class="label flex items-center gap-1.5"><Lock class="h-3.5 w-3.5" />Reserve seats</p><div class="flex flex-wrap gap-1.5"><button v-for="s in selectedTable.seats" :key="s.id" type="button" :disabled="s.status === 'taken'" :class="cn('rounded-full border px-2.5 py-1 text-xs', s.status === 'reserved' ? 'border-warning-500 bg-warning-50' : s.status === 'taken' ? 'border-ink-200 text-ink-400 line-through' : 'border-ink-200')" @click="toggleSeatReserved(s.id)">{{ s.label.replace('Seat ', '') }}</button></div><p class="mt-1 text-xs text-ink-500">Reserved seats can’t be booked by guests (VIPs, family).</p></div>
            <div class="flex gap-2"><UiButton size="sm" variant="outline" @click="duplicate"><Copy class="h-4 w-4" />Duplicate</UiButton><UiButton size="sm" variant="ghost" class="text-danger-500" @click="removeSelected"><Trash2 class="h-4 w-4" />Delete</UiButton></div>
          </div>
        </template>
        <template v-else-if="selectedFixture">
          <h3 class="font-semibold">{{ selectedFixture.type === 'note' ? 'Note' : 'Area' }}</h3>
          <div class="mt-4 space-y-4">
            <UiInput v-model="selectedFixture.label" label="Label" />
            <div class="grid grid-cols-2 gap-2"><UiInput :model-value="selectedFixture.width" type="number" label="Width" @update:model-value="selectedFixture.width = Number($event) || 40" /><UiInput :model-value="selectedFixture.height" type="number" label="Height" @update:model-value="selectedFixture.height = Number($event) || 40" /></div>
            <UiButton size="sm" variant="ghost" class="text-danger-500" @click="removeSelected"><Trash2 class="h-4 w-4" />Delete</UiButton>
          </div>
        </template>
        <div v-else class="text-sm text-ink-500"><h3 class="mb-2 font-semibold text-ink-900">Tips</h3><ul class="list-disc space-y-1.5 pl-4"><li>Drag items to position them (snaps to a 10px grid).</li><li>Select a table to change seats, colour or reserve seats.</li><li>Delete/Backspace removes the selection, Ctrl/Cmd+Z undoes.</li><li>Assign tables to ticket types after saving, from Event Assets.</li></ul></div>
      </aside>
    </div>
  </div>
</template>
