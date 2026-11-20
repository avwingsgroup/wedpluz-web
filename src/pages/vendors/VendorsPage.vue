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
import { breadcrumbLd, itemListLd } from '@/utils/structuredData'
import AppDownloadBanner from '@/components/marketing/AppDownloadBanner.vue'
import proBannerArt from '@/assets/illustrations/pro-banner.webp'
import type { VendorCategory, VendorFilters } from '@/types'

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

// "Photographers in Lagos" style landing pages are indexable; searches and other filters are not.
useSeo(() => {
  const p = params.value
  const category = categories.value.find((c) => c.slug === p.categorySlug)?.name ?? null
  const place = p.location || null
  const pageNo = Number(p.page) > 1 ? ` – Page ${p.page}` : ''
  const base = category ? `Hire ${category} ${place ? `in ${place}` : 'Near You'}` : place ? `Hire Event Vendors in ${place}` : null
  const filtered = !!p.search || Number(p.minRating) > 0 || p.availability !== 'any' || p.sort !== 'relevance'
  const vendors = data.value?.data ?? []
  return {
    title: base ? base + pageNo : pageNo ? `Hire Event Vendors${pageNo}` : undefined,
    description: base ? `Compare ${category ? category.toLowerCase() : 'event vendors'} ${place ? `in ${place}` : 'near you'}: portfolios, ratings and reviews. Message vendors and book with confidence on Wedpluz.` : undefined,
    noIndex: filtered,
    jsonLd: [
      breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Vendors', path: '/vendors' }, ...(category ? [{ name: category, path: `/vendors?categorySlug=${p.categorySlug}` }] : [])]),
      ...(vendors.length ? [itemListLd(base ?? 'Event vendors', vendors.map((v) => ({ name: v.businessName, path: `/vendors/${v.slug}`, image: v.avatarUrl })))] : []),
    ],
  }
})
</script>

<template>
  <div class="container-app pb-10 pt-10">
    <div class="mx-auto max-w-[688px]"><UiSearchBar mode="vendors" placeholder="Search vendors to hire" :query="params.search" :location="params.location" @search="(q, l) => set({ search: q, location: l })" /></div>
    <div class="mt-10 flex flex-wrap justify-center gap-2.5">
      <UiDropdown align="left" width="w-60">
        <template #trigger><button type="button" class="inline-flex h-12 items-center gap-3 rounded-full bg-[#f6f6f6] px-6 text-base text-[#333740] hover:bg-ink-100">{{ categoryLabel }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }">
          <div class="max-h-80 overflow-y-auto">
            <button type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ categorySlug: 'all' }); close()">All categories</button>
            <button v-for="c in categories" :key="c.id" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ categorySlug: c.slug }); close()">{{ c.name }}</button>
          </div>
        </template>
      </UiDropdown>
      <UiDropdown align="left" width="w-44">
        <template #trigger><button type="button" class="inline-flex h-12 items-center gap-3 rounded-full bg-[#f6f6f6] px-6 text-base text-[#333740] hover:bg-ink-100">{{ params.minRating ? `${params.minRating}+ stars` : 'Ratings' }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }"><button v-for="r in [0, 4.5, 4, 3]" :key="r" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-50" @click="set({ minRating: r }); close()">{{ r ? `${r} stars & up` : 'Any rating' }}</button></template>
      </UiDropdown>
      <UiDropdown align="left" width="w-44">
        <template #trigger><button type="button" class="inline-flex h-12 items-center gap-3 rounded-full bg-[#f6f6f6] px-6 text-base text-[#333740] hover:bg-ink-100 capitalize">{{ params.availability === 'any' ? 'Availability' : params.availability }} <ChevronDown class="h-4 w-4" /></button></template>
        <template #default="{ close }"><button v-for="a in ['any', 'available', 'busy']" :key="a" type="button" class="block w-full rounded-xl px-3 py-2.5 text-left text-sm capitalize hover:bg-ink-50" @click="set({ availability: a }); close()">{{ a === 'any' ? 'Any' : a }}</button></template>
      </UiDropdown>
      <button type="button" class="flex h-12 w-12 items-center justify-center rounded-full border border-ink-200 hover:bg-ink-50" aria-label="Sort and filter" @click="filterOpen = true"><SlidersHorizontal class="h-4 w-4" /></button>
    </div>

    <h1 class="mt-14 text-3xl md:mt-[104px] md:text-[32px] md:leading-10">Hire Vendors on Wedpluz</h1>
    <p class="mt-2 text-sm text-[#333740]">{{ data ? `${data.meta.total.toLocaleString()} vendors for hire` : '1000+ Vendors for hire' }}</p>

    <div class="mt-6 space-y-2">
      <ErrorState v-if="error" :error="error" @retry="refresh" />
      <template v-else-if="loading && !data"><UiSkeleton v-for="i in 3" :key="i" class="h-72 rounded-2xl" /></template>
      <UiEmptyState v-else-if="data && !data.data.length" title="No search results" :description="`We couldn’t find vendors matching your search. Try another category or location.`" illustration="search">
        <UiButton variant="outline" @click="set({ search: '', location: '', categorySlug: 'all', minRating: 0, availability: 'any' })">Clear filters</UiButton>
      </UiEmptyState>
      <VendorCard v-for="v in data?.data ?? []" v-else :key="v.id" :vendor="v" />
    </div>
    <UiPagination v-if="data" class="mt-8" :page="data.meta.page" :last-page="data.meta.lastPage" :total="data.meta.total" :per-page="data.meta.perPage" @update:page="set({ page: $event })" />

    <!-- Design: same banner pattern as Home, with the vendor-profile phone art. Bleeds to the container edges. -->
    <AppDownloadBanner class="mt-20 px-0! md:mt-[100px]" :lines="['For Professionals Who', 'Make Events Happen']" text="Get the visibility your work deserves." :art="proBannerArt" />

    <UiDrawer v-model:open="filterOpen" title="Sort vendors" size="sm">
      <UiRadioGroup :model-value="params.sort" :options="[{ label: 'Most relevant', value: 'relevance' }, { label: 'Highest rated', value: 'rating' }, { label: 'Newest', value: 'newest' }]" @update:model-value="set({ sort: $event }); filterOpen = false" />
    </UiDrawer>
  </div>
</template>
