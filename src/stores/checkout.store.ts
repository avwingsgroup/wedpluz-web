import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AdditionalGuest, AttendeeInfo, CheckoutQuote, Event, FoodLineInput, OrderLineInput, PaymentMethod, SeatSelection } from '@/types'
import { uuid } from '@/utils/id'
import { sessionStore } from '@/utils/storage'

const REFERRAL_KEY = (eventId: string) => `wp.ref.${eventId}`
const REFERRAL_PATTERN = /^[A-Za-z0-9_-]{2,40}$/

export type CheckoutStep = 'tickets' | 'attendee' | 'seats' | 'menu' | 'payment' | 'success'

/**
 * Client-side checkout draft. Nothing here is authoritative: prices, availability,
 * discounts and totals always come from the backend quote.
 */
export const useCheckoutStore = defineStore('checkout', () => {
  const event = ref<Event | null>(null)
  const open = ref(false)
  const step = ref<CheckoutStep>('tickets')
  const lines = ref<Record<string, number>>({})
  const foodLines = ref<Record<string, number>>({})
  const promoCode = ref<string | null>(null)
  const quote = ref<CheckoutQuote | null>(null)
  const attendee = ref<AttendeeInfo>({ firstName: '', lastName: '', email: '' })
  const hasAdditionalGuests = ref(false)
  const additionalGuests = ref<AdditionalGuest[]>([])
  const seats = ref<SeatSelection[]>([])
  const paymentMethod = ref<PaymentMethod | null>(null)
  const idempotencyKey = ref(uuid())
  const orderId = ref<string | null>(null)
  const mode = ref<'purchase' | 'request'>('purchase')
  const referralCode = ref<string | null>(null)

  const ticketCount = computed(() => Object.values(lines.value).reduce((a, b) => a + b, 0))
  const lineInputs = computed<OrderLineInput[]>(() => Object.entries(lines.value).filter(([, q]) => q > 0).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })))
  const foodInputs = computed<FoodLineInput[]>(() => Object.entries(foodLines.value).filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity })))
  const needsSeats = computed(() => !!quote.value?.requiresSeatSelection)
  const needsMenu = computed(() => !!quote.value?.requiresMenuSelection)
  const steps = computed<CheckoutStep[]>(() => {
    const s: CheckoutStep[] = ['tickets', 'attendee']
    if (needsSeats.value) s.push('seats')
    if (needsMenu.value) s.push('menu')
    s.push('payment', 'success')
    return s
  })
  const stepIndex = computed(() => steps.value.indexOf(step.value))

  function begin(e: Event, options: { mode?: 'purchase' | 'request'; prefill?: Partial<AttendeeInfo> } = {}) {
    reset()
    event.value = e
    mode.value = options.mode ?? 'purchase'
    referralCode.value = sessionStore.get(REFERRAL_KEY(e.id))
    if (options.prefill) attendee.value = { ...attendee.value, ...options.prefill }
    open.value = true
  }

  function setQuantity(ticketTypeId: string, qty: number) {
    lines.value = { ...lines.value, [ticketTypeId]: Math.max(0, qty) }
  }
  function setFoodQuantity(menuItemId: string, qty: number) {
    foodLines.value = { ...foodLines.value, [menuItemId]: Math.max(0, qty) }
  }
  function next() {
    const i = stepIndex.value
    step.value = steps.value[Math.min(i + 1, steps.value.length - 1)] ?? step.value
  }
  function back() {
    const i = stepIndex.value
    step.value = steps.value[Math.max(i - 1, 0)] ?? step.value
  }
  function goTo(s: CheckoutStep) {
    step.value = s
  }
  function toggleSeat(seat: SeatSelection) {
    const exists = seats.value.find((s) => s.seatId === seat.seatId)
    if (exists) seats.value = seats.value.filter((s) => s.seatId !== seat.seatId)
    else if (seats.value.length < ticketCount.value) seats.value = [...seats.value, seat]
  }
  /** Remembers a promoter code from a share link for this browser session. */
  function rememberReferral(eventId: string, code: unknown) {
    if (typeof code === 'string' && REFERRAL_PATTERN.test(code)) sessionStore.set(REFERRAL_KEY(eventId), code)
  }
  function close() {
    open.value = false
  }
  function reset() {
    event.value = null
    step.value = 'tickets'
    lines.value = {}
    foodLines.value = {}
    promoCode.value = null
    quote.value = null
    attendee.value = { firstName: '', lastName: '', email: '' }
    hasAdditionalGuests.value = false
    additionalGuests.value = []
    seats.value = []
    paymentMethod.value = null
    idempotencyKey.value = uuid()
    orderId.value = null
    referralCode.value = null
  }

  return {
    event, open, step, steps, stepIndex, lines, foodLines, promoCode, quote, attendee, hasAdditionalGuests, additionalGuests, seats, paymentMethod, idempotencyKey, orderId, mode, referralCode,
    ticketCount, lineInputs, foodInputs, needsSeats, needsMenu,
    begin, setQuantity, setFoodQuantity, next, back, goTo, toggleSeat, close, reset, rememberReferral,
  }
})
