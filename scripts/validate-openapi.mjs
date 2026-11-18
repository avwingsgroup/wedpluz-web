#!/usr/bin/env node
/**
 * Validates docs/backend-handoff/openapi.yaml without network access.
 *
 * Checks:
 *  - OpenAPI 3.1 document shape (info, paths, operations, responses)
 *  - unique operationIds, declared tags and security schemes
 *  - path template parameters match declared `in: path` parameters
 *  - no two paths that are equivalent once parameter names are ignored
 *  - every internal $ref resolves
 *  - every operation declares x-wedpluz-status (required | optional | proposed)
 *  - every request/response example validates against its schema (JSON Schema subset)
 *
 * Usage: npm run openapi:validate [-- path/to/openapi.yaml]
 */
import fs from 'node:fs'
import path from 'node:path'
import { load as loadYaml } from 'js-yaml'

const file = path.resolve(process.argv[2] ?? 'docs/backend-handoff/openapi.yaml')
const doc = loadYaml(fs.readFileSync(file, 'utf8'))
const errors = []
const warn = []
const err = (where, msg) => errors.push(`${where}: ${msg}`)

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
const STATUSES = new Set(['required', 'optional', 'proposed'])

/* ---------- top level ---------- */
if (!/^3\.1\.\d+$/.test(String(doc.openapi))) err('openapi', `expected 3.1.x, got ${doc.openapi}`)
if (!doc.info?.title || !doc.info?.version) err('info', 'title and version are required')
if (!doc.paths || typeof doc.paths !== 'object') err('paths', 'missing')

