# Error handling

> Contract proposal. This describes the error format the Wedpluz web app and admin console parse, and the behaviour each error triggers. The mobile apps should rely on the same format.

## 1. Error envelope

Every non-2xx JSON response uses this body (`ApiErrorBody` in `openapi.yaml`):

```json
{
  "message": "Only 2 Regular tickets are left.",
  "code": "TICKETS_UNAVAILABLE",
  "errors": { "lines.0.quantity": ["Only 2 left."] },
  "correlationId": "6f1c2b8e-0f8a-4f7e-9d0e-3b1f2a7c9d11"
}
```

| Field | Required | Rules |
|---|---|---|
| `message` | yes | Plain-language sentence that is **safe to show to end users**. No SQL, class names, stack traces or provider error dumps. |
| `code` | yes | Machine-readable code from §3. Clients branch on `code`, never on `message`. New codes may be added, and clients treat unknown codes by HTTP status. |
| `errors` | for `422` | Field path to a list of messages. Use dotted paths matching the request body: `attendee.email`, `lines.0.quantity`, `schedules.1.startsAt`. |
| `correlationId` | recommended | Echo of the `X-Correlation-Id` request header, or a server-generated ID. Also return it as a response header. Support staff ask users for it. |

Laravel implementation note: register a renderer in `bootstrap/app.php` (`withExceptions`) that maps `ValidationException` to 422 `VALIDATION_ERROR`, `AuthenticationException` to 401, `AuthorizationException` to 403, `ModelNotFoundException` and `NotFoundHttpException` to 404, `ThrottleRequestsException` to 429, and domain exceptions to their codes. In production, everything else becomes 500 `SERVER_ERROR` with a generic message. Never return HTML or redirects from `/api/*`.

