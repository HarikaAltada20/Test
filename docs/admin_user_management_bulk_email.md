# Admin Bulk Email — Implementation Guide

**Status:** Planned (docs only) · **Updated:** June 9, 2026  
**Page:** `/dashboard/admin/users`  
**Email provider:** AWS SES only (not Resend)  
**Related:** [admin_user_notifications.md](./admin_user_notifications.md) — in-app bell notifications (separate feature)

---

## 1. What we are building

Admins send bulk email to users via **AWS SES** using this order:

1. **Create project** (domain + SES setup)  
2. **Create campaign** (under that project)  
3. **Select users** on Table tab → attach to project + campaign → **Send**  
4. **Redirect to campaign** → pick **template**, **schedule**, **account to use** → launch  

In-app bell notifications stay on the **Notifications** tab.  
All email work lives on the **Email** tab.

---

## 2. Page layout — four tabs

```
[ Table ]  [ Map ]  [ Notifications ]  [ Email ]
```

| Tab | Purpose |
|-----|---------|
| **Table** | Select users → pick **project + campaign** → **Send** → redirects to campaign |
| **Map** | Geo view (unchanged) |
| **Notifications** | In-app announcements only — who read the bell message ([existing spec](./admin_user_notifications.md)) |
| **Email** | Projects, SES config, templates, sent campaigns, opens/clicks analytics |

`viewMode`: `"table"` \| `"map"` \| `"notifications"` \| `"email"`

---

## 3. Full flow (step by step)

```
STEP 1 — Email tab          STEP 2 — Email tab         STEP 3 — Table tab
Create project              Create campaign            Select users + Send
  • Project details           • Pick project             • Filter users
  • SES domain + DNS          • Campaign name            • Select all or rows
  • Verify + sender emails    • Status: draft            • Pick project + campaign
                                                         • Click [ Send ]
                                                              ↓
STEP 4 — Redirect           STEP 5 — Campaign detail (configure then launch)
→ Campaign detail page        • Sequence  → pick template + edit subject/body
                              • Schedule  → when to send + daily limit
                              • Options   → account to use (sender email)
                              • [ Start campaign ]  → SES sends emails
```

| Step | Where | What admin does |
|------|-------|-----------------|
| **1** | Email tab | **[ + New project ]** → wizard: details, domain, DNS, verify, senders |
| **2** | Email tab | Inside project → **[ + New campaign ]** → name only → saves as **draft** |
| **3** | Table tab | Filter → select users → **[ Send ]** → modal: pick **Project** + **Campaign** → confirm |
| **4** | Auto | App **redirects to campaign detail** on Email tab |
| **5** | Campaign detail | Set **template** (Sequence), **schedule** (Schedule), **account** (Options) → **Start campaign** |

> Template, schedule, and sender are **not** chosen on the Table tab. They are set on the campaign page **after** users are attached.

---

## 4. Step 1 — Create project (Email tab)

**[ + New project ]** → 4-step wizard:

| Wizard step | What |
|-------------|------|
| **1 — Project details** | Name, description. Optional ☑ use platform sender (`noreply@gameofcreators.com`) |
| **2 — Email configuration** | Root domain + subdomain prefix → e.g. `connect.gameofcreators.com` |
| **3 — Verify with SES** | Copy DNS (DKIM, SPF, DMARC) or Export JSON → Check verification |
| **4 — Sender emails** | Add `announcements@connect…` → pick default → **Finish** |

Project must be **SES verified** before campaigns can send email.

---

## 5. Step 2 — Create campaign (Email tab)

Inside a project → **[ + New campaign ]**

| Field | Required | Notes |
|-------|----------|-------|
| Campaign name | Yes | e.g. `Summer contest blast` |
| Project | Pre-filled | Parent project |

Creates a **draft** campaign (`status = draft`). No recipients yet. No email sent yet.

Campaign appears in project list:

