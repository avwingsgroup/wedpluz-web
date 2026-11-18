<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, CreditCard, ShoppingCart, Wallet, X } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import UiDrawer from '@/components/ui/UiDrawer.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiToggle from '@/components/ui/UiToggle.vue'
import UiQuantityStepper from '@/components/ui/UiQuantityStepper.vue'
import UiSpinner from '@/components/ui/UiSpinner.vue'
import UiAvatar from '@/components/ui/UiAvatar.vue'
import SeatMap from './SeatMap.vue'
import { useCheckoutStore } from '@/stores/checkout.store'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { ticketingApi } from '@/services/api/ticketing.api'
import { walletApi } from '@/services/api/wallet.api'
import { isApiError } from '@/services/http'
import { formatDate, formatMoney, formatTime } from '@/utils/format'
import { attendeeSchema, additionalGuestSchema } from '@/validations'
import { flattenIssues } from '@/validations/common'
import { env } from '@/config/env'
import type { HallLayout, PaymentMethod } from '@/types'
import { cn } from '@/utils/cn'

const checkout = useCheckoutStore()
const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const event = computed(() => checkout.event!)
const quoting = ref(false)
const quoteError = ref<string | null>(null)
const promoInput = ref('')
const promoError = ref<string | null>(null)
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const layout = ref<HallLayout | null>(null)
const layoutLoading = ref(false)
const walletBalance = ref<number | null>(null)
const showCart = ref(false)
const activeScheduleId = ref<string>('')

watch(
  () => checkout.open,
  (open) => {
    if (open && auth.user && !checkout.attendee.firstName) {
      checkout.attendee = { firstName: auth.user.firstName, lastName: auth.user.lastName, email: auth.user.email }
    }
    if (open) {
      activeScheduleId.value = event.value.schedules[0]?.id ?? ''
      void walletApi.get().then((w) => (walletBalance.value = w.balance)).catch(() => (walletBalance.value = null))
    }
  },
  { immediate: true },
)

/* ---- quoting (backend is the source of truth for totals) ---- */
const requestQuote = useDebounceFn(async () => {
  if (checkout.ticketCount === 0) {
    checkout.quote = null
    return
  }
  quoting.value = true
  quoteError.value = null
  promoError.value = null
  try {
    checkout.quote = await ticketingApi.quote({ eventId: event.value.id, lines: checkout.lineInputs, foodLines: checkout.foodInputs, promoCode: checkout.promoCode, referralCode: checkout.referralCode })
  } catch (e) {
    if (isApiError(e) && e.code === 'PROMO_INVALID') {
      promoError.value = e.message
      checkout.promoCode = null
      void requestQuote()
    } else quoteError.value = (e as Error).message
  } finally {
    quoting.value = false
  }
}, 250)
watch(() => [checkout.lines, checkout.foodLines, checkout.promoCode], () => void requestQuote(), { deep: true })

function applyPromo() {
  checkout.promoCode = promoInput.value.trim() || null
}

/* ---- steps ---- */
const stepTitle = computed(() => ({ tickets: 'Tickets', attendee: 'Attendee info', seats: 'Choose seat', menu: 'Choose food', payment: 'Make payment', success: 'Tickets' })[checkout.step])
const canContinueTickets = computed(() => checkout.ticketCount > 0 && !!checkout.quote && !quoting.value)

async function next() {
  errors.value = {}
  if (checkout.step === 'tickets') {
    if (!canContinueTickets.value) return
    // Free events skip straight to confirmation after attendee info.
    checkout.next()
    return
  }
  if (checkout.step === 'attendee') {
    const res = attendeeSchema.safeParse(checkout.attendee)
    if (!res.success) {
      errors.value = flattenIssues(res.error)
      return
    }
    if (checkout.hasAdditionalGuests) {
      for (const [i, g] of checkout.additionalGuests.entries()) {
        const r = additionalGuestSchema.safeParse(g)
        if (!r.success) {
          for (const [k, v] of Object.entries(flattenIssues(r.error))) errors.value[`guest.${i}.${k}`] = v
        }
      }
      if (Object.keys(errors.value).length) return
    }
    if (checkout.needsSeats) await loadLayout()
    if (!checkout.needsSeats && !checkout.needsMenu && checkout.quote?.total === 0) {
      await placeOrder('free')
      return
    }
    checkout.next()
    return
  }
  if (checkout.step === 'seats') {
    if (checkout.seats.length < checkout.ticketCount) {
      ui.warning(`Choose ${checkout.ticketCount - checkout.seats.length} more seat${checkout.ticketCount - checkout.seats.length > 1 ? 's' : ''}`)
      return
    }
    checkout.next()
    return
  }
  if (checkout.step === 'menu') {
    if (checkout.quote?.total === 0) {
      await placeOrder('free')
      return
    }
    checkout.next()
  }
}

