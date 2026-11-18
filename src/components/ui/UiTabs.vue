<script setup lang="ts">
import { cn } from '@/utils/cn'

export interface TabItem {
  key: string
  label: string
  count?: number
  icon?: unknown
  disabled?: boolean
}

withDefaults(defineProps<{ modelValue: string; tabs: TabItem[]; variant?: 'underline' | 'pill' | 'segment' | 'stretch'; size?: 'sm' | 'md' }>(), { variant: 'underline', size: 'md' })
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()
</script>

<template>
  <div
    role="tablist"
    :class="cn(
      'flex gap-1 scrollbar-none overflow-x-auto',
      variant === 'underline' && 'border-b border-ink-200',
      variant === 'stretch' && 'border-b border-ink-200 w-full',
      variant === 'segment' && 'rounded-full bg-ink-100 p-1',
      variant === 'pill' && 'gap-2',
    )"
  >
    <button
      v-for="t in tabs"
      :key="t.key"
      role="tab"
      type="button"
      :aria-selected="modelValue === t.key"
      :disabled="t.disabled"
      :class="cn(
        'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:opacity-50',
        size === 'sm' ? 'text-sm' : 'text-sm md:text-[15px]',
        variant === 'underline' && cn('px-4 py-3 -mb-px border-b-2', modelValue === t.key ? 'border-brand-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900'),
        variant === 'stretch' && cn('flex-1 px-4 py-3 -mb-px border-b-2', modelValue === t.key ? 'border-brand-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900'),
        variant === 'pill' && cn('pill-tab', modelValue === t.key && 'pill-tab-active'),
        variant === 'segment' && cn('rounded-full px-4 py-1.5', modelValue === t.key ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-700 hover:text-ink-900'),
      )"
      @click="emit('update:modelValue', t.key)"
    >
      <component :is="t.icon" v-if="t.icon" class="h-4 w-4" />
      {{ t.label }}
      <span v-if="t.count !== undefined" :class="cn('rounded-full px-2 py-0.5 text-xs', modelValue === t.key ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500')">{{ t.count }}</span>
    </button>
  </div>
</template>
