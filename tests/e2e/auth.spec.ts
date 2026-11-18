import { expect, test } from '@playwright/test'
import { USER, failOnPageErrors, loginAsUser } from './helpers'

test.describe('customer authentication', () => {
  test('shows the API error for wrong credentials', async ({ page }) => {
    await page.goto('/auth/login/email')
    await page.locator('input[type=email]').fill(USER.email)
    await page.locator('input[type=password]').fill('wrongpass')
    await page.locator('button[type=submit]').click()
    await expect(page.getByText('Incorrect email or password.').first()).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('validates the email field before calling the API', async ({ page }) => {
    await page.goto('/auth/login/email')
    await page.locator('input[type=email]').fill('not-an-email')
    await page.locator('input[type=password]').fill('whatever1')
    await page.locator('button[type=submit]').click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
  })

  test('signs in, returns to the requested page and survives a reload @mobile', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/tickets')
    await expect(page).toHaveURL(/\/auth\/login/)
    await loginAsUser(page, '/tickets')
    await expect(page).toHaveURL(/\/tickets/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Regression: the session must be restored on a hard reload.
    await page.reload()
    await expect(page).toHaveURL(/\/tickets/)
    assertNoErrors()
  })
})
