import { created, data, fail, noContent, route } from '../adapter'
import * as db from '../db'
import { body, requireFields, requireUser } from './shared'
import type { HallLayout, PlannerAssetSummary, PlannerChat, PlannerChatMessage, PlannerGeneration, PlannerMenu } from '@/types'

const generations: PlannerGeneration[] = []

function assets(): PlannerAssetSummary[] {
  return [
    ...db.plannerMenus.map((m) => ({ id: m.id, type: 'menu' as const, name: m.name, thumbnailUrl: db.img(`menu-${m.id}`, 400, 300), eventId: null, updatedAt: m.updatedAt })),
    ...db.hallLayouts.map((h) => ({ id: h.id, type: 'hall_layout' as const, name: h.name, thumbnailUrl: h.thumbnailUrl, eventId: null, updatedAt: h.updatedAt })),
    ...generations.filter((g) => g.status === 'ready').map((g) => ({ id: g.id, type: g.type, name: g.prompt.slice(0, 40), thumbnailUrl: g.resultUrls[0] ?? null, eventId: null, updatedAt: g.createdAt })),
    { id: 'gen_1', type: 'cake_design' as const, name: '3-tier white cake with gold accents', thumbnailUrl: db.img('cake-a', 400, 300), eventId: null, updatedAt: db.plannerChats[0]?.createdAt ?? new Date().toISOString() },
    { id: 'brand_1', type: 'event_branding' as const, name: 'Wedpluz Connect table cards', thumbnailUrl: db.img('brand-1', 400, 300), eventId: null, updatedAt: new Date().toISOString() },
  ]
}