```
When     │ Campaign name          │ Recipients │ Status
—        │ Summer contest blast   │ 0          │ draft
```

**API:** `POST /api/admin/email-campaigns` with `{ projectId, name }`

---

## 6. Step 3 — Select users and send (Table tab)

### Steps

1. **Table** tab → filter (Creators / Brands / country …).
2. Select ☐ rows or ☑ **Select all (matching filters)**.
3. Click **[ Send ]** (disabled if no selection).
4. **Send modal** opens — only project + campaign picker:

```
┌ Attach users to campaign ─────────────────────────── ✕ ┐
│                                                        │
│  Recipients (read-only)                                │
│    Sending to 340 users (340 creators)                 │
│                                                        │
│  Project *     [ Q2 Creator Updates ▼ ]                │
│  Campaign *    [ Summer contest blast ▼ ]  [ + New ] │
│                                                        │
│              [ Cancel ]        [ Send → ]              │
└────────────────────────────────────────────────────────┘
```

| Field | Notes |
|-------|-------|
| **Recipients** | Read-only summary from table selection |
| **Project** | Only SES-verified projects listed |
| **Campaign** | Only **draft** campaigns under selected project |
| **[ + New ]** | Quick-create draft campaign without leaving modal |

5. Click **[ Send → ]**:
   - Server attaches all selected users to the campaign (`admin_notification_campaign_recipients`).
   - Campaign status → `configured` (recipients set, not yet sending).
   - **Redirect** to campaign detail on Email tab.

### Rules

| Rule | Why |
|------|-----|
| Server re-runs filters for Select all | Never trust client count alone |
| Max 10,000 recipients | Reject with error if too many |
| Campaign must be `draft` | Cannot re-attach users to active/completed campaign |
| Map tab has no Send button | Use Table tab |

**API:** `POST /api/admin/email-campaigns/:id/attach-recipients`

```json
{
  "recipientMode": "select_all_filtered",
  "filters": { "activeTab": "creators", "isActive": true, "filters": [] }
}
```

---

## 7. Step 4 & 5 — Campaign detail (after redirect)

After **Send →**, admin lands on the campaign detail page.  
**Configure everything here before emails go out.**

Top bar:

```
← All campaigns     Summer contest blast — 340 recipients — draft

[ Analytics ] [ Recipients ] [ Sequence ] [ Schedule ] [ Options ]     [ Start Campaign ]
```

### What to set before launching

| Tab | Admin sets | Required before start? |
|-----|------------|------------------------|
| **Recipients** | Review attached users (read-only list) | Auto-filled from Step 3 |
| **Sequence** | **Pick template** + edit subject & body | ✅ Yes |
| **Schedule** | **When to send** — now or date/time, daily limit, timings | ✅ Yes |
| **Options** | **Account to use** — sender email from project | ✅ Yes |
| **Analytics** | Empty until campaign starts | — |

### Launch

When Sequence + Schedule + Options are saved:

- Click **[ Start Campaign ]** (top right).
- Status: `draft` → `configured` → `active` (or `scheduled` if future start time).
- Worker sends via AWS SES using chosen template, schedule, and sender account.

```
Campaign detail
  1. Recipients tab  → confirm 340 users attached
  2. Sequence tab    → select template, edit subject/body → Save
  3. Schedule tab    → pick send time + daily limit → Save
  4. Options tab     → pick account to use → Save
  5. [ Start Campaign ] → emails begin sending
```

---

## 8. Email tab — UI overview

```
Email tab
├─ [ + New project ]  [ Manage templates ]
│
├─ Projects
│   📁 Q2 Creator Updates     connect.gameofcreators.com ✓
│       [ + New campaign ]
│
├─ Campaigns
│   Name                  │ Recipients │ Status
│   Summer contest blast  │ 340        │ configured  ← after Table Send
│   May promo             │ 875        │ active
│
└─ Click row OR redirect after Table Send → Campaign detail (§7, §9)
```

