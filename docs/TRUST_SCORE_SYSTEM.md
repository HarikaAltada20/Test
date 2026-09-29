# Creator Trust Score

**Status:** Planned (not built yet) · **Updated:** May 25, 2026

---

## What is it?

Every creator has a **Trust Score from 0 to 100**.

Brands **may** set a **minimum trust score** per campaign (e.g. 70). **Only when that is set** do we check the creator’s score before submit.

**If the brand does not set a minimum** → **no trust condition** → creators can **submit content normally** (same as today).

---

## Default: everyone starts at 100

**By default, all creators have a trust score of 100.**

- New signups → **100**
- No submissions yet → **100**
- Submissions but **zero rejections** → still **100**

The score **only goes down** when content is **rejected**. More rejections (compared to total submissions) → lower score.

Verified and pending submissions are tracked for display, but **rejections are what reduce the score**.

---

## How the score is calculated

The system **recalculates** trust score from the creator’s submission history:

| Count | Meaning |
|-------|---------|
| **Total** | All submissions (reels/videos/tweets) |
| **Rejected** | Brand/admin rejected — **these lower the score** |
| **Verified** | Approved (`verified` or `paid`) — shown on profile |
| **Pending** | Waiting for review — does not lower score by default |

**Formula:**

```
Start from 100
Rejected % = (Rejected ÷ Total) × 100   (if Total is 0, score stays 100)
Trust Score = 100 − Rejected %
```

**In plain words:** Start at **100**, subtract the **percentage of rejected** submissions. That number is the trust score (minimum 0).

### Examples

**Example 1 — New creator**  
- Total: 0 → **Score: 100**

**Example 2 — Doing well**  
- 10 submissions: 8 verified, 2 rejected, 0 pending  
- Rejected % = 2 ÷ 10 = **20%**  
- Score = 100 − 20 = **80**

**Example 3 — Many rejections**  
- 4 submissions: 1 verified, 3 rejected  
- Rejected % = 3 ÷ 4 = **75%**  
- Score = 100 − 75 = **25**

**Example 4 — All still pending**  
- 5 pending, 0 rejected  
- Rejected % = **0%**  
- Score = **100** (nothing rejected yet)

**Example 5 — Score goes down over time**  
- Day 1: 10 subs, 1 rejected → score **90** → joins Campaign A (needs 70) ✅  
- Day 2: 4 more rejected (5 total of 14) → score **64**  
- Campaign A & B **still show** in opportunities ✅  
- **Submit content** button **disabled** + warning on both (need 70) ❌

---

## Who sets the rules?

| Who | What they can do |
|-----|------------------|
| **Brand** | **Optionally** set minimum score per campaign; leave empty = no limit |
| **Admin** | View creator breakdown; edit campaign minimum if needed |
| **Creator** | View score + breakdown (total, verified, rejected, pending, %) |

---

## When is trust score required?

| Campaign setting | Submit content |
|------------------|----------------|
| Brand **did not set** a minimum (`min_trust_score` empty) | ✅ **No trust check** — anyone can submit (other rules still apply) |
| Brand **set** a minimum (e.g. 70) and creator score **≥** minimum | ✅ Submit allowed |
| Brand **set** a minimum and creator score **below** minimum | ❌ Submit **disabled** + warning message |

**Important:** There is **no platform-wide fallback** (e.g. auto 70). If the brand leaves it blank, trust score is **not** used for that campaign.

---

## What creators see & can do

### Finding campaigns (Opportunities list)

**Campaigns always show** in the opportunities list (same as today — published, dates, platform, etc.). 

If the brand **set a minimum** and the creator’s score is **below** it:

- They **can open** the campaign and read the brief  
- **Submit content** is **disabled**  
- A **warning message** is shown (on the campaign page and on the submit page)

If the brand **did not set** a minimum → submit works as today (no trust warning).

### Can they submit?

| Campaign minimum set? | Creator score | Submit content button |
|----------------------|---------------|------------------------|
| **No** (not set) | any | ✅ **Enabled** (no trust condition) |
| **Yes** (e.g. 70) | at or above minimum | ✅ **Enabled** |
| **Yes** | below minimum | ❌ **Disabled** + **warning message** |

**Simple rule:** Trust only matters when the **brand chose a minimum**. Otherwise creators can always submit (for trust).

---

## Submit page — score too low (UI)

When the campaign **has a minimum set** and the creator’s score is **below** that minimum:

