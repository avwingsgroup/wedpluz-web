# Realtime events

> Contract proposal. Realtime is an **enhancement**. Every screen works without a socket by fetching on load and polling badge counts. Nothing here is required for launch, but messaging, notifications and live check-in counts feel much better with it.

## 1. Transport

**Recommended:** Laravel Reverb, which speaks the Pusher protocol, with Laravel broadcasting.

| Item | Proposal |
|---|---|
| Endpoint | `wss://ws.wedpluz.com/app/<REVERB_APP_KEY>` (frontend env `VITE_REALTIME_URL`, `VITE_REALTIME_KEY`, which is the public app key and not a secret) |
| Channel auth | `POST /broadcasting/auth` with the customer or admin bearer token (`proposed` in `openapi.yaml`) |
| Event naming | Use `broadcastAs()` to emit the dotted names below (`message.created`), not PHP class names |
| Payload | Same JSON resource shapes as the REST API (camelCase, money in minor units) |
| Delivery | At-most-once. Clients refetch on reconnect, so events never carry state that cannot be recovered via REST. |
| Scale | Reverb horizontal scaling through Redis pub/sub. Broadcast from queued jobs (`ShouldBroadcast`), never inline in requests. |

**Current web client.** `src/composables/useRealtime.ts` is a thin WebSocket adapter. It connects to `VITE_REALTIME_URL` with the token, reconnects with exponential backoff (1s up to 30s), and dispatches frames of the form `{ "event": "...", "channel": "...", "data": {...} }`; it accepts `data` as a JSON string, as Pusher sends it. When the backend confirms Reverb, the adapter will be swapped for `laravel-echo` + `pusher-js`. That change is contained in this one file; components subscribe by event name only. When `VITE_REALTIME_URL` is empty, realtime is disabled and polling is used.

## 2. Channels

| Channel | Type | Who may subscribe | Carries |
|---|---|---|---|
| `private-user.{userId}` | private | that user | notifications, badge changes, ticket and order updates, wallet updates, identity result |
| `private-conversation.{conversationId}` | private | participants (members for community conversations) | messages, reactions, read receipts |
| `presence-conversation.{conversationId}` | presence | participants | typing indicators, who is online |
| `private-community.{communityId}` | private | members | statuses, live sessions, member changes |
| `private-event.{eventId}.manage` | private | organiser and managers with `manage_guests` or `scan_tickets` | check-ins, requests, guest changes |
| `private-admin` | private | any admin | dashboard alerts |
| `private-admin.moderation` | private | admins with `moderation.view` | new reports |

Authorise each subscription in `routes/channels.php` with the same policies as the REST endpoints. Never authorise from a client-supplied role.

## 3. Events

**Consumed today** means the web build already handles the event. **Proposed** events are defined so the backend can emit them; the frontend will subscribe as features need them. Every proposed event has a REST fallback.

### 3.1 Messaging

| Event | Channel | Payload | Status | Frontend effect |
|---|---|---|---|---|
| `message.created` | `private-conversation.{id}` and `private-user.{recipientId}` | `Message` (with `clientId` echoed for the sender) | **Consumed today** | Appends to the open thread (deduplicated by `id` and `clientId`), refreshes the conversation list and unread badge. |
| `message.updated` | `private-conversation.{id}` | `Message` (reactions, pin, star, `deletedBy`) | Proposed | Replace the message in place. |
| `message.deleted` | `private-conversation.{id}` | `{ id, conversationId, deletedBy }` | Proposed | Show the "message deleted" placeholder. |
| `conversation.read` | `private-conversation.{id}` and `private-user.{userId}` | `{ conversationId, userId, readAt, lastReadMessageId }` | **Consumed today** (badge refresh) | Updates unread badges; future: read ticks. |
| `conversation.updated` | `private-user.{userId}` | `Conversation` | Proposed | Update the inbox row (new request, accepted, archived elsewhere). |
| `typing` | `presence-conversation.{id}` (client event `client-typing`) | `{ conversationId, user: UserSummary, isTyping }` | Proposed | "Tessy is typing…". Throttle to one event every 3 seconds. |

### 3.2 Notifications and badges

| Event | Channel | Payload | Status | Frontend effect |
|---|---|---|---|---|
| `notification.created` | `private-user.{userId}` | `AppNotification` | **Consumed today** (badge refresh) | Refreshes badge counts; future: prepend to an open drawer. |
| `notification.read` | `private-user.{userId}` | `{ id \| null, all: boolean }` | **Consumed today** (badge refresh) | Syncs badges across tabs and devices. |

### 3.3 Tickets, orders and wallet