async function loadLayout() {
  if (layout.value) return
  layoutLoading.value = true
  try {
    layout.value = await ticketingApi.seats(event.value.id, activeScheduleId.value || event.value.schedules[0]?.id || '')
  } catch (e) {
    ui.error((e as Error).message)
  } finally {
    layoutLoading.value = false
  }
}

const paymentMethods = computed<Array<{ key: PaymentMethod; label: string; sub: string; icon: unknown }>>(() => [
  { key: 'wallet', label: 'Wallet', sub: walletBalance.value === null ? 'Set up your wallet' : formatMoney(walletBalance.value), icon: Wallet },
  { key: 'card', label: 'Credit or Debit card', sub: 'Visa · Mastercard · Verve', icon: CreditCard },
  { key: 'paypal', label: 'PayPal', sub: 'International payments', icon: CreditCard },
  { key: 'paystack', label: 'Paystack', sub: 'Bank transfer, USSD, card', icon: CreditCard },
])

async function placeOrder(method: PaymentMethod | 'free') {
  if (submitting.value || !checkout.quote) return
  if (method === 'wallet' && walletBalance.value !== null && walletBalance.value < checkout.quote.total) {
    ui.error('Insufficient wallet balance', 'Top up your wallet or choose another payment method.')
    return
  }
  submitting.value = true
  try {
    const { order, payment } = await ticketingApi.createOrder({
      quoteId: checkout.quote.quoteId,
      attendee: checkout.attendee,
      additionalGuests: checkout.hasAdditionalGuests ? checkout.additionalGuests : [],
      seats: checkout.seats,
      paymentMethod: method === 'free' ? 'free' : method,
      idempotencyKey: checkout.idempotencyKey,
      returnUrl: `${env.webOrigin}/checkout/return`,
    })
    checkout.orderId = order.id
    if (order.status === 'paid') {
      checkout.goTo('success')
      return
    }
    if (payment.authorizationUrl) {
      // Redirect/hosted flow (Paystack, PayPal, Monnify). Same pattern for live providers.
      checkout.close()
      if (payment.authorizationUrl.startsWith('/')) router.push(payment.authorizationUrl)
      else window.location.href = payment.authorizationUrl
      return
    }
    checkout.goTo('success')
  } catch (e) {
    if (isApiError(e)) {
      if (e.code === 'SEAT_TAKEN') {
        ui.error('Seat no longer available', e.message)
        layout.value = null
        checkout.seats = []
        await loadLayout()
        checkout.goTo('seats')
      } else if (e.code === 'TICKETS_UNAVAILABLE') {
        ui.error('Tickets unavailable', e.message)
        checkout.goTo('tickets')
        void requestQuote()
      } else if (e.status === 410) {
        ui.error('Checkout expired', e.message)
        void requestQuote()
        checkout.goTo('tickets')
      } else ui.error(e.message)
    } else ui.error('Could not complete your order')
  } finally {
    submitting.value = false
  }
}

function viewTicket() {
  const id = checkout.orderId
  checkout.close()
  router.push({ name: 'tickets', query: id ? { order: id } : undefined })
  checkout.reset()
}
function close() {
  if (checkout.step === 'success') checkout.reset()
  checkout.close()
}
watch(() => checkout.hasAdditionalGuests, (v) => { if (v && !checkout.additionalGuests.length) checkout.additionalGuests = [{ firstName: '', lastName: '', email: '' }] })
const maxGuests = computed(() => event.value.maxAdditionalGuests || 5)
</script>

