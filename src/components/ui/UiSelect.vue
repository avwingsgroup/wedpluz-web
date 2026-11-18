<script setup lang="ts">
import { useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

withDefaults(defineProps<{ modelValue?: string | number | null; options: SelectOption[]; label?: string; placeholder?: string; error?: string; hint?: string; required?: boolean; disabled?: boolean; size?: 'sm' | 'md' }>(), { size: 'md' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()
const id = useId()
function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  emit('update:modelValue', v)
  emit('change', v)
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="label">{{ label }}<span v-if="required" class="text-danger-500">*</span></label>
    <div class="relative">
      <select
        :id="id"
        :value="modelValue ?? ''"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :class="cn('field appearance-none pr-10', size === 'sm' && 'py-2 text-sm', error && 'field-error', (modelValue === '' || modelValue == null) && 'text-ink-400')"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.disabled">{{ o.label }}</option>
      </select>
      <ChevronDown class="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
