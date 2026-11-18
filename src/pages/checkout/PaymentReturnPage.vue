<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import { ticketingApi } from '@/services/api/ticketing.api'
import { formatMoney } from '@/utils/format'
import type { Order } from '@/types'

/**
 * Landing page after a hosted payment redirect. The frontend never decides payment success:
 * it asks the backend to verify with the provider (and the provider webhook is the final
 * authority). We poll briefly to cover webhook latency.
 */
const route = useRoute()
const order = ref<Order | null>(null)
const state = ref<'checking' | 'paid' | 'failed' | 'pending'>('checking')
let attempts = 0
let timer: number | null = null

async function check() {
  const id = String(route.query.order ?? '')
  if (!id) return (state.value = 'failed')
  try {
    order.value = await ticketingApi.verifyPayment(id, { reference: route.query.reference as string | undefined })
    if (order.value.status === 'paid') state.value = 'paid'
    else if (order.value.status === 'failed' || order.value.status === 'cancelled' || order.value.status === 'expired') state.value = 'failed'
    else if (++attempts < 6) timer = window.setTimeout(check, 2500)
    else state.value = 'pending'
  } catch {
    state.value = 'failed'
  }
}
onMounted(check)
onUnmounted(() => timer && window.clearTimeout(timer))
</script>

<template>
  <div class="container-app flex justify-center py-16">
    <div class="card w-full max-w-md p-8 text-center">
      <template v-if="state === 'checking'"><LoaderCircle class="mx-auto h-10 w-10 animate-spin text-brand-600" /><h1 class="mt-4 text-xl">Confirming your payment…</h1><p class="mt-1 text-sm text-ink-500">Please don’t close this page.</p></template>
      <template v-else-if="state === 'paid' && order">
        <CircleCheck class="mx-auto h-12 w-12 text-success-500" />
        <h1 class="mt-4 text-2xl">You’re Attending! 🎉</h1>
        <p class="mt-1 text-sm text-ink-500">{{ order.event.title }} · {{ formatMoney(order.total, order.currency) }}</p>
        <UiButton size="lg" block class="mt-6" :to="{ name: 'tickets', query: { order: order.id } }">View Ticket</UiButton>
      </template>
      <template v-else-if="state === 'pending'"><LoaderCircle class="mx-auto h-10 w-10 text-warning-500" /><h1 class="mt-4 text-xl">Payment still processing</h1><p class="mt-1 text-sm text-ink-500">We’ll notify you and email your tickets as soon as the payment is confirmed.</p><UiButton class="mt-6" :to="{ name: 'tickets' }">Go to My Tickets</UiButton></template>
      <template v-else>
        <CircleX class="mx-auto h-12 w-12 text-danger-500" /><h1 class="mt-4 text-xl">Payment not completed</h1><p class="mt-1 text-sm text-ink-500">No money was taken for this order. You can try again.</p>
        <UiButton class="mt-6" :to="order ? { name: 'event', params: { slug: order.event.slug } } : { name: 'events' }">Back to event</UiButton>
      </template>
    </div>
  </div>
</template>
