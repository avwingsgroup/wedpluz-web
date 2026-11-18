<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Facebook, Instagram, Smartphone } from 'lucide-vue-next'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { APP_STORE_LINKS, SOCIAL_LINKS } from '@/config/app'
import { env } from '@/config/env'
const year = new Date().getFullYear()
// Generated locally (no third-party QR service); the library is loaded lazily after first paint.
const qrUrl = ref<string | null>(null)
onMounted(async () => {
  try {
    const { default: QRCode } = await import('qrcode')
    qrUrl.value = await QRCode.toDataURL(`${env.webOrigin}/app`, { width: 224, margin: 1 })
  } catch {
    qrUrl.value = null
  }
})
</script>

<template>
  <footer class="plum-footer mt-16 text-white">
    <div class="container-app grid gap-10 py-14 md:grid-cols-12">
      <div class="md:col-span-6">
        <BrandLogo variant="light" size="lg" />
        <p class="mt-4 max-w-sm text-sm text-white/80">Connect with Vendors, create events and experience life’s special moments.</p>
        <div class="mt-5 flex gap-2">
          <a :href="SOCIAL_LINKS.facebook" target="_blank" rel="noopener noreferrer" aria-label="Facebook" class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"><Facebook class="h-4 w-4" /></a>
          <a :href="SOCIAL_LINKS.instagram" target="_blank" rel="noopener noreferrer" aria-label="Instagram" class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"><Instagram class="h-4 w-4" /></a>
          <a :href="SOCIAL_LINKS.x" target="_blank" rel="noopener noreferrer" aria-label="X" class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold hover:bg-white/25">𝕏</a>
        </div>
        <div class="mt-8 flex max-w-sm items-center gap-4 rounded-2xl bg-white/10 p-3">
          <img v-if="qrUrl" :src="qrUrl" alt="QR code to download the Wedpluz app" width="112" height="112" loading="lazy" class="h-28 w-28 rounded-xl bg-white p-1" />
          <div>
            <p class="font-semibold">Download the app now</p>
            <p class="mt-1 text-xs text-white/70">Scan the bar code to download the Wedpluz app.</p>
            <div class="mt-3 flex gap-2">
              <a :href="APP_STORE_LINKS.ios" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-xl border border-white/30 px-3 py-2 text-xs hover:bg-white/10"><Smartphone class="h-4 w-4" /> Download App</a>
            </div>
          </div>
        </div>
      </div>
      <div class="md:col-span-3">
        <p class="font-semibold">Wedpluz</p>
        <ul class="mt-4 space-y-3 text-sm text-white/85">
          <li><RouterLink :to="{ name: 'about' }" class="hover:underline">About us</RouterLink></li>
          <li><RouterLink :to="{ name: 'help' }" class="hover:underline">Contact us</RouterLink></li>
          <li><RouterLink :to="{ name: 'faqs' }" class="hover:underline">Faqs</RouterLink></li>
          <li><RouterLink :to="{ name: 'help' }" class="hover:underline">Help center</RouterLink></li>
        </ul>
      </div>
      <div class="md:col-span-3">
        <p class="font-semibold">Discover</p>
        <ul class="mt-4 space-y-3 text-sm text-white/85">
          <li><RouterLink :to="{ name: 'manage.create' }" class="hover:underline">Create event</RouterLink></li>
          <li><RouterLink :to="{ name: 'tickets' }" class="hover:underline">My tickets</RouterLink></li>
          <li><RouterLink :to="{ name: 'business.create' }" class="hover:underline">Register your work</RouterLink></li>
          <li><RouterLink :to="{ name: 'events' }" class="hover:underline">All events</RouterLink></li>
        </ul>
      </div>
    </div>
    <div class="container-app pb-6">
      <div class="flex flex-col gap-3 rounded-t-2xl bg-white/10 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div class="flex gap-4"><RouterLink :to="{ name: 'terms' }" class="hover:underline">Terms and conditions</RouterLink><RouterLink :to="{ name: 'privacy' }" class="hover:underline">Privacy policy</RouterLink></div>
        <p class="text-white/80">© {{ year }} Wedpluz. All rights reserved</p>
      </div>
    </div>
  </footer>
</template>
