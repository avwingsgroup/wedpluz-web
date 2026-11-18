# External integrations

> Contract proposal. The brief lists these providers. **Verify each provider's current product names, APIs, pricing and regional availability before implementation.** Some names in the brief need confirmation, notably "Primely" for identity verification. The brief also asks that integrations stay configurable and replaceable, so each one below sits behind a backend interface (`PaymentGateway`, `SmsSender`, `IdentityVerifier`, …) selected by configuration.

## 1. Key ownership

The frontend holds **only publishable identifiers**. Every secret lives in the backend environment or a secrets manager, and is never returned by any API, including `/config` and `/admin/settings`.

| Provider | Browser (frontend env) | Backend only |
|---|---|---|
| Paystack | `VITE_PAYSTACK_PUBLIC_KEY` (reserved for an optional inline popup) | secret key (API calls and webhook HMAC) |
| Stripe | `VITE_STRIPE_PUBLISHABLE_KEY` (reserved for optional Stripe Elements) | secret key, webhook signing secret |
| PayPal | `VITE_PAYPAL_CLIENT_ID` (reserved for optional PayPal Buttons) | client secret, webhook ID |
| Monnify | none | API key, secret key, contract code, wallet account number |
| Google Sign-In | `VITE_GOOGLE_CLIENT_ID` (public OAuth client ID) | none needed to verify ID tokens beyond the client ID (audience check) |
| Google Maps | `VITE_GOOGLE_MAPS_API_KEY` (restrict to HTTP referrers and the Maps Embed API in Google Cloud) | none |
| Firebase (FCM) | `VITE_FIREBASE_CONFIG_JSON` (public web config, VAPID public key) | service account JSON (sending) |
| Cloudinary | none (signed uploads come from `POST /uploads/sign`) | API key, API secret |
| Amazon S3 | none (pre-signed URLs only) | IAM access key and secret, or an instance role |
| ZeptoMail | none | send mail token |
| WhatsApp Business (Cloud API) | none | permanent access token, phone number ID, app secret, webhook verify token |
| Termii | none | API key, sender ID |
| Twilio | none | account SID, auth token, messaging service SID |
| Primely (identity) | none | API credentials (to be confirmed) |
| Sentry | `VITE_SENTRY_DSN` (public DSN) | auth token for source-map upload, used in CI only |
| Reverb (realtime) | `VITE_REALTIME_URL`, `VITE_REALTIME_KEY` (public app key) | app secret |

Today, payments use **hosted checkout only**. `POST /orders` returns `PaymentIntent.authorizationUrl` and the browser redirects to it. No payment SDK loads in the browser, so PCI scope stays with the providers.

## 2. Payments

### 2.1 Common flow

```
Client ── POST /checkout/quotes ─▶ API  (price + hold)
Client ── POST /orders (Idempotency-Key) ─▶ API ── initialise transaction ─▶ Provider
Client ◀─ { order, payment.authorizationUrl } ─ API
Client ── redirect ─▶ Provider hosted page ── redirect back ─▶ /checkout/return?order=…&reference=…
Client ── POST /orders/{id}/verify-payment ─▶ API ── verify transaction ─▶ Provider
Provider ── webhook ─▶ API /webhooks/{provider}   (authoritative, may arrive before or after verify)
```

Rules that apply to every provider:

- **Amounts come from the server-side quote**, never from the client. Initialise the provider transaction with the order total and currency, and set your own `reference`, which is `Order.reference`.
- **Verify before fulfilling.**
  - On verify-payment and on webhook, re-query the provider by reference and check status, amount, currency and reference.
  - Fulfil by issuing tickets and confirming the order inside a database transaction with a row lock on the order.
  - Make the step idempotent, because verify and webhook race.
