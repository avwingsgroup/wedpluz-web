<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Trophy } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useAsync } from '@/composables/useAsync'
import { formatMoney } from '@/utils/format'
import { cn } from '@/utils/cn'

const route = useRoute()
const id = String(route.params.id)
const { data, loading } = useAsync(() => organizerApi.promoters(id))
</script>

<template>
  <div class="container-app max-w-3xl pb-10 pt-10">
    <UiBackButton :to="{ name: 'manage.overview', params: { id } }" />
    <h1 class="mt-6 text-3xl">Promoters board</h1>
    <p class="mt-1 text-sm text-ink-500">Top promoters by sign-ups for this event.</p>
    <div v-if="loading" class="mt-6 space-y-2"><UiSkeleton v-for="i in 5" :key="i" class="h-14 rounded-2xl" /></div>
    <UiEmptyState v-else-if="!data?.length" title="Promotion inactive" description="Turn on event promotion from the Manage Event overview to let Premium members promote your event." illustration="generic"><UiButton :to="{ name: 'manage.overview', params: { id } }">Go to overview</UiButton></UiEmptyState>
    <div v-else class="card mt-6 divide-y divide-ink-100">
      <div v-for="p in data" :key="p.user.id" class="flex items-center gap-3 p-4">
        <span :class="cn('flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold', p.rank === 1 ? 'bg-warning-50 text-amber-600' : p.rank <= 3 ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500')"><Trophy v-if="p.rank === 1" class="h-4 w-4" /><template v-else>{{ p.rank }}</template></span>
        <UiAvatar :src="p.user.avatarUrl" :name="p.user.displayName" />
        <p class="flex-1 font-medium">{{ p.user.displayName }}</p>
        <div class="text-right"><p class="font-semibold">{{ p.signups }} sign-ups</p><p class="text-xs text-ink-500">{{ formatMoney(p.earnings) }} earned</p></div>
      </div>
    </div>
  </div>
</template>