To add users: go to **Table** tab → select users → **Send** → pick project + campaign.

---

## 9. Campaign detail tabs (reference)

**Entry:** redirect after Table **Send →**, or click campaign row on Email tab.  
**Back:** `← All campaigns`

```
[ Analytics ] [ Recipients ] [ Sequence ] [ Schedule ] [ Options ]   [ Start Campaign ]
                                                              (Pause when active)
```

| Tab | Purpose |
|-----|---------|
| **Analytics** | Live stats — sent, opens, clicks, progress |
| **Recipients** | Every user in this campaign + delivery status |
| **Sequence** | Email subject + body (what gets sent) |
| **Schedule** | When emails go out + daily limits |
| **Options** | Sender account + campaign rules |

---

#### Tab 1 — Analytics

Shows campaign health and performance while sending or after done.

```
┌ Status ──────────────────────────────────────────────────────────┐
│  active    Progress ████░░░░ 45%                                 │
│  Started: Jun 8, 2026    Est. completion: Jun 12, 2026         │
│  Paused: —               Remaining: 875                          │
└──────────────────────────────────────────────────────────────────┘

ℹ Email sending in progress.

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Sequence     │ │ Open Rate    │ │ Click Rate   │ │ Bounced      │
│ Started 875  │ │ 35.2% | 308  │ │ 12.1% | 106  │ │ 0.6% | 5     │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Campaign Performance
  [ line chart — opens & clicks over time ]
```

| UI element | Data source |
|------------|-------------|
| Status badge | `admin_notification_campaigns.status` — `scheduled` \| `active` \| `paused` \| `completed` \| `partial` |
| Progress % | `sent_count / recipient_count` |
| Remaining | Recipients still `email_delivery_status = pending` |
| Sequence Started | Total emails accepted by SES |
| Open Rate | `opened / sent` from `admin_email_tracking` |
| Click Rate | `clicked / sent` from `admin_email_tracking` |
| Bounced | SES bounce + complaint count |
| **Pause Campaign** | Sets status `paused`; worker skips pending sends |
| Performance chart | Hourly opens/clicks from `admin_email_tracking_events` |

**API:** `GET /api/admin/email-campaigns/:id/analytics`

---

#### Tab 2 — Recipients

List of every user targeted by this campaign (same idea as PersistWizard **Lead** tab, but GoC users instead of leads).

```
[ Search emails, names… ]  [ Filter: All ▼ ]  [ Manage table ]

☐  #  Email              Status    From Email                        Name         Type      Country
☐  1  jane@example.com   Delivered announcements@connect…          Jane Doe     Creator   US
☐  2  john@example.com   Opened    announcements@connect…          John Smith   Creator   IN
☐  3  biz@brand.com      Bounced   announcements@connect…          Acme Inc     Brand     UK
```

| Column | Meaning |
|--------|---------|
| **Email** | `users.email` |
| **Status** | `pending` \| `sent` \| `delivered` \| `opened` \| `clicked` \| `bounced` \| `skipped` |
| **From Email** | `from_email` snapshot on campaign |
| **Name** | `users.full_name` |
| **Type** | `creator` \| `advertiser` \| `admin` |
| **Country** | From `creator_profiles` / `advertiser_profiles` |

| Action | Behavior |
|--------|----------|
| Search | Filter by email, name, username |
| Filter dropdown | All / Sent / Opened / Not opened / Clicked / Bounced / Skipped |
| Row checkboxes | Select users for export CSV |
| Export CSV | Email, name, status, opened_at, clicked_at |

**API:** `GET /api/admin/email-campaigns/:id/recipients?status=&search=&page=`

---

#### Tab 3 — Sequence (pick template here)

**This is where admin selects the email template** after users are attached.  
**v1 = one step.** Future: multi-step drip.

| Action | UI |
|--------|-----|
| **Pick template** | Dropdown at top — loads subject + body from `admin_email_templates` |
| Edit | Change subject/body after template selected |
| Save | Required before **Start Campaign** |

