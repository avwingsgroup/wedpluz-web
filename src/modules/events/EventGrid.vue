<script setup lang="ts">
import type { EventSummary, ManageEventSummary } from '@/types'
import EventCard from './EventCard.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { cn } from '@/utils/cn'

withDefaults(defineProps<{ events: Array<EventSummary | ManageEventSummary>; loading?: boolean; variant?: 'grid' | 'compact' | 'promote' | 'manage' | 'earn'; columns?: 2 | 3 | 4; emptyTitle?: string; emptyDescription?: string; skeletonCount?: number }>(), { loading: false, variant: 'grid', columns: 4, emptyTitle: 'No events found', skeletonCount: 8 })
</script>

<template>
  <div :class="cn('grid gap-5', columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', columns === 2 && 'grid-cols-1 md:grid-cols-2')">
    <template v-if="loading"><UiSkeleton v-for="i in skeletonCount" :key="i" variant="event" /></template>
    <template v-else-if="events.length"><EventCard v-for="e in events" :key="e.id" :event="e" :variant="variant" /></template>
  </div>
  <UiEmptyState v-if="!loading && events.length === 0" :title="emptyTitle" :description="emptyDescription" illustration="events"><slot name="empty-action" /></UiEmptyState>
</template>