<template>
  <UiDrawer :open="checkout.open" :padded="false" @update:open="close">
    <template #header>
      <h2 class="-mt-1 text-xl font-bold">{{ stepTitle }}</h2>
      <p v-if="checkout.step === 'seats'" class="text-sm text-ink-500">Zoom in and tap on a seat to select</p>
    </template>

    <div class="flex h-full flex-col">
      <!-- order summary pill (cart) -->
      <div v-if="checkout.quote && checkout.step !== 'tickets' && checkout.step !== 'success'" class="px-6 pb-3">
        <button type="button" class="flex w-full items-center gap-2 rounded-2xl border border-ink-200 px-4 py-2.5 text-sm hover:bg-ink-50" @click="showCart = !showCart">
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-pink-100 text-pink-600"><ShoppingCart class="h-4 w-4" /></span>
          <span>Your Order: <strong>{{ formatMoney(checkout.quote.total) }}</strong></span>
          <ChevronRight :class="cn('ml-auto h-4 w-4 transition-transform', showCart && 'rotate-90')" />
        </button>
        <div v-if="showCart" class="card mt-2 divide-y divide-ink-100 text-sm">
          <div class="p-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">Tickets</p>
            <div v-for="l in checkout.quote.lines" :key="l.ticketType.id" class="flex justify-between py-1"><span>{{ l.ticketType.name }}</span><span><span class="mr-3 text-ink-400">x{{ l.quantity }}</span>{{ formatMoney(l.subtotal) }}</span></div>
          </div>
          <div v-if="checkout.quote.foodLines.length" class="p-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">Food</p>
            <div v-for="l in checkout.quote.foodLines" :key="l.menuItem.id" class="flex justify-between py-1"><span>{{ l.menuItem.name }}</span><span><span class="mr-3 text-ink-400">x{{ l.quantity }}</span>{{ formatMoney(l.subtotal) }}</span></div>
          </div>
          <div class="space-y-1 p-4">
            <div v-if="checkout.quote.serviceFee" class="flex justify-between text-ink-500"><span>Service fee</span><span>{{ formatMoney(checkout.quote.serviceFee) }}</span></div>
            <div v-if="checkout.quote.discount" class="flex justify-between text-success-600"><span>Discount</span><span>-{{ formatMoney(checkout.quote.discount) }}</span></div>
            <div class="flex justify-between font-semibold"><span>Total so far</span><span>{{ formatMoney(checkout.quote.total) }}</span></div>
          </div>
        </div>
      </div>

      <!-- STEP: tickets -->
      <div v-if="checkout.step === 'tickets'" class="flex-1 space-y-3 overflow-y-auto px-6">
        <div v-if="event.schedules.length > 1" class="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          <button v-for="s in event.schedules" :key="s.id" type="button" :class="cn('chip shrink-0 px-3 py-1.5', activeScheduleId === s.id && 'border-brand-600 bg-brand-50 text-brand-600')" @click="activeScheduleId = s.id">{{ s.label ?? formatDate(s.startsAt) }} · {{ formatDate(s.startsAt) }}</button>
        </div>
        <div v-for="t in event.ticketTypes.filter((t) => t.isActive && (!t.scheduleId || t.scheduleId === activeScheduleId))" :key="t.id" class="card flex items-center justify-between gap-4 p-4">
          <div class="min-w-0">
            <p class="font-medium text-ink-900">{{ t.name }} <span v-if="t.isEarlyBird" class="ml-1 rounded-full bg-pink-100 px-2 py-0.5 text-[11px] text-pink-600">Early bird</span></p>
            <p class="text-sm text-ink-500">{{ t.price === 0 ? 'Free' : formatMoney(t.price, t.currency) }} <template v-if="t.salesEndAt">· Sales end {{ formatDate(t.salesEndAt) }}</template></p>
            <p v-if="t.quantity - t.sold <= 10" class="mt-0.5 text-xs text-danger-500">{{ t.quantity - t.sold > 0 ? `Only ${t.quantity - t.sold} left` : 'Sold out' }}</p>
            <p v-if="t.description" class="mt-1 text-xs text-ink-500">{{ t.description }}</p>
          </div>
          <UiQuantityStepper :model-value="checkout.lines[t.id] ?? 0" :max="Math.min(t.perOrderLimit, t.quantity - t.sold)" :disabled="t.quantity - t.sold <= 0" :label="`${t.name} quantity`" @update:model-value="checkout.setQuantity(t.id, $event)" />
        </div>
        <div v-if="checkout.ticketCount > 0 && !event.isFree" class="card p-4">
          <p class="mb-2 text-sm font-medium">Promo code</p>
          <div class="flex gap-2">
            <UiInput v-model="promoInput" placeholder="Enter code" :error="promoError ?? undefined" class="flex-1" @enter="applyPromo" />
            <UiButton variant="secondary" @click="applyPromo">Apply</UiButton>
          </div>
          <p v-if="checkout.quote?.promoMessage" class="mt-2 text-sm text-success-600">{{ checkout.quote.promoMessage }}</p>
        </div>
        <p v-if="quoteError" class="text-sm text-danger-500">{{ quoteError }}</p>
      </div>

      <!-- STEP: attendee -->
      <div v-else-if="checkout.step === 'attendee'" class="flex-1 space-y-4 overflow-y-auto px-6">
        <div class="card flex items-center gap-3 p-3">
          <img :src="event.coverUrl" alt="" class="h-14 w-14 rounded-lg object-cover" />
          <div class="min-w-0"><p class="truncate font-medium">{{ event.title }}</p><p class="text-sm text-ink-500">{{ formatDate(event.startsAt) }} · {{ formatTime(event.startsAt) }}</p><p class="text-sm font-medium">{{ checkout.quote ? (checkout.quote.total === 0 ? 'Free' : formatMoney(checkout.quote.total)) : '' }}</p></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <UiInput v-model="checkout.attendee.firstName" label="First Name" required :error="errors.firstName" autocomplete="given-name" />
          <UiInput v-model="checkout.attendee.lastName" label="Last Name" required :error="errors.lastName" autocomplete="family-name" />
        </div>
        <UiInput v-model="checkout.attendee.email" type="email" label="Email Address" required :error="errors.email" autocomplete="email" hint="Your tickets will be sent here" />
        <div v-if="event.allowGuestInvites" class="card p-4">
          <UiToggle v-model="checkout.hasAdditionalGuests" label="I have additional guests" :description="`Max: ${maxGuests}`" />
          <div v-if="checkout.hasAdditionalGuests" class="mt-4 space-y-3">
            <div v-for="(g, i) in checkout.additionalGuests" :key="i" class="rounded-xl bg-ink-50 p-3">
              <div class="mb-2 flex items-center justify-between"><span class="text-sm font-medium">Guest {{ i + 1 }}</span><button type="button" class="text-ink-400 hover:text-danger-500" aria-label="Remove guest" @click="checkout.additionalGuests.splice(i, 1)"><X class="h-4 w-4" /></button></div>
              <div class="grid grid-cols-2 gap-3">
                <UiInput v-model="g.firstName" placeholder="First name" :error="errors[`guest.${i}.firstName`]" />
                <UiInput v-model="g.lastName" placeholder="Last name" :error="errors[`guest.${i}.lastName`]" />
              </div>
            </div>
            <UiButton v-if="checkout.additionalGuests.length < maxGuests" variant="soft" size="sm" @click="checkout.additionalGuests.push({ firstName: '', lastName: '', email: '' })">+ Add another guest</UiButton>
          </div>
        </div>
      </div>

      <!-- STEP: seats -->
      <div v-else-if="checkout.step === 'seats'" class="-mx-0 flex min-h-[420px] flex-1 flex-col">
        <UiSpinner v-if="layoutLoading || !layout" page label="Loading hall layout…" />
        <template v-else>
          <div v-if="event.schedules.length > 1" class="flex gap-2 overflow-x-auto px-6 pb-2 scrollbar-none">
            <button v-for="s in event.schedules" :key="s.id" type="button" :class="cn('chip shrink-0', activeScheduleId === s.id && 'border-brand-600 bg-brand-50 text-brand-600')" @click="activeScheduleId = s.id; layout = null; loadLayout()">{{ s.label ?? formatDate(s.startsAt) }}</button>
          </div>
          <SeatMap class="flex-1" :layout="layout" :schedule-id="activeScheduleId" :selected="checkout.seats" :max="checkout.ticketCount" @toggle="checkout.toggleSeat" />
          <div v-if="checkout.seats.length" class="flex flex-wrap gap-2 px-6 py-3 text-xs">
            <span v-for="s in checkout.seats" :key="s.seatId" class="rounded-full bg-success-50 px-3 py-1 text-success-600">{{ s.tableLabel }} · {{ s.seatLabel }}</span>
          </div>
        </template>
      </div>

      <!-- STEP: menu -->
      <div v-else-if="checkout.step === 'menu'" class="flex-1 space-y-5 overflow-y-auto px-6">
        <p class="text-sm text-ink-500">Pre-order food for your table. Optional, you can skip this step.</p>
        <div v-for="cat in [...new Set(event.menu.map((m) => m.category))]" :key="cat">
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-600">{{ cat }}</h3>
          <div class="space-y-2">
            <div v-for="m in event.menu.filter((x) => x.category === cat)" :key="m.id" class="card flex items-center gap-3 p-3">
              <UiAvatar :src="m.imageUrl" :name="m.name" size="lg" square />
              <div class="min-w-0 flex-1"><p class="font-medium">{{ m.name }}</p><p class="line-clamp-1 text-xs text-ink-500">{{ m.description }}</p><p class="text-sm font-medium">{{ formatMoney(m.price, m.currency) }}</p></div>
              <UiQuantityStepper :model-value="checkout.foodLines[m.id] ?? 0" :max="20" :disabled="!m.isAvailable" :label="`${m.name} quantity`" @update:model-value="checkout.setFoodQuantity(m.id, $event)" />
            </div>
          </div>
        </div>
      </div>

      <!-- STEP: payment -->
      <div v-else-if="checkout.step === 'payment'" class="flex-1 space-y-3 overflow-y-auto px-6">
        <p class="font-semibold">Add a payment method</p>
        <label v-for="m in paymentMethods" :key="m.key" :class="cn('card flex cursor-pointer items-center gap-3 p-4 transition-colors', checkout.paymentMethod === m.key && 'border-brand-600 bg-brand-50/30')">
          <component :is="m.icon" class="h-5 w-5 text-ink-700" />
          <span class="min-w-0 flex-1"><span class="block font-medium">{{ m.label }}</span><span class="block text-xs text-ink-500">{{ m.sub }}</span></span>
          <input type="radio" name="payment" class="h-5 w-5 accent-brand-600" :checked="checkout.paymentMethod === m.key" @change="checkout.paymentMethod = m.key" />
        </label>
        <p class="text-xs text-ink-500">Payments are processed securely by our payment partners. Wedpluz never stores your card details.</p>
      </div>

      <!-- STEP: success -->
      <div v-else-if="checkout.step === 'success'" class="flex flex-1 flex-col px-6">
        <h3 class="text-2xl font-bold">You’re Attending! 🎉</h3>
        <p class="mt-1 text-ink-500">You’ve successfully registered for the event! We can’t wait to see you there.</p>
        <div class="flex flex-1 items-center justify-center py-10" aria-hidden="true">
          <svg viewBox="0 0 160 140" class="h-40 w-44"><g fill="none" stroke-width="5" stroke-linecap="round"><path d="M20 90c20-30 10-50 40-60" stroke="#c766c7" /><path d="M60 110c15-10 35-5 50-30" stroke="#3b6ff2" /><path d="M100 20c10 20 30 25 40 50" stroke="#9b119b" /><path d="M30 120c10-5 10-20 25-25" stroke="#e7257f" /></g><g fill="#9b119b"><circle cx="40" cy="30" r="4" /><circle cx="120" cy="100" r="4" /><circle cx="70" cy="60" r="3" /></g><g fill="#3b6ff2"><path d="M130 30l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" /><path d="M20 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" /></g></svg>
        </div>
        <div class="card border-brand-200 p-4">
          <img :src="event.coverUrl" alt="" class="h-16 w-16 rounded-lg object-cover" />
          <p class="mt-3 font-medium">{{ event.title }}</p>
          <p class="text-sm text-ink-500">{{ formatDate(event.startsAt) }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <div v-if="checkout.step !== 'success'" class="mb-3 grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${checkout.steps.length - 1}, 1fr)` }" aria-hidden="true">
        <span v-for="(s, i) in checkout.steps.slice(0, -1)" :key="s" :class="cn('h-1 rounded-full', i <= checkout.stepIndex ? 'bg-brand-600' : 'bg-ink-200')" />
      </div>
      <div v-if="checkout.step === 'tickets'" class="flex gap-3"><UiButton size="lg" block :disabled="!canContinueTickets" :loading="quoting" @click="next">Continue <ChevronRight class="h-4 w-4" /></UiButton></div>
      <div v-else-if="checkout.step === 'success'"><UiButton size="lg" block @click="viewTicket">View Ticket</UiButton></div>
      <div v-else-if="checkout.step === 'payment'" class="flex gap-3">
        <UiButton size="lg" variant="secondary" class="flex-1" @click="checkout.back()"><ChevronLeft class="h-4 w-4" /> Back</UiButton>
        <UiButton size="lg" class="flex-[1.4]" :disabled="!checkout.paymentMethod" :loading="submitting" @click="placeOrder(checkout.paymentMethod!)">Make payments <ChevronRight class="h-4 w-4" /></UiButton>
      </div>
      <div v-else class="flex gap-3">
        <UiButton size="lg" variant="secondary" class="flex-1" @click="checkout.back()"><ChevronLeft class="h-4 w-4" /> Back</UiButton>
        <UiButton size="lg" class="flex-[1.4]" :loading="submitting" @click="next">{{ checkout.step === 'menu' && checkout.foodInputs.length === 0 ? 'Skip' : 'Next' }} <ChevronRight class="h-4 w-4" /></UiButton>
      </div>
    </template>
  </UiDrawer>
</template>
