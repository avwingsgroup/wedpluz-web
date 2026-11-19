#!/usr/bin/env node
/**
 * Live API contract check.
 *
 * Calls a running Wedpluz API as a guest and as a freshly registered customer, then validates
 * every response (status and body) against docs/backend-handoff/openapi.yaml.
 *
 *   npm run test:api -- https://wedpluz-api.test/api/v1 [results.json]
 *   API_BASE_URL=https://api-staging.wedpluz.com/api/v1 npm run test:api
 *
 * Side effects: registers one customer account per run (qa.frontend.<timestamp>@wedpluz.test),
 * updates its city and privacy settings, and logs it in and out. Registration may queue a
 * verification email to that undeliverable address. Do NOT run against production.
 * Admin, checkout and organizer flows need a verified account and are not covered here.
 *
 * Local HTTPS with a self-signed certificate: the npm script passes --use-system-ca (Node 22.15+).
 */
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { load } from 'js-yaml'

const BASE = (process.argv[2] ?? process.env.API_BASE_URL ?? 'https://wedpluz-api.test/api/v1').replace(/\/$/, '')
if (/\/\/api\.wedpluz\.com/.test(BASE) && process.env.ALLOW_PRODUCTION !== '1') {
  console.error('Refusing to create test accounts on production. Set ALLOW_PRODUCTION=1 to override.')
  process.exit(2)
}
const OUT = process.argv[3]
const doc = load(fs.readFileSync('docs/backend-handoff/openapi.yaml', 'utf8'))

/* ---------- spec lookup + JSON-schema subset validator (same rules as validate-openapi) ---------- */
const resolveRef = (ref) => ref.slice(2).split('/').reduce((n, k) => n?.[k], doc)
const ops = []
for (const [p, item] of Object.entries(doc.paths)) {
  for (const [m, op] of Object.entries(item)) {
    const re = new RegExp('^' + p.replace(/\{[^}]+\}/g, '[^/]+') + '$')
    ops.push({ method: m.toUpperCase(), template: p, re, op, literal: !p.includes('{') })
  }
}
function findOp(method, path) {
  const candidates = ops.filter((o) => o.method === method && o.re.test(path))
  return candidates.find((o) => o.literal) ?? candidates[0]
}
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v)
function check(value, schema, at, out) {
  if (!schema || typeof schema !== 'object') return
  if (schema.$ref) return check(value, resolveRef(schema.$ref), at, out)
  if (schema.allOf) for (const s of schema.allOf) check(value, s, at, out)
  if (schema.anyOf) {
    if (!schema.anyOf.some((s) => { const o = []; check(value, s, at, o); return !o.length })) out.push(`${at}: matches none of anyOf (got ${typeOf(value)} ${JSON.stringify(value)?.slice(0, 60)})`)
    return
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) out.push(`${at}: ${JSON.stringify(value)} not in enum [${schema.enum.join(', ')}]`)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const t = typeOf(value)
    if (!types.some((x) => x === t || (x === 'number' && t === 'integer'))) { out.push(`${at}: expected ${types.join('|')}, got ${t}${t === 'string' ? ` "${String(value).slice(0, 40)}"` : ''}`); return }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required ?? []) if (!(r in value)) out.push(`${at}: missing required "${r}"`)
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) check(v, schema.properties[k], `${at}.${k}`, out)
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(v, schema.additionalProperties, `${at}.${k}`, out)
    }
  }
  if (Array.isArray(value) && schema.items) value.slice(0, 5).forEach((v, i) => check(v, schema.items, `${at}[${i}]`, out))
}

