# Business rules

> Contract proposal. These are the rules the frontend assumes the backend enforces. Where the brief or designs do not settle a rule, it is marked **Proposed default** and needs product sign-off. The frontend only displays outcomes: it never decides availability, prices, payment success, refund eligibility or settlement.

Configurable values live in `PlatformSettings` (admin, Platform Configuration). Defaults used by the development fixtures are shown in brackets.

| Setting | Default |
|---|---|
| `payments.serviceFeePercent` | 3% |
| `payments.serviceFeeFixed` | ₦100 (`10000` kobo) |
| `payments.passFeesToBuyer` | true |
| `payments.refundWindowHours` | 48 |
| `payments.settlementDelayDays` | 3 |
| `payments.minWithdrawal` | ₦1,000 |
| `payments.maxWithdrawal` | ₦5,000,000 |
| Quote hold | 10 minutes |
| Account deletion grace | 30 days |

---

## Event lifecycle

```
draft ──publish──▶ pending_review ──approve──▶ live ──(end time passes)──▶ completed
  │                      │ reject                 │ cancel (organiser)        
  │                      ▼                        ▼                           
  └──delete          rejected                 cancelled                       
                                              live ──suspend (admin)──▶ suspended ──restore──▶ live
```

- **Draft.** Visible only to the organiser team. It can be edited freely and deleted (`DELETE /organizer/events/{id}` only while in `draft`).
- **Publish** validates completeness: a title, at least one schedule, and at least one active ticket type or `isFree`. Each schedule needs a start and either a physical venue or an online link. Ticket `salesEndAt` must not be later than the schedule end.
- **Review (Proposed default).** An event goes to `pending_review` when:
  - the organiser is not identity-verified, or
  - it is the organiser's first paid event, or
  - it is `isAdultOnly`, or
  - the category is flagged in settings.

  Otherwise it goes straight to `live`. Review SLA: alert admins after 24 hours and notify the organiser after 48 hours. The dashboard alert reads "events awaiting review for more than 24h".
- **Reject** needs a reason, which is shown to the organiser. A rejected event returns to editable and can be republished.
- **Live** events can still be edited. Changes to date, time or venue notify ticket holders (`event_updated`). Removing a ticket type that has sales is not allowed; deactivate it instead.
- **Completed** is set automatically after the last schedule ends; the organiser can also mark it manually. It starts the settlement clock.
- **Cancelled by the organiser** needs a `cancellationReason`. It triggers automatic full refunds of all paid orders (including the service fee, Proposed default), notifies holders (`event_cancelled`), closes sales, and archives the community after 7 days.
- **Suspended by an admin** hides the event, stops sales and freezes its settlement until restored. Existing tickets stay valid unless an admin also cancels.
- **Publishing** creates the event community if the organiser enabled it.

## Ticket inventory and checkout

- **Quote.** `POST /checkout/quotes` is the only place prices are computed. The order of operations:
  1. Validate that the event is `live` and that the buyer is allowed: not the organiser, approved if `approvalRequired`, and 18+ if `isAdultOnly`.
  2. For each line, check that the ticket type is active, inside its sales window and within `perOrderLimit`, and that remaining stock (`quantity − sold − active holds`) is at least the requested quantity.
  3. `subtotal = Σ price × qty + Σ food price × qty`.
  4. Apply a promo: percentage or fixed, capped at the subtotal, with validity window, usage limits and scope to event or ticket type.
  5. `serviceFee = round(subtotal × serviceFeePercent / 100) + serviceFeeFixed` when `subtotal > 0` and `passFeesToBuyer`; otherwise 0, with the fee taken from the organiser in settlement.
  6. `total = subtotal − discount + serviceFee`, never negative.
  7. Create a hold for the quantities until `expiresAt` (10 minutes). Holds count against stock.
