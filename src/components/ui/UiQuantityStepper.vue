<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
withDefaults(defineProps<{ modelValue: number; min?: number; max?: number; disabled?: boolean; label?: string }>(), { min: 0, max: 99 })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<template>
  <div class="inline-flex items-center gap-2 rounded-full bg-ink-50 p-1" role="group" :aria-label="label ?? 'Quantity'">
    <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition hover:border-ink-300 disabled:opacity-40" :disabled="disabled || modelValue <= min" aria-label="Decrease" @click="emit('update:modelValue', modelValue - 1)"><Minus class="h-4 w-4" /></button>
    <span class="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{{ modelValue }}</span>
    <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition hover:border-ink-300 disabled:opacity-40" :disabled="disabled || modelValue >= max" aria-label="Increase" @click="emit('update:modelValue', modelValue + 1)"><Plus class="h-4 w-4" /></button>
  </div>
</template>
