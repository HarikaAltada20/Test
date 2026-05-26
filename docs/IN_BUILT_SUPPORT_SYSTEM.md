# In-Built Support System — Admin Replies, Deletion & Per-User Chat Control

**Status:** Planned (not implemented) · **Updated:** May 25, 2026  
**Admin UI:** `/dashboard/admin/support`  
**User UI:** Dashboard sidebar → **Get in touch** (`ChatSupport` modal)

---

## Scope

This document defines the **enhanced** in-platform support experience:

| Capability | v1 target |
|------------|-----------|
| Admin **reply** to user queries from the dashboard | Yes |
| **In-app notification** to the user on every admin reply | Yes (required) |
| User sees reply history in the chat widget | Yes |
| **Delete** conversations (single, bulk, retention-based) | Yes |
| **Enable / disable** chat for a specific user | Yes |

**Includes:** Current system inventory, proposed schema, API contracts, admin/creator UX, security, and implementation checklist.

**Out of scope:** Implemented code (backlog at §12). Public marketing-site `contacts` form behavior is unchanged unless noted.

---

## 1. Current system (as-is)

### 1.1 User-facing chat widget

- **Component:** `components/ChatSupport.tsx`
- **Trigger:** Dashboard sidebar `onChatOpen` → modal “Drop us a Query”
- **Submit:** `POST /api/queries` with `{ email, query_text }`
- **Behavior:** One-shot message only; no thread, no admin reply in-app, no history after submit

```74:111:components/ChatSupport.tsx
  const handleSubmit = async () => {
    // ...
    const res = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, query_text: query }),
    });
    // toast success, clear textarea
  };
```

- Creators also see Discord / WhatsApp CTAs for faster community support (unchanged).

### 1.2 API

- **Route:** `app/api/queries/route.ts`
- Resolves user by `email`, inserts one row into `queries` with `user_id`, `user_type`, `query_text`, `created_at`.
- No GET, PATCH, or DELETE endpoints today.

### 1.3 Admin dashboard

- **Page:** `app/dashboard/admin/support/page.tsx` (server) + `support-client.tsx` (client)
- **Tabs:** Queries | Contacts
- **Queries tab:** Read-only table — Created, User Type, Query, Email, Username — with client-side pagination
- **No actions:** No Reply, Delete, bulk select, or per-user chat toggle

### 1.4 Database (today)

**`queries`** — one row per submitted message (not a conversation thread):

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `created_at` | `timestamptz` | |
| `user_type` | `text` | Snapshot at submit time |
| `query_text` | `text` | User message body |
| `user_id` | `uuid` | FK → `users.id` |

**`contacts`** — separate public/contact-form submissions (`name`, `email`, `phone`, `message`). Not part of the logged-in chat flow.

**`users`** — no `support_chat_enabled` (or equivalent) column today.

### 1.5 Gap summary

| Need | Today |
|------|--------|
| Reply from platform | Admins must use external email; no in-app thread |
| Conversation history for user | None after submit toast |
| Delete / archive old chats | Not possible |
| Disable chat for abusive/spam users | Not possible |

---

## 2. Target product behavior

### 2.1 Conversation model

Treat each support interaction as a **thread** (conversation) with ordered **messages**:

- First user submit opens or continues a thread.
- Admin replies append admin messages to the same thread.
- User can send follow-up messages in the same thread (recommended for v1 so “reply” is meaningful).

**Thread states (suggested):**

| Status | Meaning |
|--------|---------|
| `open` | Awaiting admin and/or further user messages |
| `replied` | Admin has replied at least once; still open for follow-up |
| `closed` | Resolved; user can open a new thread for a new topic (optional v1) |

### 2.2 Admin reply

- From **Queries** tab, each row (or thread detail drawer) has **Reply**.
- Reply UI: multiline textarea, optional internal note (admin-only, not shown to user) — optional v2.
- On send (single server transaction — all succeed or all roll back):
  1. Insert admin row in `support_messages`.
  2. Update thread `status` → `replied`, `last_message_at`, `updated_at`.
  3. **Insert `user_notifications` row** for the thread owner (required — see §6).
  4. Optional: send email (§6.4).
