<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Search, X } from 'lucide-vue-next'

withDefaults(defineProps<{ placeholder?: string; label?: string; controls?: string; expanded?: boolean }>(), { placeholder: 'Search for answers', label: 'Search help articles', controls: undefined, expanded: undefined })
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ submit: []; keydown: [e: KeyboardEvent] }>()
const input = ref<HTMLInputElement | null>(null)

// "/" focuses the search from anywhere on the page (unless the user is already typing somewhere).
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
  e.preventDefault()
  input.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function clear() {
  model.value = ''
  input.value?.focus()
}
defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <form role="search" class="relative mx-auto mt-8 w-full max-w-2xl" @submit.prevent="emit('submit')">
    <label for="help-search" class="sr-only">{{ label }}</label>
    <Search class="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden="true" />
    <input
      id="help-search"
      ref="input"
      v-model="model"
      type="search"
      autocomplete="off"
      enterkeyhint="search"
      :placeholder="placeholder"
      :aria-controls="controls"
      :aria-expanded="expanded"
      :role="controls ? 'combobox' : undefined"
      :aria-autocomplete="controls ? 'list' : undefined"
      class="h-14 w-full rounded-full border border-ink-200 bg-white pl-13 pr-24 text-base text-ink-900 shadow-[0_10px_40px_rgb(51_55_64/0.08)] transition placeholder:text-ink-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-100 focus-visible:ring-offset-0 md:h-16 [&::-webkit-search-cancel-button]:hidden"
      @keydown="emit('keydown', $event)"
    />
    <button v-if="model" type="button" class="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-800" aria-label="Clear search" @click="clear"><X class="h-4 w-4" /></button>
    <kbd v-else class="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-md border border-ink-200 bg-ink-50 px-2 py-0.5 font-sans text-xs text-ink-500 sm:block" aria-hidden="true">/</kbd>
  </form>
</template>
