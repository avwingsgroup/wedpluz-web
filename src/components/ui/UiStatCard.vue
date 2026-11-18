<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { TrendingDown, TrendingUp } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import UiSkeleton from './UiSkeleton.vue'

withDefaults(defineProps<{ label: string; value: string | number; hint?: string; change?: number | null; icon?: unknown; loading?: boolean; tone?: 'default' | 'brand' | 'plum'; to?: RouteLocationRaw }>(), { change: null, loading: false, tone: 'default' })
</script>

<template>
  <component :is="to ? 'router-link' : 'div'" :to="to" :class="cn('card p-5 flex flex-col gap-3 transition-shadow', to && 'hover:shadow-card', tone === 'brand' && 'brand-pattern border-transparent text-white', tone === 'plum' && 'bg-brand-950 border-transparent text-white')">
    <div class="flex items-center justify-between gap-3">
      <span :class="cn('text-sm', tone === 'default' ? 'text-ink-500' : 'text-white/80')">{{ label }}</span>
      <span v-if="icon" :class="cn('flex h-9 w-9 items-center justify-center rounded-xl', tone === 'default' ? 'bg-brand-50 text-brand-600' : 'bg-white/15 text-white')"><component :is="icon" class="h-4 w-4" /></span>
    </div>
    <template v-if="loading"><UiSkeleton class="h-8 w-2/3" /><UiSkeleton class="h-3 w-1/2" /></template>
    <template v-else>
      <div :class="cn('text-2xl font-bold tracking-tight md:text-3xl', tone === 'default' ? 'text-ink-900' : 'text-white')">{{ value }}</div>
      <div class="flex items-center gap-2 text-xs">
        <span v-if="change !== null" :class="cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', change >= 0 ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600', tone !== 'default' && 'bg-white/15 text-white')">
          <TrendingUp v-if="change >= 0" class="h-3 w-3" /><TrendingDown v-else class="h-3 w-3" />{{ Math.abs(change).toFixed(1) }}%
        </span>
        <span v-if="hint" :class="tone === 'default' ? 'text-ink-500' : 'text-white/70'">{{ hint }}</span>
      </div>
    </template>
  </component>
</template>
