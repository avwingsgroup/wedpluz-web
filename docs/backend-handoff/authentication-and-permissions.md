# Authentication and permissions

> Contract proposal. The backend enforces everything described here. The frontend's route guards and hidden buttons are a usability layer only. Any authenticated user can call any endpoint directly with their token, so every rule must hold server-side.

## 1. Two separate audiences

| | Customers | Admins |
|---|---|---|
| Who | Attendees, organisers, managers, vendors (web, Android, iOS) | Wedpluz staff |
| Login | `POST /auth/login`, `/auth/register`, `/auth/social` | `POST /admin/auth/login` (password, then 2FA code) |
| Token | `customerBearer` | `adminBearer` |
| Accepted on | Everything except `/admin/*` | Only `/admin/*` (and `/broadcasting/auth` for admin channels) |
| Refresh | Yes, `POST /auth/refresh` with rotation | No refresh token. Re-login with 2FA after expiry. |
| Suggested lifetime | Access 60 min, refresh 30 days (sliding) | Access 8 h, hard expiry, 30 min idle timeout recommended |
| Client storage keys | `wp.access_token`, `wp.refresh_token`, `wp.token_expiry` | `admin.wp.access_token`, `admin.wp.token_expiry` |

Admins and customers are **different tables or guards** (`admin_users` versus `users`). An admin account must not be usable as a customer token and vice versa. If staff also use the consumer product, they have a separate customer account.

With Laravel Sanctum, use two token-issuing models, `User` and `AdminUser`, and check `tokenable_type` in middleware. Otherwise use abilities (`['customer']`, `['admin']`) and reject mismatches with `401`.

## 2. Customer session lifecycle

```
register / login / social ──▶ { user, tokens, nextStep, isNewUser? }
        │
        ├─ nextStep = verify_email  ─▶ POST /auth/otp/send + /auth/otp/verify (purpose=email_verification)
        ├─ nextStep = profile_setup ─▶ POST /me/profile-setup
        ├─ nextStep = interests     ─▶ PUT  /me/interests
        └─ null                     ─▶ app
```

- **Session restore.** On each page load the web app calls `GET /auth/me`. Only a `401` clears the stored session. Network errors and `5xx` keep the user signed in.
- **Refresh.** On a `401` from any customer endpoint, the client makes **one** `POST /auth/refresh` call with `{ refreshToken }`, queues concurrent failures behind it, and retries each original request once. If refresh fails, the client signs out locally.
  - Rotate on every refresh: issue a new refresh token and revoke the old one.
  - If a revoked refresh token is presented again, revoke the whole token family. This is reuse detection.
  - The contract allows `refreshToken: null`. If the backend prefers an HttpOnly, Secure, SameSite=Strict refresh cookie scoped to `/api/v1/auth/refresh`, return `null` in the body and set the cookie. The client then calls refresh with credentials. Tell the frontend team if you choose this, because `withCredentials` must be enabled for that one call.
- **Logout.** `POST /auth/logout` revokes the current access token and its refresh token.
- **Sessions.** `GET /me/sessions` lists tokens with device, browser, IP and approximate location. `DELETE /me/sessions/{id}` and `DELETE /me/sessions` revoke them. Changing the password must revoke all other sessions.
- **Suspension.** Suspending a user revokes all tokens immediately. Subsequent calls return `403 ACCOUNT_SUSPENDED`, which the client shows instead of retrying.
- **Email verification gate.** Unverified users may browse, save and message, but buying tickets, creating events and using the wallet return `403` with the message "Verify your email to continue". Product should confirm the exact gate.

### Token storage on the web

Tokens live in `localStorage`, behind a storage wrapper that degrades to memory in private mode, because the API is on a different origin and the mobile apps use the same bearer flow. Mitigations in place on the frontend:

- No `v-html` without sanitisation.
- A strict CSP is recommended at the host; see `docs/deployment.md`.
- Short access-token lifetime.
- Refresh-token rotation.

If the backend prefers cookie-based refresh, see above.

## 3. OTP and passwords

