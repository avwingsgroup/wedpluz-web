<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import UiBadge from './UiBadge.vue'
defineProps<{ title: string; subtitle?: string; to?: RouteLocationRaw; linkLabel?: string; badge?: string; size?: 'md' | 'lg' }>()
</script>

<template>
  <div class="mb-4 flex items-end justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <h2 :class="size === 'lg' ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'">{{ title }}</h2>
        <UiBadge v-if="badge" tone="brand" size="sm">✦ {{ badge }}</UiBadge>
        <slot name="after-title" />
      </div>
      <p v-if="subtitle" class="mt-1 text-sm text-ink-500">{{ subtitle }}</p>
    </div>
    <slot name="actions">
      <RouterLink v-if="to" :to="to" class="shrink-0 text-sm font-medium text-brand-600 hover:underline">{{ linkLabel ?? 'See all' }}</RouterLink>
    </slot>
  </div>
</template>
