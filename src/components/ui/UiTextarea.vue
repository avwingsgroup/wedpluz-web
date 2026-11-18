<script setup lang="ts">
import { useId } from 'vue'
import { cn } from '@/utils/cn'

withDefaults(defineProps<{ modelValue?: string | null; label?: string; placeholder?: string; error?: string; hint?: string; required?: boolean; disabled?: boolean; rows?: number; maxlength?: number }>(), { rows: 4 })
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
const id = useId()
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="label">{{ label }}<span v-if="required" class="text-danger-500">*</span></label>
    <textarea
      :id="id"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :maxlength="maxlength"
      :aria-invalid="!!error || undefined"
      :class="cn('field resize-y min-h-[96px]', error && 'field-error')"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @blur="emit('blur')"
    />
    <div class="mt-1.5 flex items-center justify-between gap-2">
      <p v-if="error" class="text-xs text-danger-500" role="alert">{{ error }}</p>
      <p v-else-if="hint" class="text-xs text-ink-500">{{ hint }}</p>
      <span v-else />
      <span v-if="maxlength" class="text-xs text-ink-400">{{ (modelValue ?? '').length }}/{{ maxlength }}</span>
    </div>
  </div>
</template>
