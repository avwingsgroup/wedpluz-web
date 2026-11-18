import { addDays, addHours, formatISO, subDays, subHours, subMinutes } from 'date-fns'
import type {
  ActivityLogEntry,
  AdminBookingRecord,
  AdminCommunityRecord,
  AdminEventRecord,
  AdminOrganizerRecord,
  AdminUser,
  AdminUserRecord,
  AppNotification,
  AuditLogEntry,
  Banner,
  CheckInRecord,
  CmsPage,
  CommissionRule,
  Community,
  CommunityMember,
  ContentReport,
  Conversation,
  Dispute,
  Event,
  EventCategory,
  EventManager,
  EventRequest,
  EventSchedule,
  EventTask,
  EventVendorAssignment,
  FinanceTransaction,
  GuestListEntry,
  HallLayout,
  HallTable,
  Message,
  NotificationCampaign,
  NotificationPreferences,
  NotificationTemplate,
  Order,
  Payout,
  Permission,
  Plan,
  PlannerChat,
  PlannerMenu,
  PlatformSettings,
  PrivacySettings,
  PromoterEnrollment,
  RefundRecord,
  Role,
  SecurityLogEntry,
  Session,
  Settlement,
  StatusPost,
  Subscription,
  SubscriptionPayment,
  SupportTicket,
  Ticket,
  TicketType,
  User,
  UserSummary,
  Vendor,
  VendorReview,
  VendorWork,
  Wallet,
  WalletTransaction,
} from '@/types'

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20251115)
const pick = <const T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const iso = (d: Date) => formatISO(d)
const NOW = new Date('2026-11-15T10:00:00+01:00')

let seq = 1000
export const nextId = (prefix: string) => `${prefix}_${(seq++).toString(36)}`

export const img = (seed: string, w = 800, h = 500) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`
export const avatar = (n: number) => `https://i.pravatar.cc/150?img=${n}`

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

const summary = (id: string, displayName: string, avatarUrl: string | null, extra: Partial<UserSummary> = {}): UserSummary => ({
  id,
  displayName,
  avatarUrl,
  username: displayName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
  isVerified: false,
  isVendor: false,
  ...extra,
})

export const ME_ID = 'usr_me'

function makeUser(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  avatarUrl: string | null,
  overrides: Partial<User> = {},
): User {
  return {
    id,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    username: `${firstName}${lastName}`.toLowerCase(),
    email,
    phone: null,
    avatarUrl,
    dateOfBirth: '1995-08-08',
    emailVerifiedAt: iso(subDays(NOW, 200)),
    phoneVerifiedAt: null,
    identityStatus: 'unverified',
    interests: [],
    roles: ['user'],
    status: 'active',
    plan: 'free',
    locale: 'en',
    city: 'Port Harcourt',
    countryCode: 'NG',
    businessProfileId: null,
    walletEnabled: false,
    createdAt: iso(subDays(NOW, between(10, 400))),
    lastSeenAt: iso(subMinutes(NOW, between(1, 3000))),
    isVerified: false,
    isVendor: false,
    ...overrides,
  }
}

export const users: User[] = [
  makeUser(ME_ID, 'John', 'Brown', 'johnbrown@gmail.com', avatar(12), {
    interests: ['business-networking', 'faith-spirituality', 'tech-innovation', 'food', 'travel-adventure'],
    roles: ['user', 'organizer'],
    identityStatus: 'unverified',
    walletEnabled: true,
    phone: '+2348012345678',
  }),
  makeUser('usr_shotitmoi', 'Shot it', 'moi', 'hello@shotitmoi.com', avatar(33), { roles: ['user', 'vendor'], businessProfileId: 'ven_shotitmoi', isVendor: true, isVerified: true, identityStatus: 'verified', city: 'Port Harcourt' }),
  makeUser('usr_bestchefz', 'Best', 'Chefz', 'hi@bestchefz.ng', avatar(51), { roles: ['user', 'vendor'], businessProfileId: 'ven_bestchefz', isVendor: true, identityStatus: 'verified', city: 'Lagos' }),
  makeUser('usr_beayouwedz', 'Bea', 'Youwedz', 'bea@beayouwedz.com', avatar(45), { roles: ['user', 'vendor'], businessProfileId: 'ven_beayouwedz', isVendor: true, identityStatus: 'verified', city: 'Abuja' }),
  makeUser('usr_alice', 'Alice', 'Smith', 'alice@example.com', avatar(47)),
  makeUser('usr_michael', 'Michael', 'Johnson', 'michael@example.com', avatar(14)),
  makeUser('usr_emily', 'Emily', 'Davis', 'emily@example.com', avatar(26)),
  makeUser('usr_david', 'David', 'Wilson', 'david@example.com', avatar(59)),
  makeUser('usr_chinedu', 'Chinedu', 'Okafor', 'chinedu@example.com', avatar(68), { roles: ['user', 'vendor'], isVendor: true }),
  makeUser('usr_belema', 'Belema', 'Harry', 'belema@example.com', null),
  makeUser('usr_alex', 'Alex', 'Thompson', 'alex@example.com', avatar(7), { roles: ['user', 'organizer'] }),
  makeUser('usr_tessy', 'Tessy', 'Ade', 'tessy@example.com', avatar(29), { roles: ['user', 'organizer'] }),
  makeUser('usr_piggyvest', 'Piggyvest', 'Nigeria', 'events@piggyvest.com', avatar(65), { roles: ['user', 'organizer'], identityStatus: 'verified', isVerified: true }),
  makeUser('usr_travelbeta', 'Travel', 'Beta', 'hello@travelbeta.com', avatar(60), { roles: ['user', 'organizer'], identityStatus: 'verified', isVerified: true }),
  makeUser('usr_figma', 'Figma', 'Africa', 'africa@figma.com', avatar(2), { roles: ['user', 'organizer'] }),
  makeUser('usr_suspended', 'Kola', 'Danger', 'kola@example.com', avatar(70), { status: 'suspended' }),
]

const firstNames = ['Ada', 'Tunde', 'Ngozi', 'Emeka', 'Fatima', 'Ibrahim', 'Yemi', 'Chioma', 'Seun', 'Zainab', 'Kemi', 'Bola', 'Uche', 'Amaka', 'Dayo', 'Ifeoma', 'Musa', 'Ronke', 'Tobi', 'Nneka']
const lastNames = ['Okoye', 'Bello', 'Adeyemi', 'Nwosu', 'Abubakar', 'Eze', 'Lawal', 'Obi', 'Ogunleye', 'Mohammed', 'Chukwu', 'Balogun']
for (let i = 0; i < 60; i++) {
  const f = pick(firstNames)
  const l = pick(lastNames)
  users.push(
    makeUser(`usr_g${i}`, f, l, `${f}.${l}${i}@example.com`.toLowerCase(), rand() > 0.3 ? avatar(between(1, 70)) : null, {
      status: rand() > 0.93 ? 'suspended' : 'active',
      identityStatus: pick(['unverified', 'verified', 'pending', 'unverified']),
      plan: pick(['free', 'free', 'free', 'basic', 'premium']),
      city: pick(['Port Harcourt', 'Lagos', 'Abuja', 'Ibadan', 'Enugu']),
    }),
  )
}

export const findUser = (id: string) => users.find((u) => u.id === id)
export const userSummary = (id: string): UserSummary => {
  const u = findUser(id)
  return u
    ? summary(u.id, u.displayName, u.avatarUrl, { isVerified: u.isVerified, isVendor: u.isVendor, username: u.username })
    : summary(id, 'Unknown', null)
}
export const me = () => findUser(ME_ID) as User

export const privacy: PrivacySettings = {
  profileVisibility: 'public',
  showEmail: false,
  showPhone: false,
  allowMessageRequests: true,
  allowTagging: true,
  discoverableBySearch: true,
}

export const notificationPrefs: NotificationPreferences = {
  channels: { push: true, email: true, sms: false, whatsapp: true, inApp: true },
  topics: { eventReminders: true, ticketUpdates: true, messages: true, communityActivity: true, promotions: false, collaboration: true, walletActivity: true },
}

export const sessions: Session[] = [
  { id: 'ses_1', device: 'Windows PC', browser: 'Chrome 131', ip: '105.112.33.1', location: 'Port Harcourt, NG', lastActiveAt: iso(NOW), isCurrent: true },
  { id: 'ses_2', device: 'iPhone 15', browser: 'Wedpluz iOS 2.4', ip: '102.89.1.44', location: 'Lagos, NG', lastActiveAt: iso(subHours(NOW, 9)), isCurrent: false },
  { id: 'ses_3', device: 'Pixel 8', browser: 'Wedpluz Android 2.4', ip: '197.210.5.9', location: 'Abuja, NG', lastActiveAt: iso(subDays(NOW, 3)), isCurrent: false },
]

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const categories: EventCategory[] = [
  { id: 'cat_social', name: 'Social activities', slug: 'social-activities', icon: 'party', isActive: true },
  { id: 'cat_hobbies', name: 'Hobbies & Passion', slug: 'hobbies-passion', icon: 'palette', isActive: true },
  { id: 'cat_sports', name: 'Sports & Fitness', slug: 'sports-fitness', icon: 'dumbbell', isActive: true },
  { id: 'cat_travel', name: 'Travel & Outdoor', slug: 'travel-outdoor', icon: 'bus', isActive: true },
  { id: 'cat_business', name: 'Career & Business', slug: 'career-business', icon: 'briefcase', isActive: true },
  { id: 'cat_tech', name: 'Technology', slug: 'technology', icon: 'cpu', isActive: true },
  { id: 'cat_music', name: 'Music', slug: 'music', icon: 'music', isActive: true },
  { id: 'cat_education', name: 'Education', slug: 'education', icon: 'graduation', isActive: true },
  { id: 'cat_weddings', name: 'Weddings', slug: 'weddings', icon: 'rings', isActive: true },
  { id: 'cat_community', name: 'Community', slug: 'community', icon: 'users', isActive: true },
  { id: 'cat_faith', name: 'Faith & Spirituality', slug: 'faith-spirituality', icon: 'sparkles', isActive: true },
  { id: 'cat_food', name: 'Food & Drinks', slug: 'food-drinks', icon: 'utensils', isActive: true },
]
const cat = (id: string) => {
  const c = categories.find((x) => x.id === id) as EventCategory
  return { id: c.id, name: c.name, slug: c.slug }
}

