import type { Currency, Id, ISODateString } from './api'
import type { UserSummary } from './user'

export type EventStatus = 'draft' | 'pending_review' | 'live' | 'completed' | 'cancelled' | 'suspended' | 'rejected'
export type EventVisibility = 'public' | 'private'
export type AttendanceMode = 'physical' | 'online' | 'hybrid'
export type OnlinePlatform = 'google_meet' | 'zoom' | 'microsoft_teams' | 'youtube' | 'instagram_live' | 'other'

export interface EventCategory {
  id: Id
  name: string
  slug: string
  icon: string
  isActive: boolean
  eventsCount?: number
}

export interface Venue {
  name: string
  address: string
  city: string
  state: string
  countryCode: string
  lat: number | null
  lng: number | null
}

export interface OnlineLocation {
  platform: OnlinePlatform
  link: string
}

export interface EventSchedule {
  id: Id
  /** Display label such as "Day 1". */
  label: string | null
  startsAt: ISODateString
  endsAt: ISODateString | null
  attendanceMode: AttendanceMode
  venue: Venue | null
  online: OnlineLocation | null
  hallLayoutId: Id | null
  menuId: Id | null
}

export interface SubEvent {
  id: Id
  title: string
  description: string
  coverUrl: string | null
  scheduleId: Id | null
  startsAt: ISODateString
  endsAt: ISODateString | null
  requiresApproval: boolean
  isIncludedInBundle: boolean
}

export interface TicketType {
  id: Id
  name: string
  description: string | null
  price: number
  currency: Currency
  quantity: number
  sold: number
  salesStartAt: ISODateString | null
  salesEndAt: ISODateString | null
  perOrderLimit: number
  /** Multi-day events may scope a ticket type to one schedule; null = bundle for all days. */
  scheduleId: Id | null
  seatSelection: boolean
  menuSelection: boolean
  isEarlyBird: boolean
  isActive: boolean
}

export interface MenuItem {
  id: Id
  name: string
  description: string | null
  price: number
  currency: Currency
  imageUrl: string | null
  category: string
  isAvailable: boolean
}

export interface EventPromotionSettings {
  enabled: boolean
  commissionPercent: number
  targetSignups: number | null
  promoterLimit: number | null
  promotersCount: number
}

export interface EventOrganizer extends UserSummary {
  bio: string | null
  eventsCount: number
}

export interface EventStats {
  registered: number
  checkedIn: number
  capacity: number | null
  pendingRequests: number
  revenue: number
  ticketsSold: number
}

export interface EventSummary {
  id: Id
  slug: string
  title: string
  coverUrl: string
  category: Pick<EventCategory, 'id' | 'name' | 'slug'>
  startsAt: ISODateString
  endsAt: ISODateString | null
  attendanceMode: AttendanceMode
  city: string | null
  isFree: boolean
  minPrice: number
  currency: Currency
  status: EventStatus
  isSaved: boolean
  isFeatured: boolean
  isPromoted: boolean
  organizer: UserSummary
  promotion?: Pick<EventPromotionSettings, 'commissionPercent' | 'promotersCount'> | null
  ticketsSold?: number
}

export interface Event extends Omit<EventSummary, 'organizer'> {
  description: string
  visibility: EventVisibility
  approvalRequired: boolean
  guestLimit: number | null
  allowGuestInvites: boolean
  maxAdditionalGuests: number
  isAdultOnly: boolean
  organizer: EventOrganizer
  schedules: EventSchedule[]
  subEvents: SubEvent[]
  ticketTypes: TicketType[]
  menu: MenuItem[]
  promotion: EventPromotionSettings
  stats: EventStats
  gallery: string[]
  tags: string[]
  communityId: Id | null
  myRequestStatus: 'none' | 'pending' | 'approved' | 'declined'
  myTicketId: Id | null
  createdAt: ISODateString
  updatedAt: ISODateString
  publishedAt: ISODateString | null
}

export interface EventFilters {
  search?: string
  location?: string
  categorySlug?: string
  dateFrom?: string
  dateTo?: string
  timeOfDay?: 'any' | 'morning' | 'afternoon' | 'evening'
  attendanceMode?: AttendanceMode | 'any'
  distanceKm?: number
  freeOnly?: boolean
  sort?: 'relevance' | 'date' | 'price' | 'popularity'
  page?: number
  perPage?: number
}

export interface EventDraftPayload {
  title: string
  description: string
  coverUploadId: string | null
  coverUrl?: string | null
  categoryId: Id
  visibility: EventVisibility
  approvalRequired: boolean
  guestLimit: number | null
  allowGuestInvites: boolean
  maxAdditionalGuests: number
  isAdultOnly: boolean
  schedules: Array<Omit<EventSchedule, 'id'> & { id?: Id }>
  subEvents: Array<Omit<SubEvent, 'id'> & { id?: Id }>
  isFree: boolean
  ticketTypes: Array<Omit<TicketType, 'id' | 'sold'> & { id?: Id }>
  organizerInfo: { displayName: string; bio: string; contactEmail: string; contactPhone: string }
  assets: { hallLayoutId: Id | null; menuId: Id | null }
}

export interface EventRequest {
  id: Id
  event: Pick<EventSummary, 'id' | 'title' | 'coverUrl' | 'startsAt'>
  user: UserSummary
  firstName: string
  lastName: string
  status: 'pending' | 'approved' | 'declined'
  createdAt: ISODateString
}

export interface SavedVendorSummary {
  id: Id
  businessName: string
  category: string
  avatarUrl: string | null
  rating: number
  location: string
}

export interface SearchSuggestion {
  type: 'event' | 'vendor' | 'category' | 'location' | 'recent' | 'trending'
  label: string
  value: string
  meta?: string
}
