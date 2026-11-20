<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowRight, Clock, CornerDownLeft, Inbox, Mail, MessageCircle, Phone, RotateCcw, Settings, ShieldAlert, Ticket, UserPlus, Wallet } from 'lucide-vue-next'
import PageHero from '@/components/marketing/PageHero.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import SupportForm from '@/modules/support/SupportForm.vue'
import HelpSearchInput from '@/modules/help/HelpSearchInput.vue'
import FaqAccordionItem from '@/modules/help/FaqAccordionItem.vue'
import { TOPIC_ICONS } from '@/modules/help/topicIcons'
import { FAQ_TOPICS, allFaqItems } from '@/content/faqs'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { usePublicConfig } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import { useSeo } from '@/composables/useSeo'
import { breadcrumbLd, faqLd } from '@/utils/structuredData'
import { staticPageFor } from '@/config/seo'
import { searchFaqs } from '@/utils/cmsContent'
import { highlightSegments } from '@/utils/highlight'
import { formatRelative } from '@/utils/format'
import { cn } from '@/utils/cn'

const router = useRouter()
const auth = useAuthStore()
const { data: config } = usePublicConfig()
const support = computed(() => ({
  email: config.value?.support.email || 'support@wedpluz.com',
  phone: config.value?.support.phone || '',
  whatsapp: config.value?.support.whatsapp || '',
}))

// ---- search with live suggestions (combobox) ---------------------------------------------------------------------
const query = ref('')
const results = computed(() => (query.value.trim().length > 1 ? searchFaqs(query.value, FAQ_TOPICS, 6) : []))
const activeIndex = ref(-1)
watch(results, () => (activeIndex.value = -1))
const showResults = computed(() => query.value.trim().length > 1)

function openResult(id: string) {
  void router.push({ name: 'faqs', hash: `#${id}` })
}
function submitSearch() {
  const hit = results.value[activeIndex.value]
  if (hit) return openResult(hit.item.id)
  if (query.value.trim()) void router.push({ name: 'faqs', query: { q: query.value.trim() } })
}
function onSearchKey(e: KeyboardEvent) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % results.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? results.value.length - 1 : activeIndex.value - 1
  } else if (e.key === 'Escape') {
    query.value = ''
  }
}

