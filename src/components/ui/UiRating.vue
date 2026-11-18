<script setup lang="ts">
import { Star } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
withDefaults(defineProps<{ modelValue: number; editable?: boolean; size?: 'sm' | 'md' | 'lg'; showValue?: boolean; count?: number }>(), { editable: false, size: 'sm', showValue: false })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-7 w-7' }
</script>

<template>
  <span class="inline-flex items-center gap-1">
    <template v-if="editable">
      <button v-for="i in 5" :key="i" type="button" :aria-label="`${i} star${i > 1 ? 's' : ''}`" class="transition-transform hover:scale-110" @click="emit('update:modelValue', i)">
        <Star :class="cn(sizes[size], i <= modelValue ? 'fill-warning-500 text-warning-500' : 'text-ink-300')" />
      </button>
    </template>
    <template v-else>
      <Star :class="cn(sizes[size], 'fill-warning-500 text-warning-500')" />
      <span v-if="showValue" class="text-sm text-ink-700">{{ modelValue > 0 ? modelValue.toFixed(1) : 'No ratings yet' }}</span>
      <span v-if="count !== undefined" class="text-xs text-ink-500">({{ count }})</span>
    </template>
  </span>
</template>
