<script setup lang="ts">
import { computed, ref } from 'vue'
import { User } from 'lucide-vue-next'
import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'

const props = withDefaults(defineProps<{ src?: string | null; name?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'; online?: boolean; ring?: boolean; square?: boolean }>(), { size: 'md', online: undefined, ring: false, square: false })
const failed = ref(false)
const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl', '2xl': 'h-24 w-24 text-2xl' }
const showImage = computed(() => props.src && !failed.value)
</script>

<template>
  <span :class="cn('relative inline-flex shrink-0', sizes[size])">
    <img v-if="showImage" :src="src ?? undefined" :alt="name ?? ''" loading="lazy" :class="cn('h-full w-full object-cover', square ? 'rounded-xl' : 'rounded-full', ring && 'ring-2 ring-brand-600 ring-offset-2')" @error="failed = true" />
    <span v-else :class="cn('flex h-full w-full items-center justify-center bg-brand-100 font-semibold uppercase text-brand-700', square ? 'rounded-xl' : 'rounded-full', ring && 'ring-2 ring-brand-600 ring-offset-2')" :aria-label="name">
      <template v-if="name">{{ initials(name) }}</template>
      <User v-else class="h-1/2 w-1/2" />
    </span>
    <span v-if="online !== undefined" :class="cn('absolute bottom-0 right-0 block rounded-full border-2 border-white', size === 'xs' || size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3', online ? 'bg-success-500' : 'bg-ink-300')" />
  </span>
</template>
