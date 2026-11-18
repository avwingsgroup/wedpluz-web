<script setup lang="ts">
import { computed, ref } from 'vue'
import { House, Minus, Plus, List } from 'lucide-vue-next'
import type { HallLayout, HallSeat, HallTable, SeatSelection } from '@/types'
import { cn } from '@/utils/cn'

/**
 * Interactive hall layout renderer (SVG). Used by the checkout seat picker and the
 * organizer/planner layout tools (read-only here; editing lives in HallLayoutEditor).
 */
const props = withDefaults(defineProps<{ layout: HallLayout; scheduleId: string; selected: SeatSelection[]; max: number; readonly?: boolean; showList?: boolean }>(), { readonly: false, showList: true })
const emit = defineEmits<{ toggle: [seat: SeatSelection] }>()

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const dragging = ref<{ x: number; y: number; px: number; py: number } | null>(null)
const view = ref<'map' | 'list'>('map')

const selectedIds = computed(() => new Set(props.selected.map((s) => s.seatId)))
function seatState(s: HallSeat): HallSeat['status'] {
  if (selectedIds.value.has(s.id)) return 'selected'
  return s.status
}
function seatColor(s: HallSeat) {
  const st = seatState(s)
  return st === 'selected' ? '#22a847' : st === 'taken' ? '#bcbdc0' : st === 'reserved' ? '#f5b544' : '#ff6a2a'
}
function seatPositions(t: HallTable): Array<{ seat: HallSeat; x: number; y: number }> {
  const n = t.seats.length
  if (t.shape === 'round') {
    const r = t.width / 2 + 12
    const cx = t.x + t.width / 2
    const cy = t.y + t.height / 2
    return t.seats.map((seat, i) => ({ seat, x: cx + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), y: cy + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2) }))
  }
  if (t.shape === 'row') {
    const step = t.height / n
    return t.seats.map((seat, i) => ({ seat, x: t.x + t.width / 2, y: t.y + step * (i + 0.5) }))
  }
  // rectangle: half each long side
  const perSide = Math.ceil(n / 2)
  const step = t.height / perSide
  return t.seats.map((seat, i) => ({ seat, x: i < perSide ? t.x - 12 : t.x + t.width + 12, y: t.y + step * ((i % perSide) + 0.5) }))
}
function onSeatClick(t: HallTable, s: HallSeat) {
  if (props.readonly) return
  const st = seatState(s)
  if (st === 'taken' || st === 'reserved') return
  if (st !== 'selected' && props.selected.length >= props.max) return
  emit('toggle', { scheduleId: props.scheduleId, seatId: s.id, tableLabel: t.label, seatLabel: s.label })
}
function startDrag(e: PointerEvent) {
  dragging.value = { x: e.clientX, y: e.clientY, px: pan.value.x, py: pan.value.y }
}
function onDrag(e: PointerEvent) {
  if (!dragging.value) return
  pan.value = { x: dragging.value.px + (e.clientX - dragging.value.x), y: dragging.value.py + (e.clientY - dragging.value.y) }
}
function endDrag() {
  dragging.value = null
}
function reset() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}
function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoom.value = Math.min(3, Math.max(0.5, zoom.value - Math.sign(e.deltaY) * 0.1))
}
const fixtureFill: Record<string, string> = { stage: '#fdf4fd', dance_floor: '#fdf4fd', dj: '#fff', cake: '#fff', entrance: 'transparent', note: '#fff7e6', special: '#eef4ff' }
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2 text-xs">
      <div class="flex items-center gap-4">
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-seat" />Available</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-ink-300" />Taken</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-success-500" />Your seat</span>
      </div>
      <span v-if="!readonly" class="font-medium text-ink-700">{{ selected.length }}/{{ max }} selected</span>
    </div>

    <div v-if="view === 'map'" class="relative flex-1 overflow-hidden bg-[#efe6dd]" style="background-image: radial-gradient(circle, rgba(0,0,0,.08) 1px, transparent 1.5px); background-size: 28px 28px">
      <svg
        class="h-full w-full touch-none select-none"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        preserveAspectRatio="xMidYMid meet"
        :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: dragging ? 'grabbing' : 'grab', transition: dragging ? 'none' : 'transform .15s' }"
        @pointerdown="startDrag"
        @pointermove="onDrag"
        @pointerup="endDrag"
        @pointerleave="endDrag"
        @wheel="onWheel"
      >
        <g v-for="f in layout.fixtures" :key="f.id">
          <rect :x="f.x" :y="f.y" :width="f.width" :height="f.height" rx="10" :fill="fixtureFill[f.type] ?? '#fff'" stroke="#9b119b" stroke-width="1.5" :stroke-dasharray="f.type === 'entrance' ? '6 4' : undefined" />
          <text :x="f.x + f.width / 2" :y="f.y + f.height / 2" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="#21242a">{{ f.label }}</text>
        </g>
        <g v-for="t in layout.tables" :key="t.id">
          <circle v-if="t.shape === 'round'" :cx="t.x + t.width / 2" :cy="t.y + t.height / 2" :r="t.width / 2" fill="#fff" :stroke="t.color ?? '#8f949c'" stroke-width="2" />
          <rect v-else :x="t.x" :y="t.y" :width="t.width" :height="t.height" rx="6" fill="#fff" :stroke="t.color ?? '#8f949c'" stroke-width="2" />
          <text :x="t.x + t.width / 2" :y="t.y + t.height / 2" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="600" fill="#3c4048">{{ t.label }}</text>
          <g v-for="p in seatPositions(t)" :key="p.seat.id" :class="cn(!readonly && seatState(p.seat) !== 'taken' && 'cursor-pointer')" @click.stop="onSeatClick(t, p.seat)" @pointerdown.stop>
            <circle :cx="p.x" :cy="p.y" r="7" :fill="seatColor(p.seat)" stroke="#fff" stroke-width="1.5">
              <title>{{ t.label }} · {{ p.seat.label }} ({{ seatState(p.seat) }})</title>
            </circle>
            <line v-if="seatState(p.seat) === 'taken'" :x1="p.x - 3" :y1="p.y - 3" :x2="p.x + 3" :y2="p.y + 3" stroke="#fff" stroke-width="1.5" />
            <line v-if="seatState(p.seat) === 'taken'" :x1="p.x + 3" :y1="p.y - 3" :x2="p.x - 3" :y2="p.y + 3" stroke="#fff" stroke-width="1.5" />
          </g>
        </g>
      </svg>
      <div class="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl bg-white p-1.5 shadow-float">
        <button v-if="showList" type="button" class="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-ink-100" aria-label="List view" @click="view = 'list'"><List class="h-4 w-4" /></button>
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-ink-100" aria-label="Zoom out" @click="zoom = Math.max(0.5, zoom - 0.2)"><Minus class="h-4 w-4" /></button>
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100" aria-label="Reset view" @click="reset"><House class="h-4 w-4" /></button>
        <button type="button" class="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-ink-100" aria-label="Zoom in" @click="zoom = Math.min(3, zoom + 0.2)"><Plus class="h-4 w-4" /></button>
      </div>
    </div>

    <!-- list view -->
    <div v-else class="flex-1 overflow-y-auto p-4">
      <button type="button" class="mb-3 text-sm font-medium text-brand-600 hover:underline" @click="view = 'map'">← Back to map</button>
      <div v-for="t in layout.tables" :key="t.id" class="mb-4">
        <h4 class="mb-2 text-sm font-semibold">{{ t.label }} <span class="font-normal text-ink-500">· {{ t.seats.filter((s) => seatState(s) === 'available').length }} available</span></h4>
        <div class="flex flex-wrap gap-2">
          <button v-for="s in t.seats" :key="s.id" type="button" :disabled="readonly || seatState(s) === 'taken' || seatState(s) === 'reserved'" :class="cn('rounded-full border px-3 py-1 text-xs', seatState(s) === 'selected' ? 'border-success-500 bg-success-50 text-success-600' : seatState(s) === 'available' ? 'border-seat/40 text-ink-700 hover:border-seat' : 'border-ink-200 text-ink-400 line-through')" @click="onSeatClick(t, s)">{{ s.label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
