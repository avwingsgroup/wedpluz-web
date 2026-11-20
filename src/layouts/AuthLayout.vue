<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import BrandLogo from '@/components/brand/BrandLogo.vue'
import { useBanners } from '@/composables/useReferenceData'
import { cn } from '@/utils/cn'

const route = useRoute()

// Sign-up/login carousel: slides come from GET /banners?placement=onboarding (managed in the admin console's
// banner screen). The query is cached, so moving between sign-up and login doesn't refetch. If the call fails or
// returns nothing, a plain brand panel is shown and sign-up is never blocked.
const { data, isPending } = useBanners('onboarding')
const slides = computed(() => (data.value ?? []).filter((s) => !!s.imageUrl))
const active = ref(0)
watch(slides, (list) => {
  if (active.value >= list.length) active.value = 0
})

// Only the first photo loads up front (high priority); the rest load once it is on screen.
const firstLoaded = ref(false)

// ---- autoplay: 5s per slide; pauses on hover/focus, when the tab is hidden, and for reduced motion ----------------
const paused = ref(false)
const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
let timer: number | null = null
function schedule() {
  if (timer) window.clearInterval(timer)
  timer = null
  if (reducedMotion || slides.value.length < 2) return
  timer = window.setInterval(() => {
    if (!paused.value && !document.hidden) active.value = (active.value + 1) % slides.value.length
  }, 5000)
}
function goTo(i: number) {
  active.value = i
  schedule() // restart the interval so a manual choice gets a full 5 seconds
}
watch(() => slides.value.length, schedule)
onMounted(schedule)
onBeforeUnmount(() => timer && window.clearInterval(timer))
</script>

<template>
  <div class="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_45%]">
    <div class="relative flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <RouterLink :to="{ name: 'home' }" class="absolute left-6 top-6 lg:hidden"><BrandLogo size="sm" /></RouterLink>
      <div class="w-full max-w-md">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in"><div :key="String(route.name)"><component :is="Component" /></div></Transition>
        </RouterView>
      </div>
    </div>

    <!-- Design (onboarding, 1440px): photo panel 648px wide (45%), caption ~200px from the bottom, pill + dot indicators. -->
    <aside
      class="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 lg:block"
      role="region"
      aria-roledescription="carousel"
      aria-label="Wedpluz highlights"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
      @focusin="paused = true"
      @focusout="paused = false"
    >
      <!-- Brand panel: shown while loading and as the fallback when there are no slides. -->
      <div v-if="!slides.length" class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span class="speckle-blob absolute left-[12%] top-[18%] h-16 w-16 opacity-25" />
        <span class="speckle-blob speckle-blob-lilac absolute bottom-[20%] right-[14%] h-24 w-24 opacity-20" />
        <BrandLogo variant="light" size="xl" :class="cn('opacity-90 transition-opacity', isPending && 'animate-pulse')" />
      </div>

      <template v-else>
        <div
          v-for="(s, i) in slides"
          :key="s.id"
          role="group"
          aria-roledescription="slide"
          :aria-label="`${i + 1} of ${slides.length}`"
          :aria-hidden="i !== active"
          :class="cn('absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none', i === active ? 'opacity-100' : 'opacity-0')"
        >
          <img
            v-if="i === 0 || firstLoaded"
            :src="s.imageUrl!"
            alt=""
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : 'auto'"
            decoding="async"
            class="h-full w-full object-cover object-[center_top]"
            @load="i === 0 && (firstLoaded = true)"
          />
          <!-- The photos already include the design's dark fade; this only guards brighter future images. -->
          <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent" aria-hidden="true" />
        </div>

        <div class="absolute inset-x-0 bottom-[160px] flex flex-col items-center px-10 text-center text-white">
          <div :aria-live="paused || reducedMotion ? 'polite' : 'off'" aria-atomic="true">
            <h2 class="text-[32px] font-semibold leading-tight tracking-normal text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">{{ slides[active]?.title }}</h2>
            <p v-if="slides[active]?.subtitle" class="mx-auto mt-2 max-w-md text-base text-white/85 drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)]">{{ slides[active]?.subtitle }}</p>
          </div>
          <div v-if="slides.length > 1" class="mt-[30px] flex items-center gap-1.5">
            <button
              v-for="(s, i) in slides"
              :key="s.id"
              type="button"
              :aria-label="`Show slide ${i + 1}: ${s.title}`"
              :aria-current="i === active ? 'true' : undefined"
              :class="cn('h-[11px] rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white', i === active ? 'w-[27px] bg-brand-400' : 'w-[11px] bg-white/85 hover:bg-white')"
              @click="goTo(i)"
            />
          </div>
        </div>
      </template>
    </aside>
  </div>
</template>
