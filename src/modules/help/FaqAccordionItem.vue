<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Check, ChevronDown, Link2 } from 'lucide-vue-next'
import type { FaqItem } from '@/content/faqs'
import { highlightSegments } from '@/utils/highlight'
import { cn } from '@/utils/cn'

const props = withDefaults(defineProps<{ item: FaqItem; open: boolean; query?: string; topicLabel?: string }>(), { query: '', topicLabel: '' })
const emit = defineEmits<{ toggle: [] }>()

const panelId = computed(() => `faq-panel-${props.item.id}`)
const buttonId = computed(() => `faq-${props.item.id}`)
const question = computed(() => highlightSegments(props.item.question, props.query))
const paragraphs = computed(() => props.item.answer.split(/\n{2,}/).map((p) => highlightSegments(p, props.query)))

const copied = ref(false)
async function copyLink() {
  const url = `${window.location.origin}/faqs#${props.item.id}`
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    window.location.hash = props.item.id
  }
}
</script>

<template>
  <div :class="cn('rounded-2xl border bg-white transition-colors', open ? 'border-brand-200 shadow-[0_6px_24px_rgb(155_17_155/0.06)]' : 'border-ink-200 hover:border-ink-300')">
    <h3 class="text-base">
      <button
        :id="buttonId"
        type="button"
        class="flex w-full scroll-mt-32 items-start gap-4 rounded-2xl px-5 py-4 text-left md:px-6 md:py-5"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="emit('toggle')"
      >
        <span class="min-w-0 flex-1">
          <span v-if="topicLabel" class="mb-1 block text-xs font-medium uppercase tracking-wide text-brand-600">{{ topicLabel }}</span>
          <span class="block font-semibold leading-6 tracking-normal text-[#333740]"><template v-for="(s, i) in question" :key="i"><mark v-if="s.match" class="rounded bg-brand-100 px-0.5 text-inherit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template></span>
        </span>
        <span :class="cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-200', open ? 'rotate-180 bg-brand-600 text-white' : 'bg-ink-100 text-ink-600')" aria-hidden="true"><ChevronDown class="h-4 w-4" /></span>
      </button>
    </h3>
    <!-- grid-rows animation gives a smooth height transition without measuring the content -->
    <div :id="panelId" role="region" :aria-labelledby="buttonId" :class="cn('grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')" :inert="!open">
      <div class="overflow-hidden">
        <div class="px-5 pb-5 md:px-6 md:pb-6">
          <p v-for="(p, pi) in paragraphs" :key="pi" class="text-[15px] leading-7 text-ink-600" :class="pi > 0 && 'mt-3'"><template v-for="(s, i) in p" :key="i"><mark v-if="s.match" class="rounded bg-brand-100 px-0.5 text-inherit">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template></p>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <RouterLink v-for="l in item.links ?? []" :key="l.label" :to="l.to" class="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100">{{ l.label }}<ArrowRight class="h-3.5 w-3.5" /></RouterLink>
            <button type="button" class="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-800" @click="copyLink">
              <Check v-if="copied" class="h-3.5 w-3.5 text-success-500" /><Link2 v-else class="h-3.5 w-3.5" />{{ copied ? 'Link copied' : 'Copy link' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
