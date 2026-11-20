<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowRight, ArrowUp, CalendarDays, Clock, LifeBuoy, ListTree, Mail, Printer, ScrollText, ShieldCheck } from 'lucide-vue-next'
import PageHero from '@/components/marketing/PageHero.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { usePublicConfig } from '@/composables/useReferenceData'
import { useSeo } from '@/composables/useSeo'
import { breadcrumbLd } from '@/utils/structuredData'
import { staticPageFor } from '@/config/seo'
import { escapeHtml, sanitizeRichText } from '@/utils/sanitize'
import { isAuthoredCms, prepareDocument } from '@/utils/cmsContent'
import { formatDate } from '@/utils/format'
import { cn } from '@/utils/cn'
import { PRIVACY, TERMS } from '@/content/legal'

const props = defineProps<{ slug: 'terms' | 'privacy' }>()
const route = useRoute()
const router = useRouter()

// The CMS is the source of truth once the team has written the document there; until then (or if it can't be
// loaded) the reviewed built-in text is shown, so the page is never empty.
const { data: page, loading } = useAsync(() => accountApi.page(props.slug), { watch: () => props.slug })
const { data: config } = usePublicConfig()
const supportEmail = computed(() => config.value?.support.email ?? 'support@wedpluz.com')

const builtIn = computed(() => (props.slug === 'terms' ? TERMS : PRIVACY))
const fromCms = computed(() => !!page.value && isAuthoredCms(page.value.content))
const doc = computed(() => {
  const raw = fromCms.value && page.value ? page.value.content : builtIn.value.html.replace(/\{\{supportEmail\}\}/g, `<a href="mailto:${escapeHtml(supportEmail.value)}">${escapeHtml(supportEmail.value)}</a>`)
  return prepareDocument(sanitizeRichText(raw))
})
const updatedAt = computed(() => (fromCms.value && page.value ? page.value.updatedAt : builtIn.value.updatedAt))
const ready = computed(() => !loading.value || !!page.value)

const meta = computed(() => staticPageFor(`/${props.slug}`))
const title = computed(() => builtIn.value.title)
const subtitle = computed(() =>
  props.slug === 'terms'
    ? 'The rules for buying tickets, organising events and offering services on Wedpluz — written to be clear, not just correct.'
    : 'What we collect, why we collect it, and the control you have over your personal data.',
)
const other = computed(() =>
  props.slug === 'terms'
    ? { name: 'privacy', label: 'Privacy policy', text: 'How we collect, use and protect your data.', icon: ShieldCheck }
    : { name: 'terms', label: 'Terms and conditions', text: 'The rules for using Wedpluz.', icon: ScrollText },
)

useSeo(() => ({
  title: meta.value?.title ?? title.value,
  description: meta.value?.description,
  type: 'article' as const,
  jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: title.value, path: `/${props.slug}` }])],
}))

// ---- table of contents: scroll-spy on the h2 sections -------------------------------------------------------
const article = ref<HTMLElement | null>(null)
const activeId = ref<string | null>(null)
const tocOpen = ref(false)
const showTop = ref(false)
const sections = computed(() => doc.value.headings.filter((h) => h.level === 2))
let observer: IntersectionObserver | null = null

function observe() {
  observer?.disconnect()
  if (!article.value || typeof IntersectionObserver === 'undefined') return
  const visible = new Map<string, number>()
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top)
        else visible.delete(e.target.id)
      }
      if (visible.size) activeId.value = [...visible.entries()].sort((a, b) => a[1] - b[1])[0]![0]
    },
    // The active section is the one whose heading sits in the upper part of the viewport (below the header).
    { rootMargin: '-110px 0px -60% 0px' },
  )
  article.value.querySelectorAll('h2[id]').forEach((h) => observer!.observe(h))
}

watch(
  () => [doc.value.html, ready.value] as const,
  async () => {
    await nextTick()
    observe()
    if (!activeId.value) activeId.value = sections.value[0]?.id ?? null
    // Deep links (e.g. /privacy#10-your-rights) arrive before the document renders; scroll once it exists.
    if (route.hash) document.getElementById(decodeURIComponent(route.hash.slice(1)))?.scrollIntoView()
  },
  { immediate: true, flush: 'post' },
)

