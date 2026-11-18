<script setup lang="ts">
import { cn } from '@/utils/cn'
withDefaults(defineProps<{ class?: string; variant?: 'line' | 'circle' | 'rect' | 'card' | 'event' | 'row' }>(), { variant: 'line' })
</script>

<template>
  <div v-if="variant === 'event'" class="card overflow-hidden">
    <div class="skeleton aspect-[4/3] w-full rounded-none" />
    <div class="space-y-2 p-4"><div class="skeleton h-5 w-20 rounded-full" /><div class="skeleton h-4 w-4/5" /><div class="skeleton h-3 w-1/3" /></div>
  </div>
  <div v-else-if="variant === 'card'" :class="cn('card p-4 space-y-3', $props.class)"><div class="skeleton h-4 w-1/3" /><div class="skeleton h-8 w-1/2" /><div class="skeleton h-3 w-2/3" /></div>
  <div v-else-if="variant === 'row'" :class="cn('flex items-center gap-3 py-3', $props.class)"><div class="skeleton h-10 w-10 rounded-full" /><div class="flex-1 space-y-2"><div class="skeleton h-4 w-1/3" /><div class="skeleton h-3 w-1/5" /></div><div class="skeleton h-6 w-20 rounded-full" /></div>
  <div v-else :class="cn('skeleton', variant === 'circle' && 'rounded-full', variant === 'line' && 'h-4 w-full', $props.class)" aria-hidden="true" />
</template>