1. **Submit button is disabled** (greyed out, not clickable).
2. A **message is shown** above or below the button (banner or alert — always visible, not only after a failed click).

**When the button is enabled**

- Creator score **at or above** brand minimum (e.g. score 75, minimum 70) → submit works as today.

**When the button is disabled**

- Creator score **below** brand minimum (e.g. score 62, minimum 70) → no submit, show message below.

**Message copy (use this text in the app):**

> **Trust score too low to submit**  
> Your trust score is **62**. This campaign requires at least **70**.  
> You can still view this campaign and your existing submissions. Submit new content after your score reaches **70** or higher.

Replace **62** and **70** with the creator’s real score and the campaign minimum.

**Also block on the server** if someone bypasses the UI — return the same message in the API error.

**Where this applies**

- Campaign detail → “Submit content” entry  
- Full submit page: `app/dashboard/opportunities/[id]/submit/`  
- Same check if they already joined and score dropped later (button stays disabled until score goes back up)

---

## Real-world stories

**Story A — Campaign with no minimum**  
- Brand left trust minimum **empty** → Mike (score 25) can **submit** ✅ (no trust rule)

**Story B — Sarah (score 85)**  
- Campaign minimum **70** → she submits ✅

**Story C — Mike (score 55)**  
- Campaign X needs 70 → Mike **sees** it in opportunities ✅  
- Clicks **Submit content** → button **disabled**, warning shown ❌

**Story D — Lisa joined early, score dropped**  
- Joined Campaign Y at score 80 (brand minimum 70)  
- Later rejections → score **60** (below 70)  
- Campaign Y **still on her dashboard** ✅  
- Opens submit page → sees message, **Submit** button **disabled** ❌  
- When score reaches **70+** again → button **enabled** ✅

**Story E — Lisa improves her score**  
- More submissions get **verified**, fewer rejections → score back to **72** → submit **enabled** again ✅

---

## When does the score update?

Whenever submission status changes:

- New submission → total goes up  
- Verified / paid → verified goes up  
- Rejected → rejected goes up, **score drops**  
- Changed back to verified → score **recalculates up**

Same flow as today’s verify/reject in admin and brand tools.

---

## Brand setup (per campaign)

When creating or editing a campaign:

- **Minimum trust score** (0–100) — **optional**  
- Leave **empty** → no trust requirement; all creators can submit  
- Set a number (e.g. 70) → only creators with score ≥ that number can submit  

Help text for brands:

> Optional. Leave blank to allow all creators to submit. If you set a minimum, creators below that score can still view your campaign but cannot submit until their trust score is high enough.

---

## Admin setup

1. **Creator page** — view trust breakdown (read-only)  
2. **Any campaign** — optionally set or clear minimum (same as brand); empty = no trust condition  

---

## Creator profile — Trust Score card (implementation)

Add a **Trust Score card** on the creator **Profile** page (`/dashboard/profile`).

**Files to add / change:**

| Piece | Path |
|-------|------|
| Profile page (server) | `app/dashboard/profile/page.tsx` — load trust metrics for logged-in creator |
| Profile UI | `app/dashboard/profile/client.tsx` — render the card |
| Reusable card | `components/TrustScoreCard.tsx` (new) |
| Data API | `GET /api/creators/trust-score` — returns score + breakdown |
| Calculation | `lib/trust-score.ts` — `computeTrustScore()`, `getTrustMetrics()` |

### Card design (UI)

A single polished card in the profile section (top or sidebar — match existing profile layout).

**Header**

- Title: **Trust Score**
- Large number: **80** / 100 (or **100** for new creators)
- Optional: circular progress ring or color band (green 80+, amber 50–79, red below 50)

**Breakdown rows (always show all five)**

| Label | Example | Notes |
|-------|---------|--------|
| **Rejected %** | 20% | `(rejected ÷ total) × 100` — what reduces score from 100 |
| **Total reels** | 10 | All counted submissions |
| **Verified reels** | 8 | `verified` + `paid` |
| **Rejected reels** | 2 | Drives score down |
| **Pending reels** | 0 | Awaiting review |

**Footer hint (short)**

> Your score starts at 100 and goes down when submissions are rejected. Brands may require a minimum score to submit to campaigns.

**Loading / empty**

- Loading: skeleton on the card  
- `total_reels === 0`: still show score **100** and zeros in the table  

**Example card (mock)**

