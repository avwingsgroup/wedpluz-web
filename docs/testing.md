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

## Live API checks

`npm run test:api` calls a running Laravel API as a guest and as a newly registered customer. It validates every status code and response body against `docs/backend-handoff/openapi.yaml`.

```bash
npm run test:api -- https://wedpluz-api.test/api/v1        # local Laragon API
API_BASE_URL=https://api-staging.wedpluz.com/api/v1 npm run test:api
```

- Each run registers one throwaway account (`qa.frontend.<timestamp>@wedpluz.test`). The script refuses to run against `api.wedpluz.com`.
- It covers the public catalogue, CMS pages, registration, login, refresh rotation and reuse detection, logout, profile and settings, sessions, saved items, tickets, notifications, messaging, communities, organizer and planner lists, the email-verification gate, and token-audience separation.
- Checkout, organizer writes, the wallet and the admin console need a verified customer or an admin account, so this script does not cover them.

To run the web app against the local API, create `.env.development.local` (git-ignored):

```bash
VITE_API_MODE=live
VITE_API_BASE_URL=https://wedpluz-api.test/api/v1
VITE_WEB_ORIGIN=http://localhost:5174
```

Then start it with `npm run dev -- --port 5174`. The backend's local CORS list allows only ports 5173 and 5174.

### Results against the local API (19 Nov 2026)

| Check | Result |
|---|---|
| Route coverage | All 317 operations the frontend calls exist on the backend, with matching admin permissions. The 12 proposed social endpoints are not implemented. |
| `npm run test:api` | 71/71 passing |
| Live browser smoke (32 pages, guest and signed in, sign-up through the UI) | No page or console errors. All failing API calls were expected (404, wrong password, unverified wallet). |

Fixes made from the run:

- `UserSummary.username` is now nullable, because it stays null until profile setup.
- The health check may return `degraded`.
- The email-verification `403` now offers a "Verify email" button. `EMAIL_UNVERIFIED` is proposed as a dedicated error code.

Not covered yet:

- **Checkout, events and wallet.** These need a verified email. The backend sends codes through ZeptoMail, and no development code (`AUTH_DEV_FIXED_OTP`) is set.
- **Admin console.** The database has no admin account yet.

**Local environment issue.** On Laragon's Apache with mod_php, Windows threads can lose `.env` values when config is not cached. Under parallel requests, `env('APP_ENV')` then falls back to `production`, the localhost CORS origins vanish, and the browser blocks some calls. In a burst of 30 parallel preflights, 19 failed. To fix it, run `php artisan config:cache` in the API (re-run it after changing `.env`), or switch Laragon to Nginx.

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
