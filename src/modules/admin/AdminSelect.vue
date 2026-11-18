<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
/** Compact pill select for filter bars. */
defineProps<{ modelValue: string; options: Array<{ label: string; value: string }>; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <label class="relative inline-flex">
    <span class="sr-only">{{ label }}</span>
    <select :value="modelValue" class="h-10 appearance-none rounded-full border border-ink-200 bg-white py-0 pl-4 pr-9 text-sm text-ink-700 focus:border-brand-600 focus:ring-0" @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <ChevronDown class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
  </label>
</template>