| Purpose | Trigger | Code | Expiry | Attempts |
|---|---|---|---|---|
| `email_verification` | after register, or from the onboarding screen | 4 digits | 10 min | 5, then invalidate |
| `password_reset` | `POST /auth/password/forgot` | 4 digits | 10 min | 5 |
| `wallet_setup` | wallet activation and PIN change | 4 digits | 10 min | 5 |
| `business_email` | business account email confirmation | 4 digits | 10 min | 5 |

- Store OTPs hashed. Resend replaces the previous code.
- `POST /auth/password/forgot` always returns `{ sent: true }`, whether or not the email exists, to prevent account enumeration.
- Passwords are hashed with bcrypt or argon2id, need at least 8 characters with a letter and a number, and should be checked against a breached-password list where feasible.
- The wallet PIN is 4 digits, stored hashed, and never returned. Five failures lock withdrawals for 30 minutes.

## 4. Admin authentication

1. `POST /admin/auth/login { email, password }` returns `{ requiresTwoFactor: true, admin: null, tokens: null }` when the password is correct and 2FA is enabled.
2. `POST /admin/auth/login { email, password, otp }` returns `{ requiresTwoFactor: false, admin, tokens }`.

Requirements:

- 2FA is **mandatory** for all admins. Use TOTP via an authenticator app; email OTP is acceptable only as a fallback. Invited admins must enrol before their first token is issued.
- Failed logins, successful logins, logouts and permission denials are written to `security_logs` (`GET /admin/security-logs`).
- `GET /admin/me` returns the admin with the flattened `permissions` array. The console uses it to show and hide navigation and controls.
- Sensitive actions require a **fresh** 2FA code in the request body even within a session. Today that is payout approval (`POST /admin/finance/payouts/{id}/approve { otp }`). Consider the same for role changes and settings updates to payment configuration.
- Optionally restrict `/admin/*` by IP allow-list or VPN at the edge.

## 5. Event-level roles (customer side)

Event management is authorised per event, not per platform role.

| Role on an event | How granted | Can |
|---|---|---|
| Organizer (owner) | creates the event | everything, including deleting drafts, cancelling, revenue and payouts |
| Manager, `full` access | invited via `POST /organizer/events/{id}/managers` and accepted | everything except deleting the event, transferring ownership and changing payout details |
| Manager, `partial` access | same, with an explicit `permissions` list | only the listed `ManagerPermission`s |
| Vendor | invited via `POST /organizer/events/{id}/vendors` and accepted | view the event, see and update tasks assigned to them, use the community |
| Attendee | holds a valid ticket | view the ticket, join the event community |

`ManagerPermission` values and the endpoints they unlock:

| Permission | Endpoints |
|---|---|
| `manage_guests` | guests, requests (list, decide, bulk) |
| `scan_tickets` | `POST /organizer/events/{id}/check-ins`, `GET …/check-ins` |
| `manage_tasks` | tasks CRUD (vendors may update status of tasks assigned to them) |
| `manage_vendors` | vendors list, invite, remove |
| `manage_assets` | hall layout and menu linkage in `PUT /organizer/events/{id}` (`assets`) |
| `view_revenue` | `GET …/analytics` revenue fields, promoters earnings |
| `edit_event` | `PUT /organizer/events/{id}` (non-financial fields), `publish` |
| `manage_community` | `GET/PUT …/community`, community member roles |

Responses for a managed event include `manage.myRole`, so the UI can adapt. The backend still checks the permission on each call and returns `403 FORBIDDEN` otherwise.

Platform roles on `User.roles` (`user`, `vendor`, `organizer`) only gate entry points in the UI, such as showing the business dashboard. They grant no data access by themselves.

## 6. Admin RBAC

Admins hold one or more **roles**. Each role is a set of **permission keys**. Every `/admin/*` operation declares exactly one required permission (`x-wedpluz-permission` in `openapi.yaml`, and the Auth column in `api-contracts.md`).

### 6.1 Permission catalogue

