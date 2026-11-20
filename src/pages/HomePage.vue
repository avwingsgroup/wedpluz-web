<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, ArrowUp, X } from 'lucide-vue-next'
import UiSearchBar from '@/components/ui/UiSearchBar.vue'
import UiSectionHeader from '@/components/ui/UiSectionHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import { InstantConfirmIcon, SecurePaymentIcon, VerifiedIcon } from '@/components/icons/FeatureIcons'
import AppDownloadBanner from '@/components/marketing/AppDownloadBanner.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import VendorCard from '@/modules/vendors/VendorCard.vue'
import { eventsApi } from '@/services/api/events.api'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAuthStore } from '@/stores/auth.store'
import { useSeo } from '@/composables/useSeo'
import { organizationLd, websiteLd } from '@/utils/structuredData'
import createManageEventsArt from '@/assets/illustrations/create-manage-events.webp'
import howDiscover from '@/assets/illustrations/how-discover.webp'
import howConnect from '@/assets/illustrations/how-connect.webp'
import howCreate from '@/assets/illustrations/how-create.webp'
import howAttend from '@/assets/illustrations/how-attend.webp'
import appBannerArt from '@/assets/illustrations/app-banner.webp'
import { cn } from '@/utils/cn'
import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'
import type { EventSummary, VendorSummary } from '@/types'

const router = useRouter()
const auth = useAuthStore()
useSeo({ jsonLd: [organizationLd(), websiteLd()] })

const upcoming = ref<EventSummary[]>([])
const popular = ref<EventSummary[]>([])
const promoted = ref<EventSummary[]>([])
const vendors = ref<VendorSummary[]>([])
const loading = ref(true)
const dismissed = ref<string[]>(safeStorage.getJSON(STORAGE_KEYS.dismissedBanners, []))
const showTop = ref(false)