// ---- content -----------------------------------------------------------------------------------------------------
const quickActions = computed(() => [
  { label: 'Find my tickets', text: 'View QR codes and receipts', icon: Ticket, to: auth.isAuthenticated ? { name: 'tickets' } : { name: 'faqs', hash: '#get-my-ticket' } },
  { label: 'Cancel or get a refund', text: 'Cancellation and refund rules', icon: RotateCcw, to: { name: 'faqs', hash: '#refund-eligibility' } },
  { label: 'Wallet & withdrawals', text: 'Balance, bank accounts, payouts', icon: Wallet, to: auth.isAuthenticated ? { name: 'wallet' } : { name: 'faqs', hash: '#topic-wallet' } },
  auth.isAuthenticated
    ? { label: 'Account & security', text: 'Password, sessions, privacy', icon: Settings, to: { name: 'settings' } }
    : { label: 'Create an account', text: 'Sign up in under a minute', icon: UserPlus, to: { name: 'auth.signup' } },
])
const popular = allFaqItems().filter((i) => i.popular).slice(0, 6)
const openIds = ref(new Set<string>())
const toggle = (id: string) => {
  const next = new Set(openIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openIds.value = next
}

// ---- signed-in: recent support requests ---------------------------------------------------------------------------
const tickets = useAsync(() => accountApi.supportTickets(), { immediate: auth.isAuthenticated })
watch(
  () => auth.isAuthenticated,
  (signedIn) => signedIn && void tickets.refresh(),
)
const recentTickets = computed(() => (tickets.data.value ?? []).slice(0, 4))
const CATEGORY_LABELS: Record<string, string> = { payment: 'Payments & refunds', ticket: 'Tickets', account: 'My account', event: 'Events', vendor: 'Vendors', bug: 'Bug report', other: 'Other' }

const meta = staticPageFor('/help')
useSeo({
  title: meta?.title,
  description: meta?.description,
  jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Help center', path: '/help' }]), faqLd(popular.map((i) => ({ question: i.question, answer: i.answer })))].filter((x): x is NonNullable<typeof x> => !!x),
})
</script>

<template>
  <div>
    <!-- z-10: the live suggestions panel must sit above the sections that follow the hero. -->
    <PageHero class="z-10" title="How can we help?" subtitle="Search our answers, browse by topic, or get in touch with the Wedpluz support team." crumb="Help center" eyebrow="Help center" size="lg">
      <div class="relative mx-auto max-w-2xl">
        <HelpSearchInput v-model="query" placeholder="Search for answers" controls="help-suggestions" :expanded="showResults" @submit="submitSearch" @keydown="onSearchKey" />
        <!-- live suggestions -->
        <div v-if="showResults" class="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-3xl border border-ink-200 bg-white text-left shadow-float">
          <ul v-if="results.length" id="help-suggestions" role="listbox" aria-label="Suggested answers" class="max-h-[420px] overflow-y-auto p-2">
            <li v-for="(r, i) in results" :id="`help-opt-${r.item.id}`" :key="r.item.id" role="option" :aria-selected="activeIndex === i">
              <RouterLink :to="{ name: 'faqs', hash: `#${r.item.id}` }" :class="cn('flex items-start gap-3 rounded-2xl px-4 py-3 transition-colors', activeIndex === i ? 'bg-brand-50' : 'hover:bg-ink-50')" @mouseenter="activeIndex = i">
                <component :is="TOPIC_ICONS[r.topic.icon]" class="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span class="min-w-0">
                  <span class="block text-sm font-medium text-ink-900"><template v-for="(s, si) in highlightSegments(r.item.question, query)" :key="si"><mark v-if="s.match" class="rounded bg-brand-100 px-0.5 text-inherit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template></span>
                  <span class="mt-0.5 block truncate text-xs text-ink-500">{{ r.topic.title }} · {{ r.item.answer }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <div v-else id="help-suggestions" class="px-6 py-5 text-sm text-ink-600">No direct match. Press <kbd class="rounded border border-ink-200 px-1.5 text-xs">Enter</kbd> to search all FAQs, or <a href="#contact" class="font-medium text-brand-600 hover:underline" @click="query = ''">contact support</a>.</div>
          <button type="button" class="flex w-full items-center justify-between border-t border-ink-100 bg-ink-50/70 px-6 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50" @click="submitSearch">
            <span>See all results for “{{ query.trim() }}”</span><CornerDownLeft class="h-4 w-4" />
          </button>
        </div>
      </div>
    </PageHero>

    <div class="container-app space-y-20 pb-20 md:space-y-24">
      <!-- quick actions -->
      <section aria-labelledby="quick-title">
        <h2 id="quick-title" class="sr-only">Quick actions</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RouterLink v-for="a in quickActions" :key="a.label" :to="a.to" class="group flex items-center gap-4 rounded-2xl border border-ink-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white"><component :is="a.icon" class="h-5 w-5" /></span>
            <span class="min-w-0"><span class="block font-semibold text-ink-900">{{ a.label }}</span><span class="block text-sm text-ink-500">{{ a.text }}</span></span>
          </RouterLink>
        </div>
      </section>

      <!-- topics -->
      <section aria-labelledby="topics-title">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 id="topics-title" class="text-[28px] leading-9 tracking-normal text-[#333740]">Browse by topic</h2>
            <p class="mt-1 text-ink-500">Guides and answers grouped the way you’d look for them.</p>
          </div>
          <RouterLink :to="{ name: 'faqs' }" class="hidden shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline sm:inline-flex">All FAQs<ArrowRight class="h-4 w-4" /></RouterLink>
        </div>
        <div class="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <article v-for="t in FAQ_TOPICS" :key="t.id" class="flex flex-col rounded-3xl border border-ink-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-card">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><component :is="TOPIC_ICONS[t.icon]" class="h-5 w-5" /></span>
              <div><h3 class="text-lg font-semibold tracking-normal text-ink-900">{{ t.title }}</h3><p class="text-xs text-ink-500">{{ t.items.length }} articles</p></div>
            </div>
            <p class="mt-3 text-sm text-ink-500">{{ t.description }}</p>
            <ul class="mt-4 flex-1 space-y-2">
              <li v-for="item in t.items.slice(0, 3)" :key="item.id">
                <RouterLink :to="{ name: 'faqs', hash: `#${item.id}` }" class="group flex items-start gap-2 text-sm text-ink-700 hover:text-brand-700"><ArrowRight class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />{{ item.question }}</RouterLink>
              </li>
            </ul>
            <RouterLink :to="{ name: 'faqs', hash: `#topic-${t.id}` }" class="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">View all {{ t.items.length }}<ArrowRight class="h-4 w-4" /></RouterLink>
          </article>
          <a href="#contact" class="group flex flex-col justify-between rounded-3xl bg-brand-950 p-6 text-white transition hover:shadow-card">
            <span>
              <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"><Inbox class="h-5 w-5" /></span>
              <span class="mt-4 block text-lg font-semibold">Still need help?</span>
              <span class="mt-2 block text-sm text-white/75">Send a request to our support team. Include any ticket or payment reference and we’ll take it from there.</span>
            </span>
            <span class="mt-6 inline-flex items-center gap-1 text-sm font-medium">Contact support<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
          </a>
        </div>
      </section>

      <!-- popular questions -->
      <section aria-labelledby="popular-title" class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
        <div>
          <h2 id="popular-title" class="text-[28px] leading-9 tracking-normal text-[#333740]">Popular questions</h2>
          <p class="mt-2 text-ink-500">The answers people look for most often. Can’t see yours? Search above or browse all FAQs.</p>
          <UiButton variant="outline" class="mt-6" :to="{ name: 'faqs' }">Browse all FAQs</UiButton>
        </div>
        <div class="space-y-3">
          <FaqAccordionItem v-for="item in popular" :key="item.id" :item="item" :open="openIds.has(item.id)" @toggle="toggle(item.id)" />
        </div>
      </section>

      <!-- safety -->
      <section class="flex flex-col gap-4 rounded-3xl border border-warning-500/30 bg-warning-50 p-6 sm:flex-row sm:items-center md:p-8" aria-labelledby="safety-title">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#b7791f]"><ShieldAlert class="h-6 w-6" /></span>
        <div class="flex-1">
          <h2 id="safety-title" class="text-lg font-semibold tracking-normal text-ink-900">Wedpluz will never ask for your password, wallet PIN or one-time codes</h2>
          <p class="mt-1 text-sm text-ink-600">Only pay through Wedpluz checkout, and report anyone who asks you to pay them directly.</p>
        </div>
        <RouterLink :to="{ name: 'faqs', hash: '#scam-safety' }" class="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink-900 hover:underline">Safety tips<ArrowRight class="h-4 w-4" /></RouterLink>
      </section>

      <!-- contact -->
      <section id="contact" class="scroll-mt-28" aria-labelledby="contact-title">
        <div class="max-w-2xl">
          <h2 id="contact-title" class="text-[28px] leading-9 tracking-normal text-[#333740]">Contact support</h2>
          <p class="mt-2 text-ink-500">Send us a request and a member of the team will reply by email — usually within 24 hours. Include any ticket number or payment reference so we can help faster.</p>
        </div>
        <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-12">
          <div class="space-y-4">
            <a :href="`mailto:${support.email}`" class="group flex items-center gap-4 rounded-2xl border border-ink-200 p-5 transition hover:border-brand-200 hover:shadow-card">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Mail class="h-5 w-5" /></span>
              <span class="min-w-0 flex-1"><span class="block font-semibold text-ink-900">Email</span><span class="block truncate text-sm text-ink-500">{{ support.email }}</span></span>
              <ArrowRight class="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </a>
            <a v-if="support.whatsapp" :href="`https://wa.me/${support.whatsapp.replace(/\D/g, '')}`" target="_blank" rel="noopener noreferrer" class="group flex items-center gap-4 rounded-2xl border border-ink-200 p-5 transition hover:border-success-500/40 hover:shadow-card">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600"><MessageCircle class="h-5 w-5" /></span>
              <span class="min-w-0 flex-1"><span class="block font-semibold text-ink-900">WhatsApp</span><span class="block truncate text-sm text-ink-500">{{ support.whatsapp }}</span></span>
              <ArrowRight class="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-success-600" />
            </a>
            <a v-if="support.phone" :href="`tel:${support.phone.replace(/\s/g, '')}`" class="group flex items-center gap-4 rounded-2xl border border-ink-200 p-5 transition hover:border-brand-200 hover:shadow-card">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Phone class="h-5 w-5" /></span>
              <span class="min-w-0 flex-1"><span class="block font-semibold text-ink-900">Phone</span><span class="block truncate text-sm text-ink-500">{{ support.phone }}</span></span>
              <ArrowRight class="h-4 w-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </a>

            <!-- signed-in: recent requests -->
            <div v-if="auth.isAuthenticated" class="rounded-2xl bg-ink-50 p-5">
              <p class="flex items-center gap-2 font-semibold text-ink-900"><Inbox class="h-4 w-4 text-brand-600" />Your recent requests</p>
              <div v-if="tickets.loading.value && !tickets.data.value" class="mt-4 space-y-2"><UiSkeleton v-for="i in 2" :key="i" class="h-12 rounded-xl" /></div>
              <ul v-else-if="recentTickets.length" class="mt-3 divide-y divide-ink-200/70">
                <li v-for="t in recentTickets" :key="t.id" class="flex items-start justify-between gap-3 py-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-ink-900">{{ t.subject }}</p>
                    <p class="mt-0.5 flex items-center gap-1 text-xs text-ink-500"><span>{{ t.reference }}</span><span aria-hidden="true">·</span><span>{{ CATEGORY_LABELS[t.category] ?? t.category }}</span><span aria-hidden="true">·</span><Clock class="h-3 w-3" />{{ formatRelative(t.updatedAt) }}</p>
                  </div>
                  <UiBadge :status="t.status" size="sm" />
                </li>
              </ul>
              <p v-else class="mt-2 text-sm text-ink-500">You haven’t contacted support yet. Requests you send appear here with their status.</p>
            </div>
          </div>

          <div class="rounded-3xl border border-ink-200 bg-white p-6 shadow-[0_10px_40px_rgb(51_55_64/0.05)] md:p-8">
            <template v-if="auth.isAuthenticated">
              <h3 class="text-lg font-semibold tracking-normal text-ink-900">Send a request</h3>
              <p class="mb-6 mt-1 text-sm text-ink-500">Signed in as {{ auth.user?.email }} — we’ll reply to this address.</p>
              <SupportForm @sent="tickets.refresh()" />
            </template>
            <div v-else class="flex h-full flex-col items-center justify-center py-6 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Inbox class="h-7 w-7" /></span>
              <h3 class="mt-4 text-lg font-semibold tracking-normal text-ink-900">Log in to send a request</h3>
              <p class="mt-2 max-w-sm text-sm text-ink-500">Signing in links your request to your tickets and payments so we can resolve it faster. You’ll also see its status here.</p>
              <div class="mt-6 flex flex-wrap justify-center gap-3">
                <UiButton :to="{ name: 'auth.login', query: { redirect: '/help#contact' } }">Log in</UiButton>
                <UiButton variant="outline" :href="`mailto:${support.email}`">Email us instead</UiButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
