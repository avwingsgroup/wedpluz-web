<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { formatRelativeLong } from '@/utils/format'

const route = useRoute()
const id = String(route.params.id)
const role = ref<'all' | 'manager' | 'vendor'>('all')
const list = useInfiniteList((page) => organizerApi.activity(id, role.value, page), { watch: role })
</script>

<template>
  <div class="container-app max-w-3xl pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.overview', params: { id } }" />
    <h1 class="mt-6 text-3xl">Activity log</h1>
    <UiTabs v-model="role" variant="pill" class="mt-6" :tabs="[{ key: 'all', label: 'All' }, { key: 'manager', label: 'Managers' }, { key: 'vendor', label: 'Vendors' }]" />
    <div class="card mt-6 divide-y divide-ink-100">
      <template v-if="list.loading.value"><div v-for="i in 5" :key="i" class="px-4"><UiSkeleton variant="row" /></div></template>
      <UiEmptyState v-else-if="list.isEmpty.value" title="No activity yet" description="Actions taken by you, your managers and vendors are recorded here." compact />
      <div v-for="a in list.items.value" v-else :key="a.id" class="flex items-start gap-3 p-4"><UiAvatar :src="a.actor.avatarUrl" :name="a.actor.displayName" size="sm" /><div class="flex-1 text-sm"><p><strong class="font-semibold">{{ a.actor.displayName }}</strong> <span class="text-ink-500">({{ a.actorRole }})</span> {{ a.description }}</p><p class="mt-0.5 text-xs text-ink-400">{{ formatRelativeLong(a.createdAt) }}</p></div></div>
      <div v-if="list.hasMore.value" class="p-3"><UiButton variant="secondary" block :loading="list.loadingMore.value" @click="list.loadMore()">Load more</UiButton></div>
    </div>
  </div>
</template>