```
Sequence Steps (1)                              [ Refresh ]  [ + Add Step ]

┌ Step 1 ──────────────────────────────────────┐
│  📧  Final step — no delay needed            │
│  0 variants                    [ + Add Variant ]│
└──────────────────────────────────────────────┘

Step 1 — 0 variants                            [ Preview ]

Subject *   [ Don't miss: {contest_title}                    ]  { }

Email Body  [ Rendered view ▼ ]
            [ B I U | font | align | lists | {} variables | link | image | <> ]

            Hi {full_name}, a new contest is live on Game of Creators…

                                              [ Save ▼ ]
```

| Field | Notes |
|-------|-------|
| **Subject** | Supports `{variables}` — resolved per recipient at send time |
| **Email Body** | Rich text; stored as `message_template` on campaign |
| **{} button** | Insert `{full_name}`, `{email}`, `{username}`, `{contest_title}` |
| **Preview** | Render HTML for a sample user |
| **+ Add Step** | v2 — follow-up emails with delay between steps |
| **Variants** | v2 — A/B test subject or body |

| Campaign state | Edit rule |
|----------------|-----------|
| `scheduled` (not started) | Subject + body **editable**; Save updates campaign |
| `active` (sending) | Body **read-only** for already-sent users; optional edit for remaining |
| `completed` | **Read-only** — view what was sent |

**API:** `GET/PATCH /api/admin/email-campaigns/:id/sequence`

---

#### Tab 4 — Schedule (set send time here)

**This is where admin sets when emails go out** — required before **Start Campaign**.

```
☑ Use project default schedule          (toggle)

Daily Limit     [ 300 ]

Timings         From [ 09:00 ]   To [ 21:00 ]   Timezone [ IST ▼ ]

Days            ☑ Mon  ☑ Tue  ☑ Wed  ☑ Thu  ☑ Fri  ☑ Sat  ☑ Sun
```

| Field | Meaning |
|-------|---------|
| **Use project default** | Inherit schedule from `admin_email_projects`; off = custom for this campaign |
| **Daily Limit** | Max emails per day for this campaign (respect SES quota) |
| **Timings** | Only send between From–To in chosen timezone |
| **Days** | Which weekdays sending is allowed |

For **Send now** campaigns, schedule = immediate burst (still rate-limited by batch worker).  
For **Schedule** campaigns, `scheduled_at` is the start time; daily limit + timings apply after that.

**API:** `GET/PATCH /api/admin/email-campaigns/:id/schedule`

---

#### Tab 5 — Options (account to use here)

**This is where admin picks the sender account** — required before **Start Campaign**.

```
Accounts to use
Select one or more sender addresses to send from
[ announcements@connect.gameofcreators.com ▼ ]

Autoselect will be used if no sender is selected.

Stop sending emails on reply          [ Disable | Enable ]
Stop sending to a user if they reply to this email.

                    [ Reset to Autoselect ]    [ Save ]
```

| Field | v1 behaviour |
|-------|--------------|
| **Accounts to use** | Pick from `admin_email_project_senders` for this campaign's project |
| **Autoselect** | Use project default sender if none picked |
| **Stop on reply** | v2 — if user replies via SES inbound, mark recipient `stopped` |
| **Save** | Updates campaign options |
| **Pause Campaign** | (top bar) Pauses all pending sends |

Also show read-only summary:

| Field | Example |
|-------|---------|
| Project | Q2 Creator Updates |
| Created by | Admin name |
| Recipient mode | Select all (340 creators, US filter) |
| Channels | Email + In-app |
| Created at | Jun 8, 2026 2:30 PM |

**API:** `GET/PATCH /api/admin/email-campaigns/:id/options`

---

#### Campaign detail — data loaded on open

When admin clicks a campaign, one API call (or parallel calls) loads everything:

