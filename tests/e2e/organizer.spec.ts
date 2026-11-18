import { expect, test } from '@playwright/test'
import { failOnPageErrors, loginAsUser } from './helpers'

test.describe('organizer portal', () => {
  test('lists managed events and opens the event overview', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await loginAsUser(page)
    await page.goto('/manage/events')
    await expect(page.locator('main a[href^="/manage/events/evt_"]').first()).toBeVisible()
    await page.goto('/manage/events/evt_tolu_shower')
    await expect(page.getByRole('button', { name: 'Scan tickets' })).toBeVisible()
    assertNoErrors()
  })

  test('validates ticket codes server-side at check-in', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/manage/events/evt_tolu_shower')
    await page.getByRole('button', { name: 'Scan tickets' }).click()
    // Desktop browsers without BarcodeDetector fall back to manual entry automatically.
    const manualToggle = page.getByRole('button', { name: 'Enter code manually instead' })
    if (await manualToggle.isVisible()) await manualToggle.click()
    await page.getByLabel('Ticket code').fill('NOPE-000-00')
    await page.getByRole('button', { name: 'Validate ticket' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Ticket not found' })).toBeVisible()
  })

  test('opens the create event wizard', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/manage/events/new')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
