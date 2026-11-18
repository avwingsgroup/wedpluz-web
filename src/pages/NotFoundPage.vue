<script setup lang="ts">
import UiButton from '@/components/ui/UiButton.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { useSeo } from '@/composables/useSeo'
useSeo({ title: 'Page not found', noIndex: true })
</script>

<template>
  <div class="container-app py-16">
    <p class="text-center font-display text-7xl font-bold text-brand-200">404</p>
    <UiEmptyState title="We couldn’t find that page" description="The link may be broken or the page may have been removed." illustration="search">
      <div class="flex gap-3"><UiButton :to="{ name: 'home' }">Go home</UiButton><UiButton variant="outline" :to="{ name: 'events' }">Browse events</UiButton></div>
    </UiEmptyState>
  </div>
</template>
