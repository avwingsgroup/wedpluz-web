# Frontend architecture

This document explains how the Wedpluz web codebase is structured, the decisions behind it, and the assumptions and gaps a maintainer should know about.

## 1. One codebase, two apps

```
                        ┌── VITE_APP_TARGET=web ───▶ dist/        → wedpluz.com
src/ (shared code) ─────┤
                        └── VITE_APP_TARGET=admin ─▶ dist-admin/  → admin.wedpluz.com
```

- `vite.config.ts` defines the build-time constant `__APP_TARGET__`. `src/router/index.ts` selects the route table from it:
  - The admin build gets only the admin routes, mounted at `/`.
  - The web build gets only the public routes.
  - The dev server gets both, with the console at `/admin`.
- Because the constant is static and pages are lazy-loaded, the other app's pages are removed from the bundle. Shipping the admin UI to the public domain would expose internal screens, endpoints and permission names, even though the API protects the data.
- Shared parts: the design system (`components/ui`), the HTTP layer, types, utilities and validation.

## 2. Layers and data flow

```
pages/            route components: compose modules, own page-level state
  └─ modules/     feature components (checkout, tickets, organizer, admin, …)
      └─ components/ui   design-system primitives (no API knowledge)
composables/      reusable logic: data loading, forms, URL state, realtime, media
stores/ (Pinia)   cross-page state: auth session, admin session, UI (toasts/dialogs), checkout draft, badges
services/api/     typed endpoint functions — the backend contract
services/http/    Axios client, interceptors, token stores, ApiError, request helpers
services/mock/    development fixtures behind an Axios adapter (never in live builds)
types/            request/response models shared by everything above
```

Rules the code follows:

- **Components never call Axios directly.** They call `services/api/*`, which call the `request` helpers. The helpers unwrap `{ data }` envelopes and return typed results.
- **UI primitives are API-agnostic.** For example, `UiDataTable`, `UiPagination` and `UiDrawer` receive data and emit events.
- **Types are the contract.** `src/types` and `src/services/api` define what the backend must provide. `npm run openapi:generate` turns them into `docs/backend-handoff/openapi.yaml`.

### 2.1 HTTP layer (`services/http`)

| Concern | Implementation |
|---|---|
| Base URL, timeouts | `client.ts`: base from `VITE_API_BASE_URL`, 30 s timeout, JSON headers, `X-Client-Platform`, `X-Client-Version` |
| Correlation | A new `X-Correlation-Id` UUID on every request, surfaced in `ApiError.correlationId` and Sentry |
| Auth header | `storeFor(url)` picks the **admin** token store for `/admin/*` and the customer store for everything else |
| Refresh | On a customer `401`, one shared `POST /auth/refresh`, then the original request is retried once. Concurrent failures wait on the same promise. |
| Session end | Admin `401`, a failed refresh, or `ACCOUNT_SUSPENDED` clear the right session and notify the store through a registered handler, so the HTTP layer never imports Pinia |
| Errors | `normalizeError` turns every failure into an `ApiError` with `status`, `code`, field `errors`, `isNetwork` and `isCancelled` |
| Cancellation | Request helpers accept `AbortSignal`. `useAsync` aborts the previous request when inputs change. |
| Validation | Request helpers accept an optional zod `schema` for runtime response checks: strict in development, logged in production |
| Mock mode | When `VITE_API_MODE !== 'live'`, the mock adapter is imported dynamically and attached to every request. The check uses the raw env constant so Vite removes the whole mock tree from live builds. |

### 2.2 Data loading patterns

| Pattern | Use | Where |
|---|---|---|
| `useAsync(fn, { watch, keepPreviousData })` | Page data that depends on route or filter state; abortable; exposes `data`, `loading`, `error`, `refresh` | most pages |
| `useQueryParams` + `usePaginatedTable` / `useAdminList` | Lists whose filters, sort and page live in the URL, so filtered admin views are shareable and survive reloads | admin tables, events, vendors, my events |
| `useInfiniteList` | "Load more" lists | my tickets, saved events and vendors, guests, activity log, wallet history, vendor works |
| TanStack Query (`useReferenceData`) | Shared, rarely-changing reference data cached across pages for 10 minutes: categories, interests, plans, public config | listings, pricing, settings, help |

TanStack Query is deliberately limited to reference data. Most page data is request-scoped and already covered by `useAsync`. Extending Query to more screens would be a change of pattern, not a quick drop-in.

### 2.3 State (Pinia)

