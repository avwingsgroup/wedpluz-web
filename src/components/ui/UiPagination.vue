<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = defineProps<{ page: number; lastPage: number; total?: number; perPage?: number }>()
const emit = defineEmits<{ 'update:page': [page: number] }>()

const pages = computed<(number | '…')[]>(() => {
  const { page, lastPage } = props
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1)
  const set = new Set([1, lastPage, page - 1, page, page + 1].filter((p) => p >= 1 && p <= lastPage))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!
    const prev = sorted[i - 1]
    if (prev !== undefined && cur - prev > 1) out.push('…')
    out.push(cur)
  }
  return out
})
const rangeLabel = computed(() => {
  if (!props.total || !props.perPage) return ''
  const start = (props.page - 1) * props.perPage + 1
  return `${start}–${Math.min(props.total, props.page * props.perPage)} of ${props.total.toLocaleString()}`
})
</script>

<template>
  <nav v-if="lastPage > 1 || rangeLabel" class="flex flex-col items-center justify-between gap-3 sm:flex-row" aria-label="Pagination">
    <span class="text-sm text-ink-500">{{ rangeLabel }}</span>
    <div v-if="lastPage > 1" class="flex items-center gap-1">
      <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 disabled:opacity-40" :disabled="page <= 1" aria-label="Previous page" @click="emit('update:page', page - 1)"><ChevronLeft class="h-4 w-4" /></button>
      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '…'" class="px-2 text-ink-400">…</span>
        <button v-else type="button" :class="cn('h-9 min-w-9 rounded-full px-3 text-sm font-medium', p === page ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-100')" :aria-current="p === page ? 'page' : undefined" @click="emit('update:page', p)">{{ p }}</button>
      </template>
      <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 disabled:opacity-40" :disabled="page >= lastPage" aria-label="Next page" @click="emit('update:page', page + 1)"><ChevronRight class="h-4 w-4" /></button>
    </div>
  </nav>
</template>