- If notification insert fails, the reply must **not** be saved (user must not miss the alert).

### 2.3 User experience after enhancement

- **ChatSupport** becomes a lightweight **inbox**:
  - List of user’s threads (most recent first).
  - Thread detail with message bubbles (user vs admin).
  - Composer to add a message (if `support_chat_enabled` and thread not hard-closed).
- If chat is disabled for the user, show a short message: *“Support chat is unavailable for your account. Please contact support@…”* (copy TBD).

### 2.4 Delete chats

Three deletion modes for admins:

| Mode | UI | Behavior |
|------|-----|----------|
| **Single delete** | Row action or thread detail → Delete | Soft-delete one thread (and its messages) |
| **Bulk delete** | Checkbox column + toolbar **Delete selected** | Soft-delete selected thread IDs |
| **Retention delete** | Toolbar **Delete older than 90 days** | Soft-delete all threads with `last_message_at` (or `created_at`) &lt; now − 90 days |

**Recommendations:**

- Use **soft delete** (`deleted_at`, `deleted_by`) so ops can recover mistakes; hard purge via scheduled job after e.g. 30 days (optional).
- Destructive actions require **confirmation modal** with count preview.
- Retention default: **90 days** (configurable constant `SUPPORT_RETENTION_DAYS`).

### 2.5 Per-user chat enable / disable

| Control | Location (proposed) |
|---------|---------------------|
| Primary | Admin **User Management** (`/dashboard/admin/users`) — row action or user detail: **Support chat** toggle |
| Secondary | Admin Support thread detail — link to user + quick disable (same flag) |

| Flag value | User | Admin |
|------------|------|-------|
| Enabled (default) | Can open chat and submit messages | Normal |
| Disabled | Chat entry hidden or disabled with explanation | Can still view past threads in Support (read-only); can re-enable |

Store on `users.support_chat_enabled BOOLEAN NOT NULL DEFAULT true`.

Audit optional: `support_chat_disabled_at`, `support_chat_disabled_by` (admin user id), `support_chat_disable_reason` (text).

---

## 3. Proposed database schema

### 3.1 New / altered tables

#### `support_threads`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL |
| `user_type` | `text` | Denormalized snapshot |
| `status` | `text` | `open` \| `replied` \| `closed` |
| `subject` | `text` | Optional; first message excerpt |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `last_message_at` | `timestamptz` | For sorting & retention |
| `deleted_at` | `timestamptz` | Soft delete |
| `deleted_by` | `uuid` | Admin who deleted |

Indexes: `(user_id, last_message_at DESC)`, `(deleted_at) WHERE deleted_at IS NULL`, `(last_message_at)` for retention job.

#### `support_messages`

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `thread_id` | `uuid` | FK → `support_threads.id` ON DELETE CASCADE |
| `sender_role` | `text` | `user` \| `admin` |
| `sender_user_id` | `uuid` | User id or admin id |
| `body` | `text` | NOT NULL |
| `created_at` | `timestamptz` | |

Index: `(thread_id, created_at ASC)`.

#### `users` (alter)

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS support_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS support_chat_disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS support_chat_disabled_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS support_chat_disable_reason text;
```

### 3.2 Migration from legacy `queries`

1. For each existing `queries` row, create one `support_threads` + one `support_messages` (`sender_role = 'user'`, `body = query_text`).
2. Keep `queries` read-only for a release cycle, then drop or rename to `queries_legacy`.
3. Point `POST /api/queries` at new tables (or deprecate in favor of `POST /api/support/threads`).

### 3.3 RLS (Supabase)

| Role | `support_threads` | `support_messages` |
|------|-------------------|---------------------|
| Authenticated user | SELECT/INSERT own threads; INSERT messages on own open threads | SELECT own thread messages; INSERT as `user` |
| Admin (service role or admin policy) | Full CRUD including soft delete | Full CRUD |
| Anonymous | No access | No access |

Admin routes should use `verifyAdminAccess()` server-side (same pattern as other admin APIs).

---

## 4. API design

All admin routes: `verifyAdminAccess()` required.

### 4.1 User routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/support/threads` | List current user’s non-deleted threads |
| `GET` | `/api/support/threads/[threadId]` | Thread + messages (ownership check) |
| `POST` | `/api/support/threads` | Create thread + first message `{ body }` |
| `POST` | `/api/support/threads/[threadId]/messages` | User follow-up `{ body }` |

