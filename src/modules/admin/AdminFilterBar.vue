<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search, X } from 'lucide-vue-next'

/** Search + filter row for admin tables. Search is debounced; filters go in the default slot. */
const props = withDefaults(defineProps<{ search?: string; placeholder?: string; activeCount?: number }>(), { search: '', placeholder: 'Search…', activeCount: 0 })
const emit = defineEmits<{ 'update:search': [v: string]; reset: [] }>()
const local = ref(props.search)
watch(() => props.search, (v) => (local.value = v))
const push = useDebounceFn((v: string) => emit('update:search', v), 300)
watch(local, (v) => push(v))
</script>

<template>
  <div class="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-3 lg:flex-row lg:items-center">
    <label class="relative w-full lg:max-w-xs">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input v-model="local" type="search" :placeholder="placeholder" class="field h-10 py-0 pl-9 text-sm" aria-label="Search" />
    </label>
    <div class="flex flex-1 flex-wrap items-center gap-2"><slot /></div>
    <button v-if="activeCount > 0 || local" type="button" class="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900" @click="local = ''; emit('reset')"><X class="h-4 w-4" />Clear filters</button>
    <slot name="actions" />
  </div>
</template>
