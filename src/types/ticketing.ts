import type { Currency, Id, ISODateString } from './api'
import type { EventSummary, MenuItem, TicketType } from './event'
import type { UserSummary } from './user'

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'refund_processing'
  | 'refunded'
  | 'expired'

export type PaymentMethod = 'wallet' | 'card' | 'paypal' | 'paystack' | 'monnify' | 'stripe' | 'free'
export type PaymentProvider = 'paystack' | 'stripe' | 'paypal' | 'monnify' | 'wallet' | 'none'

export interface AttendeeInfo {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export interface AdditionalGuest {
  firstName: string
  lastName: string
  email?: string
}

export interface SeatSelection {
  scheduleId: Id
  seatId: Id
  tableLabel: string
  seatLabel: string
}

export interface OrderLineInput {
  ticketTypeId: Id
  quantity: number
}

export interface FoodLineInput {
  menuItemId: Id
  quantity: number
}

export interface CheckoutQuotePayload {
  eventId: Id
  lines: OrderLineInput[]
  foodLines: FoodLineInput[]
  promoCode?: string | null
  /**
   * Promoter share code from the event link (`?ref=CODE`). Used only for commission
   * attribution; the backend validates it and ignores unknown or self-referral codes.
   */
  referralCode?: string | null
}

export interface QuoteLine {
  ticketType: Pick<TicketType, 'id' | 'name' | 'price' | 'currency'>
  quantity: number
  subtotal: number
}

export interface QuoteFoodLine {
  menuItem: Pick<MenuItem, 'id' | 'name' | 'price'>
  quantity: number
  subtotal: number
}

export interface CheckoutQuote {
  quoteId: Id
  currency: Currency
  lines: QuoteLine[]
  foodLines: QuoteFoodLine[]
  subtotal: number
  serviceFee: number
  discount: number
  total: number
  promoCode: string | null
  promoMessage: string | null
  requiresSeatSelection: boolean
  requiresMenuSelection: boolean
  expiresAt: ISODateString
}

export interface CreateOrderPayload {
  quoteId: Id
  attendee: AttendeeInfo
  additionalGuests: AdditionalGuest[]
  seats: SeatSelection[]
  paymentMethod: PaymentMethod
  /** Client generated UUID; the backend must dedupe on it. */
  idempotencyKey: string
  returnUrl: string
}

export interface PaymentIntent {
  orderId: Id
  reference: string
  provider: PaymentProvider
  status: 'requires_action' | 'processing' | 'succeeded' | 'failed'
  /** Provider specific client payload (public key, authorization url, client secret). */
  clientParams: Record<string, string>
  authorizationUrl: string | null
  amount: number
  currency: Currency
}

export interface Order {
  id: Id
  reference: string
  event: EventSummary
  status: OrderStatus
  paymentMethod: PaymentMethod
  attendee: AttendeeInfo
  additionalGuests: AdditionalGuest[]
  lines: QuoteLine[]
  foodLines: QuoteFoodLine[]
  seats: SeatSelection[]
  subtotal: number
  serviceFee: number
  discount: number
  total: number
  currency: Currency
  paidAt: ISODateString | null
  createdAt: ISODateString
  tickets: Ticket[]
  receiptUrl: string | null
}

export type TicketStatus = 'valid' | 'checked_in' | 'cancelled' | 'transferred' | 'expired'

export interface Ticket {
  id: Id
  code: string
  orderId: Id
  eventId: Id
  event: Pick<EventSummary, 'id' | 'slug' | 'title' | 'coverUrl' | 'startsAt' | 'endsAt' | 'attendanceMode' | 'city'>
  ticketTypeName: string
  holderName: string
  qrPayload: string
  status: TicketStatus
  checkedInAt: ISODateString | null
  seat: Pick<SeatSelection, 'tableLabel' | 'seatLabel'> | null
  scheduleId: Id | null
  additionalGuests: AdditionalGuest[]
  foodLines: QuoteFoodLine[]
  orderTotal: number
  currency: Currency
  refund: RefundSummary | null
  transferredTo: UserSummary | null
  createdAt: ISODateString
}

export type RefundStatus = 'requested' | 'processing' | 'approved' | 'rejected' | 'completed'

export interface RefundSummary {
  id: Id
  status: RefundStatus
  amount: number
  currency: Currency
  reason: string
  requestedAt: ISODateString
  completedAt: ISODateString | null
}

export interface CancelTicketPayload {
  reason: CancelReason
  note?: string
}

export type CancelReason =
  | 'no_longer_interested'
  | 'bad_weather'
  | 'technical_or_venue'
  | 'wrong_event'
  | 'scheduling_conflict'
  | 'health_or_safety'
  | 'personal'
  | 'other'

export interface TicketTransferPayload {
  recipientEmail: string
  message?: string
}

export interface TicketValidationResult {
  valid: boolean
  reason: 'ok' | 'already_checked_in' | 'cancelled' | 'wrong_event' | 'not_found' | 'expired' | 'wrong_day'
  ticket: Pick<Ticket, 'id' | 'code' | 'holderName' | 'ticketTypeName' | 'checkedInAt' | 'seat'> | null
  attendee: UserSummary | null
}

export interface CheckInRecord {
  id: Id
  ticketCode: string
  attendee: UserSummary
  ticketTypeName: string
  checkedInAt: ISODateString
  checkedInBy: UserSummary
  method: 'scan' | 'manual'
}

export interface GuestListEntry {
  id: Id
  user: UserSummary
  ticketTypeName: string
  ticketStatus: TicketStatus
  checkedInAt: ISODateString | null
  requestStatus: 'approved' | 'pending' | 'declined' | null
  paymentStatus: 'paid' | 'unpaid' | 'free'
  subEventTitle: string | null
}

export interface HallSeat {
  id: Id
  label: string
  status: 'available' | 'taken' | 'reserved' | 'selected'
  ticketTypeId: Id | null
}

export interface HallTable {
  id: Id
  label: string
  shape: 'round' | 'rectangle' | 'row'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  seats: HallSeat[]
  color: string | null
}

export interface HallFixture {
  id: Id
  label: string
  type: 'stage' | 'dance_floor' | 'dj' | 'cake' | 'entrance' | 'note' | 'special'
  x: number
  y: number
  width: number
  height: number
}

export interface HallLayout {
  id: Id
  name: string
  thumbnailUrl: string | null
  width: number
  height: number
  totalSeats: number
  reservedSeats: number
  tables: HallTable[]
  fixtures: HallFixture[]
  updatedAt: ISODateString
}