onMounted(async () => {
  try {
    const [u, p, pr, v] = await Promise.all([eventsApi.upcoming(), eventsApi.popular(), auth.isAuthenticated ? eventsApi.promoted() : Promise.resolve([]), vendorsApi.featured()])
    upcoming.value = u
    popular.value = p
    promoted.value = pr
    vendors.value = v
  } finally {
    loading.value = false
  }
  window.addEventListener('scroll', () => (showTop.value = window.scrollY > 800), { passive: true })
})
function onSearch(q: string, location: string) {
  router.push({ name: 'events', query: { ...(q ? { search: q } : {}), ...(location ? { location } : {}) } })
}
function dismiss(key: string) {
  dismissed.value = [...dismissed.value, key]
  safeStorage.setJSON(STORAGE_KEYS.dismissedBanners, dismissed.value)
}
const showHost = computed(() => !dismissed.value.includes('host'))
const showVendor = computed(() => !dismissed.value.includes('vendor') && !auth.isVendor)
// "Discover Creative Professionals" cards: the first five featured vendors (backend note: headline + coverUrl).
const featuredPros = computed(() =>
  vendors.value.slice(0, 5).map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.businessName,
    label: v.headline || v.category.name,
    image: v.coverUrl ?? v.featuredWorks[0]?.thumbnailUrl ?? (v.featuredWorks[0]?.type === 'image' ? v.featuredWorks[0].url : null),
    avatarUrl: v.avatarUrl,
  })),
)
const features = [
  { icon: VerifiedIcon, title: 'Verified Events Only', text: 'Buy tickets exclusively from trusted organizers on Wedpluz. Your safety and security are our top priorities.' },
  { icon: SecurePaymentIcon, title: 'Secure Payments', text: 'Every ticket purchase is securely encrypted and safeguarded, ensuring your safety and peace of mind.' },
  { icon: InstantConfirmIcon, title: 'Instant Confirmation', text: 'No waiting. No middleman. Purchase your tickets straight from trusted organizers on Wedpluz.' },
]
// "How Wedpluz Works": app-screen illustrations extracted from the design handoff (homepage - individuals).
// The design shows Discover expanded and the other steps as narrow cards that crop their screens.
const steps = [
  { n: 1, title: 'Discover', text: 'Search vendors, venues, and events in your city or beyond.', image: howDiscover, width: 398, height: 388, alt: 'Wedpluz app Find Events screen' },
  { n: 2, title: 'Connect', text: 'Message organizers and vendors directly.', image: howConnect, width: 159, height: 386, alt: 'Wedpluz app messages screen' },
  { n: 3, title: 'Create', text: 'Publish your event and sell digital tickets.', image: howCreate, width: 159, height: 386, alt: 'Wedpluz app create event screen' },
  { n: 4, title: 'Attend', text: 'Check in with your QR ticket and enjoy.', image: howAttend, width: 159, height: 386, alt: 'Wedpluz app event ticket screen' },
]
function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <!-- ================= Logged-in home ================= -->
  <div v-if="auth.isAuthenticated" class="container-app pb-10 pt-10">
    <div class="mx-auto max-w-2xl"><UiSearchBar @search="onSearch" /></div>

    <section v-if="promoted.length || loading" class="mt-14">
      <UiSectionHeader title="Promote Events" badge="Premium" subtitle="Earn rewards by promoting events" :to="{ name: 'earn' }" />
      <EventGrid :events="promoted.slice(0, 4)" :loading="loading" variant="promote" :skeleton-count="4" empty-title="No promoted events right now" />
    </section>

    <section class="mt-14">
      <UiSectionHeader title="Upcoming events" :to="{ name: 'events', query: { sort: 'date' } }" />
      <EventGrid :events="upcoming.slice(0, 4)" :loading="loading" :skeleton-count="4" />
    </section>

    <section v-if="showHost || showVendor" class="mt-10 grid gap-5 md:grid-cols-2">
      <div v-if="showHost" class="relative overflow-hidden rounded-2xl bg-brand-100 p-6">
        <button type="button" class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-ink-500" aria-label="Dismiss" @click="dismiss('host')"><X class="h-3.5 w-3.5" /></button>
        <h3 class="text-xl">Host Your Event</h3>
        <p class="mt-1 text-sm text-ink-700">Create and manage your own events.</p>
        <UiButton class="mt-5" :to="{ name: 'manage.create' }">Create Event</UiButton>
        <svg class="absolute -right-2 bottom-0 h-28 w-40 text-brand-300" viewBox="0 0 160 110" fill="none" aria-hidden="true"><rect x="20" y="10" width="90" height="60" rx="6" stroke="currentColor" stroke-width="3" /><circle cx="130" cy="80" r="14" fill="currentColor" opacity=".5" /><path d="M30 95c20-30 60-30 80 0" stroke="currentColor" stroke-width="3" /></svg>
      </div>
      <div v-if="showVendor" class="relative overflow-hidden rounded-2xl bg-pink-100 p-6">
        <button type="button" class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-ink-500" aria-label="Dismiss" @click="dismiss('vendor')"><X class="h-3.5 w-3.5" /></button>
        <h3 class="text-xl">Become a Vendor</h3>
        <p class="mt-1 max-w-sm text-sm text-ink-700">Whether you’re an event planner, photographer, decorator, chef, DJ, etc. Let the right people find you.</p>
        <UiButton class="mt-5 !bg-pink-500 hover:!bg-pink-600" :to="{ name: 'business.create' }">Become a Vendor</UiButton>
        <svg class="absolute -right-2 bottom-0 h-28 w-32 text-pink-500" viewBox="0 0 130 110" fill="none" aria-hidden="true"><rect x="60" y="10" width="50" height="80" rx="8" stroke="currentColor" stroke-width="3" /><circle cx="30" cy="50" r="16" stroke="currentColor" stroke-width="3" /><path d="M20 100c5-20 25-20 30 0" stroke="currentColor" stroke-width="3" /></svg>
      </div>
    </section>

    <section class="mt-14">
      <UiSectionHeader title="Popular Events" :to="{ name: 'events', query: { sort: 'popularity' } }" />
      <EventGrid :events="popular.slice(0, 4)" :loading="loading" :skeleton-count="4" />
    </section>

    <section class="mt-14">
      <UiSectionHeader title="Hire a Vendor" :to="{ name: 'vendors' }" />
      <div class="grid gap-5 md:grid-cols-2">
        <template v-if="loading"><UiSkeleton v-for="i in 2" :key="i" class="h-64 rounded-2xl" /></template>
        <VendorCard v-for="v in vendors.slice(0, 2)" v-else :key="v.id" :vendor="v" variant="tile" />
      </div>
    </section>
  </div>

  <!-- ================= Guest landing ================= -->
  <div v-else>
    <!-- `isolate` keeps the decorative layer (-z-10) inside the hero instead of behind the page background. Clipping lives on that layer, not the section, so the search suggestions can extend below the hero (z-10 keeps them above the next sections). -->
    <section class="relative isolate z-10">
      <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <!-- Soft ribbons -->
        <svg class="absolute inset-0 h-full w-full" viewBox="0 0 1440 880" fill="none" preserveAspectRatio="xMidYMid slice">
          <g stroke="#fbf1ec" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
            <path d="M-40 20C90 110 200 170 240 290S330 480 520 470C690 460 740 340 690 250C640 160 520 150 430 70S330-60 300-80" />
            <path d="M940 900C1010 790 1110 700 1190 590S1240 340 1340 320S1470 360 1500 400" />
            <path d="M1500 560C1450 660 1380 760 1330 900" />
          </g>
        </svg>
        <!-- Left-edge speckled circle -->
        <span class="speckle-blob speckle-blob-lilac absolute -left-4 top-[41%] hidden h-10 w-10 sm:block md:h-12 md:w-12" />
        <!-- Giant watermark, cropped by the bottom of the hero -->
        <p class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[40%] select-none whitespace-nowrap font-display text-[28vw] font-semibold leading-none tracking-tight text-[#f3e6f3]">
          Wedpluz
          <span class="speckle-blob absolute left-[56%] top-[0.13em] h-[0.13em] w-[0.13em] max-h-14 max-w-14" />
        </p>
      </div>
      <div class="container-app flex flex-col items-center pb-[calc(14vw+6rem)] pt-24 text-center md:pt-48 xl:pt-60">
        <!-- Single line at every width, as in the design: fluid size from 22px (phones) to 56px (desktop). -->
        <h1 class="relative whitespace-nowrap text-[clamp(1.375rem,5.4vw,3.5rem)] font-bold leading-tight tracking-tight">
          <span class="speckle-blob absolute -top-[0.66em] left-1/2 -z-10 h-[0.92em] w-[0.92em] -translate-x-[78%]" aria-hidden="true" />
          Discover events in your area
        </h1>
        <p class="mt-3 max-w-xl text-sm text-ink-600 md:max-w-none md:whitespace-nowrap md:text-[15px]">Find, plan, discover vendors, and experience moments that connect you with friends and community</p>
        <div class="mt-8 w-full max-w-3xl"><UiSearchBar placeholder="Search events..." location-placeholder="Choose a location" @search="onSearch" /></div>
      </div>
    </section>

    <section class="container-app mt-12 md:mt-20">
      <UiSectionHeader title="Upcoming events" :to="{ name: 'events' }" link-label="See all events" />
      <EventGrid :events="upcoming.slice(0, 4)" :loading="loading" variant="compact" :skeleton-count="4" />
    </section>

    <section class="container-app mt-20">
      <div class="grid items-center gap-10 rounded-3xl bg-ink-50 p-8 md:grid-cols-2 md:p-14">
        <div>
          <h2 class="text-3xl md:text-4xl">Create &amp; Manage Your Own Events</h2>
          <p class="mt-2 text-ink-500">Planning something special? Stay organized with Wedpluz.</p>
          <ul class="mt-6 space-y-3 border-l-2 border-brand-600 pl-4 text-sm text-ink-700">
            <li>Plan your event and Create digital tickets</li>
            <li>Manage guests with ease</li>
            <li>Don’t have the time? Hire creative talents - event planners, Photographers, decorators, chef and more</li>
          </ul>
          <RouterLink :to="{ name: 'auth.signup' }" class="mt-6 inline-flex items-center gap-2 font-semibold text-brand-600 hover:underline">Get started <ArrowRight class="h-4 w-4" /></RouterLink>
        </div>
        <!-- Artwork extracted from the design handoff (homepage - individuals), transparent background. -->
        <img
          :src="createManageEventsArt"
          alt="Wedpluz cards: generate digital tickets, create memories and hire professionals"
          width="461"
          height="454"
          loading="lazy"
          decoding="async"
          class="mx-auto block h-auto w-full max-w-[461px] md:ml-auto md:mr-2"
        />
      </div>
    </section>

    <section class="mt-24 overflow-hidden">
      <div class="container-app text-center"><h2 class="mx-auto max-w-[780px] text-3xl leading-tight md:text-[48px] md:leading-[1.2] md:tracking-[-0.012em]">Discover Creative Professionals with Ease</h2><p class="mx-auto mt-4 max-w-[720px] text-base leading-6 text-ink-500">Find the right person that matches your needs. From event planners, to photographers, chefs, entertainers and even more vendors</p></div>
      <!-- Featured vendors from GET /vendors/featured. Design at 1440px: 300×325 cards tilted −1°, 319px apart, each 11px
           higher than the previous; the strip bleeds off both edges (the first card starts at the left edge). Phones scroll it. -->
      <ul
        v-if="loading || featuredPros.length"
        class="mt-14 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-6 pt-12 scrollbar-none md:mt-[52px] md:w-max md:snap-none md:gap-[19px] md:overflow-visible md:px-0 md:pb-0 md:pt-[44px] md:ml-[calc(50%-720px)]"
        aria-label="Featured vendors"
      >
        <template v-if="loading && !featuredPros.length">
          <li v-for="i in 5" :key="i" class="shrink-0" :style="{ transform: `translateY(${-11 * (i - 1)}px) rotate(-1deg)` }"><UiSkeleton class="h-[325px] w-[300px] rounded-2xl" /></li>
        </template>
        <li v-for="(p, i) in featuredPros" v-else :key="p.id" class="shrink-0 snap-start" :style="{ transform: `translateY(${-11 * i}px) rotate(-1deg)` }">
          <RouterLink :to="{ name: 'vendor', params: { slug: p.slug } }" class="group relative block h-[325px] w-[300px] overflow-hidden rounded-2xl bg-ink-800 shadow-sm transition-transform duration-300 hover:-translate-y-1.5 hover:rotate-1 focus-visible:-translate-y-1.5">
            <img v-if="p.image" :src="p.image" alt="" loading="lazy" decoding="async" class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <span class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#1a0419]/90 via-[#1a0419]/45 to-transparent" aria-hidden="true" />
            <span class="absolute bottom-[14px] left-[22px] right-4 flex items-center gap-3 text-white">
              <UiAvatar :src="p.avatarUrl" :name="p.name" class="h-[46px]! w-[46px]! rounded-full ring-2 ring-white" />
              <span class="min-w-0">
                <span class="block truncate text-[17px] font-medium leading-6">{{ p.label }}</span>
                <span class="mt-1.5 block truncate text-sm text-white/85">@{{ p.slug }}</span>
              </span>
            </span>
            <span class="sr-only">— {{ p.name }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <!-- Trust row. Design at 1440px: three 433px columns (centres 286/720/1153), 64px duo-tone icons, 20px titles. -->
    <section class="mx-auto mt-24 grid max-w-[1332px] gap-12 px-4 text-center md:mt-[122px] md:grid-cols-3 md:gap-0">
      <div v-for="f in features" :key="f.title" class="flex flex-col items-center">
        <component :is="f.icon" class="h-16 w-16" />
        <h3 class="mt-8 text-xl font-semibold leading-7 tracking-normal text-[#333740] md:mt-[51px]">{{ f.title }}</h3>
        <p class="mt-[18px] max-w-[290px] text-base leading-6 text-[#333740]">{{ f.text }}</p>
      </div>
    </section>

    <!-- Measured from the design at 1440px: 1194px content, Discover card 524×554, other cards 200 wide, 24px gaps. -->
    <section class="mt-24 bg-ink-50 pb-16 pt-[62px]" aria-labelledby="how-title">
      <div class="mx-auto max-w-[1226px] px-4">
        <div class="text-center">
          <h2 id="how-title" class="text-3xl leading-tight text-[#333740] md:text-[48px] md:leading-[1.2] md:tracking-[0.008em]">How Wedpluz Works</h2>
          <p class="mx-auto mt-4 max-w-[660px] text-base text-[#333740] md:text-xl md:leading-8">From finding the right vendor to creating your own event, we make the process smooth, fast, and fun.</p>
        </div>
        <ol class="-mx-4 mt-[41px] flex snap-x snap-mandatory scroll-px-4 gap-6 overflow-x-auto px-4 pb-2 scrollbar-none min-[1226px]:mx-0 min-[1226px]:overflow-visible min-[1226px]:px-0 min-[1226px]:pb-0">
          <li
            v-for="(s, i) in steps"
            :key="s.n"
            :class="cn('relative h-[554px] shrink-0 snap-start overflow-hidden rounded-2xl border', i === 0 ? 'w-[min(524px,calc(100vw-2rem))] border-[#b44db4]' : 'w-[200px] border-[#e6c3e6]')"
          >
            <div class="flex items-center gap-4 pl-6 pt-10">
              <span :class="cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[15px] font-medium', i === 0 ? 'bg-[#e6c3e6] text-brand-600' : 'bg-[#ecedee] text-[#333740]')" aria-hidden="true">{{ s.n }}</span>
              <h3 class="relative top-[2px] text-xl font-semibold tracking-normal text-[#333740]"><span class="sr-only">Step {{ s.n }}: </span>{{ s.title }}</h3>
            </div>
            <p :class="i === 0 ? 'ml-[70px] mt-[5px] pr-6 text-base text-[#333740]' : 'sr-only'">{{ s.text }}</p>
            <img
              :src="s.image"
              :alt="s.alt"
              :width="s.width"
              :height="s.height"
              loading="lazy"
              decoding="async"
              :class="i === 0 ? 'absolute bottom-0 left-1/2 h-auto w-[398px] max-w-[calc(100%-2rem)] -translate-x-1/2' : 'absolute bottom-0 right-0 h-auto w-[159px]'"
            />
          </li>
        </ol>
        <div class="mt-[41px] text-center"><UiButton size="lg" class="px-6! font-medium!" :to="{ name: 'auth.signup' }">Join the Experience</UiButton></div>
      </div>
    </section>

    <AppDownloadBanner class="mt-20 md:mt-[100px]" :lines="['Events Don’t Wait,', 'Neither Should You']" text="Download the Wedpluz app and discover events wherever you are." :art="appBannerArt" />
  </div>

  <button v-if="showTop" type="button" class="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-float" aria-label="Back to top" @click="scrollTop"><ArrowUp class="h-5 w-5" /></button>
</template>
