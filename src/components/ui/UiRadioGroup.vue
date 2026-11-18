<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

export interface RadioOption {
  label: string
  value: string
  description?: string
  disabled?: boolean
}

withDefaults(defineProps<{ modelValue: string | null; options: RadioOption[]; label?: string; error?: string; variant?: 'list' | 'cards' | 'check' }>(), { variant: 'list' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <fieldset>
    <legend v-if="label" class="label">{{ label }}</legend>
    <div :class="cn(variant === 'cards' ? 'grid gap-3' : 'divide-y divide-ink-100')">
      <label
        v-for="o in options"
        :key="o.value"
        :class="cn('flex items-center justify-between gap-4', o.disabled ? 'opacity-50' : 'cursor-pointer', variant === 'cards' ? 'card px-4 py-3' : 'py-3', variant === 'cards' && modelValue === o.value && 'border-brand-600 bg-brand-50/40')"
      >
        <span class="min-w-0">
          <span class="block text-sm text-ink-900">{{ o.label }}</span>
          <span v-if="o.description" class="block text-xs text-ink-500">{{ o.description }}</span>
        </span>
        <input type="radio" class="sr-only" :value="o.value" :checked="modelValue === o.value" :disabled="o.disabled" @change="emit('update:modelValue', o.value)" />
        <span v-if="variant === 'check'" :class="cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', modelValue === o.value ? 'border-brand-600 bg-brand-600' : 'border-ink-300')">
          <Check v-if="modelValue === o.value" class="h-3 w-3 text-white" stroke-width="3" />
        </span>
        <span v-else :class="cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', modelValue === o.value ? 'border-brand-600' : 'border-ink-300')">
          <span v-if="modelValue === o.value" class="h-2.5 w-2.5 rounded-full bg-brand-600" />
        </span>
      </label>
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
  </fieldset>
</template>
