<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { LoaderCircle, MapPin, Navigation, Search, Store, Tag, Ticket, Trash2, TrendingUp, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { eventsApi } from '@/services/api/events.api'
import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'
import { formatCoords, isCoords } from '@/utils/geo'
import { cn } from '@/utils/cn'
import type { SearchSuggestion } from '@/types'

/**
 * Two-field search ("Events" / "Where") with suggestion panels from the design handoff:
 * recent + trending searches, "Use current location" + recent locations, live suggestions with
 * highlighted matches. Implements the WAI-ARIA combobox pattern (arrow keys, Enter, Escape,
 * Delete removes a recent item) and stacks vertically on phones.
 */
const props = withDefaults(
  defineProps<{ query?: string; location?: string; placeholder?: string; locationPlaceholder?: string; mode?: 'events' | 'vendors'; compact?: boolean }>(),
  { query: '', location: '', placeholder: 'Search Events to attend', locationPlaceholder: 'Search Location', mode: 'events', compact: false },
)
const emit = defineEmits<{ search: [query: string, location: string]; 'update:query': [v: string]; 'update:location': [v: string] }>()

type Field = 'query' | 'location'
type OptionKind = 'search' | 'recent' | 'trending' | 'event' | 'vendor' | 'category' | 'location' | 'recentLocation' | 'currentLocation'
interface Option {
  kind: OptionKind
  label: string
  value: string
  meta?: string
}

const CURRENT_LOCATION = 'Current location'
const MAX_RECENT = 5
const router = useRouter()
const uid = useId()
const listboxId = `${uid}-listbox`
const optionId = (i: number) => `${uid}-option-${i}`

const root = ref<HTMLElement | null>(null)
const queryInput = ref<HTMLInputElement | null>(null)
const locationInput = ref<HTMLInputElement | null>(null)

const q = ref(props.query)
const coords = ref<string | null>(isCoords(props.location) ? props.location : null)
const loc = ref(coords.value ? CURRENT_LOCATION : props.location)
const focus = ref<Field | null>(null)
const dismissed = ref(false)
const activeIndex = ref(-1)

const suggestions = ref<SearchSuggestion[]>([])
const places = ref<Array<{ label: string; value: string }>>([])
const loadingQuery = ref(false)
const loadingPlaces = ref(false)
const geo = ref<{ state: 'idle' | 'locating' | 'error'; message: string }>({ state: 'idle', message: '' })
const geoSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

const recents = ref<string[]>(safeStorage.getJSON<string[]>(STORAGE_KEYS.recentSearches, []))
const recentPlaces = ref<string[]>(safeStorage.getJSON<string[]>(STORAGE_KEYS.recentLocations, []))

const term = computed(() => q.value.trim())
const placeTerm = computed(() => (coords.value ? '' : loc.value.trim()))
const locationValue = computed(() => coords.value ?? loc.value.trim())
const isVendors = computed(() => props.mode === 'vendors')

watch(() => props.query, (v) => (q.value = v))
watch(() => props.location, (v) => {
  if (isCoords(v)) {
    coords.value = v
    loc.value = CURRENT_LOCATION
  } else if (v !== locationValue.value) {
    coords.value = null
    loc.value = v
  }
})

/* ---------- data ---------- */
let controller: AbortController | null = null
const fetchSuggestions = useDebounceFn(async () => {
  controller?.abort()
  controller = new AbortController()
  loadingQuery.value = true
  try {
    suggestions.value = await eventsApi.suggestions(term.value, locationValue.value || undefined, controller.signal)
  } catch {
    /* aborted or offline: keep what we have */
  } finally {
    loadingQuery.value = false
  }
}, 150)

const fetchPlaces = useDebounceFn(async () => {
  if (!placeTerm.value) {
    places.value = []
    return
  }
  loadingPlaces.value = true
  try {
    places.value = await eventsApi.locationSuggest(placeTerm.value)
  } catch {
    /* ignore */
  } finally {
    loadingPlaces.value = false
  }
}, 150)

watch(q, () => {
  emit('update:query', q.value)
  dismissed.value = false
  activeIndex.value = -1
  if (focus.value === 'query') void fetchSuggestions()
})
watch(loc, (v) => {
  if (coords.value && v !== CURRENT_LOCATION) coords.value = null
  emit('update:location', locationValue.value)
  dismissed.value = false
  activeIndex.value = -1
  if (focus.value === 'location') void fetchPlaces()
})

/* ---------- options ---------- */
const recentOptions = computed<Option[]>(() => recents.value.map((r) => ({ kind: 'recent', label: r, value: r })))
const trendingOptions = computed<Option[]>(() => {
  const seen = new Set(recents.value.map((r) => r.toLowerCase()))
  return suggestions.value
    .filter((s) => s.type === 'trending' && !seen.has(s.label.toLowerCase()))
    .slice(0, MAX_RECENT)
    .map((s) => ({ kind: 'trending', label: s.label, value: s.value }))
})
const matchOptions = computed<Option[]>(() => {
  const allowed: SearchSuggestion['type'][] = isVendors.value ? ['vendor'] : ['event', 'vendor', 'category', 'location']
  return suggestions.value
    .filter((s) => allowed.includes(s.type))
    .slice(0, 7)
    .map((s) => ({
      kind: s.type as OptionKind,
      label: s.label,
      value: s.value,
      meta: s.meta || (s.type === 'category' ? 'Category' : s.type === 'vendor' ? 'Vendor' : s.type === 'location' ? 'Location' : undefined),
    }))
})
const queryOptions = computed<Option[]>(() =>
  term.value ? [{ kind: 'search', label: term.value, value: term.value }, ...matchOptions.value] : [...recentOptions.value, ...trendingOptions.value],
)
const placeOptions = computed<Option[]>(() => [
  ...(geoSupported ? [{ kind: 'currentLocation' as const, label: 'Use current location', value: '' }] : []),
  ...(placeTerm.value
    ? places.value.map((p) => ({ kind: 'location' as const, label: p.label, value: p.value }))
    : recentPlaces.value.map((p) => ({ kind: 'recentLocation' as const, label: p, value: p }))),
])
const options = computed<Option[]>(() => (focus.value === 'query' ? queryOptions.value : focus.value === 'location' ? placeOptions.value : []))
const indexOf = (o: Option) => options.value.indexOf(o)
const panelOpen = computed(() => focus.value !== null && !dismissed.value && (options.value.length > 0 || (focus.value === 'query' && loadingQuery.value)))
const activeDescendant = computed(() => (panelOpen.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined))
const status = computed(() => {
  if (!panelOpen.value) return ''
  const n = options.value.filter((o) => o.kind !== 'currentLocation' && o.kind !== 'search').length
  return n ? `${n} suggestion${n === 1 ? '' : 's'} available. Use the up and down arrows to choose.` : ''
})

/** Splits a label into matched / unmatched runs for highlighting (case-insensitive). */
function highlight(label: string, needle: string): Array<{ text: string; match: boolean }> {
  const n = needle.trim()
  if (!n) return [{ text: label, match: false }]
  const at = label.toLowerCase().indexOf(n.toLowerCase())
  if (at < 0) return [{ text: label, match: false }]
  return [
    { text: label.slice(0, at), match: false },
    { text: label.slice(at, at + n.length), match: true },
    { text: label.slice(at + n.length), match: false },
  ].filter((p) => p.text)
}

/* ---------- recents ---------- */
function persist() {
  safeStorage.setJSON(STORAGE_KEYS.recentSearches, recents.value)
  safeStorage.setJSON(STORAGE_KEYS.recentLocations, recentPlaces.value)
}
function rememberQuery(value: string) {
  const v = value.trim()
  if (!v) return
  recents.value = [v, ...recents.value.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT)
  persist()
}
function rememberPlace(value: string) {
  const v = value.trim()
  if (!v || isCoords(v) || v === CURRENT_LOCATION) return
  recentPlaces.value = [v, ...recentPlaces.value.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT)
  persist()
}
function removeRecent(o: Option) {
  if (o.kind === 'recent') recents.value = recents.value.filter((r) => r !== o.value)
  if (o.kind === 'recentLocation') recentPlaces.value = recentPlaces.value.filter((r) => r !== o.value)
  persist()
  activeIndex.value = Math.min(activeIndex.value, options.value.length - 1)
}
function clearRecents(field: Field) {
  if (field === 'query') recents.value = []
  else recentPlaces.value = []
  persist()
  activeIndex.value = -1
}

/* ---------- actions ---------- */
function close() {
  focus.value = null
  activeIndex.value = -1
}
function submit() {
  rememberQuery(q.value)
  rememberPlace(loc.value)
  close()
  ;(document.activeElement as HTMLElement | null)?.blur()
  emit('search', term.value, locationValue.value)
}
function go(to: Parameters<typeof router.push>[0], remember?: string) {
  if (remember) rememberQuery(remember)
  close()
  ;(document.activeElement as HTMLElement | null)?.blur()
  void router.push(to)
}
function useCurrentLocation() {
  if (!geoSupported || geo.value.state === 'locating') return
  geo.value = { state: 'locating', message: '' }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      loc.value = CURRENT_LOCATION
      coords.value = formatCoords(pos.coords.latitude, pos.coords.longitude)
      geo.value = { state: 'idle', message: '' }
      submit()
    },
    (err) => {
      geo.value = {
        state: 'error',
        message: err.code === err.PERMISSION_DENIED ? 'Location access is blocked. Allow it in your browser, or type a city.' : 'We couldn’t find your location. Type a city instead.',
      }
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  )
}
function choose(o: Option) {
  switch (o.kind) {
    case 'search':
      return submit()
    case 'recent':
    case 'trending':
      q.value = o.value
      return submit()
    case 'event':
      return go({ name: 'event', params: { slug: o.value } }, o.label)
    case 'vendor':
      return go({ name: 'vendor', params: { slug: o.value } }, o.label)
    case 'category':
      return go({ name: 'events', query: { categorySlug: o.value, ...(locationValue.value ? { location: locationValue.value } : {}) } })
    case 'location':
    case 'recentLocation':
      coords.value = null
      loc.value = o.value
      if (focus.value === 'query') q.value = ''
      return submit()
    case 'currentLocation':
      return useCurrentLocation()
  }
}