**Guards:**

- Return `403` if `users.support_chat_enabled = false`.
- Return `404` if thread deleted or not owned.

**Backward compatibility:** `POST /api/queries` may proxy to `POST /api/support/threads` during transition.

### 4.2 Admin routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/support/threads` | Paginated list; filters: status, user_type, date range, search email/username |
| `GET` | `/api/admin/support/threads/[threadId]` | Full thread + messages |
| `POST` | `/api/admin/support/threads/[threadId]/reply` | `{ body }` — admin message; **must** create `user_notifications` for thread `user_id` (§6) |
| `PATCH` | `/api/admin/support/threads/[threadId]` | Optional: `{ status: 'closed' }` |
| `DELETE` | `/api/admin/support/threads/[threadId]` | Soft-delete one thread |
| `POST` | `/api/admin/support/threads/bulk-delete` | `{ thread_ids: uuid[] }` |
| `POST` | `/api/admin/support/threads/delete-before-date` | `{ before_days: 90 }` or `{ before: ISO date }` — returns `{ deleted_count }` |
| `PATCH` | `/api/admin/users/[userId]/support-chat` | `{ enabled: boolean, reason?: string }` |

### 4.3 Example payloads

**Admin reply**

```json
POST /api/admin/support/threads/{threadId}/reply
{ "body": "Your withdrawal was approved today. It should arrive within 3–5 business days." }
```

**Retention delete**

```json
POST /api/admin/support/threads/delete-before-date
{ "before_days": 90 }
```

Response:

```json
{ "success": true, "deleted_count": 142 }
```

---

## 5. Admin UI specification

**Page:** `/dashboard/admin/support` (`support-client.tsx` evolution)

### 5.1 Queries tab → Threads

| Column / control | Notes |
|------------------|--------|
| Checkbox | Bulk select |
| Created / Updated | `last_message_at` |
| User type | |
| Last message preview | Truncated |
| Email / Username | Join `users` |
| Status badge | open / replied / closed |
| Actions | **View**, **Reply**, **Delete** |

**Toolbar:**

- Search (email, username, message text)
- Filter: status, user type, date range
- **Delete selected** (disabled when none selected)
- **Delete older than 90 days** → confirmation with count from preview endpoint (recommended: `GET .../delete-before-date/preview?before_days=90`)

### 5.2 Thread detail drawer / page

- Chronological messages (user left, admin right — standard chat layout).
- Reply composer fixed at bottom.
- **Close thread** (optional).
- **Delete thread**.
- User header: email, username, link to User Management, **Support chat: On/Off** toggle.

### 5.3 Contacts tab

Unchanged for v1 (public contact form). Optional later: merge into support or add delete there too.

---

## 6. Notifications (required on admin reply)

Every successful admin reply **must** notify the **thread owner** (`support_threads.user_id`). Users should not need to poll the support widget to discover a reply.

### 6.1 Delivery channels

| Channel | v1 | Notes |
|---------|-----|--------|
| **In-app** | **Required** | Row in `user_notifications`; bell badge + inbox (see `docs/admin_user_notifications.md` §12.2) |
| **Email** | Optional | Send to `users.email` with short excerpt + dashboard link (§6.4) |

In-app announcements are **not** gated by user email/push settings in Settings (same rule as admin public notifications).

### 6.2 Notification type

Extend `admin_notification_type_enum` (or equivalent) with:

| Value | Label | Trigger |
|-------|--------|---------|
| `support_reply` | Support reply | Admin `POST .../reply` on a support thread |

