<script setup lang="ts">
import { computed, useId } from 'vue'
import { cn } from '@/utils/cn'

/** Edits amounts in major units but emits minor units (kobo), matching the API contract. */
const props = defineProps<{ modelValue: number | null; label?: string; error?: string; hint?: string; placeholder?: string; required?: boolean; disabled?: boolean; currencySymbol?: string }>()
const emit = defineEmits<{ 'update:modelValue': [minor: number | null] }>()
const id = useId()
const display = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : (props.modelValue / 100).toLocaleString('en-NG')))
function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/[^\d.]/g, '')
  if (raw === '') return emit('update:modelValue', null)
  const major = Number(raw)
  if (Number.isNaN(major)) return
  emit('update:modelValue', Math.round(major * 100))
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="id" class="label">{{ label }}<span v-if="required" class="text-danger-500">*</span></label>
    <div class="relative">
      <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-ink-500">{{ currencySymbol ?? '₦' }}</span>
      <input :id="id" type="text" inputmode="decimal" :value="display" :placeholder="placeholder ?? '0'" :disabled="disabled" :class="cn('field pl-9 tabular-nums', error && 'field-error')" @input="onInput" />
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-danger-500" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ink-500">{{ hint }}</p>
  </div>
</template>
