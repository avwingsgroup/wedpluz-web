<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, BadgeCheck, Bot, CalendarCheck, Check, HeartHandshake, MapPin, MessagesSquare, QrCode, Scale, Search, ShieldCheck, Store, Ticket, Users } from 'lucide-vue-next'
import PageHero from '@/components/marketing/PageHero.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { usePublicConfig } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import { useSeo } from '@/composables/useSeo'
import { breadcrumbLd, organizationLd } from '@/utils/structuredData'
import { staticPageFor } from '@/config/seo'
import { sanitizeRichText } from '@/utils/sanitize'
import { isAuthoredCms } from '@/utils/cmsContent'
import createManageEventsArt from '@/assets/illustrations/create-manage-events.webp'
import howDiscover from '@/assets/illustrations/how-discover.webp'

const auth = useAuthStore()
const { data: config } = usePublicConfig()
const supportEmail = computed(() => config.value?.support.email || 'support@wedpluz.com')

// "Our story" comes from the CMS once the team has written it; the built-in copy is shown until then.
const { data: cms } = useAsync(() => accountApi.page('about'))
const storyHtml = computed(() => (cms.value && isAuthoredCms(cms.value.content, 200) ? sanitizeRichText(cms.value.content) : null))

const features = [
  { icon: Search, title: 'Discover events', text: 'Find concerts, weddings, meetups, festivals and more near you or online, filtered by date, venue and interests.', to: { name: 'events' } },
  { icon: Ticket, title: 'Digital tickets', text: 'Pay securely and get a QR ticket instantly, with reminders, transfers and cancellations handled in the app.', to: { name: 'events' } },
  { icon: Store, title: 'Hire trusted vendors', text: 'Browse photographers, caterers, planners, decorators and rentals with real portfolios, ratings and reviews.', to: { name: 'vendors' } },
  { icon: CalendarCheck, title: 'Run your events', text: 'Publish events, sell tickets, approve guests, assign managers and vendors, and check guests in at the door.', to: { name: 'manage.create' } },
  { icon: MessagesSquare, title: 'Event communities', text: 'Every event gets a community for updates, chats, statuses and live moments with the people attending.', to: { name: 'events' } },
  { icon: Bot, title: 'Pluz planner', text: 'Plan menus, halls, seating and designs with an assistant that helps you turn ideas into a plan.', to: { name: 'planner' } },
]

const audiences = [
  {
    eyebrow: 'For individuals',
    title: 'Never miss a moment that matters',
    points: ['Discover events matched to your interests and city', 'Buy tickets in seconds and keep them in one place', 'Find and message vendors for your own celebrations', 'Join event communities and meet people before the day'],
    cta: { label: 'Explore events', to: { name: 'events' } },
  },
  {
    eyebrow: 'For businesses',
    title: 'Grow with the people planning events',
    points: ['Showcase your work to people actively planning events', 'Sell tickets with transparent fees and fast settlements', 'Manage guests, managers, tasks and check-in in one place', 'Reach new audiences through promoters and Premium visibility'],
    cta: { label: 'Register your work', to: { name: 'business.create' } },
  },
]

const steps = [
  { n: 1, title: 'Discover', text: 'Search events and vendors in your city or beyond.' },
  { n: 2, title: 'Connect', text: 'Message organisers and vendors directly.' },
  { n: 3, title: 'Create', text: 'Publish your event and sell digital tickets.' },
  { n: 4, title: 'Attend', text: 'Check in with your QR ticket and enjoy.' },
]

const values = [
  { icon: ShieldCheck, title: 'Trust by design', text: 'New events and vendor profiles are reviewed, payments go through licensed partners, and every ticket is verified by our servers at the door.' },
  { icon: Scale, title: 'Fair and transparent', text: 'Fees are shown before anyone pays. Organisers see every deduction, and settlements are released 3 days after an event ends.' },
  { icon: MapPin, title: 'Built for Nigeria', text: 'Naira pricing, local payment methods, Nigerian banks for payouts and support that understands how events happen here.' },
  { icon: HeartHandshake, title: 'People first', text: 'Real people answer support requests, reports are reviewed by our team, and your data is handled under the NDPA.' },
]

const trust = [
  { icon: BadgeCheck, text: 'Events reviewed before they go live' },
  { icon: ShieldCheck, text: 'Payments through licensed partners' },
  { icon: Store, text: 'Vendors verified by our team' },
  { icon: QrCode, text: 'Tickets verified at every scan' },
]

