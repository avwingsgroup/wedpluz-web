<script setup lang="ts">
import { cn } from '@/utils/cn'
defineProps<{ steps: Array<{ key: string; label?: string }>; current: number; clickable?: boolean }>()
const emit = defineEmits<{ select: [index: number] }>()
</script>

<template>
  <ol class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }" aria-label="Progress">
    <li v-for="(s, i) in steps" :key="s.key" class="min-w-0">
      <button type="button" class="block w-full text-center" :disabled="!clickable || i > current" :aria-current="i === current ? 'step' : undefined" @click="emit('select', i)">
        <span v-if="s.label" :class="cn('mb-1.5 block truncate text-xs md:text-sm', i === current ? 'font-semibold text-ink-900' : 'text-ink-500')">{{ s.label }}</span>
        <span :class="cn('block h-1.5 rounded-full', i < current ? 'bg-brand-300' : i === current ? 'bg-brand-600' : 'bg-ink-200')" />
      </button>
    </li>
  </ol>
</template>
