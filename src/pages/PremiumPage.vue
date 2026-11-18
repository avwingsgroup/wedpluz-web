<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import UiSkeleton from '@/components/ui/UiSkeleton.vue'
import UiTabs from '@/components/ui/UiTabs.vue'
import UiModal from '@/components/ui/UiModal.vue'
import PlanCards from '@/modules/billing/PlanCards.vue'
import SubscribeModal from '@/modules/billing/SubscribeModal.vue'
import { walletApi } from '@/services/api/wallet.api'
import { useAsync } from '@/composables/useAsync'
import { usePlans } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { formatDate, formatMoney } from '@/utils/format'
import type { Plan, SubscriptionPayment } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()
const { data: sub, loading, refresh } = useAsync(() => walletApi.subscription())
const { data: payments, refresh: refreshPayments } = useAsync(() => walletApi.subscriptionPayments())
const { data: plans } = usePlans()
const plansOpen = ref(false)
const interval = ref<'monthly' | 'yearly'>('monthly')
const selected = ref<Plan | null>(null)
const receipt = ref<SubscriptionPayment | null>(null)

async function cancel() {
  if (!(await ui.confirm({ title: 'Cancel your subscription?', description: 'You’ll keep premium features until the end of your billing period.', variant: 'danger', confirmLabel: 'Cancel subscription' }))) return
  await walletApi.cancelSubscription()
  await auth.refreshUser()
  ui.success('Subscription cancelled')
  void refresh()
}
function onSubscribed() {
  plansOpen.value = false
  void refresh()
  void refreshPayments()
}
</script>

<template>
  <div class="container-app pb-10">
    <h1 class="text-3xl md:text-4xl">Premium</h1>
    <h2 class="mt-10 text-sm font-medium">Current Plan</h2>
    <UiSkeleton v-if="loading || !sub" class="mt-3 h-32 rounded-2xl" />
    <div v-else class="mt-3 flex flex-col gap-4 rounded-2xl border border-brand-600 bg-brand-50/40 p-5 sm:flex-row sm:items-center">
      <span class="flex h-12 w-12 items-center justify-center rounded-full border border-ink-200 bg-white"><Sparkles class="h-6 w-6 text-warning-500" /></span>
      <div class="flex-1">
        <p class="flex items-center gap-2 text-2xl font-medium">{{ sub.plan.name }} <UiBadge v-if="sub.status !== 'active'" :status="sub.status" /></p>
        <p class="text-sm text-ink-500">{{ sub.plan.tier === 'free' ? 'Free, but limited features' : sub.renewsAt && !sub.cancelledAt ? `Renews ${formatDate(sub.renewsAt)}` : sub.cancelledAt ? `Access ends ${formatDate(sub.renewsAt ?? sub.cancelledAt)}` : '' }}</p>
      </div>
      <div class="text-right">
        <UiButton v-if="sub.plan.tier === 'free' || sub.status === 'cancelled'" @click="plansOpen = true">Join Premium <Sparkles class="h-4 w-4" /></UiButton>
        <div v-else class="flex gap-2"><UiButton variant="outline" @click="plansOpen = true">Change plan</UiButton><UiButton variant="ghost" class="text-danger-500" @click="cancel">Cancel</UiButton></div>
        <p v-if="sub.plan.tier === 'free'" class="mt-2 text-sm text-ink-500">Starts from {{ formatMoney(plans?.find((p) => p.tier === 'basic')?.priceMonthly ?? 300000) }}/month. Cancel anytime</p>
      </div>
    </div>

    <section class="mt-10">
      <h2 class="text-sm font-medium">Payment History</h2>
      <p v-if="!payments?.length" class="mt-2 text-xs text-ink-500">You have no payments yet</p>
      <div v-else class="card mt-3 divide-y divide-ink-100">
        <button v-for="p in payments" :key="p.id" type="button" class="flex w-full items-center justify-between p-4 text-left hover:bg-ink-50" @click="receipt = p">
          <div><p class="font-medium">{{ p.plan.name }} plan</p><p class="text-xs text-ink-500">{{ formatDate(p.paidAt) }} · {{ p.reference }}</p></div>
          <div class="text-right"><p class="font-medium">{{ formatMoney(p.amount, p.currency) }}</p><UiBadge :status="p.status" size="sm" /></div>
        </button>
      </div>
    </section>

    <UiModal v-model:open="plansOpen" title="Choose a plan" size="full">
      <UiTabs v-model="interval" variant="segment" class="w-fit" :tabs="[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]" />
      <PlanCards class="mt-6" :plans="plans ?? []" :interval="interval" :current-tier="sub?.status === 'active' ? sub?.plan.tier : 'free'" @select="(p) => p.tier !== 'free' && (selected = p)" />
    </UiModal>
    <SubscribeModal :plan="selected" :interval="interval" @close="selected = null" @subscribed="onSubscribed" />
    <UiModal :open="!!receipt" title="Transaction details" @update:open="receipt = null">
      <dl v-if="receipt" class="divide-y divide-ink-100 text-sm">
        <div v-for="row in [['Plan', receipt.plan.name], ['Amount', formatMoney(receipt.amount, receipt.currency)], ['Status', receipt.status], ['Reference', receipt.reference], ['Date', formatDate(receipt.paidAt)]]" :key="row[0]" class="flex justify-between py-3"><dt class="text-ink-500">{{ row[0] }}</dt><dd class="font-medium capitalize">{{ row[1] }}</dd></div>
      </dl>
    </UiModal>
  </div>
</template>
