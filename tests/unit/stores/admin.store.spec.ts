import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAdminStore } from '@/stores/admin.store'
import type { AdminUser } from '@/types'

const admin = (permissions: AdminUser['permissions']): AdminUser => ({
  id: 'adm_1',
  firstName: 'Ada',
  lastName: 'Obi',
  email: 'ada@example.com',
  avatarUrl: null,
  roles: [{ id: 'role_finance', name: 'Finance', slug: 'finance' }],
  permissions,
  status: 'active',
  twoFactorEnabled: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
})

describe('admin permission helpers (usability layer only)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('denies everything without a signed-in admin', () => {
    const store = useAdminStore()
    expect(store.can('dashboard.view')).toBe(false)
    expect(store.canAny('dashboard.view', 'users.view')).toBe(false)
  })

  it('requires every key for can() and any key for canAny()', () => {
    const store = useAdminStore()
    store.admin = admin(['finance.view', 'refunds.view'])
    expect(store.can('finance.view')).toBe(true)
    expect(store.can('finance.view', 'refunds.approve')).toBe(false)
    expect(store.canAny('refunds.approve', 'refunds.view')).toBe(true)
    expect(store.canAny('roles.manage', 'audit.view')).toBe(false)
  })
})
