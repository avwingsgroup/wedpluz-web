<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CreditCard, Wallet } from 'lucide-vue-next'
import UiModal from '@/components/ui/UiModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { walletApi } from '@/services/api/wallet.api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { formatMoney } from '@/utils/format'
import { uuid } from '@/utils/id'
import { cn } from '@/utils/cn'
import type { Plan } from '@/types'

const props = defineProps<{ plan: Plan | null; interval: 'monthly' | 'yearly' }>()
const emit = defineEmits<{ close: []; subscribed: [] }>()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const method = ref<'wallet' | 'card' | 'paystack'>('card')
const submitting = ref(false)
const key = ref(uuid())
watch(() => props.plan, () => (key.value = uuid()))

async function subscribe() {
  if (!props.plan) return
  submitting.value = true
  try {
    const res = await walletApi.subscribe({ planId: props.plan.id, interval: props.interval, paymentMethod: method.value, idempotencyKey: key.value })
    await auth.refreshUser()
    if (res.authorizationUrl) {
      emit('close')
      router.push(res.authorizationUrl)
      return
    }
    ui.success(`Welcome to ${props.plan.name}!`)
    emit('subscribed')
    emit('close')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UiModal :open="!!plan" :title="plan ? `Subscribe to ${plan.name}` : ''" @update:open="emit('close')">
    <div v-if="plan" class="space-y-4">
      <div class="rounded-2xl bg-brand-50 p-4"><p class="text-sm text-ink-500">{{ interval === 'yearly' ? 'Billed yearly' : 'Billed monthly' }}</p><p class="text-2xl font-bold">{{ formatMoney(interval === 'yearly' ? plan.priceYearly : plan.priceMonthly) }}</p></div>
      <p class="text-sm font-medium">Payment method</p>
      <label v-for="m in [{ key: 'card', label: 'Card', icon: CreditCard }, { key: 'paystack', label: 'Paystack', icon: CreditCard }, { key: 'wallet', label: 'Wallet balance', icon: Wallet }]" :key="m.key" :class="cn('card flex cursor-pointer items-center gap-3 p-4', method === m.key && 'border-brand-600 bg-brand-50/30')">
        <component :is="m.icon" class="h-5 w-5" /><span class="flex-1">{{ m.label }}</span><input type="radio" class="accent-brand-600" :checked="method === m.key" @change="method = m.key as typeof method" />
      </label>
      <p class="text-xs text-ink-500">Renews automatically. Cancel anytime from Premium settings; you keep access until the end of the period.</p>
    </div>
    <template #footer><UiButton size="lg" block :loading="submitting" @click="subscribe">Confirm and pay</UiButton></template>
  </UiModal>
</template>