export function registerPlannerHandlers() {
  route('GET', '/planner/assets', (req) => {
    requireUser(req)
    const type = req.query.get('type')
    let list = assets().filter((a) => !type || type === 'all' || a.type === type)
    if (req.query.get('sort') === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return data(list)
  })
  route('DELETE', '/planner/assets/:id', (req) => {
    requireUser(req)
    const mi = db.plannerMenus.findIndex((m) => m.id === req.params.id)
    if (mi >= 0) db.plannerMenus.splice(mi, 1)
    const hi = db.hallLayouts.findIndex((h) => h.id === req.params.id)
    if (hi >= 0) db.hallLayouts.splice(hi, 1)
    return noContent()
  })

  route('GET', '/planner/chats', (req) => {
    requireUser(req)
    return data(db.plannerChats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })))
  })
  route('POST', '/planner/chats', (req) => {
    requireUser(req)
    const b = body<{ title?: string }>(req)
    const c: PlannerChat = { id: db.nextId('pc'), title: b.title ?? 'New chat', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    db.plannerChats.unshift(c)
    return created(c)
  })
  route('GET', '/planner/chats/:id', (req) => {
    requireUser(req)
    const c = db.plannerChats.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Chat not found')
    return data(c)
  })
  route('DELETE', '/planner/chats/:id', (req) => {
    requireUser(req)
    const idx = db.plannerChats.findIndex((x) => x.id === req.params.id)
    if (idx >= 0) db.plannerChats.splice(idx, 1)
    return noContent()
  })
  route('POST', '/planner/chats/:id/messages', (req) => {
    const user = requireUser(req)
    const c = db.plannerChats.find((x) => x.id === req.params.id)
    if (!c) fail(404, 'NOT_FOUND', 'Chat not found')
    const b = body<{ content: string; attachmentUploadIds?: string[]; intent?: 'cake_design' | 'event_branding' | 'menu' | 'hall_layout' | 'chat' }>(req)
    requireFields(b, ['content'])
    if (user.plan === 'free' && (b.intent === 'cake_design' || b.intent === 'event_branding')) fail(402, 'PAYMENT_REQUIRED', 'AI designs are available on Premium plans. Upgrade to generate designs.')
    const userMsg: PlannerChatMessage = { id: db.nextId('pm'), role: 'user', content: b.content, attachments: (b.attachmentUploadIds ?? []).map((id) => ({ type: 'image', url: db.img(id, 400, 400), name: 'reference.jpg' })), generation: null, createdAt: new Date().toISOString() }
    c.messages.push(userMsg)
    if (c.messages.length === 1) c.title = b.content.slice(0, 48)
    let generation: PlannerGeneration | null = null
    let reply = 'Got it. Tell me the style, colours and number of guests and I will draft options for you.'
    if (b.intent === 'cake_design' || b.intent === 'event_branding') {
      generation = { id: db.nextId('gen'), type: b.intent, prompt: b.content, status: 'ready', resultUrls: [db.img(`${b.intent}-${c.messages.length}-a`, 600, 600), db.img(`${b.intent}-${c.messages.length}-b`, 600, 600), db.img(`${b.intent}-${c.messages.length}-c`, 600, 600)], createdAt: new Date().toISOString() }
      generations.push(generation)
      reply = b.intent === 'cake_design' ? 'Here are three cake directions based on your brief. Tap one to save it to your assets or ask for changes.' : 'Here are three branding concepts for your event. I can adapt colours, typography or layout.'
    } else if (b.intent === 'menu') reply = 'I drafted a menu structure with starters, mains and desserts. Open the Menu builder to price each dish.'
    else if (b.intent === 'hall_layout') reply = 'Start from a template in the Hall layout tool, then I can help assign tables to ticket types.'
    const assistant: PlannerChatMessage = { id: db.nextId('pm'), role: 'assistant', content: reply, attachments: [], generation, createdAt: new Date().toISOString() }
    c.messages.push(assistant)
    c.updatedAt = assistant.createdAt
    return created({ messages: [userMsg, assistant] })
  })

  route('GET', '/planner/menus', (req) => {
    requireUser(req)
    return data(db.plannerMenus)
  })
  route('GET', '/planner/menus/:id', (req) => {
    requireUser(req)
    const m = db.plannerMenus.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Menu not found')
    return data(m)
  })
  route('POST', '/planner/menus', (req) => {
    requireUser(req)
    const b = body<Partial<PlannerMenu>>(req)
    requireFields(b as Record<string, unknown>, ['name'])
    const m: PlannerMenu = { id: db.nextId('menu'), name: b.name ?? 'New menu', sections: b.sections ?? [], currency: 'NGN', updatedAt: new Date().toISOString() }
    db.plannerMenus.unshift(m)
    return created(m, 'Menu saved')
  })
  route('PUT', '/planner/menus/:id', (req) => {
    requireUser(req)
    const m = db.plannerMenus.find((x) => x.id === req.params.id)
    if (!m) fail(404, 'NOT_FOUND', 'Menu not found')
    Object.assign(m, body(req), { updatedAt: new Date().toISOString() })
    return data(m, 'Menu saved')
  })

  route('GET', '/planner/hall-layouts', (req) => {
    requireUser(req)
    return data(db.hallLayouts)
  })
  route('GET', '/planner/hall-layouts/:id', (req) => {
    requireUser(req)
    const h = db.hallLayouts.find((x) => x.id === req.params.id)
    if (!h) fail(404, 'NOT_FOUND', 'Layout not found')
    return data(h)
  })
  route('POST', '/planner/hall-layouts', (req) => {
    requireUser(req)
    const b = body<Partial<HallLayout>>(req)
    const h: HallLayout = { id: db.nextId('hall'), name: b.name ?? 'New layout', thumbnailUrl: null, width: b.width ?? 1200, height: b.height ?? 900, totalSeats: b.totalSeats ?? 0, reservedSeats: b.reservedSeats ?? 0, tables: b.tables ?? [], fixtures: b.fixtures ?? [], updatedAt: new Date().toISOString() }
    db.hallLayouts.unshift(h)
    return created(h, 'Layout saved')
  })
  route('PUT', '/planner/hall-layouts/:id', (req) => {
    requireUser(req)
    const h = db.hallLayouts.find((x) => x.id === req.params.id)
    if (!h) fail(404, 'NOT_FOUND', 'Layout not found')
    Object.assign(h, body(req), { updatedAt: new Date().toISOString() })
    h.totalSeats = h.tables.reduce((a, t) => a + t.seats.length, 0)
    h.reservedSeats = h.tables.reduce((a, t) => a + t.seats.filter((s) => s.status === 'reserved').length, 0)
    return data(h, 'Layout saved')
  })

  route('POST', '/planner/generations', (req) => {
    const user = requireUser(req)
    if (user.plan === 'free') fail(402, 'PAYMENT_REQUIRED', 'AI designs are available on Premium plans.')
    const b = body<{ type: 'cake_design' | 'event_branding'; prompt: string }>(req)
    requireFields(b, ['type', 'prompt'])
    const g: PlannerGeneration = { id: db.nextId('gen'), type: b.type, prompt: b.prompt, status: 'ready', resultUrls: [db.img(`${b.type}-x-a`, 600, 600), db.img(`${b.type}-x-b`, 600, 600), db.img(`${b.type}-x-c`, 600, 600)], createdAt: new Date().toISOString() }
    generations.push(g)
    return created(g)
  })
}
