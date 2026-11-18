# Data model requirements

> Contract proposal for PostgreSQL. This lists the entities, key fields, relationships and constraints implied by the API contracts and business rules. It is a requirements list, not a migration: column types, naming and normalisation are the backend team's call. API resources use camelCase; tables use snake_case.

## Conventions

- **Primary keys.** Prefixed ULID strings in the API (`evt_…`, `usr_…`). Store as `char(26)` ULIDs plus a prefix in the resource, or as `text` IDs. Never expose sequential integers.
- **Timestamps.** `created_at`, `updated_at` as `timestamptz` in UTC. Soft deletes (`deleted_at`) where the rules below mention restoration or retention.
- **Money.** `bigint` minor units plus `currency char(3)`. Never floats.
- **Enums.** PostgreSQL enums or `text` with check constraints. They must match the API enum values exactly.
- **JSON.** Use `jsonb` for flexible blobs: settings, audit before/after, provider payloads, report filters.
- **Search.** `pg_trgm` GIN indexes on names and titles. Full-text search (`tsvector`) on event title, description and tags. PostGIS or `earthdistance` for `distanceKm` filtering on venues (optional).

## Entity overview

```
users ─┬─< user_roles            admin_users ─< admin_user_roles >─ admin_roles ─< admin_role_permissions
       ├─1 user_privacy_settings                                                  
       ├─1 notification_preferences          events ─┬─< event_schedules ─< hall layouts (planner)
       ├─< personal_access_tokens / refresh_tokens   ├─< ticket_types
       ├─< device_tokens                            ├─< sub_events
       ├─< identity_verifications                   ├─< menu_items
       ├─1 account_deletion_requests                ├─< event_managers >─ users
       ├─1 vendor_profiles ─< vendor_works ─< media ├─< event_vendor_assignments >─ vendor_profiles
       │                   ├─< vendor_reviews        ├─< event_tasks ─< event_task_assignees
       │                   └─< vendor_promos         ├─< event_requests
       ├─1 wallets ─< ledger_entries                 ├─< activity_logs
       │           └─< wallet_transactions           ├─1 event_promotions ─< promoter_enrollments
       ├─< bank_accounts                            ├─1 communities
       ├─< orders ─┬─< order_lines                  └─< settlements
       │           ├─< order_food_lines
       │           ├─< payments ─< refunds           communities ─┬─< community_members
       │           ├─< seat_reservations                          ├─< status_posts ─< status_views
       │           └─< tickets ─< check_ins                       └─< live_sessions ─< live_requests
       ├─< conversations_participants >─ conversations ─< messages ─< message_attachments / reactions / stars
       ├─< notifications
       ├─< subscriptions ─< subscription_payments
       └─< support_tickets ─< support_messages
```

## Identity and access