No admin “campaign” row is required for support replies — `campaign_id` on `user_notifications` stays `NULL`. Optionally store `support_thread_id` on the notification row for deep links (recommended).

**Suggested column on `user_notifications`:**

```sql
ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS support_thread_id uuid NULL
    REFERENCES public.support_threads (id) ON DELETE SET NULL;
```

### 6.3 Payload written on admin reply

| Field | Value |
|-------|--------|
| `user_id` | `support_threads.user_id` |
| `notification_type` | `support_reply` |
| `campaign_id` | `NULL` |
| `support_thread_id` | `support_threads.id` |
| `title` | `"Support replied"` |
| `message_template` | `NULL` (system-generated, not admin-composed) |
| `message_resolved` | Short preview of admin reply body (first **200** chars, ellipsis if truncated) |
| `is_read` | `false` |

**Example `message_resolved`:**

> Your withdrawal was approved today. It should arrive within 3–5 business days.

**Server helper (conceptual):**

```
createSupportReplyNotification({
  userId: thread.user_id,
  threadId: thread.id,
  replyBody: adminMessage.body,
})
```

Called inside the same transaction as `support_messages` insert.

### 6.4 Optional email (v1+)

If enabled later, after in-app insert succeeds:

- **To:** `users.email` for thread owner
- **Subject:** `Game of Creators — Support replied to your query`
- **Body:** Truncated reply + link: `/dashboard?supportThread={threadId}` (opens `ChatSupport` on that thread)

Email failure must **not** roll back the reply or in-app notification.

### 6.5 User experience

| Surface | Behavior |
|---------|----------|
| Header **bell** | Unread count includes `support_reply` notifications |
| Inbox item | Title **Support replied**; body = `message_resolved` preview |
| Click notification | Mark read → open dashboard → open `ChatSupport` with `threadId` from `support_thread_id` (or query param `?supportThread=`) |
| Support widget | Thread shows full admin message; unread badge on thread row if applicable |

### 6.6 Admin reply API — side effects

`POST /api/admin/support/threads/[threadId]/reply` response `200`:

```json
{
  "success": true,
  "message": { "id": "uuid", "body": "...", "created_at": "..." },
  "thread": { "id": "uuid", "status": "replied", "last_message_at": "..." },
  "notification": { "id": "uuid", "user_id": "uuid" }
}
```

If `notification` creation fails → `500`, no message persisted.

### 6.7 Edge cases

| Case | Behavior |
|------|----------|
| Thread soft-deleted | `404`; no reply, no notification |
| `support_chat_enabled = false` | Admin may still reply; user still gets in-app notification (they can read; composer may stay disabled) |
| Multiple admin replies | **One notification per reply** (each unread until opened or marked read) |
| User deletes account | `user_notifications` cascade per existing FK |

---

## 7. User UI specification (`ChatSupport`)

### 7.1 States

| State | UI |
|-------|-----|
| Chat enabled, no threads | Empty state + composer “Start a conversation” |
| Chat enabled, has threads | Thread list + detail |
| Chat disabled | Message + support email; hide composer |
| Loading / error | Skeleton + retry |

### 7.2 Message rules

- Max body length: **4000** characters (align with other text limits in app).
- Rate limit: e.g. **10** new threads per user per day; **50** messages per thread per day (tune in env).
- Strip empty / whitespace-only bodies.

### 7.3 Sidebar entry

- If `support_chat_enabled === false`, hide **Get in touch** or show disabled state with tooltip.
- Fetch flag from session/profile endpoint or include in dashboard layout user payload.

---

## 8. Security & compliance

| Topic | Requirement |
|-------|-------------|
| Authorization | Users only access own threads; all delete/reply/toggle routes admin-only |
| Input validation | Sanitize `body`; reject HTML/script unless rich text is explicitly added later |
| Audit | Log admin replies and deletes (`admin_id`, `thread_id`, `action`, `timestamp`) — table or structured logs |
| PII | Support bodies may contain payout/wallet info; restrict export; follow retention policy |
| Soft delete | Admin list excludes `deleted_at IS NOT NULL` by default; optional “Show deleted” filter for super-admin later |

