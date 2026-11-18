# Testing

| Layer | Tool | Location | Command |
|---|---|---|---|
| Unit and component | Vitest 5, Vue Test Utils, jsdom | `tests/unit/**/*.spec.ts` | `npm test`, `npm run test:watch`, `npm run test:coverage` |
| End-to-end | Playwright | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| Static | vue-tsc (strict), ESLint | whole repo | `npm run typecheck`, `npm run lint` |
| Contract | OpenAPI validator | `docs/backend-handoff/openapi.yaml` | `npm run openapi:validate` (also runs inside `npm test`) |

All tests run against the **mock API adapter**, so they need no backend, network access or provider credentials.

## Unit and component tests

| Area | Spec | What it pins down |
|---|---|---|
| Formatting | `utils/format.spec.ts` | Money in kobo to naira (compact K and M), design date copy ("7th Dec, 2026", ranges), text helpers |
| Sanitising | `utils/sanitize.spec.ts` | Rich-text allow-list: scripts, event handlers, `javascript:` links and styles are stripped; safe links are hardened |
| Files | `utils/files.spec.ts` | Upload MIME and size validation; CSV formula-injection guard for admin exports |
| Validation | `validations/schemas.spec.ts` | Registration, password rules, age gate, username, wallet withdrawal minimum and PIN, NUBAN account numbers, event schedule rules |
| HTTP errors | `services/errors.spec.ts` | Laravel error envelope to `ApiError`: field errors, domain codes, correlation IDs, network and cancel cases |
| Token storage | `services/tokenStorage.spec.ts` | Customer and admin sessions are isolated; `/admin/*` routing; expiry handling |
| Mock contract | `services/mock-contract.spec.ts` | Response envelopes, error codes, admin 2FA and token audience, server-computed checkout totals, promo errors, double-cancel conflict, audit logging |
| Checkout store | `stores/checkout.store.spec.ts` | Line inputs, server-driven steps (seats, menu), seat caps, fresh idempotency keys, promoter referral capture |
| Admin store | `stores/admin.store.spec.ts` | `can` and `canAny` permission helpers (usability layer) |
| Forms | `composables/useForm.spec.ts` | Zod validation, transforms, Laravel 422 mapping, toasts, double-submit guard, reset |
| Components | `components/UiButton.spec.ts`, `components/UiPagination.spec.ts` | Loading and disabled states, safe external links, router links, OTP input and paste, pagination ranges and accessibility |
| Handoff spec | `docs/openapi.spec.ts` | The spec validates; every operation has a status; every admin operation has a permission and admin auth; payment writes need `Idempotency-Key`; webhooks are backend-only |

### Windows note

`npm test` runs Vitest through `scripts/vitest.mjs`. Some Windows shells start Node with a lowercase drive letter (`c:\`), which makes Vitest load two copies of its runner, and every suite then fails with "Cannot read properties of undefined (reading 'config')". The launcher normalises the drive letter. Calling `npx vitest` directly from such a shell can show that error.

## End-to-end tests

| Spec | Scenarios |
|---|---|
| `discovery.spec.ts` | Home sections and the mock badge; events list to detail; event facts; vendor marketplace to profile; 404; guests redirected to login with `redirect` |
| `auth.spec.ts` | Wrong-password error from the API; client-side email validation; login returns to the requested page and the **session survives a reload** |
| `checkout.spec.ts` | Full paid checkout: tickets, attendee, server-quoted total, Paystack hosted redirect (mock gateway), verified return page; ticket QR rendering |
| `organizer.spec.ts` | Managed events list and overview; server-side ticket validation at check-in (manual code); create-event wizard |
| `admin.spec.ts` | Password then 2FA login; wrong 2FA rejected; a customer session cannot open the console; search kept in the URL; finance pages; no horizontal scroll on phones |

Projects: `chromium` (desktop, all tests) and `mobile` (Pixel 7, tests tagged `@mobile`). The main flow tests also fail on uncaught page errors.

### Running

```bash
npx playwright install chromium     # once
npm run test:e2e                    # starts `npm run dev` on port 5173 in mock mode
```

Overrides:

| Variable | Use |
|---|---|
| `E2E_PORT=5180` | Start the dev server on another port |
| `E2E_BASE_URL=http://localhost:5180` | Test an already-running dev server (no server is started) |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome` | Use a specific Chromium build, e.g. when the bundled browser version does not match |

Reports and traces land in `playwright-report/` and `test-results/` (both git-ignored). CI retries failures twice and records a trace on the first retry.

## Manual QA checklist (live API)

Mock tests cannot cover these; run them on staging once the backend is available:

- [ ] Paystack, Stripe, PayPal and Monnify sandbox payments: success, failure, abandoned payment, webhook arriving before and after the redirect.
- [ ] Refund round trip to each provider; wallet refunds.
- [ ] Two scanners checking in the same ticket at once: exactly one succeeds.
- [ ] Token refresh after access-token expiry with several requests in flight.
- [ ] Admin permissions: an admin without a permission gets `403` from the API even when calling endpoints directly.
- [ ] Realtime: messages and notification badges update without reload once Reverb is enabled.
- [ ] Email, SMS, WhatsApp and push templates render with real data.
- [ ] Lighthouse on a mid-range Android over throttled 3G: home, events and event detail.

## Results at handoff

| Check | Result |
|---|---|
| `npm run typecheck` | passing |
| `npm run lint` | passing (0 problems) |
| `npm test` | 13 files, 107 tests passing |
| `npm run test:e2e` | 24 tests passing (20 desktop, 4 mobile) |
| `npm run openapi:validate` | valid OpenAPI 3.1.0: 333 operations, 1,640 examples checked against their schemas |
