<script setup lang="ts">
import { useId } from 'vue'
import { AppleLogo, GooglePlayLogo } from '@/components/brand/StoreLogos'
import { APP_STORE_LINKS } from '@/config/app'

// "Download the app" banner used on Home ("Events Don't Wait…") and Hire Vendors ("For Professionals…").
// Design at 1440px: 1192×511, 16px radius, pattern + hand-held phone art (copy removed from the export so the
// text stays live), 48/56 heading, white store buttons with a soft pink outline.
defineProps<{ lines: [string, string]; text: string; art: string }>()
const titleId = useId()
</script>

<template>
  <section class="container-app" :aria-labelledby="titleId">
    <!-- On phones the art's pattern-only left edge doubles as the card background behind the copy. -->
    <div class="relative flex flex-col overflow-hidden rounded-2xl bg-[#f5e8f5] bg-cover bg-left md:min-h-[511px] md:flex-row md:items-center" :style="{ backgroundImage: `url(${art})` }">
      <img :src="art" alt="" width="1192" height="511" loading="lazy" decoding="async" class="order-last h-64 w-full object-cover object-[88%_50%] sm:h-80 md:absolute md:inset-0 md:order-none md:h-full md:object-right" />
      <div class="relative px-6 pb-4 pt-10 md:max-w-[560px] md:py-12 md:pl-11 md:pr-0">
        <h2 :id="titleId" class="text-[32px] leading-10 tracking-normal text-[#333740] md:text-[48px] md:leading-[56px]">{{ lines[0] }}<br />{{ lines[1] }}</h2>
        <p class="mt-[18px] max-w-[500px] text-base leading-6 text-[#333740]">{{ text }}</p>
        <div class="mt-8 flex flex-wrap gap-[17px]">
          <a :href="APP_STORE_LINKS.android" target="_blank" rel="noopener noreferrer" class="inline-flex h-12 items-center gap-2.5 rounded-lg border border-[#e0b0d8] bg-white px-5 text-base font-medium text-[#333740] transition-colors hover:border-brand-400 hover:bg-brand-50">
            <GooglePlayLogo class="h-5 w-5" /> GooglePlay
          </a>
          <a :href="APP_STORE_LINKS.ios" target="_blank" rel="noopener noreferrer" class="inline-flex h-12 items-center gap-2.5 rounded-lg border border-[#e0b0d8] bg-white px-5 text-base font-medium text-[#333740] transition-colors hover:border-brand-400 hover:bg-brand-50">
            <AppleLogo class="h-5 w-5" /> App Store
          </a>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>
</template>
