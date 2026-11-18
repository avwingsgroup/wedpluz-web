<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, SlidersHorizontal } from 'lucide-vue-next'
import UiSearchBar from '@/components/ui/UiSearchBar.vue'
import UiDropdown from '@/components/ui/UiDropdown.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiPagination from '@/components/ui/UiPagination.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiRadioGroup from '@/components/ui/UiRadioGroup.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import VendorCard from '@/modules/vendors/VendorCard.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useVendorCategories } from '@/composables/useReferenceData'
import { useQueryParams } from '@/composables/useQueryParams'
import { useAsync } from '@/composables/useAsync'
import { useSeo } from '@/composables/useSeo'
import { ILLUSTRATIONS } from '@/assets/illustrations'
import { APP_STORE_LINKS } from '@/config/app'
import type { VendorCategory, VendorFilters } from '@/types'

useSeo({ title: 'Hire Vendors', description: 'Find photographers, caterers, planners, decorators, DJs and more vendors for your event on Wedpluz.' })
const { data: categoryData } = useVendorCategories()
const categories = computed<VendorCategory[]>(() => categoryData.value ?? [])
const filterOpen = ref(false)
const params = useQueryParams({ search: '', location: '', categorySlug: 'all', minRating: 0, availability: 'any', sort: 'relevance', page: 1 })
const filters = computed<VendorFilters>(() => ({ ...params.value, availability: params.value.availability as VendorFilters['availability'], sort: params.value.sort as VendorFilters['sort'], categorySlug: params.value.categorySlug === 'all' ? undefined : params.value.categorySlug, minRating: params.value.minRating || undefined, perPage: 10 }))
const { data, loading, error, refresh } = useAsync((signal) => vendorsApi.list(filters.value, signal), { watch: filters, keepPreviousData: true })
function set(patch: Partial<typeof params.value>) {
  params.value = { ...params.value, ...patch, page: patch.page ?? 1 }
}
const categoryLabel = computed(() => categories.value.find((c) => c.slug === params.value.categorySlug)?.name ?? 'Categories')
</script>

<template>
  <div class="container-app pb-10 pt-10">
    <div class="mx-auto max-w-2xl"><UiSearchBar mode="vendors" placeholder="Search vendors to hire" :query="params.search" :location="params.location" @search="(q, l) => set({ search: q, location: l })" /></div>
    <div class="mt-5 flex flex-wrap justify-center gap-2">
      <UiDropdown align="left" width="w-60">
        <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium">{{ categoryLabel }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }">
          <div class="max-h-80 overflow-y-auto">
            <button type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ categorySlug: 'all' }); close()">All categories</button>
            <button v-for="c in categories" :key="c.id" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ categorySlug: c.slug }); close()">{{ c.name }}</button>
          </div>
        </template>
      </UiDropdown>
      <UiDropdown align="left" width="w-44">
        <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium">{{ params.minRating ? `${params.minRating}+ stars` : 'Ratings' }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }"><button v-for="r in [0, 4.5, 4, 3]" :key="r" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ minRating: r }); close()">{{ r ? `${r} stars & up` : 'Any rating' }}</button></template>
      </UiDropdown>
      <UiDropdown align="left" width="w-44">
        <template #trigger><button type="button" class="inline-flex h-11 items-center gap-2 rounded-full bg-ink-100 px-5 text-sm font-medium capitalize">{{ params.availability === 'any' ? 'Availability' : params.availability }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }"><button v-for="a in ['any', 'available', 'busy']" :key="a" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm capitalize hover:bg-ink-50" @click="set({ availability: a }); close()">{{ a === 'any' ? 'Any' : a }}</button></template>
      </UiDropdown>
      <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full border border-ink-200" aria-label="Sort and filter" @click="filterOpen = true"><SlidersHorizontal class="h-4 w-4" /></button>
    </div>

    <h1 class="mt-14 text-3xl">Hire Vendors on Wedpluz</h1>
    <p class="mt-1 text-sm text-ink-500">{{ data ? `${data.meta.total.toLocaleString()} vendors for hire` : '1000+ Vendors for hire' }}</p>

    <div class="mt-6 space-y-4">
      <ErrorState v-if="error" :error="error" @retry="refresh" />
      <template v-else-if="loading && !data"><UiSkeleton v-for="i in 3" :key="i" class="h-72 rounded-2xl" /></template>
      <UiEmptyState v-else-if="data && !data.data.length" title="No search results" :description="`We couldn’t find vendors matching your search. Try another category or location.`" illustration="search">
        <UiButton variant="outline" @click="set({ search: '', location: '', categorySlug: 'all', minRating: 0, availability: 'any' })">Clear filters</UiButton>
      </UiEmptyState>
      <VendorCard v-for="v in data?.data ?? []" v-else :key="v.id" :vendor="v" />
    </div>
    <UiPagination v-if="data" class="mt-8" :page="data.meta.page" :last-page="data.meta.lastPage" :total="data.meta.total" :per-page="data.meta.perPage" @update:page="set({ page: $event })" />

    <section class="mt-20 grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-100 p-8 md:grid-cols-2 md:p-14">
      <div>
        <h2 class="text-3xl md:text-5xl">For Professionals Who Make Events Happen</h2>
        <p class="mt-4 text-ink-700">Get the visibility your work deserves.</p>
        <div class="mt-6 flex flex-wrap gap-3"><UiButton variant="outline" rounded="xl" :href="APP_STORE_LINKS.android">▶ GooglePlay</UiButton><UiButton variant="outline" rounded="xl" :href="APP_STORE_LINKS.ios"> App Store</UiButton><UiButton rounded="xl" :to="{ name: 'business.create' }">Register your work</UiButton></div>
      </div>
      <img :src="ILLUSTRATIONS.vendorsPhone" alt="" loading="lazy" class="mx-auto max-h-80 rounded-2xl object-cover shadow-float" />
    </section>

    <UiDrawer v-model:open="filterOpen" title="Sort vendors" size="sm">
      <UiRadioGroup :model-value="params.sort" :options="[{ label: 'Most relevant', value: 'relevance' }, { label: 'Highest rated', value: 'rating' }, { label: 'Newest', value: 'newest' }]" @update:model-value="set({ sort: $event }); filterOpen = false" />
    </UiDrawer>
  </div>
</template>