- **Never trust the redirect query string** (`status=success` etc.) on its own.
- Store the provider's transaction ID, fees and raw payload (redacted) on the `Payment` record for reconciliation.
- Expire unpaid orders when the quote hold ends (default 10 minutes) and release inventory; a scheduled job handles abandoned checkouts.
- Refunds go through the provider of the original payment. Wallet payments refund to the wallet.

### 2.2 Provider notes

| Provider | Use | Initialise | Verify | Webhook verification | Refund | Payout |
|---|---|---|---|---|---|---|
| **Paystack** | Primary NGN card, bank transfer and USSD | `POST /transaction/initialize` returns `authorization_url` | `GET /transaction/verify/{reference}` | HMAC-SHA512 of the raw body with the secret key compared to `x-paystack-signature`; optionally allow-list Paystack IPs | `POST /refund` | Transfers API (`transfer.success`, `transfer.failed`) |
| **Monnify** | NGN payments, bank transfer, payouts | `POST /api/v1/merchant/transactions/init-transaction` returns `checkoutUrl` | `GET /api/v2/transactions/{transactionReference}` | HMAC-SHA512 of the raw body with the client secret compared to `monnify-signature` | Refund API | Disbursements API (single or bulk) for organiser payouts and wallet withdrawals |
| **Stripe** | International cards (USD, GBP, EUR) | Checkout Session (hosted) returns `url` | Retrieve Checkout Session or PaymentIntent | `Stripe-Signature` via the SDK `constructEvent` with the endpoint secret, 5-minute tolerance | Refunds API | not used for NGN payouts |
| **PayPal** | International payers | Orders v2 `POST /v2/checkout/orders` returns the `approve` link | Capture `POST /v2/checkout/orders/{id}/capture` on return, then read status | `POST /v1/notifications/verify-webhook-signature` | Captures refund API | not used |
| **Wallet** | Internal balance | none (ledger debit inside the order transaction) | immediate | n/a | ledger credit | withdrawals via Monnify or Paystack transfers |

Which providers appear at checkout is controlled by `PlatformSettings.payments.enabledProviders`, exposed publicly through `GET /config`. Choose the provider per currency on the backend. The client sends a `paymentMethod`, and the backend may reject a combination with `422`.

### 2.3 Payment webhooks

Endpoints: `POST /webhooks/paystack`, `/webhooks/monnify`, `/webhooks/stripe`, `/webhooks/paypal`, all `required` in `openapi.yaml`.

1. Read the **raw** body. Verify the signature, and return `401` if it fails.
2. Look up `webhook_events (provider, provider_event_id)`. If seen, return `200` immediately.
3. Store the event, queue a job, and return `200` within 2 seconds.
4. The job resolves the order, payout, refund or subscription by reference and applies the state transition idempotently. Then it emits realtime and notification events.
5. Alert (admin `SystemAlert`) on repeated signature failures or amount mismatches.

Events to handle are listed per provider in `openapi.yaml` under *Webhooks (backend-only)*.

## 3. Communication

| Provider | Purpose | Notes |
|---|---|---|
| **Zoho ZeptoMail** | Transactional email: OTPs, ticket confirmations with PDF and QR, receipts, password reset, invites, campaign email | Send from queued jobs. Use templates matching `NotificationTemplate.key`. Handle bounce and complaint webhooks (`/webhooks/zeptomail`, optional) to suppress bad addresses. Configure SPF, DKIM and DMARC on the sending domain. |
| **Termii** | Primary SMS (OTP and alerts in Nigeria) | DND-safe route for OTPs. Sender ID registration takes time; start early. Delivery reports via `/webhooks/termii` (optional). |
| **Twilio** | Backup SMS; optionally Verify | Fail over from Termii on error or timeout. `X-Twilio-Signature` validation on status callbacks. |
| **WhatsApp Business (Meta Cloud API)** | Ticket delivery, reminders, campaign messages where the user opted in | Pre-approved templates only for business-initiated messages. Verify `X-Hub-Signature-256`. `GET /webhooks/whatsapp` handshake. Respect `NotificationPreference.channels.whatsapp`. |
| **Firebase Cloud Messaging** | Push to Android, iOS and web | Web registers via `POST /me/devices { token, platform: web }` (optional until web push is enabled). Remove tokens on `UNREGISTERED` errors. |

