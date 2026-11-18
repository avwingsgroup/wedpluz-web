import { addMinutes } from 'date-fns'
import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch } from './shared'
import { shortCode } from '@/utils/id'
import type { CheckoutQuote, CreateOrderPayload, Order, PaymentIntent, Ticket } from '@/types'

const quotes = new Map<string, CheckoutQuote & { eventId: string }>()
const idempotency = new Map<string, Order>()
const PROMO_CODES: Record<string, { percent: number; message: string }> = {
  WEDPLUZ10: { percent: 10, message: '10% off applied' },
  EARLYBIRD: { percent: 15, message: 'Early bird 15% off applied' },
}

export function registerTicketingHandlers() {
  route('POST', '/checkout/quotes', (req) => {
    const b = body<{ eventId: string; lines: Array<{ ticketTypeId: string; quantity: number }>; foodLines?: Array<{ menuItemId: string; quantity: number }>; promoCode?: string | null }>(req)
    requireFields(b, ['eventId'])
    const e = db.findEvent(b.eventId)
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    const lines = (b.lines ?? []).filter((l) => l.quantity > 0)
    if (!lines.length) fail(422, 'VALIDATION_ERROR', 'Select at least one ticket.', { lines: ['Select at least one ticket.'] })
    const quoteLines = lines.map((l) => {
      const t = e.ticketTypes.find((x) => x.id === l.ticketTypeId)
      if (!t) fail(422, 'VALIDATION_ERROR', 'Ticket type not found.')
      if (t.quantity - t.sold < l.quantity) fail(409, 'TICKETS_UNAVAILABLE', `Only ${t.quantity - t.sold} ${t.name} tickets left.`)
      if (l.quantity > t.perOrderLimit) fail(422, 'VALIDATION_ERROR', `Max ${t.perOrderLimit} ${t.name} per order.`)
      return { ticketType: { id: t.id, name: t.name, price: t.price, currency: t.currency }, quantity: l.quantity, subtotal: t.price * l.quantity }
    })
    const foodLines = (b.foodLines ?? []).filter((l) => l.quantity > 0).map((l) => {
      const m = e.menu.find((x) => x.id === l.menuItemId)
      if (!m) fail(422, 'VALIDATION_ERROR', 'Menu item not found.')
      return { menuItem: { id: m.id, name: m.name, price: m.price }, quantity: l.quantity, subtotal: m.price * l.quantity }
    })
    const subtotal = quoteLines.reduce((a, l) => a + l.subtotal, 0) + foodLines.reduce((a, l) => a + l.subtotal, 0)
    let discount = 0
    let promoMessage: string | null = null
    if (b.promoCode) {
      const promo = PROMO_CODES[b.promoCode.toUpperCase()]
      if (!promo) fail(422, 'PROMO_INVALID', 'That promo code is not valid.', { promoCode: ['Invalid promo code'] })
      discount = Math.round(subtotal * (promo.percent / 100))
      promoMessage = promo.message
    }
    const serviceFee = subtotal > 0 ? Math.round(subtotal * (db.settings.payments.serviceFeePercent / 100)) + db.settings.payments.serviceFeeFixed : 0
    const quote: CheckoutQuote & { eventId: string } = {
      quoteId: db.nextId('qt'),
      eventId: e.id,
      currency: 'NGN',
      lines: quoteLines,
      foodLines,
      subtotal,
      serviceFee,
      discount,
      total: Math.max(0, subtotal - discount + serviceFee),
      promoCode: b.promoCode ?? null,
      promoMessage,
      requiresSeatSelection: quoteLines.some((l) => e.ticketTypes.find((t) => t.id === l.ticketType.id)?.seatSelection),
      requiresMenuSelection: quoteLines.some((l) => e.ticketTypes.find((t) => t.id === l.ticketType.id)?.menuSelection),
      expiresAt: addMinutes(new Date(), 15).toISOString(),
    }
    quotes.set(quote.quoteId, quote)
    return data(quote)
  })

  route('GET', '/events/:id/schedules/:scheduleId/seats', (req) => {
    const e = db.findEvent(req.params.id ?? '')
    if (!e) fail(404, 'NOT_FOUND', 'Event not found')
    const s = e.schedules.find((x) => x.id === req.params.scheduleId)
    const layout = db.hallLayouts.find((h) => h.id === (s?.hallLayoutId ?? 'hall_1')) ?? db.hallLayout
    return data(layout)
  })

  route('POST', '/orders', (req) => {
    const user = requireUser(req)
    const b = body<CreateOrderPayload>(req)
    requireFields(b as unknown as Record<string, unknown>, ['quoteId', 'attendee', 'paymentMethod', 'idempotencyKey'])
    const existing = idempotency.get(b.idempotencyKey)
    if (existing) return data({ order: existing, payment: paymentFor(existing, b.paymentMethod) })
    const quote = quotes.get(b.quoteId)
    if (!quote) fail(410, 'CONFLICT', 'Your checkout session expired. Please start again.')
    if (!b.attendee.firstName || !b.attendee.lastName || !b.attendee.email) fail(422, 'VALIDATION_ERROR', 'Attendee details are required.', { 'attendee.firstName': ['Required'] })
    const e = db.findEvent(quote.eventId)!
    if (quote.requiresSeatSelection) {
      const needed = quote.lines.reduce((a, l) => a + l.quantity, 0)
      if ((b.seats ?? []).length < needed) fail(422, 'VALIDATION_ERROR', `Choose ${needed} seat${needed > 1 ? 's' : ''} to continue.`, { seats: ['Select your seats'] })
      for (const seat of b.seats) {
        for (const t of db.hallLayout.tables) {
          const s = t.seats.find((x) => x.id === seat.seatId)
          if (s?.status === 'taken') fail(409, 'SEAT_TAKEN', `${seat.tableLabel} · ${seat.seatLabel} was just taken. Pick another seat.`)
        }
      }
    }
    if (b.paymentMethod === 'wallet' && quote.total > db.wallet.balance) fail(402, 'INSUFFICIENT_FUNDS', 'Your wallet balance is too low. Top up or choose another method.')

    const orderId = db.nextId('ord')
    const isFree = quote.total === 0
    const status = isFree || b.paymentMethod === 'wallet' ? 'paid' : 'awaiting_payment'
    const tickets: Ticket[] = []
    let seatIdx = 0
    for (const line of quote.lines) {
      for (let i = 0; i < line.quantity; i++) {
        const seat = b.seats?.[seatIdx++] ?? null
        const guest = i === 0 ? b.attendee : b.additionalGuests?.[i - 1] ?? b.attendee
        tickets.push({
          id: db.nextId('tkt'),
          code: shortCode('DT'),
          orderId,
          eventId: e.id,
          event: { id: e.id, slug: e.slug, title: e.title, coverUrl: e.coverUrl, startsAt: e.startsAt, endsAt: e.endsAt, attendanceMode: e.attendanceMode, city: e.city },
          ticketTypeName: line.ticketType.name,
          holderName: `${guest.firstName} ${guest.lastName}`,
          qrPayload: '',
          status: 'valid',
          checkedInAt: null,
          seat: seat ? { tableLabel: seat.tableLabel, seatLabel: seat.seatLabel } : null,
          scheduleId: seat?.scheduleId ?? e.schedules[0]?.id ?? null,
          additionalGuests: i === 0 ? b.additionalGuests ?? [] : [],
          foodLines: i === 0 ? quote.foodLines : [],
          orderTotal: quote.total,
          currency: 'NGN',
          refund: null,
          transferredTo: null,
          createdAt: new Date().toISOString(),
        })
      }
    }
    for (const t of tickets) t.qrPayload = `WP|${t.id}|${t.code}|${e.id}`

    const order: Order = {
      id: orderId,
      reference: `WP-ORD-${db.between(1000, 9999)}`,
      event: db.toSummary(e),
      status,
      paymentMethod: isFree ? 'free' : b.paymentMethod,
      attendee: b.attendee,
      additionalGuests: b.additionalGuests ?? [],
      lines: quote.lines,
      foodLines: quote.foodLines,
      seats: b.seats ?? [],
      subtotal: quote.subtotal,
      serviceFee: quote.serviceFee,
      discount: quote.discount,
      total: quote.total,
      currency: 'NGN',
      paidAt: status === 'paid' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      tickets,
      receiptUrl: null,
    }
    idempotency.set(b.idempotencyKey, order)
    db.orders.unshift(order)
    if (status === 'paid') finalize(order, user.id)
    return created({ order, payment: paymentFor(order, b.paymentMethod) })
  })

  route('GET', '/orders/:id', (req) => {
    requireUser(req)
    const o = db.orders.find((x) => x.id === req.params.id)
    if (!o) fail(404, 'NOT_FOUND', 'Order not found')
    return data(o)
  })

  route('POST', '/orders/:id/verify-payment', (req) => {
    const user = requireUser(req)
    const o = db.orders.find((x) => x.id === req.params.id)
    if (!o) fail(404, 'NOT_FOUND', 'Order not found')
    const b = body<{ reference?: string; simulate?: 'success' | 'failed' }>(req)
    if (o.status === 'awaiting_payment') {
      if (b.simulate === 'failed') {
        o.status = 'failed'
      } else {
        o.status = 'paid'
        o.paidAt = new Date().toISOString()
        finalize(o, user.id)
      }
    }
    return data(o, o.status === 'paid' ? 'Payment confirmed' : 'Payment failed')
  })

  route('GET', '/orders/:id/receipt', (req) => {
    requireUser(req)
    const o = db.orders.find((x) => x.id === req.params.id)
    if (!o) fail(404, 'NOT_FOUND', 'Order not found')
    return data({ url: `data:text/plain;charset=utf-8,${encodeURIComponent(`Wedpluz receipt ${o.reference}\nTotal: ${o.total / 100} ${o.currency}`)}` })
  })

  route('GET', '/me/tickets', (req) => {
    requireUser(req)
    const tab = req.query.get('tab') ?? 'upcoming'
    const now = new Date().toISOString()
    let list = db.tickets
    if (tab === 'upcoming') list = list.filter((t) => t.status !== 'cancelled' && (t.event.endsAt ?? t.event.startsAt) >= now)
    else if (tab === 'past') list = list.filter((t) => t.status !== 'cancelled' && (t.event.endsAt ?? t.event.startsAt) < now)
    else if (tab === 'cancelled') list = list.filter((t) => t.status === 'cancelled')
    list = list.filter((t) => textMatch([t.event.title, t.code], req.query.get('search')))
    // Group by order so multi-ticket purchases appear once (like the designs).
    const seen = new Set<string>()
    const grouped = list.filter((t) => (seen.has(t.orderId) ? false : (seen.add(t.orderId), true)))
    return paginate(grouped.map((t) => ({ ...t, ticketCount: list.filter((x) => x.orderId === t.orderId).length, checkedInCount: list.filter((x) => x.orderId === t.orderId && x.status === 'checked_in').length })), req.query, 12)
  })

  route('GET', '/tickets/:id', (req) => {
    requireUser(req)
    const t = db.tickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    const siblings = db.tickets.filter((x) => x.orderId === t.orderId)
    return data({ ...t, siblings })
  })

  route('POST', '/tickets/:id/cancel', (req) => {
    requireUser(req)
    const t = db.tickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    const b = body<{ reason: string; note?: string }>(req)
    requireFields(b, ['reason'])
    if (t.status === 'checked_in') fail(409, 'CONFLICT', 'Checked-in tickets cannot be cancelled.')
    if (t.status === 'cancelled') fail(409, 'CONFLICT', 'This ticket is already cancelled.')
    const siblings = db.tickets.filter((x) => x.orderId === t.orderId)
    for (const s of siblings) {
      s.status = 'cancelled'
      s.refund = s.orderTotal > 0 ? { id: db.nextId('rf'), status: 'processing', amount: s.orderTotal, currency: 'NGN', reason: b.reason, requestedAt: new Date().toISOString(), completedAt: null } : null
    }
    const e = db.findEvent(t.eventId)
    if (e) e.stats.registered = Math.max(0, e.stats.registered - siblings.length)
    return data(t, t.orderTotal > 0 ? 'Ticket cancelled. Your refund is being processed.' : 'Ticket cancelled.')
  })

  route('POST', '/tickets/:id/transfer', (req) => {
    requireUser(req)
    const t = db.tickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    const b = body<{ recipientEmail: string }>(req)
    requireFields(b, ['recipientEmail'])
    const recipient = db.users.find((u) => u.email.toLowerCase() === b.recipientEmail.toLowerCase())
    if (!recipient) fail(422, 'VALIDATION_ERROR', 'No Wedpluz account with that email.', { recipientEmail: ['No Wedpluz account with that email.'] })
    t.status = 'transferred'
    t.transferredTo = db.userSummary(recipient.id)
    return data(t, `Ticket transferred to ${recipient.displayName}`)
  })

  route('GET', '/tickets/:id/download', (req) => {
    requireUser(req)
    const t = db.tickets.find((x) => x.id === req.params.id)
    if (!t) fail(404, 'NOT_FOUND', 'Ticket not found')
    return data({ url: `data:text/plain;charset=utf-8,${encodeURIComponent(`Wedpluz ticket ${t.code}\n${t.event.title}\n${t.holderName}`)}`, filename: `wedpluz-ticket-${t.code}.txt` })
  })

  route('DELETE', '/checkout/quotes/:id', (req) => {
    quotes.delete(req.params.id ?? '')
    return noContent()
  })
}

