<script setup lang="ts">
import { ref } from 'vue'
import { useDebounce } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSectionHeader from '@/components/ui/UiSectionHeader.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { eventsApi } from '@/services/api/events.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { useAsync } from '@/composables/useAsync'

const tab = ref<'active' | 'past'>('active')
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => organizerApi.promotions({ status: tab.value, search: debounced.value || undefined, page }), { watch: [tab, debounced] })
const { data: available, loading: availableLoading } = useAsync(() => eventsApi.promoted())
</script>

<template>
  <div class="container-app pb-10">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 class="text-3xl md:text-4xl">Earn with Wedpluz</h1><p class="mt-1 text-sm text-ink-500">Events you’re promoting</p></div>
      <label class="relative w-full sm:w-80"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search..." class="field rounded-xl pl-10" aria-label="Search promotions" /></label>
    </div>
    <UiTabs v-model="tab" variant="pill" class="mt-8" :tabs="[{ key: 'active', label: 'Active' }, { key: 'past', label: 'Past' }]" />
    <div class="mt-6">
      <ErrorState v-if="list.error.value" :error="list.error.value" @retry="list.refresh()" />
      <div v-else-if="!list.loading.value && list.isEmpty.value" class="py-10 text-center"><h3 class="text-lg font-semibold">You’re not promoting any events yet</h3><p class="mt-1 text-sm text-ink-500">Pick an event below, share your link and earn a commission on every ticket sold.</p></div>
      <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <template v-if="list.loading.value"><UiSkeleton v-for="i in 4" :key="i" variant="event" /></template>
        <RouterLink v-for="p in list.items.value" :key="p.id" :to="{ name: 'earn.detail', params: { id: p.id } }" class="card card-hover group block overflow-hidden">
          <div class="aspect-[4/3] overflow-hidden bg-ink-100"><img :src="p.event.coverUrl" :alt="p.event.title" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105" /></div>
          <div class="p-4"><h3 class="line-clamp-1 font-semibold">{{ p.event.title }}</h3><p class="mt-1 text-sm text-ink-500">{{ p.signups }} sign-ups{{ p.targetSignups ? ` / ${p.targetSignups}` : '' }}</p><p class="mt-1 text-sm font-medium text-brand-600">{{ p.commissionPercent }}% commission</p></div>
        </RouterLink>
      </div>
      <div v-if="list.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
    <section class="mt-16">
      <UiSectionHeader title="Events you can promote" subtitle="Earn rewards by promoting events" badge="Premium" />
      <EventGrid :events="available ?? []" :loading="availableLoading" variant="promote" :skeleton-count="4" empty-title="No events open for promotion right now" />
    </section>
  </div>
</template>