Channel selection: build a `NotificationDispatcher` that takes a notification type and user. It checks the user's preferences and the channel availability, then fans out to queued channel jobs. In-app (database) notifications are always stored and power `GET /notifications`.

## 4. Media and storage

| Provider | Stores | Notes |
|---|---|---|
| **Cloudinary** | Public images and video: event covers and galleries, avatars, vendor works, statuses, message media | Use upload presets per `purpose` with size and format limits and auto-format and quality. Return delivery URLs with transformations (`f_auto,q_auto,w_…`) so the web app can request responsive sizes. Signed uploads via `POST /uploads/sign` (optional). Moderation add-ons are optional. |
| **Amazon S3** | Private files: identity selfies and documents, verification documents, report exports, ticket PDFs, receipts | Block public access. Serve via pre-signed GET URLs (15 min). Enable SSE (KMS) on identity buckets. Set lifecycle rules: exports 7 days, abandoned uploads 24 hours. |

## 5. Identity verification (Primely, pending confirmation)

The brief lists "Primely" for identity verification, *subject to confirmation of provider and API*. The contract is provider-agnostic:

1. The client uploads a selfie (`purpose: identity_selfie`) and calls `POST /me/identity-verification { idType, idNumber, selfieUploadId }`.
2. The backend creates `IdentityVerification(status: pending)` and calls the provider, for example NIN lookup plus face match.
3. The result arrives synchronously or via `POST /webhooks/primely` (`proposed`). The status becomes `verified` or `failed`, with a `failureReason`. A `identity.updated` realtime event and a notification are sent.
4. `User.identityStatus` mirrors the latest verification.

Store only what is needed: provider reference, status and match score. Do not store full NIN records. Encrypt `idNumber` at rest. Treat this as sensitive personal data under the NDPA (Nigeria Data Protection Act).

Alternatives if Primely is not confirmed: Prembly (Identitypass), Smile ID, Dojah, VerifyMe. All support NIN and face match, so the interface stays the same.

## 6. Authentication

**Google Sign-In.** The web app uses Google Identity Services to obtain an ID token (JWT) and sends it to `POST /auth/social { provider: google, idToken }`. The backend verifies the signature (Google certs), `aud` (the web client ID plus the Android and iOS client IDs), `iss`, `exp` and `email_verified`. It then links or creates the user. Never accept a Google access token or profile JSON from the client as proof of identity.

## 7. Monitoring and other tools

| Tool | Status | Purpose |
|---|---|---|
| Sentry | in the frontend (`VITE_SENTRY_DSN`) | Frontend errors and performance. `sendDefaultPii` is off. Requests are tagged with `X-Correlation-Id`. Recommended on the backend too (`sentry/sentry-laravel`). |
| Laravel Horizon | proposed | Queue monitoring for webhooks, notifications and exports. |
| Laravel Reverb | proposed | Realtime; see [realtime-events.md](realtime-events.md). |
| Media/SFU provider (LiveKit, Agora, 100ms) | proposed, decision needed | Community live sessions. `POST /live/{id}/join` returns that provider's room token. |
| AI provider | proposed, decision needed | Pluz Planner chat and design generation. Enforce per-plan quotas server-side. |

## 8. Configuration and replaceability

- Configure each provider through `config/services.php` and environment variables only. Toggle providers at runtime with `PlatformSettings.payments.enabledProviders` and `features.*`.
- Keep provider-specific payloads out of public resources. `PaymentIntent.clientParams` may carry only public values, such as a public key or an access code, when an inline SDK is used.
- Write a fake implementation of each interface for tests. Contract tests can use `openapi.yaml`.
