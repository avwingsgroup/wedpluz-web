<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { Check, ChevronDown, Search } from 'lucide-vue-next'
import { COUNTRIES, countryByIso, type Country } from '@/data/countries'
import { canShowFlagEmoji, detectCountry, flagEmoji, formatNational, normaliseNational, parsePhone, toE164 } from '@/utils/phone'
import { cn } from '@/utils/cn'

/**
 * Phone number with a country selector. v-model is always E.164 ("+2348012345678") or '' when empty; v-model:country
 * is the selected ISO code. The country defaults to the number's own country, else `defaultCountry`, else the
 * visitor's current country (time zone → locale → Nigeria).
 */
const props = withDefaults(
  defineProps<{ modelValue?: string | null; label?: string; error?: string; hint?: string; required?: boolean; disabled?: boolean; defaultCountry?: string | null; placeholder?: string; size?: 'md' | 'lg' }>(),
  { modelValue: '', label: undefined, error: undefined, hint: undefined, required: false, disabled: false, defaultCountry: null, placeholder: undefined, size: 'md' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [FocusEvent] }>()
const country = defineModel<string>('country', { default: '' })

const id = useId()
const listId = `${id}-countries`
const showFlags = canShowFlagEmoji()

// ---- state -----------------------------------------------------------------------------------------------------------
const initial = parsePhone(props.modelValue, props.defaultCountry)
const selected = ref<Country>(initial?.country ?? countryByIso(country.value) ?? countryByIso(detectCountry([props.defaultCountry]))!)
const national = ref(initial ? formatNational(initial.national) : '')
if (country.value !== selected.value.iso2) country.value = selected.value.iso2

// Late-arriving values (profile loaded after mount, a detected country from the API) update the field until the
// person has typed or picked a country themselves.
let touched = false
watch(
  () => props.modelValue,
  (v) => {
    if (v === toE164(selected.value, national.value)) return
    const parsed = parsePhone(v, selected.value.iso2)
    if (parsed) {
      selected.value = parsed.country
      national.value = formatNational(parsed.national)
      country.value = parsed.country.iso2
    } else if (!v) national.value = ''
  },
)
watch(
  () => props.defaultCountry,
  (iso) => {
    const c = countryByIso(iso)
    if (c && !touched && !national.value) {
      selected.value = c
      country.value = c.iso2
    }
  },
)

function emitValue() {
  emit('update:modelValue', toE164(selected.value, national.value))
}
function onInput(e: Event) {
  touched = true
  const raw = (e.target as HTMLInputElement).value
  // A pasted international number ("+44 20 …") switches the country.
  if (raw.trim().startsWith('+') || raw.trim().startsWith('00')) {
    const parsed = parsePhone(raw.trim().replace(/^00/, '+'), selected.value.iso2)
    if (parsed) {
      selected.value = parsed.country
      country.value = parsed.country.iso2
      national.value = formatNational(parsed.national)
      return emitValue()
    }
  }
  national.value = raw.replace(/[^\d\s()-]/g, '')
  emitValue()
}
function onBlur(e: FocusEvent) {
  // Tidy the display ("0801 234 5678" → "801 234 5678") once the person leaves the field.
  if (national.value) national.value = formatNational(normaliseNational(selected.value, national.value))
  emit('blur', e)
}

// ---- country picker ------------------------------------------------------------------------------------------------
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const phoneInput = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

const normalise = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
// Ranked search: ISO code, then names starting with the query, then a later word starting with it, then the calling
// code, then anywhere in the name ("gha" → Ghana before Afghanistan; "234" → Nigeria; "uk" → no false positives).
function score(c: Country, q: string): number {
  const name = normalise(c.name)
  if (c.iso2.toLowerCase() === q) return 0
  if (name.startsWith(q)) return 1
  if (name.split(/[\s()-]+/).some((w) => w.startsWith(q))) return 2
  if (c.dial.startsWith(q.replace(/^\+/, ''))) return /^\+?\d+$/.test(q) ? (c.dial === q.replace(/^\+/, '') ? 0 : 3) : 9
  if (name.includes(q)) return 4
  return 9
}
const filtered = computed(() => {
  const q = normalise(query.value.trim())
  if (!q) return [selected.value, ...COUNTRIES.filter((c) => c.iso2 !== selected.value.iso2)] // current choice first
  return COUNTRIES.map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s < 9)
    .sort((a, b) => a.s - b.s || a.c.name.localeCompare(b.c.name))
    .map((x) => x.c)
})
watch(query, () => (activeIndex.value = 0))