## 2. Validation errors (422)

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/json
X-Correlation-Id: 21077ae4-bb0a-4d39-929a-98c87022457d
```
```json
{
  "message": "Please check the highlighted fields.",
  "code": "VALIDATION_ERROR",
  "errors": {
    "firstName": ["The first name field is required."],
    "dateOfBirth": ["You must be at least 13 years old."],
    "password": ["The password must be at least 8 characters and include a letter and a number."]
  },
  "correlationId": "21077ae4-bb0a-4d39-929a-98c87022457d"
}
```

- Keys must use the **request field names** (camelCase), not database column names. Map with `attributes()` or a custom validator message bag.
- Messages are user-facing. Use human attribute names ("first name", not `first_name`).
- Domain validation that is not tied to a field may still use 422 with a domain `code` and an empty or absent `errors` (for example `OTP_INVALID`, `PROMO_INVALID`).
- The frontend validates with zod before sending, with rules mirrored in `src/validations`. Server validation is still authoritative, and its messages override client messages on the same field.

## 3. Status and code matrix

| HTTP | `code` | When | Frontend behaviour |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed JSON or an unsupported parameter combination. Prefer 422 for field issues. | Toast with `message`. |
| 401 | `UNAUTHENTICATED` | Missing, expired or revoked token; wrong credentials on login. | Customer: one silent refresh, then retry. If refresh fails, sign out and go to login with `redirect`. Admin: clear the admin session and go to admin login. Login forms show `message` inline. |
| 402 | `PAYMENT_REQUIRED` | Feature needs a paid plan (premium-only action). | Toast with `message`. A dedicated upgrade prompt is not wired yet. |
| 402 | `INSUFFICIENT_FUNDS` | Wallet balance below the amount (wallet checkout, withdrawal, subscription). | Toast with `message`; the buyer stays on the payment step to choose another method. |
| 402 | `PAYMENT_FAILED` | Provider declined or the charge could not be created or verified. | Payment return page shows the failure state with "Try again". The order stays `failed` or `awaiting_payment`. |
| 403 | `FORBIDDEN` | Authenticated but not allowed (event role, admin permission, privacy setting). | Toast. Admin console redirects to the dashboard if a whole module is forbidden. |
| 403 | `ACCOUNT_SUSPENDED` | User or admin suspended. | The HTTP layer clears that audience's session (customer or admin) and the `message` is shown. On login, the message shows on the form. |
| 403 | `IDENTITY_UNVERIFIED` | Action requires a verified identity (withdrawals, some event types). | Toast with `message`. Users verify from their profile page. Opening the verification modal automatically is a planned improvement. |
| 404 | `NOT_FOUND` | Missing, or not visible to the caller. Use 404 rather than 403 for private resources, to avoid leaking existence. | Page-level "not found" state or toast. |
| 409 | `CONFLICT` | State conflict: already cancelled, already checked in, duplicate review, idempotency key reused with a different payload, request in progress. | Toast; refresh the resource. |
| 409 | `TICKETS_UNAVAILABLE` | Sold out, sale window closed, or quantity above remaining or per-order limit, at quote or order time. | Checkout returns to the ticket step and re-quotes. |
| 409 | `SEAT_TAKEN` | Selected seat was taken by someone else between quote and order. | Checkout reloads the seat map and returns to seat selection. |
| 422 | `PROMO_INVALID` | Unknown, expired or exhausted promo code, or not applicable to the cart. | Shows the message under the promo field and re-quotes without the code. |
| 422 | `OTP_INVALID` | Wrong code. | Clears the code input and shows `message` under it. |
| 422 | `OTP_EXPIRED` | Code expired or attempts exhausted. | Same as `OTP_INVALID`; the user can request a new code from the same screen. |
| 422 | `PIN_INVALID` | Wrong wallet PIN. | Shows `message`. Include remaining attempts in it when useful. |
| 422 | `VALIDATION_ERROR` | Field validation (§2). | Maps `errors` onto form fields; toast only if no field matched. |
| 429 | `RATE_LIMITED` | Throttled. Include `Retry-After`. | Toast with `message`. The client does not read `Retry-After` yet, so put the wait time in the message. |
| 500 | `SERVER_ERROR` | Unhandled error. | Toast with retry. Error is reported to Sentry with `correlationId`. |
| 502/503/504 | `SERVER_ERROR` | Upstream or maintenance. During planned maintenance, return 503 with `Retry-After` and message. | "Service temporarily unavailable" state with retry. |
| (none) | `NETWORK_ERROR` | Client-side only: request never reached the server or timed out (30s). | Offline-friendly error state with retry. The session is **not** cleared. |
| (none) | `CANCELLED` | Client-side only: request aborted (navigation, newer search). | Ignored silently. |

Notes on the matrix:

- The codes `TICKETS_UNAVAILABLE` and `SEAT_TAKEN` are used with **409**. If the backend prefers 422 for them, the frontend still works, because it branches on `code`. Agree on one and keep it consistent.
- Messages for 402 and 409 domain codes should include the actionable detail, for example "Only 2 Regular tickets are left." or "Seat T4-S3 was just taken."

## 4. Payment-specific failures

| Situation | Response |
|---|---|
| Provider redirect returns, but the provider says the payment is still pending | `200` with the order in `awaiting_payment`. The return page calls verify-payment up to 6 times, 2.5 seconds apart (about 15 seconds). It then shows a "still confirming" state, and the tickets appear in My Tickets once the webhook settles the order. |
| Provider says failed | `200` with order `failed` from verify-payment, or `402 PAYMENT_FAILED` if order creation itself failed. |
| Quote expired before order creation | `409 CONFLICT` with the message "Your reserved tickets have expired. Please review your order." The client re-quotes. |
| Duplicate `POST /orders` with the same `Idempotency-Key` | Return the original `201` response body. Do not create a second order. |
| Webhook arrives for an unknown or already finalised order | Webhook returns `200` (acknowledge) and logs it. Never `4xx` a valid, signed webhook, because providers retry. |

## 5. Logging and observability

- Log every 4xx and 5xx with `correlationId`, user or admin ID, route, status, code and latency. Do not log tokens, passwords, PINs, OTPs, full card data or identity numbers.
- The frontend sends `X-Correlation-Id` on every request and attaches it to Sentry events. Search by it to join client and server traces.
- Expose 5xx rates per route and payment provider failure rates. The admin "Gateway health" view expects `successRate`, `avgLatencyMs`, `failures` and `status` per provider.

## 6. Captured examples

These were produced by the development mock adapter, so their messages show the intended tone:

```json
// POST /auth/login with a wrong password → 401
{ "message": "Incorrect email or password.", "code": "UNAUTHENTICATED", "correlationId": "f4f9b754-e7a5-436e-b68b-7e50274359a4" }

// POST /admin/auth/login with a wrong 2FA code → 422
{ "message": "Invalid authentication code.", "code": "OTP_INVALID", "errors": { "otp": ["Invalid code"] } }

// POST /wallet/withdrawals above balance → 402
{ "message": "Insufficient wallet balance.", "code": "INSUFFICIENT_FUNDS" }

// POST /tickets/{id}/cancel on a checked-in ticket → 409
{ "message": "Checked-in tickets cannot be cancelled.", "code": "CONFLICT" }

// POST /organizer/events/{id}/publish on an incomplete draft → 422
{ "message": "Complete the event before publishing.", "code": "VALIDATION_ERROR",
  "errors": { "schedules": ["Add at least one date"], "ticketTypes": ["Add at least one ticket type or mark the event as free"] } }
```
