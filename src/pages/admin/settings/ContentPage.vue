<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bold, Heading3, Italic, Link, List, Save } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import AdminPageHeader from '@/modules/admin/AdminPageHeader.vue'
import { adminApi } from '@/services/api/admin.api'
import { useAsync } from '@/composables/useAsync'
import { useAdminStore } from '@/stores/admin.store'
import { useUiStore } from '@/stores/ui.store'
import { sanitizeRichText } from '@/utils/sanitize'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { CmsPage } from '@/types'

/**
 * Lightweight HTML content editor for legal/help pages. Output is sanitized on render
 * (web) and must also be sanitized server-side before storage.
 */
const admin = useAdminStore()
const ui = useUiStore()
const { data: pages, loading, refresh } = useAsync(() => adminApi.settings.pages())
const active = ref<CmsPage | null>(null)
const title = ref('')
const content = ref('')
const saving = ref(false)
const textarea = ref<HTMLTextAreaElement | null>(null)
watch(pages, (p) => {
  if (p && !active.value) select(p[0]!)
})
function select(p: CmsPage) {
  active.value = p
  title.value = p.title
  content.value = p.content
}
const preview = computed(() => sanitizeRichText(content.value))
function wrap(before: string, after = before.replace('<', '</')) {
  const el = textarea.value
  if (!el) return
  const { selectionStart: s, selectionEnd: e } = el
  content.value = content.value.slice(0, s) + before + content.value.slice(s, e) + after + content.value.slice(e)
}
async function save() {
  if (!active.value) return
  if (!(await ui.confirm({ title: `Publish ${active.value.title}?`, description: active.value.slug === 'terms' || active.value.slug === 'privacy' ? 'Users will see a new “last updated” date. Consider notifying users of material changes.' : undefined, confirmLabel: 'Publish' }))) return
  saving.value = true
  try {
    active.value = await adminApi.settings.updatePage(active.value.slug, { title: title.value, content: content.value })
    ui.success('Page published')
    void refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader title="Content pages" description="About, terms, privacy, FAQs and help content shown on web and in the apps." :back="{ name: 'admin.settings' }" />
    <UiSpinner v-if="loading" page />
    <div v-else class="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav class="card h-fit p-2"><button v-for="p in pages ?? []" :key="p.id" type="button" :class="cn('block w-full rounded-xl px-3 py-2.5 text-left text-sm', active?.id === p.id ? 'bg-brand-50 font-medium text-brand-700' : 'hover:bg-ink-50')" @click="select(p)">{{ p.title }}</button></nav>
      <section v-if="active" class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3"><UiInput v-model="title" label="Title" class="max-w-md" /><div class="text-right text-xs text-ink-500">Last updated {{ formatDateTime(active.updatedAt) }}<template v-if="active.updatedBy"> by {{ active.updatedBy }}</template></div></div>
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="card overflow-hidden">
            <div class="flex gap-1 border-b border-ink-100 p-2"><button type="button" class="rounded p-1.5 hover:bg-ink-100" aria-label="Heading" @click="wrap('<h3>')"><Heading3 class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 hover:bg-ink-100" aria-label="Bold" @click="wrap('<strong>')"><Bold class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 hover:bg-ink-100" aria-label="Italic" @click="wrap('<em>')"><Italic class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 hover:bg-ink-100" aria-label="List" @click="wrap('<ul><li>', '</li></ul>')"><List class="h-4 w-4" /></button><button type="button" class="rounded p-1.5 hover:bg-ink-100" aria-label="Link" @click="wrap('<a href=&quot;https://&quot;>', '</a>')"><Link class="h-4 w-4" /></button></div>
            <textarea ref="textarea" v-model="content" :disabled="!admin.can('settings.manage')" rows="22" class="w-full resize-y border-0 p-4 font-mono text-xs focus:ring-0" aria-label="Page HTML" />
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -- preview is sanitizeRichText() output -->
          <div class="card p-5"><p class="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Preview</p><div class="space-y-3 text-sm text-ink-700 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_a]:text-brand-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5" v-html="preview" /></div>
        </div>
        <div v-if="admin.can('settings.manage')" class="flex justify-end"><UiButton :loading="saving" @click="save"><Save class="h-4 w-4" />Publish</UiButton></div>
      </section>
    </div>
  </div>
</template>
