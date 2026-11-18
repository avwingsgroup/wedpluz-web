# Wedpluz backend handoff

This folder is the integration contract between the Wedpluz **web frontend** (public app at `wedpluz.com` and admin console at `admin.wedpluz.com`) and the **Laravel REST API** (`api.wedpluz.com`), which is being built separately.

> **Important.** Nothing here describes a backend that already exists. The frontend was built against typed service interfaces and a clearly labelled in-browser mock adapter. Every endpoint, payload, event and rule in this folder is a **contract proposal** for the backend team to confirm, adjust or reject.

## Documents

| Document | What it answers |
|---|---|
| [api-contracts.md](api-contracts.md) | Conventions (envelopes, pagination, money, idempotency, rate limits, CORS) and every endpoint by module, with auth, permission, status, request, response and domain errors. |
| [openapi.yaml](openapi.yaml) | Machine-readable OpenAPI 3.1 spec: 333 operations, full schemas and request/response examples. Use it for Swagger UI or Redoc, contract tests and client generation. |
| [data-model-requirements.md](data-model-requirements.md) | Entities, key columns, relationships, indexes and constraints implied by the contracts, for PostgreSQL. |
| [business-rules.md](business-rules.md) | Rules the backend must enforce: event lifecycle, inventory and checkout, payments, refunds, check-in, wallet ledger, settlements, moderation, deletion. |
| [authentication-and-permissions.md](authentication-and-permissions.md) | Customer and admin token model, refresh, 2FA, sessions, event-level roles, admin RBAC catalogue and default roles. |
| [realtime-events.md](realtime-events.md) | Channels, event names and payloads for messaging, notifications and live updates, plus the polling fallback. |
| [error-handling.md](error-handling.md) | Error envelope, HTTP status and error-code matrix, validation format, and how the frontend reacts to each. |
| [integrations.md](integrations.md) | Each external provider (Paystack, Stripe, PayPal, Monnify, ZeptoMail, Cloudinary, S3, Firebase, Google, WhatsApp, Primely, Termii, Twilio), what it is used for, the webhooks it sends, and which side owns which key. |

## Endpoint status

Every operation in `openapi.yaml` carries an `x-wedpluz-status` extension, and every table in `api-contracts.md` has a Status column.

| Status | Meaning | Count |
|---|---|---|
| `required` | A designed screen or flow cannot work without it. Needed for launch. | 274 |
| `optional` | The frontend calls it but degrades gracefully if it is missing (`404` or not deployed). Examples: search suggestions, related events, signed downloads, releasing a quote hold early. | 18 |
| `proposed` | Needs backend or product approval before implementation. Either the provider is not chosen (identity verification, live streaming, AI planner), the feature is not in the designs (ticket transfer, social feed and followers), or it is new infrastructure (realtime channel auth). | 41 |

Separately labelled:

- **External service webhooks** (`/webhooks/*`, tag *Webhooks (backend-only)*): inbound provider callbacks. No Wedpluz client calls them.
- **Realtime events**: documented in [realtime-events.md](realtime-events.md). They are not REST operations.

## How the frontend uses these contracts

- **Typed API layer.** `src/services/api/*.api.ts` holds one function per endpoint, and `src/types/*.ts` holds the request and response types. `openapi.yaml` is **generated from that code** (`npm run openapi:generate`), so the spec and the frontend cannot drift apart silently.
- **Mock adapter.** `src/services/mock` implements these contracts in the browser for development (`VITE_API_MODE=mock`). It is labelled on screen with a "Mock data" badge and is tree-shaken out of live builds. A production build refuses to compile with mock mode enabled. The mock exists for UI development; it does not show how the backend should be implemented. In particular, it accepts fixed development OTP and 2FA codes.
- **Switching to the real API** requires only `VITE_API_MODE=live` and `VITE_API_BASE_URL`. No component talks to fixtures directly.

## What the backend must own

The frontend is a presentation layer. These decisions are made **only** by the backend, and the frontend displays the result:

- Ticket availability, holds and seat assignment.
- Prices, fees, discounts and the payable total.
- Payment success (verified with the provider and by webhook).
- Refund eligibility and amount.
- Settlement, payout amounts and timing.
- Identity verification outcomes.
- Every authorization decision. Frontend permission checks are usability only.

## Open questions for the backend team

1. **Token technology.** Laravel Sanctum personal access tokens with a custom refresh endpoint, or Passport/JWT? The frontend expects `accessToken`, `refreshToken`, `expiresIn` and a rotate-on-refresh endpoint (see [authentication-and-permissions.md](authentication-and-permissions.md)).
2. **Realtime transport.** Laravel Reverb (Pusher protocol) is recommended. The web client adapter is ready to switch to `laravel-echo` once confirmed.
3. **Identity provider.** The brief names "Primely", subject to confirmation of the provider and API. The verification contract is provider-agnostic.
4. **Live streaming provider** for community live sessions (e.g. LiveKit, Agora, 100ms).
5. **AI provider** and quotas for Pluz Planner chat and design generation.
6. **Refund policy defaults** (window, service-fee refundability, organiser-cancelled events). [business-rules.md](business-rules.md) proposes defaults.
7. **Settlement timing and the payout rail** (Monnify or Paystack transfers) and whether payouts are automatic or always admin-approved.
8. **Ticket transfer** and the **social feed and followers** contracts are proposed but not designed. Are they in scope?

## Keeping this folder current

```bash
npm run openapi:examples   # optional: refresh captured examples from the mock fixtures
npm run openapi:generate   # regenerate openapi.yaml and the tables in api-contracts.md, then validate
npm run openapi:validate   # validate only
```

The generator lives in `scripts/openapi/`: endpoint summaries in `summaries.map.txt`, status, permission, idempotency and error-code metadata at the top of `generate.mjs`. The validator (`scripts/validate-openapi.mjs`) checks OpenAPI 3.1 structure, `$ref` resolution, path parameters, unique operation IDs and status markers. It also validates every example against its schema.
