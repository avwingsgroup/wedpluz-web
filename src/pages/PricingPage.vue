<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import UiTabs from '@/components/ui/UiTabs.vue'
import PlanCards from '@/modules/billing/PlanCards.vue'
import SubscribeModal from '@/modules/billing/SubscribeModal.vue'
import { usePlans } from '@/composables/useReferenceData'
import { useSeo } from '@/composables/useSeo'
import { useAuthStore } from '@/stores/auth.store'
import type { Plan } from '@/types'

useSeo({ title: 'Pricing & Plan', description: 'Wedpluz plans for organizers and vendors.' })
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
  <div class="container-app pb-10 pt-12">
    <h1 class="text-center text-3xl md:text-4xl">Pricing &amp; Plan</h1>
    <UiTabs v-model="interval" variant="segment" class="mt-6 w-fit" :tabs="[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]" />
    <PlanCards class="mt-10" :plans="plans ?? []" :interval="interval" :loading="loading" :current-tier="auth.user?.plan" @select="select" />
    <SubscribeModal :plan="selected" :interval="interval" @close="selected = null" @subscribed="router.push({ name: 'premium' })" />
  </div>
</template>
