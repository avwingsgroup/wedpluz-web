<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Facebook, Instagram } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { AppleLogo, GooglePlayLogo } from '@/components/brand/StoreLogos'
import { SOCIAL_LINKS } from '@/config/app'
import { env } from '@/config/env'
import { storeLinkForDevice } from '@/utils/appStore'

const year = new Date().getFullYear()
const storeLink = ref(storeLinkForDevice())
// Generated locally (no third-party QR service); the library is loaded lazily after first paint.
// The QR opens /app, which forwards phones to their store.
const qrUrl = ref<string | null>(null)
onMounted(async () => {
  try {
    const { default: QRCode } = await import('qrcode')
    qrUrl.value = await QRCode.toDataURL(`${env.webOrigin}/app`, { width: 224, margin: 0 })
  } catch {
    qrUrl.value = null
  }
})

const columns = [
  {
    title: 'Wedpluz',
    links: [
      { label: 'About us', to: { name: 'about' } },
      { label: 'Contact us', to: { name: 'help' } },
      { label: 'Faqs', to: { name: 'faqs' } },
      { label: 'Help center', to: { name: 'help' } },
    ],
  },
  {
    title: 'Discover',
    links: [
      { label: 'Create event', to: { name: 'manage.create' } },
      { label: 'My tickets', to: { name: 'tickets' } },
      { label: 'Register your work', to: { name: 'business.create' } },
    ],
  },
]
</script>

<!-- Measured from the design at 1440px: 1192px content; link columns start 609px and 962px from the left edge;
     40px link rhythm; 394×156 download card; bottom bar flush with the page bottom. -->
<template>
  <footer class="plum-footer mt-16 text-white">
    <div class="container-app grid gap-12 pt-14 md:grid-cols-2 lg:grid-cols-[minmax(0,609fr)_minmax(0,353fr)_minmax(0,230fr)] lg:gap-0 lg:pt-[58px]">
      <div class="md:col-span-2 lg:col-span-1">
        <RouterLink :to="{ name: 'home' }" class="inline-block rounded-md lg:mt-[25px]" aria-label="Wedpluz home">
          <BrandLogo variant="light" size="lg" class="[&_img]:h-[35px]" />
        </RouterLink>
        <p class="mt-[19px] max-w-[320px] text-base leading-6 text-white/90">Connect with Vendors, create events and experience life’s special moments.</p>
        <ul class="mt-[14px] flex gap-3" aria-label="Wedpluz on social media">
          <li><a :href="SOCIAL_LINKS.facebook" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 transition-colors hover:bg-white/30"><Facebook class="h-[18px] w-[18px]" fill="currentColor" stroke-width="0" /></a></li>
          <li><a :href="SOCIAL_LINKS.instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 transition-colors hover:bg-white/30"><Instagram class="h-[18px] w-[18px]" /></a></li>
          <li>
            <a :href="SOCIAL_LINKS.x" target="_blank" rel="noopener noreferrer" aria-label="X" class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 transition-colors hover:bg-white/30">
              <svg viewBox="0 0 24 24" class="h-3 w-3" fill="currentColor" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.48l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z" /></svg>
            </a>
          </li>
        </ul>

        <div id="get-the-app" class="mt-10 flex w-full max-w-[394px] scroll-mt-28 gap-[18px] rounded-xl bg-white/10 p-3 lg:mt-[57px]">
          <div class="flex h-[130px] w-[128px] shrink-0 items-center justify-center rounded-xl bg-white p-2.5">
            <img v-if="qrUrl" :src="qrUrl" alt="QR code to download the Wedpluz app" width="108" height="108" class="h-full w-full object-contain" />
          </div>
          <div class="min-w-0 pt-[3px]">
            <p class="text-base font-semibold leading-6">Download the app now</p>
            <p class="mt-1 max-w-[200px] text-xs leading-5 text-white/85">Scan the bar code to download the Wedpluz app.</p>
            <a :href="storeLink" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex h-12 w-full max-w-[198px] items-center justify-center gap-2.5 rounded-lg border border-white/80 px-4 text-sm transition-colors hover:bg-white/10">
              <AppleLogo class="h-4 w-4" />
              <span class="h-4 w-px bg-white/60" aria-hidden="true" />
              <GooglePlayLogo mono class="h-4 w-4" />
              <span class="ml-1">Download App</span>
            </a>
          </div>
        </div>
      </div>

      <nav v-for="col in columns" :key="col.title" :aria-label="col.title">
        <p class="font-footer-heading text-base font-bold leading-6">{{ col.title }}</p>
        <ul class="mt-4 space-y-4 font-footer text-base leading-6 text-white">
          <li v-for="l in col.links" :key="l.label"><RouterLink :to="l.to" class="hover:underline">{{ l.label }}</RouterLink></li>
        </ul>
      </nav>
    </div>

    <div class="container-app mt-16 lg:mt-[99px]">
      <div class="flex flex-col gap-3 rounded-t-2xl bg-white/10 px-4 py-6 font-footer text-base sm:flex-row sm:items-center sm:justify-between sm:py-[28px]">
        <div class="flex gap-4"><RouterLink :to="{ name: 'terms' }" class="hover:underline">Terms and conditions</RouterLink><RouterLink :to="{ name: 'privacy' }" class="hover:underline">Privacy policy</RouterLink></div>
        <p>© {{ year }} Wedpluz. All rights reserved</p>
      </div>
    </div>
  </footer>
</template>