async function openPicker() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  activeIndex.value = 0
  await nextTick()
  searchInput.value?.focus()
}
function closePicker(focusPhone = true) {
  open.value = false
  if (focusPhone) void nextTick(() => phoneInput.value?.focus())
}
function choose(c: Country) {
  touched = true
  // Keep what was typed, re-read for the new country (e.g. a trunk 0 is dropped).
  selected.value = c
  country.value = c.iso2
  if (national.value) national.value = formatNational(normaliseNational(c, national.value))
  emitValue()
  closePicker()
}
function onListKey(e: KeyboardEvent) {
  const n = filtered.value.length
  if (e.key === 'ArrowDown') activeIndex.value = (activeIndex.value + 1) % n
  else if (e.key === 'ArrowUp') activeIndex.value = (activeIndex.value - 1 + n) % n
  else if (e.key === 'Home') activeIndex.value = 0
  else if (e.key === 'End') activeIndex.value = n - 1
  else if (e.key === 'Enter') {
    const c = filtered.value[activeIndex.value]
    if (c) choose(c)
  } else if (e.key === 'Escape') closePicker()
  else if (e.key === 'Tab') return closePicker(false)
  else return
  e.preventDefault()
  void nextTick(() => listEl.value?.querySelector(`[data-index="${activeIndex.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}
function onDocPointer(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) closePicker(false)
}
onMounted(() => document.addEventListener('pointerdown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))

const placeholderText = computed(() => props.placeholder ?? (selected.value.iso2 === 'NG' ? '801 234 5678' : 'Phone number'))
</script>

<template>
  <div ref="root" class="w-full">
    <label v-if="label" :for="id" class="label">{{ label }}<span v-if="required" class="text-danger-500">*</span></label>
    <div :class="cn('relative flex items-stretch rounded-xl border bg-white transition-colors focus-within:border-brand-600', error ? 'border-danger-500 focus-within:border-danger-500' : 'border-ink-200', disabled && 'bg-ink-50')">
      <button
        type="button"
        :disabled="disabled"
        :class="cn('flex shrink-0 items-center gap-1.5 rounded-l-xl border-r border-ink-200 pl-3.5 pr-2.5 text-sm text-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed', size === 'lg' ? 'min-h-[50px]' : 'min-h-[46px]')"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-label="`Country code: ${selected.name} +${selected.dial}. Change country`"
        @click="open ? closePicker() : openPicker()"
      >
        <span v-if="showFlags" class="text-lg leading-none" aria-hidden="true">{{ flagEmoji(selected.iso2) }}</span>
        <span v-else class="rounded bg-ink-100 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-ink-600" aria-hidden="true">{{ selected.iso2 }}</span>
        <span class="font-medium tabular-nums" aria-hidden="true">+{{ selected.dial }}</span>
        <ChevronDown :class="cn('h-4 w-4 text-ink-400 transition-transform', open && 'rotate-180')" aria-hidden="true" />
      </button>
      <input
        :id="id"
        ref="phoneInput"
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        :value="national"
        :placeholder="placeholderText"
        :disabled="disabled"
        :required="required"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        :class="cn('min-w-0 flex-1 rounded-r-xl border-0 bg-transparent px-3.5 text-sm tabular-nums text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0', size === 'lg' && 'text-base')"
        @input="onInput"
        @blur="onBlur"
      />

      <!-- country list -->
      <div v-if="open" class="absolute left-0 top-full z-30 mt-2 w-full min-w-[280px] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-float sm:w-[340px]">
        <div class="relative border-b border-ink-100 p-2">
          <Search class="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="query"
            type="search"
            autocomplete="off"
            placeholder="Search country or code"
            aria-label="Search countries"
            role="combobox"
            :aria-controls="listId"
            aria-expanded="true"
            :aria-activedescendant="filtered[activeIndex] ? `${listId}-${filtered[activeIndex]!.iso2}` : undefined"
            class="h-10 w-full rounded-xl border-0 bg-ink-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-100 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
            @keydown="onListKey"
          />
        </div>
        <ul :id="listId" ref="listEl" role="listbox" aria-label="Countries" class="max-h-64 overflow-y-auto p-1.5">
          <li
            v-for="(c, i) in filtered"
            :id="`${listId}-${c.iso2}`"
            :key="c.iso2"
            role="option"
            :data-index="i"
            :aria-selected="c.iso2 === selected.iso2"
            :class="cn('flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm', i === activeIndex ? 'bg-brand-50' : 'hover:bg-ink-50')"
            @pointerenter="activeIndex = i"
            @click="choose(c)"
          >
            <span v-if="showFlags" class="text-lg leading-none" aria-hidden="true">{{ flagEmoji(c.iso2) }}</span>
            <span v-else class="w-7 rounded bg-ink-100 py-0.5 text-center text-[10px] font-semibold text-ink-600" aria-hidden="true">{{ c.iso2 }}</span>
            <span class="min-w-0 flex-1 truncate text-ink-900">{{ c.name }}</span>
            <span class="tabular-nums text-ink-500">+{{ c.dial }}</span>
            <Check v-if="c.iso2 === selected.iso2" class="h-4 w-4 text-brand-600" aria-hidden="true" />
          </li>
          <li v-if="!filtered.length" class="px-3 py-6 text-center text-sm text-ink-500">No country matches “{{ query }}”</li>
        </ul>
      </div>
    </div>
    <p v-if="error" :id="`${id}-error`" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