- **Referral attribution.** `referralCode` on the quote is a promoter `shareCode` from a share link. It is valid only if the event's promotion is enabled and the promoter is enrolled and not the buyer. Invalid codes are ignored silently, never an error. Attribution is recorded on the order.
- **Seats.** When any selected ticket type has `seatSelection`, the quote returns `requiresSeatSelection`. Seats come from the schedule's hall layout. `POST /orders` must atomically reserve the chosen seats with a unique `(schedule_id, seat_id)` constraint on active reservations, and fail with `409 SEAT_TAKEN` if any is taken. The number of seats must equal the ticket count for seated types.
- **Order.** `POST /orders` needs a valid, unexpired quote owned by the caller, plus attendee details. `additionalGuests.length` must not exceed `maxAdditionalGuests` and must be allowed by `allowGuestInvites`. It converts the hold into the order's reservation and creates a `PaymentIntent`. Idempotent on `Idempotency-Key`.
- **Free orders** (`total = 0`) complete immediately: status `paid`, tickets issued, no provider call.
- **Expiry.** Orders unpaid when the hold ends move to `expired`, and stock and seats are released. A scheduled job runs every minute.
- **Oversell protection.** Decrement stock with a conditional update (`UPDATE … SET sold = sold + n WHERE id = ? AND quantity - sold >= n`) or a row lock inside the payment-confirmation transaction. Never read-then-write.
- **Guest limit.** `guestLimit` caps total admitted people (tickets plus additional guests) across all ticket types.

## Payments

- An order becomes `paid` only after the backend verifies the provider transaction: amount, currency, reference and status. This happens via verify-payment or a webhook, whichever is first, and the step is idempotent.
- On confirmation, in one database transaction:
  1. Mark the order `paid`.
  2. Increment `sold`.
  3. Issue tickets, one per admitted person, each with a unique `code` and a signed `qrPayload`.
  4. Write ledger entries.
  5. Record promoter attribution.

  After commit, send the confirmation email, push and realtime events.
- Amount mismatches mark the payment `mismatch`, raise a `SystemAlert` and do **not** issue tickets.
- Wallet payments debit the ledger inside the order transaction and fail with `402 INSUFFICIENT_FUNDS` if the balance is short.

## Tickets and QR check-in

- **QR payload.** The backend generates an opaque, signed string, recommended as `WP1.<ticketId>.<scheduleId|*>.<hmac>`. The QR is never trusted without server validation. The short `code` (e.g. `DT78-216-M0`) is unique and supports manual entry.
- **Validation** (`POST /organizer/events/{id}/check-ins`):
  - The caller must be the organiser or a manager with `scan_tickets`.
  - Result reasons, in priority order: `not_found`, then `wrong_event`, then `cancelled` or `expired` (ticket refunded, transferred away or event cancelled), then `wrong_day` (ticket scoped to another schedule), then `already_checked_in` (return the original `checkedInAt`), then `ok`.
  - `ok` must be **atomic**: `UPDATE tickets SET status='checked_in', checked_in_at=now(), checked_in_by=? WHERE id=? AND status='valid'`. If zero rows changed, answer `already_checked_in`. This prevents double admission from two scanners.
  - Every attempt, including failures, is recorded for the admin QR validations view, with device and method (`scan` or `manual`).
- **Transfer** (`proposed`) is allowed only for `valid` tickets before the event starts, and only if the organiser allows it. The old QR is invalidated and a new ticket and QR are issued to the recipient (by email). The status of the original becomes `transferred`.
- **Downloads.** Ticket PDFs and receipts come from signed, expiring URLs.

## Refunds and cancellations

- **Buyer cancellation** (`POST /tickets/{id}/cancel`) cancels the **whole order**, meaning all of its tickets, as in the design flow. It is not allowed for `checked_in` or already cancelled tickets (`409`).
- **Eligibility. Proposed default; product to confirm.**
  - More than `refundWindowHours` (48h) before the event start: full refund of the ticket subtotal and food. The service fee is non-refundable.
  - Inside the window: cancellation is allowed but not refundable, unless the organiser enabled "always refundable".
  - Free tickets: cancellation releases the place; there is no refund.
  - Organiser-cancelled or admin-cancelled events: full refund including the service fee, automatically.
- **Processing.**
  1. Create a `Refund` (`requested`, then `processing`) through the original provider, or to the wallet for wallet payments.
  2. Mark it `completed` on the provider webhook. On failure, flag it for an admin.
  3. Decrement `sold`, release seats, and reverse the promoter commission if the commission is not yet settled.
- **Admin refunds** (`POST /admin/bookings/{id}/refund`) may be partial. Cumulative refunds can never exceed the captured amount. A reason is mandatory, and the refund is audit-logged.
- **Refund requests** that need approval appear in `GET /admin/finance/refunds` (`requested`); `approve` or `reject` them with `refunds.approve`.
- The frontend shows `Ticket.refund` exactly as returned. It never computes refundable amounts.

## Organizer collaboration