| Store | Holds |
|---|---|
| `auth` | Customer user, session status, onboarding `pendingStep`, audience (individuals or businesses), redirect target. `bootstrap()` restores the session on load and clears it **only on a 401**, so offline users stay signed in. |
| `admin` | Admin user and permissions; `can()` and `canAny()` for UI gating. Separate token store. |
| `ui` | Toasts, a promise-based `confirm()`, and `prompt()` dialogs that require a reason for destructive admin actions. |
| `checkout` | Client-side draft only: quantities, attendee, seats, payment method, idempotency key and referral code. Prices and totals come from the server quote. |
| `badges` | Unread notification, request and message counts. Polled every 60 s and refreshed instantly by realtime events when a socket is configured. |

### 2.4 Routing and guards

- Route meta (`router/meta.ts`) declares `requiresAuth`, `guestOnly`, `roles`, `admin`, `permissions`, `layout` and `title`.
- `router/guards.ts` handles:
  - the session bootstrap, and the login redirect with `?redirect=`;
  - the onboarding gate (verify email, then profile setup, then interests);
  - role-gated areas;
  - admin authentication and **per-route permissions**: missing permissions send the admin to the dashboard with a toast;
  - page titles;
  - recovery from stale chunks after a deploy (one automatic reload).
- All pages are lazy-loaded.

### 2.5 Forms and validation

- `useForm` (composable) is backed by zod schemas in `src/validations`, which mirror the backend rules in the handoff docs. It validates on submit and on blur, maps Laravel `422` field errors onto the form, toasts other errors, and blocks double submission.
- **VeeValidate was not used.** Its zod adapter requires zod 3, and the project uses zod 4. A 120-line composable covers the needs without a compatibility shim.

### 2.6 Realtime

`composables/useRealtime.ts` wraps a native WebSocket with reconnect and backoff, and accepts Pusher-style frames. Components subscribe by event name (`useRealtimeEvent('message.created', …)`). With no `VITE_REALTIME_URL`, nothing connects and polling covers badges. Swapping in `laravel-echo` once the backend confirms Reverb is a one-file change. Channels and events are in [backend-handoff/realtime-events.md](backend-handoff/realtime-events.md).

## 3. Security measures in the frontend

- **No secrets in the bundle.** `.env.*` holds only publishable IDs. The env schema (`config/env.ts`) is validated with zod at startup.
- **Payments.** Provider-hosted checkout via backend-created intents. The client sends quantities and IDs, never prices. Payment-sensitive writes carry an `Idempotency-Key`. The return page asks the backend to verify; it never trusts redirect parameters.
- **Sessions.** Customer and admin tokens are stored under separate keys, and admin tokens are used only for `/admin/*`. Admin login requires 2FA; payout approval requires a fresh code.
- **Permissions in the UI are cosmetic.** Hidden buttons and route guards exist for usability. The API is documented as the enforcement point for every rule.
- **Untrusted content.**
  - Rich text renders only through `sanitizeRichText`, an allow-list of tags with links forced to `rel="noopener noreferrer nofollow"`.
  - Plain text is escaped.
  - ESLint forbids `v-html` except at the three sanitised sites, each annotated inline.
- **Uploads.** Client-side type and size checks for user feedback, while the backend re-validates by content.
- **CSV exports** neutralise spreadsheet formula injection.
- **Mock data is never silent.** It is excluded from live builds, blocked for production and staging builds, and always badged on screen.
- **Monitoring.** Sentry is lazy-loaded, sends no default PII, and strips the `Authorization` header.
- **The admin console** is not indexable (a robots meta tag, plus `X-Robots-Tag` at the host).

## 4. Performance

- Route-level code splitting. Long-cacheable vendor chunks (`vue`, `data`, `charts`, `sentry`). ECharts loads only on chart pages; Sentry and the QR library load lazily.
- Images use `loading="lazy"`, explicit dimensions and Cloudinary-friendly URLs, so responsive transformations can be requested once real assets exist.
- Skeleton states, `keepPreviousData` on filter changes, debounced search, and cancellation of superseded requests.
- Designed for low bandwidth: no web fonts beyond Manrope and Poppins, with `display=swap`, and no heavy UI framework. Tailwind 4 emits only the classes that are used.

## 5. Accessibility

