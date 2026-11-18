import { addDays } from 'date-fns'
import { created, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser } from './shared'
import type { IdentityVerification, Upload } from '@/types'

let identity: IdentityVerification | null = null
let deletionRequest: { id: string; reason: string; status: 'pending'; requestedAt: string; scheduledFor: string } | null = null

export function registerAccountHandlers() {
  route('PATCH', '/me', (req) => {
    const user = requireUser(req)
    const b = body<Partial<typeof user>>(req)
    const allowed = ['firstName', 'lastName', 'phone', 'dateOfBirth', 'city', 'countryCode', 'avatarUrl', 'username', 'locale'] as const
    for (const key of allowed) {
      if (key in b) (user as unknown as Record<string, unknown>)[key] = b[key]
    }
    user.displayName = `${user.firstName} ${user.lastName}`
    return data(user, 'Profile updated')
  })

  route('POST', '/me/profile-setup', (req) => {
    const user = requireUser(req)
    const b = body<{ username: string; phone?: string; city?: string; avatarUploadId?: string }>(req)
    requireFields(b, ['username'])
    if (db.users.some((u) => u.id !== user.id && u.username === b.username.toLowerCase())) {
      fail(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { username: ['This username is taken.'] })
    }
    user.username = b.username.toLowerCase()
    if (b.phone) user.phone = b.phone
    if (b.city) user.city = b.city
    if (b.avatarUploadId) user.avatarUrl = db.img(b.avatarUploadId, 300, 300)
    return data(user)
  })

  route('PUT', '/me/interests', (req) => {
    const user = requireUser(req)
    const b = body<{ interests: string[] }>(req)
    if (!Array.isArray(b.interests) || b.interests.length > 5) {
      fail(422, 'VALIDATION_ERROR', 'Pick up to 5 interests.', { interests: ['Pick up to 5 interests.'] })
    }
    user.interests = b.interests
    return data(user)
  })

  route('GET', '/interests', () => data(db.interestOptions))

  route('PUT', '/me/password', (req) => {
    requireUser(req)
    const b = body<{ currentPassword: string; password: string; passwordConfirmation: string }>(req)
    requireFields(b, ['currentPassword', 'password', 'passwordConfirmation'])
    if (b.currentPassword === 'wrongpass') fail(422, 'VALIDATION_ERROR', 'Current password is incorrect.', { currentPassword: ['Current password is incorrect.'] })
    if (b.password !== b.passwordConfirmation) fail(422, 'VALIDATION_ERROR', 'Passwords do not match.', { passwordConfirmation: ['Passwords do not match.'] })
    return data({ updated: true }, 'Password updated')
  })

  route('GET', '/me/privacy', (req) => {
    requireUser(req)
    return data(db.privacy)
  })
  route('PUT', '/me/privacy', (req) => {
    requireUser(req)
    Object.assign(db.privacy, body(req))
    return data(db.privacy, 'Privacy settings saved')
  })

  route('GET', '/me/notification-preferences', (req) => {
    requireUser(req)
    return data(db.notificationPrefs)
  })
  route('PUT', '/me/notification-preferences', (req) => {
    requireUser(req)
    const b = body<Partial<typeof db.notificationPrefs>>(req)
    if (b.channels) Object.assign(db.notificationPrefs.channels, b.channels)
    if (b.topics) Object.assign(db.notificationPrefs.topics, b.topics)
    return data(db.notificationPrefs, 'Notification preferences saved')
  })

  route('GET', '/me/sessions', (req) => {
    requireUser(req)
    return data(db.sessions)
  })
  route('DELETE', '/me/sessions/:id', (req) => {
    requireUser(req)
    const idx = db.sessions.findIndex((s) => s.id === req.params.id)
    if (idx >= 0 && !db.sessions[idx]?.isCurrent) db.sessions.splice(idx, 1)
    return noContent()
  })
  route('DELETE', '/me/sessions', (req) => {
    requireUser(req)
    for (let i = db.sessions.length - 1; i >= 0; i--) if (!db.sessions[i]?.isCurrent) db.sessions.splice(i, 1)
    return noContent()
  })

  route('GET', '/me/identity-verification', (req) => {
    const user = requireUser(req)
    if (!identity && user.identityStatus !== 'unverified') {
      identity = { id: 'idv_seed', status: user.identityStatus, idType: 'nin', submittedAt: new Date().toISOString(), reviewedAt: null, failureReason: user.identityStatus === 'failed' ? 'Selfie did not match ID photo' : null, provider: 'primely' }
    }
    return data(identity)
  })
  route('POST', '/me/identity-verification', (req) => {
    const user = requireUser(req)
    const b = body<{ idType: string; idNumber: string; selfieUploadId: string }>(req)
    requireFields(b, ['idType', 'idNumber', 'selfieUploadId'])
    if (b.idNumber.replace(/\D/g, '').length < 8) fail(422, 'VALIDATION_ERROR', 'ID number looks invalid.', { idNumber: ['Enter a valid ID number.'] })
    const failed = b.idNumber.endsWith('0000')
    identity = { id: db.nextId('idv'), status: failed ? 'failed' : 'verified', idType: b.idType as IdentityVerification['idType'], submittedAt: new Date().toISOString(), reviewedAt: new Date().toISOString(), failureReason: failed ? 'We could not match your selfie to the ID provided.' : null, provider: 'primely' }
    user.identityStatus = identity.status
    user.isVerified = identity.status === 'verified'
    return created(identity)
  })

  route('GET', '/me/deletion-request', (req) => {
    requireUser(req)
    return data(deletionRequest)
  })
  route('POST', '/me/deletion-request', (req) => {
    const user = requireUser(req)
    const b = body<{ reason: string; password: string }>(req)
    requireFields(b, ['reason', 'password'])
    deletionRequest = { id: db.nextId('del'), reason: b.reason, status: 'pending', requestedAt: new Date().toISOString(), scheduledFor: addDays(new Date(), 30).toISOString() }
    user.status = 'pending_deletion'
    return created(deletionRequest, 'Your account is scheduled for deletion in 30 days.')
  })
  route('DELETE', '/me/deletion-request', (req) => {
    const user = requireUser(req)
    deletionRequest = null
    user.status = 'active'
    return noContent()
  })

  route('POST', '/uploads', (req) => {
    requireUser(req)
    const id = db.nextId('upl')
    const upload: Upload = { id, url: db.img(id, 1200, 800), thumbnailUrl: db.img(id, 300, 300), mimeType: 'image/jpeg', sizeBytes: 204800, width: 1200, height: 800, provider: 'cloudinary' }
    return created(upload)
  })
  route('POST', '/uploads/sign', (req) => {
    requireUser(req)
    return data({ provider: 'cloudinary', uploadUrl: 'https://api.cloudinary.com/v1_1/wedpluz/auto/upload', fields: { api_key: 'public', timestamp: String(Date.now()), signature: 'mock' }, publicUrlTemplate: 'https://res.cloudinary.com/wedpluz/{public_id}', expiresAt: addDays(new Date(), 1).toISOString() })
  })

  route('GET', '/users/:id', (req) => {
    const u = db.findUser(req.params.id ?? '')
    if (!u) fail(404, 'NOT_FOUND', 'User not found')
    return data({ ...db.userSummary(u.id), city: u.city, interests: u.interests, joinedAt: u.createdAt, eventsCount: db.events.filter((e) => e.organizer.id === u.id).length })
  })

  route('GET', '/pages/:slug', (req) => {
    const page = db.cmsPages.find((p) => p.slug === req.params.slug)
    if (!page) fail(404, 'NOT_FOUND', 'Page not found')
    return data(page)
  })

  route('POST', '/support/tickets', (req) => {
    const user = requireUser(req)
    const b = body<{ subject: string; category: string; message: string }>(req)
    requireFields(b, ['subject', 'category', 'message'])
    const ticket = { id: db.nextId('sup'), reference: `WP-SUP-${db.between(2000, 9999)}`, user: { ...db.userSummary(user.id), email: user.email }, subject: b.subject, category: b.category as 'other', status: 'open' as const, priority: 'medium' as const, assignedTo: null, source: 'web' as const, messagesCount: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    db.supportTickets.unshift(ticket)
    return created(ticket, 'We’ve received your request. Our team will reply by email.')
  })
  route('GET', '/support/tickets', (req) => {
    const user = requireUser(req)
    return data(db.supportTickets.filter((t) => t.user.id === user.id))
  })

  route('POST', '/reports', (req) => {
    requireUser(req)
    const b = body<{ targetType: string; targetId: string; reason: string }>(req)
    requireFields(b, ['targetType', 'targetId', 'reason'])
    return created({ id: db.nextId('rep'), status: 'open' }, 'Thanks for letting us know. Our team will review this report.')
  })

  route('GET', '/config', () => data({ features: db.settings.features, payments: { enabledProviders: db.settings.payments.enabledProviders, serviceFeePercent: db.settings.payments.serviceFeePercent }, support: { email: db.settings.general.supportEmail, phone: db.settings.general.supportPhone, whatsapp: db.settings.general.supportWhatsapp }, app: db.settings.app }))
}
