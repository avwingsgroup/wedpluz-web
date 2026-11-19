<script setup lang="ts">
import logoUrl from '@/assets/brand/wedpluz-logo.png'

/**
 * Wedpluz wordmark from the brand asset (src/assets/brand/wedpluz-logo.png, 115×38).
 * - `light` renders it white for dark surfaces (footer, admin sidebar), as in the designs.
 * - `iconOnly` crops to the "W" mark (collapsed admin sidebar).
 */
withDefaults(defineProps<{ variant?: 'dark' | 'light'; size?: 'sm' | 'md' | 'lg' | 'xl'; iconOnly?: boolean }>(), { variant: 'dark', size: 'md', iconOnly: false })

const heights = { sm: 'h-6', md: 'h-8', lg: 'h-10', xl: 'h-14' }
// The "W" mark occupies roughly the first 31% of the wordmark's width.
const iconWidths = { sm: 'w-[22px]', md: 'w-[30px]', lg: 'w-[37px]', xl: 'w-[52px]' }
</script>

<template>
  <span class="inline-flex shrink-0 select-none items-center overflow-hidden" :class="iconOnly ? iconWidths[size] : undefined" role="img" aria-label="Wedpluz">
    <img
      :src="logoUrl"
      alt=""
      width="115"
      height="38"
      draggable="false"
      class="block w-auto max-w-none"
      :class="[heights[size], variant === 'light' ? 'brightness-0 invert' : '']"
    />
  </span>
</template>
