<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import UiTabs from '@/components/ui/UiTabs.vue'
import PlanCards from '@/modules/billing/PlanCards.vue'
import SubscribeModal from '@/modules/billing/SubscribeModal.vue'
import { usePlans } from '@/composables/useReferenceData'
import { useAuthStore } from '@/stores/auth.store'
import type { Plan } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const interval = ref<'monthly' | 'yearly'>('monthly')
const { data: plans, isPending: loading } = usePlans()
const selected = ref<Plan | null>(null)
function select(p: Plan) {
  if (!auth.isAuthenticated) return router.push({ name: 'auth.signup', query: { redirect: '/pricing' } })
  if (p.tier === 'free') return router.push({ name: 'home' })
  selected.value = p
}
</script>

<template>
  <!-- Design (pricing, 1440px): title ~106px below the header, 84px from the interval switch to the cards. -->
  <div class="container-app pb-10 pt-12 md:pb-16 md:pt-[106px]">
    <h1 class="text-center text-3xl md:text-[32px] md:leading-10">Pricing &amp; Plan</h1>
    <UiTabs v-model="interval" variant="segment" class="mt-5 w-fit" :tabs="[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]" />
    <PlanCards class="mt-10 md:mt-[84px]" :plans="plans ?? []" :interval="interval" :loading="loading" :current-tier="auth.user?.plan" @select="select" />
    <SubscribeModal :plan="selected" :interval="interval" @close="selected = null" @subscribed="router.push({ name: 'premium' })" />
  </div>
</template>
