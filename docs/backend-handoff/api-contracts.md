# API contracts

> **Status of this document.** These are the contracts the Wedpluz web app and admin console are built against. They are **proposals for the Laravel backend**, not a description of endpoints that exist today. Each operation is marked `required`, `optional` or `proposed` (definitions in [README.md](README.md#endpoint-status)). The backend team owns the final shape; any change should be reflected in the frontend types under `src/types` and regenerated here.

The machine-readable source of truth is [openapi.yaml](openapi.yaml) (OpenAPI 3.1, validated by `npm run openapi:validate`). The endpoint tables below are generated from it by `npm run openapi:generate`. Do not edit the tables by hand; edit the prose around them.

Related documents: [business-rules.md](business-rules.md) · [authentication-and-permissions.md](authentication-and-permissions.md) · [error-handling.md](error-handling.md) · [realtime-events.md](realtime-events.md) · [integrations.md](integrations.md) · [data-model-requirements.md](data-model-requirements.md)

---

## 1. Global conventions

### 1.1 Base URL and versioning

| Environment | Base URL |
|---|---|
| Production | `https://api.wedpluz.com/api/v1` |
| Staging | `https://api-staging.wedpluz.com/api/v1` |
| Local | `http://localhost:8000/api/v1` |

The frontend reads the base URL from `VITE_API_BASE_URL`. Breaking changes require a new major path (`/api/v2`). Additive changes (new fields, new endpoints, new enum values) are allowed within `v1`; clients must ignore unknown fields and tolerate unknown enum values.

The web app, the Android app and the iOS app are all clients of this API. Nothing in these contracts is web-specific except `POST /me/devices` with `platform: web`.

### 1.2 Request headers

| Header | Sent by | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | All authenticated calls | Customer token, or admin token on `/admin/*`. See [authentication-and-permissions.md](authentication-and-permissions.md). |
| `Accept: application/json` | All | Always JSON. Laravel must return JSON errors, never HTML redirects. |
| `Content-Type: application/json` | All except uploads | Uploads use `multipart/form-data`. |
| `X-Correlation-Id: <uuid>` | All | Generated per request. Log it, echo it in the response header, and include it as `correlationId` in error bodies. |
| `X-Client-Platform: web` | All | `web`, `android`, `ios` or `admin`. Useful for analytics and the `source` fields in admin views. |
| `X-Client-Version: <semver>` | All | Client build version, for forced-update checks. |
| `Idempotency-Key: <uuid>` | Payment-sensitive writes | Order creation, wallet top-up, wallet withdrawal, subscription. See §1.8. |

### 1.3 Response envelopes

Every successful JSON response uses one of three shapes.

**Single resource or action result**

```json
{
  "data": { "id": "evt_movie", "title": "Movie in the park - Denim Edition" },
  "message": "Optional human-readable confirmation shown as a toast"
}
```

**Offset-paginated list**, for admin tables and searchable lists:

```json
{
  "data": [ { "id": "usr_1" }, { "id": "usr_2" } ],
  "meta": { "page": 1, "perPage": 20, "total": 482, "lastPage": 25 }
}
```

**Cursor-paginated list**, for messages and notifications where items arrive while the user reads:

```json
{
  "data": [ { "id": "msg_100" } ],
  "meta": { "nextCursor": "msg_071", "prevCursor": null, "perPage": 30 }
}
```

`204 No Content` is used for actions with no meaningful result. The frontend tolerates an empty body on any write.

Errors always use `ApiErrorBody`; see [error-handling.md](error-handling.md).

### 1.4 Pagination, sorting, filtering and search

| Parameter | Rule |
|---|---|
| `page` | 1-based. Default `1`. |
| `perPage` | Default `20`, maximum `100`. Clamp silently above the maximum. |
| `cursor` | Opaque string from `meta.nextCursor`. Never parse it client-side. |
| `sort` | Field key such as `createdAt`, `revenue` or `ticketsSold`. Unknown keys return `422`. |
| `order` | `asc` or `desc`. Default `desc` for dates. |
| `search` | Free text, trimmed, case-insensitive. Apply to the fields named per endpoint (e.g. user name, email, phone, reference). Minimum 2 characters, otherwise ignore. |
| `dateFrom`, `dateTo` | ISO dates (`YYYY-MM-DD`), inclusive, interpreted in the platform timezone (`Africa/Lagos` by default). |
| Enum filters | The value `all`, or an absent parameter, means "no filter". |

Admin list pages keep their filters in the URL, so every filter must be expressible as a query parameter.

### 1.5 Data formats

- **Keys** are camelCase in both requests and responses. Laravel API Resources should map from snake_case columns.
- **IDs** are opaque strings. Prefixed ULIDs are recommended (`evt_01J9…`, `usr_01J9…`). The frontend never does arithmetic on IDs.
- **Timestamps** are ISO-8601 with offset (`2026-12-12T18:00:00+01:00` or `Z`). Store UTC; render in the user's timezone.
- **Money** is an integer in minor units (kobo for NGN), always paired with an ISO-4217 `currency`. `₦5,000.00` is `500000`. The frontend never sends prices it calculated; it sends quantities and IDs and shows server-calculated totals.
- **Percentages** are numbers from 0 to 100 (`3` means 3%).
- **Enums** are lowercase snake_case strings.
- **Rich text** (event descriptions, CMS pages) is stored as sanitised HTML or Markdown. The frontend sanitises again before rendering, but the backend must strip scripts and event handlers on write.

### 1.6 Uploads

Two supported flows, both returning an `Upload` with an `id` that later requests reference (`coverUploadId`, `mediaUploadIds`, `attachmentUploadIds`, `selfieUploadId`):

1. `POST /uploads` as `multipart/form-data` with `file` and `purpose`. The backend stores the file in Cloudinary (images and video) or S3 (documents, identity media).
2. `POST /uploads/sign`, then a direct browser upload to Cloudinary or S3 using the signed fields. This is optional; use it once traffic justifies it.

The backend must validate MIME type by content, enforce per-purpose size limits, strip EXIF location data from images, and keep identity selfies in a private bucket. Upload IDs are single-use and expire after 24 hours if not attached to a resource.

### 1.7 Personalised public endpoints

Catalogue endpoints such as events and vendors work for guests. When a customer token is present, they also return personal flags: `isSaved`, `isLiked`, `isMine`, `myTicketId` and `myRequestStatus`. The token is optional on these routes. An expired token should produce a `401` so the client can refresh. It must not silently downgrade to the guest view.

### 1.8 Idempotency

`Idempotency-Key` is required on `POST /orders`, `POST /wallet/top-ups`, `POST /wallet/withdrawals` and `POST /me/subscription`. Rules:

- Scope the key by user and endpoint. Store the first response, status and body, for at least 24 hours.
- A replay with the same key and the same payload returns the stored response unchanged.
- A replay with the same key and a different payload returns `409 CONFLICT`.
- A replay that arrives while the first request is still processing returns `409 CONFLICT` with the message "Request in progress". The client retries after a short delay.

Payment webhooks are deduplicated separately, by provider event ID.

### 1.9 Rate limits

Return `429 RATE_LIMITED` with a `Retry-After` header. Suggested limits:

| Scope | Limit |
|---|---|
| `POST /auth/login`, `/admin/auth/login` | 5 per minute per IP + email |
| `POST /auth/otp/send`, `/auth/password/forgot` | 3 per 10 minutes per email |
| `POST /auth/otp/verify` | 5 attempts per code, then the code is invalidated |
| Wallet PIN checks | 5 failures lock withdrawals for 30 minutes |
| `GET /search/suggestions` | 30 per minute per IP |
| Authenticated API | 120 per minute per user |
| Admin API | 300 per minute per admin |

### 1.10 Caching

- Public catalogue reads (`/categories`, `/vendor-categories`, `/interests`, `/plans`, `/pages/*`, `/config`) may send `Cache-Control: public, max-age=300` with an `ETag`.
- Personalised responses must send `Cache-Control: private, no-store`.
- Admin responses must send `Cache-Control: no-store`.
- Bust the cache of `/config` when an admin updates platform settings.

### 1.11 CORS

Allow origins `https://wedpluz.com`, `https://www.wedpluz.com` and `https://admin.wedpluz.com`, plus the staging equivalents and `http://localhost:5173`/`5174` in non-production environments. Allow the custom headers in §1.2 and expose `X-Correlation-Id` and `Retry-After`. Tokens travel in the `Authorization` header, so credentials mode is not needed.

---

## 2. Modules

Each section lists the purpose, the screens that use it, the main entities, validation and rule highlights, and external dependencies. It then shows the generated endpoint table. Full schemas and examples are in [openapi.yaml](openapi.yaml).

**Legend.** Auth values: `public` needs no token; `optional` accepts a token and personalises the response; `customer` needs a customer token; `admin · perm` needs an admin token with that permission; `signature` means the request is verified by a provider signature. Request `{ a, b? }` lists body fields, where `?` marks optional fields. A response such as `X[] + meta(offset)` is a paginated list.

### 2.1 Authentication and social sign-in

**Screens:** sign up, log in, Google sign-in, OTP verification, forgot and reset password, onboarding gate.
**Entities:** User, PersonalAccessToken, RefreshToken, OtpCode, SocialAccount.
**Validation:**
- `email` must be a valid address and unique among non-deleted users.
- `password` needs at least 8 characters, with at least one letter and one number. `passwordConfirmation` must match.
- `dateOfBirth` is required; users must be 13 or older, and 18+ events are gated separately.
- `acceptedTerms` must be `true`.
- OTP codes are 4 digits and expire after 10 minutes.

**Rules:**
- Registration returns tokens immediately, with `nextStep: verify_email`. Unverified users can browse but cannot buy tickets.
- Google sign-in verifies the ID token server-side against `VITE_GOOGLE_CLIENT_ID`'s audience. It links to an existing account with the same verified email, otherwise it creates one with `isNewUser: true`.
- Login of a suspended account returns `403 ACCOUNT_SUSPENDED`.

**External:** Google Identity (token verification), ZeptoMail (OTP email), Termii or Twilio (SMS OTP if enabled).

<!-- endpoints:Auth -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| POST | `/auth/login` | Sign in with email and password | public | required | LoginPayload | AuthResponse | `VALIDATION_ERROR` `UNAUTHENTICATED` `ACCOUNT_SUSPENDED` `RATE_LIMITED` |
| POST | `/auth/register` | Create a customer account | public | required | RegisterPayload | AuthResponse | `VALIDATION_ERROR` `CONFLICT` `RATE_LIMITED` |
| POST | `/auth/social` | Sign in or sign up with Google | public | required | SocialAuthPayload | AuthResponse | `VALIDATION_ERROR` `UNAUTHENTICATED` `ACCOUNT_SUSPENDED` |
| POST | `/auth/otp/send` | Send a one-time code by email | public | required | { email, purpose } | { sent, expiresInSeconds, channel } | `VALIDATION_ERROR` `RATE_LIMITED` |
| POST | `/auth/otp/verify` | Verify a one-time code | public | required | VerifyOtpPayload | { verified, resetToken } | `OTP_INVALID` `OTP_EXPIRED` `RATE_LIMITED` |
| POST | `/auth/password/forgot` | Start password reset | public | required | { email } | { sent } | — |
| POST | `/auth/password/reset` | Reset password with a one-time code | public | required | ResetPasswordPayload | { reset } | `VALIDATION_ERROR` `OTP_INVALID` `OTP_EXPIRED` |
| POST | `/auth/refresh` | Rotate access and refresh tokens | public | required | { refreshToken } | AuthTokens | `UNAUTHENTICATED` |
| POST | `/auth/logout` | Revoke the current token | customer | required | — | 204 No Content | — |
| GET | `/auth/me` | Get the signed-in user (session restore) | customer | required | — | User | — |
<!-- /endpoints -->

### 2.2 User profiles, settings, uploads, support and privacy

**Screens:** profile setup and interests, profile, settings (account, password, privacy, notifications, sessions), identity verification, account deletion, help and support, CMS pages, report dialogs.
**Entities:** User, UserPrivacySetting, NotificationPreference, Session, IdentityVerification, AccountDeletionRequest, Upload, SupportTicket, ContentReport, CmsPage, DeviceToken, PlatformSetting.
**Validation:**
- `username` is 3–30 characters from `[a-z0-9_.]` and unique, case-insensitive.
- `phone` uses E.164 format.
- `interests` holds 1–10 slugs from `/interests`.
- Identity verification needs an `idNumber` that matches the `idType` format (an NIN is 11 digits) and a `selfieUploadId` uploaded with purpose `identity_selfie`.
- An account deletion request needs the current password and a reason.

**Rules:**
- Account deletion uses a 30-day grace period. The account is deactivated immediately, can be restored by cancelling, and is anonymised when the period ends. See [business-rules.md](business-rules.md#account-deletion-and-privacy).
- Identity status changes only after the provider result arrives, by webhook or polling. The client never sets `verified`.
- `GET /config` exposes only public settings: enabled providers, fee percentage, support contacts and feature flags. It never exposes secrets.

**External:** Cloudinary and S3 (uploads), Primely (identity, provider pending confirmation), Firebase Cloud Messaging (web push token).

<!-- endpoints:Account & Profile -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/me` | Get my profile | customer | required | — | User | — |
| PATCH | `/me` | Update my profile | customer | required | { firstName?, lastName?, phone?, dateOfBirth?, city?, countryCode?, avatarUrl?, username?, locale? } | User | — |
| POST | `/me/profile-setup` | Complete onboarding profile setup | customer | required | ProfileSetupPayload | User | — |
| GET | `/interests` | List selectable interests | public | required | — | { label, slug }[] | — |
| PUT | `/me/interests` | Replace my interests | customer | required | { interests } | User | — |
| PUT | `/me/password` | Change my password | customer | required | ChangePasswordPayload | { updated } | `VALIDATION_ERROR` |
| GET | `/me/privacy` | Get my privacy settings | customer | required | — | PrivacySettings | — |
| PUT | `/me/privacy` | Update my privacy settings | customer | required | { profileVisibility?, showEmail?, showPhone?, allowMessageRequests?, allowTagging?, discoverableBySearch? } | PrivacySettings | — |
| GET | `/me/notification-preferences` | Get my notification preferences | customer | required | — | NotificationPreferences | — |
| PUT | `/me/notification-preferences` | Update my notification preferences | customer | required | { channels?, topics? } | NotificationPreferences | — |
| GET | `/me/sessions` | List my active sessions | customer | required | — | Session[] | — |
| DELETE | `/me/sessions/{id}` | Revoke one session | customer | required | — | 204 No Content | — |
| DELETE | `/me/sessions` | Revoke all other sessions | customer | required | — | 204 No Content | — |
| GET | `/me/identity-verification` | Get my identity verification status | customer | proposed | — | object | — |
| POST | `/me/identity-verification` | Submit identity verification (ID + selfie) | customer | proposed | IdentityVerificationRequest | IdentityVerification | `VALIDATION_ERROR` `CONFLICT` |
| GET | `/me/deletion-request` | Get my pending account deletion request | customer | required | — | object | — |
| POST | `/me/deletion-request` | Request account deletion (30-day grace period) | customer | required | { reason, password } | AccountDeletionRequest | `VALIDATION_ERROR` `CONFLICT` |
| DELETE | `/me/deletion-request` | Cancel my account deletion request | customer | required | — | 204 No Content | — |
| POST | `/uploads` | Upload a file (multipart) | customer | required | multipart/form-data { file, purpose } | Upload | `VALIDATION_ERROR` |
| POST | `/uploads/sign` | Get a signed direct-upload form | customer | optional | { purpose } | UploadSignature | — |
| GET | `/users/{id}` | Get a user's public profile | optional | required | — | PublicProfile | — |
| GET | `/pages/{slug}` | Get a CMS page (about, terms, privacy, FAQs, help, contact) | public | required | — | CmsPage | — |
| POST | `/support/tickets` | Open a support ticket | customer | required | { subject, category, message } | SupportTicket | — |
| GET | `/support/tickets` | List my support tickets | customer | required | — | SupportTicket[] | — |
| POST | `/reports` | Report content or a user | customer | required | ReportPayload | { id, status } | — |
| GET | `/config` | Get public platform configuration and feature flags | public | required | — | PublicConfig | — |
| POST | `/me/devices` | Register a web push token | customer | optional | { token, platform } | { registered } | — |
<!-- /endpoints -->

### 2.3 Event discovery and categories

**Screens:** home (promote events, upcoming, popular, categories), events listing with filters, event detail, search suggestions, saved events, request to attend.
**Entities:** Event, EventCategory, EventSchedule, TicketType, SubEvent, MenuItem, SavedEvent, EventRequest.
**Filtering:** `search` matches title, organiser name, venue and tags. `location` matches a city or state, or a `lat,lng` pair combined with `distanceKm`. `timeOfDay` buckets are morning (05:00–12:00), afternoon (12:00–17:00) and evening (17:00–05:00) in the event's local time. `sort=relevance` is the default when `search` is set; otherwise the default is `date`.
**Visibility:** guests and other users see only `live` events with `visibility: public`. Private events are reachable by slug only through an invite link, a community or an organiser share. Suspended, rejected and draft events return `404` to everyone except the organiser team and admins.
**Rules:**
- `isAdultOnly` events require an authenticated user aged 18 or older before checkout.
- `approvalRequired` events use `POST /events/{id}/requests` instead of checkout until the request is approved.
- `minPrice` and `isFree` are derived server-side from active ticket types.

<!-- endpoints:Event Discovery -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/categories` | List event categories | public | required | — | EventCategory[] | — |
| GET | `/events` | Search and filter events | optional | required | query: search, location, categorySlug, dateFrom, dateTo, timeOfDay, attendanceMode, distanceKm, freeOnly, sort, page, perPage | EventSummary[] + meta(pagination) | — |
| GET | `/events/featured` | List featured events | optional | required | — | EventSummary[] | — |
| GET | `/events/upcoming` | List upcoming events | optional | required | query: location | EventSummary[] | — |
| GET | `/events/popular` | List popular events | optional | required | — | EventSummary[] | — |
| GET | `/events/promoted` | List events open for promotion (earn commission) | optional | required | — | EventSummary[] | — |
| GET | `/events/{slug}` | Get event details by slug | optional | required | — | Event | — |
| GET | `/events/{id}/related` | List related events | optional | optional | — | EventSummary[] | — |
| GET | `/events/{id}/organizer-events` | List other events by the same organizer | optional | optional | query: page | EventSummary[] + meta(pagination) | — |
| POST | `/events/{id}/save` | Save an event | customer | required | — | { saved } | — |
| DELETE | `/events/{id}/save` | Remove a saved event | customer | required | — | 204 No Content | — |
| GET | `/me/saved-events` | List my saved events | customer | required | query: search, page | EventSummary[] + meta(pagination) | — |
| POST | `/events/{id}/requests` | Request to attend an approval-only event | customer | required | { firstName, lastName } | { status } | `CONFLICT` `VALIDATION_ERROR` |
| GET | `/search/suggestions` | Search-as-you-type suggestions | public | optional | query: q, location | SearchSuggestion[] | — |
| GET | `/locations/suggest` | Location autocomplete | public | optional | query: q | { label, value }[] | — |
<!-- /endpoints -->

### 2.4 Booking, checkout, payments, tickets, refunds and QR

**Screens:** checkout drawer (tickets, food, attendee and guests, seat map, payment method), provider redirect, payment return, my tickets, ticket detail with QR, cancel ticket flow, ticket transfer.
**Entities:** CheckoutQuote (with inventory hold), Order, OrderLine, OrderFoodLine, PaymentIntent, Payment, Ticket, SeatReservation, Refund, TicketTransfer.
**Flow:**
1. `POST /checkout/quotes` prices the cart server-side, validates sale windows and per-order limits, applies any promo code and holds inventory until `expiresAt`.
2. Optionally, `GET /events/{id}/schedules/{scheduleId}/seats` returns the seat map when `requiresSeatSelection` is set.
3. `POST /orders` with an `Idempotency-Key` creates the order and returns a `PaymentIntent`. The client redirects to `authorizationUrl` or opens the provider's inline SDK with the public `clientParams`.
4. The provider redirects back to `returnUrl`. The client calls `POST /orders/{id}/verify-payment`. The backend confirms with the provider, or uses the webhook result if it already arrived, and issues tickets atomically.
5. Webhooks remain authoritative. If verify runs first and the webhook arrives later, the second path must be a no-op.

**The frontend never decides** availability, the payable amount, payment success, refund eligibility or settlement. It only displays what these endpoints return.
**QR:** `Ticket.qrPayload` is an opaque, server-signed string encoded into the QR. The scanner sends whatever it reads, either the QR payload or the short `code` typed manually, to `POST /organizer/events/{id}/check-ins`.
**External:** Paystack, Stripe, PayPal and Monnify (payments and refunds), Wedpluz wallet (internal ledger), ZeptoMail (ticket email), FCM (push).

<!-- endpoints:Checkout & Tickets -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| POST | `/checkout/quotes` | Create a checkout quote (server-priced, holds inventory) | customer | required | CheckoutQuotePayload | CheckoutQuote | `TICKETS_UNAVAILABLE` `PROMO_INVALID` `VALIDATION_ERROR` `IDENTITY_UNVERIFIED` |
| DELETE | `/checkout/quotes/{quoteId}` | Release a checkout quote hold | customer | optional | — | 204 No Content | — |
| GET | `/events/{eventId}/schedules/{scheduleId}/seats` | Get the seat map for an event schedule | customer | required | — | HallLayout | — |
| POST | `/orders` | Create an order and payment intent | customer · Idempotency-Key | required | CreateOrderPayload | { order, payment } | `TICKETS_UNAVAILABLE` `SEAT_TAKEN` `CONFLICT` `PAYMENT_FAILED` `INSUFFICIENT_FUNDS` `VALIDATION_ERROR` |
| GET | `/orders/{id}` | Get an order | customer | required | — | Order | — |
| POST | `/orders/{id}/verify-payment` | Verify payment after provider redirect | customer | required | { reference?, simulate? } | Order | `PAYMENT_FAILED` `NOT_FOUND` |
| GET | `/orders/{id}/receipt` | Get a signed receipt download URL | customer | optional | — | { url } | — |
| GET | `/me/tickets` | List my tickets | customer | required | query: tab, search, page | TicketListItem[] + meta(pagination) | — |
| GET | `/tickets/{id}` | Get a ticket with its QR payload | customer | required | — | TicketDetail | — |
| POST | `/tickets/{id}/cancel` | Cancel a ticket (refund decided by backend) | customer | required | CancelTicketPayload | Ticket | `CONFLICT` `FORBIDDEN` |
| POST | `/tickets/{id}/transfer` | Transfer a ticket to another person | customer | proposed | TicketTransferPayload | Ticket | `CONFLICT` `VALIDATION_ERROR` |
| GET | `/tickets/{id}/download` | Get a signed ticket PDF download URL | customer | optional | — | { url, filename } | — |
<!-- /endpoints -->

### 2.5 Organizer portal and event management

**Screens:** create event wizard (details, schedules, sub-events, tickets, organiser info, assets), manage event (overview, guests, requests, check-ins and scanner, managers and vendors, tasks, activity, promotion, community), my promotions and collaborations.
**Entities:** Event and its children, EventManager, EventVendorAssignment, EventTask, ActivityLog, EventPromotion, PromoterEnrollment, CheckIn, Community.
**Access:**
- The event owner has full control.
- Managers act only within their granted `permissions` (`manage_guests`, `scan_tickets`, `manage_tasks`, `manage_vendors`, `manage_assets`, `view_revenue`, `edit_event`, `manage_community`).
- Assigned vendors see the event and the tasks assigned to them.
- The backend checks these on every `/organizer/events/{id}/*` call. The UI hiding a tab is not enough.

**Validation:** publishing requires a title, at least one schedule, and at least one active ticket type or `isFree`. `salesEndAt` must be at or before the schedule end. Promotion commission is 1–50%.
**Rules:** see [business-rules.md](business-rules.md#event-lifecycle) for draft → pending review → live → completed or cancelled, the effects of cancellation (automatic refunds and notifications), and check-in atomicity.

<!-- endpoints:Organizer Portal -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/organizer/events` | List events I organize or help manage | customer | required | query: tab, status, search, page | ManageEventSummary[] + meta(pagination) | — |
| POST | `/organizer/events` | Create an event draft | customer | required | { title?, description?, coverUploadId?, coverUrl?, categoryId?, visibility?, approvalRequired?, guestLimit?, allowGuestInvites?, maxAdditionalGuests?, isAdultOnly?, schedules?, subEvents?, isFree?, ticketTypes?, organizerInfo?, assets? } | Event | — |
| GET | `/organizer/events/{id}` | Get a managed event | customer | required | — | ManagedEvent | — |
| PUT | `/organizer/events/{id}` | Update a managed event draft or live event | customer | required | { title?, description?, coverUploadId?, coverUrl?, categoryId?, visibility?, approvalRequired?, guestLimit?, allowGuestInvites?, maxAdditionalGuests?, isAdultOnly?, schedules?, subEvents?, isFree?, ticketTypes?, organizerInfo?, assets? } | Event | — |
| POST | `/organizer/events/{id}/publish` | Publish an event (or submit for review) | customer | required | — | Event | `VALIDATION_ERROR` `IDENTITY_UNVERIFIED` |
| DELETE | `/organizer/events/{id}` | Delete an event draft | customer | required | — | 204 No Content | — |
| PATCH | `/organizer/events/{id}/status` | Mark an event completed or cancelled | customer | required | { status, cancellationReason? } | Event | — |
| GET | `/organizer/events/{id}/analytics` | Get event sales analytics | customer | required | — | OrganizerAnalytics | — |
| GET | `/organizer/events/{id}/guests` | List the guest list | customer | required | query: filter, search, page | GuestListEntry[] + meta(pagination) | — |
| GET | `/organizer/events/{id}/requests` | List attendance requests | customer | required | query: status, perPage | EventRequest[] + meta(pagination) | — |
| PATCH | `/organizer/events/{id}/requests/{requestId}` | Approve or decline an attendance request | customer | required | { status } | EventRequest | — |
| POST | `/organizer/events/{id}/requests/bulk` | Approve or decline attendance requests in bulk | customer | required | { ids, status } | { updated } | — |
| GET | `/organizer/events/{id}/check-ins` | List check-ins | customer | required | query: page | CheckInRecord[] + meta(pagination) | — |
| POST | `/organizer/events/{id}/check-ins` | Validate and check in a ticket (QR scan or manual code) | customer | required | { code, method } | TicketValidationResult | `FORBIDDEN` |
| GET | `/organizer/events/{id}/managers` | List event managers | customer | required | query: search | EventManager[] | — |
| POST | `/organizer/events/{id}/managers` | Invite an event manager | customer | required | { userId?, email?, access, permissions } | EventManager | — |
| PATCH | `/organizer/events/{id}/managers/{managerId}` | Change a manager's access | customer | required | { permissions?, access? } | EventManager | — |
| DELETE | `/organizer/events/{id}/managers/{managerId}` | Remove an event manager | customer | required | — | 204 No Content | — |
| GET | `/organizer/events/{id}/vendors` | List vendors assigned to the event | customer | required | query: search | EventVendorAssignment[] | — |
| POST | `/organizer/events/{id}/vendors` | Invite a vendor to the event | customer | required | { vendorId, role? } | EventVendorAssignment | — |
| DELETE | `/organizer/events/{id}/vendors/{assignmentId}` | Remove a vendor from the event | customer | required | — | 204 No Content | — |
| GET | `/organizer/events/{id}/tasks` | List event tasks | customer | required | query: assigneeId, search, sort | EventTask[] | — |
| POST | `/organizer/events/{id}/tasks` | Create an event task | customer | required | TaskPayload | EventTask | — |
| PATCH | `/organizer/events/{id}/tasks/{taskId}` | Update an event task | customer | required | { title?, description?, status?, dueAt?, assigneeIds?, attachmentUploadIds? } | EventTask | — |
| DELETE | `/organizer/events/{id}/tasks/{taskId}` | Delete an event task | customer | required | — | 204 No Content | — |
| GET | `/organizer/events/{id}/activity` | List the event activity log | customer | required | query: role, page | ActivityLogEntry[] + meta(pagination) | — |
| GET | `/organizer/events/{id}/promotion` | Get promotion (affiliate) settings | customer | required | — | EventPromotionSettings | — |
| PUT | `/organizer/events/{id}/promotion` | Update promotion (affiliate) settings | customer | required | { enabled?, commissionPercent?, targetSignups?, promoterLimit?, promotersCount? } | EventPromotionSettings | — |
| GET | `/organizer/events/{id}/promoters` | Get the promoter leaderboard | customer | required | — | PromoterBoardEntry[] | — |
| GET | `/organizer/events/{id}/community` | Get the event community | customer | required | — | object | — |
| PUT | `/organizer/events/{id}/community` | Enable, disable or configure the event community | customer | required | { enabled, permissions? } | object | — |
| GET | `/me/collaborations` | List my collaboration invites | customer | required | — | EventCollaboration[] | — |
| PATCH | `/me/collaborations/{id}` | Accept or decline a collaboration invite | customer | required | { status } | EventCollaboration | — |
| GET | `/me/promotions` | List events I promote | customer | required | query: status, search, page | PromoterEnrollment[] + meta(pagination) | — |
| GET | `/me/promotions/{id}` | Get one of my promotion enrollments | customer | required | — | PromoterEnrollment | — |
| POST | `/events/{eventId}/promotions/join` | Join an event's promotion programme | customer | required | — | PromoterEnrollment | — |
<!-- /endpoints -->

### 2.6 Vendor management

**Screens:** hire vendors (listing, filters, featured), vendor profile (works, reviews, promos, contact), business account setup and vendor dashboard, saved vendors.
**Entities:** VendorProfile, VendorCategory, VendorWork, VendorWorkMedia, VendorReview, VendorPromo, SavedVendor, WorkLike.
**Rules:**
- A user has at most one vendor profile.
- New profiles start as `pending_verification` and appear in search once an admin verifies them (`organizers.verify`).
- A user may review a vendor once, cannot review their own profile, and needs a rating of 1–5 with a comment of 10–1000 characters.
- `POST /vendors/{id}/contact` creates or reuses a direct conversation, or a message request if the vendor's privacy settings require it.

<!-- endpoints:Vendors -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/vendor-categories` | List vendor categories | public | required | — | VendorCategory[] | — |
| GET | `/business-categories` | List business categories (business onboarding) | public | required | — | { id, name }[] | — |
| GET | `/vendors` | Search and filter vendors | optional | required | query: search, location, categorySlug, minRating, availability, sort, page, perPage | VendorSummary[] + meta(pagination) | — |
| GET | `/vendors/featured` | List featured vendors | optional | required | — | VendorSummary[] | — |
| GET | `/vendors/{slug}` | Get a vendor profile by slug | optional | required | — | Vendor | — |
| GET | `/vendors/{id}/works` | List a vendor's portfolio works | optional | required | query: page | VendorWork[] + meta(pagination) | — |
| GET | `/works/{id}` | Get a portfolio work | optional | required | — | { id, vendorId, title, description, media, likesCount, isLiked, createdAt, vendor } | — |
| POST | `/works/{id}/like` | Toggle like on a portfolio work | customer | required | — | { liked, likesCount } | — |
| GET | `/vendors/{id}/reviews` | List vendor reviews with rating summary | optional | required | — | ReviewsResponse | — |
| POST | `/vendors/{id}/reviews` | Review a vendor | customer | required | ReviewPayload | VendorReview | — |
| PUT | `/vendors/{id}/reviews/{reviewId}` | Edit my vendor review | customer | required | ReviewPayload | VendorReview | — |
| DELETE | `/vendors/{id}/reviews/{reviewId}` | Delete my vendor review | customer | required | — | 204 No Content | — |
| POST | `/vendors/{id}/save` | Save a vendor | customer | required | — | { saved } | — |
| DELETE | `/vendors/{id}/save` | Remove a saved vendor | customer | required | — | 204 No Content | — |
| GET | `/me/saved-vendors` | List my saved vendors | customer | required | query: search, page | VendorSummary[] + meta(pagination) | — |
| POST | `/vendors/{id}/contact` | Start a conversation with a vendor | customer | required | — | { conversationId } | — |
| GET | `/me/vendor-profile` | Get my vendor (business) profile | customer | required | — | object | — |
| POST | `/me/vendor-profile` | Create my vendor profile | customer | required | VendorProfilePayload | Vendor | — |
| PUT | `/me/vendor-profile` | Update my vendor profile | customer | required | { businessName?, location?, categoryId?, description?, avatarUploadId?, coverUploadId?, contactEmail?, contactPhone?, website?, availability? } | Vendor | — |
| DELETE | `/me/vendor-profile` | Delete my vendor profile | customer | required | — | 204 No Content | — |
| POST | `/me/vendor-profile/works` | Add a portfolio work | customer | required | VendorWorkPayload | VendorWork | — |
| PUT | `/me/vendor-profile/works/{id}` | Update a portfolio work | customer | required | { title?, description?, mediaUploadIds? } | VendorWork | — |
| DELETE | `/me/vendor-profile/works/{id}` | Delete a portfolio work | customer | required | — | 204 No Content | — |
| POST | `/me/vendor-profile/promos` | Add a vendor promo | customer | required | { title, description, discountPercent?, validUntil? } | VendorPromo | — |
| DELETE | `/me/vendor-profile/promos/{id}` | Delete a vendor promo | customer | required | — | 204 No Content | — |
<!-- /endpoints -->

### 2.7 Communities, statuses and live sessions

**Screens:** communities list, community info drawer (members, media, settings), status viewer, live session.
**Entities:** Community, CommunityMember, StatusPost, StatusView, LiveSession, LiveRequest.
**Rules:**
- Publishing an event creates its community. Event communities admit ticket holders and the organiser team automatically.
- Members can send messages, post statuses, invite others and go live only when the matching `permissions` flag allows it; owners and co-admins always can.
- Statuses expire after 24 hours.
- Live sessions are `proposed` until the media provider is chosen. `joinToken` is a short-lived room token from that provider.

<!-- endpoints:Communities -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/communities` | List my communities | customer | required | query: archived, search | Community[] | — |
| POST | `/communities` | Create a community | customer | required | CommunityCreatePayload | Community | — |
| GET | `/communities/{id}` | Get a community | customer | required | — | Community | — |
| PUT | `/communities/{id}` | Update community details or permissions | customer | required | { name?, description?, avatarUploadId?, permissions? } | Community | — |
| PATCH | `/communities/{id}` | Mute, pin or archive a community for me | customer | required | { isMuted?, isPinned?, isArchived? } | Community | — |
| POST | `/communities/{id}/join` | Join a community | customer | required | — | Community | — |
| POST | `/communities/join/{code}` | Join a community by invite code | customer | required | — | Community | — |
| POST | `/communities/{id}/leave` | Leave a community | customer | required | — | 204 No Content | — |
| POST | `/communities/{id}/invite-link` | Regenerate the invite link | customer | required | — | { inviteLink } | — |
| GET | `/communities/{id}/members` | List community members | customer | required | query: search, page | CommunityMember[] + meta(pagination) | — |
| POST | `/communities/{id}/members` | Invite members | customer | required | { userIds?, emails? } | { invited } | — |
| PATCH | `/communities/{id}/members/{userId}` | Change a member's role | customer | required | { role } | CommunityMember | — |
| DELETE | `/communities/{id}/members/{userId}` | Remove a member | customer | required | — | 204 No Content | — |
| GET | `/communities/{id}/statuses` | List active statuses (24h stories) | customer | required | — | StatusPost[] | — |
| POST | `/communities/{id}/statuses` | Post a status | customer | required | { mediaUploadId, caption?, mediaType? } | StatusPost | — |
| POST | `/statuses/{id}/like` | Toggle like on a status | customer | required | — | { liked, likesCount } | — |
| POST | `/statuses/{id}/view` | Mark a status as viewed | customer | required | — | 204 No Content | — |
| DELETE | `/statuses/{id}` | Delete a status | customer | required | — | 204 No Content | — |
| GET | `/communities/{id}/media` | List shared media and documents | customer | optional | query: type, page | CommunityMediaItem[] + meta(pagination) | — |
| GET | `/communities/{id}/live` | Get the current live session | customer | proposed | — | object | — |
| POST | `/communities/{id}/live` | Start a live session | customer | proposed | { title?, audioEnabled?, videoEnabled? } | LiveSession | — |
| PATCH | `/live/{liveId}` | Toggle host audio/video | customer | proposed | { audioEnabled?, videoEnabled? } | LiveSession | — |
| POST | `/live/{liveId}/end` | End a live session | customer | proposed | — | object | — |
| POST | `/live/{liveId}/join` | Join a live session (returns provider room token) | customer | proposed | — | { joinToken, session } | — |
| GET | `/live/{liveId}/requests` | List requests to join the live stage | customer | proposed | — | LiveRequest[] | — |
| POST | `/live/{liveId}/requests` | Request to join the live stage | customer | proposed | — | LiveRequest | — |
| PATCH | `/live/{liveId}/requests/{requestId}` | Accept or decline a live stage request | customer | proposed | { status } | LiveRequest | — |
<!-- /endpoints -->

### 2.8 Messaging

**Screens:** messages inbox (all, unread, communities, requests), conversation thread with replies, reactions, stars, pins, media, voice notes, event shares, and report or block.
**Entities:** Conversation, ConversationParticipant, Message, MessageAttachment, MessageReaction, MessageStar, Block.
**Rules:**
- Direct messages to users who disallow message requests return `403`.
- First messages to non-connections create a request conversation (`isRequest: true`) on the recipient's side.
- `clientId` is a client-generated UUID that makes sends idempotent and lets the UI reconcile optimistic messages.
- A sender may delete their own message (`deletedBy: sender`). Admins may remove messages via moderation (`deletedBy: admin`). The body is then replaced by a placeholder.

**Realtime:** new messages, read receipts and typing indicators are pushed on private channels; see [realtime-events.md](realtime-events.md). Without a socket, the web app polls unread counts every 60 seconds.

<!-- endpoints:Messaging -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/conversations` | List my conversations | customer | required | query: tab, search, cursor | { items, requestsCount } | — |
| POST | `/conversations` | Start or reuse a direct conversation | customer | required | { userId } | Conversation | — |
| GET | `/conversations/{id}` | Get a conversation | customer | required | — | ConversationDetail | — |
| GET | `/conversations/{id}/messages` | List messages (cursor) | customer | required | query: cursor | Message[] + meta(cursor) | — |
| POST | `/conversations/{id}/messages` | Send a message | customer | required | SendMessagePayload | Message | `FORBIDDEN` `VALIDATION_ERROR` |
| DELETE | `/messages/{id}` | Delete a message | customer | required | — | Message | — |
| POST | `/messages/{id}/reactions` | Toggle a reaction on a message | customer | required | { emoji } | Message | — |
| POST | `/messages/{id}/star` | Toggle star on a message | customer | required | — | Message | — |
| POST | `/messages/{id}/pin` | Toggle pin on a message | customer | required | — | Message | — |
| PATCH | `/conversations/{id}` | Mute, pin or archive a conversation | customer | required | { isPinned?, isMuted?, isArchived? } | Conversation | — |
| DELETE | `/conversations/{id}` | Delete a conversation for me | customer | required | — | 204 No Content | — |
| POST | `/conversations/{id}/read` | Mark a conversation as read | customer | required | — | 204 No Content | — |
| PATCH | `/conversations/{id}/request` | Accept or decline a message request | customer | required | { action } | Conversation | — |
| GET | `/conversations/{id}/media` | List media shared in a conversation | customer | optional | — | ConversationMediaItem[] | — |
| GET | `/messages/unread-count` | Get unread message count | customer | required | — | { count } | — |
<!-- /endpoints -->

### 2.9 Notifications

**Screens:** notifications drawer with the all and requests tabs, and badges in the header.
**Entities:** Notification (database channel), NotificationPreference, DeviceToken.
**Rules:**
- `segments` lets the UI bold entity names exactly as in the designs. Build them on the server from templates.
- `action: accept_decline` notifications (manager, vendor and collaboration invites) are resolved through `POST /notifications/{id}/actions`. The backend applies the underlying change and sets `actionState`.
- Delivery to push, email, SMS and WhatsApp follows the user's `NotificationPreference`.

<!-- endpoints:Notifications -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/notifications` | List notifications (cursor) | customer | required | query: tab, search, cursor | AppNotification[] + meta(cursor) | — |
| GET | `/notifications/unread-count` | Get unread notification and request counts | customer | required | — | { count, requests } | — |
| POST | `/notifications/read-all` | Mark all notifications as read | customer | required | — | 204 No Content | — |
| PATCH | `/notifications/{id}/read` | Mark one notification as read | customer | required | — | object | — |
| POST | `/notifications/{id}/actions` | Act on a notification (accept, decline, register) | customer | required | { action } | AppNotification | — |
| DELETE | `/notifications/{id}` | Delete a notification | customer | required | — | 204 No Content | — |
<!-- /endpoints -->

### 2.10 Wallet, payouts and subscriptions

**Screens:** wallet (balance, activate, PIN, top up, withdraw, bank accounts, transactions), earn with Wedpluz (promotions), pricing and premium plans, subscription management.
**Entities:** Wallet, LedgerEntry (double-entry), WalletTransaction, BankAccount, WithdrawalRequest, Plan, Subscription, SubscriptionPayment.
**Rules:**
- The wallet balance is derived from an append-only ledger and is never written directly.
- Withdrawals require a verified identity, a set PIN, and a balance at or above the amount. They respect `minWithdrawal`, `maxWithdrawal` and `dailyWithdrawalLimit`.
- Bank account names are resolved through Paystack or Monnify, never typed by the user.
- Promotion earnings become withdrawable after the event's settlement date.

<!-- endpoints:Wallet & Subscriptions -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/wallet` | Get my wallet | customer | required | — | Wallet | — |
| POST | `/wallet/activate` | Activate my wallet (OTP) | customer | required | { otpCode } | Wallet | `OTP_INVALID` `OTP_EXPIRED` `IDENTITY_UNVERIFIED` |
| POST | `/wallet/pin` | Set or change the wallet PIN | customer | required | { pin?, pinConfirmation?, otpCode?, currentPin? } | { pinSet } | `OTP_INVALID` `PIN_INVALID` `VALIDATION_ERROR` |
| GET | `/wallet/transactions` | List wallet transactions | customer | required | query: type, page | WalletTransaction[] + meta(pagination) | — |
| GET | `/wallet/transactions/{id}` | Get a wallet transaction | customer | required | — | WalletTransaction | — |
| GET | `/banks` | List supported banks | customer | required | — | Bank[] | — |
| GET | `/wallet/bank-accounts` | List my payout bank accounts | customer | required | — | BankAccount[] | — |
| POST | `/wallet/bank-accounts/resolve` | Resolve a bank account name | customer | required | { bankCode, accountNumber } | { accountName, bankName } | — |
| POST | `/wallet/bank-accounts` | Add a payout bank account | customer | required | { bankCode, accountNumber, accountName } | BankAccount | — |
| DELETE | `/wallet/bank-accounts/{id}` | Remove a payout bank account | customer | required | — | 204 No Content | — |
| POST | `/wallet/top-ups` | Start a wallet top-up | customer · Idempotency-Key | required | TopUpPayload | { transaction, authorizationUrl } | `VALIDATION_ERROR` `CONFLICT` `PAYMENT_FAILED` |
| POST | `/wallet/top-ups/{id}/verify` | Verify a wallet top-up | customer | required | — | WalletTransaction | — |
| POST | `/wallet/withdrawals` | Withdraw to a bank account | customer · Idempotency-Key | required | WithdrawPayload | WalletTransaction | `INSUFFICIENT_FUNDS` `PIN_INVALID` `IDENTITY_UNVERIFIED` `CONFLICT` `VALIDATION_ERROR` |
| GET | `/plans` | List subscription plans | public | required | — | Plan[] | — |
| GET | `/me/subscription` | Get my subscription | customer | required | — | Subscription | — |
| GET | `/me/subscription/payments` | List my subscription payments | customer | required | — | SubscriptionPayment[] | — |
| POST | `/me/subscription` | Subscribe to or change plan | customer · Idempotency-Key | required | { planId, interval, paymentMethod, idempotencyKey } | { subscription, authorizationUrl } | `VALIDATION_ERROR` `CONFLICT` `PAYMENT_FAILED` |
| DELETE | `/me/subscription` | Cancel my subscription | customer | required | — | Subscription | — |
<!-- /endpoints -->

### 2.11 Pluz Planner (proposed)

**Screens:** planner home, assistant chat, menus, hall layouts, cake and branding design generation.
**Entities:** PlannerChat, PlannerChatMessage, PlannerMenu, HallLayout, PlannerGeneration, PlannerAsset.
**Status:** every operation here is `proposed`. Hall layouts and menus are plain CRUD and low-risk. Chat and generation need an AI provider decision, per-plan quotas and cost controls before implementation. Hall layouts are also used by seat selection, through `EventSchedule.hallLayoutId`.

<!-- endpoints:Pluz Planner -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/planner/assets` | List my planner assets | customer | proposed | query: type, sort | PlannerAssetSummary[] | — |
| DELETE | `/planner/assets/{id}` | Delete a planner asset | customer | proposed | — | 204 No Content | — |
| GET | `/planner/chats` | List planner chats | customer | proposed | — | { id, updatedAt, title }[] | — |
| POST | `/planner/chats` | Create a planner chat | customer | proposed | { title? } | PlannerChat | — |
| GET | `/planner/chats/{id}` | Get a planner chat | customer | proposed | — | PlannerChat | — |
| DELETE | `/planner/chats/{id}` | Delete a planner chat | customer | proposed | — | 204 No Content | — |
| POST | `/planner/chats/{id}/messages` | Send a message to the planner assistant | customer | proposed | { content, attachmentUploadIds?, intent? } | { messages } | — |
| GET | `/planner/menus` | List my menus | customer | proposed | — | PlannerMenu[] | — |
| GET | `/planner/menus/{id}` | Get a menu | customer | proposed | — | PlannerMenu | — |
| POST | `/planner/menus` | Create a menu | customer | proposed | { id?, name?, sections?, currency?, updatedAt? } | PlannerMenu | — |
| PUT | `/planner/menus/{id}` | Update a menu | customer | proposed | { id?, name?, sections?, currency?, updatedAt? } | PlannerMenu | — |
| GET | `/planner/hall-layouts` | List my hall layouts | customer | proposed | — | HallLayout[] | — |
| GET | `/planner/hall-layouts/{id}` | Get a hall layout | customer | proposed | — | HallLayout | — |
| POST | `/planner/hall-layouts` | Create a hall layout | customer | proposed | { id?, name?, width?, height?, totalSeats?, reservedSeats?, tables?, fixtures? } | HallLayout | — |
| PUT | `/planner/hall-layouts/{id}` | Update a hall layout | customer | proposed | { id?, name?, width?, height?, totalSeats?, reservedSeats?, tables?, fixtures? } | HallLayout | — |
| POST | `/planner/generations` | Generate a cake or branding design | customer | proposed | { type, prompt } | PlannerGeneration | — |
<!-- /endpoints -->

---

## 3. Admin API

Every `/admin/*` route needs an **admin token** (separate audience, issued after 2FA) and the listed permission. The console hides controls the admin lacks, but that is cosmetic. Laravel policies must enforce every permission. Every non-GET admin call writes an audit log entry. See [authentication-and-permissions.md](authentication-and-permissions.md#6-admin-rbac) for the permission catalogue and default roles.

### 3.1 Admin authentication

<!-- endpoints:Admin · Auth -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| POST | `/admin/auth/login` | Admin sign in (password, then 2FA code) | public | required | { email, password, otp? } | AdminLoginResult | `UNAUTHENTICATED` `OTP_INVALID` `ACCOUNT_SUSPENDED` `RATE_LIMITED` |
| GET | `/admin/me` | Get the signed-in admin with permissions | admin | required | — | AdminUser | — |
| POST | `/admin/auth/logout` | Admin sign out | admin | required | — | 204 No Content | — |
<!-- /endpoints -->

### 3.2 Executive dashboard

KPIs with period-over-period comparison (`KpiValue.previous` and `changePercent`), alerts, top events, signups by platform, gateway health and recent admin activity. Aggregate with materialised or cached rollups, refreshed every 5–15 minutes. Do not compute from raw tables on each request.

<!-- endpoints:Admin · Dashboard -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/dashboard` | Get executive dashboard metrics | admin · `dashboard.view` | required | query: from, to | ExecutiveDashboard | — |
<!-- /endpoints -->

### 3.3 Users

Search by name, email, phone or username. Filter by status, role, identity status, plan, signup source and date range. Suspension needs a reason, revokes all customer tokens and ends realtime sessions.

<!-- endpoints:Admin · Users -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/users` | List users | admin · `users.view` | required | query: search, status, role, identityStatus, plan, source, dateFrom, dateTo, sort, order, page, perPage | AdminUserRecord[] + meta(pagination) | — |
| GET | `/admin/users/{id}` | Get a user | admin · `users.view` | required | — | { ticketsCount, eventsCount, reportsCount, totalSpent, signupSource, suspendedReason, deletionRequest, firstName, lastName, email, phone, dateOfBirth, emailVerifiedAt, phoneVerifiedAt, identityStatus, interests, roles, status, plan, locale, city, countryCode, businessProfileId, walletEnabled, createdAt, lastSeenAt?, id, displayName, username?, avatarUrl, isVerified?, isVendor? } | — |
| GET | `/admin/users/{id}/activity` | List a user's activity | admin · `users.view` | required | query: page | UserActivityEntry[] + meta(pagination) | — |
| GET | `/admin/users/{id}/tickets` | List a user's bookings | admin · `users.view` | required | query: page | AdminBookingRecord[] + meta(pagination) | — |
| GET | `/admin/users/{id}/reports` | List reports involving a user | admin · `users.view` | required | — | ContentReport[] | — |
| POST | `/admin/users/{id}/suspend` | Suspend a user | admin · `users.suspend` | required | { reason } | AdminUserRecord | — |
| POST | `/admin/users/{id}/reactivate` | Reactivate a user | admin · `users.suspend` | required | — | AdminUserRecord | — |
| PATCH | `/admin/users/{id}/roles` | Set a user's platform roles | admin · `users.manage` | required | { roles } | AdminUserRecord | — |
| POST | `/admin/users/{id}/deletion/approve` | Approve an account deletion early | admin · `users.manage` | required | — | AdminUserRecord | — |
| POST | `/admin/users/{id}/deletion/reject` | Reject an account deletion request | admin · `users.manage` | required | — | AdminUserRecord | — |
| GET | `/admin/deletion-requests` | List account deletion requests | admin · `users.view` | required | query: page | AdminUserRecord[] + meta(pagination) | — |
<!-- /endpoints -->

### 3.4 Events and categories

Review queue (`status=pending_review`), approval or rejection with reason, suspension and restoration, and featuring. A category that still has events cannot be deleted; deactivate it instead (`isActive: false`).

<!-- endpoints:Admin · Events -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/events` | List events | admin · `events.view` | required | query: search, status, categoryId, attendanceMode, featured, dateFrom, dateTo, sort, order, page, perPage | AdminEventRecord[] + meta(pagination) | — |
| GET | `/admin/events/{id}` | Get an event with bookings and reports | admin · `events.view` | required | — | { description, visibility, approvalRequired, guestLimit, allowGuestInvites, maxAdditionalGuests, isAdultOnly, organizer, schedules, subEvents, ticketTypes, menu, promotion, stats, gallery, tags, communityId, myRequestStatus, myTicketId, createdAt, updatedAt, publishedAt, city, slug, status, id, category, title, startsAt, endsAt, coverUrl, isFree, attendanceMode, currency, minPrice, isSaved, isFeatured, isPromoted, ticketsSold, revenue, reportsCount, submittedAt, reviewedBy, rejectionReason, source, bookings, reports } | — |
| POST | `/admin/events/{id}/approve` | Approve an event pending review | admin · `events.moderate` | required | { reason? } | AdminEventRecord | — |
| POST | `/admin/events/{id}/reject` | Reject an event pending review | admin · `events.moderate` | required | { reason } | AdminEventRecord | — |
| POST | `/admin/events/{id}/suspend` | Suspend a live event | admin · `events.moderate` | required | { reason } | AdminEventRecord | — |
| POST | `/admin/events/{id}/restore` | Restore a suspended event | admin · `events.moderate` | required | { reason? } | AdminEventRecord | — |
| POST | `/admin/events/{id}/feature` | Feature an event | admin · `events.feature` | required | { reason? } | AdminEventRecord | — |
| POST | `/admin/events/{id}/unfeature` | Unfeature an event | admin · `events.feature` | required | { reason? } | AdminEventRecord | — |
| GET | `/admin/categories` | List event categories (admin) | admin · `events.view` | required | — | EventCategory[] | — |
| POST | `/admin/categories` | Create an event category | admin · `categories.manage` | required | { name, icon? } | EventCategory | — |
| PUT | `/admin/categories/{id}` | Update an event category | admin · `categories.manage` | required | { id?, name?, slug?, icon?, isActive?, eventsCount? } | EventCategory | — |
| DELETE | `/admin/categories/{id}` | Delete an event category | admin · `categories.manage` | required | — | 204 No Content | — |
<!-- /endpoints -->

### 3.5 Organizers and vendors

Verification documents, verification decisions, suspension, and per-organiser commission overrides (`percent: null` reverts to the category or platform rule).

<!-- endpoints:Admin · Organizers & Vendors -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/organizers` | List organizers and vendors | admin · `organizers.view` | required | query: search, page, perPage, sort, order, type, vendorStatus, identityStatus | AdminOrganizerRecord[] + meta(pagination) | — |
| GET | `/admin/organizers/{id}` | Get an organizer or vendor | admin · `organizers.view` | required | — | { id, user, businessName, type, vendorStatus, identityStatus, eventsCount, ticketsSold, grossRevenue, commissionPercent, pendingSettlement, totalPaidOut, rating, joinedAt, verificationDocuments, events, settlements, vendorProfile } | — |
| POST | `/admin/organizers/{id}/reject` | Reject an organizer or vendor verification | admin · `organizers.verify` | required | { reason } | AdminOrganizerRecord | — |
| POST | `/admin/organizers/{id}/suspend` | Suspend an organizer or vendor | admin · `organizers.manage` | required | { reason } | AdminOrganizerRecord | — |
| POST | `/admin/organizers/{id}/verify` | Verify an organizer or vendor | admin · `organizers.verify` | required | { reason? } | AdminOrganizerRecord | — |
| POST | `/admin/organizers/{id}/reactivate` | Reactivate an organizer or vendor | admin · `organizers.manage` | required | { reason? } | AdminOrganizerRecord | — |
| PUT | `/admin/organizers/{id}/commission` | Set an organizer commission override | admin · `finance.commission.manage` | required | { percent } | AdminOrganizerRecord | — |
<!-- /endpoints -->

### 3.6 Bookings, disputes, QR validations and inventory

Refunds issued here go through the original payment provider and create a `RefundRecord`. The refund amount can never exceed the captured amount minus earlier refunds.

<!-- endpoints:Admin · Bookings -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/bookings` | List bookings | admin · `bookings.view` | required | query: search, status, eventId, provider, dateFrom, dateTo, page, perPage | AdminBookingRecord[] + meta(pagination) | — |
| GET | `/admin/bookings/{id}` | Get a booking with tickets and timeline | admin · `bookings.view` | required | — | { id, reference, event, buyer, ticketsCount, total, serviceFee, currency, status, paymentMethod, provider, providerReference, checkedInCount, source, createdAt, disputeId, tickets, timeline, dispute } | — |
| POST | `/admin/bookings/{id}/refund` | Issue a full or partial refund | admin · `refunds.approve` | required | { amount, reason } | RefundRecord | `CONFLICT` `VALIDATION_ERROR` `PAYMENT_FAILED` |
| POST | `/admin/bookings/{id}/resend` | Resend booking confirmation and tickets | admin · `bookings.manage` | required | — | { sent } | — |
| GET | `/admin/disputes` | List disputes | admin · `bookings.view` | required | query: search, page, perPage, sort, order, status | Dispute[] + meta(pagination) | — |
| PATCH | `/admin/disputes/{id}` | Update a dispute | admin · `bookings.manage` | required | { status?, assignToMe?, note? } | Dispute | — |
| GET | `/admin/check-ins` | List QR validations across events | admin · `bookings.view` | required | query: search, page, perPage, sort, order, eventId, result, dateFrom, dateTo | { id, event, attendee, ticketCode, checkedInBy, method, device, checkedInAt, result }[] + meta(pagination) | — |
| GET | `/admin/inventory` | List ticket inventory | admin · `bookings.view` | required | query: search, page, perPage, sort, order, eventId, lowStock | { id, event, ticketType, price, quantity, sold, remaining, salesEndAt, sellThrough }[] + meta(pagination) | — |
<!-- /endpoints -->

### 3.7 Finance

Transactions with reconciliation, settlements, payouts with four-eyes approval and 2FA, refunds, commission rules and gateway health. See [business-rules.md](business-rules.md#settlements-and-payouts).

<!-- endpoints:Admin · Finance -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/finance/summary` | Get finance summary | admin · `finance.view` | required | query: from, to | FinanceSummary | — |
| GET | `/admin/finance/transactions` | List financial transactions | admin · `finance.view` | required | query: search, page, perPage, sort, order, type, provider, status, reconciliationStatus, dateFrom, dateTo | FinanceTransaction[] + meta(pagination) | — |
| POST | `/admin/finance/transactions/{id}/reconcile` | Reconcile a transaction | admin · `finance.reconcile` | required | { status, note? } | FinanceTransaction | — |
| GET | `/admin/finance/settlements` | List organizer settlements | admin · `finance.settlements` | required | query: search, page, perPage, sort, order, status, organizerId, dateFrom, dateTo | Settlement[] + meta(pagination) | — |
| POST | `/admin/finance/settlements/{id}/hold` | Put a settlement on hold | admin · `finance.settlements` | required | { reason } | Settlement | — |
| POST | `/admin/finance/settlements/{id}/release` | Release a held settlement | admin · `finance.settlements` | required | — | Settlement | — |
| GET | `/admin/finance/payouts` | List payouts | admin · `finance.view` | required | query: search, page, perPage, sort, order, status, dateFrom, dateTo | Payout[] + meta(pagination) | — |
| POST | `/admin/finance/payouts` | Create a payout from settlements | admin · `finance.settlements` | required | { settlementIds } | Payout | — |
| POST | `/admin/finance/payouts/{id}/approve` | Approve a payout (2FA) | admin · `finance.payouts.approve` | required | { otp } | Payout | `OTP_INVALID` `CONFLICT` `FORBIDDEN` |
| POST | `/admin/finance/payouts/{id}/reject` | Reject a payout | admin · `finance.payouts.approve` | required | { reason } | Payout | — |
| GET | `/admin/finance/refunds` | List refunds | admin · `refunds.view` | required | query: search, page, perPage, sort, order, status, dateFrom, dateTo | RefundRecord[] + meta(pagination) | — |
| POST | `/admin/finance/refunds/{id}/approve` | Approve a refund request | admin · `refunds.approve` | required | — | RefundRecord | — |
| POST | `/admin/finance/refunds/{id}/reject` | Reject a refund request | admin · `refunds.approve` | required | — | RefundRecord | — |
| GET | `/admin/finance/commissions` | List commission rules | admin · `finance.view` | required | — | CommissionRule[] | — |
| PUT | `/admin/finance/commissions/{id}` | Update a commission rule | admin · `finance.commission.manage` | required | { percent?, fixedFee? } | CommissionRule | — |
| POST | `/admin/finance/commissions` | Create a commission rule | admin · `finance.commission.manage` | required | { scope, scopeId, scopeLabel, percent, fixedFee } | CommissionRule | — |
| GET | `/admin/finance/gateways` | Get payment gateway health | admin · `finance.view` | required | — | { provider, successRate, avgLatencyMs, volume, failures, status, series }[] | — |
<!-- /endpoints -->

### 3.8 Moderation

Reports queue (assignment, priority, actions with notes) and community oversight. Actions on content propagate: `removed` hides the target everywhere and `suspended` suspends the reported user.

<!-- endpoints:Admin · Moderation -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/moderation/reports` | List content reports | admin · `moderation.view` | required | query: search, page, perPage, sort, order, status, priority, targetType, assigned | ContentReport[] + meta(pagination) | — |
| GET | `/admin/moderation/reports/{id}` | Get a content report with history | admin · `moderation.view` | required | — | { id, targetType, targetId, targetPreview, reporter, reportedUser, reason, details, status, priority, assignedTo, resolution, createdAt, history } | — |
| PATCH | `/admin/moderation/reports/{id}` | Assign or reprioritise a report | admin · `moderation.act` | required | { assignToMe?, priority?, status? } | ContentReport | — |
| POST | `/admin/moderation/reports/{id}/actions` | Take moderation action on a report | admin · `moderation.act` | required | { action, note } | ContentReport | — |
| GET | `/admin/communities` | List communities (moderation) | admin · `moderation.view` | required | query: search, page, perPage, sort, order, status | AdminCommunityRecord[] + meta(pagination) | — |
| POST | `/admin/communities/{id}/suspend` | Suspend a community | admin · `moderation.act` | required | — | AdminCommunityRecord | — |
| POST | `/admin/communities/{id}/restore` | Restore a community | admin · `moderation.act` | required | — | AdminCommunityRecord | — |
| POST | `/admin/communities/{id}/archive` | Archive a community | admin · `moderation.act` | required | — | AdminCommunityRecord | — |
<!-- /endpoints -->

### 3.9 Notifications and campaigns

Campaign audiences are resolved server-side at send time. `estimatedSize` is a preview. Sending is queued and throttled per channel. Templates use `{{variable}}` placeholders listed in `variables`.

<!-- endpoints:Admin · Notifications -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/notifications/campaigns` | List notification campaigns | admin · `notifications.view` | required | query: search, page, perPage, sort, order, status | NotificationCampaign[] + meta(pagination) | — |
| GET | `/admin/notifications/campaigns/{id}` | Get a campaign with delivery stats | admin · `notifications.view` | required | — | { id, name, channels, audience, templateId, subject, body, status, scheduledAt, sentAt, stats, createdBy, createdAt, deliveryByChannel } | — |
| POST | `/admin/notifications/campaigns` | Create a campaign | admin · `notifications.send` | required | { id?, name, channels, audience?, templateId?, subject?, body, status?, scheduledAt?, sentAt?, stats?, createdBy?, createdAt? } | NotificationCampaign | — |
| POST | `/admin/notifications/campaigns/{id}/send` | Send or schedule a campaign | admin · `notifications.send` | required | — | NotificationCampaign | — |
| POST | `/admin/notifications/campaigns/{id}/cancel` | Cancel a scheduled campaign | admin · `notifications.send` | required | — | NotificationCampaign | — |
| POST | `/admin/notifications/test` | Send a test notification to myself | admin · `notifications.send` | optional | { channel, body } | { sent } | — |
| GET | `/admin/notifications/templates` | List notification templates | admin · `notifications.view` | required | — | NotificationTemplate[] | — |
| PUT | `/admin/notifications/templates/{id}` | Update a notification template | admin · `notifications.send` | required | { id?, key?, name?, channel?, subject?, body?, variables?, isActive?, updatedAt? } | NotificationTemplate | — |
| POST | `/admin/notifications/templates` | Create a notification template | admin · `notifications.send` | required | { key, name, channel, subject?, body } | NotificationTemplate | — |
<!-- /endpoints -->

### 3.10 Platform configuration

General settings, payment configuration (enabled providers, service fee, refund window, settlement delay, withdrawal limits), feature flags, app versions, legal links, banners and CMS pages. Provider **secrets are never part of these payloads**. They live in the backend environment or a secrets manager.

<!-- endpoints:Admin · Platform Configuration -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/settings` | Get platform settings | admin · `settings.view` | required | — | PlatformSettings | — |
| PUT | `/admin/settings` | Update platform settings | admin · `settings.manage` | required | { general?, payments?, features?, app?, legal? } | PlatformSettings | — |
| GET | `/admin/banners` | List promotional banners | admin · `settings.view` | required | — | Banner[] | — |
| POST | `/admin/banners` | Create a banner | admin · `settings.manage` | required | { id?, title?, subtitle?, imageUrl?, ctaLabel?, ctaUrl?, placement?, audience?, startsAt?, endsAt?, isActive?, priority?, impressions?, clicks? } | Banner | — |
| PUT | `/admin/banners/{id}` | Update a banner | admin · `settings.manage` | required | { id?, title?, subtitle?, imageUrl?, ctaLabel?, ctaUrl?, placement?, audience?, startsAt?, endsAt?, isActive?, priority?, impressions?, clicks? } | Banner | — |
| DELETE | `/admin/banners/{id}` | Delete a banner | admin · `settings.manage` | required | — | 204 No Content | — |
| GET | `/admin/pages` | List CMS pages | admin · `settings.view` | required | — | CmsPage[] | — |
| PUT | `/admin/pages/{slug}` | Update a CMS page | admin · `settings.manage` | required | { title?, content? } | CmsPage | — |
<!-- /endpoints -->

### 3.11 Roles, permissions and audit

Roles are named sets of permission keys. System roles (`isSystem`) cannot be deleted. An admin cannot remove `roles.manage` from their own last role. Audit and security logs are append-only.

<!-- endpoints:Admin · Roles, Permissions & Audit -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/permissions` | List the permission catalogue | admin · `roles.manage` | required | — | Permission[] | — |
| GET | `/admin/roles` | List admin roles | admin · `roles.manage` | required | — | Role[] | — |
| POST | `/admin/roles` | Create an admin role | admin · `roles.manage` | required | { name, description?, permissions } | Role | — |
| PUT | `/admin/roles/{id}` | Update an admin role | admin · `roles.manage` | required | { name?, description?, permissions? } | Role | — |
| DELETE | `/admin/roles/{id}` | Delete an admin role | admin · `roles.manage` | required | — | 204 No Content | — |
| GET | `/admin/admins` | List administrators | admin · `roles.manage` | required | — | AdminUser[] | — |
| POST | `/admin/admins` | Invite an administrator | admin · `roles.manage` | required | { firstName, lastName, email, roleIds } | AdminUser | — |
| PATCH | `/admin/admins/{id}` | Change an administrator's roles or status | admin · `roles.manage` | required | { roleIds?, status? } | AdminUser | — |
| GET | `/admin/audit-logs` | List audit logs | admin · `audit.view` | required | query: search, page, perPage, sort, order, module, actorId, targetType, targetId, dateFrom, dateTo | AuditLogEntry[] + meta(pagination) | — |
| GET | `/admin/security-logs` | List security logs | admin · `audit.view` | required | query: search, page, perPage, sort, order, event, dateFrom, dateTo | SecurityLogEntry[] + meta(pagination) | — |
<!-- /endpoints -->

### 3.12 Reports and exports

Synchronous `run` for on-screen tables and charts, capped at 10,000 rows. Asynchronous `export` returns a job; files land in a private bucket behind signed URLs that expire after 15 minutes. Exports containing personal data are audit-logged.

<!-- endpoints:Admin · Reports -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/reports/definitions` | List report definitions | admin · `reports.view` | required | — | ReportDefinition[] | — |
| POST | `/admin/reports/{key}/run` | Run a report | admin · `reports.view` | required | ReportQuery | ReportResult | — |
| POST | `/admin/reports/{key}/export` | Export a report (async job) | admin · `reports.export` | required | { from, to, groupBy?, filters?, format } | ExportJob | — |
| GET | `/admin/exports/{id}` | Get an export job | admin · `reports.export` | required | — | ExportJob | — |
<!-- /endpoints -->

### 3.13 Customer support

<!-- endpoints:Admin · Support -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/admin/support/tickets` | List support tickets | admin · `support.view` | required | query: search, page, perPage, sort, order, status, priority, category, assigned | SupportTicket[] + meta(pagination) | — |
| GET | `/admin/support/tickets/{id}` | Get a support ticket with messages | admin · `support.view` | required | — | { id, reference, user, subject, category, status, priority, assignedTo, source, messagesCount, createdAt, updatedAt, messages } | — |
| PATCH | `/admin/support/tickets/{id}` | Update a support ticket | admin · `support.manage` | required | { status?, priority?, assignToMe? } | SupportTicket | — |
| POST | `/admin/support/tickets/{id}/messages` | Reply to a support ticket | admin · `support.manage` | required | { body } | { id, body } | — |
<!-- /endpoints -->

---

## 4. Proposed social contracts

The brief lists social feeds, posts and comments, likes and reactions, and connections and followers as API modules. The current designs contain **none** of these. Likes and reactions are covered by existing contracts: message reactions, status likes and work likes. The operations below are proposals so these features follow the same conventions if product approves them. The web build does not call them.

<!-- endpoints:Proposed · Social graph & feed -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| GET | `/feed` | Get my home feed (posts from communities and people I follow) | customer | proposed | query: cursor, perPage | Post[] + meta(cursor) | — |
| GET | `/communities/{id}/posts` | List community posts | customer | proposed | query: cursor, perPage | Post[] + meta(cursor) | — |
| POST | `/communities/{id}/posts` | Create a community post | customer | proposed | { body?, mediaUploadIds? } | Post | — |
| DELETE | `/posts/{id}` | Delete my post (or moderate as community admin) | customer | proposed | — | 204 No Content | — |
| POST | `/posts/{id}/reactions` | Toggle a reaction on a post | customer | proposed | { emoji } | Post | — |
| GET | `/posts/{id}/comments` | List comments on a post | customer | proposed | query: cursor, perPage | PostComment[] + meta(cursor) | — |
| POST | `/posts/{id}/comments` | Comment on a post | customer | proposed | { body, parentId? } | PostComment | — |
| DELETE | `/comments/{id}` | Delete my comment | customer | proposed | — | 204 No Content | — |
| POST | `/users/{id}/follow` | Follow a user | customer | proposed | — | FollowState | — |
| DELETE | `/users/{id}/follow` | Unfollow a user | customer | proposed | — | FollowState | — |
| GET | `/users/{id}/followers` | List a user's followers | customer | proposed | query: cursor, perPage | UserSummary[] + meta(cursor) | — |
| GET | `/users/{id}/following` | List who a user follows | customer | proposed | query: cursor, perPage | UserSummary[] + meta(cursor) | — |
<!-- /endpoints -->

---

## 5. Backend-only endpoints

### 5.1 Provider webhooks

No Wedpluz client calls these. Each one verifies the provider signature before trusting the payload, deduplicates on the provider event ID, queues processing, and returns `200` quickly. Details are in [integrations.md](integrations.md).

<!-- endpoints:Webhooks (backend-only) -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| POST | `/webhooks/paystack` | Paystack webhook | signature | required | object | Accepted. | — |
| POST | `/webhooks/stripe` | Stripe webhook | signature | required | object | Accepted. | — |
| POST | `/webhooks/paypal` | Paypal webhook | signature | required | object | Accepted. | — |
| POST | `/webhooks/monnify` | Monnify webhook | signature | required | object | Accepted. | — |
| POST | `/webhooks/primely` | Primely webhook | signature | proposed | object | Accepted. | — |
| POST | `/webhooks/zeptomail` | Zeptomail webhook | signature | optional | object | Accepted. | — |
| POST | `/webhooks/termii` | Termii webhook | signature | optional | object | Accepted. | — |
| POST | `/webhooks/twilio` | Twilio webhook | signature | optional | object | Accepted. | — |
| POST | `/webhooks/whatsapp` | Whatsapp webhook | signature | optional | object | Accepted. | — |
| GET | `/webhooks/whatsapp` | WhatsApp webhook verification handshake | signature | optional | query: hub.mode, hub.verify_token, hub.challenge | Echoes `hub.challenge` as text/plain when the verify token matches. | — |
<!-- /endpoints -->

### 5.2 System

<!-- endpoints:System -->
| Method | Path | Summary | Auth | Status | Request | Response | Domain errors |
|---|---|---|---|---|---|---|---|
| POST | `/broadcasting/auth` | Authorise a private realtime channel | customer | proposed | { socket_id, channel_name } | Channel signature. | — |
| GET | `/health` | Liveness/readiness probe | public | optional | — | Healthy. | — |
<!-- /endpoints -->

---

## 6. Brief coverage

| Module in the brief | Covered by |
|---|---|
| Authentication and authorization | §2.1, §3.1, [authentication-and-permissions.md](authentication-and-permissions.md) |
| User management | §3.3 |
| User profiles | §2.2 |
| Social authentication | `POST /auth/social` |
| Event discovery | §2.3 |
| Event management | §2.5, §3.4 |
| Event categories | `GET /categories`, §3.4 |
| Ticket management | §2.4, §3.6 inventory |
| Booking and checkout | §2.4 |
| Payment processing and verification | §2.4, §5.1 |
| Refunds and cancellations | `POST /tickets/{id}/cancel`, §3.6, §3.7 |
| QR code ticket verification | `POST /organizer/events/{id}/check-ins`, `GET /admin/check-ins` |
| Organizer management | §2.5, §3.5 |
| Vendor management | §2.6, §3.5 |
| Communities | §2.7, §3.8 |
| Social feeds, posts and comments, connections and followers | §4 (proposed, not in designs) |
| Likes and reactions | message reactions, status likes, work likes, §4 post reactions |
| Messaging | §2.8 |
| Notifications | §2.9, §3.9 |
| Media uploads | §1.6, `POST /uploads` |
| Financial transactions, commissions, settlements and payouts | §2.10, §3.7 |
| Administrative dashboards | §3.2 |
| Reports and analytics | §3.12 |
| Roles and permissions, audit logs | §3.11 |
| Platform configurations | §3.10 |
| Customer support | `POST /support/tickets`, §3.13 |
| Account deletion and privacy requests | `/me/deletion-request`, `/me/privacy`, `/admin/deletion-requests` |
