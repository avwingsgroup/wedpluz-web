<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Download, LoaderCircle, Sparkles, Wand2 } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiTextarea from '@/components/ui/UiTextarea.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import { plannerApi } from '@/services/api/planner.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { isApiError } from '@/services/http'
import type { PlannerGeneration } from '@/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const kind = computed(() => (route.params.type === 'branding' ? 'event_branding' : 'cake_design') as 'cake_design' | 'event_branding')
const form = reactive({ eventName: '', tiers: '3', style: 'Elegant', colors: 'White and gold', details: '' })
const generating = ref(false)
const result = ref<PlannerGeneration | null>(null)
const prompt = computed(() => kind.value === 'cake_design'
  ? `${form.tiers}-tier ${form.style.toLowerCase()} cake, ${form.colors}. ${form.details}`.trim()
  : `Event branding for "${form.eventName || 'my event'}": ${form.style.toLowerCase()} style, ${form.colors} palette. Include invitation, table numbers and signage. ${form.details}`.trim())

async function generate() {
  generating.value = true
  result.value = null
  try {
    result.value = await plannerApi.generate({ type: kind.value, prompt: prompt.value })
  } catch (e) {
    if (isApiError(e) && e.status === 402) ui.toast({ variant: 'info', title: 'Premium feature', description: e.message, action: { label: 'Upgrade', onClick: () => router.push({ name: 'pricing' }) } })
    else ui.error((e as Error).message)
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="container-app pb-10 pt-8">
    <UiBackButton :to="{ name: 'planner' }" />
    <h1 class="mt-6 text-3xl">{{ kind === 'cake_design' ? 'Create cake design' : 'Brand your event' }}</h1>
    <p class="mt-1 text-sm text-ink-500">Describe what you want and Pluz planner will generate three options.<template v-if="!auth.isPremium"> <RouterLink :to="{ name: 'pricing' }" class="text-brand-600 underline">Premium required</RouterLink>.</template></p>
    <div class="mt-8 grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      <form class="card space-y-4 p-5" @submit.prevent="generate">
        <UiInput v-if="kind === 'event_branding'" v-model="form.eventName" label="Event name" placeholder="Tolu weds Femi" />
        <UiSelect v-if="kind === 'cake_design'" v-model="form.tiers" label="Tiers" :options="['1', '2', '3', '4', '5'].map((t) => ({ label: `${t} tier${t === '1' ? '' : 's'}`, value: t }))" />
        <UiSelect v-model="form.style" label="Style" :options="['Elegant', 'Modern', 'Rustic', 'Floral', 'Minimal', 'Traditional', 'Glam'].map((s) => ({ label: s, value: s }))" />
        <UiInput v-model="form.colors" label="Colours" placeholder="White and gold" />
        <UiTextarea v-model="form.details" label="Extra details" :rows="3" :maxlength="500" placeholder="Fresh flowers, monogram, Nigerian lace pattern…" />
        <div class="rounded-xl bg-ink-50 p-3 text-xs text-ink-600"><p class="font-medium text-ink-900">Prompt</p>{{ prompt }}</div>
        <UiButton type="submit" block size="lg" :loading="generating"><Wand2 class="h-4 w-4" />Generate designs</UiButton>
      </form>
      <section>
        <div v-if="generating" class="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl bg-ink-50"><LoaderCircle class="h-10 w-10 animate-spin text-brand-600" /><p class="mt-3 text-ink-500">Generating your designs…</p></div>
        <UiEmptyState v-else-if="!result" title="Your designs will appear here" description="Generated designs are saved to your Assets automatically." illustration="generic" />
        <div v-else>
          <div class="grid gap-4 sm:grid-cols-3"><div v-for="(u, i) in result.resultUrls" :key="u" class="card group overflow-hidden"><img :src="u" :alt="`Design ${i + 1}`" class="aspect-square w-full object-cover" /><div class="flex items-center justify-between p-3"><span class="text-sm">Option {{ i + 1 }}</span><a :href="u" download target="_blank" rel="noopener noreferrer" class="text-brand-600" aria-label="Download"><Download class="h-4 w-4" /></a></div></div></div>
          <div class="mt-6 flex gap-3"><UiButton variant="outline" @click="generate"><Sparkles class="h-4 w-4" />Regenerate</UiButton><UiButton :to="{ name: 'planner.assets' }">View in Assets</UiButton></div>
        </div>
      </section>
    </div>
  </div>
</template>
