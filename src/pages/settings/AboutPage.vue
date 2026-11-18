<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { env } from '@/config/env'
</script>

<template>
  <div>
    <h2 class="text-3xl">About Wedpluz</h2>
    <div class="mt-6 flex flex-col items-center rounded-2xl bg-ink-50 p-8 text-center"><BrandLogo size="lg" /><p class="mt-3 max-w-md text-sm text-ink-500">Connect with vendors, create events and experience life’s special moments.</p><p class="mt-2 text-xs text-ink-400">Version {{ env.appVersion }}</p></div>
    <div class="mt-6 divide-y divide-ink-100">
      <RouterLink v-for="l in [['about', 'About us'], ['terms', 'Terms and conditions'], ['privacy', 'Privacy policy'], ['faqs', 'FAQs']]" :key="l[0]" :to="{ name: l[0] }" class="flex items-center justify-between px-3 py-4 hover:bg-ink-50"><span>{{ l[1] }}</span><ChevronRight class="h-4 w-4" /></RouterLink>
    </div>
  </div>
</template>