/* ---------- runner ---------- */
const results = []
async function call(method, path, { body, query, token, expect, label, idem } = {}) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  const headers = { Accept: 'application/json', 'X-Client-Platform': 'web', 'X-Client-Version': 'qa', 'X-Correlation-Id': randomUUID() }
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  if (idem) headers['Idempotency-Key'] = idem
  const started = Date.now()
  let status = 0, json = null, text = ''
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    status = res.status
    text = await res.text()
    try { json = text ? JSON.parse(text) : null } catch { json = null }
  } catch (e) { text = String(e.cause?.code ?? e.message) }
  const ms = Date.now() - started
  const op = findOp(method, path)
  const problems = []
  if (!op) problems.push('no matching operation in openapi.yaml')
  const expected = expect ?? (op ? Object.keys(op.op.responses).find((s) => /^2/.test(s)) : '200')
  if (String(status) !== String(expected)) problems.push(`status ${status}, expected ${expected}${json?.code ? ` (${json.code}: ${json.message})` : text && !json ? ` (${text.slice(0, 120)})` : ''}`)
  else if (op && status !== 204) {
    let res = op.op.responses[String(status)]
    if (res?.$ref) res = resolveRef(res.$ref)
    const schema = res?.content?.['application/json']?.schema
    if (schema) check(json, schema, '$', problems)
    else if (json === null && status !== 204) problems.push('expected JSON body')
  }
  results.push({ label: label ?? `${method} ${path}`, operationId: op?.op.operationId, method, path, status, ms, ok: problems.length === 0, problems: problems.slice(0, 8) })
  return { status, json }
}

/* ---------- guest / public ---------- */
await call('GET', '/health', { expect: 200 })
await call('GET', '/config')
await call('GET', '/categories')
await call('GET', '/interests')
await call('GET', '/plans')
await call('GET', '/vendor-categories')
await call('GET', '/business-categories')
await call('GET', '/events', { query: { page: 1, perPage: 12 } })
await call('GET', '/events', { query: { search: 'wedding', sort: 'date' }, label: 'GET /events (search)' })
await call('GET', '/events/featured')
await call('GET', '/events/upcoming')
await call('GET', '/events/popular')
await call('GET', '/events/promoted')
await call('GET', '/vendors', { query: { page: 1 } })
await call('GET', '/vendors/featured')
await call('GET', '/search/suggestions', { query: { q: 'we' } })
await call('GET', '/locations/suggest', { query: { q: 'la' } })
for (const slug of ['about', 'terms', 'privacy', 'faqs', 'help', 'contact']) await call('GET', `/pages/${slug}`)
await call('GET', '/events/does-not-exist-qa', { expect: 404, label: 'GET /events/{slug} unknown → 404' })
await call('GET', '/me', { expect: 401, label: 'GET /me without token → 401' })

/* ---------- auth ---------- */
const stamp = Date.now()
const email = `qa.frontend.${stamp}@wedpluz.test`
const password = `Qa${randomUUID().slice(0, 8)}9x`
await call('POST', '/auth/register', { body: { firstName: 'Qa', lastName: 'Frontend' }, expect: 422, label: 'POST /auth/register invalid → 422' })
const reg = await call('POST', '/auth/register', { body: { firstName: 'Qa', lastName: 'Frontend', email, dateOfBirth: '1995-05-20', password, passwordConfirmation: password, acceptedTerms: true } })
await call('POST', '/auth/register', { body: { firstName: 'Qa', lastName: 'Frontend', email, dateOfBirth: '1995-05-20', password, passwordConfirmation: password, acceptedTerms: true }, expect: 422, label: 'POST /auth/register duplicate email → 422' })
await call('POST', '/auth/login', { body: { email, password: 'wrong-password-1' }, expect: 401, label: 'POST /auth/login wrong password → 401' })
const login = await call('POST', '/auth/login', { body: { email, password, deviceName: 'QA live contract' } })
let token = login.json?.data?.tokens?.accessToken ?? reg.json?.data?.tokens?.accessToken
const refreshToken = login.json?.data?.tokens?.refreshToken
const user = login.json?.data?.user