| Event | Channel | Payload | Status | Notes |
|---|---|---|---|---|
| `order.updated` | `private-user.{userId}` | `{ id, status, reference }` | Proposed | Lets the payment return page stop polling as soon as the webhook settles the order. |
| `ticket.updated` | `private-user.{userId}` | `Ticket` | Proposed | Status changes: checked in, cancelled, refunded, transferred. |
| `refund.updated` | `private-user.{userId}` | `RefundSummary & { ticketId }` | Proposed | |
| `wallet.updated` | `private-user.{userId}` | `{ balance, pendingBalance, transaction: WalletTransaction }` | Proposed | After a top-up or withdrawal settles. |
| `identity.updated` | `private-user.{userId}` | `IdentityVerification` | Proposed | After a provider webhook. |

### 3.4 Organizer live operations

| Event | Channel | Payload | Status | Notes |
|---|---|---|---|---|
| `checkin.created` | `private-event.{id}.manage` | `CheckInRecord & { checkedIn: number, capacity: number \| null }` | Proposed | Keeps scanner devices and the overview counter in sync across staff. |
| `request.created` | `private-event.{id}.manage` | `EventRequest` | Proposed | New attendance request. |
| `request.updated` | `private-event.{id}.manage` | `EventRequest` | Proposed | Another manager decided it. |
| `task.updated` | `private-event.{id}.manage` and `private-user.{assigneeId}` | `EventTask` | Proposed | |

### 3.5 Communities and live

| Event | Channel | Payload | Status |
|---|---|---|---|
| `status.created` | `private-community.{id}` | `StatusPost` | Proposed |
| `live.started` | `private-community.{id}` | `LiveSession` | Proposed |
| `live.updated` | `private-community.{id}` | `LiveSession` (viewers, audio and video flags) | Proposed |
| `live.ended` | `private-community.{id}` | `{ id, communityId, endedAt }` | Proposed |
| `live.request.created` | `private-community.{id}` (host only via policy) | `LiveRequest` | Proposed |
| `member.updated` | `private-community.{id}` | `CommunityMember` | Proposed |

Media for live sessions flows through the chosen provider (SFU), not through Reverb. Reverb only carries state changes.

### 3.6 Admin

| Event | Channel | Payload | Status |
|---|---|---|---|
| `admin.alert` | `private-admin` | `SystemAlert` | Proposed |
| `admin.report.created` | `private-admin.moderation` | `ContentReport` | Proposed |

## 4. Example frames

Pusher protocol as delivered by Reverb (`data` is a JSON string):

```json
{
  "event": "message.created",
  "channel": "private-conversation.cv_com_tessy",
  "data": "{\"id\":\"msg_901\",\"conversationId\":\"cv_com_tessy\",\"clientId\":\"c7a1f3b2-5d4e-4f6a-8b9c-0d1e2f3a4b5c\",\"sender\":{\"id\":\"usr_tessy\",\"displayName\":\"Tessy\",\"avatarUrl\":null},\"type\":\"text\",\"body\":\"See you all on Saturday! 🎉\",\"attachments\":[],\"replyTo\":null,\"reactions\":[],\"event\":null,\"isPinned\":false,\"isStarred\":false,\"isMine\":false,\"deletedBy\":\"none\",\"status\":\"sent\",\"createdAt\":\"2026-11-16T09:41:00Z\"}"
}
```

`isMine` in broadcast payloads is computed for the recipient as `false`. The client recomputes it from `sender.id`.

```json
{
  "event": "notification.created",
  "channel": "private-user.usr_me",
  "data": "{\"id\":\"ntf_77\",\"type\":\"manager_invite\",\"title\":\"Manager invite\",\"body\":\"Alex invited you to manage Luxury Wedding Gala\",\"segments\":[{\"text\":\"Alex\",\"emphasis\":true},{\"text\":\" invited you to manage \"},{\"text\":\"Luxury Wedding Gala\",\"emphasis\":true}],\"action\":\"accept_decline\",\"actionState\":\"pending\",\"isRequest\":true,\"readAt\":null,\"createdAt\":\"2026-11-16T09:40:00Z\",\"link\":null,\"actor\":null,\"data\":{\"eventId\":\"evt_gala\"}}"
}
```

## 5. Fallbacks the frontend already uses

| Feature | Without realtime |
|---|---|
| Header badges (notifications, requests, messages) | `GET /notifications/unread-count` and `GET /messages/unread-count` every 60 seconds while signed in |
| Open conversation | Messages load on open; the user's own sends appear optimistically; others appear on reopen or when switching conversations |
| Payment confirmation | Verify-payment polling (6 × 2.5 s) |
| Organizer check-in count | Refreshed after each scan by that device |

## 6. Mobile parity

The Android and iOS apps should use the same channels and event names. When an app is backgrounded, deliver through FCM or APNs push (see [integrations.md](integrations.md)) rather than keeping sockets open.
