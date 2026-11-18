<script setup lang="ts">
import { useId } from 'vue'
import { cn } from '@/utils/cn'

withDefaults(defineProps<{ modelValue: boolean; label?: string; description?: string; disabled?: boolean; size?: 'sm' | 'md' }>(), { size: 'md' })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <label :for="id" :class="cn('flex items-start justify-between gap-4', disabled ? 'opacity-50' : 'cursor-pointer')">
    <span v-if="label || $slots.default" class="min-w-0 flex-1">
      <span class="block text-sm font-medium text-ink-900"><slot>{{ label }}</slot></span>
      <span v-if="description" class="mt-0.5 block text-xs text-ink-500">{{ description }}</span>
    </span>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :class="cn('relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors', size === 'sm' ? 'h-6 w-11' : 'h-7 w-12', modelValue ? 'border-brand-600 bg-brand-600' : 'border-brand-600 bg-white')"
      @click="emit('update:modelValue', !modelValue)"
    >
      <span :class="cn('inline-block rounded-full transition-transform', size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', modelValue ? 'bg-white' : 'bg-brand-600', modelValue ? (size === 'sm' ? 'translate-x-5' : 'translate-x-5') : 'translate-x-0.5')" />
    </button>
  </label>
</template>