/* ---------- focus & keyboard ---------- */
function onFocus(field: Field) {
  focus.value = field
  dismissed.value = false
  activeIndex.value = -1
  if (field === 'query') void fetchSuggestions()
  else void fetchPlaces()
}
function onFocusOut(e: FocusEvent) {
  if (!root.value?.contains(e.relatedTarget as Node | null)) close()
}
function onKeydown(e: KeyboardEvent) {
  const count = options.value.length
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      dismissed.value = false
      if (count) activeIndex.value = (activeIndex.value + 1) % count
      break
    case 'ArrowUp':
      e.preventDefault()
      dismissed.value = false
      if (count) activeIndex.value = activeIndex.value <= 0 ? count - 1 : activeIndex.value - 1
      break
    case 'Enter': {
      const o = panelOpen.value && activeIndex.value >= 0 ? options.value[activeIndex.value] : undefined
      if (o) {
        e.preventDefault()
        choose(o)
      }
      break
    }
    case 'Escape':
      if (panelOpen.value) {
        e.preventDefault()
        dismissed.value = true
        activeIndex.value = -1
      }
      break
    case 'Delete': {
      const o = activeIndex.value >= 0 ? options.value[activeIndex.value] : undefined
      if (o && (o.kind === 'recent' || o.kind === 'recentLocation')) {
        e.preventDefault()
        removeRecent(o)
      }
      break
    }
  }
}
async function clearField(field: Field) {
  if (field === 'query') q.value = ''
  else {
    coords.value = null
    loc.value = ''
    geo.value = { state: 'idle', message: '' }
  }
  await nextTick()
  ;(field === 'query' ? queryInput : locationInput).value?.focus()
}

