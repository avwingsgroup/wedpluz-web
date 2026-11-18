import { request } from '@/services/http'
import type { CancelTicketPayload, CheckoutQuote, CheckoutQuotePayload, CreateOrderPayload, HallLayout, Order, PaymentIntent, Ticket, TicketTransferPayload } from '@/types'

export interface TicketListItem extends Ticket {
  ticketCount: number
  checkedInCount: number
}

export interface TicketDetail extends Ticket {
  siblings: Ticket[]
}

export const ticketingApi = {
  quote: (payload: CheckoutQuotePayload, signal?: AbortSignal) => request.post<CheckoutQuote, CheckoutQuotePayload>('/checkout/quotes', payload, { signal }),
  releaseQuote: (quoteId: string) => request.del(`/checkout/quotes/${quoteId}`),
  seats: (eventId: string, scheduleId: string) => request.get<HallLayout>(`/events/${eventId}/schedules/${scheduleId}/seats`),
  createOrder: (payload: CreateOrderPayload) => request.post<{ order: Order; payment: PaymentIntent }, CreateOrderPayload>('/orders', payload, { headers: { 'Idempotency-Key': payload.idempotencyKey } }),
  order: (id: string) => request.get<Order>(`/orders/${id}`),
  verifyPayment: (id: string, payload: { reference?: string; simulate?: 'success' | 'failed' } = {}) => request.post<Order>(`/orders/${id}/verify-payment`, payload),
  receipt: (id: string) => request.get<{ url: string }>(`/orders/${id}/receipt`),
  myTickets: (params: { tab: 'upcoming' | 'past' | 'cancelled'; search?: string; page?: number }) => request.getPaginated<TicketListItem>('/me/tickets', params),
  ticket: (id: string) => request.get<TicketDetail>(`/tickets/${id}`),
  cancel: (id: string, payload: CancelTicketPayload) => request.post<Ticket, CancelTicketPayload>(`/tickets/${id}/cancel`, payload),
  transfer: (id: string, payload: TicketTransferPayload) => request.post<Ticket, TicketTransferPayload>(`/tickets/${id}/transfer`, payload),
  download: (id: string) => request.get<{ url: string; filename: string }>(`/tickets/${id}/download`),
}
