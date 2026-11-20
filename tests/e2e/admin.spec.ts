import { expect, test, type Locator } from '@playwright/test'
import { ADMIN, failOnPageErrors, loginAsAdmin, loginAsUser } from './helpers'

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
    await expect(digits).toHaveCount(6)
    for (const [i, d] of [...'999999'].entries()) await digits.nth(i).fill(d)
    await expect(page.getByText(/that code didn’t work/i).first()).toBeVisible()
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

// Admin two-factor codes are 6-digit authenticator codes (the API rejects anything else); customer codes stay 4.
test.describe('admin two-factor codes', () => {
  const paste = (locator: Locator, text: string) =>
    locator.evaluate((el, t) => {
      const dt = new DataTransfer()
      dt.setData('text', t)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, text)

  test('login asks for 6 digits, clears a wrong code and accepts a pasted "123-456"', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type=password]').fill(ADMIN.password)
    await page.locator('button[type=submit]').click()
    const digits = page.locator('input[aria-label^="Digit"]')
    await expect(digits).toHaveCount(6)
    await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled()

    await paste(digits.first(), '042 917')
    await expect(page.getByText('That code didn’t work. Enter the current code from your authenticator app.')).toBeVisible()
    await expect(digits.first()).toBeFocused()
    await expect(digits.first()).toHaveValue('')

    // A whole code pasted into any box fills from the first, dashes and spaces stripped.
    await paste(digits.nth(3), '123-456')
    await expect(page).toHaveURL(/\/admin\/?$/)
  })

  test('approving a payout with the code just used to sign in says to wait for the next one', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/finance/payouts')
    await page.getByRole('button', { name: 'Approve', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('input[aria-label^="Digit"]')).toHaveCount(6)
    await paste(dialog.locator('input[aria-label="Digit 1 of 6"]'), ADMIN.otp)
    await expect(dialog.getByText(/You just used this code\. Wait for the next code/)).toBeVisible()
  })

  test('an invited admin sets a password, enrols the authenticator and is signed in', async ({ page }) => {
    await page.goto('/admin/accept-invite?token=mock-invite-adm_5')
    await page.getByLabel('New password').fill('Wedpluz2026secure')
    await page.getByLabel('Confirm password').fill('Wedpluz2026secure')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Set up two-factor authentication' })).toBeVisible()
    await expect(page.getByAltText(/QR code to add Wedpluz admin/)).toBeVisible()
    await expect(page.locator('code')).toContainText('JBSW')
    await paste(page.locator('input[aria-label="Digit 1 of 6"]'), '123456')
    await expect(page).toHaveURL(/\/admin\/?$/)
  })

  test('an expired invitation explains what to do', async ({ page }) => {
    await page.goto('/admin/accept-invite?token=expired-token')
    await page.getByLabel('New password').fill('Wedpluz2026secure')
    await page.getByLabel('Confirm password').fill('Wedpluz2026secure')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible()
    await expect(page.getByText('This invitation is invalid or has expired.')).toBeVisible()
  })

  test('customer verification codes are still 4 digits', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.locator('input[type=email]').fill('johnbrown@gmail.com')
    await page.getByRole('button', { name: /send|continue|reset/i }).first().click()
    await expect(page.locator('input[aria-label^="Digit"]')).toHaveCount(4)
  })
})
