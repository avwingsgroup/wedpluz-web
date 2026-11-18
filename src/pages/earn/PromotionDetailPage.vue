<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Copy, Share2, Target, Trophy } from 'lucide-vue-next'
import UiBackButton from '@/components/ui/UiBackButton.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiStatCard from '@/components/ui/UiStatCard.vue'
import ErrorState from '@/components/feedback/ErrorState.vue'
import { organizerApi } from '@/services/api/organizer.api'
import { useAsync } from '@/composables/useAsync'
import { useShare } from '@/composables/useClipboardShare'
import { formatDateRange, formatMoney } from '@/utils/format'

const route = useRoute()
const { share, copy } = useShare()
const { data: p, loading, error, refresh } = useAsync(() => organizerApi.promotionDetail(String(route.params.id)))
const progress = computed(() => (p.value?.targetSignups ? Math.min(100, Math.round((p.value.signups / p.value.targetSignups) * 100)) : 100))
const targetMet = computed(() => !!p.value && (!p.value.targetSignups || p.value.signups >= p.value.targetSignups))
</script>

<template>
  <div class="container-app pb-10">
    <UiBackButton :to="{ name: 'earn' }" />
    <ErrorState v-if="error" :error="error" @retry="refresh" />
    <UiSpinner v-else-if="loading || !p" page />
    <div v-else class="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <img :src="p.event.coverUrl" :alt="p.event.title" class="aspect-[16/7] w-full rounded-2xl object-cover" />
        <h1 class="mt-5 text-3xl">{{ p.event.title }}</h1>
        <p class="mt-1 text-ink-500">{{ formatDateRange(p.event.startsAt, p.event.endsAt) }} · {{ p.event.city }}</p>
        <div class="mt-6 grid gap-4 sm:grid-cols-3">
          <UiStatCard label="Sign-ups" :value="p.signups" :icon="Target" />
          <UiStatCard label="Commission" :value="`${p.commissionPercent}%`" :icon="Trophy" />
          <UiStatCard label="Earnings" :value="formatMoney(p.earnings)" tone="brand" :hint="p.withdrawable ? 'Withdrawable' : 'Locked until target'" />
        </div>
        <div v-if="p.targetSignups" class="card mt-6 p-5">
          <div class="flex items-center justify-between text-sm"><span class="font-medium">{{ targetMet ? 'Target met 🎉' : 'Progress to target' }}</span><span class="text-ink-500">{{ p.signups }} / {{ p.targetSignups }}</span></div>
          <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100"><div class="h-full rounded-full bg-brand-600 transition-all" :style="{ width: `${progress}%` }" /></div>
          <p class="mt-2 text-xs text-ink-500">{{ targetMet ? 'Your earnings are available in your wallet after the event is completed.' : `Reach ${p.targetSignups} sign-ups to unlock withdrawals for this event.` }}</p>
        </div>
      </div>
      <aside class="space-y-4">
        <div class="card p-5">
          <h2 class="font-semibold">Your promo link</h2>
          <p class="mt-1 text-sm text-ink-500">Every ticket bought through this link earns you {{ p.commissionPercent }}% of the ticket price.</p>
          <div class="mt-4 flex items-center gap-2 rounded-xl bg-ink-50 p-3"><span class="min-w-0 flex-1 truncate text-sm">{{ p.shareLink }}</span><button type="button" class="text-brand-600" aria-label="Copy link" @click="copy(p.shareLink, 'Link copied')"><Copy class="h-4 w-4" /></button></div>
          <p class="mt-3 text-sm">Promo code: <strong class="tracking-wide">{{ p.shareCode }}</strong></p>
          <UiButton block class="mt-4" @click="share(p.shareLink, p.event.title, `Get your tickets for ${p.event.title}`)"><Share2 class="h-4 w-4" />Share link</UiButton>
        </div>
        <UiButton variant="outline" block :to="{ name: 'event', params: { slug: p.event.slug } }">View event page</UiButton>
        <UiButton variant="ghost" block :to="{ name: 'wallet' }">Go to wallet</UiButton>
      </aside>
    </div>
  </div>
</template>
