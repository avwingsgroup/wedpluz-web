<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-vue-next'
import UiSearchBar from '@/components/ui/UiSearchBar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import CategoryTabs from '@/modules/events/CategoryTabs.vue'
import EventFiltersDrawer from '@/modules/events/EventFiltersDrawer.vue'
import { eventsApi } from '@/services/api/events.api'
import { useEventCategories } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import { useQueryParams } from '@/composables/useQueryParams'
import { useAsync } from '@/composables/useAsync'
import { useSeo } from '@/composables/useSeo'
import { DEFAULT_CITY } from '@/config/app'
import type { EventCategory, EventFilters } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const filtersOpen = ref(false)
const { data: categoryData } = useEventCategories()
const categories = computed<EventCategory[]>(() => categoryData.value ?? [])
const bannerDismissed = ref(false)

const params = useQueryParams({ search: '', location: '', categorySlug: 'all', dateFrom: '', dateTo: '', timeOfDay: 'any', attendanceMode: 'any', distanceKm: 150, freeOnly: false, sort: 'relevance', page: 1 })
const filters = computed<EventFilters>(() => ({ ...params.value, categorySlug: params.value.categorySlug === 'all' ? undefined : params.value.categorySlug, timeOfDay: params.value.timeOfDay as EventFilters['timeOfDay'], attendanceMode: params.value.attendanceMode as EventFilters['attendanceMode'], sort: params.value.sort as EventFilters['sort'], perPage: 12 }))

useSeo(() => ({ title: params.value.search ? `“${params.value.search}” events` : `Events near ${params.value.location || DEFAULT_CITY}`, description: 'Browse upcoming events, buy tickets and discover what is happening near you on Wedpluz.' }))

const { data, loading, error, refresh } = useAsync((signal) => eventsApi.list(filters.value, signal), { watch: filters, keepPreviousData: true })
const activeFilterCount = computed(() => [params.value.dateFrom, params.value.dateTo, params.value.timeOfDay !== 'any', params.value.attendanceMode !== 'any', params.value.distanceKm !== 150, params.value.freeOnly].filter(Boolean).length)
function set(patch: Partial<typeof params.value>) {
  params.value = { ...params.value, ...patch, page: patch.page ?? 1 }
}
watch(() => params.value.page, () => window.scrollTo({ top: 0, behavior: 'smooth' }))
const dateLabel = computed(() => (params.value.dateFrom ? `${params.value.dateFrom}${params.value.dateTo ? ` → ${params.value.dateTo}` : ''}` : 'Any Date'))
const venueLabel = computed(() => ({ any: 'Any Venue', physical: 'In Person', online: 'Online', hybrid: 'Hybrid' })[params.value.attendanceMode] ?? 'Any Venue')
const quickDates = [
  { label: 'Any Date', from: '', to: '' },
  { label: 'Today', from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10) },
  { label: 'This weekend', from: nextDay(6), to: nextDay(7) },
  { label: 'Next 30 days', from: new Date().toISOString().slice(0, 10), to: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) },
]
function nextDay(dow: number) {
  const d = new Date()
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7))
  return d.toISOString().slice(0, 10)
}
</script>

<template>
  <div class="container-app pb-10 pt-8">
    <div v-if="auth.isAuthenticated && !bannerDismissed" class="relative mb-10 flex flex-col gap-4 rounded-2xl bg-brand-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 class="text-xl">Host Your Event</h2><p class="text-sm text-ink-700">Create and manage your own events.</p></div>
      <div class="flex items-center gap-3"><UiButton :to="{ name: 'manage.create' }">Create Event</UiButton><button type="button" class="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-ink-500" aria-label="Dismiss" @click="bannerDismissed = true"><X class="h-3.5 w-3.5" /></button></div>
    </div>

    <h1 class="text-3xl md:text-4xl">{{ params.search ? `Results for “${params.search}”` : `Events near ${params.location || DEFAULT_CITY}, NG` }}</h1>

    <div class="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
      <div class="lg:w-[560px]"><UiSearchBar :query="params.search" :location="params.location" @search="(q, l) => set({ search: q, location: l })" /></div>
      <div class="flex flex-wrap items-center gap-2 lg:ml-auto">
        <UiDropdown align="left" width="w-48">
          <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium hover:bg-ink-200">{{ dateLabel }} <ChevronDown class="h-4 w-4" /></button></template>
          <template #default="{ close }"><button v-for="d in quickDates" :key="d.label" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ dateFrom: d.from, dateTo: d.to }); close()">{{ d.label }}</button></template>
        </UiDropdown>
        <UiDropdown align="left" width="w-44">
          <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium hover:bg-ink-200">{{ venueLabel }} <ChevronDown class="h-4 w-4" /></button></template>
          <template #default="{ close }"><button v-for="v in [['any', 'Any Venue'], ['physical', 'In Person'], ['online', 'Online'], ['hybrid', 'Hybrid']]" :key="v[0]" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ attendanceMode: v[0] }); close()">{{ v[1] }}</button></template>
        </UiDropdown>
        <UiDropdown align="left" width="w-44">
          <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium hover:bg-ink-200">{{ params.sort === 'relevance' ? 'Distance' : params.sort[0]!.toUpperCase() + params.sort.slice(1) }} <ChevronDown class="h-4 w-4" /></button></template>
          <template #default="{ close }"><button v-for="s in [['relevance', 'Distance'], ['date', 'Date'], ['price', 'Price'], ['popularity', 'Popularity']]" :key="s[0]" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ sort: s[0] }); close()">{{ s[1] }}</button></template>
        </UiDropdown>
        <button type="button" class="relative flex h-11 w-11 items-center justify-center rounded-full border border-ink-200 hover:bg-ink-50" aria-label="More filters" @click="filtersOpen = true">
          <SlidersHorizontal class="h-4 w-4" /><span v-if="activeFilterCount" class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-semibold text-white">{{ activeFilterCount }}</span>
        </button>
      </div>
    </div>

    <CategoryTabs class="mt-8" :categories="categories" :model-value="params.categorySlug" @update:model-value="set({ categorySlug: $event })" />

    <div class="mt-8">
      <ErrorState v-if="error" :error="error" @retry="refresh" />
      <template v-else>
        <p v-if="data && !loading" class="mb-4 text-sm text-ink-500">{{ data.meta.total }} event{{ data.meta.total === 1 ? '' : 's' }}</p>
        <EventGrid :events="data?.data ?? []" :loading="loading && !data" :variant="auth.isAuthenticated ? 'grid' : 'compact'" :empty-title="params.search ? 'No Search Result' : 'No events match these filters'" :empty-description="params.search ? `We couldn’t find anything for “${params.search}”. Try a different keyword or location.` : 'Try widening your dates or clearing filters.'">
          <template #empty-action><UiButton variant="outline" @click="router.replace({ name: 'events' })">Clear filters</UiButton></template>
        </EventGrid>
        <UiPagination v-if="data" class="mt-10" :page="data.meta.page" :last-page="data.meta.lastPage" :total="data.meta.total" :per-page="data.meta.perPage" @update:page="set({ page: $event })" />
      </template>
    </div>
    <EventFiltersDrawer v-model:open="filtersOpen" :filters="filters" @apply="(f) => set({ dateFrom: f.dateFrom ?? '', dateTo: f.dateTo ?? '', timeOfDay: f.timeOfDay ?? 'any', attendanceMode: f.attendanceMode ?? 'any', distanceKm: f.distanceKm ?? 150, freeOnly: !!f.freeOnly })" />
  </div>
</template>
