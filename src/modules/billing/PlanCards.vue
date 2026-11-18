<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import { formatMoney } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Plan } from '@/types'

defineProps<{ plans: Plan[]; interval: 'monthly' | 'yearly'; currentTier?: string; loading?: boolean; busyPlanId?: string | null }>()
const emit = defineEmits<{ select: [plan: Plan] }>()
const cta: Record<string, string> = { free: 'Get started', basic: 'Go Basic', premium: 'Go Pro', premium_plus: 'Go Pro +' }
</script>

<template>
  <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
    <template v-if="loading"><UiSkeleton v-for="i in 4" :key="i" class="h-96 rounded-2xl" /></template>
    <div v-for="p in plans" v-else :key="p.id" :class="cn('card flex flex-col p-6', p.isPopular && 'border-brand-400 shadow-card', currentTier === p.tier && 'ring-2 ring-brand-600')">
      <div class="flex items-center justify-between"><h3 class="text-2xl font-semibold">{{ p.name }}</h3><span v-if="currentTier === p.tier" class="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">Current</span><span v-else-if="p.isPopular" class="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-600">Popular</span></div>
      <p class="text-sm text-ink-500">{{ p.tagline }}</p>
      <p class="mt-6 text-2xl font-semibold">{{ formatMoney(interval === 'yearly' ? p.priceYearly : p.priceMonthly, p.currency) }}</p>
      <p class="text-sm text-ink-500">Per {{ interval === 'yearly' ? 'year' : 'month' }}</p>
      <UiButton size="lg" block class="mt-6" :disabled="currentTier === p.tier" :loading="busyPlanId === p.id" @click="emit('select', p)">{{ currentTier === p.tier ? 'Current plan' : cta[p.tier] }}</UiButton>
      <p v-if="p.inheritsFrom" class="mt-6 text-xs text-ink-500">Everything in {{ p.inheritsFrom }} plus:</p>
      <ul :class="cn('space-y-3 text-sm', p.inheritsFrom ? 'mt-3' : 'mt-6')"><li v-for="f in p.features" :key="f" class="flex items-start gap-2"><Check class="mt-0.5 h-4 w-4 shrink-0 text-ink-700" />{{ f }}</li></ul>
    </div>
  </div>
</template>
