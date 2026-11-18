import { expect, test } from '@playwright/test'
import { failOnPageErrors, loginAsAdmin, loginAsUser } from './helpers'

// The dev server mounts the admin console at /admin; the admin build serves it at "/".
test.describe('admin console', () => {
  test('requires password and a 2FA code, then shows the dashboard', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await loginAsAdmin(page)
    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
    await expect(page.getByText('Gross transaction volume')).toBeVisible()
    assertNoErrors()
  })

  test('rejects a wrong 2FA code', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type=password]').fill('password123')
    await page.locator('button[type=submit]').click()
    const digits = page.locator('input[aria-label^="Digit"]')
    await expect(digits.first()).toBeVisible()
    for (const [i, d] of [...'9999'].entries()) await digits.nth(i).fill(d)
    await expect(page.getByText(/invalid authentication code/i).first()).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('a customer session does not grant admin access', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('user search is kept in the URL for shareable filtered views', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/users')
    await page.getByRole('searchbox', { name: 'Search' }).fill('john')
    await expect(page).toHaveURL(/search=john/)
    await expect(page.getByRole('table')).toContainText(/john/i)
  })

  test('finance pages render settlements and payouts', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/finance/settlements')
    await expect(page.getByRole('heading', { level: 1, name: /settlements/i })).toBeVisible()
    await page.goto('/admin/finance/payouts')
    await expect(page.getByRole('heading', { level: 1, name: /payouts/i })).toBeVisible()
  })

  test('dashboard fits a phone screen without horizontal scrolling @mobile', async ({ page }) => {
    await loginAsAdmin(page)
    await expect(page.getByText('Gross transaction volume')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