- Managers and vendors are invited, appear as `pending`, and get a notification with accept or decline (`action: accept_decline`). On acceptance they gain access according to [authentication-and-permissions.md](authentication-and-permissions.md#5-event-level-roles-customer-side).
- Only the organiser can change manager access or remove managers. A manager cannot remove the organiser.
- **Tasks.** Assignees must be the organiser, managers or assigned vendors of the event. `isOverdue = dueAt < now && status != done`. Completing a task sets `completedAt`.
- **Activity log.** Write an entry for every significant organiser-side change: edit, publish, request decision, check-in, manager or vendor change, task change, promotion change.
- **Attendance requests.** Approval lets the user proceed to checkout (paid events) or issues a ticket (free events, Proposed default). Declining notifies the user. Bulk decisions apply the same rules per request.

## Promotions (earn with Wedpluz)

- The organiser enables promotion with `commissionPercent` between 1 and 50. They may set `targetSignups` and `promoterLimit`.
- A user joins via `POST /events/{id}/promotions/join` and receives a unique `shareCode` and `shareLink` (`/events/{slug}?ref=CODE`).
- Commission is `commissionPercent` × the **ticket subtotal** of attributed paid orders, excluding service fee and food (Proposed default). It is reversed if the order is refunded before settlement.
- Earnings are `pending` until the event's settlement becomes eligible, then credited to the promoter's wallet (`promotion_earning`) and `withdrawable`.
- The organiser's settlement deducts promoter commissions.

## Wallet

- The balance is **derived from an append-only double-entry ledger**. Never update a balance column directly; if a cached balance exists, update it in the same transaction as the ledger entry.
- `pendingBalance` holds credits not yet withdrawable: unsettled promotion earnings and top-ups awaiting confirmation.
- **Activation** needs an OTP (`wallet_setup`). **PIN** is 4 digits, hashed, and changing it needs the current PIN or an OTP.
- **Top-up.** Idempotent. Credit only after provider confirmation (webhook or verify).
- **Withdrawal.** Requirements:
  - Identity `verified`.
  - PIN correct, with 5 failures locking for 30 minutes.
  - `minWithdrawal ≤ amount ≤ min(maxWithdrawal, balance, remaining dailyWithdrawalLimit)`.
  - The destination is a resolved bank account owned by the user.

  Debit the balance into a `withdrawal` hold immediately. Then pay out via Monnify or Paystack transfer. On `transfer.success` mark it `successful`; on failure or reversal, re-credit and mark it `reversed`. Idempotent on `Idempotency-Key`.
- **Bank accounts.** The account name is resolved through the provider (`/wallet/bank-accounts/resolve`) and stored as returned. Users cannot type a name. A user has at most 3 accounts, one of them default.

## Settlements and payouts

- **One settlement per event per organiser**, created when the event is `completed` (or for each schedule of long-running events, Proposed default).
- `netPayable = grossSales − refunds − platformCommission − gatewayFees − promoterCommissions` (plus or minus manual adjustments, with audit).
- **Commission rule precedence:** organiser override, then category rule, then platform rule. Snapshot the rule on each order at purchase time; later changes do not apply retroactively.
- A settlement becomes `ready` `settlementDelayDays` (3) after the event ends, provided there are no open disputes or chargebacks on its orders. Otherwise it stays `pending`, and the dashboard shows why.
- **Hold and release.** Admins with `finance.settlements` may hold a settlement with a reason (`on_hold`) and release it. Suspended events or organisers hold automatically.
- **Payouts.**
  1. An admin with `finance.settlements` creates a payout from one or more `ready` settlements of the **same organiser** (`requested`).
  2. A **different** admin with `finance.payouts.approve` approves it with a fresh 2FA code (`approved`, then `processing`).
  3. The provider transfer completes (`paid`; the settlements become `paid`) or fails (`failed`; the settlements return to `ready` with `failureReason`).
  4. Rejection needs a reason.
- **Payouts go only to the organiser's verified bank account.** Changing payout bank details triggers a 48-hour payout cool-down (Proposed default) and a notification.
- **Reconciliation.** Daily jobs match provider settlement reports to `Payment` records and set `reconciliationStatus`. Admins resolve `mismatch` rows manually with a note.

## Subscriptions (premium plans)

- Plans: `free`, `basic`, `premium`, `premium_plus`, with monthly or yearly billing. Higher tiers include lower-tier features (`inheritsFrom`).
- Subscribing is idempotent and is charged through the provider (or the wallet). The plan activates on payment confirmation.
- Upgrades apply immediately with proration (Proposed default). Downgrades and cancellations take effect at `renewsAt`. `past_due` keeps features for a 3-day grace period, then reverts to free.
- **Feature gating is server-side.** For example, AI planner quotas, promotion features and analytics depth. Premium-only actions return `402 PAYMENT_REQUIRED`.

## Communities and messaging

- An event community admits the organiser team as owner or co-admin automatically, plus ticket holders on ticket issue (when `requireApprovalToJoin` is false). Members are removed when a ticket is cancelled or refunded (Proposed default).
- Permissions (`membersCanSendMessages`, `membersCanPostStatus`, `membersCanInvite`, `membersCanGoLive`) restrict members only; owners and co-admins are never restricted.
- Statuses expire after 24 hours. Views are counted once per user.
- Direct messages respect privacy:
  - `allowMessageRequests = false` blocks strangers (`403`).
  - Otherwise the first message creates a request conversation on the recipient's side.
  - Blocking hides the conversation and rejects further messages.
- Message deletion: senders delete their own (`deletedBy: sender`). Moderators remove via moderation actions (`deletedBy: admin`). Pinned messages are visible to all participants.
- Attachments: images, videos, audio (voice notes) and files go through `/uploads` with purpose `message_attachment`, max 50 MB. Strip EXIF location data.

## Vendors and reviews

- One vendor profile per user. Status flow: `draft` → `pending_verification` → `active` (verified by an admin) or `rejected`. Admins may suspend.
- A user can leave one review per vendor, cannot review themselves, and can edit or delete their own. Rating is 1–5 and the comment is 10–1000 characters. `rating` and `ratingsCount` are recomputed on change.
- Promos have an optional `validUntil` and are hidden after expiry.

## Moderation

- Anyone can report a user, message, community, event, vendor, work, status or review once per target. Duplicate reports update the existing one. `blockUser: true` also blocks the reported user for the reporter.
- **Priority.** High for violence, hate speech, nudity, or 3 or more reports in 24 hours; medium for scam or fraud and harassment; low otherwise (Proposed default).
- **Actions.** `removed` hides the content (soft delete, retained for 90 days for appeals). `restored` reverses it. `warned` notifies the user. `suspended` suspends the reported user through the users flow. `dismissed` closes with no action. Every action needs a note and is audit-logged. The reporter is notified of the outcome without detail.

## Notifications

- Each notification type maps to a template per channel. Respect `NotificationPreference` topics and channels, except security and transactional messages (OTP, payment receipts, ticket issued), which always send by email.
- Event reminders are sent 24 hours and 2 hours before start to ticket holders (Proposed default).
- **Campaigns.** The audience is resolved at send time; scheduled campaigns can be cancelled until sending starts. Delivery is throttled per channel provider limits. Marketing campaigns honour the `promotions` topic opt-out.

## Account deletion and privacy

- **Request** (`POST /me/deletion-request`) needs the password and a reason.
  1. The account becomes `pending_deletion` and all sessions are revoked.
  2. The profile is hidden from search and communities.
  3. A confirmation email is sent.

  Signing in during the grace period offers "cancel deletion" (`DELETE /me/deletion-request`).
- **Blockers.** The request is refused (`409`) while the user has a positive wallet balance, pending withdrawals, unsettled organiser settlements, or upcoming live events they organise. The message tells them what to resolve.
- **Completion** after 30 days, or early on admin approval:
  - Anonymise personal data: name becomes "Deleted user", email and phone are hashed or removed, avatar and media are deleted.
  - Delete identity media.
  - Keep financial records (orders, payments, ledger, settlements) with the anonymised user reference for the legal retention period.
  - Messages stay visible to other participants as "Deleted user".
- Users can view and edit their privacy settings at any time. Data export on request is recommended (NDPA, GDPR) and is not yet designed.

## Data retention (Proposed defaults, legal review needed)

| Data | Retention |
|---|---|
| Orders, payments, ledger, settlements, payouts, invoices | 7 years |
| Audit and security logs | 2 years minimum |
| Identity verification media | 90 days after decision; keep the result only |
| Removed content (moderation) | 90 days |
| Expired statuses | media deleted after 7 days |
| Export files | 7 days |
| Abandoned uploads | 24 hours |
