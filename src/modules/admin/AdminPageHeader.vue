<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
defineProps<{ title: string; description?: string; back?: RouteLocationRaw }>()
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <RouterLink v-if="back" :to="back" class="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900"><ChevronLeft class="h-4 w-4" />Back</RouterLink>
      <h2 class="truncate text-2xl">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm text-ink-500">{{ description }}</p>
      <slot name="meta" />
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2"><slot /></div>
  </div>
</template>
