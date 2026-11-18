<script setup lang="ts" generic="T extends Record<string, any>">
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import UiSkeleton from './UiSkeleton.vue'
import UiEmptyState from './UiEmptyState.vue'

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
  hideBelow?: 'sm' | 'md' | 'lg'
  class?: string
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: T[]
    rowKey?: keyof T & string
    loading?: boolean
    error?: string | null
    sort?: string | null
    order?: 'asc' | 'desc'
    emptyTitle?: string
    emptyDescription?: string
    clickable?: boolean
    selectable?: boolean
    selected?: string[]
    dense?: boolean
    skeletonRows?: number
  }>(),
  { rowKey: 'id' as never, loading: false, error: null, sort: null, order: 'desc', emptyTitle: 'Nothing here yet', clickable: false, selectable: false, selected: () => [], dense: false, skeletonRows: 6 },
)
const emit = defineEmits<{ 'update:sort': [sort: string, order: 'asc' | 'desc']; 'row-click': [row: T]; 'update:selected': [ids: string[]]; retry: [] }>()

function toggleSort(col: TableColumn) {
  if (!col.sortable) return
  const nextOrder = props.sort === col.key && props.order === 'desc' ? 'asc' : 'desc'
  emit('update:sort', col.key, nextOrder)
}
function idOf(row: T): string {
  return String((row as Record<string, unknown>)[props.rowKey ?? 'id'])
}
function toggleRow(row: T) {
  const id = idOf(row)
  const next = props.selected.includes(id) ? props.selected.filter((x) => x !== id) : [...props.selected, id]
  emit('update:selected', next)
}
function toggleAll() {
  const all = props.rows.map(idOf)
  const allSelected = all.every((id) => props.selected.includes(id))
  emit('update:selected', allSelected ? props.selected.filter((id) => !all.includes(id)) : [...new Set([...props.selected, ...all])])
}
const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }
</script>

<template>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th v-if="selectable" class="w-10 px-4 py-3">
              <input type="checkbox" class="h-4 w-4 rounded border-ink-300 accent-brand-600" :checked="rows.length > 0 && rows.every((r) => selected.includes(idOf(r)))" aria-label="Select all" @change="toggleAll" />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :style="col.width ? { width: col.width } : undefined"
              :class="cn('px-4 py-3 font-semibold', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.hideBelow && hide[col.hideBelow], col.sortable && 'cursor-pointer select-none hover:text-ink-900')"
              @click="toggleSort(col)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <template v-if="col.sortable">
                  <ArrowUp v-if="sort === col.key && order === 'asc'" class="h-3 w-3" />
                  <ArrowDown v-else-if="sort === col.key" class="h-3 w-3" />
                  <ArrowUpDown v-else class="h-3 w-3 opacity-40" />
                </template>
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ink-100">
          <template v-if="loading">
            <tr v-for="i in skeletonRows" :key="`sk-${i}`">
              <td v-if="selectable" class="px-4 py-3"><UiSkeleton class="h-4 w-4" /></td>
              <td v-for="col in columns" :key="col.key" :class="cn('px-4 py-3', col.hideBelow && hide[col.hideBelow])"><UiSkeleton class="h-4" :class="col.align === 'right' ? 'ml-auto w-16' : 'w-3/4'" /></td>
            </tr>
          </template>
          <tr v-else-if="error">
            <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-4 py-10 text-center">
              <p class="text-sm text-danger-500">{{ error }}</p>
              <button type="button" class="mt-3 text-sm font-medium text-brand-600 hover:underline" @click="emit('retry')">Try again</button>
            </td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td :colspan="columns.length + (selectable ? 1 : 0)">
              <UiEmptyState :title="emptyTitle" :description="emptyDescription" compact illustration="search"><slot name="empty-action" /></UiEmptyState>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            v-else
            :key="idOf(row)"
            :class="cn('transition-colors', clickable && 'cursor-pointer hover:bg-brand-50/40', selected.includes(idOf(row)) && 'bg-brand-50/60')"
            @click="clickable && emit('row-click', row)"
          >
            <td v-if="selectable" class="px-4 py-3" @click.stop>
              <input type="checkbox" class="h-4 w-4 rounded border-ink-300 accent-brand-600" :checked="selected.includes(idOf(row))" :aria-label="`Select ${idOf(row)}`" @change="toggleRow(row)" />
            </td>
            <td v-for="col in columns" :key="col.key" :class="cn(dense ? 'px-4 py-2' : 'px-4 py-3.5', 'align-middle text-ink-700', col.align === 'right' && 'text-right', col.align === 'center' && 'text-center', col.hideBelow && hide[col.hideBelow], col.class)">
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">{{ row[col.key] ?? '—' }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="$slots.footer" class="border-t border-ink-100 px-4 py-3"><slot name="footer" /></div>
  </div>
</template>
