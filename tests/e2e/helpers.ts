import { expect, type Page } from '@playwright/test'

/** Mock-mode credentials (see src/services/mock). Never valid against a live API. */
export const USER = { email: 'johnbrown@gmail.com', password: 'password123' }
export const ADMIN = { email: 'admin@wedpluz.com', password: 'password123', otp: '123456' }

export async function loginAsUser(page: Page, redirect?: string) {
  await page.goto(`/auth/login/email${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  await page.locator('input[type=email]').fill(USER.email)
  await page.locator('input[type=password]').fill(USER.password)
  await page.locator('button[type=submit]').click()
  await expect(page).not.toHaveURL(/\/auth\/login/)
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.locator('input[type=email]').fill(ADMIN.email)
  await page.locator('input[type=password]').fill(ADMIN.password)
  await page.locator('button[type=submit]').click()
  const digits = page.locator('input[aria-label^="Digit"]')
  await expect(digits.first()).toBeVisible()
  for (const [i, d] of [...ADMIN.otp].entries()) await digits.nth(i).fill(d)
  await expect(page).toHaveURL(/\/admin\/?$/)
}

/** Fails the test on uncaught page errors (e.g. runtime exceptions in components). */
export function failOnPageErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return () => expect(errors, `uncaught page errors: ${errors.join('\n')}`).toEqual([])
}