```
┌─────────────────────────────────────┐
│  Trust Score                    ⓘ   │
│                                     │
│         80 / 100                    │
│                                     │
│  Rejected %          20%            │
│  Total reels         10             │
│  Verified reels       8             │
│  Rejected reels       2             │
│  Pending reels        0             │
│                                     │
│  Score = 100 − rejected %           │
└─────────────────────────────────────┘
```

### API response shape

```json
{
  "trust_score": 80,
  "rejected_pct": 20,
  "verified_pct": 80,
  "pending_pct": 0,
  "total_reels": 10,
  "verified_reels": 8,
  "rejected_reels": 2,
  "pending_reels": 0
}
```

Recalculate on profile load (or use cached columns on `creator_profiles` updated on verify/reject).

---

## Database migrations

Run in order. Use the same pattern as other project migrations (`db/migrations/` for deploy, `SUPABASE/` for reference).



Copy the SQL below into those files (adjust date prefix to match your branch).

### Migration 1 — `creator_profiles`

```sql
-- Trust score metrics cached on creator profile (default score 100 for all rows).
-- Recomputed in app when submissions are verified/rejected.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS trust_total_reels integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_verified_reels integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_rejected_reels integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_pending_reels integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS trust_metrics_updated_at timestamptz NULL;

ALTER TABLE public.creator_profiles
  ADD CONSTRAINT creator_profiles_trust_score_range
    CHECK (trust_score >= 0 AND trust_score <= 100);

COMMENT ON COLUMN public.creator_profiles.trust_score IS 'Computed: 100 minus rejected %. Default 100.';
COMMENT ON COLUMN public.creator_profiles.trust_total_reels IS 'All submissions counted for trust (reels/videos/tweets).';
COMMENT ON COLUMN public.creator_profiles.trust_verified_reels IS 'status in (verified, paid).';
COMMENT ON COLUMN public.creator_profiles.trust_rejected_reels IS 'status = rejected; drives score down.';
COMMENT ON COLUMN public.creator_profiles.trust_pending_reels IS 'status = pending.';

CREATE INDEX IF NOT EXISTS idx_creator_profiles_trust_score
  ON public.creator_profiles (trust_score);
```

### Migration 2 — `contests`

```sql
-- Per-campaign minimum trust score (brand/admin).

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS min_trust_score integer NULL,
  ADD COLUMN IF NOT EXISTS trust_score_enforced boolean NOT NULL DEFAULT true;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_min_trust_score_range
    CHECK (min_trust_score IS NULL OR (min_trust_score >= 0 AND min_trust_score <= 100));

COMMENT ON COLUMN public.contests.min_trust_score IS 'Optional. NULL = no trust requirement for this campaign. Set 0-100 to require creator trust_score >= this value to submit.';
COMMENT ON COLUMN public.contests.trust_score_enforced IS 'When false, campaign ignores trust score even if min_trust_score is set.';

CREATE INDEX IF NOT EXISTS idx_contests_min_trust_score
  ON public.contests (min_trust_score)
  WHERE min_trust_score IS NOT NULL;
```

### Migration 3 — backfill existing creators

```sql
-- One-time: set trust_score = 100 for everyone, then recalc from submissions.
-- Run AFTER migrations 1–2. App backfill script may replace this for Twitter tweets.

UPDATE public.creator_profiles
SET
  trust_total_reels = 0,
  trust_verified_reels = 0,
  trust_rejected_reels = 0,
  trust_pending_reels = 0,
  trust_score = 100,
  trust_metrics_updated_at = now();

WITH counts AS (
  SELECT
    s.creator_id,
    COUNT(*)::integer AS total_reels,
    COUNT(*) FILTER (WHERE s.status IN ('verified', 'paid'))::integer AS verified_reels,
    COUNT(*) FILTER (WHERE s.status = 'rejected')::integer AS rejected_reels,
    COUNT(*) FILTER (WHERE s.status = 'pending')::integer AS pending_reels
  FROM public.submissions s
  WHERE s.creator_id IS NOT NULL
  GROUP BY s.creator_id
)
UPDATE public.creator_profiles cp
SET
  trust_total_reels = COALESCE(c.total_reels, 0),
  trust_verified_reels = COALESCE(c.verified_reels, 0),
  trust_rejected_reels = COALESCE(c.rejected_reels, 0),
  trust_pending_reels = COALESCE(c.pending_reels, 0),
  trust_score = CASE
    WHEN COALESCE(c.total_reels, 0) = 0 THEN 100
    ELSE GREATEST(
      0,
      ROUND(100 - (c.rejected_reels::numeric / c.total_reels::numeric) * 100)
    )::integer
  END,
  trust_metrics_updated_at = now()
FROM counts c
WHERE cp.id = c.creator_id;
```

