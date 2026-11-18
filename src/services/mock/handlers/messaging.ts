import { created, cursorPage, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser, textMatch } from './shared'
import type { Message } from '@/types'

export function registerMessagingHandlers() {
  route('GET', '/conversations', (req) => {
    requireUser(req)
    const tab = req.query.get('tab') ?? 'all'
    let list = db.conversations.filter((c) => !c.isArchived)
    if (tab === 'unread') list = list.filter((c) => c.unreadCount > 0 && !c.isRequest)
    else if (tab === 'communities') list = list.filter((c) => c.type === 'community')
    else if (tab === 'requests') list = list.filter((c) => c.isRequest)
    else list = list.filter((c) => !c.isRequest)
    list = list.filter((c) => textMatch([c.title, c.lastMessage?.body ?? null], req.query.get('search')))
    list = [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt.localeCompare(a.updatedAt))
    return data({ items: list, requestsCount: db.conversations.filter((c) => c.isRequest && c.unreadCount > 0).length })
  })

  route('POST', '/conversations', (req) => {
    const user = requireUser(req)
    const b = body<{ userId: string }>(req)
    requireFields(b, ['userId'])
    if (b.userId === user.id) fail(422, 'VALIDATION_ERROR', 'You cannot message yourself.')
    const other = db.findUser(b.userId)
    if (!other) fail(404, 'NOT_FOUND', 'User not found')
    let c = db.conversations.find((x) => x.type === 'direct' && x.participants.some((p) => p.id === other.id))
    if (!c) {
      c = { id: db.nextId('cv'), type: 'direct', title: other.displayName, avatarUrl: other.avatarUrl, participants: [db.userSummary(other.id)], communityId: null, lastMessage: null, unreadCount: 0, isPinned: false, isMuted: false, isArchived: false, isRequest: false, updatedAt: new Date().toISOString() }
      db.conversations.unshift(c)
    }
    return created(c)
  })

  route('GET', '/conversations/:id', (req) => {
    requireUser(req)
    const c = db.conversations.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Conversation not found')
    const community = c.communityId ? db.communities.find((x) => x.id === c.communityId) ?? null : null
    return data({ ...c, community, pinnedMessages: db.messages.filter((m) => m.conversationId === c.id && m.isPinned && m.deletedBy === 'none') })
  })

  route('GET', '/conversations/:id/messages', (req) => {
    requireUser(req)
    const list = db.messages.filter((m) => m.conversationId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const page = cursorPage(list, req.query, 30)
    const bodyData = page.body as { data: Message[] }
    bodyData.data = [...bodyData.data].reverse()
    return page
  })

  route('POST', '/conversations/:id/messages', (req) => {
    const user = requireUser(req)
    const c = db.conversations.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Conversation not found')
    const community = c.communityId ? db.communities.find((x) => x.id === c.communityId) : null
    if (community && community.myRole === 'member' && !community.permissions.membersCanSendMessages) fail(403, 'FORBIDDEN', 'Only admins can send messages in this community.')
    const b = body<{ clientId: string; type: Message['type']; body?: string; attachmentUploadIds?: string[]; replyToId?: string | null; eventId?: string | null }>(req)
    if (!b.body && !b.attachmentUploadIds?.length && !b.eventId) fail(422, 'VALIDATION_ERROR', 'Message cannot be empty.')
    const replyTo = b.replyToId ? db.messages.find((m) => m.id === b.replyToId) : null
    const event = b.eventId ? db.findEvent(b.eventId) : null
    const m: Message = {
      id: db.nextId('m'),
      conversationId: c.id,
      sender: db.userSummary(user.id),
      type: b.type ?? 'text',
      body: b.body ?? null,
      attachments: (b.attachmentUploadIds ?? []).map((id, i) => ({ id: `${id}_${i}`, type: b.type === 'audio' ? 'audio' : 'image', url: b.type === 'audio' ? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' : db.img(id, 600, 600), thumbnailUrl: b.type === 'audio' ? null : db.img(id, 300, 300), name: null, sizeBytes: null, durationSeconds: b.type === 'audio' ? 12 : null, waveform: b.type === 'audio' ? Array.from({ length: 40 }, () => db.between(10, 100)) : undefined })),
      replyTo: replyTo ? { id: replyTo.id, sender: replyTo.sender, body: replyTo.body, type: replyTo.type } : null,
      reactions: [],
      event: event ? { id: event.id, slug: event.slug, title: event.title, coverUrl: event.coverUrl, startsAt: event.startsAt, minPrice: event.minPrice, isFree: event.isFree, currency: event.currency } : null,
      isPinned: false,
      isStarred: false,
      isMine: true,
      deletedBy: 'none',
      status: 'sent',
      createdAt: new Date().toISOString(),
      clientId: b.clientId,
    }
    db.messages.push(m)
    c.lastMessage = { id: m.id, body: m.body ?? (m.type === 'audio' ? 'Audio message' : m.type === 'image' ? 'Photo' : m.type === 'event_promo' ? 'Shared an event' : ''), type: m.type, sender: m.sender, createdAt: m.createdAt }
    c.updatedAt = m.createdAt
    if (c.isRequest) c.isRequest = false
    return created(m)
  })

  route('DELETE', '/messages/:id', (req) => {
    requireUser(req)
    const m = db.messages.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Message not found')
    m.deletedBy = m.isMine ? 'sender' : 'admin'
    m.body = null
    m.attachments = []
    return data(m)
  })
  route('POST', '/messages/:id/reactions', (req) => {
    requireUser(req)
    const m = db.messages.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Message not found')
    const { emoji } = body<{ emoji: string }>(req)
    const existing = m.reactions.find((r) => r.emoji === emoji)
    if (existing) {
      if (existing.reactedByMe) {
        existing.count -= 1
        existing.reactedByMe = false
        if (existing.count <= 0) m.reactions = m.reactions.filter((r) => r !== existing)
      } else {
        existing.count += 1
        existing.reactedByMe = true
      }
    } else m.reactions.push({ emoji, count: 1, reactedByMe: true })
    return data(m)
  })
  route('POST', '/messages/:id/star', (req) => {
    requireUser(req)
    const m = db.messages.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Message not found')
    m.isStarred = !m.isStarred
    return data(m)
  })
  route('POST', '/messages/:id/pin', (req) => {
    requireUser(req)
    const m = db.messages.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Message not found')
    m.isPinned = !m.isPinned
    return data(m)
  })

  route('PATCH', '/conversations/:id', (req) => {
    requireUser(req)
    const c = db.conversations.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Conversation not found')
    const b = body<{ isPinned?: boolean; isMuted?: boolean; isArchived?: boolean }>(req)
    Object.assign(c, b)
    return data(c)
  })
  route('DELETE', '/conversations/:id', (req) => {
    requireUser(req)
    const idx = db.conversations.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) db.conversations.splice(idx, 1)
    return noContent()
  })
  route('POST', '/conversations/:id/read', (req) => {
    requireUser(req)
    const c = db.conversations.find((x) => x.id === req.params.id)
    if (c) c.unreadCount = 0
    return noContent()
  })
  route('PATCH', '/conversations/:id/request', (req) => {
    requireUser(req)
    const c = db.conversations.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Conversation not found')
    const { action } = body<{ action: 'accept' | 'decline' }>(req)
    if (action === 'accept') {
      c.isRequest = false
      c.type = 'direct'
    } else db.conversations.splice(db.conversations.indexOf(c), 1)
    return data(c)
  })
  route('GET', '/conversations/:id/media', (req) => {
    requireUser(req)
    const items = db.messages.filter((m) => m.conversationId === req.params.id && m.attachments.length).flatMap((m) => m.attachments.map((a) => ({ ...a, messageId: m.id, sender: m.sender, createdAt: m.createdAt })))
    return data(items)
  })
  route('GET', '/messages/unread-count', (req) => {
    requireUser(req)
    return data({ count: db.conversations.reduce((a, c) => a + c.unreadCount, 0) })
  })
}
