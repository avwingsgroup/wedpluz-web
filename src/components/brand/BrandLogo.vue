<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' | 'xl'; iconOnly?: boolean }>(), { variant: 'dark', size: 'md', iconOnly: false })
const heights = { sm: 'h-6', md: 'h-8', lg: 'h-10', xl: 'h-14' }
</script>

<template>
  <span class="inline-flex items-center gap-0.5 select-none" aria-label="Wedpluz">
    <svg :class="heights[size]" viewBox="0 0 64 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="wp-w" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff2bb0" />
          <stop offset="1" stop-color="#9b119b" />
        </linearGradient>
      </defs>
      <path d="M6 16 L18 50 L32 26 L46 50 L58 16" stroke="url(#wp-w)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="14" cy="8" r="2.2" fill="#ff2bb0" />
      <circle cx="22" cy="4" r="1.6" fill="#ffb3e6" />
      <circle cx="30" cy="9" r="1.4" fill="#9b119b" />
      <circle cx="40" cy="5" r="1.8" fill="#ff2bb0" />
      <circle cx="48" cy="10" r="1.3" fill="#ffb3e6" />
      <circle cx="8" cy="30" r="1.2" fill="#ffb3e6" />
    </svg>
    <span
      v-if="!iconOnly"
      class="font-display font-bold tracking-tight -ml-1"
      :class="[variant === 'light' ? 'text-white' : 'text-ink-900', size === 'sm' ? 'text-base' : size === 'md' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-4xl']"
    >edpluz</span>
  </span>
</template>