`GET /api/admin/email-campaigns/:id`

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "Q2 Creator Updates",
  "emailSubject": "Don't miss: Summer Launch",
  "status": "active",
  "recipientCount": 875,
  "sentCount": 400,
  "remainingCount": 475,
  "progressPercent": 45.7,
  "startedAt": "2026-06-08T10:00:00Z",
  "estimatedCompletionAt": "2026-06-12T18:00:00Z",
  "fromEmail": "announcements@connect.gameofcreators.com",
  "summary": {
    "openRate": 0.352,
    "openCount": 308,
    "clickRate": 0.121,
    "clickCount": 106,
    "bounceRate": 0.006,
    "bounceCount": 5
  },
  "schedule": { "dailyLimit": 300, "fromTime": "09:00", "toTime": "21:00", "timezone": "Asia/Kolkata", "days": [1,2,3,4,5,6,7] },
  "sequence": { "steps": [{ "stepNumber": 1, "subject": "...", "body": "..." }] }
}
```

Sub-tabs fetch extra data on demand (recipients paginated, chart timeline).

---

## 10. Email templates

**Create:** Email tab → **[ Manage templates ]**  
**Use:** Campaign detail → **Sequence** tab → template dropdown

| Action | What |
|--------|------|
| Create | Name, subject, body, optional CTA |
| Edit / Duplicate | Reuse across campaigns |
| Apply | Sequence tab on campaign detail — not on Table tab |

HTML layout: `EMAIL_TEMPLATES/campaign-notification-goc.html`  
**Variables:** `{full_name}`, `{email}`, `{username}`, `{user_type}`, `{contest_title}`

---

## 11. Sending and tracking (backend)

### Send pipeline

```
1. POST create project + SES verify
2. POST create campaign (draft)
3. POST attach-recipients (from Table tab Send)
4. PATCH sequence + schedule + options on campaign detail
5. POST start-campaign
   → Queue worker (Upstash + QStash)
   → Per user: resolve template, tracking pixel, wrapped links
   → AWS SES SendEmail (from account chosen in Options)
   → Store ses_message_id
```

### Opens and clicks

| Event | How |
|-------|-----|
| **Open** | 1×1 pixel: `GET /track/open/{tracking_id}` |
| **Click** | Wrapped link: `GET /track/click/{tracking_id}?url=…` → redirect |
| **Bounce** | SES webhook → mark bounced, add to suppression list |

### Reuse existing code

| Already built | Use for |
|---------------|---------|
| `lib/admin-notifications/recipients.ts` | Select all / hand-pick recipients |
| `lib/admin-notifications/delivery.ts` | Extend for SES email send |
| `lib/admin-notifications/template.ts` | Variable substitution |
| `lib/queue/admin-notification-delivery-queue.ts` | Batch delivery queue |

### New code to build

| File | Purpose |
|------|---------|
| `lib/email/ses-client.ts` | AWS SES send |
| `lib/email/ses-identity.ts` | Domain verify + DNS records |
| `lib/email/admin-bulk-email.ts` | HTML wrapper + tracking injection |
| `app/track/open/[id]/route.ts` | Open pixel |
| `app/track/click/[id]/route.ts` | Click redirect |
| `app/api/webhooks/ses/route.ts` | Bounce / complaint |
| `CreateEmailProjectWizard.tsx` | 4-step project wizard |
| `EmailCampaignDetail.tsx` | Campaign detail — 5 tabs |
| Email tab UI | Projects, campaign list, detail page |

---

## 12. Database (main tables)

| Table | Stores |
|-------|--------|
| `admin_email_projects` | Project name, subdomain, SES status, DNS records |
| `admin_email_project_senders` | From addresses per project |
| `admin_email_templates` | Reusable subject + body |
| `admin_notification_campaigns` | Campaign per project — status: `draft` → `configured` → `active` → `completed` |
| `admin_notification_campaign_recipients` | Per user (extend: `email_delivery_status`, `ses_message_id`) |
| `admin_email_tracking` | Per user open/click |
| `email_suppressions` | Bounced emails — skip on future sends |

Default seed: one project **"General announcements"** with `use_platform_sender = true`.

**Campaign status flow:**

```
draft  →  configured  →  scheduled / active  →  completed / partial / paused
  ↑           ↑                  ↑