| Module | Key | Grants | Sensitive |
|---|---|---|---|
| Dashboard | `dashboard.view` | executive dashboard | |
| Users | `users.view` | list and view users, activity, bookings, reports, deletion requests | |
| | `users.manage` | change platform roles, decide deletion requests | ✔ |
| | `users.suspend` | suspend and reactivate users | ✔ |
| Events | `events.view` | list and view events and categories | |
| | `events.moderate` | approve, reject, suspend, restore events | |
| | `events.feature` | feature and unfeature events | |
| | `categories.manage` | create, update, delete categories | |
| Organizers | `organizers.view` | list and view organisers and vendors | |
| | `organizers.verify` | approve or reject verification | |
| | `organizers.manage` | suspend and reactivate organisers and vendors | ✔ |
| Bookings | `bookings.view` | bookings, disputes, check-ins, inventory | |
| | `bookings.manage` | resend tickets, update disputes | |
| Refunds | `refunds.view` | refunds list | |
| | `refunds.approve` | issue refunds, approve or reject refund requests | ✔ |
| Finance | `finance.view` | summary, transactions, payouts list, commissions, gateways | |
| | `finance.reconcile` | mark transactions matched or mismatched | ✔ |
| | `finance.settlements` | settlements list, hold and release, create payout | ✔ |
| | `finance.payouts.approve` | approve or reject payouts (fresh 2FA) | ✔ |
| | `finance.commission.manage` | commission rules and organiser overrides | ✔ |
| Moderation | `moderation.view` | reports and communities | |
| | `moderation.act` | act on reports, assign, suspend, restore or archive communities | |
| Notifications | `notifications.view` | campaigns and templates | |
| | `notifications.send` | create, send, cancel campaigns, test sends, edit templates | ✔ |
| Settings | `settings.view` | platform settings, banners, CMS pages | |
| | `settings.manage` | update settings, banners, CMS pages | ✔ |
| Access | `roles.manage` | permissions catalogue, roles, administrators | ✔ |
| | `audit.view` | audit and security logs | |
| Reports | `reports.view` | report definitions and runs | |
| | `reports.export` | exports (may contain personal data) | ✔ |
| Support | `support.view` | support tickets | |
| | `support.manage` | assign, update, reply | |

`GET /admin/permissions` returns this catalogue with `module`, `label`, `description` and `isSensitive`, so the roles editor stays in sync with the backend.

### 6.2 Suggested default roles

| Role | Permissions |
|---|---|
| Super Admin (system) | all |
| Operations | dashboard.view, users.view, users.suspend, events.*, categories.manage, organizers.view, organizers.verify, bookings.view, bookings.manage, moderation.view, support.view |
| Finance | dashboard.view, bookings.view, refunds.view, refunds.approve, finance.view, finance.reconcile, finance.settlements, finance.commission.manage, reports.view, reports.export |
| Finance Approver | finance.view, finance.payouts.approve, audit.view (kept separate from Finance for four-eyes control) |
| Moderator | dashboard.view, users.view, users.suspend, events.view, events.moderate, moderation.view, moderation.act |
| Support | dashboard.view, users.view, bookings.view, bookings.manage, refunds.view, support.view, support.manage |
| Marketing | dashboard.view, events.view, events.feature, notifications.view, notifications.send, settings.view, reports.view |

### 6.3 Enforcement rules

- Use one Laravel Gate or Policy per permission key. Do not infer access from the role name.
- Deny by default. An endpoint without a mapped permission is a bug.
- An admin cannot grant permissions they do not hold, and cannot remove `roles.manage` from the last active holder.
- Payout approval requires `finance.payouts.approve`, a fresh 2FA code, and an approver who did not create the payout.
- Permission denials return `403 FORBIDDEN` and are written to `security_logs` (`permission_denied`).
- Permission changes take effect on the next request; do not cache them inside long-lived tokens. The console re-reads `/admin/me` on load.

### 6.4 Audit logging

Every non-GET admin call writes an audit entry: `actor`, `action` (for example `user.suspended`), `module`, `targetType`, `targetId`, `targetLabel`, `before`, `after` (redact secrets and PINs), `ip`, `userAgent`, `correlationId` and `createdAt`. Audit and security logs are append-only and retained for at least 2 years, subject to legal review. Exports of personal data (`reports.export`) are audit-logged with the filters used.

## 7. Webhooks and machine access

Provider webhooks authenticate by **signature**, not tokens; see [integrations.md](integrations.md). Internal jobs and cron run inside the backend and need no public endpoints.
