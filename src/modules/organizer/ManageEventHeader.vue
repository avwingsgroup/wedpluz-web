<script setup lang="ts">
import { Calendar } from 'lucide-vue-next'
import UiBadge from '@/components/ui/UiBadge.vue'
import { formatDateRange } from '@/utils/format'
import type { Event } from '@/types'
defineProps<{ event: Pick<Event, 'title' | 'coverUrl' | 'startsAt' | 'endsAt' | 'status'> }>()
</script>

<template>
  <div class="card flex items-center gap-4 p-2 pr-4">
    <img :src="event.coverUrl" :alt="event.title" class="h-20 w-20 rounded-xl object-cover sm:h-28 sm:w-28" />
    <div class="min-w-0 flex-1"><p class="truncate text-lg font-medium">{{ event.title }}</p><p class="mt-1 flex items-center gap-2 text-ink-500"><Calendar class="h-4 w-4" />{{ formatDateRange(event.startsAt, event.endsAt) }}</p></div>
    <UiBadge :status="event.status" />
  </div>
</template>