**Note:** Extend backfill with `twitter_campaign_tweets` if Twitter counts toward trust in v1.

### Migration 4 — `contests_with_status` view

After migration 2, update the view so the app reads `min_trust_score` and `trust_score_enforced` from `contests_with_status` (same pattern as `SUPABASE/add_region_column_to_contests.sql`):

- Add `contests.min_trust_score` and `contests.trust_score_enforced` to the `SELECT` list in `CREATE OR REPLACE VIEW public.contests_with_status`.
- Run `SUPABASE/verify_view_update.sql` style checks after deploy.

### After migrations

1. Update `types/supabase.ts` (Row/Insert/Update for `creator_profiles`, `contests`).  
2. Run backfill migration or `scripts/` job once in production.  
3. Wire recompute in verify/reject APIs so columns stay in sync.

---

## Build notes (for developers)

**Store on creator (`creator_profiles`):**  
`trust_total_reels`, `trust_verified_reels`, `trust_rejected_reels`, `trust_pending_reels`, `trust_score`

**Store on contest:** `min_trust_score`, `trust_score_enforced`

**Must check on server** when creating a submission (UI disables the button + shows warning; API must block too).

**Enforce submit (UI + API):**

```
if (contest.min_trust_score is null OR !trust_score_enforced) {
  // No trust condition — submit allowed (other rules still apply)
} else if (creator_score < contest.min_trust_score) {
  disable submit button + show warning
  block API on submit attempt
} else {
  enable submit button
}
```

**Not set** → no trust gate. **Set** → score must be at or above minimum.

**Opportunities list:** Do **not** filter out campaigns by trust score — always show eligible campaigns.

**Campaign detail + submit page:** Only if `min_trust_score` is set and `creator_score` is below it → disable **Submit content**, show warning banner.

**Key files to hook:**  
`app/dashboard/profile/` + `components/TrustScoreCard.tsx` (profile card),  
`app/dashboard/opportunities/[id]/` (detail — disabled button + warning),  
`app/dashboard/opportunities/[id]/submit/` (submit page),  
`app/api/creators/trust-score/route.ts` (read metrics),  
`app/api/admin/verify-submission/route.ts` + `bulk-verify-submissions` (recalculate on status change),  
`app/dashboard/contests/create/client.tsx` + `edit/client.tsx` (brand min score),  
`app/api/admin/contests/[id]/update/route.ts` (admin contest fields)

---

## Implementation plan (phases)

### Phase 1 — Data & score

- [ ] Run migrations 1–4 (see [Database migrations](#database-migrations))  
- [ ] `lib/trust-score.ts` — compute from submissions (+ Twitter tweets if included)  
- [ ] Migration 3 backfill (default **100**, then recalc from history)  
- [ ] Recompute on verify / reject / bulk verify  

### Phase 2 — Creator profile card

- [ ] `GET /api/creators/trust-score`  
- [ ] `components/TrustScoreCard.tsx`  
- [ ] Wire into `app/dashboard/profile/client.tsx`  
- [ ] Show: **Trust score**, **rejected %**, **total / verified / rejected / pending reels**  

### Phase 3 — Campaign submit gate

- [ ] Contest fields: `min_trust_score`, `trust_score_enforced` (brand create/edit + admin API)  
- [ ] Opportunities detail: disabled **Submit content** + warning when score below min  
- [ ] Submit page: same disabled button + message  
- [ ] Server block on submission insert  

### Phase 4 — Admin

- [ ] Admin user view: trust breakdown (read-only)  

---

## Quick checklist

- [ ] **Default 100** for all creators; score **decreases** only from rejections  
- [ ] Recalculate: `100 − (rejected ÷ total × 100)`    
- [ ] Brand sets min per campaign  
- [ ] **Not set** on campaign → no trust check, submit OK  
- [ ] Low score → campaign **still visible**; **Submit content** disabled + warning  
- [ ] Already joined + score drops → same: see campaign, submit disabled  
- [ ] Score **below** brand minimum → **disabled** submit button + message on submit page  
- [ ] Score **at or above** brand minimum → submit button enabled  
- [ ] Recalculate on verify/reject  
- [ ] **Profile:** Trust Score card with score, **%**, total / verified / rejected / pending reels  
- [ ] **Migrations:** `creator_profiles`, `contests`, backfill, view update  