watch(activeIndex, async (i) => {
  if (i < 0) return
  await nextTick()
  document.getElementById(optionId(i))?.scrollIntoView?.({ block: 'nearest' })
})

function onDocClick(e: MouseEvent) {
  if (!root.value?.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  controller?.abort()
})

const optionIcon = (kind: OptionKind) => ({ event: Ticket, vendor: Store, category: Tag, location: MapPin, recentLocation: MapPin, trending: Search, recent: Search, search: Search, currentLocation: Navigation })[kind]
</script>

<template>
  <div ref="root" class="relative w-full text-left" @focusout="onFocusOut">
    <form
      role="search"
      :aria-label="isVendors ? 'Search vendors' : 'Search events'"
      :class="cn(
        'relative flex w-full border transition-[background-color,box-shadow,border-color] duration-200',
        compact ? 'h-12 flex-row items-stretch rounded-full' : 'flex-col rounded-3xl sm:h-16 sm:flex-row sm:items-stretch sm:rounded-full',
        focus ? 'border-ink-100 bg-ink-50 shadow-float' : 'border-ink-200 bg-white shadow-card hover:shadow-float',
      )"
      @submit.prevent="submit"
    >
      <!-- Events / vendor query -->
      <label
        :class="cn(
          'relative flex min-w-0 flex-1 cursor-text items-center gap-3 transition-[background-color,box-shadow] duration-200',
          compact ? 'rounded-full pl-4 pr-2' : 'm-1 rounded-3xl px-6 py-3.5 sm:rounded-full sm:py-0 sm:pl-6 sm:pr-4',
          focus === 'query' ? 'bg-white shadow-[0_8px_24px_-10px_rgba(39,4,39,0.28)] ring-1 ring-ink-100 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-600/25' : focus ? 'hover:bg-ink-100/70' : 'hover:bg-ink-50/80',
        )"
      >
        <Search :class="cn('h-5 w-5 shrink-0 transition-colors', focus === 'query' ? 'text-brand-600' : 'text-ink-700')" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span v-if="!compact" :class="cn('block text-[13px] font-medium leading-5 transition-colors', focus === 'query' ? 'text-brand-700' : 'text-ink-900')">{{ isVendors ? 'Hire a vendor' : 'Events' }}</span>
          <input
            ref="queryInput"
            v-model="q"
            type="search"
            enterkeyhint="search"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="panelOpen && focus === 'query'"
            :aria-controls="listboxId"
            :aria-activedescendant="focus === 'query' ? activeDescendant : undefined"
            :aria-label="compact ? (isVendors ? 'Search vendors' : 'Search events') : undefined"
            :placeholder="placeholder"
            autocomplete="off"
            spellcheck="false"
            class="mt-0.5 block w-full truncate rounded-xl border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-ink-900 caret-brand-600 outline-none placeholder:text-ink-400 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
            @focus="onFocus('query')"
            @keydown="onKeydown"
          />
        </span>
        <button v-if="q" type="button" class="-mr-1 shrink-0 rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Clear search" @mousedown.prevent @click="clearField('query')"><X class="h-4 w-4" /></button>
      </label>

      <span aria-hidden="true" :class="cn('shrink-0 bg-ink-200 transition-opacity', compact ? 'my-3 w-px' : 'mx-5 h-px sm:mx-0 sm:my-3 sm:h-auto sm:w-px', focus ? 'opacity-0' : 'opacity-100')" />

      <!-- Where -->
      <label
        :class="cn(
          'relative flex min-w-0 flex-1 cursor-text items-center gap-3 transition-[background-color,box-shadow] duration-200',
          compact ? 'rounded-full px-3' : 'm-1 rounded-3xl px-6 py-3.5 sm:rounded-full sm:py-0 sm:pl-6 sm:pr-4',
          focus === 'location' ? 'bg-white shadow-[0_8px_24px_-10px_rgba(39,4,39,0.28)] ring-1 ring-ink-100 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-600/25' : focus ? 'hover:bg-ink-100/70' : 'hover:bg-ink-50/80',
        )"
      >
        <component :is="coords ? Navigation : MapPin" :class="cn('h-5 w-5 shrink-0 transition-colors', focus === 'location' || coords ? 'text-brand-600' : 'text-ink-700')" aria-hidden="true" />
        <span class="min-w-0 flex-1">
          <span v-if="!compact" :class="cn('block text-[13px] font-medium leading-5 transition-colors', focus === 'location' ? 'text-brand-700' : 'text-ink-900')">Where</span>
          <input
            ref="locationInput"
            v-model="loc"
            type="text"
            enterkeyhint="search"
            role="combobox"
            aria-autocomplete="list"
            :aria-expanded="panelOpen && focus === 'location'"
            :aria-controls="listboxId"
            :aria-activedescendant="focus === 'location' ? activeDescendant : undefined"
            :aria-label="compact ? 'Location' : undefined"
            :placeholder="locationPlaceholder"
            autocomplete="off"
            spellcheck="false"
            :class="cn('mt-0.5 block w-full truncate rounded-xl border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm caret-brand-600 outline-none placeholder:text-ink-400 focus:ring-0', coords ? 'font-medium text-brand-700' : 'text-ink-900')"
            @focus="onFocus('location')"
            @keydown="onKeydown"
          />
        </span>
        <button v-if="loc" type="button" class="-mr-1 shrink-0 rounded-full p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700" aria-label="Clear location" @mousedown.prevent @click="clearField('location')"><X class="h-4 w-4" /></button>
      </label>

      <button
        type="submit"
        :class="cn(
          'flex shrink-0 items-center justify-center gap-2 bg-brand-600 font-semibold text-white transition hover:bg-brand-700 focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
          compact ? 'm-1.5 w-9 rounded-full' : 'm-2 mt-1 h-12 rounded-2xl sm:m-1.5 sm:h-auto sm:w-12 sm:rounded-full md:w-[52px]',
        )"
        aria-label="Search"
      >
        <Search class="h-5 w-5" aria-hidden="true" />
        <span v-if="!compact" class="sm:sr-only">Search</span>
      </button>
    </form>

    <p class="sr-only" aria-live="polite">{{ status }}</p>

    <!-- Suggestion panel (one listbox; its content follows the focused field) -->
    <Transition enter-active-class="transition duration-150 ease-out" enter-from-class="-translate-y-1 opacity-0" leave-active-class="transition duration-100 ease-in" leave-to-class="opacity-0">
      <div
        v-if="panelOpen"
        :id="listboxId"
        role="listbox"
        :aria-label="focus === 'location' ? 'Location suggestions' : 'Search suggestions'"
        :class="cn(
          'absolute top-full z-40 mt-3 max-h-[min(28rem,70vh)] w-full overflow-y-auto overscroll-contain rounded-3xl border border-ink-100 bg-white py-2 shadow-float sm:w-[min(26rem,100%)]',
          focus === 'location' ? 'right-0' : 'left-0',
        )"
        @mousedown.prevent
      >
        <!-- ===== Events field ===== -->
        <template v-if="focus === 'query'">
          <template v-if="!term">
            <template v-if="recentOptions.length">
              <p class="px-5 pb-1 pt-3 text-[13px] font-semibold text-ink-700">Recent searches</p>
              <div v-for="o in recentOptions" :key="`r-${o.value}`" :class="cn('group/row flex items-center transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')">
                <div :id="optionId(indexOf(o))" role="option" :aria-selected="indexOf(o) === activeIndex" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-5 text-[15px] text-ink-900" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
                  <Search class="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" /><span class="truncate">{{ o.label }}</span>
                </div>
                <button type="button" tabindex="-1" class="mr-3 rounded-full p-2 text-ink-400 transition hover:bg-white hover:text-danger-500" :aria-label="`Remove ${o.label} from recent searches`" @click="removeRecent(o)"><Trash2 class="h-4 w-4" /></button>
              </div>
              <button type="button" tabindex="-1" class="mx-auto block px-4 py-2 text-sm font-medium text-brand-600 hover:underline" @click="clearRecents('query')">Clear all</button>
            </template>
            <template v-if="trendingOptions.length">
              <div :class="cn('flex items-center justify-between px-5 pb-1 pt-3', recentOptions.length && 'mt-1 border-t border-ink-100')">
                <p class="text-[13px] font-semibold text-ink-700">Trending searches</p>
                <TrendingUp class="h-4 w-4 text-ink-500" aria-hidden="true" />
              </div>
              <div v-for="o in trendingOptions" :id="optionId(indexOf(o))" :key="`t-${o.value}`" role="option" :aria-selected="indexOf(o) === activeIndex" :class="cn('flex cursor-pointer items-center gap-3 px-5 py-2.5 text-[15px] text-ink-900 transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
                <Search class="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" /><span class="truncate">{{ o.label }}</span>
              </div>
            </template>
            <p v-if="!recentOptions.length && !trendingOptions.length && loadingQuery" class="flex items-center gap-2 px-5 py-3 text-sm text-ink-500"><LoaderCircle class="h-4 w-4 animate-spin" />Loading suggestions…</p>
          </template>

          <template v-else>
            <div v-for="o in queryOptions" :id="optionId(indexOf(o))" :key="`${o.kind}-${o.value}`" role="option" :aria-selected="indexOf(o) === activeIndex" :class="cn('flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
              <span :class="cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', o.kind === 'search' ? 'bg-brand-50 text-brand-600' : 'bg-ink-50 text-ink-500')">
                <component :is="optionIcon(o.kind)" class="h-4 w-4" aria-hidden="true" />
              </span>
              <span v-if="o.kind === 'search'" class="min-w-0 flex-1 truncate text-[15px] text-ink-700">Search for <strong class="font-semibold text-ink-900">“{{ o.label }}”</strong></span>
              <span v-else class="min-w-0 flex-1 truncate text-[15px] text-ink-700">
                <template v-for="(part, i) in highlight(o.label, term)" :key="i"><mark v-if="part.match" class="bg-transparent font-semibold text-ink-900">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
              </span>
              <span v-if="o.meta" class="shrink-0 text-xs text-ink-400">{{ o.meta }}</span>
            </div>
            <p v-if="loadingQuery && matchOptions.length === 0" class="flex items-center gap-2 px-5 py-2.5 text-sm text-ink-500"><LoaderCircle class="h-4 w-4 animate-spin" />Finding matches…</p>
          </template>
        </template>

        <!-- ===== Where field ===== -->
        <template v-else-if="focus === 'location'">
          <template v-for="o in placeOptions" :key="`${o.kind}-${o.value}`">
            <div v-if="o.kind === 'currentLocation'" :id="optionId(indexOf(o))" role="option" :aria-selected="indexOf(o) === activeIndex" :aria-busy="geo.state === 'locating'" :class="cn('mx-2 flex cursor-pointer items-center gap-4 rounded-2xl px-3 py-3 transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-500">
                <LoaderCircle v-if="geo.state === 'locating'" class="h-5 w-5 animate-spin" aria-hidden="true" />
                <Navigation v-else class="h-5 w-5" aria-hidden="true" />
              </span>
              <span class="min-w-0">
                <span class="block text-[15px] font-semibold text-ink-900">{{ geo.state === 'locating' ? 'Finding your location…' : 'Use current location' }}</span>
                <span :class="cn('block text-[13px]', geo.state === 'error' ? 'text-danger-500' : 'text-ink-500')">{{ geo.state === 'error' ? geo.message : isVendors ? 'Find vendors around you' : 'Find events around you' }}</span>
              </span>
            </div>
            <div v-else-if="o.kind === 'recentLocation'" :class="cn('flex items-center transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')">
              <div :id="optionId(indexOf(o))" role="option" :aria-selected="indexOf(o) === activeIndex" class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-5 text-[15px] text-ink-900" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
                <MapPin class="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" /><span class="truncate">{{ o.label }}</span>
              </div>
              <button type="button" tabindex="-1" class="mr-3 rounded-full p-2 text-ink-400 transition hover:bg-white hover:text-danger-500" :aria-label="`Remove ${o.label} from recent locations`" @click="removeRecent(o)"><Trash2 class="h-4 w-4" /></button>
            </div>
            <div v-else :id="optionId(indexOf(o))" role="option" :aria-selected="indexOf(o) === activeIndex" :class="cn('flex cursor-pointer items-center gap-3 px-5 py-2.5 text-[15px] text-ink-700 transition-colors', indexOf(o) === activeIndex ? 'bg-ink-50' : 'hover:bg-ink-50')" @click="choose(o)" @mousemove="activeIndex = indexOf(o)">
              <MapPin class="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
              <span class="truncate"><template v-for="(part, i) in highlight(o.label, placeTerm)" :key="i"><mark v-if="part.match" class="bg-transparent font-semibold text-ink-900">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span>
            </div>
          </template>
          <button v-if="!placeTerm && recentPlaces.length" type="button" tabindex="-1" class="mx-auto block px-4 py-2 text-sm font-medium text-brand-600 hover:underline" @click="clearRecents('location')">Clear all</button>
          <p v-if="placeTerm && loadingPlaces && !places.length" class="flex items-center gap-2 px-5 py-2.5 text-sm text-ink-500"><LoaderCircle class="h-4 w-4 animate-spin" />Finding places…</p>
          <p v-else-if="placeTerm && !loadingPlaces && !places.length" class="px-5 py-2.5 text-sm text-ink-500">No matching places. Press Enter to search “{{ placeTerm }}”.</p>
        </template>
      </div>
    </Transition>
  </div>
</template>