if (token) {
  const t = { token }
  await call('GET', '/auth/me', t)
  await call('GET', '/me', t)
  await call('PATCH', '/me', { ...t, body: { city: 'Lagos' } })
  await call('GET', '/me/privacy', t)
  await call('PUT', '/me/privacy', { ...t, body: { showEmail: false } })
  await call('GET', '/me/notification-preferences', t)
  await call('GET', '/me/sessions', t)
  await call('GET', '/me/identity-verification', t)
  await call('GET', '/me/deletion-request', t)
  await call('GET', '/me/saved-events', t)
  await call('GET', '/me/saved-vendors', t)
  await call('GET', '/me/tickets', { ...t, query: { tab: 'upcoming' } })
  await call('GET', '/me/collaborations', t)
  await call('GET', '/me/promotions', t)
  await call('GET', '/me/subscription', t)
  await call('GET', '/me/subscription/payments', t)
  await call('GET', '/me/vendor-profile', t)
  await call('GET', '/support/tickets', t)
  await call('GET', '/notifications', t)
  await call('GET', '/notifications/unread-count', t)
  await call('GET', '/conversations', { ...t, query: { tab: 'all' } })
  await call('GET', '/messages/unread-count', t)
  await call('GET', '/communities', t)
  await call('GET', '/organizer/events', { ...t, query: { tab: 'created' } })
  await call('GET', '/planner/assets', t)
  await call('GET', '/planner/chats', t)
  await call('GET', '/planner/menus', t)
  await call('GET', '/planner/hall-layouts', t)
  await call('GET', '/banks', t)
  await call('GET', `/users/${user?.id}`, { ...t, label: 'GET /users/{id} (self public profile)' })
  // gated by email verification (expected 403 for a new, unverified account)
  await call('GET', '/wallet', { ...t, expect: 403, label: 'GET /wallet unverified → 403' })
  await call('POST', '/organizer/events', { ...t, body: { title: 'QA draft' }, expect: 403, label: 'POST /organizer/events unverified → 403' })
  // audience separation
  await call('GET', '/admin/me', { ...t, expect: 401, label: 'GET /admin/me with customer token → 401' })
  // OTP endpoints (no email content needed to check the contract)
  await call('POST', '/auth/otp/verify', { body: { email, code: '0000', purpose: 'email_verification' }, expect: 422, label: 'POST /auth/otp/verify wrong code → 422' })
  await call('POST', '/auth/password/forgot', { body: { email: `nobody.${stamp}@wedpluz.test` }, label: 'POST /auth/password/forgot unknown email (no enumeration)' })
  // refresh rotation + reuse detection
  if (refreshToken) {
    const r1 = await call('POST', '/auth/refresh', { body: { refreshToken } })
    await call('POST', '/auth/refresh', { body: { refreshToken }, expect: 401, label: 'POST /auth/refresh reused token → 401' })
    token = r1.json?.data?.accessToken ?? token
  }
  // reuse detection revokes the whole token family, so log in again before testing logout
  await call('GET', '/me', { token, expect: 401, label: 'GET /me after refresh-token reuse → 401 (family revoked)' })
  const fresh = await call('POST', '/auth/login', { body: { email, password, deviceName: 'QA live contract 2' }, label: 'POST /auth/login (fresh session)' })
  const t2 = fresh.json?.data?.tokens?.accessToken
  await call('POST', '/auth/logout', { token: t2 })
  await call('GET', '/me', { token: t2, expect: 401, label: 'GET /me after logout → 401' })
}

/* ---------- report ---------- */
const failed = results.filter((r) => !r.ok)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${String(r.status).padEnd(3)} ${String(r.ms).padStart(5)}ms  ${r.label}${r.ok ? '' : '\n        - ' + r.problems.join('\n        - ')}`)
console.log(`\n${results.length - failed.length}/${results.length} passed · test account: ${email}`)
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ base: BASE, email, results }, null, 2))
process.exit(failed.length ? 1 : 0)
