<script setup lang="ts">
import { computed } from 'vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import { accountApi } from '@/services/api/account.api'
import { useAsync } from '@/composables/useAsync'
import { useSeo } from '@/composables/useSeo'
import { faqLd, parseFaqHtml } from '@/utils/structuredData'
import { staticPageFor } from '@/config/seo'
import { sanitizeRichText } from '@/utils/sanitize'
import { formatDate } from '@/utils/format'
import type { CmsPage } from '@/types'

const props = defineProps<{ slug: CmsPage['slug'] }>()
const { data: page, loading, error, refresh } = useAsync(() => accountApi.page(props.slug), { watch: () => props.slug })
const html = computed(() => (page.value ? sanitizeRichText(page.value.content) : ''))
useSeo(() => {
  const meta = staticPageFor(`/${props.slug}`)
  const faq = props.slug === 'faqs' && page.value ? faqLd(parseFaqHtml(page.value.content)) : null
  return {
    // Curated titles/descriptions from config/seo.ts; the CMS title is the fallback.
    title: meta?.title ?? page.value?.title,
    description: meta?.description,
    type: 'article' as const,
    jsonLd: faq ? [faq] : undefined,
  }
})
</script>

<template>
  <div class="container-app max-w-3xl pb-10">
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <div v-else-if="loading || !page" class="space-y-3"><UiSkeleton class="h-10 w-1/2" /><UiSkeleton v-for="i in 6" :key="i" /></div>
    <article v-else>
      <h1 class="text-3xl md:text-4xl">{{ page.title }}</h1>
      <p class="mt-2 text-sm text-ink-500">Last updated {{ formatDate(page.updatedAt) }}</p>
      <!-- eslint-disable-next-line vue/no-v-html -- html is sanitizeRichText() output -->
      <div class="mt-8 space-y-4 text-ink-700 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink-900 [&_a]:text-brand-600 [&_a]:underline" v-html="html" />
    </article>
  </div>
</template>
