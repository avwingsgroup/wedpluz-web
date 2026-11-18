import { expect, test } from '@playwright/test'
import { failOnPageErrors } from './helpers'

test.describe('public discovery', () => {
  test('home page shows discovery sections and labels mock data @mobile', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Discover events in your area' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /upcoming events/i })).toBeVisible()
    // Mock fixtures must never be mistaken for live data.
    await expect(page.getByTestId('mock-mode-badge')).toBeVisible()
    assertNoErrors()
  })

  test('browsing from the events list to an event detail page', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/events')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/events near|results for/i)
    const firstCard = page.locator('main a[href^="/events/"]').first()
    await expect(firstCard).toBeVisible()
    await firstCard.click()
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    assertNoErrors()
  })

  test('event detail renders key facts for guests @mobile', async ({ page }) => {
    await page.goto('/events/a-trip-to-obudu-cattle-ranch')
    await expect(page.getByRole('heading', { level: 1, name: 'A trip to Obudu Cattle ranch' })).toBeVisible()
    await expect(page.getByText('Approval required')).toBeVisible()
    await expect(page.getByText('Adult event')).toBeVisible()
  })

  test('vendor marketplace links to vendor profiles', async ({ page }) => {
    await page.goto('/vendors')
    await expect(page.getByRole('heading', { name: 'Hire Vendors on Wedpluz' })).toBeVisible()
    const vendorLink = page.locator('main a[href^="/vendors/"]').first()
    await expect(vendorLink).toBeVisible()
    await vendorLink.click()
    await expect(page).toHaveURL(/\/vendors\/[a-z0-9-]+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/this-page-does-not-exist')
    await expect(page.getByText('404')).toBeVisible()
  })

  test('protected pages send guests to login with a redirect back', async ({ page }) => {
    await page.goto('/tickets')
    await expect(page).toHaveURL(/\/auth\/login.*redirect=(%2F|\/)tickets/)
  })
})
