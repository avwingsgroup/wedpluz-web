<script setup lang="ts">
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = defineProps<{ from: string; to: string }>()
const emit = defineEmits<{ change: [from: string, to: string] }>()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const today = new Date()
const presets = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '12M', days: 365 },
]
const active = computed(() => presets.find((p) => props.to === iso(today) && props.from === iso(new Date(Date.now() - (p.days - 1) * 864e5)))?.label)
function pick(days: number) {
  emit('change', iso(new Date(Date.now() - (days - 1) * 864e5)), iso(today))
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex rounded-full border border-ink-200 bg-white p-0.5">
      <button v-for="p in presets" :key="p.label" type="button" :class="cn('rounded-full px-3 py-1.5 text-xs font-medium', active === p.label ? 'bg-brand-600 text-white' : 'text-ink-600 hover:text-ink-900')" @click="pick(p.days)">{{ p.label }}</button>
    </div>
    <div class="flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1">
      <Calendar class="h-4 w-4 text-ink-400" />
      <input type="date" :value="from" :max="to" class="border-0 bg-transparent p-0 text-xs focus:ring-0" aria-label="From date" @change="emit('change', ($event.target as HTMLInputElement).value, to)" />
      <span class="text-ink-400">–</span>
      <input type="date" :value="to" :min="from" :max="iso(today)" class="border-0 bg-transparent p-0 text-xs focus:ring-0" aria-label="To date" @change="emit('change', from, ($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>