const onScroll = () => (showTop.value = window.scrollY > 900)
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('scroll', onScroll)
})

function goTo(id: string) {
  tocOpen.value = false
  activeId.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(history.state, '', `#${id}`)
}

// Same-site links inside the document ("/help", "/privacy#…") navigate in the app instead of reloading the page.
function onArticleClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a')
  const href = a?.getAttribute('href')
  if (!a || !href || !href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  void router.push(href)
}

const print = () => window.print()
</script>

<template>
  <div>
    <PageHero :title="title" :subtitle="subtitle" :crumb="title" eyebrow="Legal">
      <div class="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-600">
        <span class="inline-flex items-center gap-1.5"><CalendarDays class="h-4 w-4 text-brand-600" />Last updated {{ formatDate(updatedAt) }}</span>
        <span class="inline-flex items-center gap-1.5"><Clock class="h-4 w-4 text-brand-600" />{{ doc.readingMinutes }} min read</span>
        <button type="button" class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-brand-600 hover:bg-brand-50 print:hidden" @click="print"><Printer class="h-4 w-4" />Print or save as PDF</button>
      </div>
    </PageHero>

    <div class="container-app pb-20">
      <div v-if="!ready" class="mx-auto max-w-3xl space-y-4">
        <UiSkeleton class="h-40 rounded-2xl" />
        <UiSkeleton v-for="i in 8" :key="i" class="h-5" />
      </div>

      <div v-else class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14 xl:gap-20">
        <!-- Table of contents: sticky sidebar on desktop, collapsible on smaller screens. -->
        <aside class="print:hidden">
          <div class="mb-8 lg:hidden">
            <button type="button" class="flex w-full items-center justify-between rounded-2xl border border-ink-200 bg-white px-4 py-3.5 text-left font-medium" :aria-expanded="tocOpen" aria-controls="legal-toc-mobile" @click="tocOpen = !tocOpen">
              <span class="inline-flex items-center gap-2"><ListTree class="h-4 w-4 text-brand-600" />On this page</span>
              <span class="text-sm text-ink-500">{{ sections.length }} sections</span>
            </button>
            <ol v-show="tocOpen" id="legal-toc-mobile" class="mt-2 max-h-[60vh] space-y-0.5 overflow-y-auto rounded-2xl border border-ink-200 bg-white p-2">
              <li v-for="h in sections" :key="h.id"><a :href="`#${h.id}`" class="block rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700" @click.prevent="goTo(h.id)">{{ h.text }}</a></li>
            </ol>
          </div>
          <nav class="sticky top-28 hidden max-h-[calc(100vh-8rem)] overflow-y-auto pb-6 lg:block" aria-label="On this page">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">On this page</p>
            <ol class="mt-4 space-y-0.5 border-l border-ink-200">
              <li v-for="h in sections" :key="h.id">
                <a
                  :href="`#${h.id}`"
                  :aria-current="activeId === h.id ? 'location' : undefined"
                  :class="cn('-ml-px block border-l-2 py-1.5 pl-4 pr-2 text-sm leading-5 transition-colors', activeId === h.id ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900')"
                  @click.prevent="goTo(h.id)"
                >{{ h.text }}</a>
              </li>
            </ol>
          </nav>
        </aside>

        <div class="min-w-0 max-w-3xl">
          <section v-if="!fromCms" class="rounded-2xl border border-brand-100 bg-brand-50/60 p-6 md:p-8" aria-labelledby="short-version">
            <h2 id="short-version" class="text-lg font-semibold tracking-normal text-[#333740]">The short version</h2>
            <ul class="mt-4 space-y-3">
              <li v-for="(point, i) in builtIn.summary" :key="i" class="flex gap-3 text-[15px] leading-6 text-ink-700">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />{{ point }}
              </li>
            </ul>
            <p class="mt-5 text-sm text-ink-500">This summary is for convenience. The full text below is what applies.</p>
          </section>

          <!-- eslint-disable-next-line vue/no-v-html -- sanitizeRichText() output. The click handler only routes same-site links in-app; they remain normal, keyboard-accessible anchors. -->
          <article ref="article" class="legal-prose mt-10" @click="onArticleClick" v-html="doc.html" />

          <div class="mt-14 grid gap-4 border-t border-ink-100 pt-10 sm:grid-cols-2 print:hidden">
            <RouterLink :to="{ name: other.name }" class="group flex items-start gap-4 rounded-2xl border border-ink-200 p-5 transition hover:border-brand-200 hover:shadow-card">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><component :is="other.icon" class="h-5 w-5" /></span>
              <span class="min-w-0"><span class="flex items-center gap-1 font-semibold text-ink-900">{{ other.label }}<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span><span class="mt-1 block text-sm text-ink-500">{{ other.text }}</span></span>
            </RouterLink>
            <RouterLink :to="{ name: 'help' }" class="group flex items-start gap-4 rounded-2xl border border-ink-200 p-5 transition hover:border-brand-200 hover:shadow-card">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><LifeBuoy class="h-5 w-5" /></span>
              <span class="min-w-0"><span class="flex items-center gap-1 font-semibold text-ink-900">Help center<ArrowRight class="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span><span class="mt-1 block text-sm text-ink-500">Answers about tickets, refunds and your account.</span></span>
            </RouterLink>
          </div>
          <p class="mt-6 flex items-center gap-2 text-sm text-ink-500">
            <Mail class="h-4 w-4" />Questions about this document? <a :href="`mailto:${supportEmail}`" class="font-medium text-brand-600 hover:underline">{{ supportEmail }}</a>
          </p>
        </div>
      </div>
    </div>

    <button v-if="showTop" type="button" class="fixed bottom-6 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-float print:hidden" aria-label="Back to top" @click="goTo(sections[0]?.id ?? 'short-version')"><ArrowUp class="h-5 w-5" /></button>
  </div>
