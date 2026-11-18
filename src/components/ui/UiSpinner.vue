<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg'; label?: string; page?: boolean }>(), { size: 'md', page: false })
</script>

<template>
  <div :class="cn('flex items-center justify-center gap-3 text-brand-600', page && 'min-h-[40vh]')" role="status">
    <LoaderCircle :class="cn('animate-spin', { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9' }[size])" />
    <span v-if="label" class="text-sm text-ink-500">{{ label }}</span>
    <span v-else class="sr-only">Loading</span>
  </div>
</template>
