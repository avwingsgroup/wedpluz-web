import { created, data, fail, noContent, paginate, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch } from './shared'
import type { LiveRequest, LiveSession } from '@/types'

const liveSessions: LiveSession[] = []
const liveRequests: Record<string, LiveRequest[]> = {}

export function registerCommunityHandlers() {
  route('GET', '/communities', (req) => {
    requireUser(req)
    const archived = req.query.get('archived') === 'true'
    return data(db.communities.filter((c) => c.isArchived === archived && textMatch([c.name], req.query.get('search'))))
  })

  route('POST', '/communities', (req) => {
    requireUser(req)
    const b = body<{ name: string; description?: string | null; eventId?: string | null; avatarUploadId?: string | null }>(req)
    requireFields(b, ['name'])
    const e = b.eventId ? db.findEvent(b.eventId) : null
    const c = { id: db.nextId('com'), eventId: e?.id ?? null, event: e ? { id: e.id, slug: e.slug, title: e.title, coverUrl: e.coverUrl, startsAt: e.startsAt, isPromoted: e.isPromoted } : null, name: b.name, description: b.description ?? null, avatarUrl: b.avatarUploadId ? db.img(b.avatarUploadId, 200, 200) : null, membersCount: 1, onlineCount: 1, myRole: 'owner' as const, permissions: { membersCanSendMessages: true, membersCanPostStatus: true, membersCanInvite: false, membersCanGoLive: false, requireApprovalToJoin: false }, inviteLink: `https://wedpluz.com/c/join/${db.between(1000, 9999)}`, isArchived: false, isMuted: false, isPinned: false, createdAt: new Date().toISOString() }
    db.communities.unshift(c)
    db.conversations.unshift({ id: `cv_${c.id}`, type: 'community', title: c.name, avatarUrl: c.avatarUrl, participants: [], communityId: c.id, lastMessage: null, unreadCount: 0, isPinned: false, isMuted: false, isArchived: false, isRequest: false, updatedAt: new Date().toISOString() })
    return created(c, 'Community created')
  })

  route('GET', '/communities/:id', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    return data(c)
  })

  route('PUT', '/communities/:id', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    if (c.myRole === 'member') fail(403, 'FORBIDDEN', 'Only admins can edit community info.')
    const b = body<{ name?: string; description?: string | null; avatarUploadId?: string; permissions?: Partial<typeof c.permissions> }>(req)
    if (b.name) c.name = b.name
    if (b.description !== undefined) c.description = b.description
    if (b.avatarUploadId) c.avatarUrl = db.img(b.avatarUploadId, 200, 200)
    if (b.permissions) Object.assign(c.permissions, b.permissions)
    return data(c, 'Community updated')
  })

  route('PATCH', '/communities/:id', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    const b = body<{ isMuted?: boolean; isPinned?: boolean; isArchived?: boolean }>(req)
    Object.assign(c, b)
    return data(c)
  })

  route('POST', '/communities/:id/join', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    c.myRole = 'member'
    c.membersCount += 1
    return data(c, `Welcome to ${c.name}`)
  })
  route('POST', '/communities/join/:code', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.inviteLink.endsWith(`/${req.params.code}`))
    if (!c) fail(404, 'NOT_FOUND', 'This invite link is invalid or has expired.')
    if (c.myRole === 'none') {
      c.myRole = 'member'
      c.membersCount += 1
    }
    return data(c)
  })
  route('POST', '/communities/:id/leave', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    if (c.myRole === 'owner') fail(409, 'CONFLICT', 'Transfer ownership before leaving.')
    c.myRole = 'none'
    c.membersCount = Math.max(0, c.membersCount - 1)
    return noContent()
  })
  route('POST', '/communities/:id/invite-link', (req) => {
    requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    c.inviteLink = `https://wedpluz.com/c/join/${db.between(10000, 99999)}`
    return data({ inviteLink: c.inviteLink }, 'New invite link generated')
  })

  route('GET', '/communities/:id/members', (req) => {
    requireUser(req)
    const list = (db.communityMembers[req.params.id ?? ''] ?? []).filter((m) => textMatch([m.user.displayName], req.query.get('search')))
    return paginate(list, req.query, 30)
  })
  route('POST', '/communities/:id/members', (req) => {
    requireUser(req)
    const b = body<{ userIds?: string[]; emails?: string[] }>(req)
    const list = (db.communityMembers[req.params.id ?? ''] ??= [])
    for (const uid of b.userIds ?? []) if (!list.some((m) => m.user.id === uid)) list.push({ id: db.nextId('cm'), user: db.userSummary(uid), role: 'member', joinedAt: new Date().toISOString(), isVendor: Boolean(db.findUser(uid)?.isVendor), isOnline: false })
    const c = db.communities.find((x) => x.id === req.params.id)
    if (c) c.membersCount = list.length
    return data({ invited: (b.userIds?.length ?? 0) + (b.emails?.length ?? 0) }, 'Invites sent')
  })
  route('PATCH', '/communities/:id/members/:userId', (req) => {
    requireUser(req)
    const m = (db.communityMembers[req.params.id ?? ''] ?? []).find((x) => x.user.id === req.params.userId)
    if (!m) fail(404, 'NOT_FOUND', 'Member not found')
    const b = body<{ role: 'co_admin' | 'member' }>(req)
    m.role = b.role
    return data(m, b.role === 'co_admin' ? `${m.user.displayName} is now a co-admin` : 'Role updated')
  })
  route('DELETE', '/communities/:id/members/:userId', (req) => {
    requireUser(req)
    const list = db.communityMembers[req.params.id ?? ''] ?? []
    const idx = list.findIndex((x) => x.user.id === req.params.userId)
    if (idx >= 0) list.splice(idx, 1)
    return noContent()
  })

  route('GET', '/communities/:id/statuses', (req) => {
    requireUser(req)
    return data(db.statusPosts.filter((s) => s.communityId === req.params.id || req.params.id === 'cv_com_tessy'))
  })
  route('POST', '/communities/:id/statuses', (req) => {
    const user = requireUser(req)
    const b = body<{ mediaUploadId: string; caption?: string; mediaType?: 'image' | 'video' }>(req)
    requireFields(b, ['mediaUploadId'])
    const s = { id: db.nextId('st'), communityId: req.params.id ?? '', author: db.userSummary(user.id), mediaUrl: db.img(b.mediaUploadId, 540, 960), mediaType: b.mediaType ?? ('image' as const), caption: b.caption ?? null, likesCount: 0, viewsCount: 0, isLiked: false, viewedByMe: true, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString() }
    db.statusPosts.unshift(s)
    return created(s, 'Status posted')
  })
  route('POST', '/statuses/:id/like', (req) => {
    requireUser(req)
    const s = db.statusPosts.find((x) => x.id === req.params.id)
    if (!s) fail(404, 'NOT_FOUND', 'Status not found')
    s.isLiked = !s.isLiked
    s.likesCount += s.isLiked ? 1 : -1
    return data({ liked: s.isLiked, likesCount: s.likesCount })
  })
  route('POST', '/statuses/:id/view', (req) => {
    requireUser(req)
    const s = db.statusPosts.find((x) => x.id === req.params.id)
    if (s && !s.viewedByMe) {
      s.viewedByMe = true
      s.viewsCount += 1
    }
    return noContent()
  })
  route('DELETE', '/statuses/:id', (req) => {
    requireUser(req)
    const idx = db.statusPosts.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) db.statusPosts.splice(idx, 1)
    return noContent()
  })

  route('GET', '/communities/:id/media', (req) => {
    requireUser(req)
    const type = req.query.get('type') ?? 'media'
    const items = Array.from({ length: type === 'docs' ? 3 : 22 }, (_, i) => ({ id: `cmedia_${i}`, type: type === 'docs' ? ('pdf' as const) : i % 5 === 0 ? ('video' as const) : ('image' as const), url: type === 'docs' ? '#' : db.img(`cm-${req.params.id}-${i}`, 800, 800), thumbnailUrl: db.img(`cm-${req.params.id}-${i}`, 300, 300), name: type === 'docs' ? `Vendor contract ${i + 1}.pdf` : null, sizeBytes: 240000, sender: db.userSummary(db.users[(i % 6) + 1]!.id), createdAt: new Date(Date.now() - i * 3600000).toISOString() }))
    return paginate(items, req.query, 30)
  })

  /* ---- live ---- */
  route('GET', '/communities/:id/live', (req) => {
    requireUser(req)
    return data(liveSessions.find((l) => l.communityId === req.params.id && l.status === 'live') ?? null)
  })
  route('POST', '/communities/:id/live', (req) => {
    const user = requireUser(req)
    const c = db.communities.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Community not found')
    if (c.myRole === 'member' && !c.permissions.membersCanGoLive) fail(403, 'FORBIDDEN', 'Only admins can go live in this community.')
    const b = body<{ title?: string; audioEnabled?: boolean; videoEnabled?: boolean }>(req)
    const s: LiveSession = { id: db.nextId('live'), communityId: c.id, host: db.userSummary(user.id), title: b.title ?? null, status: 'live', viewersCount: 0, startedAt: new Date().toISOString(), endedAt: null, joinToken: `mock-live-${db.between(1000, 9999)}`, audioEnabled: b.audioEnabled ?? true, videoEnabled: b.videoEnabled ?? true }
    liveSessions.unshift(s)
    return created(s)
  })
  route('PATCH', '/live/:id', (req) => {
    requireUser(req)
    const s = liveSessions.find((x) => x.id === req.params.id)
    if (!s) fail(404, 'NOT_FOUND', 'Live session not found')
    Object.assign(s, body(req))
    return data(s)
  })
  route('POST', '/live/:id/end', (req) => {
    requireUser(req)
    const s = liveSessions.find((x) => x.id === req.params.id)
    if (s) {
      s.status = 'ended'
      s.endedAt = new Date().toISOString()
    }
    return data(s ?? null)
  })
  route('POST', '/live/:id/join', (req) => {
    requireUser(req)
    const s = liveSessions.find((x) => x.id === req.params.id)
    if (!s || s.status !== 'live') fail(410, 'CONFLICT', 'This live session has ended.')
    s.viewersCount += 1
    return data({ joinToken: `mock-viewer-${db.between(1000, 9999)}`, session: s })
  })
  route('GET', '/live/:id/requests', (req) => {
    requireUser(req)
    const list = (liveRequests[req.params.id ?? ''] ??= ['usr_alice', 'usr_michael', 'usr_emily'].map((uid, i) => ({ id: `lr_${i}`, user: db.userSummary(uid), status: 'pending' as const, createdAt: new Date().toISOString() })))
    return data(list)
  })
  route('POST', '/live/:id/requests', (req) => {
    const user = requireUser(req)
    const list = (liveRequests[req.params.id ?? ''] ??= [])
    const r: LiveRequest = { id: db.nextId('lr'), user: db.userSummary(user.id), status: 'pending', createdAt: new Date().toISOString() }
    list.push(r)
    return created(r, 'Request sent to the host')
  })
  route('PATCH', '/live/:id/requests/:requestId', (req) => {
    requireUser(req)
    const r = (liveRequests[req.params.id ?? ''] ?? []).find((x) => x.id === req.params.requestId)
    if (!r) fail(404, 'NOT_FOUND', 'Request not found')
    r.status = body<{ status: 'accepted' | 'declined' }>(req).status
    return data(r)
  })
}
