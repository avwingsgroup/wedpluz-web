<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Clock, MapPin, Search, TrendingUp, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { eventsApi } from '@/services/api/events.api'
import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'
import { cn } from '@/utils/cn'
import type { SearchSuggestion } from '@/types'

const props = withDefaults(defineProps<{ query?: string; location?: string; placeholder?: string; locationPlaceholder?: string; mode?: 'events' | 'vendors'; compact?: boolean }>(), { query: '', location: '', placeholder: 'Search Events to attend', locationPlaceholder: 'Search Location', mode: 'events', compact: false })
const emit = defineEmits<{ search: [query: string, location: string]; 'update:query': [v: string]; 'update:location': [v: string] }>()

const q = ref(props.query)
const loc = ref(props.location)
const focus = ref<'query' | 'location' | null>(null)
const suggestions = ref<SearchSuggestion[]>([])
const locations = ref<Array<{ label: string; value: string }>>([])
const root = ref<HTMLElement | null>(null)
let controller: AbortController | null = null

watch(() => props.query, (v) => (q.value = v))
watch(() => props.location, (v) => (loc.value = v))

const fetchSuggestions = useDebounceFn(async () => {
  controller?.abort()
  controller = new AbortController()
  try {
    suggestions.value = await eventsApi.suggestions(q.value, loc.value, controller.signal)
    if (!q.value) {
      const recent = safeStorage.getJSON<string[]>(STORAGE_KEYS.recentSearches, [])
      suggestions.value = [...recent.map((r) => ({ type: 'recent' as const, label: r, value: r })), ...suggestions.value.filter((s) => s.type !== 'recent')]
    }
  } catch {
    /* ignore */
  }
}, 200)
const fetchLocations = useDebounceFn(async () => {
  try {
    locations.value = await eventsApi.locationSuggest(loc.value)
  } catch {
    /* ignore */
  }
}, 200)

watch(q, () => {
  emit('update:query', q.value)
  if (focus.value === 'query') void fetchSuggestions()
})
watch(loc, () => {
  emit('update:location', loc.value)
  if (focus.value === 'location') void fetchLocations()
})

function remember(term: string) {
  if (!term.trim()) return
  const recent = safeStorage.getJSON<string[]>(STORAGE_KEYS.recentSearches, []).filter((r) => r !== term)
  safeStorage.setJSON(STORAGE_KEYS.recentSearches, [term, ...recent].slice(0, 5))
}
function submit() {
  remember(q.value)
  focus.value = null
  emit('search', q.value.trim(), loc.value.trim())
}
function pickSuggestion(s: SearchSuggestion) {
  if (s.type === 'location') {
    loc.value = s.value
  } else if (s.type === 'event' || s.type === 'vendor') {
    q.value = s.label
  } else {
    q.value = s.value
  }
  submit()
}
function onDoc(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) focus.value = null
}
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div ref="root" class="relative w-full">
    <form
      :class="cn('flex w-full items-stretch rounded-full border border-ink-200 bg-white shadow-card transition-shadow focus-within:shadow-float', compact ? 'h-12' : 'h-14 md:h-16')"
      role="search"
      @submit.prevent="submit"
    >
      <label class="flex min-w-0 flex-1 cursor-text items-center gap-3 pl-5 pr-2">
        <Search class="h-5 w-5 shrink-0 text-ink-700" />
        <span class="min-w-0 flex-1">
          <span v-if="!compact" class="block text-xs font-semibold text-ink-900">{{ mode === 'vendors' ? 'Hire a vendor' : 'Events' }}</span>
          <input v-model="q" type="search" :placeholder="placeholder" class="block w-full border-0 bg-transparent p-0 text-sm text-ink-900 placeholder:text-ink-400 focus:ring-0" autocomplete="off" @focus="focus = 'query'; fetchSuggestions()" />
        </span>
        <button v-if="q" type="button" class="text-ink-400 hover:text-ink-700" aria-label="Clear search" @click="q = ''"><X class="h-4 w-4" /></button>
      </label>
      <span class="my-3 w-px bg-ink-200" />
      <label class="flex min-w-0 flex-1 cursor-text items-center gap-3 px-4">
        <MapPin class="h-5 w-5 shrink-0 text-ink-700" />
        <span class="min-w-0 flex-1">
          <span v-if="!compact" class="block text-xs font-semibold text-ink-900">Where</span>
          <input v-model="loc" type="text" :placeholder="locationPlaceholder" class="block w-full border-0 bg-transparent p-0 text-sm text-ink-900 placeholder:text-ink-400 focus:ring-0" autocomplete="off" @focus="focus = 'location'; fetchLocations()" />
        </span>
      </label>
      <button type="submit" :class="cn('m-1.5 flex shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700', compact ? 'w-9' : 'w-11 md:w-12')" aria-label="Search">
        <Search class="h-5 w-5" />
      </button>
    </form>

    <!-- suggestions -->
    <Transition enter-active-class="transition duration-100" enter-from-class="opacity-0 -translate-y-1">
      <div v-if="focus === 'query' && suggestions.length" class="absolute left-0 top-full z-40 mt-2 w-full max-w-md rounded-2xl border border-ink-100 bg-white p-2 shadow-float">
        <p v-if="!q" class="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{{ suggestions.some((s) => s.type === 'recent') ? 'Recent searches' : 'Trending' }}</p>
        <button v-for="(s, i) in suggestions" :key="i" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="pickSuggestion(s)">
          <Clock v-if="s.type === 'recent'" class="h-4 w-4 text-ink-400" />
          <TrendingUp v-else-if="s.type === 'trending'" class="h-4 w-4 text-ink-400" />
          <MapPin v-else-if="s.type === 'location'" class="h-4 w-4 text-ink-400" />
          <Search v-else class="h-4 w-4 text-ink-400" />
          <span class="min-w-0 flex-1 truncate text-ink-900">{{ s.label }}</span>
          <span v-if="s.meta" class="text-xs text-ink-400">{{ s.meta }}</span>
          <span v-else-if="s.type === 'category' || s.type === 'vendor'" class="text-xs capitalize text-ink-400">{{ s.type }}</span>
        </button>
      </div>
      <div v-else-if="focus === 'location' && locations.length" class="absolute right-0 top-full z-40 mt-2 w-full max-w-xs rounded-2xl border border-ink-100 bg-white p-2 shadow-float">
        <button v-for="l in locations" :key="l.value" type="button" class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="loc = l.value; submit()">
          <MapPin class="h-4 w-4 text-ink-400" /><span>{{ l.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
