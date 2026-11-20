<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ChevronRight } from 'lucide-vue-next'
import { cn } from '@/utils/cn'

// Hero band for the information pages (About, FAQs, Help center, Terms, Privacy). Shares the home hero's visual
// language: soft lilac wash, speckled blobs and a faint brand ribbon, with a breadcrumb for orientation.
withDefaults(defineProps<{ title: string; subtitle?: string; eyebrow?: string; crumb: string; align?: 'center' | 'left'; size?: 'md' | 'lg' }>(), { align: 'center', size: 'md' })
</script>

<template>
  <section :class="cn('relative isolate', size === 'lg' ? 'pb-16 pt-10 md:pb-24 md:pt-14' : 'pb-12 pt-8 md:pb-16 md:pt-12')">
    <div class="absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-brand-50 via-[#fdf8fd] to-white" aria-hidden="true">
      <svg class="absolute -left-24 top-6 h-[360px] w-[720px] text-brand-200/50" viewBox="0 0 720 360" fill="none">
        <path d="M0 250C120 120 260 330 380 210S600 40 720 120" stroke="currentColor" stroke-width="28" stroke-linecap="round" />
      </svg>
      <svg class="absolute -right-32 bottom-0 h-[300px] w-[640px] text-pink-100/70" viewBox="0 0 640 300" fill="none">
        <path d="M0 220C140 90 300 280 420 160S580 30 640 70" stroke="currentColor" stroke-width="22" stroke-linecap="round" />
      </svg>
      <span class="speckle-blob absolute left-[8%] top-[22%] h-10 w-10 opacity-70" />
      <span class="speckle-blob speckle-blob-lilac absolute right-[10%] top-[18%] h-6 w-6 opacity-80" />
      <span class="speckle-blob absolute bottom-[14%] right-[22%] h-4 w-4 opacity-60" />
    </div>

    <div :class="cn('container-app', align === 'center' && 'text-center')">
      <nav aria-label="Breadcrumb">
        <ol :class="cn('flex items-center gap-1.5 text-sm text-ink-500', align === 'center' && 'justify-center')">
          <li><RouterLink :to="{ name: 'home' }" class="hover:text-brand-600">Home</RouterLink></li>
          <li aria-hidden="true"><ChevronRight class="h-3.5 w-3.5" /></li>
          <li aria-current="page" class="font-medium text-ink-700">{{ crumb }}</li>
        </ol>
      </nav>
      <p v-if="eyebrow" :class="cn('mt-6 inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 shadow-sm ring-1 ring-brand-100')">{{ eyebrow }}</p>
      <h1 :class="cn('text-[34px] leading-tight text-[#333740] md:text-[48px] md:leading-[1.15]', eyebrow ? 'mt-4' : 'mt-6', align === 'center' && 'mx-auto max-w-3xl')">{{ title }}</h1>
      <p v-if="subtitle" :class="cn('mt-4 text-base text-ink-600 md:text-lg', align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl')">{{ subtitle }}</p>
      <slot />
    </div>
  </section>
</template>