export const interestOptions = [
  'Art & culture', 'Community', 'Business & Networking', 'Lifestyle', 'Weddings', 'Faith & spirituality',
  'Tech & innovation', 'Fashion', 'Sports & fitness', 'Music', 'Health', 'Social activities', 'Food', 'Theatre',
  'Travel & adventure', 'Education',
].map((label) => ({ label, slug: label.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))

/* ------------------------------------------------------------------ */
/* Hall layout + menu                                                  */
/* ------------------------------------------------------------------ */

function roundTable(id: string, label: string, x: number, y: number, seats: number, taken: number[] = []): HallTable {
  return {
    id,
    label,
    shape: 'round',
    x,
    y,
    width: 90,
    height: 90,
    rotation: 0,
    color: null,
    seats: Array.from({ length: seats }, (_, i) => ({
      id: `${id}_s${i + 1}`,
      label: `Seat ${i + 1}`,
      status: taken.includes(i + 1) ? 'taken' : 'available',
      ticketTypeId: null,
    })),
  }
}

export const hallLayout: HallLayout = {
  id: 'hall_1',
  name: 'Grand Ballroom A',
  thumbnailUrl: img('hall-thumb', 400, 300),
  width: 1200,
  height: 900,
  totalSeats: 112,
  reservedSeats: 16,
  tables: [
    roundTable('t1', 'Table 1', 150, 260, 8, [2, 5]),
    roundTable('t2', 'Table 2', 150, 420, 8, [1]),
    roundTable('t3', 'Table 3', 180, 580, 8, []),
    roundTable('t4', 'Table 4', 300, 700, 8, [3, 4, 6]),
    roundTable('t5', 'Table 5', 470, 640, 8, [8]),
    roundTable('t6', 'Table 6', 640, 640, 8, []),
    roundTable('t7', 'Table 7', 820, 700, 8, [1, 2]),
    roundTable('t8', 'Table 8', 940, 580, 8, []),
    roundTable('t9', 'Table 9', 960, 420, 8, [7]),
    roundTable('t10', 'Table 10', 940, 260, 8, []),
    { ...roundTable('t11', 'Table 11', 330, 460, 10, [2, 9]), shape: 'rectangle', width: 80, height: 170 },
    { ...roundTable('t12', 'Table 12', 760, 460, 10, [4]), shape: 'rectangle', width: 80, height: 170 },
    { ...roundTable('r1', 'Row 1', 1110, 300, 12, [1, 3, 11]), shape: 'row', width: 30, height: 340 },
  ],
  fixtures: [
    { id: 'f1', label: 'Stage', type: 'stage', x: 520, y: 120, width: 180, height: 120 },
    { id: 'f2', label: 'DJ', type: 'dj', x: 330, y: 150, width: 70, height: 70 },
    { id: 'f3', label: 'Cake Table', type: 'cake', x: 820, y: 150, width: 70, height: 70 },
    { id: 'f4', label: 'Dance Floor', type: 'dance_floor', x: 520, y: 360, width: 160, height: 160 },
    { id: 'f5', label: 'Entrance area', type: 'entrance', x: 560, y: 840, width: 200, height: 40 },
  ],
  updatedAt: iso(subDays(NOW, 4)),
}

export const hallLayouts: HallLayout[] = [
  hallLayout,
  { ...hallLayout, id: 'hall_2', name: 'Garden Reception', thumbnailUrl: img('hall-2', 400, 300), totalSeats: 80, reservedSeats: 0 },
  { ...hallLayout, id: 'hall_3', name: 'Conference Theatre', thumbnailUrl: img('hall-3', 400, 300), totalSeats: 240, reservedSeats: 20 },
]

export const plannerMenus: PlannerMenu[] = [
  {
    id: 'menu_1',
    name: 'Reception menu',
    currency: 'NGN',
    updatedAt: iso(subDays(NOW, 6)),
    sections: [
      {
        id: 'ms_1',
        title: 'Main dishes',
        items: [
          { id: 'mi_1', name: 'Jollof Rice', description: 'Smoky party jollof with grilled chicken', price: 50000, imageUrl: img('jollof', 300, 300) },
          { id: 'mi_2', name: 'Ofada Sauce', description: 'Rich pepper sauce with assorted meat', price: 100000, imageUrl: img('ofada', 300, 300) },
          { id: 'mi_3', name: 'Spaghetti', description: 'Stir fried with vegetables', price: 45000, imageUrl: img('spag', 300, 300) },
        ],
      },
      {
        id: 'ms_2',
        title: 'Small chops',
        items: [
          { id: 'mi_4', name: 'Combo Platter', description: 'Puff puff, samosa, spring rolls', price: 150000, imageUrl: img('platter', 300, 300) },
          { id: 'mi_5', name: 'Chicken Wings', description: 'Peppered wings', price: 950000, imageUrl: img('wings', 300, 300) },
          { id: 'mi_6', name: 'Spring rolls', description: 'Crispy vegetable rolls', price: 800000, imageUrl: img('rolls', 300, 300) },
        ],
      },
    ],
  },
  { id: 'menu_2', name: 'Cocktail evening', currency: 'NGN', updatedAt: iso(subDays(NOW, 20)), sections: [] },
]

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function schedule(
  id: string,
  startsAt: Date,
  hours: number,
  mode: EventSchedule['attendanceMode'],
  label: string | null = null,
  venueName = 'The Jewel Aeida',
): EventSchedule {
  const physical = mode === 'physical' || mode === 'hybrid'
  const online = mode === 'online' || mode === 'hybrid'
  return {
    id,
    label,
    startsAt: iso(startsAt),
    endsAt: iso(addHours(startsAt, hours)),
    attendanceMode: mode,
    venue: physical
      ? { name: venueName, address: '456 Maple Avenue, Lekki, IL 62704', city: 'Port Harcourt', state: 'Rivers State', countryCode: 'NG', lat: 4.8156, lng: 7.0498 }
      : null,
    online: online ? { platform: 'google_meet', link: 'https://meet.google.com/home' } : null,
    hallLayoutId: physical ? 'hall_1' : null,
    menuId: physical ? 'menu_1' : null,
  }
}

function ticket(id: string, name: string, price: number, quantity: number, sold: number, salesEnd: Date, extra: Partial<TicketType> = {}): TicketType {
  return {
    id,
    name,
    description: null,
    price,
    currency: 'NGN',
    quantity,
    sold,
    salesStartAt: null,
    salesEndAt: iso(salesEnd),
    perOrderLimit: 5,
    scheduleId: null,
    seatSelection: false,
    menuSelection: false,
    isEarlyBird: false,
    isActive: true,
    ...extra,
  }
}

interface EventSeed {
  id: string
  slug: string
  title: string
  category: string
  organizerId: string
  cover: string
  start: Date
  days?: number
  mode: EventSchedule['attendanceMode']
  tickets: TicketType[]
  status?: Event['status']
  description?: string
  approvalRequired?: boolean
  promoted?: boolean
  featured?: boolean
  city?: string
  saved?: boolean
  subEvents?: boolean
  guestLimit?: number | null
  adult?: boolean
  registered?: number
  checkedIn?: number
  createdDaysAgo?: number
}

const LOREM =
  'Join us for the PiggyVest Open House in Port Harcourt! This exciting event is your chance to learn about smart savings and investment options with PiggyVest. Enjoy engaging discussions, meet our team, and discover how you can maximize your financial future. Don’t miss out on this opportunity to connect with like-minded individuals and gain valuable insights. We look forward to seeing you there!'

function buildEvent(s: EventSeed): Event {
  const organizer = findUser(s.organizerId) as User
  const days = s.days ?? 1
  const schedules: EventSchedule[] = Array.from({ length: days }, (_, i) =>
    schedule(`${s.id}_sch${i + 1}`, addDays(s.start, i), 4, s.mode, days > 1 ? `Day ${i + 1}` : null),
  )
  const minPrice = s.tickets.length ? Math.min(...s.tickets.map((t) => t.price)) : 0
  const registered = s.registered ?? s.tickets.reduce((a, t) => a + t.sold, 0)
  const revenue = s.tickets.reduce((a, t) => a + t.sold * t.price, 0)
  const status = s.status ?? 'live'
  return {
    id: s.id,
    slug: s.slug,
    title: s.title,
    description: s.description ?? LOREM,
    coverUrl: s.cover,
    category: cat(s.category),
    startsAt: schedules[0]?.startsAt ?? iso(s.start),
    endsAt: schedules[schedules.length - 1]?.endsAt ?? null,
    attendanceMode: s.mode,
    city: s.city ?? 'Port Harcourt',
    isFree: minPrice === 0,
    minPrice,
    currency: 'NGN',
    status,
    isSaved: s.saved ?? false,
    isFeatured: s.featured ?? false,
    isPromoted: s.promoted ?? false,
    visibility: 'public',
    approvalRequired: s.approvalRequired ?? false,
    guestLimit: s.guestLimit === undefined ? 200 : s.guestLimit,
    allowGuestInvites: true,
    maxAdditionalGuests: 5,
    isAdultOnly: s.adult ?? false,
    organizer: { ...userSummary(organizer.id), bio: `Meet the mastermind ${organizer.displayName}, where moments meet innovation!`, eventsCount: 4 },
    schedules,
    subEvents: s.subEvents
      ? [
          { id: `${s.id}_sub1`, title: 'Welcome Cocktail', description: 'Meet and greet with light refreshments.', coverUrl: img(`${s.id}-sub1`, 400, 300), scheduleId: schedules[0]?.id ?? null, startsAt: iso(addHours(s.start, 1)), endsAt: iso(addHours(s.start, 2)), requiresApproval: false, isIncludedInBundle: true },
          { id: `${s.id}_sub2`, title: 'After Party', description: 'DJ set until late.', coverUrl: img(`${s.id}-sub2`, 400, 300), scheduleId: schedules[schedules.length - 1]?.id ?? null, startsAt: iso(addHours(s.start, 6)), endsAt: iso(addHours(s.start, 10)), requiresApproval: true, isIncludedInBundle: false },
        ]
      : [],
    ticketTypes: s.tickets,
    menu: s.mode !== 'online' ? plannerMenus[0]!.sections.flatMap((sec) => sec.items.map((i) => ({ id: i.id, name: i.name, description: i.description, price: i.price, currency: 'NGN' as const, imageUrl: i.imageUrl, category: sec.title, isAvailable: true }))) : [],
    promotion: { enabled: s.promoted ?? false, commissionPercent: s.promoted ? 10 : 0, targetSignups: s.promoted ? 50 : null, promoterLimit: null, promotersCount: s.promoted ? 141 : 0 },
    stats: { registered, checkedIn: s.checkedIn ?? Math.floor(registered * 0.3), capacity: s.guestLimit === undefined ? 2000 : s.guestLimit, pendingRequests: s.approvalRequired ? 12 : 0, revenue, ticketsSold: registered },
    gallery: [img(`${s.id}-g1`, 600, 400), img(`${s.id}-g2`, 600, 400), img(`${s.id}-g3`, 600, 400)],
    tags: ['port harcourt', s.category.replace('cat_', '')],
    communityId: s.organizerId === ME_ID ? `com_${s.id}` : null,
    myRequestStatus: 'none',
    myTicketId: null,
    createdAt: iso(subDays(NOW, s.createdDaysAgo ?? between(5, 90))),
    updatedAt: iso(subDays(NOW, 1)),
    publishedAt: status === 'draft' ? null : iso(subDays(NOW, 10)),
  }
}

const d = (y: number, m: number, day: number, h = 16) => new Date(y, m - 1, day, h)

export const events: Event[] = [
  buildEvent({
    id: 'evt_piggyvest', slug: 'piggyvest-open-house-port-harcourt', title: 'Piggyvest Open House : Port Harcourt Edition', category: 'cat_business', organizerId: 'usr_piggyvest',
    cover: img('piggyvest-openhouse', 1200, 700), start: d(2026, 12, 4, 16), mode: 'physical', approvalRequired: true, adult: true, featured: true,
    tickets: [ticket('tt_pv_free', 'Free', 0, 500, 221, d(2026, 12, 1))], registered: 221, checkedIn: 0,
  }),
  buildEvent({
    id: 'evt_meetup', slug: 'wedpluz-meetup-ibadan', title: 'Wedpluz Meetup', category: 'cat_business', organizerId: 'usr_alex', cover: img('wedpluz-meetup', 1200, 700),
    start: d(2026, 12, 6, 10), days: 3, mode: 'physical', city: 'Ibadan', saved: true, featured: true,
    tickets: [ticket('tt_mu_free', 'General', 0, 1000, 418, d(2026, 12, 5))],
  }),
  buildEvent({
    id: 'evt_movie', slug: 'movie-in-the-park-denim-edition', title: 'Movie in the park - Denim Edition (Verge Gardens, stadium road, Portharcourt)', category: 'cat_social', organizerId: 'usr_alex',
    cover: img('movie-park-denim', 1200, 700), start: d(2026, 12, 7, 18), mode: 'physical', saved: true, featured: true,
    tickets: [ticket('tt_mv_reg', 'Regular', 500000, 300, 125, d(2026, 12, 6)), ticket('tt_mv_vip', 'VIP', 1500000, 50, 12, d(2026, 12, 6))],
  }),
  buildEvent({
    id: 'evt_bole', slug: 'bole-festival-2026', title: 'Bole Festival', category: 'cat_social', organizerId: 'usr_tessy', cover: img('bole-festival', 1200, 700),
    start: d(2027, 1, 4, 12), days: 4, mode: 'hybrid', featured: true,
    tickets: [ticket('tt_bf_free', 'Free entry', 0, 5000, 2210, d(2027, 1, 3))],
  }),
  buildEvent({
    id: 'evt_obudu', slug: 'a-trip-to-obudu-cattle-ranch', title: 'A trip to Obudu Cattle ranch', category: 'cat_travel', organizerId: 'usr_travelbeta', cover: img('obudu-ranch', 1200, 700),
    start: d(2026, 12, 16, 8), days: 3, mode: 'physical', promoted: true, approvalRequired: true, adult: true, subEvents: true, guestLimit: 200,
    tickets: [
      ticket('tt_ob_early', 'Early Birds Ticket', 11000000, 1000, 850, d(2026, 12, 10), { isEarlyBird: true, seatSelection: true, menuSelection: true }),
      ticket('tt_ob_prem', 'Premium Ticket', 20000000, 1000, 154, d(2026, 12, 14), { seatSelection: true, menuSelection: true }),
    ],
  }),
  buildEvent({
    id: 'evt_figma', slug: 'figma-make-meetup', title: 'Figma Make Meetup', category: 'cat_tech', organizerId: 'usr_figma', cover: img('figma-make', 1200, 700),
    start: d(2026, 12, 25, 11), mode: 'online', tickets: [ticket('tt_fg_free', 'Free', 0, 2000, 976, d(2026, 12, 24))],
  }),
  buildEvent({
    id: 'evt_sport', slug: 'nigeria-national-sport-festival-2026', title: 'Nigeria national sport festival 2026', category: 'cat_sports', organizerId: 'usr_alex', cover: img('sport-festival', 1200, 700),
    start: d(2026, 12, 7, 9), mode: 'hybrid', promoted: true, tickets: [ticket('tt_sp_free', 'Free', 0, 10000, 6431, d(2026, 12, 6))],
  }),
  buildEvent({
    id: 'evt_cyber', slug: 'cybersecurity-conference-2026', title: 'Cybersecurity Conference', category: 'cat_tech', organizerId: 'usr_figma', cover: img('cyber-conf', 1200, 700),
    start: d(2026, 12, 5, 9), mode: 'online', tickets: [ticket('tt_cy_free', 'Free', 0, 3000, 1210, d(2026, 12, 4))],
  }),
  buildEvent({
    id: 'evt_gala', slug: 'luxury-wedding-gala', title: 'Luxury Wedding Gala', category: 'cat_weddings', organizerId: 'usr_tessy', cover: img('wedding-gala', 1200, 700),
    start: d(2027, 1, 12, 17), mode: 'physical', promoted: true, subEvents: true,
    tickets: [ticket('tt_lg_std', 'Standard', 2500000, 400, 180, d(2027, 1, 10), { seatSelection: true }), ticket('tt_lg_tbl', 'Table of 8', 18000000, 20, 6, d(2027, 1, 10))],
  }),
  buildEvent({
    id: 'evt_halle', slug: 'halleluyah-challenge', title: 'Halleluyah challenge', category: 'cat_faith', organizerId: 'usr_tessy', cover: img('halleluyah', 1200, 700),
    start: d(2026, 12, 7, 0), mode: 'online', promoted: true, tickets: [ticket('tt_hc_free', 'Free', 0, 100000, 54312, d(2026, 12, 7))],
  }),
  buildEvent({
    id: 'evt_tolu_shower', slug: 'tolus-bridal-shower', title: 'Tolu’s Bridal Shower', category: 'cat_social', organizerId: ME_ID, cover: img('tolu-shower', 1200, 700),
    start: d(2026, 12, 28, 12), days: 2, mode: 'physical', approvalRequired: true, adult: true, guestLimit: 2000, subEvents: true,
    description: 'Tolu’s Bridal Shower is a delightful celebration that embraces elegance in simplicity. Combining timeless charm with a modern twist, this event radiates confidence, grace, and a touch of understated allure. Every detail is crafted to showcase refined femininity — effortlessly chic, subtly bold, and always tasteful.',
    tickets: [
      ticket('tt_ts_early', 'Early Birds Ticket', 1500000, 1000, 850, d(2026, 12, 20), { isEarlyBird: true, seatSelection: true, menuSelection: true }),
      ticket('tt_ts_prem', 'Premium Ticket', 20000000, 1000, 154, d(2026, 12, 26), { seatSelection: true, menuSelection: true }),
    ],
    registered: 1004, checkedIn: 312, createdDaysAgo: 20,
  }),
  buildEvent({
    id: 'evt_tolu_wed', slug: 'tolu-weds-femi', title: 'Tolu weds Femi', category: 'cat_weddings', organizerId: ME_ID, cover: img('tolu-femi', 1200, 700),
    start: d(2027, 2, 16, 10), days: 3, mode: 'physical', status: 'draft', tickets: [ticket('tt_tw_std', 'Guest', 500000, 300, 0, d(2027, 2, 14))], registered: 0, checkedIn: 0, createdDaysAgo: 2,
  }),
  buildEvent({
    id: 'evt_movie_done', slug: 'movie-in-the-park-october', title: 'Movie in the park - October Edition', category: 'cat_social', organizerId: ME_ID, cover: img('movie-park-oct', 1200, 700),
    start: d(2026, 10, 28, 18), mode: 'physical', status: 'completed', tickets: [ticket('tt_mo_reg', 'Regular', 500000, 200, 125, d(2026, 10, 27))], registered: 125, checkedIn: 118, createdDaysAgo: 60,
  }),
  buildEvent({
    id: 'evt_meetup_cancel', slug: 'wedpluz-meetup-enugu', title: 'Wedpluz Meetup - Enugu', category: 'cat_business', organizerId: ME_ID, cover: img('wedpluz-meetup-enugu', 1200, 700),
    start: d(2026, 10, 28, 10), mode: 'physical', status: 'cancelled', city: 'Enugu', tickets: [ticket('tt_me_free', 'Free', 500000, 200, 125, d(2026, 10, 27))], registered: 125, checkedIn: 0, createdDaysAgo: 70,
  }),
  buildEvent({
    id: 'evt_pending', slug: 'lagos-tech-mixer', title: 'Lagos Tech Mixer', category: 'cat_tech', organizerId: 'usr_g3', cover: img('tech-mixer', 1200, 700),
    start: d(2026, 12, 20, 17), mode: 'physical', status: 'pending_review', city: 'Lagos', tickets: [ticket('tt_tm_std', 'Standard', 300000, 500, 0, d(2026, 12, 19))], registered: 0, checkedIn: 0, createdDaysAgo: 1,
  }),
  buildEvent({
    id: 'evt_pending2', slug: 'abuja-food-fair', title: 'Abuja Food Fair', category: 'cat_food', organizerId: 'usr_g7', cover: img('food-fair', 1200, 700),
    start: d(2027, 1, 9, 12), mode: 'physical', status: 'pending_review', city: 'Abuja', tickets: [ticket('tt_ff_std', 'Entry', 200000, 2000, 0, d(2027, 1, 8))], registered: 0, checkedIn: 0, createdDaysAgo: 0,
  }),
]

// extra generated events for admin tables and pagination
for (let i = 0; i < 28; i++) {
  const start = addDays(NOW, between(-120, 120))
  const status = start < NOW ? pick(['completed', 'completed', 'cancelled']) : pick(['live', 'live', 'live', 'suspended'])
  events.push(
    buildEvent({
      id: `evt_g${i}`,
      slug: `generated-event-${i}`,
      title: pick(['Jazz Night', 'Startup Pitch Day', 'Yoga in the Park', 'Owambe Saturday', 'Design Sprint Workshop', 'Gospel Concert', 'Marathon 10K', 'Wine Tasting', 'Comedy Night', 'Book Fair']) + ` ${i + 1}`,
      category: pick(categories).id,
      organizerId: pick(['usr_alex', 'usr_tessy', 'usr_figma', 'usr_piggyvest', 'usr_travelbeta', 'usr_g1', 'usr_g2']),
      cover: img(`gen-${i}`, 1200, 700),
      start,
      mode: pick(['physical', 'online', 'hybrid']),
      status,
      city: pick(['Port Harcourt', 'Lagos', 'Abuja', 'Ibadan']),
      tickets: [ticket(`tt_g${i}`, 'General', pick([0, 0, 200000, 500000, 1500000]), 500, between(0, 480), addDays(start, -1))],
    }),
  )
}

export const findEvent = (idOrSlug: string) => events.find((e) => e.id === idOrSlug || e.slug === idOrSlug)

export function toSummary(e: Event) {
  const { description: _d, visibility: _v, schedules: _s, subEvents: _se, ticketTypes: _t, menu: _m, stats, gallery: _g, tags: _tg, ...rest } = e
  return { ...rest, organizer: userSummary(e.organizer.id), promotion: e.isPromoted ? { commissionPercent: e.promotion.commissionPercent, promotersCount: e.promotion.promotersCount } : null, ticketsSold: stats.ticketsSold }
}

/* ------------------------------------------------------------------ */
/* Event requests / managers / vendors / tasks / activity              */
/* ------------------------------------------------------------------ */

export const eventRequests: EventRequest[] = Array.from({ length: 12 }, (_, i) => {
  const u = users[4 + (i % 8)] as User
  const e = findEvent('evt_tolu_shower') as Event
  return {
    id: `req_${i}`,
    event: { id: e.id, title: e.title, coverUrl: e.coverUrl, startsAt: e.startsAt },
    user: userSummary(u.id),
    firstName: u.firstName,
    lastName: u.lastName,
    status: 'pending',
    createdAt: iso(subHours(NOW, i * 5 + 1)),
  }
})

export const managers: Record<string, EventManager[]> = {
  evt_tolu_shower: [
    { id: 'mgr_1', user: userSummary('usr_shotitmoi'), access: 'full', permissions: ['manage_guests', 'scan_tickets', 'manage_tasks', 'manage_vendors', 'manage_assets', 'view_revenue', 'edit_event', 'manage_community'], status: 'pending', invitedAt: iso(subDays(NOW, 2)), respondedAt: null },
    { id: 'mgr_2', user: userSummary('usr_bestchefz'), access: 'full', permissions: ['manage_guests', 'scan_tickets', 'manage_tasks', 'manage_vendors', 'manage_assets', 'view_revenue', 'edit_event', 'manage_community'], status: 'accepted', invitedAt: iso(subDays(NOW, 5)), respondedAt: iso(subDays(NOW, 4)) },
    { id: 'mgr_3', user: userSummary('usr_belema'), access: 'partial', permissions: ['manage_guests', 'scan_tickets'], status: 'accepted', invitedAt: iso(subDays(NOW, 6)), respondedAt: iso(subDays(NOW, 6)) },
  ],
}

export const vendorAssignments: Record<string, EventVendorAssignment[]> = {
  evt_tolu_shower: [
    { id: 'va_1', vendor: { id: 'ven_shotitmoi', businessName: 'Shot it moi', category: 'Photographer', avatarUrl: avatar(33), userId: 'usr_shotitmoi' }, role: 'Photography', status: 'accepted', invitedAt: iso(subDays(NOW, 7)) },
    { id: 'va_2', vendor: { id: 'ven_bestchefz', businessName: 'bestchefz', category: 'Caterer', avatarUrl: avatar(51), userId: 'usr_bestchefz' }, role: 'Catering', status: 'accepted', invitedAt: iso(subDays(NOW, 7)) },
    { id: 'va_3', vendor: { id: 'ven_beayouwedz', businessName: 'Bea-you-wedz', category: 'Rentals', avatarUrl: avatar(45), userId: 'usr_beayouwedz' }, role: 'Decor rentals', status: 'declined', invitedAt: iso(subDays(NOW, 3)) },
  ],
}

const taskSeed: Array<[string, EventTask['status'], number, string[], number, boolean?]> = [
  ['Organize Floral Arrangements', 'todo', -5, ['usr_alice'], 2, true],
  ['Bake Wedding Cake', 'todo', 20, ['usr_bestchefz', 'usr_michael'], 1],
  ['Plan Honeymoon', 'todo', 29, ['usr_emily', 'usr_david'], 2],
  ['Book Hairstylist', 'in_progress', 15, ['usr_alice'], 1],
  ['Plan Reception Menu', 'in_progress', 25, ['usr_bestchefz'], 2],
  ['Bake Reception Cake', 'in_progress', 21, ['usr_bestchefz'], 1],
  ['Pack Sovenir', 'in_progress', 21, ['usr_emily', 'usr_david'], 3],
  ['Send Invitations', 'done', -2, ['usr_alice', 'usr_michael'], 3],
  ['Book Photographer', 'done', 5, ['usr_shotitmoi', 'usr_alice'], 1],
]
export const tasks: EventTask[] = taskSeed.map(([title, status, due, assignees, attachments, overdue], i) => ({
  id: `task_${i}`,
  eventId: 'evt_tolu_shower',
  title,
  description: 'Coordinate with the vendor and confirm final numbers 48 hours before the event.',
  status,
  dueAt: iso(addDays(NOW, due)),
  assignees: assignees.map(userSummary),
  attachments: Array.from({ length: attachments }, (_, j) => ({ id: `att_${i}_${j}`, name: `brief-${j + 1}.pdf`, url: '#' })),
  createdBy: userSummary(ME_ID),
  createdAt: iso(subDays(NOW, 10 - i)),
  completedAt: status === 'done' ? iso(subDays(NOW, 1)) : null,
  isOverdue: Boolean(overdue),
}))

export const activityLog: ActivityLogEntry[] = [
  { id: 'act_1', actor: userSummary('usr_bestchefz'), actorRole: 'manager', action: 'guest.checked_in', description: 'checked in John Brown (Platinum)', createdAt: iso(subMinutes(NOW, 2)) },
  { id: 'act_2', actor: userSummary('usr_shotitmoi'), actorRole: 'vendor', action: 'task.completed', description: 'marked “Book Photographer” as done', createdAt: iso(subMinutes(NOW, 40)) },
  { id: 'act_3', actor: userSummary(ME_ID), actorRole: 'organizer', action: 'ticket.created', description: 'added ticket type “Premium Ticket”', createdAt: iso(subHours(NOW, 5)) },
  { id: 'act_4', actor: userSummary('usr_belema'), actorRole: 'manager', action: 'request.approved', description: 'approved 4 pending guest requests', createdAt: iso(subHours(NOW, 9)) },
  { id: 'act_5', actor: userSummary('usr_bestchefz'), actorRole: 'vendor', action: 'menu.updated', description: 'updated the reception menu', createdAt: iso(subDays(NOW, 1)) },
]

/* ------------------------------------------------------------------ */
/* Tickets & orders                                                    */
/* ------------------------------------------------------------------ */

const ticketEvent = (e: Event) => ({ id: e.id, slug: e.slug, title: e.title, coverUrl: e.coverUrl, startsAt: e.startsAt, endsAt: e.endsAt, attendanceMode: e.attendanceMode, city: e.city })

export const tickets: Ticket[] = [
  {
    id: 'tkt_1', code: 'DT78-216-M0', orderId: 'ord_1', eventId: 'evt_gala', event: ticketEvent(findEvent('evt_gala') as Event), ticketTypeName: 'Standard', holderName: 'John Brown',
    qrPayload: 'WP|tkt_1|DT78-216-M0|evt_gala', status: 'valid', checkedInAt: null, seat: { tableLabel: 'Table 1', seatLabel: 'Seat 8' }, scheduleId: 'evt_gala_sch1',
    additionalGuests: [{ firstName: 'Tahilah', lastName: 'Brown' }], foodLines: [{ menuItem: { id: 'mi_4', name: 'Combo Platter', price: 150000 }, quantity: 2, subtotal: 300000 }, { menuItem: { id: 'mi_5', name: 'Chicken Wings', price: 950000 }, quantity: 1, subtotal: 950000 }, { menuItem: { id: 'mi_6', name: 'Spring rolls', price: 800000 }, quantity: 1, subtotal: 800000 }],
    orderTotal: 3600000, currency: 'NGN', refund: null, transferredTo: null, createdAt: iso(subDays(NOW, 3)),
  },
  {
    id: 'tkt_2', code: 'DT78-216-M1', orderId: 'ord_1', eventId: 'evt_gala', event: ticketEvent(findEvent('evt_gala') as Event), ticketTypeName: 'Standard', holderName: 'Tahilah Brown',
    qrPayload: 'WP|tkt_2|DT78-216-M1|evt_gala', status: 'valid', checkedInAt: null, seat: { tableLabel: 'Table 1', seatLabel: 'Seat 7' }, scheduleId: 'evt_gala_sch1',
    additionalGuests: [], foodLines: [], orderTotal: 3600000, currency: 'NGN', refund: null, transferredTo: null, createdAt: iso(subDays(NOW, 3)),
  },
  {
    id: 'tkt_3', code: 'PV11-902-AA', orderId: 'ord_2', eventId: 'evt_piggyvest', event: ticketEvent(findEvent('evt_piggyvest') as Event), ticketTypeName: 'Free', holderName: 'John Brown',
    qrPayload: 'WP|tkt_3|PV11-902-AA|evt_piggyvest', status: 'valid', checkedInAt: null, seat: null, scheduleId: 'evt_piggyvest_sch1',
    additionalGuests: [], foodLines: [], orderTotal: 0, currency: 'NGN', refund: null, transferredTo: null, createdAt: iso(subDays(NOW, 1)),
  },
  {
    id: 'tkt_4', code: 'MO88-100-ZZ', orderId: 'ord_3', eventId: 'evt_movie_done', event: ticketEvent(findEvent('evt_movie_done') as Event), ticketTypeName: 'Regular', holderName: 'John Brown',
    qrPayload: 'WP|tkt_4|MO88-100-ZZ|evt_movie_done', status: 'checked_in', checkedInAt: iso(d(2026, 10, 28, 18)), seat: null, scheduleId: null,
    additionalGuests: [], foodLines: [], orderTotal: 500000, currency: 'NGN', refund: null, transferredTo: null, createdAt: iso(subDays(NOW, 30)),
  },
  {
    id: 'tkt_5', code: 'ME22-443-QP', orderId: 'ord_4', eventId: 'evt_meetup_cancel', event: ticketEvent(findEvent('evt_meetup_cancel') as Event), ticketTypeName: 'Free', holderName: 'John Brown',
    qrPayload: 'WP|tkt_5|ME22-443-QP|evt_meetup_cancel', status: 'cancelled', checkedInAt: null, seat: null, scheduleId: null,
    additionalGuests: [], foodLines: [], orderTotal: 500000, currency: 'NGN',
    refund: { id: 'rf_1', status: 'processing', amount: 500000, currency: 'NGN', reason: 'Event cancelled by organizer', requestedAt: iso(subDays(NOW, 12)), completedAt: null }, transferredTo: null, createdAt: iso(subDays(NOW, 40)),
  },
]

export const orders: Order[] = [
  {
    id: 'ord_1', reference: 'WP-ORD-7781', event: toSummary(findEvent('evt_gala') as Event), status: 'paid', paymentMethod: 'paystack',
    attendee: { firstName: 'John', lastName: 'Brown', email: 'johnbrown@gmail.com' }, additionalGuests: [{ firstName: 'Tahilah', lastName: 'Brown' }],
    lines: [{ ticketType: { id: 'tt_lg_std', name: 'Standard', price: 2500000, currency: 'NGN' }, quantity: 2, subtotal: 5000000 }],
    foodLines: tickets[0]!.foodLines, seats: [{ scheduleId: 'evt_gala_sch1', seatId: 't1_s8', tableLabel: 'Table 1', seatLabel: 'Seat 8' }, { scheduleId: 'evt_gala_sch1', seatId: 't1_s7', tableLabel: 'Table 1', seatLabel: 'Seat 7' }],
    subtotal: 7050000, serviceFee: 150000, discount: 0, total: 7200000, currency: 'NGN', paidAt: iso(subDays(NOW, 3)), createdAt: iso(subDays(NOW, 3)), tickets: [tickets[0]!, tickets[1]!], receiptUrl: '/receipts/WP-ORD-7781.pdf',
  },
]

export const checkIns: CheckInRecord[] = [2, 5, 11, 18, 20, 32, 41, 55].map((m, i) => ({
  id: `ci_${i}`,
  ticketCode: `TS${i}1-${100 + i}-AB`,
  attendee: userSummary((users[4 + (i % 6)] as User).id),
  ticketTypeName: 'Platinum',
  checkedInAt: iso(subMinutes(NOW, m)),
  checkedInBy: userSummary('usr_bestchefz'),
  method: i % 3 === 0 ? 'manual' : 'scan',
}))

export const guestList: GuestListEntry[] = Array.from({ length: 48 }, (_, i) => {
  const u = users[(4 + i) % users.length] as User
  const checked = i % 2 === 0
  return {
    id: `gl_${i}`,
    user: userSummary(u.id),
    ticketTypeName: pick(['Platinum', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Diamond']),
    ticketStatus: checked ? 'checked_in' : 'valid',
    checkedInAt: checked ? iso(subMinutes(NOW, i * 7)) : null,
    requestStatus: i % 9 === 0 ? 'pending' : 'approved',
    paymentStatus: i % 11 === 0 ? 'unpaid' : 'paid',
    subEventTitle: i % 6 === 0 ? 'After Party' : null,
  }
})

/* ------------------------------------------------------------------ */
/* Promotions (Earn with Wedpluz)                                      */
/* ------------------------------------------------------------------ */

export const promoterEnrollments: PromoterEnrollment[] = ['evt_movie', 'evt_halle', 'evt_sport', 'evt_meetup'].map((eid, i) => {
  const e = findEvent(eid) as Event
  return {
    id: `pe_${i}`,
    event: toSummary(e),
    commissionPercent: 10,
    shareLink: `https://wedpluz.com/events/${e.slug}?ref=JOHNB${i}`,
    shareCode: `JOHNB${i}`,
    signups: [12, 48, 7, 0][i] ?? 0,
    targetSignups: i === 1 ? 40 : 50,
    earnings: [60000, 240000, 35000, 0][i] ?? 0,
    withdrawable: i === 1,
    status: 'active',
    joinedAt: iso(subDays(NOW, 10 + i)),
  }
})

/* ------------------------------------------------------------------ */
/* Vendors                                                             */
/* ------------------------------------------------------------------ */

const vendorCategories = [
  { id: 'vc_photo', name: 'Photographer', slug: 'photographer' },
  { id: 'vc_cater', name: 'Caterer', slug: 'caterer' },
  { id: 'vc_rent', name: 'Rentals', slug: 'rentals' },
  { id: 'vc_fashion', name: 'Fashion', slug: 'fashion' },
  { id: 'vc_planner', name: 'Event Planner', slug: 'event-planner' },
  { id: 'vc_decor', name: 'Decorator', slug: 'decorator' },
  { id: 'vc_dj', name: 'DJ', slug: 'dj' },
  { id: 'vc_mua', name: 'Makeup Artist', slug: 'makeup-artist' },
]
export { vendorCategories }

export const businessCategories = ['Art & Design', 'Beauty & Personal Care', 'Education & Training', 'Events & Entertainment', 'Fashion & Apparel', 'Food & Beverage', 'Health & Wellness', 'Real Estate & Construction', 'Retail & E-Commerce', 'Technology & Services', 'Travel & Hospitality']

function work(vendorId: string, i: number, mediaCount: number, title: string): VendorWork {
  return {
    id: `work_${vendorId}_${i}`,
    vendorId,
    title,
    description: 'A full-day coverage capturing candid and editorial moments.',
    media: Array.from({ length: mediaCount }, (_, j) => ({ id: `m_${vendorId}_${i}_${j}`, type: j === 0 && i % 3 === 0 ? 'video' : 'image', url: img(`${vendorId}-w${i}-${j}`, 900, 900), thumbnailUrl: img(`${vendorId}-w${i}-${j}`, 400, 400) })),
    likesCount: between(10, 1200),
    isLiked: false,
    createdAt: iso(subDays(NOW, i * 9 + 3)),
  }
}

function review(vendorId: string, i: number, authorId: string, rating: number, comment: string, mine = false): VendorReview {
  return { id: `rev_${vendorId}_${i}`, author: userSummary(authorId), rating, comment, createdAt: iso(subDays(NOW, i * 6 + 2)), updatedAt: null, isMine: mine }
}

export const vendors: Vendor[] = [
  {
    id: 'ven_shotitmoi', userId: 'usr_shotitmoi', businessName: 'Shot it moi', slug: 'shot-it-moi', category: vendorCategories[0]!, location: 'Portharcourt', avatarUrl: avatar(33), coverUrl: img('shotitmoi-cover', 1440, 400),
    rating: 4.9, ratingsCount: 128, likesCount: 1000, isVerified: true, isSaved: true, featuredWorks: [], availability: 'available', description: 'Editorial wedding and portrait photographer based in Port Harcourt. We tell stories through light.',
    contactEmail: 'hello@shotitmoi.com', contactPhone: '+2348000000001', website: 'https://shotitmoi.com', socials: { instagram: 'shotitmoi' }, status: 'active', worksCount: 6,
    reviews: [review('ven_shotitmoi', 0, 'usr_alice', 5, 'Absolutely stunning photos, delivered on time!'), review('ven_shotitmoi', 1, ME_ID, 4, 'Great eye for detail. Would book again.', true), review('ven_shotitmoi', 2, 'usr_david', 5, 'Professional and friendly team.')],
    promos: [{ id: 'promo_1', title: 'December weddings 15% off', description: 'Book before Nov 30 for any December date.', discountPercent: 15, validUntil: iso(addDays(NOW, 15)), coverUrl: img('promo-1', 600, 300) }],
    joinedAt: iso(subDays(NOW, 400)), isMine: false,
  },
  {
    id: 'ven_bestchefz', userId: 'usr_bestchefz', businessName: 'bestchefz', slug: 'bestchefz', category: vendorCategories[1]!, location: 'Lagos', avatarUrl: avatar(51), coverUrl: img('bestchefz-cover', 1440, 400),
    rating: 4.9, ratingsCount: 86, likesCount: 640, isVerified: true, isSaved: false, featuredWorks: [], availability: 'busy', description: 'Premium catering for weddings, corporate events and private dinners.',
    contactEmail: 'hi@bestchefz.ng', contactPhone: '+2348000000002', website: null, socials: { instagram: 'bestchefz' }, status: 'active', worksCount: 4,
    reviews: [review('ven_bestchefz', 0, 'usr_emily', 5, 'The jollof was unreal.')], promos: [], joinedAt: iso(subDays(NOW, 300)), isMine: false,
  },
  {
    id: 'ven_beayouwedz', userId: 'usr_beayouwedz', businessName: 'Bea-you-wedz', slug: 'bea-you-wedz', category: vendorCategories[2]!, location: 'Abuja', avatarUrl: avatar(45), coverUrl: img('bea-cover', 1440, 400),
    rating: 4.9, ratingsCount: 54, likesCount: 410, isVerified: true, isSaved: true, featuredWorks: [], availability: 'available', description: 'Bridal wear rentals and styling.',
    contactEmail: 'bea@beayouwedz.com', contactPhone: null, website: null, socials: {}, status: 'active', worksCount: 4,
    reviews: [], promos: [], joinedAt: iso(subDays(NOW, 250)), isMine: false,
  },
  {
    id: 'ven_yournextevent', userId: 'usr_alex', businessName: 'Your Next Event', slug: 'your-next-event', category: vendorCategories[4]!, location: 'Port Harcourt', avatarUrl: avatar(7), coverUrl: img('yne-cover', 1440, 400),
    rating: 4.7, ratingsCount: 33, likesCount: 220, isVerified: false, isSaved: false, featuredWorks: [], availability: 'available', description: 'Full-service event planning.',
    contactEmail: 'hi@yne.ng', contactPhone: null, website: null, socials: {}, status: 'active', worksCount: 3, reviews: [], promos: [], joinedAt: iso(subDays(NOW, 150)), isMine: false,
  },
  {
    id: 'ven_chinedu', userId: 'usr_chinedu', businessName: 'Okafor Decor', slug: 'okafor-decor', category: vendorCategories[5]!, location: 'Enugu', avatarUrl: avatar(68), coverUrl: img('okafor-cover', 1440, 400),
    rating: 4.5, ratingsCount: 19, likesCount: 95, isVerified: false, isSaved: false, featuredWorks: [], availability: 'available', description: 'Floral arches and luxury event decor.',
    contactEmail: null, contactPhone: null, website: null, socials: {}, status: 'pending_verification', worksCount: 2, reviews: [], promos: [], joinedAt: iso(subDays(NOW, 20)), isMine: false,
  },
]
for (let i = 0; i < 14; i++) {
  const c = pick(vendorCategories)
  const owner = users[16 + i] as User
  vendors.push({
    id: `ven_g${i}`, userId: owner.id, businessName: `${owner.firstName}'s ${c.name} Studio`, slug: `vendor-${i}`, category: c, location: pick(['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan']), avatarUrl: owner.avatarUrl, coverUrl: img(`vg-${i}`, 1440, 400),
    rating: Number((3.8 + rand() * 1.2).toFixed(1)), ratingsCount: between(2, 90), likesCount: between(5, 500), isVerified: rand() > 0.6, isSaved: false, featuredWorks: [], availability: pick(['available', 'busy']),
    description: 'We make events memorable.', contactEmail: owner.email, contactPhone: null, website: null, socials: {}, status: pick(['active', 'active', 'active', 'pending_verification', 'suspended']), worksCount: 3, reviews: [], promos: [], joinedAt: iso(subDays(NOW, between(5, 300))), isMine: false,
  })
}

export const works: VendorWork[] = vendors.flatMap((v, vi) =>
  Array.from({ length: v.worksCount }, (_, i) => work(v.id, i, [4, 2, 1, 1, 1, 8][i] ?? 1, ['Editorial shoot', 'Reception coverage', 'Venue setup', 'Portrait session', 'Bridal prep', 'Cocktail hour'][(i + vi) % 6] ?? 'Work')),
)
for (const v of vendors) v.featuredWorks = works.filter((w) => w.vendorId === v.id).slice(0, 4).flatMap((w) => w.media.slice(0, 1))

export const findVendor = (idOrSlug: string) => vendors.find((v) => v.id === idOrSlug || v.slug === idOrSlug)

/* ------------------------------------------------------------------ */
/* Communities / messaging                                             */
/* ------------------------------------------------------------------ */

const defaultPerms = { membersCanSendMessages: true, membersCanPostStatus: true, membersCanInvite: false, membersCanGoLive: false, requireApprovalToJoin: false }

export const communities: Community[] = [
  { id: 'com_tessy', eventId: 'evt_gala', event: { id: 'evt_gala', slug: 'luxury-wedding-gala', title: 'Tessy’s wedding', coverUrl: img('wedding-gala', 400, 300), startsAt: (findEvent('evt_gala') as Event).startsAt, isPromoted: true }, name: 'Tessy’s Wedding', description: null, avatarUrl: avatar(29), membersCount: 48, onlineCount: 6, myRole: 'co_admin', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/TESSY2026', isArchived: false, isMuted: true, isPinned: true, createdAt: iso(subDays(NOW, 20)) },
  { id: 'com_piggy', eventId: 'evt_piggyvest', event: { id: 'evt_piggyvest', slug: 'piggyvest-open-house-port-harcourt', title: 'Piggyvest Open House: PortHarcourt', coverUrl: img('piggyvest-openhouse', 400, 300), startsAt: (findEvent('evt_piggyvest') as Event).startsAt, isPromoted: false }, name: 'Piggyvest Open House: PortHarcourt', description: 'Official attendee community', avatarUrl: img('piggyvest-openhouse', 100, 100), membersCount: 221, onlineCount: 14, myRole: 'member', permissions: { ...defaultPerms, membersCanSendMessages: false }, inviteLink: 'https://wedpluz.com/c/join/PIGGY', isArchived: false, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 14)) },
  { id: 'com_meetup', eventId: 'evt_meetup', event: { id: 'evt_meetup', slug: 'wedpluz-meetup-ibadan', title: 'Wedpluz meetup', coverUrl: img('wedpluz-meetup', 400, 300), startsAt: (findEvent('evt_meetup') as Event).startsAt, isPromoted: false }, name: 'Wedpluz meetup', description: 'Meet other attendees before the day', avatarUrl: img('wedpluz-meetup', 100, 100), membersCount: 418, onlineCount: 31, myRole: 'member', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/MEETUP', isArchived: false, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 30)) },
  { id: 'com_chinedu', eventId: null, event: null, name: 'Chinedu’s Festivity', description: 'Friends & family', avatarUrl: avatar(68), membersCount: 32, onlineCount: 2, myRole: 'member', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/CHIN', isArchived: false, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 50)) },
  { id: 'com_culinary', eventId: null, event: null, name: 'Culinary Extravaganza', description: null, avatarUrl: avatar(51), membersCount: 80, onlineCount: 0, myRole: 'member', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/CUL', isArchived: false, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 90)) },
  { id: 'com_evt_tolu_shower', eventId: 'evt_tolu_shower', event: { id: 'evt_tolu_shower', slug: 'tolus-bridal-shower', title: 'Tolu’s Bridal Shower', coverUrl: img('tolu-shower', 400, 300), startsAt: (findEvent('evt_tolu_shower') as Event).startsAt, isPromoted: false }, name: 'Tolu’s Bridal Shower', description: 'Guests of Tolu', avatarUrl: img('tolu-shower', 100, 100), membersCount: 1004, onlineCount: 40, myRole: 'owner', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/TOLU', isArchived: false, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 18)) },
  { id: 'com_old', eventId: null, event: null, name: 'Wedpluz Meetup (Oct)', description: null, avatarUrl: img('wedpluz-meetup-enugu', 100, 100), membersCount: 125, onlineCount: 0, myRole: 'member', permissions: defaultPerms, inviteLink: 'https://wedpluz.com/c/join/OLD', isArchived: true, isMuted: false, isPinned: false, createdAt: iso(subDays(NOW, 120)) },
]

export const communityMembers: Record<string, CommunityMember[]> = Object.fromEntries(
  communities.map((c) => [
    c.id,
    [ME_ID, 'usr_shotitmoi', 'usr_chinedu', 'usr_bestchefz', 'usr_alice', 'usr_michael', 'usr_emily', 'usr_david', 'usr_tessy'].map((uid, i) => ({
      id: `cm_${c.id}_${i}`,
      user: userSummary(uid),
      role: uid === ME_ID ? c.myRole : i === 8 ? 'owner' : i === 1 ? 'co_admin' : 'member',
      joinedAt: iso(subDays(NOW, 10 + i)),
      isVendor: Boolean(findUser(uid)?.isVendor),
      isOnline: i % 3 === 0,
    })),
  ]),
)

export const statusPosts: StatusPost[] = ['usr_shotitmoi', 'usr_tessy', 'usr_alice', 'usr_bestchefz', 'usr_chinedu', 'usr_michael', ME_ID].map((uid, i) => ({
  id: `st_${i}`,
  communityId: 'com_tessy',
  author: userSummary(uid),
  mediaUrl: img(`status-${i}`, 540, 960),
  mediaType: 'image',
  caption: i === 0 ? 'Setup day!' : null,
  likesCount: between(2, 40),
  viewsCount: between(10, 200),
  isLiked: i === 1,
  viewedByMe: i > 3,
  expiresAt: iso(addHours(NOW, 20 - i)),
  createdAt: iso(subHours(NOW, i + 1)),
}))

const convo = (id: string, type: Conversation['type'], title: string, avatarUrl: string | null, participants: string[], last: string | null, minutesAgo: number, extra: Partial<Conversation> = {}): Conversation => ({
  id,
  type,
  title,
  avatarUrl,
  participants: participants.map(userSummary),
  communityId: type === 'community' ? id.replace(/^cv_/, '') : null,
  lastMessage: last ? { id: `${id}_last`, body: last, type: 'text', sender: userSummary(participants[0] ?? ME_ID), createdAt: iso(subMinutes(NOW, minutesAgo)) } : null,
  unreadCount: 0,
  isPinned: false,
  isMuted: false,
  isArchived: false,
  isRequest: false,
  updatedAt: iso(subMinutes(NOW, minutesAgo)),
  ...extra,
})

export const conversations: Conversation[] = [
  convo('cv_shotitmoi', 'direct', 'Shot it moi', avatar(33), ['usr_shotitmoi'], 'That’s great! It’s on the 19th. We’d like full-day coverage.', 5, { unreadCount: 2, isMuted: true, isPinned: true }),
  convo('cv_com_tessy', 'community', 'Tessy’s Wedding', avatar(29), ['usr_tessy', 'usr_shotitmoi', 'usr_chinedu', 'usr_bestchefz'], 'Perfect. We’ll start plating around 1PM. Tessy asked for extra seafood options, so we’re adding that…', 5, { unreadCount: 2, isMuted: true }),
  convo('cv_bea', 'direct', 'Bea-you-wedz', avatar(45), ['usr_beayouwedz'], 'The pink dress will be perfect for the bridesmaids.', 120, { isPinned: true }),
  convo('cv_chinedu', 'direct', 'Chinedu Okafor', avatar(68), ['usr_chinedu'], 'I noticed some stiffness in my neck after my last…', 3 * 24 * 60, { unreadCount: 2 }),
  convo('cv_bestchefz', 'direct', 'Bestchefz', avatar(51), ['usr_bestchefz'], 'I really love the last cake i bought from you. it was delicious.', 14 * 24 * 60),
  convo('cv_com_piggy', 'community', 'Piggyvest Open House: PortHarcourt', img('piggyvest-openhouse', 100, 100), ['usr_piggyvest'], null, 14 * 24 * 60),
  convo('cv_com_meetup', 'community', 'Wedpluz meetup', img('wedpluz-meetup', 100, 100), ['usr_alex'], 'The pink dress is going to be just right for my bridesmaids.', 120),
  convo('cv_com_chinedu', 'community', 'Chinedu’s Festivity', avatar(68), ['usr_chinedu'], 'After my last workout, I felt some tightness in my…', 3 * 24 * 60, { unreadCount: 2 }),
  convo('cv_com_culinary', 'community', 'Culinary Extravaganza', avatar(51), ['usr_bestchefz'], 'Just wanted to say how much everyone enjoyed the last…', 14 * 24 * 60),
  convo('cv_req_1', 'request', 'Ada Okoye', avatar(21), ['usr_g0'], 'Hi! I saw your event and wanted to ask about vendor slots.', 60, { isRequest: true, unreadCount: 1 }),
  convo('cv_req_2', 'request', 'Tunde Bello', null, ['usr_g1'], 'Are tickets still available for the gala?', 400, { isRequest: true, unreadCount: 1 }),
]

const msg = (id: string, conversationId: string, senderId: string, body: string | null, minutesAgo: number, extra: Partial<Message> = {}): Message => ({
  id,
  conversationId,
  sender: userSummary(senderId),
  type: 'text',
  body,
  attachments: [],
  replyTo: null,
  reactions: [],
  event: null,
  isPinned: false,
  isStarred: false,
  isMine: senderId === ME_ID,
  deletedBy: 'none',
  status: 'read',
  createdAt: iso(subMinutes(NOW, minutesAgo)),
  ...extra,
})

export const messages: Message[] = [
  msg('m1', 'cv_com_tessy', ME_ID, 'Hey guys! Just confirming — we’re all set for Tessy’s wedding this Saturday, right?', 70, { isStarred: true, isPinned: true }),
  msg('m2', 'cv_com_tessy', 'usr_shotitmoi', 'Yup! My team and I will be there by 8AM for setup and bridal prep shots 📸', 66, { isStarred: true, reactions: [{ emoji: '👏', count: 1, reactedByMe: true }] }),
  msg('m3', 'cv_com_tessy', 'usr_chinedu', 'Decor team’s good to go. We’re bringing the floral arches and that gold-white setup Tessy approved. Setup starts by 6AM 🌸✨', 64),
  msg('m4', 'cv_com_tessy', ME_ID, 'Sound and lights locked in. I’ll do the sound check once decor’s done — say around 10? 🎶', 60, { replyTo: { id: 'm2', sender: userSummary('usr_shotitmoi'), body: 'Yup! My team and I will be there by 8AM for setup and bridal prep shots 📸', type: 'text' } }),
  msg('m5', 'cv_com_tessy', ME_ID, null, 58, { type: 'audio', attachments: [{ id: 'a1', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', thumbnailUrl: null, name: null, sizeBytes: null, durationSeconds: 20, waveform: Array.from({ length: 40 }, () => between(10, 100)) }] }),
  msg('m6', 'cv_com_tessy', ME_ID, 'This wedding’s about to look premium! Everyone bring your A-game.', 55, { type: 'image', attachments: [{ id: 'a2', type: 'image', url: img('bride-1', 600, 600), thumbnailUrl: img('bride-1', 300, 300), name: null, sizeBytes: null, durationSeconds: null }, { id: 'a3', type: 'image', url: img('bride-2', 600, 600), thumbnailUrl: img('bride-2', 300, 300), name: null, sizeBytes: null, durationSeconds: null }], replyTo: { id: 'm5', sender: userSummary(ME_ID), body: null, type: 'audio' }, reactions: [{ emoji: '❤️', count: 3, reactedByMe: false }] }),
  msg('m7', 'cv_com_tessy', 'usr_bestchefz', 'Perfect. We’ll start plating around 1PM. Tessy asked for extra seafood options, so we’re adding that to the menu.', 50, { replyTo: { id: 'm6', sender: userSummary(ME_ID), body: 'This wedding’s about to look premium! Everyone bring your A-game.', type: 'image' }, isStarred: true, isPinned: true }),
  msg('m8', 'cv_com_tessy', 'usr_bestchefz', null, 48, { deletedBy: 'admin' }),
  msg('m9', 'cv_com_tessy', ME_ID, null, 46, { deletedBy: 'admin' }),
  msg('m10', 'cv_com_tessy', 'usr_tessy', null, 40, { type: 'event_promo', event: { id: 'evt_gala', slug: 'luxury-wedding-gala', title: 'Luxury Wedding Gala', coverUrl: img('wedding-gala', 400, 300), startsAt: (findEvent('evt_gala') as Event).startsAt, minPrice: 2500000, isFree: false, currency: 'NGN' } }),

  msg('s1', 'cv_shotitmoi', ME_ID, 'Hi! Are you available on the 19th of December for a wedding in PH?', 30),
  msg('s2', 'cv_shotitmoi', 'usr_shotitmoi', 'Hello John! Yes we are. Is it a full day?', 20),
  msg('s3', 'cv_shotitmoi', 'usr_shotitmoi', 'That’s great! It’s on the 19th. We’d like full-day coverage.', 5),

  msg('b1', 'cv_bea', 'usr_beayouwedz', 'The pink dress will be perfect for the bridesmaids.', 120),
  msg('c1', 'cv_chinedu', 'usr_chinedu', 'I noticed some stiffness in my neck after my last session, any tips?', 3 * 24 * 60),
  msg('bc1', 'cv_bestchefz', ME_ID, 'I really love the last cake i bought from you. it was delicious.', 14 * 24 * 60),
  msg('r1', 'cv_req_1', 'usr_g0', 'Hi! I saw your event and wanted to ask about vendor slots.', 60),
  msg('r2', 'cv_req_2', 'usr_g1', 'Are tickets still available for the gala?', 400),
]

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notifications: AppNotification[] = [
  { id: 'n1', type: 'manager_invite_accepted', actor: userSummary('usr_belema'), title: 'Belema accepted your manager invite', body: '', segments: [{ text: 'Belema', emphasis: true }, { text: ' accepted your manager invite' }], action: 'none', actionState: null, data: { eventId: 'evt_tolu_shower' }, isRequest: false, readAt: null, createdAt: iso(subHours(NOW, 1)), link: '/manage/events/evt_tolu_shower/managers' },
  { id: 'n2', type: 'event_request_approved', actor: userSummary('usr_alex'), title: 'Request approved', body: '', segments: [{ text: 'Alex Thompson', emphasis: true }, { text: ' has accepted you to request for movie in the pleasure park event.' }], action: 'register', actionState: 'pending', data: { eventId: 'evt_movie', slug: 'movie-in-the-park-denim-edition' }, isRequest: false, readAt: null, createdAt: iso(subMinutes(NOW, 50)), link: '/events/movie-in-the-park-denim-edition' },
  { id: 'n3', type: 'collaboration_invite', actor: userSummary('usr_alex'), title: 'Collaboration invite', body: '', segments: [{ text: 'Alex Thompson', emphasis: true }, { text: ' has invited you to link ' }, { text: 'movie int pleasure park', emphasis: true }, { text: ' event with 2 others' }], action: 'accept_decline', actionState: 'pending', data: { collaborationId: 'col_1' }, isRequest: true, readAt: null, createdAt: iso(subMinutes(NOW, 45)), link: null },
  { id: 'n4', type: 'vendor_invite', actor: userSummary('usr_g5'), title: 'Vendor invite', body: '', segments: [{ text: 'Chidi Eze', emphasis: true }, { text: ' invited you as a vendor for ' }, { text: 'detty december event', emphasis: true }], action: 'accept_decline', actionState: 'pending', data: { assignmentId: 'va_x' }, isRequest: true, readAt: iso(subDays(NOW, 1)), createdAt: iso(subDays(NOW, 2)), link: null },
  { id: 'n5', type: 'task_assigned', actor: userSummary('usr_alex'), title: 'Task assigned', body: '', segments: [{ text: 'Alex Thompson', emphasis: true }, { text: ' assigned you to a task on ' }, { text: 'Tolu’s bridal shower', emphasis: true }], action: 'view', actionState: null, data: { eventId: 'evt_tolu_shower', taskId: 'task_1' }, isRequest: false, readAt: iso(subDays(NOW, 1)), createdAt: iso(subDays(NOW, 2)), link: '/manage/events/evt_tolu_shower/tasks' },
  { id: 'n6', type: 'collaboration_declined', actor: null, title: 'Collaboration declined', body: '', segments: [{ text: 'Collaboration request to link ' }, { text: 'movie in the park', emphasis: true }, { text: ' event was ' }, { text: 'declined', emphasis: true }], action: 'none', actionState: null, data: {}, isRequest: false, readAt: iso(subDays(NOW, 5)), createdAt: iso(subDays(NOW, 9)), link: null },
  { id: 'n7', type: 'wallet_credit', actor: null, title: 'Wallet credited', body: '', segments: [{ text: 'Your wallet was credited with ' }, { text: '₦5,000', emphasis: true }], action: 'view', actionState: null, data: {}, isRequest: false, readAt: iso(subDays(NOW, 6)), createdAt: iso(subDays(NOW, 10)), link: '/wallet' },
]

/* ------------------------------------------------------------------ */
/* Wallet / plans                                                      */
/* ------------------------------------------------------------------ */

export const wallet: Wallet = {
  id: 'wal_1',
  balance: 1000000,
  pendingBalance: 240000,
  currency: 'NGN',
  isActive: true,
  pinSet: true,
  bankAccount: { id: 'ba_1', bankCode: '058', bankName: 'GTBank', accountNumber: '0123456789', accountName: 'JOHN BROWN', isDefault: true },
  dailyWithdrawalLimit: 50000000,
}

export const banks = [
  { code: '044', name: 'Access Bank' }, { code: '058', name: 'GTBank' }, { code: '057', name: 'Zenith Bank' }, { code: '033', name: 'UBA' },
  { code: '011', name: 'First Bank' }, { code: '070', name: 'Fidelity Bank' }, { code: '232', name: 'Sterling Bank' }, { code: '999992', name: 'OPay' }, { code: '50515', name: 'Moniepoint' }, { code: '090267', name: 'Kuda' },
]

export const walletTransactions: WalletTransaction[] = [
  { id: 'wt_1', reference: 'WP-TU-1001', type: 'top_up', direction: 'credit', amount: 500000, fee: 0, currency: 'NGN', status: 'successful', description: 'Top up', counterparty: 'Paystack card ****4242', provider: 'paystack', createdAt: iso(d(2026, 6, 22, 9)), completedAt: iso(d(2026, 6, 22, 9)), metadata: {} },
  { id: 'wt_2', reference: 'WP-TU-1002', type: 'top_up', direction: 'credit', amount: 500000, fee: 0, currency: 'NGN', status: 'successful', description: 'Top up', counterparty: 'Bank transfer', provider: 'monnify', createdAt: iso(d(2026, 6, 22, 11)), completedAt: iso(d(2026, 6, 22, 11)), metadata: {} },
  { id: 'wt_3', reference: 'WP-WD-2001', type: 'withdrawal', direction: 'debit', amount: 500000, fee: 5000, currency: 'NGN', status: 'successful', description: 'Withdrawal', counterparty: 'GTBank ****6789', provider: 'monnify', createdAt: iso(d(2026, 6, 22, 15)), completedAt: iso(d(2026, 6, 22, 15)), metadata: {} },
  { id: 'wt_4', reference: 'WP-TU-1003', type: 'top_up', direction: 'credit', amount: 500000, fee: 0, currency: 'NGN', status: 'successful', description: 'Top up', counterparty: 'Paystack card ****4242', provider: 'paystack', createdAt: iso(d(2026, 6, 22, 18)), completedAt: iso(d(2026, 6, 22, 18)), metadata: {} },
  { id: 'wt_5', reference: 'WP-PE-3001', type: 'promotion_earning', direction: 'credit', amount: 240000, fee: 0, currency: 'NGN', status: 'pending', description: 'Promotion earnings · Halleluyah challenge', counterparty: null, provider: null, createdAt: iso(subDays(NOW, 2)), completedAt: null, metadata: { eventId: 'evt_halle' } },
  { id: 'wt_6', reference: 'WP-RF-4001', type: 'refund', direction: 'credit', amount: 500000, fee: 0, currency: 'NGN', status: 'processing', description: 'Refund · Wedpluz Meetup - Enugu', counterparty: null, provider: 'paystack', createdAt: iso(subDays(NOW, 12)), completedAt: null, metadata: { ticketId: 'tkt_5' } },
]

export const plans: Plan[] = [
  { id: 'plan_free', tier: 'free', name: 'Free', tagline: 'For everyone', priceMonthly: 0, priceYearly: 0, currency: 'NGN', features: ['Unlimited work uploads', 'Higher placement in vendor search', 'Advanced profile customization'], inheritsFrom: null, isPopular: false },
  { id: 'plan_basic', tier: 'basic', name: 'Basic', tagline: 'For Organisers and vendors', priceMonthly: 300000, priceYearly: 3000000, currency: 'NGN', features: ['Unlimited work uploads', 'Higher placement in vendor search', 'Advanced profile customization', 'Sub-events', 'Event promotion tools', 'Priority support', 'Pluz planner assets'], inheritsFrom: 'Free', isPopular: false },
  { id: 'plan_premium', tier: 'premium', name: 'Premium', tagline: 'For Organisers and vendors', priceMonthly: 500000, priceYearly: 5000000, currency: 'NGN', features: ['Unlimited work uploads', 'Higher placement in vendor search', 'Advanced profile customization', 'Unlimited sub-events', 'Hall layout & seat assignment', 'AI cake & branding designs', 'Lower service fees'], inheritsFrom: 'Basic', isPopular: true },
  { id: 'plan_premium_plus', tier: 'premium_plus', name: 'Premium+', tagline: 'For large Organizations', priceMonthly: 800000, priceYearly: 8000000, currency: 'NGN', features: ['Unlimited work uploads', 'Higher placement in vendor search', 'Advanced profile customization', 'Multiple team seats', 'Dedicated account manager', 'Custom commission rates', 'API access'], inheritsFrom: 'Premium', isPopular: false },
]

export let subscription: Subscription = {
  id: 'sub_1',
  plan: plans[0]!,
  interval: 'monthly',
  status: 'active',
  startedAt: iso(subDays(NOW, 200)),
  renewsAt: null,
  cancelledAt: null,
}
export const setSubscription = (s: Subscription) => {
  subscription = s
}
export const subscriptionPayments: SubscriptionPayment[] = []

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */

export const plannerChats: PlannerChat[] = [
  {
    id: 'pc_1',
    title: 'Garden wedding cake ideas',
    createdAt: iso(subDays(NOW, 3)),
    updatedAt: iso(subDays(NOW, 3)),
    messages: [
      { id: 'pm_1', role: 'user', content: 'Design a 3-tier white cake with gold accents for a garden wedding', attachments: [], generation: null, createdAt: iso(subDays(NOW, 3)) },
      { id: 'pm_2', role: 'assistant', content: 'Here are three directions for your 3-tier cake. Tap any design to save it to your assets.', attachments: [], generation: { id: 'gen_1', type: 'cake_design', prompt: '3-tier white cake with gold accents', status: 'ready', resultUrls: [img('cake-a', 600, 600), img('cake-b', 600, 600), img('cake-c', 600, 600)], createdAt: iso(subDays(NOW, 3)) }, createdAt: iso(subDays(NOW, 3)) },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const permissions: Permission[] = [
  ['dashboard.view', 'Dashboard', 'View executive dashboard', false],
  ['users.view', 'Users', 'View users', false], ['users.manage', 'Users', 'Edit users and roles', false], ['users.suspend', 'Users', 'Suspend or reactivate accounts', true],
  ['events.view', 'Events', 'View events', false], ['events.moderate', 'Events', 'Approve, reject, suspend events', true], ['events.feature', 'Events', 'Feature and promote events', false], ['categories.manage', 'Events', 'Manage categories & tags', false],
  ['organizers.view', 'Organizers', 'View organizers & vendors', false], ['organizers.verify', 'Organizers', 'Verify organizers', true], ['organizers.manage', 'Organizers', 'Manage organizer accounts', false],
  ['bookings.view', 'Bookings', 'View bookings & tickets', false], ['bookings.manage', 'Bookings', 'Resend, cancel bookings', true], ['refunds.view', 'Bookings', 'View refunds', false], ['refunds.approve', 'Bookings', 'Approve refunds', true],
  ['finance.view', 'Finance', 'View financial data', true], ['finance.reconcile', 'Finance', 'Reconcile transactions', true], ['finance.settlements', 'Finance', 'Manage settlements', true], ['finance.payouts.approve', 'Finance', 'Approve payouts', true], ['finance.commission.manage', 'Finance', 'Change commission rules', true],
  ['moderation.view', 'Moderation', 'View reports', false], ['moderation.act', 'Moderation', 'Remove/restore content, warn users', true],
  ['notifications.view', 'Notifications', 'View campaigns', false], ['notifications.send', 'Notifications', 'Send campaigns', true],
  ['settings.view', 'Settings', 'View platform settings', false], ['settings.manage', 'Settings', 'Change platform settings', true],
  ['roles.manage', 'Access', 'Manage roles & admins', true], ['audit.view', 'Access', 'View audit & security logs', false],
  ['reports.view', 'Reports', 'View reports', false], ['reports.export', 'Reports', 'Export reports', false],
  ['support.view', 'Support', 'View support tickets', false], ['support.manage', 'Support', 'Reply and resolve tickets', false],
].map(([key, module, label, isSensitive]) => ({ key: key as Permission['key'], module: module as string, label: label as string, description: label as string, isSensitive: Boolean(isSensitive) }))

const allPerms = permissions.map((p) => p.key)
export const roles: Role[] = [
  { id: 'role_super', name: 'Super Admin', slug: 'super-admin', description: 'Full access to every module', permissions: allPerms, isSystem: true, membersCount: 2, createdAt: iso(subDays(NOW, 400)) },
  { id: 'role_ops', name: 'Operations', slug: 'operations', description: 'Users, events, organizers, bookings and support', permissions: allPerms.filter((p) => !p.startsWith('finance') && !p.startsWith('roles') && !p.startsWith('settings.manage')), isSystem: false, membersCount: 4, createdAt: iso(subDays(NOW, 300)) },
  { id: 'role_finance', name: 'Finance', slug: 'finance', description: 'Transactions, settlements, payouts and refunds', permissions: ['dashboard.view', 'finance.view', 'finance.reconcile', 'finance.settlements', 'finance.payouts.approve', 'finance.commission.manage', 'refunds.view', 'refunds.approve', 'bookings.view', 'reports.view', 'reports.export', 'audit.view'], isSystem: false, membersCount: 2, createdAt: iso(subDays(NOW, 300)) },
  { id: 'role_mod', name: 'Moderator', slug: 'moderator', description: 'Content moderation and community management', permissions: ['dashboard.view', 'moderation.view', 'moderation.act', 'users.view', 'users.suspend', 'events.view', 'support.view'], isSystem: false, membersCount: 3, createdAt: iso(subDays(NOW, 200)) },
  { id: 'role_support', name: 'Support', slug: 'support', description: 'Read-only access plus support tickets', permissions: ['dashboard.view', 'users.view', 'events.view', 'bookings.view', 'refunds.view', 'support.view', 'support.manage'], isSystem: false, membersCount: 5, createdAt: iso(subDays(NOW, 150)) },
]

export const ADMIN_ME_ID = 'adm_me'
export const adminUsers: AdminUser[] = [
  { id: ADMIN_ME_ID, firstName: 'Geoffery', lastName: 'Admin', email: 'admin@wedpluz.com', avatarUrl: avatar(12), roles: [{ id: 'role_super', name: 'Super Admin', slug: 'super-admin' }], permissions: allPerms, status: 'active', twoFactorEnabled: true, lastLoginAt: iso(subHours(NOW, 1)), createdAt: iso(subDays(NOW, 400)) },
  { id: 'adm_2', firstName: 'Ngozi', lastName: 'Okoye', email: 'ngozi@wedpluz.com', avatarUrl: avatar(47), roles: [{ id: 'role_ops', name: 'Operations', slug: 'operations' }], permissions: roles[1]!.permissions, status: 'active', twoFactorEnabled: true, lastLoginAt: iso(subHours(NOW, 3)), createdAt: iso(subDays(NOW, 300)) },
  { id: 'adm_3', firstName: 'Tunde', lastName: 'Bello', email: 'tunde@wedpluz.com', avatarUrl: avatar(14), roles: [{ id: 'role_finance', name: 'Finance', slug: 'finance' }], permissions: roles[2]!.permissions, status: 'active', twoFactorEnabled: false, lastLoginAt: iso(subDays(NOW, 1)), createdAt: iso(subDays(NOW, 280)) },
  { id: 'adm_4', firstName: 'Amaka', lastName: 'Eze', email: 'amaka@wedpluz.com', avatarUrl: null, roles: [{ id: 'role_mod', name: 'Moderator', slug: 'moderator' }], permissions: roles[3]!.permissions, status: 'active', twoFactorEnabled: true, lastLoginAt: iso(subMinutes(NOW, 20)), createdAt: iso(subDays(NOW, 200)) },
  { id: 'adm_5', firstName: 'Seun', lastName: 'Lawal', email: 'seun@wedpluz.com', avatarUrl: avatar(59), roles: [{ id: 'role_support', name: 'Support', slug: 'support' }], permissions: roles[4]!.permissions, status: 'invited', twoFactorEnabled: false, lastLoginAt: null, createdAt: iso(subDays(NOW, 3)) },
]
const adminRef = (id: string) => {
  const a = adminUsers.find((x) => x.id === id) as AdminUser
  return { id: a.id, firstName: a.firstName, lastName: a.lastName }
}

export const adminUserRecords: AdminUserRecord[] = users.map((u, i) => ({
  ...u,
  ticketsCount: between(0, 14),
  eventsCount: u.roles.includes('organizer') ? between(1, 9) : 0,
  reportsCount: u.status === 'suspended' ? between(2, 6) : i % 13 === 0 ? 1 : 0,
  totalSpent: between(0, 80) * 50000,
  signupSource: pick(['web', 'android', 'ios', 'android']),
  suspendedReason: u.status === 'suspended' ? 'Repeated spam reports' : null,
  deletionRequest: i === 9 ? { requestedAt: iso(subDays(NOW, 2)), scheduledFor: iso(addDays(NOW, 28)), status: 'pending' } : null,
}))

export const adminEventRecords: AdminEventRecord[] = events.map((e) => ({
  ...toSummary(e),
  ticketsSold: e.stats.ticketsSold,
  revenue: e.stats.revenue,
  reportsCount: e.id === 'evt_g4' ? 3 : 0,
  submittedAt: e.status === 'pending_review' ? e.createdAt : null,
  reviewedBy: e.status === 'live' ? userSummary('usr_alex') : null,
  rejectionReason: null,
  source: pick(['web', 'android', 'ios']),
}))

export const adminOrganizers: AdminOrganizerRecord[] = [...new Set([...events.map((e) => e.organizer.id), ...vendors.map((v) => v.userId)])].map((uid) => {
  const u = findUser(uid) as User
  const v = vendors.find((x) => x.userId === uid)
  const evts = events.filter((e) => e.organizer.id === uid)
  const gross = evts.reduce((a, e) => a + e.stats.revenue, 0)
  return {
    id: `org_${uid}`,
    user: { ...userSummary(uid), email: u.email },
    businessName: v?.businessName ?? null,
    type: v && evts.length ? 'both' : v ? 'vendor' : 'organizer',
    vendorStatus: v?.status ?? null,
    identityStatus: u.identityStatus,
    eventsCount: evts.length,
    ticketsSold: evts.reduce((a, e) => a + e.stats.ticketsSold, 0),
    grossRevenue: gross,
    commissionPercent: uid === 'usr_piggyvest' ? 5 : null,
    pendingSettlement: Math.round(gross * 0.3),
    totalPaidOut: Math.round(gross * 0.6),
    rating: v?.rating ?? null,
    joinedAt: u.createdAt,
    verificationDocuments: u.identityStatus === 'pending' ? [{ id: 'doc_1', type: 'NIN slip', url: img('doc', 600, 400), status: 'pending' }] : [],
  }
})

export const adminBookings: AdminBookingRecord[] = Array.from({ length: 120 }, (_, i) => {
  const e = pick(events.filter((x) => x.stats.ticketsSold > 0))
  const buyer = pick(users)
  const qty = between(1, 4)
  const price = e.ticketTypes[0]?.price ?? 0
  const total = price * qty
  const status = pick(['paid', 'paid', 'paid', 'paid', 'refunded', 'failed', 'cancelled', 'pending', 'refund_processing'])
  return {
    id: `bk_${i}`,
    reference: `WP-ORD-${8000 + i}`,
    event: { id: e.id, title: e.title, slug: e.slug, coverUrl: e.coverUrl, startsAt: e.startsAt },
    buyer: { ...userSummary(buyer.id), email: buyer.email },
    ticketsCount: qty,
    total,
    serviceFee: Math.round(total * 0.03),
    currency: 'NGN' as const,
    status,
    paymentMethod: price === 0 ? 'free' : pick(['card', 'paystack', 'wallet', 'paypal', 'monnify']),
    provider: price === 0 ? 'none' : pick(['paystack', 'stripe', 'paypal', 'monnify', 'wallet']),
    providerReference: price === 0 ? null : `PRV_${between(100000, 999999)}`,
    checkedInCount: status === 'paid' ? between(0, qty) : 0,
    source: pick(['web', 'android', 'ios']),
    createdAt: iso(subHours(NOW, between(1, 24 * 60))),
    disputeId: i % 40 === 0 ? `dsp_${i / 40}` : null,
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const disputes: Dispute[] = adminBookings.filter((b) => b.disputeId).map((b, i) => ({
  id: b.disputeId as string,
  booking: { id: b.id, reference: b.reference, total: b.total, currency: b.currency },
  raisedBy: b.buyer,
  type: pick(['chargeback', 'not_received', 'duplicate', 'quality']),
  status: pick(['open', 'investigating', 'resolved_refund', 'resolved_rejected']),
  description: 'Customer claims the ticket QR code was never delivered by email.',
  assignedTo: i % 2 === 0 ? adminRef('adm_2') : null,
  createdAt: iso(subDays(NOW, i + 1)),
  updatedAt: iso(subHours(NOW, i * 3)),
}))

export const financeTransactions: FinanceTransaction[] = Array.from({ length: 200 }, (_, i) => {
  const b = adminBookings[i % adminBookings.length] as AdminBookingRecord
  const type = pick(['ticket_sale', 'ticket_sale', 'ticket_sale', 'refund', 'payout', 'top_up', 'withdrawal', 'subscription', 'commission'])
  const amount = type === 'ticket_sale' ? b.total : between(5, 400) * 10000
  const fee = Math.round(amount * 0.015)
  return {
    id: `ftx_${i}`,
    reference: `WP-TX-${50000 + i}`,
    providerReference: `PRV_${between(100000, 999999)}`,
    type,
    provider: pick(['paystack', 'paystack', 'stripe', 'paypal', 'monnify', 'wallet']),
    amount,
    fee,
    net: amount - fee,
    currency: 'NGN' as const,
    status: pick(['successful', 'successful', 'successful', 'successful', 'failed', 'pending', 'reversed']),
    reconciliationStatus: pick(['matched', 'matched', 'matched', 'unmatched', 'mismatch', 'pending']),
    user: b.buyer,
    event: type === 'ticket_sale' || type === 'refund' ? { id: b.event.id, title: b.event.title } : null,
    createdAt: iso(subHours(NOW, between(1, 24 * 45))),
    settledAt: null,
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const settlements: Settlement[] = events.filter((e) => e.stats.revenue > 0).slice(0, 30).map((e, i) => {
  const gross = e.stats.revenue
  const refunds = Math.round(gross * 0.02)
  const commission = Math.round(gross * 0.05)
  const fees = Math.round(gross * 0.015)
  const org = findUser(e.organizer.id) as User
  return {
    id: `stl_${i}`,
    reference: `WP-STL-${3000 + i}`,
    organizer: { ...userSummary(org.id), email: org.email, businessName: vendors.find((v) => v.userId === org.id)?.businessName ?? null },
    event: { id: e.id, title: e.title, startsAt: e.startsAt },
    grossSales: gross,
    refunds,
    platformCommission: commission,
    gatewayFees: fees,
    netPayable: gross - refunds - commission - fees,
    currency: 'NGN',
    status: e.status === 'completed' ? pick(['paid', 'ready', 'on_hold']) : 'pending',
    holdReason: null,
    eligibleAt: iso(addDays(new Date(e.endsAt ?? e.startsAt), 3)),
    paidAt: null,
    payoutId: null,
  }
})
for (const s of settlements) if (s.status === 'on_hold') s.holdReason = 'Open dispute on 2 bookings'

export const payouts: Payout[] = settlements.filter((s) => s.status === 'paid' || s.status === 'ready').map((s, i) => ({
  id: `po_${i}`,
  reference: `WP-PO-${7000 + i}`,
  settlementIds: [s.id],
  organizer: { ...s.organizer },
  bankAccount: { bankName: 'GTBank', accountNumber: '0123456789', accountName: s.organizer.displayName.toUpperCase() },
  amount: s.netPayable,
  currency: 'NGN',
  provider: pick(['monnify', 'paystack']),
  status: s.status === 'paid' ? 'paid' : pick(['requested', 'approved', 'processing']),
  requestedBy: adminRef('adm_3'),
  approvedBy: s.status === 'paid' ? adminRef(ADMIN_ME_ID) : null,
  failureReason: null,
  createdAt: iso(subDays(NOW, i + 1)),
  completedAt: s.status === 'paid' ? iso(subDays(NOW, i)) : null,
}))

export const refundRecords: RefundRecord[] = adminBookings.filter((b) => b.status === 'refunded' || b.status === 'refund_processing').map((b, i) => ({
  id: `rfd_${i}`,
  reference: `WP-RF-${9000 + i}`,
  booking: { id: b.id, reference: b.reference, event: b.event, buyer: b.buyer },
  amount: b.total,
  currency: 'NGN',
  reason: pick(['Event cancelled by organizer', 'Scheduling conflict', 'Booked the wrong event', 'Duplicate payment']),
  status: b.status === 'refunded' ? 'completed' : pick(['requested', 'processing', 'approved']),
  requestedAt: b.createdAt,
  decidedBy: b.status === 'refunded' ? adminRef('adm_3') : null,
  decidedAt: b.status === 'refunded' ? iso(subDays(NOW, 1)) : null,
  provider: b.provider,
}))

export const commissionRules: CommissionRule[] = [
  { id: 'cr_1', scope: 'platform', scopeId: null, scopeLabel: 'Platform default', percent: 5, fixedFee: 10000, currency: 'NGN', effectiveFrom: iso(subDays(NOW, 300)), updatedBy: adminRef(ADMIN_ME_ID), updatedAt: iso(subDays(NOW, 30)) },
  { id: 'cr_2', scope: 'category', scopeId: 'cat_weddings', scopeLabel: 'Weddings', percent: 4, fixedFee: 10000, currency: 'NGN', effectiveFrom: iso(subDays(NOW, 100)), updatedBy: adminRef('adm_3'), updatedAt: iso(subDays(NOW, 100)) },
  { id: 'cr_3', scope: 'organizer', scopeId: 'org_usr_piggyvest', scopeLabel: 'Piggyvest Nigeria', percent: 3, fixedFee: 0, currency: 'NGN', effectiveFrom: iso(subDays(NOW, 40)), updatedBy: adminRef('adm_3'), updatedAt: iso(subDays(NOW, 40)) },
]

export const contentReports: ContentReport[] = Array.from({ length: 26 }, (_, i) => {
  const targetType = pick(['message', 'user', 'event', 'vendor', 'work', 'community', 'status', 'review'])
  const reported = pick(users.slice(1))
  return {
    id: `rep_${i}`,
    targetType,
    targetId: `${targetType}_${i}`,
    targetPreview: { title: targetType === 'event' ? (pick(events) as Event).title : targetType === 'user' ? reported.displayName : `${targetType} by ${reported.displayName}`, excerpt: targetType === 'message' ? 'Click this link to claim your free tickets!!!' : null, imageUrl: ['work', 'status', 'event'].includes(targetType) ? img(`rep-${i}`, 300, 300) : null, link: null },
    reporter: userSummary((pick(users) as User).id),
    reportedUser: userSummary(reported.id),
    reason: pick(['spam', 'harassment', 'scam_or_fraud', 'nudity', 'false_information', 'impersonation']),
    details: i % 2 ? 'This account keeps sending phishing links to community members.' : null,
    status: pick(['open', 'open', 'reviewing', 'actioned', 'dismissed']),
    priority: pick(['low', 'medium', 'high']),
    assignedTo: i % 3 === 0 ? adminRef('adm_4') : null,
    resolution: null,
    createdAt: iso(subHours(NOW, between(1, 24 * 20))),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const adminCommunities: AdminCommunityRecord[] = communities.map((c, i) => ({
  id: c.id,
  name: c.name,
  avatarUrl: c.avatarUrl,
  event: c.event ? { id: c.event.id, title: c.event.title } : null,
  owner: userSummary(c.myRole === 'owner' ? ME_ID : 'usr_tessy'),
  membersCount: c.membersCount,
  messagesLast7d: between(20, 900),
  reportsOpen: i === 0 ? 2 : 0,
  status: c.isArchived ? 'archived' : 'active',
  createdAt: c.createdAt,
}))

export const templates: NotificationTemplate[] = [
  { id: 'tpl_1', key: 'ticket.purchased', name: 'Ticket purchased', channel: 'email', subject: 'Your ticket for {{event_title}}', body: 'Hi {{first_name}}, your ticket {{ticket_code}} for {{event_title}} is confirmed.', variables: ['first_name', 'event_title', 'ticket_code'], isActive: true, updatedAt: iso(subDays(NOW, 10)) },
  { id: 'tpl_2', key: 'event.reminder', name: 'Event reminder (24h)', channel: 'push', subject: null, body: '{{event_title}} starts tomorrow at {{start_time}}. See you there!', variables: ['event_title', 'start_time'], isActive: true, updatedAt: iso(subDays(NOW, 30)) },
  { id: 'tpl_3', key: 'otp.email', name: 'Email OTP', channel: 'email', subject: 'Your Wedpluz code', body: 'Your verification code is {{code}}. It expires in 10 minutes.', variables: ['code'], isActive: true, updatedAt: iso(subDays(NOW, 60)) },
  { id: 'tpl_4', key: 'otp.sms', name: 'SMS OTP', channel: 'sms', subject: null, body: 'Wedpluz code: {{code}}', variables: ['code'], isActive: true, updatedAt: iso(subDays(NOW, 60)) },
  { id: 'tpl_5', key: 'refund.completed', name: 'Refund completed', channel: 'whatsapp', subject: null, body: 'Hi {{first_name}}, your refund of {{amount}} has been processed.', variables: ['first_name', 'amount'], isActive: false, updatedAt: iso(subDays(NOW, 5)) },
]

export const campaigns: NotificationCampaign[] = [
  { id: 'cmp_1', name: 'December events roundup', channels: ['push', 'email'], audience: { type: 'all', filters: {}, estimatedSize: 48210 }, templateId: null, subject: 'Your December just got exciting', body: 'Discover the hottest events near you this December.', status: 'sent', scheduledAt: null, sentAt: iso(subDays(NOW, 4)), stats: { sent: 48210, delivered: 46400, opened: 18200, clicked: 6100, failed: 1810 }, createdBy: adminRef('adm_2'), createdAt: iso(subDays(NOW, 5)) },
  { id: 'cmp_2', name: 'Organizer payout policy update', channels: ['email', 'in_app'], audience: { type: 'organizers', filters: {}, estimatedSize: 1320 }, templateId: null, subject: 'Faster settlements from Dec 1', body: 'We are reducing settlement delays to 3 days.', status: 'scheduled', scheduledAt: iso(addDays(NOW, 2)), sentAt: null, stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 }, createdBy: adminRef(ADMIN_ME_ID), createdAt: iso(subDays(NOW, 1)) },
  { id: 'cmp_3', name: 'Bole Festival attendees reminder', channels: ['sms', 'whatsapp'], audience: { type: 'event_attendees', filters: { eventId: 'evt_bole' }, estimatedSize: 2210 }, templateId: 'tpl_2', subject: null, body: 'Bole Festival starts tomorrow!', status: 'draft', scheduledAt: null, sentAt: null, stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 }, createdBy: adminRef('adm_2'), createdAt: iso(subHours(NOW, 6)) },
]

export let settings: PlatformSettings = {
  general: { platformName: 'Wedpluz', supportEmail: 'support@wedpluz.com', supportPhone: '+234 800 000 0000', supportWhatsapp: '+234 800 000 0001', defaultCurrency: 'NGN', defaultCountry: 'NG', timezone: 'Africa/Lagos', maintenanceMode: false },
  payments: { enabledProviders: ['paystack', 'stripe', 'paypal', 'monnify', 'wallet'], defaultProvider: 'paystack', serviceFeePercent: 3, serviceFeeFixed: 10000, passFeesToBuyer: true, refundWindowHours: 48, settlementDelayDays: 3, minWithdrawal: 100000, maxWithdrawal: 500000000 },
  features: { communities: true, liveStreams: true, pluzPlanner: true, aiDesigns: true, eventPromotion: true, wallet: true, subEvents: true, seatSelection: true, vendorPromos: true, identityVerification: true },
  app: { minAndroidVersion: '2.3.0', minIosVersion: '2.3.0', forceUpdate: false, androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.wedpluz.app', iosStoreUrl: 'https://apps.apple.com/app/wedpluz' },
  legal: { termsUrl: 'https://wedpluz.com/terms', privacyUrl: 'https://wedpluz.com/privacy', termsUpdatedAt: iso(subDays(NOW, 90)), privacyUpdatedAt: iso(subDays(NOW, 90)) },
}
export const setSettings = (s: PlatformSettings) => {
  settings = s
}

export const banners: Banner[] = [
  { id: 'bn_1', title: 'Host Your Event', subtitle: 'Create and manage your own events.', imageUrl: null, ctaLabel: 'Create Event', ctaUrl: '/manage/events/new', placement: 'home_inline', audience: 'individuals', startsAt: null, endsAt: null, isActive: true, priority: 1, impressions: 120400, clicks: 8120 },
  { id: 'bn_2', title: 'Become a Vendor', subtitle: 'Whether you’re an event planner, photographer, decorator, chef, DJ, etc. Let the right people find you.', imageUrl: null, ctaLabel: 'Become a Vendor', ctaUrl: '/business/become-a-vendor', placement: 'home_inline', audience: 'all', startsAt: null, endsAt: null, isActive: true, priority: 2, impressions: 98000, clicks: 4210 },
  { id: 'bn_3', title: 'Detty December', subtitle: 'The biggest end-of-year events.', imageUrl: img('detty', 1200, 400), ctaLabel: 'Explore', ctaUrl: '/events?search=december', placement: 'events_top', audience: 'all', startsAt: iso(addDays(NOW, 10)), endsAt: iso(addDays(NOW, 50)), isActive: false, priority: 1, impressions: 0, clicks: 0 },
]

export const cmsPages: CmsPage[] = [
  { id: 'pg_about', slug: 'about', title: 'About Wedpluz', content: '<p>Wedpluz connects people with events, vendors and communities around life’s special moments.</p><p>Founded in Port Harcourt, we power ticketing, event management and vendor discovery across Nigeria.</p>', updatedAt: iso(subDays(NOW, 30)), updatedBy: 'Ngozi Okoye' },
  { id: 'pg_terms', slug: 'terms', title: 'Terms and conditions', content: '<h3>1. Acceptance</h3><p>By using Wedpluz you agree to these terms.</p><h3>2. Tickets</h3><p>Tickets are issued by organizers; refunds follow the organizer’s policy and Wedpluz refund rules.</p>', updatedAt: iso(subDays(NOW, 90)), updatedBy: 'Legal' },
  { id: 'pg_privacy', slug: 'privacy', title: 'Privacy policy', content: '<h3>Data we collect</h3><p>Account details, event activity and payment metadata. We never store full card numbers.</p>', updatedAt: iso(subDays(NOW, 90)), updatedBy: 'Legal' },
  { id: 'pg_faqs', slug: 'faqs', title: 'FAQs', content: '<h3>How do I get my ticket?</h3><p>Tickets appear under My Tickets and are emailed to you.</p><h3>Can I cancel a ticket?</h3><p>Yes, within the refund window set by the organizer.</p><h3>How do payouts work?</h3><p>Settlements are released 3 days after the event ends.</p>', updatedAt: iso(subDays(NOW, 20)), updatedBy: 'Support' },
  { id: 'pg_help', slug: 'help', title: 'Help center', content: '<p>Email support@wedpluz.com or chat with us on WhatsApp.</p>', updatedAt: iso(subDays(NOW, 20)), updatedBy: 'Support' },
  { id: 'pg_contact', slug: 'contact', title: 'Contact us', content: '<p>support@wedpluz.com · +234 800 000 0000</p>', updatedAt: iso(subDays(NOW, 20)), updatedBy: 'Support' },
]

export const supportTickets: SupportTicket[] = Array.from({ length: 34 }, (_, i) => {
  const u = pick(users)
  return {
    id: `sup_${i}`,
    reference: `WP-SUP-${1200 + i}`,
    user: { ...userSummary(u.id), email: u.email },
    subject: pick(['Payment deducted but no ticket', 'Cannot verify my identity', 'Wrong event booked', 'Vendor not responding', 'App crashes on checkout', 'Refund still processing']),
    category: pick(['payment', 'ticket', 'account', 'event', 'vendor', 'bug']),
    status: pick(['open', 'open', 'pending', 'resolved', 'closed']),
    priority: pick(['low', 'medium', 'high', 'urgent']),
    assignedTo: i % 2 ? adminRef('adm_5') : null,
    source: pick(['web', 'android', 'ios', 'email']),
    messagesCount: between(1, 8),
    createdAt: iso(subHours(NOW, between(1, 24 * 15))),
    updatedAt: iso(subHours(NOW, between(0, 24))),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const auditLogs: AuditLogEntry[] = Array.from({ length: 80 }, (_, i) => {
  const actor = pick(adminUsers)
  const [action, module, targetType] = pick([
    ['event.approved', 'events', 'event'], ['event.rejected', 'events', 'event'], ['user.suspended', 'users', 'user'], ['user.reactivated', 'users', 'user'],
    ['refund.approved', 'finance', 'refund'], ['payout.approved', 'finance', 'payout'], ['settlement.held', 'finance', 'settlement'], ['commission.updated', 'finance', 'commission_rule'],
    ['report.actioned', 'moderation', 'report'], ['role.updated', 'access', 'role'], ['settings.updated', 'settings', 'settings'], ['campaign.sent', 'notifications', 'campaign'],
  ]) as [string, string, string]
  return {
    id: `aud_${i}`,
    actor: { id: actor.id, firstName: actor.firstName, lastName: actor.lastName, email: actor.email, avatarUrl: actor.avatarUrl },
    action,
    module,
    targetType,
    targetId: `${targetType}_${between(1, 99)}`,
    targetLabel: targetType === 'event' ? (pick(events) as Event).title : targetType === 'user' ? (pick(users) as User).displayName : `${targetType} #${between(1, 99)}`,
    before: action === 'commission.updated' ? { percent: 5 } : null,
    after: action === 'commission.updated' ? { percent: 4 } : null,
    ip: `105.112.${between(1, 254)}.${between(1, 254)}`,
    userAgent: 'Mozilla/5.0 Chrome/131',
    correlationId: `corr_${between(100000, 999999)}`,
    createdAt: iso(subMinutes(NOW, between(5, 60 * 24 * 30))),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const securityLogs: SecurityLogEntry[] = Array.from({ length: 60 }, (_, i) => {
  const actor = pick(adminUsers)
  return {
    id: `sec_${i}`,
    actor: { id: actor.id, email: actor.email },
    event: pick(['login_success', 'login_success', 'login_success', 'login_failed', 'logout', 'password_changed', '2fa_enabled', 'permission_denied', 'session_revoked']),
    ip: `197.210.${between(1, 254)}.${between(1, 254)}`,
    location: pick(['Lagos, NG', 'Port Harcourt, NG', 'Abuja, NG', 'London, UK']),
    userAgent: pick(['Chrome 131 / Windows', 'Safari 18 / macOS', 'Firefox 132 / Ubuntu']),
    createdAt: iso(subMinutes(NOW, between(5, 60 * 24 * 14))),
  }
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/* ------------------------------------------------------------------ */
/* Collaborations for me                                               */
/* ------------------------------------------------------------------ */

export const myCollaborations = [
  { id: 'col_1', event: { id: 'evt_movie', title: 'Movie in the park - Denim Edition', coverUrl: img('movie-park-denim', 400, 300), startsAt: (findEvent('evt_movie') as Event).startsAt, organizer: userSummary('usr_alex') }, status: 'pending' as const, invitedAt: iso(subMinutes(NOW, 45)) },
  { id: 'col_2', event: { id: 'evt_bole', title: 'Bole Festival', coverUrl: img('bole-festival', 400, 300), startsAt: (findEvent('evt_bole') as Event).startsAt, organizer: userSummary('usr_tessy') }, status: 'accepted' as const, invitedAt: iso(subDays(NOW, 6)) },
]

export { NOW, iso, between, pick, rand }