const meta = staticPageFor('/about')
useSeo({
  title: meta?.title,
  description: meta?.description,
  jsonLd: [organizationLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About us', path: '/about' }])],
})
</script>

<template>
  <div>
    <PageHero title="Bringing people together for life’s special moments" subtitle="Wedpluz is where events, the people who attend them and the vendors who make them happen come together — from discovery and tickets to the moment you walk through the door." crumb="About us" eyebrow="About Wedpluz" size="lg">
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <UiButton size="lg" :to="{ name: 'events' }">Explore events</UiButton>
        <UiButton size="lg" variant="outline" class="bg-white!" :to="auth.isAuthenticated ? { name: 'business.create' } : { name: 'auth.signup' }">{{ auth.isAuthenticated ? 'Become a vendor' : 'Join Wedpluz' }}</UiButton>
      </div>
      <ul class="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink-600">
        <li v-for="t in trust" :key="t.text" class="inline-flex items-center gap-2"><component :is="t.icon" class="h-4 w-4 text-brand-600" />{{ t.text }}</li>
      </ul>
    </PageHero>

    <div class="space-y-24 pb-24 md:space-y-32">
      <!-- mission + story -->
      <section class="container-app grid items-center gap-12 lg:grid-cols-2 lg:gap-20" aria-labelledby="mission-title">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Our mission</p>
          <h2 id="mission-title" class="mt-3 text-[32px] leading-tight tracking-normal text-[#333740] md:text-[40px]">Make every celebration easier to find, plan and enjoy</h2>
          <!-- eslint-disable-next-line vue/no-v-html -- storyHtml is sanitizeRichText() output -->
          <div v-if="storyHtml" class="about-story mt-6" v-html="storyHtml" />
          <div v-else class="about-story mt-6">
            <p>Great moments rarely come together by accident. Behind every wedding, concert, birthday or meetup are organisers juggling guest lists and ticket sales, vendors looking for their next client, and guests trying to find something worth showing up for.</p>
            <p>We built Wedpluz so all of that can happen in one trusted place. Attendees discover events and pay with confidence. Organisers sell tickets, manage guests and get paid on time. Vendors show their best work to the people who are actively planning.</p>
            <p>Everything is designed around trust: reviewed events, verified vendors, secure payments and tickets that are checked at the door — so people can focus on the moment itself.</p>
          </div>
        </div>
        <div class="relative">
          <div class="absolute inset-x-0 -inset-y-4 -z-10 rounded-[40px] bg-gradient-to-br from-brand-50 to-pink-50 sm:-inset-6" aria-hidden="true" />
          <img :src="createManageEventsArt" alt="Wedpluz cards for digital tickets, event memories and hiring professionals" width="461" height="454" loading="lazy" decoding="async" class="mx-auto h-auto w-full max-w-[461px]" />
        </div>
      </section>

      <!-- what you can do -->
      <section class="container-app" aria-labelledby="features-title">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">What Wedpluz does</p>
          <h2 id="features-title" class="mt-3 text-[32px] leading-tight tracking-normal text-[#333740] md:text-[40px]">Everything for your event, in one place</h2>
          <p class="mt-4 text-ink-600">One account for discovering, attending, hiring and hosting.</p>
        </div>
        <div class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <RouterLink v-for="f in features" :key="f.title" :to="f.to" class="group rounded-3xl border border-ink-200 bg-white p-7 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card">
            <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"><component :is="f.icon" class="h-6 w-6" /></span>
            <h3 class="mt-5 text-lg font-semibold tracking-normal text-ink-900">{{ f.title }}</h3>
            <p class="mt-2 text-[15px] leading-6 text-ink-600">{{ f.text }}</p>
            <span class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600">Learn more<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
          </RouterLink>
        </div>
      </section>

      <!-- audiences -->
      <section class="container-app grid gap-6 lg:grid-cols-2" aria-label="Who Wedpluz is for">
        <article v-for="(a, i) in audiences" :key="a.eyebrow" :class="i === 0 ? 'rounded-[32px] bg-brand-50 p-8 md:p-12' : 'rounded-[32px] bg-brand-950 p-8 text-white md:p-12'">
          <p :class="i === 0 ? 'text-sm font-semibold uppercase tracking-[0.12em] text-brand-600' : 'text-sm font-semibold uppercase tracking-[0.12em] text-brand-200'">{{ a.eyebrow }}</p>
          <h2 :class="i === 0 ? 'mt-3 text-[28px] leading-tight tracking-normal text-[#333740] md:text-[34px]' : 'mt-3 text-[28px] leading-tight tracking-normal text-white md:text-[34px]'">{{ a.title }}</h2>
          <ul class="mt-6 space-y-3">
            <li v-for="p in a.points" :key="p" class="flex items-start gap-3">
              <span :class="i === 0 ? 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white' : 'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-800'"><Check class="h-3 w-3" stroke-width="3" /></span>
              <span :class="i === 0 ? 'text-ink-700' : 'text-white/85'">{{ p }}</span>
            </li>
          </ul>
          <UiButton class="mt-8" :class="i === 1 && 'bg-white! text-brand-800! hover:bg-brand-50!'" :variant="i === 0 ? 'primary' : 'secondary'" :to="a.cta.to">{{ a.cta.label }}<ArrowRight class="h-4 w-4" /></UiButton>
        </article>
      </section>

      <!-- how it works -->
      <section class="bg-ink-50 py-20 md:py-24" aria-labelledby="how-about-title">
        <div class="container-app grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">How it works</p>
            <h2 id="how-about-title" class="mt-3 text-[32px] leading-tight tracking-normal text-[#333740] md:text-[40px]">From finding the right vendor to hosting your own event</h2>
            <ol class="mt-10 grid gap-6 sm:grid-cols-2">
              <li v-for="s in steps" :key="s.n" class="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04)]">
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">{{ s.n }}</span>
                <h3 class="mt-4 text-lg font-semibold tracking-normal text-ink-900">{{ s.title }}</h3>
                <p class="mt-1 text-[15px] text-ink-600">{{ s.text }}</p>
              </li>
            </ol>
          </div>
          <div class="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[#e6c3e6] bg-white px-6 pt-10">
            <p class="text-center text-sm font-medium text-ink-500">The Wedpluz app</p>
            <img :src="howDiscover" alt="Wedpluz app Find Events screen" width="398" height="388" loading="lazy" decoding="async" class="mx-auto mt-6 h-auto w-full max-w-[360px]" />
          </div>
        </div>
      </section>

      <!-- values -->
      <section class="container-app" aria-labelledby="values-title">
        <div class="mx-auto max-w-2xl text-center">
          <p class="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">What we stand for</p>
          <h2 id="values-title" class="mt-3 text-[32px] leading-tight tracking-normal text-[#333740] md:text-[40px]">The principles behind every feature</h2>
        </div>
        <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <article v-for="v in values" :key="v.title" class="rounded-3xl border border-ink-200 p-7">
            <component :is="v.icon" class="h-7 w-7 text-brand-600" />
            <h3 class="mt-5 text-lg font-semibold tracking-normal text-ink-900">{{ v.title }}</h3>
            <p class="mt-2 text-[15px] leading-6 text-ink-600">{{ v.text }}</p>
          </article>
        </div>
      </section>

      <!-- closing CTA -->
      <section class="container-app">
        <div class="relative overflow-hidden rounded-[32px] bg-brand-950 px-8 py-14 text-center text-white md:px-16 md:py-20">
          <div class="absolute inset-0 opacity-40" aria-hidden="true">
            <span class="speckle-blob absolute left-[8%] top-[20%] h-16 w-16 opacity-30" />
            <span class="speckle-blob absolute bottom-[15%] right-[10%] h-24 w-24 opacity-20" />
          </div>
          <Users class="relative mx-auto h-10 w-10 text-brand-200" />
          <h2 class="relative mx-auto mt-5 max-w-2xl text-[32px] leading-tight tracking-normal text-white md:text-[44px]">Ready to make your next moment happen?</h2>
          <p class="relative mx-auto mt-4 max-w-xl text-white/75">Join Wedpluz to discover events, hire vendors and host your own — or reach out to talk about partnerships.</p>
          <div class="relative mt-8 flex flex-wrap justify-center gap-3">
            <UiButton size="lg" class="bg-white! text-brand-800! hover:bg-brand-50!" :to="auth.isAuthenticated ? { name: 'events' } : { name: 'auth.signup' }">{{ auth.isAuthenticated ? 'Explore events' : 'Create your free account' }}</UiButton>
            <a :href="`mailto:${supportEmail}?subject=${encodeURIComponent('Partnership enquiry')}`" class="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 font-medium hover:bg-white/10">Partner with us</a>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.about-story {
  color: #4a4e57;
  font-size: 17px;
  line-height: 1.8;
}
.about-story :deep(p + p) {
  margin-top: 1rem;
}
.about-story :deep(h2),
.about-story :deep(h3) {
  margin-top: 1.5rem;
  color: #333740;
  font-weight: 600;
}
.about-story :deep(a) {
  color: var(--color-brand-600);
  text-decoration: underline;
}
</style>
