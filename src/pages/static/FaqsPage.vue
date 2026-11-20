<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronsDownUp, ChevronsUpDown, LifeBuoy, Mail, SearchX } from 'lucide-vue-next'
import PageHero from '@/components/marketing/PageHero.vue'
import UiButton from '@/components/ui/UiButton.vue'
import HelpSearchInput from '@/modules/help/HelpSearchInput.vue'
import FaqAccordionItem from '@/modules/help/FaqAccordionItem.vue'
import { TOPIC_ICONS } from '@/modules/help/topicIcons'
import { FAQ_TOPICS, type FaqTopic } from '@/content/faqs'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { usePublicConfig } from '@/composables/useReferenceData'
import { useSeo } from '@/composables/useSeo'
import { breadcrumbLd, faqLd } from '@/utils/structuredData'
import { staticPageFor } from '@/config/seo'
import { isAuthoredCms, parseFaqTopics, searchFaqs } from '@/utils/cmsContent'
import { cn } from '@/utils/cn'

const route = useRoute()
const router = useRouter()
const { data: config } = usePublicConfig()
const supportEmail = computed(() => config.value?.support.email ?? 'support@wedpluz.com')

// Authored CMS FAQs (h2 = topic, h3 = question) replace the curated set; otherwise the curated set is used.
const { data: cms } = useAsync(() => accountApi.page('faqs'))
const topics = computed<FaqTopic[]>(() => {
  if (cms.value && isAuthoredCms(cms.value.content)) {
    const parsed = parseFaqTopics(cms.value.content)
    if (parsed.reduce((n, t) => n + t.items.length, 0) >= 3) return parsed
  }
  return FAQ_TOPICS
})
const total = computed(() => topics.value.reduce((n, t) => n + t.items.length, 0))

// ---- search (synced to ?q= so results can be shared) ------------------------------------------------------------
const query = ref(typeof route.query.q === 'string' ? route.query.q : '')
const searching = computed(() => query.value.trim().length > 1)
const results = computed(() => (searching.value ? searchFaqs(query.value, topics.value, 50) : []))
let syncTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (q) => {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => void router.replace({ query: { ...route.query, q: q.trim() || undefined }, hash: route.hash }), 300)
})

