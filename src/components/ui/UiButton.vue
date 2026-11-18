<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link' | 'soft'
    size?: 'xs' | 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    to?: RouteLocationRaw
    href?: string
    iconOnly?: boolean
    rounded?: 'full' | 'xl'
  }>(),
  { variant: 'primary', size: 'md', type: 'button', block: false, loading: false, disabled: false, iconOnly: false, rounded: 'full' },
)

const classes = computed(() =>
  cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 select-none whitespace-nowrap',
    'focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    props.rounded === 'full' ? 'rounded-full' : 'rounded-xl',
    {
      primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm',
      secondary: 'bg-ink-100 text-ink-900 hover:bg-ink-200',
      soft: 'bg-brand-50 text-brand-600 hover:bg-brand-100 border border-brand-200',
      outline: 'border border-ink-200 bg-white text-ink-900 hover:border-ink-300 hover:bg-ink-50',
      ghost: 'text-ink-700 hover:bg-ink-100',
      danger: 'bg-danger-500 text-white hover:bg-danger-600',
      link: 'text-brand-600 hover:underline underline-offset-4 px-0 h-auto',
    }[props.variant],
    props.variant !== 'link' &&
      {
        xs: props.iconOnly ? 'h-8 w-8' : 'h-8 px-3 text-xs',
        sm: props.iconOnly ? 'h-9 w-9' : 'h-9 px-4 text-sm',
        md: props.iconOnly ? 'h-11 w-11' : 'h-11 px-6 text-sm',
        lg: props.iconOnly ? 'h-12 w-12' : 'h-12 px-8 text-base',
      }[props.size],
    props.block && 'w-full',
  ),
)
const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <RouterLink v-if="to && !isDisabled" :to="to" :class="classes">
    <slot />
  </RouterLink>
  <a v-else-if="href && !isDisabled" :href="href" :class="classes" target="_blank" rel="noopener noreferrer">
    <slot />
  </a>
  <button v-else :type="type" :class="classes" :disabled="isDisabled" :aria-busy="loading || undefined">
    <LoaderCircle v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
    <slot v-if="!(loading && iconOnly)" />
  </button>
</template>