</template>

<style scoped>
.legal-prose {
  color: #4a4e57;
  font-size: 16px;
  line-height: 1.75;
}
.legal-prose :deep(h2) {
  margin-top: 3rem;
  scroll-margin-top: 7rem;
  color: #333740;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: -0.01em;
}
.legal-prose :deep(h2:first-child) {
  margin-top: 0;
}
.legal-prose :deep(h3) {
  margin-top: 1.75rem;
  scroll-margin-top: 7rem;
  color: #333740;
  font-size: 1.0625rem;
  font-weight: 600;
}
.legal-prose :deep(h4) {
  margin-top: 1.25rem;
  font-weight: 600;
  color: #333740;
}
.legal-prose :deep(p) {
  margin-top: 0.875rem;
}
.legal-prose :deep(ul),
.legal-prose :deep(ol) {
  margin-top: 0.875rem;
  padding-left: 1.25rem;
}
.legal-prose :deep(ul) {
  list-style: disc;
}
.legal-prose :deep(ol) {
  list-style: decimal;
}
.legal-prose :deep(li) {
  margin-top: 0.5rem;
  padding-left: 0.25rem;
}
.legal-prose :deep(li::marker) {
  color: var(--color-brand-500);
}
.legal-prose :deep(strong) {
  color: #333740;
  font-weight: 600;
}
.legal-prose :deep(a) {
  color: var(--color-brand-600);
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--color-brand-200);
  text-underline-offset: 3px;
}
.legal-prose :deep(a:hover) {
  text-decoration-color: currentColor;
}
.legal-prose :deep(blockquote) {
  margin-top: 1rem;
  border-left: 3px solid var(--color-brand-200);
  padding-left: 1rem;
  color: #5b5f6a;
}
.legal-prose :deep(h2:target),
.legal-prose :deep(h3:target) {
  animation: legal-flash 1.6s ease-out;
}
@keyframes legal-flash {
  0% {
    background: var(--color-brand-100);
  }
  100% {
    background: transparent;
  }
}
@media print {
  .legal-prose {
    font-size: 11pt;
    color: #000;
  }
}
</style>
