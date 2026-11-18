import type { AttendanceMode, Event, EventDraftPayload, OnlinePlatform, TicketType } from '@/types'

/** Form-friendly shapes for the Create Event wizard (dates/times split for native inputs). */
export interface ScheduleForm {
  id?: string
  label: string | null
  date: string
  endDate: string
  startTime: string
  endTime: string
  attendanceMode: AttendanceMode
  venue: { name: string; address: string; city: string; state: string; countryCode: string; lat: number | null; lng: number | null }
  online: { platform: OnlinePlatform | ''; link: string }
}

export interface SubEventForm {
  id?: string
  title: string
  description: string
  coverUrl: string | null
  scheduleIndex: number
  startTime: string
  endTime: string
  requiresApproval: boolean
  isIncludedInBundle: boolean
}

export interface TicketForm {
  id?: string
  name: string
  description: string | null
  price: number
  quantity: number
  salesEndAt: string
  perOrderLimit: number
  scheduleId: string | null
  seatSelection: boolean
  menuSelection: boolean
  isEarlyBird: boolean
}

export interface EventDraftForm {
  title: string
  description: string
  coverUrl: string | null
  coverUploadId: string | null
  categoryId: string
  visibility: 'public' | 'private'
  approvalRequired: boolean
  limitGuests: boolean
  guestLimit: number | null
  allowGuestInvites: boolean
  maxAdditionalGuests: number
  isAdultOnly: boolean
  schedules: ScheduleForm[]
  subEvents: SubEventForm[]
  isFree: boolean
  tickets: TicketForm[]
  hallLayoutId: string | null
  menuId: string | null
  organizer: { displayName: string; bio: string; contactEmail: string; contactPhone: string }
}

export const NIGERIAN_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara']
export const PLATFORMS: Array<{ value: OnlinePlatform; label: string }> = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'youtube', label: 'YouTube Live' },
  { value: 'instagram_live', label: 'Instagram Live' },
  { value: 'other', label: 'Other' },
]

