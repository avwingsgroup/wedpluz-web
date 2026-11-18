<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Lock, TriangleAlert } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import { isMockApi } from '@/config/env'
import { ticketingApi } from '@/services/api/ticketing.api'
import { walletApi } from '@/services/api/wallet.api'
import { useUiStore } from '@/stores/ui.store'

/**
 * DEVELOPMENT ONLY. Stands in for the hosted payment page of Paystack / PayPal / Monnify
 * so the redirect-and-verify flow can be exercised without credentials. In live mode the
 * backend returns the provider's real authorization URL and this page is never reached.
 */
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const busy = ref(false)
const provider = computed(() => String(route.query.provider ?? 'paystack'))

async function complete(result: 'success' | 'failed') {
  busy.value = true
  try {
    if (route.query.order) {
      await ticketingApi.verifyPayment(String(route.query.order), { simulate: result })
      router.replace({ name: 'checkout.return', query: { order: route.query.order } })
    } else if (route.query.topup) {
      if (result === 'success') await walletApi.verifyTopUp(String(route.query.topup))
      ui[result === 'success' ? 'success' : 'error'](result === 'success' ? 'Wallet topped up' : 'Top up failed')
      router.replace({ name: 'wallet' })
    } else {
      ui.success('Payment complete')
      router.replace({ name: 'premium' })
    }
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container-app flex justify-center py-16">
    <div class="card w-full max-w-md p-8 text-center">
      <div v-if="!isMockApi" class="text-danger-500"><TriangleAlert class="mx-auto h-8 w-8" /><p class="mt-2">This page is only available in mock API mode.</p></div>
      <template v-else>
        <Lock class="mx-auto h-8 w-8 text-brand-600" />
        <h1 class="mt-3 text-xl capitalize">{{ provider }} checkout (simulated)</h1>
        <p class="mt-2 text-sm text-ink-500">This screen replaces the provider’s hosted payment page during development.</p>
        <div class="mt-6 grid gap-3">
          <UiButton size="lg" :loading="busy" @click="complete('success')">Simulate successful payment</UiButton>
          <UiButton size="lg" variant="outline" :disabled="busy" @click="complete('failed')">Simulate failed payment</UiButton>
        </div>
      </template>
    </div>
  </div>
</template>