| Entity | Key fields | Constraints and notes |
|---|---|---|
| **users** | id, first_name, last_name, display_name, username, email, phone, date_of_birth, password_hash, email_verified_at, phone_verified_at, identity_status, status (`active`, `suspended`, `deactivated`, `pending_deletion`), plan, locale, city, country_code, avatar_url, suspended_reason, signup_source (`web`, `android`, `ios`), last_seen_at | Unique `lower(email)` and `lower(username)` where not deleted. Index status and created_at. |
| user_roles | user_id, role (`user`, `vendor`, `organizer`) | Unique (user_id, role). Platform roles only; event roles live in event tables. |
| social_accounts | user_id, provider (`google`), provider_user_id, email | Unique (provider, provider_user_id). |
| personal_access_tokens | tokenable (user or admin), name/device, abilities, last_used_at, ip, user_agent, expires_at | Sanctum. Feeds `GET /me/sessions`. |
| refresh_tokens | id, user_id, token_hash, family_id, access_token_id, expires_at, revoked_at, replaced_by | Reuse detection: a revoked token used again revokes its family. |
| otp_codes | id, email/user_id, purpose, code_hash, attempts, expires_at, consumed_at | Index (email, purpose). |
| user_privacy_settings | user_id PK, profile_visibility, show_email, show_phone, allow_message_requests, allow_tagging, discoverable_by_search | 1:1 with users. |
| notification_preferences | user_id PK, channels jsonb, topics jsonb | 1:1. |
| device_tokens | id, user_id, platform, token, last_seen_at | Unique token. |
| identity_verifications | id, user_id, id_type, id_number_encrypted, selfie_upload_id, provider, provider_reference, status, failure_reason, submitted_at, reviewed_at | Encrypt id_number. Latest row drives `users.identity_status`. |
| account_deletion_requests | id, user_id, reason, status, requested_at, scheduled_for, decided_by_admin_id | One `pending` per user (partial unique index). |
| **admin_users** | id, first_name, last_name, email, password_hash, two_factor_secret_encrypted, two_factor_enabled, status (`active`, `suspended`, `invited`), last_login_at | A separate table and guard from users. |
| admin_roles | id, name, slug, description, is_system | Unique slug. |
| admin_role_permissions | role_id, permission_key | Keys from the catalogue in [authentication-and-permissions.md](authentication-and-permissions.md#61-permission-catalogue). |
| admin_user_roles | admin_user_id, role_id | |
| audit_logs | id, admin_user_id, action, module, target_type, target_id, target_label, before jsonb, after jsonb, ip, user_agent, correlation_id, created_at | Append-only (no update or delete grants). Index (module, created_at), (target_type, target_id). |
| security_logs | id, admin_user_id, email_attempted, event, ip, location, user_agent, created_at | Append-only. |

## Events and ticketing

| Entity | Key fields | Constraints and notes |
|---|---|---|
| **event_categories** | id, name, slug, icon, is_active, sort_order | Unique slug. Delete blocked if events reference it. |
| **events** | id, organizer_user_id, category_id, slug, title, description, cover_url, visibility, status, approval_required, guest_limit, allow_guest_invites, max_additional_guests, is_adult_only, is_featured, is_free, currency, tags text[], organizer_info jsonb, rejection_reason, cancellation_reason, submitted_at, reviewed_by_admin_id, published_at, source | Unique slug. Index (status, starts_at) via schedules, category_id, organizer_user_id. Derived `min_price` and `starts_at` may be denormalised for listing speed. |
| event_schedules | id, event_id, label, starts_at, ends_at, attendance_mode, venue jsonb (name, address, city, state, country_code, lat, lng), online jsonb (platform, link), hall_layout_id, menu_id | Index starts_at; GIST on (lat, lng) if geo search is used. Online links are visible to ticket holders only. |
| sub_events | id, event_id, schedule_id, title, description, cover_url, starts_at, ends_at, requires_approval, is_included_in_bundle | |
| **ticket_types** | id, event_id, schedule_id (null = all days), name, description, price, currency, quantity, sold, sales_start_at, sales_end_at, per_order_limit, seat_selection, menu_selection, is_early_bird, is_active | Check `sold <= quantity`. Conditional updates on `sold` (see business rules). |
| menu_items | id, event_id, name, description, price, currency, image_url, category, is_available | |
| saved_events | user_id, event_id, created_at | PK (user_id, event_id). |
| event_requests | id, event_id, user_id, first_name, last_name, status, decided_by, decided_at | Unique (event_id, user_id) where status in (pending, approved). |
| **checkout_quotes** | id, user_id, event_id, lines jsonb, food_lines jsonb, promo_code_id, referral_enrollment_id, subtotal, service_fee, discount, total, currency, expires_at, consumed_at | Short-lived; may live in Redis plus a table for audit. |
| inventory_holds | id, quote_id, ticket_type_id, quantity, expires_at | Counted against stock until expiry or conversion. Index (ticket_type_id, expires_at). |
| promo_codes | id, code, event_id or null, type (`percent`, `fixed`), value, max_uses, used_count, starts_at, ends_at, applies_to_ticket_type_ids | Unique `upper(code)` per scope. |
| **orders** | id, reference, user_id, event_id, status, payment_method, attendee jsonb, additional_guests jsonb, subtotal, service_fee, discount, total, currency, commission_rule_snapshot jsonb, promoter_enrollment_id, idempotency_key, source, paid_at, expires_at | Unique reference. Unique (user_id, idempotency_key). Index (event_id, status), (user_id, created_at). |
| order_lines / order_food_lines | order_id, ticket_type_id or menu_item_id, name_snapshot, unit_price, quantity, subtotal | Snapshot names and prices at purchase. |
| seat_reservations | id, order_id, schedule_id, seat_id, table_label, seat_label, status (`held`, `confirmed`, `released`) | Partial unique (schedule_id, seat_id) where status in (held, confirmed). |
| **payments** | id, order_id or subscription or top-up reference (polymorphic), provider, provider_reference, provider_transaction_id, amount, fee, currency, status, reconciliation_status, raw_payload jsonb (redacted), verified_at | Unique (provider, provider_reference). |
| **tickets** | id, code, order_id, event_id, schedule_id, ticket_type_id, holder_user_id, holder_name, qr_secret_version, status, checked_in_at, checked_in_by, seat_reservation_id, transferred_to_ticket_id | Unique code. Index (event_id, status). |
| check_ins | id, ticket_id or null, event_id, code_scanned, result reason, method, device, scanned_by_user_id, created_at | Every attempt is recorded (admin QR validations view). |
| **refunds** | id, reference, order_id, payment_id, amount, currency, reason, status, provider_reference, requested_by (user or admin), decided_by_admin_id, decided_at, completed_at | Check that the sum of refunds per payment does not exceed the captured amount (enforce in the transaction). |
| ticket_transfers (proposed) | id, ticket_id, from_user_id, recipient_email, new_ticket_id, status | |
| disputes | id, order_id, raised_by_user_id, type, status, description, assigned_admin_id, provider_dispute_id | |
| webhook_events | id, provider, provider_event_id, type, signature_valid, payload jsonb, processed_at, error | Unique (provider, provider_event_id). |
| idempotency_keys | key, user_id, endpoint, request_hash, response_status, response_body jsonb, locked_until, created_at | Unique (user_id, endpoint, key). TTL 24 hours or more. |

## Organizer collaboration and promotion

| Entity | Key fields | Notes |
|---|---|---|
| event_managers | id, event_id, user_id, access (`full`, `partial`), permissions text[], status, invited_at, responded_at | Unique (event_id, user_id) where status not in (declined, removed). |
| event_vendor_assignments | id, event_id, vendor_profile_id, role, status, invited_at | |
| event_tasks | id, event_id, title, description, status, due_at, created_by, completed_at | |
| event_task_assignees / event_task_attachments | task_id, user_id or upload_id | |
| activity_logs | id, event_id, actor_user_id, actor_role, action, description, metadata jsonb, created_at | Append-only. |
| event_promotions | event_id PK, enabled, commission_percent, target_signups, promoter_limit | Check 1–50. |
| promoter_enrollments | id, event_id, user_id, share_code, status, joined_at | Unique share_code; unique (event_id, user_id). |
| promoter_commissions | id, enrollment_id, order_id, amount, status (`pending`, `credited`, `reversed`) | Credited to the wallet at settlement. |

## Vendors

| Entity | Key fields | Notes |
|---|---|---|
| vendor_categories / business_categories | id, name, slug | |
| **vendor_profiles** | id, user_id, business_name, slug, category_id, location, description, avatar_url, cover_url, contact_email, contact_phone, website, socials jsonb, status, availability, rating_avg, ratings_count, likes_count, verified_at | Unique user_id; unique slug. Trigram index on business_name. |
| vendor_verification_documents | id, vendor_profile_id or user_id, type, upload_id, status | Private S3. |
| vendor_works | id, vendor_profile_id, title, description, likes_count | |
| media | id, owner (polymorphic), type, url, thumbnail_url, width, height, duration_seconds, provider, provider_public_id | Shared by works, statuses and message attachments. |
| work_likes | user_id, work_id | PK both. |
| vendor_reviews | id, vendor_profile_id, user_id, rating, comment | Unique (vendor_profile_id, user_id). Check rating 1–5. |
| vendor_promos | id, vendor_profile_id, title, description, discount_percent, valid_until, cover_url | |
| saved_vendors | user_id, vendor_profile_id | |

## Communities and messaging

| Entity | Key fields | Notes |
|---|---|---|
| **communities** | id, event_id, name, description, avatar_url, permissions jsonb, invite_code, status (`active`, `archived`, `suspended`) | Unique invite_code; unique event_id where not null. |
| community_members | community_id, user_id, role (`owner`, `co_admin`, `member`), joined_at, is_muted, is_pinned, is_archived | PK (community_id, user_id). The per-user flags back `PATCH /communities/{id}`. |
| status_posts | id, community_id, author_user_id, media_id, caption, likes_count, views_count, expires_at | Index (community_id, expires_at). |
| status_views / status_likes | status_id, user_id | |
| live_sessions | id, community_id, host_user_id, title, status, provider_room_id, audio_enabled, video_enabled, viewers_count, started_at, ended_at | One live session per community (partial unique where status = live). |
| live_requests | id, live_session_id, user_id, status | |
| **conversations** | id, type (`direct`, `community`), community_id, last_message_id, updated_at | Direct conversations are unique per user pair (store a sorted pair key). |
| conversation_participants | conversation_id, user_id, last_read_message_id, unread_count, is_pinned, is_muted, is_archived, is_request, deleted_at | |
| **messages** | id, conversation_id, sender_user_id, client_id, type, body, reply_to_id, event_id, is_pinned, deleted_by, created_at | Unique (sender_user_id, client_id). Index (conversation_id, created_at desc) for cursor pagination. |
| message_attachments | id, message_id, media_id, name, size_bytes, duration_seconds, waveform jsonb | |
| message_reactions | message_id, user_id, emoji | PK (message_id, user_id, emoji). |
| message_stars | message_id, user_id | |
| blocks | blocker_user_id, blocked_user_id | PK both. |
| content_reports | id, target_type, target_id, reporter_user_id, reported_user_id, reason, details, status, priority, assigned_admin_id, resolution jsonb | Unique (reporter_user_id, target_type, target_id). |

## Notifications and campaigns

| Entity | Key fields | Notes |
|---|---|---|
| notifications | id, user_id, type, actor_user_id, title, body, segments jsonb, action, action_state, data jsonb, link, is_request, read_at, created_at | Index (user_id, read_at, created_at desc). Laravel's database channel works with these extra columns. |
| notification_templates | id, key, name, channel, subject, body, variables text[], is_active | Unique (key, channel). |
| notification_campaigns | id, name, channels text[], audience jsonb, template_id, subject, body, status, scheduled_at, sent_at, stats jsonb, created_by_admin_id | |
| notification_deliveries | id, campaign_id or notification_id, user_id, channel, provider_message_id, status, error, sent_at, delivered_at, opened_at | Feeds delivery stats. Partition by month if large. |

## Wallet, finance and subscriptions

| Entity | Key fields | Notes |
|---|---|---|
| **wallets** | id, user_id, currency, is_active, pin_hash, pin_failed_attempts, pin_locked_until, cached_balance, cached_pending_balance | Unique user_id. Cached balances are updated only alongside ledger entries. |
| **ledger_entries** | id, transaction_id, account (`wallet:{id}`, `platform:revenue`, `platform:fees`, `provider:paystack`, `organizer_payable:{id}`, …), direction, amount, currency, created_at | Double-entry: entries per transaction sum to zero. Append-only. |
| wallet_transactions | id, reference, wallet_id, type, direction, amount, fee, currency, status, description, counterparty, provider, metadata jsonb, idempotency_key, completed_at | User-facing view of ledger movements. |
| bank_accounts | id, user_id, bank_code, bank_name, account_number_encrypted, account_last4, account_name, is_default, provider_recipient_code | Unique (user_id, bank_code, account_number). |
| banks | code, name, provider codes | Cached from the provider. |
| commission_rules | id, scope (`platform`, `category`, `organizer`), scope_id, percent, fixed_fee, currency, effective_from, updated_by_admin_id | Unique active rule per (scope, scope_id). |
| **settlements** | id, reference, organizer_user_id, event_id, gross_sales, refunds, platform_commission, gateway_fees, promoter_commissions, adjustments, net_payable, currency, status, hold_reason, eligible_at, paid_at, payout_id | Unique (event_id, organizer_user_id). |
| **payouts** | id, reference, organizer_user_id, bank_account_snapshot jsonb, amount, currency, provider, provider_reference, status, requested_by_admin_id, approved_by_admin_id, failure_reason, completed_at | Check approved_by ≠ requested_by. |
| payout_settlements | payout_id, settlement_id | |
| reconciliation_records | id, payment_id, provider_report_line jsonb, status, note, resolved_by_admin_id | |
| plans | id, tier, name, tagline, price_monthly, price_yearly, currency, features jsonb, is_popular, inherits_from | |
| subscriptions | id, user_id, plan_id, interval, status, started_at, renews_at, cancelled_at, provider_subscription_id | One active subscription per user. |
| subscription_payments | id, subscription_id, payment_id, amount, status, paid_at, receipt_url | |

## Platform, content and support

| Entity | Key fields | Notes |
|---|---|---|
| platform_settings | key, value jsonb, updated_by_admin_id | Group keys `general`, `payments`, `features`, `app`, `legal`. Cache in Redis and bust on update. **No secrets.** |
| banners | id, title, subtitle, image_url, cta_label, cta_url, placement, audience, starts_at, ends_at, is_active, priority, impressions, clicks | |
| cms_pages | id, slug (`about`, `terms`, `privacy`, `faqs`, `help`, `contact`), title, content, updated_by_admin_id | Keep a version history (`cms_page_versions`). |
| interests | slug, label | |
| support_tickets | id, reference, user_id, subject, category, status, priority, assigned_admin_id, source | |
| support_messages | id, ticket_id, author (user or admin), body, created_at | |
| uploads | id, owner_user_id or admin_id, purpose, provider, url, mime_type, size_bytes, width, height, attached_at, expires_at | Unattached uploads are purged after 24 hours. |
| export_jobs | id, admin_user_id, report_key, query jsonb, format, status, file_path, expires_at | |

## Planner (proposed)

| Entity | Key fields |
|---|---|
| planner_assets | id, user_id, type, name, thumbnail_url, event_id |
| planner_menus / planner_menu_sections / planner_menu_items | menu → sections → items (name, description, price, image) |
| hall_layouts | id, user_id, name, width, height, tables jsonb, fixtures jsonb, total_seats, reserved_seats. **Seat IDs must be stable**, because seat reservations reference them. |
| planner_chats / planner_chat_messages | chat → messages (role, content, attachments jsonb, generation_id) |
| planner_generations | id, user_id, type, prompt, status, result_urls text[], provider, cost_units |

## Analytics and reporting

- The executive dashboard and reports should read from **rollup tables** (`daily_platform_metrics`, `daily_event_metrics`, `daily_provider_metrics`), refreshed by scheduled jobs. They should not read live transactional tables on each request.
- Track `source` (`web`, `android`, `ios`) on users, orders and events from `X-Client-Platform`. Admin views and acquisition reports use it.
