<script setup lang="ts">
import { ref } from 'vue'
import { useDebounce } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiButton from '@/components/ui/UiButton.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import { eventsApi } from '@/services/api/events.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { useRouter } from 'vue-router'

const router = useRouter()
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => eventsApi.saved({ search: debounced.value || undefined, page }), { watch: debounced })
</script>

<template>
  <div class="container-app pb-10">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-3xl md:text-4xl">Saved Events</h1>
      <label class="relative w-full sm:w-80"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search..." class="field rounded-xl pl-10" aria-label="Search saved events" /></label>
    </div>
    <UiTabs model-value="events" variant="pill" class="mt-6" :tabs="[{ key: 'events', label: 'Events' }, { key: 'vendors', label: 'Vendors' }]" @update:model-value="(k) => k === 'vendors' && router.push({ name: 'saved.vendors' })" />
    <div class="mt-6">
      <ErrorState v-if="list.error.value" :error="list.error.value" @retry="list.refresh()" />
      <EventGrid v-else :events="list.items.value" :loading="list.loading.value" :columns="2" empty-title="No saved events" empty-description="Tap the heart on any event to save it for later.">
        <template #empty-action><UiButton :to="{ name: 'events' }">Browse events</UiButton></template>
      </EventGrid>
      <div v-if="list.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
  </div>
</template>