// ---- accordion state ---------------------------------------------------------------------------------------------
const openIds = ref(new Set<string>())
const toggle = (id: string) => {
  const next = new Set(openIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openIds.value = next
}
const allIds = computed(() => (searching.value ? results.value.map((r) => r.item.id) : topics.value.flatMap((t) => t.items.map((i) => i.id))))
const allOpen = computed(() => allIds.value.length > 0 && allIds.value.every((id) => openIds.value.has(id)))
const toggleAll = () => (openIds.value = allOpen.value ? new Set() : new Set(allIds.value))

// ---- topic rail with scroll-spy ----------------------------------------------------------------------------------
const activeTopic = ref<string>(topics.value[0]?.id ?? '')
let observer: IntersectionObserver | null = null
function observeTopics() {
  observer?.disconnect()
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (hit) activeTopic.value = hit.target.id.replace(/^topic-/, '')
    },
    { rootMargin: '-120px 0px -65% 0px' },
  )
  document.querySelectorAll('section[id^="topic-"]').forEach((el) => observer!.observe(el))
}
function goToTopic(id: string) {
  query.value = ''
  activeTopic.value = id
  void nextTick(() => document.getElementById(`topic-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

// Deep links: /faqs#<question-id> opens and scrolls to that question; /faqs#topic-<id> jumps to a topic.
function openFromHash() {
  const id = decodeURIComponent(route.hash.replace(/^#/, ''))
  if (!id) return
  if (id.startsWith('topic-')) return void document.getElementById(id)?.scrollIntoView()
  if (topics.value.some((t) => t.items.some((i) => i.id === id))) {
    openIds.value = new Set([...openIds.value, id])
    void nextTick(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ block: 'start' }))
  }
}

onMounted(async () => {
  await nextTick()
  observeTopics()
  openFromHash()
})
watch(topics, async () => {
  await nextTick()
  observeTopics()
  openFromHash()
})
watch(searching, async (s) => {
  if (!s) {
    await nextTick()
    observeTopics()
  }
})
watch(() => route.hash, openFromHash)
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(syncTimer)
})

const meta = staticPageFor('/faqs')
useSeo(() => ({
  title: meta?.title,
  description: meta?.description,
  jsonLd: [
    breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'FAQs', path: '/faqs' }]),
    faqLd(topics.value.flatMap((t) => t.items.map((i) => ({ question: i.question, answer: i.answer })))),
  ].filter((x): x is NonNullable<typeof x> => !!x),
}))
</script>

<template>
  <div>
    <PageHero title="Frequently asked questions" :subtitle="`Quick answers to ${total} of the questions we hear most about tickets, refunds, events, vendors and your account.`" crumb="FAQs" eyebrow="Support" size="lg">
      <HelpSearchInput v-model="query" placeholder="Search questions, e.g. refund" label="Search frequently asked questions" />
      <div class="mt-5 flex flex-wrap justify-center gap-2" aria-label="Browse by topic">
        <button v-for="t in topics" :key="t.id" type="button" class="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-3.5 py-1.5 text-sm text-ink-700 backdrop-blur transition hover:border-brand-200 hover:text-brand-700" @click="goToTopic(t.id)">
          <component :is="TOPIC_ICONS[t.icon]" class="h-3.5 w-3.5 text-brand-600" />{{ t.title }}
        </button>
      </div>
    </PageHero>

    <div class="container-app pb-20">
      <div class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <aside class="hidden lg:block">
          <nav class="sticky top-28" aria-label="FAQ topics">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Topics</p>
            <ul class="mt-4 space-y-1">
              <li v-for="t in topics" :key="t.id">
                <a
                  :href="`#topic-${t.id}`"
                  :aria-current="!searching && activeTopic === t.id ? 'location' : undefined"
                  :class="cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors', !searching && activeTopic === t.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900')"
                  @click.prevent="goToTopic(t.id)"
                >
                  <component :is="TOPIC_ICONS[t.icon]" class="h-4 w-4 shrink-0" />
                  <span class="flex-1">{{ t.title }}</span>
                  <span class="text-xs text-ink-400">{{ t.items.length }}</span>
                </a>
              </li>
            </ul>
            <div class="mt-8 rounded-2xl bg-ink-50 p-5">
              <p class="font-semibold text-ink-900">Can’t find it?</p>
              <p class="mt-1 text-sm text-ink-500">Our support team usually replies within 24 hours.</p>
              <UiButton size="sm" class="mt-4" :to="{ name: 'help', hash: '#contact' }">Contact support</UiButton>
            </div>
          </nav>
        </aside>

        <div class="min-w-0">
          <div class="mb-6 flex items-center justify-between gap-4">
            <p class="text-sm text-ink-500" role="status" aria-live="polite">
              <template v-if="searching">{{ results.length }} {{ results.length === 1 ? 'result' : 'results' }} for “<span class="font-medium text-ink-800">{{ query.trim() }}</span>”</template>
              <template v-else>{{ total }} questions in {{ topics.length }} topics</template>
            </p>
            <button v-if="allIds.length" type="button" class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50" @click="toggleAll">
              <component :is="allOpen ? ChevronsDownUp : ChevronsUpDown" class="h-4 w-4" />{{ allOpen ? 'Collapse all' : 'Expand all' }}
            </button>
          </div>

          <!-- search results -->
          <template v-if="searching">
            <div v-if="results.length" class="space-y-3">
              <FaqAccordionItem v-for="r in results" :key="r.item.id" :item="r.item" :open="openIds.has(r.item.id)" :query="query" :topic-label="r.topic.title" @toggle="toggle(r.item.id)" />
            </div>
            <div v-else class="flex flex-col items-center rounded-3xl border border-dashed border-ink-200 px-6 py-14 text-center">
              <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><SearchX class="h-7 w-7" /></span>
              <h2 class="mt-4 text-xl">No answers match “{{ query.trim() }}”</h2>
              <p class="mt-2 max-w-md text-ink-500">Try a simpler word such as “refund”, “ticket” or “payout”, or ask our team directly.</p>
              <div class="mt-6 flex flex-wrap justify-center gap-3">
                <UiButton variant="outline" @click="query = ''">Clear search</UiButton>
                <UiButton :to="{ name: 'help', hash: '#contact' }">Contact support</UiButton>
              </div>
            </div>
          </template>

          <!-- browse by topic -->
          <template v-else>
            <section v-for="t in topics" :id="`topic-${t.id}`" :key="t.id" class="scroll-mt-28 pb-12 last:pb-0" :aria-labelledby="`topic-title-${t.id}`">
              <div class="mb-5 flex items-start gap-4">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><component :is="TOPIC_ICONS[t.icon]" class="h-5 w-5" /></span>
                <div>
                  <h2 :id="`topic-title-${t.id}`" class="text-[22px] leading-8 tracking-normal text-[#333740]">{{ t.title }}</h2>
                  <p v-if="t.description" class="text-sm text-ink-500">{{ t.description }}</p>
                </div>
              </div>
              <div class="space-y-3">
                <FaqAccordionItem v-for="item in t.items" :key="item.id" :item="item" :open="openIds.has(item.id)" @toggle="toggle(item.id)" />
              </div>
            </section>
          </template>

          <section class="mt-16 overflow-hidden rounded-3xl bg-brand-950 p-8 text-white md:flex md:items-center md:justify-between md:gap-8 md:p-10" aria-labelledby="faq-more">
            <div>
              <h2 id="faq-more" class="text-2xl tracking-normal text-white">Still have a question?</h2>
              <p class="mt-2 max-w-lg text-white/75">Tell us what’s going on and include any ticket or payment reference. A real person will get back to you.</p>
            </div>
            <div class="mt-6 flex flex-wrap gap-3 md:mt-0 md:shrink-0">
              <UiButton :to="{ name: 'help', hash: '#contact' }" class="bg-white! text-brand-800! hover:bg-brand-50!"><LifeBuoy class="h-4 w-4" />Visit Help center</UiButton>
              <a :href="`mailto:${supportEmail}`" class="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-medium hover:bg-white/10"><Mail class="h-4 w-4" />Email us</a>
            </div>
          </section>
          <p class="mt-6 text-sm text-ink-500">Looking for the legal details? Read our <RouterLink :to="{ name: 'terms' }" class="font-medium text-brand-600 hover:underline">Terms</RouterLink> and <RouterLink :to="{ name: 'privacy' }" class="font-medium text-brand-600 hover:underline">Privacy policy</RouterLink>.</p>
        </div>
      </div>
    </div>
  </div>
</template>