/* ---------- $ref resolution ---------- */
function resolve(ref) {
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((node, key) => (node == null ? undefined : node[key]), doc)
}
;(function walk(node, trail) {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${trail}[${i}]`))
  if (!node || typeof node !== 'object') return
  // examples are free-form data: a "$ref" key inside one is not a reference
  for (const [k, v] of Object.entries(node)) {
    if (k === 'example' || k === 'examples') continue
    if (k === '$ref' && typeof v === 'string' && resolve(v) === undefined) err(trail, `unresolved $ref ${v}`)
    walk(v, `${trail}.${k}`)
  }
})(doc, '#')

/* ---------- tags / security ---------- */
const declaredTags = new Set((doc.tags ?? []).map((t) => t.name))
const schemes = new Set(Object.keys(doc.components?.securitySchemes ?? {}))
const checkSecurity = (where, sec) => {
  for (const req of sec ?? []) for (const name of Object.keys(req)) if (!schemes.has(name)) err(where, `unknown security scheme ${name}`)
}
checkSecurity('security', doc.security)

/* ---------- paths ---------- */
const operationIds = new Map()
const normalized = new Map()
const counts = { required: 0, optional: 0, proposed: 0 }
let opCount = 0
let exampleCount = 0

for (const [p, item] of Object.entries(doc.paths ?? {})) {
  if (!p.startsWith('/')) err(p, 'path must start with /')
  const norm = p.replace(/\{[^}]+\}/g, '{}')
  if (normalized.has(norm)) err(p, `equivalent to ${normalized.get(norm)}`)
  normalized.set(norm, p)
  const templateParams = [...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])

  for (const [method, op] of Object.entries(item)) {
    if (!METHODS.includes(method)) { if (!['parameters', 'summary', 'description', 'servers'].includes(method)) err(p, `unknown key ${method}`); continue }
    opCount++
    const where = `${method.toUpperCase()} ${p}`
    if (!op.operationId) err(where, 'missing operationId')
    else if (operationIds.has(op.operationId)) err(where, `duplicate operationId ${op.operationId} (also ${operationIds.get(op.operationId)})`)
    else operationIds.set(op.operationId, where)
    if (!op.responses || !Object.keys(op.responses).length) err(where, 'no responses')
    if (!STATUSES.has(op['x-wedpluz-status'])) err(where, 'missing/invalid x-wedpluz-status')
    else counts[op['x-wedpluz-status']]++
    for (const t of op.tags ?? []) if (!declaredTags.has(t)) err(where, `undeclared tag ${t}`)
    checkSecurity(where, op.security)

    const params = (op.parameters ?? []).map((x) => (x.$ref ? resolve(x.$ref) : x)).filter(Boolean)
    const pathParams = params.filter((x) => x.in === 'path')
    for (const name of templateParams) {
      const decl = pathParams.find((x) => x.name === name)
      if (!decl) err(where, `path parameter {${name}} not declared`)
      else if (decl.required !== true) err(where, `path parameter {${name}} must be required`)
    }
    for (const decl of pathParams) if (!templateParams.includes(decl.name)) err(where, `declared path parameter ${decl.name} not in template`)
    const seen = new Set()
    for (const x of params) {
      const key = `${x.in}:${x.name}`
      if (seen.has(key)) err(where, `duplicate parameter ${key}`)
      seen.add(key)
    }

    for (const [ct, media] of Object.entries(op.requestBody?.content ?? {})) {
      if (media.example !== undefined && media.schema) { exampleCount++; validate(media.example, media.schema, `${where} request ${ct}`) }
    }
    for (const [status, res0] of Object.entries(op.responses ?? {})) {
      const res = res0.$ref ? resolve(res0.$ref) : res0
      if (!res?.description) err(`${where} ${status}`, 'response needs a description')
      for (const [ct, media] of Object.entries(res?.content ?? {})) {
        if (media.example !== undefined && media.schema) { exampleCount++; validate(media.example, media.schema, `${where} ${status} ${ct}`) }
      }
    }
  }
}

/* ---------- example validation (JSON Schema subset used by this spec) ---------- */
function typeOf(v) {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (Number.isInteger(v)) return 'integer'
  return typeof v
}
function check(value, schema, at, out) {
  if (!schema || typeof schema !== 'object') return
  if (schema.$ref) return check(value, resolve(schema.$ref), at, out)
  if (schema.allOf) for (const s of schema.allOf) check(value, s, at, out)
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => { const o = []; check(value, s, at, o); return o.length === 0 })
    if (!ok) out.push(`${at}: matches none of anyOf`)
    return
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) out.push(`${at}: ${JSON.stringify(value)} not in enum`)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const t = typeOf(value)
    const ok = types.some((x) => x === t || (x === 'number' && t === 'integer'))
    if (!ok) { out.push(`${at}: expected ${types.join('|')}, got ${t}`); return }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const r of schema.required ?? []) if (!(r in value)) out.push(`${at}: missing required ${r}`)
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) check(v, schema.properties[k], `${at}.${k}`, out)
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') check(v, schema.additionalProperties, `${at}.${k}`, out)
      else if (schema.additionalProperties === false) out.push(`${at}: unexpected property ${k}`)
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => check(v, schema.items, `${at}[${i}]`, out))
}
function validate(example, schema, where) {
  const out = []
  check(example, schema, '$', out)
  for (const m of out.slice(0, 5)) err(`${where} example`, m)
}

/* ---------- report ---------- */
for (const w of warn) console.warn(`warn  ${w}`)
if (errors.length) {
  for (const e of errors.slice(0, 200)) console.error(`error ${e}`)
  if (errors.length > 200) console.error(`... and ${errors.length - 200} more`)
  console.error(`\n✖ ${path.relative(process.cwd(), file)} is invalid (${errors.length} problems)`)
  process.exit(1)
}
console.log(`✔ ${path.relative(process.cwd(), file)} is valid OpenAPI ${doc.openapi}`)
console.log(`  ${opCount} operations · ${Object.keys(doc.paths).length} paths · ${Object.keys(doc.components?.schemas ?? {}).length} schemas · ${exampleCount} examples checked`)
console.log(`  status: ${counts.required} required · ${counts.optional} optional · ${counts.proposed} proposed`)