function paymentFor(order: Order, method: string): PaymentIntent {
  const provider = order.total === 0 ? 'none' : method === 'wallet' ? 'wallet' : method === 'card' ? 'paystack' : method === 'paypal' ? 'paypal' : method === 'monnify' ? 'monnify' : method === 'stripe' ? 'stripe' : 'paystack'
  return {
    orderId: order.id,
    reference: `${order.reference}-PAY`,
    provider,
    status: order.status === 'paid' ? 'succeeded' : 'requires_action',
    clientParams: provider === 'paystack' ? { publicKey: 'pk_test_mock', email: order.attendee.email } : {},
    authorizationUrl: order.status === 'paid' ? null : `/checkout/mock-gateway?order=${order.id}&provider=${provider}`,
    amount: order.total,
    currency: order.currency,
  }
}

function finalize(order: Order, userId: string) {
  const e = db.findEvent(order.event.id)
  if (e) {
    for (const l of order.lines) {
      const t = e.ticketTypes.find((x) => x.id === l.ticketType.id)
      if (t) t.sold += l.quantity
    }
    e.stats.registered += order.tickets.length
    e.stats.ticketsSold += order.tickets.length
    e.stats.revenue += order.total
    e.myTicketId = order.tickets[0]?.id ?? null
  }
  for (const seat of order.seats) {
    for (const t of db.hallLayout.tables) {
      const s = t.seats.find((x) => x.id === seat.seatId)
      if (s) s.status = 'taken'
    }
  }
  if (order.paymentMethod === 'wallet') {
    db.wallet.balance -= order.total
    db.walletTransactions.unshift({ id: db.nextId('wt'), reference: `WP-PAY-${db.between(1000, 9999)}`, type: 'ticket_payment', direction: 'debit', amount: order.total, fee: 0, currency: 'NGN', status: 'successful', description: `Tickets · ${order.event.title}`, counterparty: null, provider: 'wallet', createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), metadata: { orderId: order.id } })
  }
  db.tickets.unshift(...order.tickets)
  db.notifications.unshift({ id: db.nextId('n'), type: 'ticket_purchased', actor: null, title: 'Ticket confirmed', body: '', segments: [{ text: 'Your ticket for ' }, { text: order.event.title, emphasis: true }, { text: ' is confirmed.' }], action: 'view', actionState: null, data: { ticketId: order.tickets[0]?.id ?? '' }, isRequest: false, readAt: null, createdAt: new Date().toISOString(), link: `/tickets/${order.tickets[0]?.id ?? ''}` })
  void userId
}
