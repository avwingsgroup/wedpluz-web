import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load } from 'js-yaml'

const root = resolve(__dirname, '../../..')
const specPath = resolve(root, 'docs/backend-handoff/openapi.yaml')

type Op = { operationId: string; 'x-wedpluz-status': string; 'x-wedpluz-permission'?: string; security?: Array<Record<string, unknown>>; tags: string[] }

describe('backend handoff OpenAPI spec', () => {
  it('passes the repository validator', () => {
    const out = execFileSync(process.execPath, [resolve(root, 'scripts/validate-openapi.mjs'), specPath], { encoding: 'utf8' })
    expect(out).toContain('is valid OpenAPI 3.1')
  })

  const doc = load(readFileSync(specPath, 'utf8')) as { paths: Record<string, Record<string, Op>> }
  const ops = Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item).map(([method, op]) => ({ path, method, op })))

  it('marks every operation as required, optional or proposed', () => {
    for (const { op } of ops) expect(['required', 'optional', 'proposed']).toContain(op['x-wedpluz-status'])
  })

  it('maps every admin operation (except auth) to a permission and the admin token', () => {
    const admin = ops.filter(({ path }) => path.startsWith('/admin') && !path.startsWith('/admin/auth') && path !== '/admin/me')
    expect(admin.length).toBeGreaterThan(90)
    for (const { op, path } of admin) {
      expect(op['x-wedpluz-permission'], `${path} has no permission`).toBeTruthy()
      expect(op.security).toEqual([{ adminBearer: [] }])
    }
  })

  it('requires an Idempotency-Key on payment-sensitive writes', () => {
    const idem = (path: string, method: string) => JSON.stringify(doc.paths[path]?.[method]).includes('IdempotencyKey')
    expect(idem('/orders', 'post')).toBe(true)
    expect(idem('/wallet/top-ups', 'post')).toBe(true)
    expect(idem('/wallet/withdrawals', 'post')).toBe(true)
    expect(idem('/me/subscription', 'post')).toBe(true)
  })

  it('keeps webhooks backend-only and signature-authenticated', () => {
    const hooks = ops.filter(({ path }) => path.startsWith('/webhooks/'))
    expect(hooks.length).toBeGreaterThanOrEqual(4)
    for (const { op } of hooks) {
      expect(op.tags).toEqual(['Webhooks (backend-only)'])
      expect(op.security).toEqual([])
    }
  })
})
