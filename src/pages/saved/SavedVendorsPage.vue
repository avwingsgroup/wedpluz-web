<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounce } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import VendorCard from '@/modules/vendors/VendorCard.vue'
import { vendorsApi } from '@/services/api/vendors.api'
import { useInfiniteList } from '@/composables/useInfiniteList'

const router = useRouter()
const search = ref('')
const debounced = useDebounce(search, 300)
const list = useInfiniteList((page) => vendorsApi.saved({ search: debounced.value || undefined, page }), { watch: debounced })
</script>

<template>
  <div class="container-app pb-10">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="text-3xl md:text-4xl">Saved vendors</h1>
      <label class="relative w-full sm:w-80"><Search class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input v-model="search" type="search" placeholder="Search..." class="field rounded-xl pl-10" aria-label="Search saved vendors" /></label>
    </div>
    <UiTabs model-value="vendors" variant="pill" class="mt-6" :tabs="[{ key: 'events', label: 'Events' }, { key: 'vendors', label: 'Vendors' }]" @update:model-value="(k) => k === 'events' && router.push({ name: 'saved' })" />
    <div class="mt-6">
      <ErrorState v-if="list.error.value" :error="list.error.value" @retry="list.refresh()" />
      <div v-else-if="list.loading.value" class="grid gap-4 md:grid-cols-2"><UiSkeleton v-for="i in 4" :key="i" class="h-64 rounded-2xl" /></div>
      <UiEmptyState v-else-if="list.isEmpty.value" title="No saved vendors" description="Save vendors you like so you can find them quickly." illustration="search"><UiButton :to="{ name: 'vendors' }">Hire vendors</UiButton></UiEmptyState>
      <div v-else class="grid gap-4 md:grid-cols-2"><VendorCard v-for="v in list.items.value" :key="v.id" :vendor="v" variant="tile" /></div>
      <div v-if="list.hasMore.value" class="mt-6 text-center"><UiButton variant="secondary" :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
  </div>
</template>
