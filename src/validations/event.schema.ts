import { z } from 'zod'
import { emailSchema, nameSchema, phoneSchema, urlSchema } from './common'

export const venueSchema = z.object({
  name: z.string().trim().min(2, 'Enter the venue name'),
  address: z.string().trim().min(5, 'Enter the venue address'),
  city: z.string().trim().min(1, 'Select a city'),
  state: z.string().trim().min(1, 'Select a state'),
  countryCode: z.string().default('NG'),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
})

export const onlineSchema = z.object({
  platform: z.enum(['google_meet', 'zoom', 'microsoft_teams', 'youtube', 'instagram_live', 'other']),
  link: urlSchema,
})

export const scheduleSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().nullable().default(null),
    date: z.string().min(1, 'Pick a date'),
    endDate: z.string().optional().or(z.literal('')),
    startTime: z.string().min(1, 'Pick a start time'),
    endTime: z.string().optional().or(z.literal('')),
    attendanceMode: z.enum(['physical', 'online', 'hybrid']),
    venue: venueSchema.nullable(),
    online: onlineSchema.nullable(),
  })
  .superRefine((v, ctx) => {
    if ((v.attendanceMode === 'physical' || v.attendanceMode === 'hybrid') && !v.venue) ctx.addIssue({ code: 'custom', path: ['venue'], message: 'Add the venue details' })
    if ((v.attendanceMode === 'online' || v.attendanceMode === 'hybrid') && !v.online) ctx.addIssue({ code: 'custom', path: ['online'], message: 'Add the online platform' })
    if (v.endTime && v.startTime && !v.endDate && v.endTime <= v.startTime) ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' })
  })

export const basicDetailsSchema = z.object({
  title: z.string().trim().min(3, 'Give your event a title').max(120, 'Keep it under 120 characters'),
  description: z.string().trim().min(20, 'Describe your event in at least 20 characters').max(5000),
  coverUrl: z.string().min(1, 'Add a cover image'),
  categoryId: z.string().min(1, 'Choose a category'),
  visibility: z.enum(['public', 'private']),
  approvalRequired: z.boolean(),
  limitGuests: z.boolean(),
  guestLimit: z.number().int().positive('Enter a number greater than zero').nullable(),
  allowGuestInvites: z.boolean(),
  maxAdditionalGuests: z.number().int().min(0).max(20),
  isAdultOnly: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.limitGuests && !v.guestLimit) ctx.addIssue({ code: 'custom', path: ['guestLimit'], message: 'Enter the maximum number of guests' })
  if (v.allowGuestInvites && v.maxAdditionalGuests < 1) ctx.addIssue({ code: 'custom', path: ['maxAdditionalGuests'], message: 'Allow at least 1 additional guest' })
})

export const ticketTypeSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, 'Name this ticket'),
    description: z.string().trim().max(300).nullable().default(null),
    price: z.number().int().min(0, 'Price cannot be negative'),
    quantity: z.number().int().positive('Enter available slots'),
    salesEndAt: z.string().min(1, 'Set a sales end date'),
    perOrderLimit: z.number().int().min(1).max(20).default(5),
    scheduleId: z.string().nullable().default(null),
    seatSelection: z.boolean().default(false),
    menuSelection: z.boolean().default(false),
    isEarlyBird: z.boolean().default(false),
  })

export const subEventSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Name the sub-event'),
  description: z.string().trim().max(1000).default(''),
  coverUrl: z.string().nullable().default(null),
  scheduleId: z.string().nullable().default(null),
  date: z.string().min(1, 'Pick a date'),
  startTime: z.string().min(1, 'Pick a start time'),
  endTime: z.string().optional().or(z.literal('')),
  requiresApproval: z.boolean().default(false),
  isIncludedInBundle: z.boolean().default(true),
})

export const organizerInfoSchema = z.object({
  displayName: nameSchema,
  bio: z.string().trim().max(500).default(''),
  contactEmail: emailSchema,
  contactPhone: phoneSchema.optional().or(z.literal('')),
})

export const requestToAttendSchema = z.object({ firstName: nameSchema, lastName: nameSchema })

export const attendeeSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
})

export const additionalGuestSchema = z.object({ firstName: nameSchema, lastName: nameSchema, email: emailSchema.optional().or(z.literal('')) })

export const promotionSchema = z.object({
  enabled: z.boolean(),
  commissionPercent: z.number().min(1, 'At least 1%').max(50, 'At most 50%'),
  targetSignups: z.number().int().positive().nullable(),
  promoterLimit: z.number().int().positive().nullable(),
})

export const taskSchema = z.object({
  title: z.string().trim().min(2, 'Give the task a title'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  dueAt: z.string().optional().or(z.literal('')),
  assigneeIds: z.array(z.string()).default([]),
})

export const cancelEventSchema = z.object({ reason: z.string().trim().min(10, 'Tell your guests why (at least 10 characters)'), confirmTitle: z.string() })

export const vendorProfileSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name').max(80),
  location: z.string().trim().min(2, 'Enter your primary location'),
  categoryId: z.string().min(1, 'Choose a category'),
  description: z.string().trim().min(20, 'Tell people about your business (at least 20 characters)').max(2000),
})

export const workSchema = z.object({
  title: z.string().trim().min(2, 'Give this work a title').max(120),
  description: z.string().trim().max(1000).default(''),
  mediaUploadIds: z.array(z.string()).min(1, 'Add at least one photo or video').max(10, 'Up to 10 files'),
})

export const reviewSchema = z.object({ rating: z.number().int().min(1, 'Choose a rating').max(5), comment: z.string().trim().min(5, 'Write at least 5 characters').max(1000) })

export const communitySchema = z.object({
  name: z.string().trim().min(2, 'Name your community').max(80),
  description: z.string().trim().max(500).nullable().default(null),
})

export const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'nudity', 'violence', 'scam_or_fraud', 'impersonation', 'false_information', 'intellectual_property', 'other']),
  details: z.string().trim().max(1000).optional().or(z.literal('')),
  blockUser: z.boolean().default(false),
})
