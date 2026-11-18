<script setup lang="ts">
import { useId } from 'vue'
import { Check } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

defineProps<{ modelValue: boolean; label?: string; description?: string; disabled?: boolean; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const id = useId()
</script>

<template>
  <div>
    <label :for="id" :class="cn('flex items-start gap-3', disabled ? 'opacity-50' : 'cursor-pointer')">
      <span class="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input :id="id" type="checkbox" class="peer sr-only" :checked="modelValue" :disabled="disabled" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)" />
        <span :class="cn('flex h-5 w-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2', modelValue ? 'border-brand-600 bg-brand-600' : 'border-ink-300 bg-white')">
          <Check v-if="modelValue" class="h-3.5 w-3.5 text-white" stroke-width="3" />
        </span>
      </span>
      <span v-if="label || $slots.default" class="text-sm text-ink-700">
        <slot>{{ label }}</slot>
        <span v-if="description" class="block text-xs text-ink-500">{{ description }}</span>
      </span>
    </label>
    <p v-if="error" class="mt-1 text-xs text-danger-500" role="alert">{{ error }}</p>
  </div>
</template>
