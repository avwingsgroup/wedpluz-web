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

  test('the sign-up carousel shows the onboarding banners from the API (slides, captions and dots follow the API)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/auth/signup')
    const carousel = page.getByRole('region', { name: 'Wedpluz highlights' })
    await expect(carousel.getByRole('heading', { name: 'Let the Experience Find You' })).toBeVisible()
    await expect(carousel.getByRole('button', { name: /^Show slide/ })).toHaveCount(3)
    await carousel.getByRole('button', { name: 'Show slide 3: Show Your Work' }).click()
    await expect(carousel.getByRole('heading', { name: 'Show Your Work' })).toBeVisible()

  })

  test('Google sign-in (redirect flow) returns to the requested page @mobile', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/tickets')
    await expect(page).toHaveURL(/\/auth\/login/)
    await page.getByRole('button', { name: 'Log in with Google' }).click()
    // Mock mode stands in for Google: GET /auth/google/redirect → /auth/google/callback?code&state → POST /auth/social.
    await expect(page).toHaveURL(/\/tickets$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    assertNoErrors()
  })

  test('Google callback explains a cancelled or expired sign-in and offers a way back', async ({ page }) => {
    await page.goto('/auth/google/callback?error=access_denied')
    await expect(page.getByRole('heading', { name: 'Google sign-in cancelled' })).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/google\/callback$/) // query stripped
    await expect(page.getByRole('link', { name: 'Log in with email instead' })).toBeVisible()

    await page.goto('/auth/google/callback?code=forged&state=not-issued')
    await expect(page.getByRole('heading', { name: 'Couldn’t sign in with Google' })).toBeVisible()
    await expect(page.getByText('Your Google sign-in expired. Please try again.')).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/google\/callback$/)
  })
})

test.describe('profile setup phone number', () => {
  test.use({ timezoneId: 'Europe/London', locale: 'en-US' })

  test('defaults the country to where the visitor is, tidies the number and validates its length', async ({ page }) => {
    await page.goto('/auth/signup')
    await page.getByRole('button', { name: 'Sign up with Email' }).click()
    await page.getByLabel('First Name').fill('Ada')
    await page.getByLabel('Last Name').fill('Obi')
    await page.getByLabel('Email address').fill(`ada.${Date.now()}@example.com`)
    await page.getByLabel('Date of Birth').fill('1995-04-12')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm password').fill('password123')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/verify-email/)
    await page.locator('input[inputmode=numeric], input[autocomplete=one-time-code]').first().click()
    await page.keyboard.type('1234')
    await expect(page).toHaveURL(/profile-setup/)

    // London time zone with an en-US browser → United Kingdom, not the US.
    const country = page.getByRole('button', { name: /^Country code:/ })
    await expect(country).toHaveAttribute('aria-label', /United Kingdom \+44/)

    // Switch to Nigeria by searching the calling code; a too-short number explains the rule.
    await country.click()
    await page.getByRole('combobox', { name: 'Search countries' }).fill('234')
    await page.keyboard.press('Enter')
    await expect(country).toHaveAttribute('aria-label', /Nigeria \+234/)
    const phone = page.getByLabel('Phone number (optional)')
    await page.getByLabel('Username').fill(`ada${Date.now() % 100000}`)
    await phone.fill('0801 234 567')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Nigeria numbers have 10 digits after +234')).toBeVisible()

    await phone.fill('0801 234 5678')
    await phone.blur()
    await expect(phone).toHaveValue('801 234 5678')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/interests/)
  })
})
