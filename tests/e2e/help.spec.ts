import { expect, test } from '@playwright/test'
import { failOnPageErrors, loginAsUser } from './helpers'

test.describe('help and information pages', () => {
  test('help center search suggests answers and opens the right FAQ @mobile', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/help')
    await expect(page.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeVisible()
    await page.getByRole('combobox', { name: /search help/i }).fill('refund')
    const suggestions = page.getByRole('listbox', { name: 'Suggested answers' })
    await expect(suggestions.getByRole('option').first()).toBeVisible()
    await suggestions.getByRole('link', { name: /will i get a refund/i }).click()
    await expect(page).toHaveURL(/\/faqs#refund-eligibility$/)
    const question = page.getByRole('button', { name: 'Will I get a refund if I cancel?' })
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(/more than 48 hours before the event starts/i)).toBeVisible()
    assertNoErrors()
  })

  test('faq search filters, shares its query and shows an empty state', async ({ page }) => {
    await page.goto('/faqs')
    await expect(page.getByRole('heading', { level: 1, name: 'Frequently asked questions' })).toBeVisible()
    const search = page.getByRole('searchbox', { name: /search frequently asked questions/i })
    await search.fill('withdraw')
    await expect(page.getByText(/results? for “withdraw”/)).toBeVisible()
    await expect(page).toHaveURL(/q=withdraw/)
    await search.fill('xyzzy')
    await expect(page.getByRole('heading', { name: /no answers match/i })).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).first().click()
    await expect(page.getByRole('heading', { name: 'Tickets & payments', level: 2 })).toBeVisible()
  })

  test('terms show an outline and legal text even before the CMS is written', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/terms')
    await expect(page.getByRole('heading', { level: 1, name: 'Terms and conditions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The short version' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: '5. Cancellations and refunds' })).toBeAttached()
    // In-document links route inside the app.
    await page.getByRole('article').getByRole('link', { name: 'Privacy policy' }).first().click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeVisible()
    assertNoErrors()
  })

  test('about page presents the product and calls to action @mobile', async ({ page }) => {
    const assertNoErrors = failOnPageErrors(page)
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1, name: /bringing people together/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Everything for your event, in one place' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Explore events' }).first()).toBeVisible()
    assertNoErrors()
  })

  test('signed-in users can send a support request and see it listed', async ({ page }) => {
    await loginAsUser(page)
    await page.goto('/help#contact')
    await expect(page.getByRole('heading', { name: 'Send a request' })).toBeVisible()
    await page.getByLabel('Topic', { exact: true }).selectOption({ label: 'Tickets' })
    await page.getByLabel('Subject').fill('Ticket not received')
    await page.getByRole('textbox', { name: 'Message' }).fill('I paid for two tickets yesterday but only one arrived in my email.')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible()
    await expect(page.getByText('Ticket not received')).toBeVisible()
  })
})