export function emptySchedule(): ScheduleForm {
  return { label: null, date: '', endDate: '', startTime: '12:00', endTime: '', attendanceMode: 'physical', venue: { name: '', address: '', city: '', state: '', countryCode: 'NG', lat: null, lng: null }, online: { platform: '', link: '' } }
}
export function emptyTicket(): TicketForm {
  return { name: '', description: null, price: 0, quantity: 100, salesEndAt: '', perOrderLimit: 5, scheduleId: null, seatSelection: false, menuSelection: false, isEarlyBird: false }
}
export function emptyDraft(defaults: Partial<EventDraftForm['organizer']> = {}): EventDraftForm {
  return {
    title: '', description: '', coverUrl: null, coverUploadId: null, categoryId: '', visibility: 'public', approvalRequired: false, limitGuests: false, guestLimit: null, allowGuestInvites: false, maxAdditionalGuests: 0, isAdultOnly: false,
    schedules: [emptySchedule()], subEvents: [], isFree: false, tickets: [], hallLayoutId: null, menuId: null,
    organizer: { displayName: '', bio: '', contactEmail: '', contactPhone: '', ...defaults },
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
/** Combines local date + time into an ISO string with the user's offset (backend stores UTC). */
export function joinIso(date: string, time: string): string {
  return new Date(`${date}T${time || '00:00'}:00`).toISOString()
}

export function eventToDraft(e: Event): EventDraftForm {
  return {
    title: e.title,
    description: e.description,
    coverUrl: e.coverUrl,
    coverUploadId: null,
    categoryId: e.category.id,
    visibility: e.visibility,
    approvalRequired: e.approvalRequired,
    limitGuests: e.guestLimit !== null,
    guestLimit: e.guestLimit,
    allowGuestInvites: e.allowGuestInvites,
    maxAdditionalGuests: e.maxAdditionalGuests,
    isAdultOnly: e.isAdultOnly,
    schedules: e.schedules.length
      ? e.schedules.map((s) => {
          const start = splitIso(s.startsAt)
          const end = splitIso(s.endsAt)
          return { id: s.id, label: s.label, date: start.date, endDate: end.date !== start.date ? end.date : '', startTime: start.time, endTime: end.time, attendanceMode: s.attendanceMode, venue: s.venue ?? emptySchedule().venue, online: s.online ?? { platform: '', link: '' } }
        })
      : [emptySchedule()],
    subEvents: e.subEvents.map((s) => ({ id: s.id, title: s.title, description: s.description, coverUrl: s.coverUrl, scheduleIndex: Math.max(0, e.schedules.findIndex((x) => x.id === s.scheduleId)), startTime: splitIso(s.startsAt).time, endTime: splitIso(s.endsAt).time, requiresApproval: s.requiresApproval, isIncludedInBundle: s.isIncludedInBundle })),
    isFree: e.isFree && e.ticketTypes.length <= 1,
    tickets: e.ticketTypes.map((t) => ({ id: t.id, name: t.name, description: t.description, price: t.price, quantity: t.quantity, salesEndAt: splitIso(t.salesEndAt).date, perOrderLimit: t.perOrderLimit, scheduleId: t.scheduleId, seatSelection: t.seatSelection, menuSelection: t.menuSelection, isEarlyBird: t.isEarlyBird })),
    hallLayoutId: e.schedules[0]?.hallLayoutId ?? null,
    menuId: e.schedules[0]?.menuId ?? null,
    organizer: { displayName: e.organizer.displayName, bio: e.organizer.bio ?? '', contactEmail: '', contactPhone: '' },
  }
}

export function draftToPayload(d: EventDraftForm): Partial<EventDraftPayload> {
  const schedules = d.schedules
    .filter((s) => s.date)
    .map((s, i) => {
      const physical = s.attendanceMode !== 'online'
      const online = s.attendanceMode !== 'physical'
      return {
        id: s.id,
        label: d.schedules.length > 1 ? s.label || `Day ${i + 1}` : null,
        startsAt: joinIso(s.date, s.startTime),
        endsAt: s.endTime ? joinIso(s.endDate || s.date, s.endTime) : null,
        attendanceMode: s.attendanceMode,
        venue: physical ? { ...s.venue } : null,
        online: online && s.online.platform ? { platform: s.online.platform as OnlinePlatform, link: s.online.link } : null,
        hallLayoutId: physical ? d.hallLayoutId : null,
        menuId: physical ? d.menuId : null,
      }
    })
  return {
    title: d.title,
    description: d.description,
    coverUploadId: d.coverUploadId,
    coverUrl: d.coverUrl,
    categoryId: d.categoryId,
    visibility: d.visibility,
    approvalRequired: d.approvalRequired,
    guestLimit: d.limitGuests ? d.guestLimit : null,
    allowGuestInvites: d.allowGuestInvites,
    maxAdditionalGuests: d.allowGuestInvites ? d.maxAdditionalGuests : 0,
    isAdultOnly: d.isAdultOnly,
    schedules,
    subEvents: d.subEvents.map((s) => {
      const sch = d.schedules[s.scheduleIndex] ?? d.schedules[0]
      const date = sch?.date ?? ''
      return { id: s.id, title: s.title, description: s.description, coverUrl: s.coverUrl, scheduleId: sch?.id ?? null, startsAt: date ? joinIso(date, s.startTime) : new Date().toISOString(), endsAt: date && s.endTime ? joinIso(date, s.endTime) : null, requiresApproval: s.requiresApproval, isIncludedInBundle: s.isIncludedInBundle }
    }),
    isFree: d.isFree,
    ticketTypes: d.isFree && !d.tickets.length
      ? undefined
      : d.tickets.map<Omit<TicketType, 'id' | 'sold'> & { id?: string }>((t) => ({ id: t.id, name: t.name, description: t.description, price: d.isFree ? 0 : t.price, currency: 'NGN', quantity: t.quantity, salesStartAt: null, salesEndAt: t.salesEndAt ? joinIso(t.salesEndAt, '23:59') : null, perOrderLimit: t.perOrderLimit, scheduleId: t.scheduleId, seatSelection: t.seatSelection, menuSelection: t.menuSelection, isEarlyBird: t.isEarlyBird, isActive: true })),
    organizerInfo: d.organizer,
    assets: { hallLayoutId: d.hallLayoutId, menuId: d.menuId },
  }
}
