<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, ArrowUp, ShieldCheck, CreditCard, Zap, X } from 'lucide-vue-next'
import UiSearchBar from '@/components/ui/UiSearchBar.vue'
import UiSectionHeader from '@/components/ui/UiSectionHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import EventGrid from '@/modules/events/EventGrid.vue'
import VendorCard from '@/modules/vendors/VendorCard.vue'
import { eventsApi } from '@/services/api/events.api'
import { vendorsApi } from '@/services/api/vendors.api'
import { useAuthStore } from '@/stores/auth.store'
import { useSeo } from '@/composables/useSeo'
import { ILLUSTRATIONS } from '@/assets/illustrations'
import { STORAGE_KEYS } from '@/config/app'
import { safeStorage } from '@/utils/storage'
import type { EventSummary, VendorSummary } from '@/types'

const router = useRouter()
const auth = useAuthStore()
useSeo({ title: 'Discover events in your area', description: 'Find, plan, discover vendors, and experience moments that connect you with friends and community.' })

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
const phoneImage = ILLUSTRATIONS.homePhone
const steps = [
  { n: 1, title: 'Discover', text: 'Search vendors, venues, and events in your city or beyond.' },
  { n: 2, title: 'Connect', text: 'Message organizers and vendors directly.' },
  { n: 3, title: 'Create', text: 'Publish your event and sell digital tickets.' },
  { n: 4, title: 'Attend', text: 'Check in with your QR ticket and enjoy.' },
]
const activeStep = ref(0)
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
    <section class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <svg class="absolute left-0 top-0 h-full w-full opacity-60" viewBox="0 0 1440 520" fill="none" preserveAspectRatio="none"><path d="M-50 120C200 40 400 220 650 140S1100 60 1500 160" stroke="#f3d9ef" stroke-width="2" /><path d="M-50 300C250 200 450 420 700 300s450-180 800-60" stroke="#f3d9ef" stroke-width="2" /></svg>
        <span class="absolute left-[8%] top-16 h-10 w-10 rounded-full bg-pink-100" /><span class="absolute right-[12%] top-28 h-14 w-14 rounded-full bg-brand-100" /><span class="absolute left-[30%] top-40 h-5 w-5 rounded-full bg-brand-200" />
        <p class="absolute -bottom-24 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[220px] font-bold leading-none text-brand-100/70 md:text-[320px]">Wedpluz</p>
      </div>
      <div class="container-app flex flex-col items-center pb-40 pt-24 text-center md:pt-32">
        <h1 class="max-w-3xl text-4xl md:text-6xl">Discover events in your area</h1>
        <p class="mt-4 max-w-xl text-ink-500">Find, plan, discover vendors, and experience moments that connect you with friends and community</p>
        <div class="mt-8 w-full max-w-2xl"><UiSearchBar placeholder="Search events..." location-placeholder="Choose a location" @search="onSearch" /></div>
      </div>
    </section>

    <section class="container-app">
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
        <div class="relative mx-auto w-full max-w-md -rotate-3">
          <div v-for="(card, i) in [['Generate Digital tickets', 'bg-brand-600'], ['Create Memories', 'bg-success-600'], ['Hire Professionals', 'bg-pink-500']]" :key="i" :class="['mb-3 flex items-center justify-between rounded-2xl p-5 text-white shadow-float', card[1]]"><span class="text-lg font-semibold">{{ card[0] }}</span><span class="h-14 w-20 rounded-lg bg-white/25" /></div>
        </div>
      </div>
    </section>

    <section class="mt-24 overflow-hidden">
      <div class="container-app text-center"><h2 class="text-3xl md:text-4xl">Discover Creative Professionals with Ease</h2><p class="mx-auto mt-3 max-w-xl text-ink-500">Find the right person that matches your needs. From event planners, to photographers, chefs, entertainers and even more vendors</p></div>
      <div class="mt-10 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-none md:justify-center">
        <RouterLink v-for="p in ILLUSTRATIONS.professionals" :key="p.handle" :to="{ name: 'vendors' }" class="group relative h-72 w-52 shrink-0 overflow-hidden rounded-2xl bg-ink-100 odd:-rotate-2 even:rotate-2 transition-transform hover:rotate-0">
          <img :src="p.image" :alt="p.label" loading="lazy" class="h-full w-full object-cover transition-transform group-hover:scale-105" />
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 p-4 text-white"><p class="font-semibold">{{ p.label }}</p><p class="text-xs text-white/80">{{ p.handle }}</p></div>
        </RouterLink>
      </div>
    </section>

    <section class="container-app mt-24 grid gap-10 text-center md:grid-cols-3">
      <div v-for="f in [{ icon: ShieldCheck, title: 'Verified Events Only', text: 'Buy tickets exclusively from trusted organizers on Wedpluz. Your safety and security are our top priorities.' }, { icon: CreditCard, title: 'Secure Payments', text: 'Every ticket purchase is securely encrypted and safeguarded, ensuring your safety and peace of mind.' }, { icon: Zap, title: 'Instant Confirmation', text: 'No waiting. No middleman. Purchase your tickets straight from trusted organizers on Wedpluz.' }]" :key="f.title">
        <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600"><component :is="f.icon" class="h-6 w-6" /></span>
        <h3 class="mt-4 text-lg">{{ f.title }}</h3>
        <p class="mt-2 text-sm text-ink-500">{{ f.text }}</p>
      </div>
    </section>

    <section class="mt-24 bg-ink-50 py-20">
      <div class="container-app text-center"><h2 class="text-3xl md:text-4xl">How Wedpluz Works</h2><p class="mx-auto mt-3 max-w-xl text-ink-500">From finding the right vendor to creating your own event, we make the process smooth, fast, and fun.</p></div>
      <div class="container-app mt-10 flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        <button v-for="(s, i) in steps" :key="s.n" type="button" :class="['shrink-0 rounded-2xl border bg-white p-6 text-left transition-all', activeStep === i ? 'w-80 border-brand-400 shadow-card' : 'w-44 border-ink-200 opacity-80 hover:opacity-100']" @click="activeStep = i">
          <div class="flex items-center gap-3"><span :class="['flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold', activeStep === i ? 'bg-brand-100 text-brand-600' : 'bg-ink-100 text-ink-500']">{{ s.n }}</span><span class="font-semibold">{{ s.title }}</span></div>
          <p v-if="activeStep === i" class="mt-2 text-sm text-ink-500">{{ s.text }}</p>
          <div class="mt-6 h-40 rounded-t-3xl border-x-4 border-t-4 border-ink-200 bg-ink-50" />
        </button>
      </div>
      <div class="mt-8 text-center"><UiButton :to="{ name: 'auth.signup' }">Join the Experience</UiButton></div>
    </section>

    <section class="container-app mt-20">
      <div class="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand-100 p-8 md:grid-cols-2 md:p-14">
        <div><h2 class="text-3xl md:text-4xl">Events Don’t Wait,<br />Neither Should You</h2><p class="mt-3 text-ink-700">Download the Wedpluz app and discover events wherever you are.</p>
          <div class="mt-6 flex flex-wrap gap-3"><UiButton variant="outline" href="https://play.google.com/store/apps/details?id=com.wedpluz.app" rounded="xl">▶ GooglePlay</UiButton><UiButton variant="outline" href="https://apps.apple.com/app/wedpluz" rounded="xl"> App Store</UiButton></div>
        </div>
        <img :src="phoneImage" alt="Wedpluz mobile app" loading="lazy" class="mx-auto max-h-80 rounded-2xl object-cover shadow-float" />
      </div>
    </section>
  </div>

  <button v-if="showTop" type="button" class="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-float" aria-label="Back to top" @click="scrollTop"><ArrowUp class="h-5 w-5" /></button>
</template>