- A skip-to-content link, landmark elements and a logical heading order.
- Focus-visible rings and keyboard support: Escape closes dialogs and drawers, and pagination is buttons with `aria-current`.
- `aria-live` toasts and scanner results; labelled icon buttons; accessible names on OTP inputs.
- `prefers-reduced-motion` disables non-essential animation.
- Colour tokens keep text contrast at WCAG AA on the brand purple (#9b119b) and plum (#270427) surfaces.

## 6. Admin console design (no designs supplied)

The console uses the public app's brand tokens and typography in a denser, data-first layout:

- **Shell.** A plum sidebar, filtered by permissions, with collapsible module groups. A top bar with global search across users, events and references, and the admin menu. It is responsive down to phone width; the sidebar becomes a drawer.
- **List pages** follow one recipe:
  1. `AdminPageHeader` with actions.
  2. `AdminFilterBar` with search, filter chips, a date range, an active-filter count and a reset.
  3. `UiDataTable` with sorting, selection and row click.
  4. `UiPagination` underneath.

  All filter state lives in the URL.
- **Detail pages** use a summary header with status badges, key-value panels, related tables and an activity or audit timeline.
- **Sensitive actions:**
  - Confirmation dialogs name the target.
  - Destructive actions (suspend, reject, hold, refund, payout rejection) require a typed reason, which the API stores in the audit log.
  - Payout approval asks for a 2FA code.
  - Controls are wrapped in `<Can perm="…">`.
- **Dashboard.** KPI tiles with period-over-period change, alerts, revenue and sign-up charts, top events, gateway health and recent admin activity, with 7D, 30D, 90D and 12M presets or a custom range.
- **Exports.** CSV client-side for the current view. Server-side CSV, XLSX or PDF jobs for full reports.

## 7. Assumptions and design gaps

| Topic | What was done | Needs |
|---|---|---|
| **Imagery** | The design handoff contains 475 full-screen PNG mockups and 3 PDFs, but no exported photography or illustration assets. Marketing images and fixture photos use placeholder services (picsum.photos, i.pravatar.cc), referenced centrally in `src/assets/illustrations/index.ts` and in mock fixtures. | Brand photography and illustrations exported from the source design files, served from Cloudinary. Then remove the placeholder hosts from the CSP. |
| **Admin console** | Designed from scratch, as described in §6. | Design review if a design system for internal tools exists. |
| **Identity verification** | Provider-agnostic flow (ID number plus selfie). The brief names "Primely", pending confirmation. | Provider confirmation and API details. |
| **Live streaming** | UI and contract for community live sessions; `joinToken` is the provider room token. | SFU or media provider decision (LiveKit, Agora, 100ms…). |
| **Pluz Planner AI** | Chat, menus, hall layouts and design generation UI plus contracts, all marked *proposed*. | AI provider, quotas and costs. |
| **Refund policy** | The UI shows backend outcomes. Defaults are proposed in business-rules.md. | Product sign-off. |
| **Ticket transfer** | Supported in the ticket menu; contract *proposed*. | Confirmation that it is in scope (not in the designs). |
| **Social feed, posts, followers** | Not in the designs. Contracts proposed in the OpenAPI spec for completeness; no UI built. | Product decision. |
| **Promoter attribution** | Share links carry `?ref=CODE`, which is captured per event for the session and sent as `referralCode` on the checkout quote. | Backend attribution rules (business-rules.md). |
| **Payments UI** | Hosted checkout redirect for every provider; the mock adapter simulates the gateway. | Provider sandbox accounts and return-URL registration. |
| **Timezone and currency** | Display defaults to Africa/Lagos (WAT) and NGN; money is integer kobo. | Confirm multi-currency scope for international events. |
| **Web push** | `POST /me/devices` contract and env placeholder; not enabled. | Firebase web config and a VAPID key when wanted. |

## 8. Decisions log

| Decision | Reason |
|---|---|
| One repo, two builds selected by a build-time constant | Shared design system and contract, without shipping admin code to the public domain. |
| Separate customer and admin token stores | An admin signing in on a shared machine never overwrites or leaks a customer session, and vice versa. |
| Typed mock adapter instead of MSW or a mock server | Runs in the browser and in Vitest unchanged, implements business rules (quotes, holds, check-in outcomes) for realistic UI work, and is excluded from live bundles. |
| OpenAPI generated from TypeScript | The contract handed to the backend always matches what the frontend calls. Examples are validated against schemas. |
| Hosted checkout only | Keeps PCI scope with the providers and avoids loading four payment SDKs. Inline SDKs can be added later behind the same `PaymentIntent`. |
| Custom `useForm` over VeeValidate | Zod 4 compatibility; small surface area. |
| TanStack Query limited to reference data | Caching where it pays off, without two competing patterns across every screen. |
| Tailwind 4 with `@theme` tokens | Brand tokens in one CSS file; no runtime CSS-in-JS. |
| lucide icons (1.0 naming) | Consistent stroke icons matching the designs. Note the renamed icons (`TriangleAlert`, `CircleCheck`, `LoaderCircle`, …). |
