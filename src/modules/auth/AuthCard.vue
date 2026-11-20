<script setup lang="ts">
import BrandLogo from '@/components/brand/BrandLogo.vue'
defineProps<{ title: string; subtitle?: string; logo?: boolean }>()
</script>

<template>
  <div class="rounded-3xl bg-white p-6 shadow-[0_20px_60px_-30px_rgba(39,4,39,0.25)] sm:p-8">
    <div class="text-center">
      <RouterLink v-if="logo" :to="{ name: 'home' }" class="mb-4 inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600" aria-label="Wedpluz home"><BrandLogo size="md" /></RouterLink>
      <h1 class="text-2xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-ink-500">{{ subtitle }}</p>
    </div>
    <div class="mt-6"><slot /></div>
  </div>
  <div v-if="$slots.below" class="mt-6 text-center text-sm text-ink-500"><slot name="below" /></div>
</template>
