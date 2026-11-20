# Wedpluz Web

The Wedpluz web platform has two deployables, built from one Vue 3 + TypeScript codebase:

| App | Domain | What it is |
|---|---|---|
| **Public web app** | `https://wedpluz.com` | Event discovery, ticketing and checkout with QR tickets, refunds, communities and messaging, vendor marketplace, accounts, wallet and premium, organizer and vendor portal, Pluz Planner. Built from the design handoff in `docs/Wedpluz Web Designs`. |
| **Admin console** | `https://admin.wedpluz.com` | Executive dashboard, users, events, organizers and vendors, bookings, finance (settlements, payouts, refunds, commissions), moderation, notifications, platform configuration, RBAC and audit, reports and exports. Designed from scratch; no designs were supplied. |

Both talk to the Laravel REST API at `https://api.wedpluz.com/api/v1`, which is developed separately. The integration contract is in **[docs/backend-handoff](docs/backend-handoff/README.md)**.

## Quick start

Requires Node.js 20.19+ (or 22.12+) and npm 10+.

```bash
npm install
npm run dev          # public app on http://localhost:5173 (admin console at /admin)
npm run dev:admin    # admin console alone on http://localhost:5174
```

Development runs in **mock mode** by default (`VITE_API_MODE=mock` in `.env.development`). A typed in-browser mock adapter serves realistic fixtures, so no backend is needed. A "Mock data" badge is always visible in this mode.

| Mock sign-in | Value |
|---|---|
| Customer | `johnbrown@gmail.com` with any password of 6+ characters (`wrongpass` simulates a failure) |
| Admin | `admin@wedpluz.com` with any password of 6+ characters, 2FA code `1234` |
| OTP and wallet PIN codes | `1234` |

These codes exist only in the mock adapter, which is excluded from live builds.

To develop against a real API, create `.env.development.local`:

```bash
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:admin` | Vite dev server for the public app (plus `/admin`) or the admin console alone |
| `npm run build` | Typecheck and build the public app for production into `dist/` |
| `npm run build:staging` | Same, using `.env.staging` |
| `npm run build:admin` / `build:admin:staging` | Build the admin console into `dist-admin/` |
| `npm run preview` | Serve the last build locally |
| `npm run typecheck` | `vue-tsc` in strict mode |
| `npm run lint` / `lint:fix` | ESLint (TypeScript, Vue) |
| `npm test` / `test:watch` / `test:coverage` | Vitest unit and component tests |
| `npm run test:e2e` | Playwright end-to-end tests (desktop Chromium plus a Pixel 7 smoke project) |
| `npm run openapi:generate` | Regenerate `docs/backend-handoff/openapi.yaml` and the API tables from the typed API layer, then validate |
| `npm run openapi:validate` | Validate the OpenAPI spec, including every example against its schema |

Production and staging builds **refuse to compile in mock mode**. See [docs/deployment.md](docs/deployment.md).

## Stack

Vue 3.5 (Composition API, `<script setup>`), TypeScript 6 in strict mode, Vite 8, Vue Router 5, Pinia, Tailwind CSS 4, Axios, TanStack Vue Query, VueUse, Zod, ECharts (vue-echarts), Sentry, Vitest and Vue Test Utils, Playwright. Icons come from lucide. QR codes are generated locally with `qrcode`. Dates use `date-fns`.

## Project layout

```
src/
  app/            entry (main.ts), root App.vue, Sentry setup
  config/         validated environment (env.ts) and app constants
  router/         web and admin route tables, guards, typed meta
  layouts/        PublicLayout, AuthLayout, AdminLayout
  pages/          one component per route (public, account, organizer, planner, admin/*)
  modules/        feature components: checkout, tickets, events, vendors, messaging, organizer, admin, ...
  components/     design-system primitives (ui/*), feedback (toasts, dialogs), layout, brand
  composables/    useForm, useAsync, useQueryParams, usePaginatedTable, useInfiniteList, useRealtime, ...
  stores/         Pinia: auth, admin, ui, checkout, badges
  services/
    http/         Axios client, token stores, error normalisation, typed request helpers
    api/          one typed module per backend area (the contract the backend implements)
    mock/         development-only fixtures and handlers (tree-shaken from live builds)
  types/          request and response types shared by services, stores and UI
  validations/    Zod schemas mirroring backend validation
  utils/          formatting (money in kobo, dates), sanitising, files, SEO
tests/
  unit/           Vitest: utils, validations, HTTP layer, stores, composables, components, mock contract, OpenAPI
  e2e/            Playwright: discovery, auth, checkout, organizer check-in, admin
docs/
  backend-handoff/          API contracts, OpenAPI 3.1, data model, business rules, auth and RBAC, realtime, errors, integrations
  frontend-architecture.md  how the app is put together and why
  deployment.md             environments, builds, hosting, headers
  testing.md                test strategy and how to run it
scripts/          OpenAPI generator and validator, Vitest launcher
```

## Key principles

- **The backend decides.** Prices, availability, payment success, refund eligibility, settlement, identity outcomes and every permission are decided by the API. The UI displays what it returns. Admin permission checks in the console are a usability layer only.
- **No secrets in the browser.** Only publishable identifiers live in `VITE_*` variables (see `.env.example`). Payments use provider-hosted checkout through backend-created intents.
- **Mock data is never silent.** The fixture adapter is opt-in, always labelled on screen, excluded from live bundles, and blocked from production and staging builds.
- **Contract first.** `src/services/api` plus `src/types` are the contract. The OpenAPI spec is generated from them, so the frontend and the backend handoff cannot drift silently.

## Documentation

- [Backend handoff](docs/backend-handoff/README.md): start here if you build the API.
- [Frontend architecture](docs/frontend-architecture.md): structure, data flow, decisions, assumptions and design gaps.
- [Deployment](docs/deployment.md): environments, build commands, hosting both domains, security headers.
- [Testing](docs/testing.md): what is covered and how to run it.
- [SEO](docs/seo.md): metadata, structured data, sitemaps, link previews and the backend work for event and vendor visibility.
