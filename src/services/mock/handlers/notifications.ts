import { cursorPage, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireUser, textMatch } from './shared'

export function registerNotificationHandlers() {
  route('GET', '/notifications', (req) => {
    requireUser(req)
    const tab = req.query.get('tab') ?? 'all'
    let list = db.notifications
    if (tab === 'requests') list = list.filter((n) => n.isRequest)
    list = list.filter((n) => textMatch([n.title, ...n.segments.map((s) => s.text)], req.query.get('search')))
    return cursorPage(list, req.query, 20)
  })
  route('GET', '/notifications/unread-count', (req) => {
    requireUser(req)
    return data({ count: db.notifications.filter((n) => !n.readAt).length, requests: db.notifications.filter((n) => n.isRequest && n.actionState === 'pending').length })
  })
  route('POST', '/notifications/read-all', (req) => {
    requireUser(req)
    for (const n of db.notifications) n.readAt ??= new Date().toISOString()
    return noContent()
  })
  route('PATCH', '/notifications/:id/read', (req) => {
    requireUser(req)
    const n = db.notifications.find((x) => x.id === req.params.id)
    if (n) n.readAt = new Date().toISOString()
    return data(n ?? null)
  })
  route('POST', '/notifications/:id/actions', (req) => {
    requireUser(req)
    const n = db.notifications.find((x) => x.id === req.params.id)
    if (!n) fail(404, 'NOT_FOUND', 'Notification not found')
    const { action } = body<{ action: 'accept' | 'decline' | 'register' }>(req)
    n.actionState = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'done'
    n.readAt = new Date().toISOString()
    if (n.type === 'collaboration_invite') {
      const c = db.myCollaborations.find((x) => x.id === n.data.collaborationId)
      if (c) (c as { status: string }).status = action === 'accept' ? 'accepted' : 'declined'
    }
    return data(n, action === 'accept' ? 'Invite accepted' : action === 'decline' ? 'Invite declined' : 'Done')
  })
  route('DELETE', '/notifications/:id', (req) => {
    requireUser(req)
    const idx = db.notifications.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) db.notifications.splice(idx, 1)
    return noContent()
  })
  route('POST', '/me/devices', (req) => {
    requireUser(req)
    return data({ registered: true })
  })
}
