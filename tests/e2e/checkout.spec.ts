import { expect, test } from '@playwright/test'
import { failOnPageErrors, loginAsUser } from './helpers'

test.describe('ticket checkout', () => {
  test('buys a paid ticket through the hosted payment redirect', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await loginAsUser(page)
    await page.goto('/events/movie-in-the-park-denim-edition')

    await page.getByRole('button', { name: /attend event/i }).first().click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    // Step 1: tickets.
    await drawer.getByRole('button', { name: /increase/i }).first().click()
    await drawer.getByRole('button', { name: /continue/i }).last().click()

    // Step 2: attendee details (pre-filled from the profile) with the server-quoted total.
    await expect(drawer.getByText(/your order/i).first()).toBeVisible()
    await drawer.getByRole('button', { name: /^next/i }).last().click()

    // Step 3: payment method and hosted redirect.
    await expect(drawer.getByRole('heading', { name: /make payment/i })).toBeVisible()
    await drawer.getByText('Paystack', { exact: true }).click()
    await drawer.getByRole('button', { name: /make payments/i }).click()

    await expect(page).toHaveURL(/\/checkout\/mock-gateway\?order=/)
    await page.getByRole('button', { name: /simulate successful/i }).click()

    // The return page asks the backend to verify; it never trusts the redirect alone.
    await expect(page).toHaveURL(/\/checkout\/return\?order=/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/attending/i)
    assertNoErrors()
  })

  test('shows a ticket with its QR code', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/tickets/tkt_1')
    await expect(page.getByAltText('Ticket QR code')).toBeVisible()
  })
})
