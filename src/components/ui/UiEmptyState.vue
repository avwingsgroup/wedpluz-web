<script setup lang="ts">
import { cn } from '@/utils/cn'
withDefaults(defineProps<{ title: string; description?: string; compact?: boolean; illustration?: 'tickets' | 'events' | 'search' | 'chat' | 'wallet' | 'generic' | 'none' }>(), { compact: false, illustration: 'generic' })
</script>

<template>
  <div :class="cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16')">
    <div v-if="illustration !== 'none'" class="relative mb-5 h-28 w-32" aria-hidden="true">
      <span class="absolute left-2 top-2 h-3 w-3 rounded-full bg-pink-100" />
      <span class="absolute right-3 bottom-4 h-2 w-2 rounded-full bg-brand-100" />
      <span class="absolute left-6 top-6 h-20 w-24 -rotate-6 rounded-2xl bg-gradient-to-br from-brand-100 to-pink-100 shadow-card" />
      <span class="absolute left-10 top-3 h-20 w-24 rotate-6 rounded-2xl bg-gradient-to-br from-brand-200 to-brand-100 shadow-card ring-1 ring-white" />
      <svg class="absolute left-16 top-9 h-9 w-9 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path v-if="illustration === 'tickets'" d="M3 9a2 2 0 0 0 2-2V5h14v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2H5v-2a2 2 0 0 0-2-2z" />
        <path v-else-if="illustration === 'search'" d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.3-4.3" />
        <path v-else-if="illustration === 'chat'" d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
        <path v-else-if="illustration === 'wallet'" d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V5a2 2 0 0 1 2-2h11v4M16 14h3" />
        <path v-else d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    </div>
    <h3 class="text-lg font-bold text-ink-900">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-ink-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