Step 2    Step 3 (users      Step 5 (Start
          attached)           Campaign)
```

---

## 13. APIs (summary)

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `POST /api/admin/email-projects` | Create project |
| 1 | `POST .../email-projects/:id/email-config` | Domain + subdomain |
| 1 | `POST .../verify-ses` | SES verification |
| 1 | `POST .../senders` | Sender emails |
| 2 | `POST /api/admin/email-campaigns` | Create draft campaign |
| 3 | `POST .../email-campaigns/:id/attach-recipients` | Attach users from Table tab |
| 3 | `POST /api/admin/email-campaigns/recipient-count` | Count for Select all |
| 5 | `PATCH .../email-campaigns/:id/sequence` | Template + subject/body |
| 5 | `PATCH .../email-campaigns/:id/schedule` | Send time + limits |
| 5 | `PATCH .../email-campaigns/:id/options` | Account to use |
| 5 | `POST .../email-campaigns/:id/start` | Launch sending |
| — | `GET .../email-campaigns/:id` | Campaign detail |
| — | `POST .../email-campaigns/:id/pause` | Pause active campaign |
| — | `GET /track/open/:id` · `GET /track/click/:id` | Tracking |
| — | `POST /api/webhooks/ses` | Bounce / complaint |

After step 3, API returns `{ campaignId }` → frontend redirects to `/dashboard/admin/users?tab=email&campaignId=…`

---

## 14. Environment variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_CONFIGURATION_SET=gameofcreators-bulk
NEXT_PUBLIC_APP_URL=https://gameofcreators.com

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
```

---

## 15. Implementation checklist

### Phase 1 — Project + campaign (Email tab)
- [ ] Add **Email** tab
- [ ] 4-step Create project wizard (SES domain + senders)
- [ ] **[ + New campaign ]** per project → draft status
- [ ] Campaign list on Email tab

### Phase 2 — Attach users (Table tab)
- [ ] Send modal: **Project + Campaign only** (no template/schedule here)
- [ ] `attach-recipients` API + server-side Select all
- [ ] Redirect to campaign detail after Send →

### Phase 3 — Configure + launch (Campaign detail)
- [ ] **Sequence** tab — template picker + subject/body
- [ ] **Schedule** tab — send time + daily limit
- [ ] **Options** tab — account to use
- [ ] **[ Start Campaign ]** button + `start` API
- [ ] **Analytics** + **Recipients** tabs after sending

### Phase 4 — Compliance
- [ ] User email opt-out (Settings toggle → DB)
- [ ] Bounce suppression via SES webhook
- [ ] Unsubscribe link in email footer

---

## 16. Notifications vs Email

| | Notifications tab | Email tab |
|--|-------------------|-----------|
| **Channel** | In-app bell | AWS SES |
| **Flow** | Table → send message | Project → campaign → Table attach users → campaign detail → start |
| **Template** | In send modal | **Sequence** tab on campaign |
| **Schedule** | In send modal | **Schedule** tab on campaign |
| **Sender** | N/A | **Options** tab on campaign |

---

## 17. Key files

| Area | Path |
|------|------|
| Users page | `app/dashboard/admin/users/page.tsx` |
| Send modal | `app/dashboard/admin/users/SendNotificationModal.tsx` |
| In-app spec | `docs/admin_user_notifications.md` |
| Email HTML reference | `EMAIL_TEMPLATES/campaign-notification-goc.html` |
| PersistWizard reference | `WEBSITE_IMPLEMENTATION.md` |

---

*Documentation only — no code changes in this file.*