---

## 9. Configuration

| Constant | Default | Location |
|----------|---------|----------|
| `SUPPORT_RETENTION_DAYS` | `90` | Env or `lib/constants/support.ts` |
| `SUPPORT_MESSAGE_MAX_LENGTH` | `4000` | Shared client + server |
| `SUPPORT_RATE_LIMIT_THREADS_PER_DAY` | `10` | Server |

---

## 10. Testing checklist

### User

- [ ] Submit first message creates thread; appears in admin list
- [ ] Submit follow-up on same thread
- [ ] Disabled user cannot post; sees disabled copy
- [ ] User sees admin reply in thread after refresh / realtime (if implemented)
- [ ] After admin reply: new **unread** item in notification bell for that user only
- [ ] Clicking notification opens support thread with full admin message
- [ ] Mark notification read clears unread badge (or decrements count)

### Admin

- [ ] Reply updates thread status and `last_message_at`
- [ ] Reply creates exactly one `user_notifications` row (`support_reply`) for thread owner
- [ ] Failed notification insert rolls back reply (no orphan message without alert)
- [ ] Single delete removes thread from default list
- [ ] Bulk delete only affects selected IDs
- [ ] Delete older than 90 days respects `last_message_at` and returns correct count
- [ ] Toggle support chat off/on from User Management affects user widget immediately (or on next navigation)

### Regression

- [ ] Non-admin cannot call admin support APIs
- [ ] Legacy `queries` migration: row counts match
- [ ] Contacts tab still loads

---

## 11. Implementation backlog (ordered)

1. **Migration:** `support_threads`, `support_messages`, `users.support_chat_*`, backfill from `queries`
2. **User APIs:** list / create thread / add message + `support_chat_enabled` guard
3. **Admin APIs:** list, reply (+ **transactional `user_notifications` insert**), soft delete (single, bulk, retention)
4. **Schema:** `support_reply` notification type + optional `user_notifications.support_thread_id`
5. **User inbox:** bell + panel handle `support_reply`; deep link to `ChatSupport` thread
6. **Admin UI:** thread list, detail drawer, reply, delete actions, 90-day button
7. **User UI:** refactor `ChatSupport` to thread inbox
8. **User Management:** per-user support chat toggle + API
9. **Optional:** email on admin reply
10. **Deprecate** `queries` table and old read-only-only admin table view
11. **Optional:** cron to hard-delete soft-deleted rows after grace period

---

## 12. File map (planned touchpoints)

| Area | Files |
|------|--------|
| User widget | `components/ChatSupport.tsx` |
| User layout / sidebar | `components/dashboard-sidebar.tsx`, `app/dashboard/ClientLayout.tsx` |
| Admin support | `app/dashboard/admin/support/page.tsx`, `support-client.tsx` |
| Admin users toggle | `app/dashboard/admin/users/*` |
| APIs | `app/api/support/**`, `app/api/admin/support/**`, `app/api/admin/users/[userId]/support-chat/route.ts` |
| Migration | `SUPABASE/migrations/YYYYMMDD_support_threads.sql` |
| Constants | `lib/constants/support.ts` (new) |

---

## 13. Related documentation

- `docs/admin_user_notifications.md` — in-app notification delivery for “support replied”
- `docs/GoViral_Complete_PRD.md` — product context (if support SLAs are defined there)

---

## 14. Open questions (decide before build)

1. **One open thread per user** vs unlimited parallel threads?
2. **Email on every admin reply** or only when user is offline? (In-app on reply is **required** — decided.)
3. Should **contacts** tab gain the same delete/retention tools?
4. Hard-delete schedule after soft-delete (if any)?
5. Realtime updates (Supabase realtime) vs poll on open?

Default recommendations: **one active open thread per user** (new topic closes previous or prompts), **in-app notification on every admin reply (required)**, **email optional**, **contacts unchanged in v1**, **hard-delete after 30 days soft-deleted**, **poll on open for v1**.
