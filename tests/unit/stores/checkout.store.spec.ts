import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCheckoutStore } from '@/stores/checkout.store'
import type { CheckoutQuote, Event } from '@/types'

const event = { id: 'evt_movie', slug: 'movie', title: 'Movie in the park' } as unknown as Event
const quote = (overrides: Partial<CheckoutQuote> = {}) =>
  ({ quoteId: 'qt_1', currency: 'NGN', lines: [], foodLines: [], subtotal: 0, serviceFee: 0, discount: 0, total: 0, promoCode: null, promoMessage: null, requiresSeatSelection: false, requiresMenuSelection: false, expiresAt: '2026-12-01T00:00:00Z', ...overrides }) as CheckoutQuote

describe('checkout store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('builds API line inputs from non-zero quantities only', () => {
    const c = useCheckoutStore()
    c.begin(event)
    c.setQuantity('tt_regular', 2)
    c.setQuantity('tt_vip', 0)
    c.setFoodQuantity('food_jollof', 1)
    expect(c.lineInputs).toEqual([{ ticketTypeId: 'tt_regular', quantity: 2 }])
    expect(c.foodInputs).toEqual([{ menuItemId: 'food_jollof', quantity: 1 }])
    expect(c.ticketCount).toBe(2)
  })

  it('never lets quantities go negative', () => {
    const c = useCheckoutStore()
    c.setQuantity('tt_regular', -3)
    expect(c.lines.tt_regular).toBe(0)
  })

  it('adds seat and menu steps only when the server quote requires them', () => {
    const c = useCheckoutStore()
    c.begin(event)
    expect(c.steps).toEqual(['tickets', 'attendee', 'payment', 'success'])
    c.quote = quote({ requiresSeatSelection: true, requiresMenuSelection: true })
    expect(c.steps).toEqual(['tickets', 'attendee', 'seats', 'menu', 'payment', 'success'])
    c.next()
    c.next()
    expect(c.step).toBe('seats')
    c.back()
    expect(c.step).toBe('attendee')
  })

  it('caps selected seats at the ticket count and toggles seats off', () => {
    const c = useCheckoutStore()
    c.begin(event)
    c.setQuantity('tt_regular', 1)
    const seat = (id: string) => ({ scheduleId: 'sch_1', seatId: id, tableLabel: 'T1', seatLabel: id })
    c.toggleSeat(seat('s1'))
    c.toggleSeat(seat('s2'))
    expect(c.seats.map((s) => s.seatId)).toEqual(['s1'])
    c.toggleSeat(seat('s1'))
    expect(c.seats).toEqual([])
  })

  it('issues a fresh idempotency key for every new checkout', () => {
    const c = useCheckoutStore()
    c.begin(event)
    const first = c.idempotencyKey
    c.begin(event)
    expect(c.idempotencyKey).not.toBe(first)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('remembers a valid promoter referral code per event for the session', () => {
    const c = useCheckoutStore()
    c.rememberReferral('evt_movie', 'JOHNB')
    c.begin(event)
    expect(c.referralCode).toBe('JOHNB')
    c.begin({ ...event, id: 'evt_other' } as Event)
    expect(c.referralCode).toBeNull()
  })

  it('ignores malformed referral codes from the URL', () => {
    const c = useCheckoutStore()
    c.rememberReferral('evt_movie', '<script>')
    c.rememberReferral('evt_movie', ['A', 'B'])
    c.begin(event)
    expect(c.referralCode).toBeNull()
  })
})
