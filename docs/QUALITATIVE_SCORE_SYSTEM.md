# Creator Qualitative Score

**Status:** Planned (not built yet) · **Updated:** June 28, 2026

---

## What is it?

Every **verified** submission can receive a **Qualitative Score of 1, 2, or 3** — a human judgment of content quality assigned by the **brand** or **admin** at verification time.

Each creator also has an **aggregate Qualitative Score** (1–3) derived from their scored, verified submissions.

**When creating a contest**, the **brand chooses a minimum qualitative score** (1, 2, or 3) — or leaves it empty. That setting controls **who can submit** to that campaign:

| Brand sets at create | Creator sees campaign? | Submit entry button |
| -------------------- | ---------------------- | ------------------- |
| **Empty** (no minimum) | ✅ Yes — in Opportunities | ✅ **Enabled** for everyone |
| **Minimum 2** | ✅ Yes — in Opportunities | ✅ Enabled if creator score **≥ 2** |
| **Minimum 2** | ✅ Yes — in Opportunities | ❌ **Disabled** if creator score **< 2** or not established yet |
| **Minimum 3** | ✅ Yes — in Opportunities | ❌ **Disabled** unless creator score is **3** |

**Campaigns are never hidden** from creators because of qualitative score. They can always **find and open** the campaign. If their score is too low, only the **Submit content / Submit entry** button is **disabled** (greyed out) with a warning — they cannot start a new submission until their score meets the brand’s minimum.

**If the brand does not set a minimum** → **no qualitative condition** → creators can **submit normally** (same as today).

Qualitative score measures **how good verified content was**, not how often it was rejected. It complements the [Trust Score](./TRUST_SCORE_SYSTEM.md) system (which tracks rejection rate).

---

## Flow (brand create → creator submit)

```
Brand creates contest
  └── Sets "Minimum qualitative score" (optional: 1, 2, or 3)
        │
        ▼
Campaign goes live → appears in creator Opportunities (always visible)
        │
        ▼
Creator opens campaign
  ├── Brand minimum empty        → Submit entry button ENABLED
  ├── Creator score ≥ minimum    → Submit entry button ENABLED
  └── Creator score < minimum    → Submit entry button DISABLED + warning
        │
        ▼
(Later) Brand verifies submissions → assigns 1 / 2 / 3 per submission
        └── Creator aggregate score updates → submit button may unlock
```

---

## Score scale (1, 2, 3)

| Score | Label        | Meaning (for brand/admin at verify time)                          |
| ----- | ------------ | ----------------------------------------------------------------- |
| **3** | Excellent    | Outstanding quality — strong creative, on-brief, production value |
| **2** | Good         | Meets expectations — acceptable quality, usable for the campaign  |
| **1** | Below par    | Weak quality — barely acceptable or significant issues            |

Scores are **only assigned when a submission is verified** (`verified` or `paid`). Rejected and pending submissions do **not** receive a qualitative score.

---

## Default: no score until verified

**Creators start with no aggregate qualitative score** until at least one submission is verified **and** scored.

| Creator state                                      | Aggregate score | Can submit to campaign with min **2**? |
| -------------------------------------------------- | --------------- | -------------------------------------- |
| No verified scored submissions yet                   | `null`          | ❌ Blocked (score not established)     |
| 1 verified submission scored **3**                  | **3**           | ✅                                     |
| 2 verified submissions scored **3** and **1**       | **2** (avg)     | ✅                                     |
| 3 verified submissions all scored **1**             | **1**           | ❌ if min is 2 or 3                    |

---

## How the creator score is calculated

The creator’s **Qualitative Score is out of 3** (not out of 100). It is **not** like Trust Score (0–100).

Each verified submission gets its own rating (**1**, **2**, or **3**). The creator’s profile score is the **average of all those ratings**, rounded to the nearest whole number (**1**, **2**, or **3**).

```
Step 1: Add up every qualitative_score on verified/paid submissions
Step 2: Divide by how many scored submissions there are
Step 3: Round to nearest integer (1, 2, or 3)

Qualitative Score = round( sum of all submission scores ÷ number of scored submissions )
Final result is always 1, 2, or 3
```

**What counts:**

| Submission status | Counts in average? |
| ----------------- | ------------------ |
| **Verified** with score 1/2/3 | ✅ Yes |
| **Paid** with score 1/2/3 | ✅ Yes |
| **Pending** | ❌ No — not scored yet |
| **Rejected** | ❌ No — no qualitative score |

**Rules:**

- Only submissions with `status IN ('verified', 'paid')` **and** `qualitative_score IS NOT NULL` count.
- Pending and rejected submissions are **excluded** from the average.
- If there are **zero** scored verified submissions → aggregate score is **`null`**.
- Rounding: standard `round()` (e.g. 2.5 → **3**, 1.4 → **1**, 2.4 → **2**).
- **More verified submissions = more stable score.** One bad rating matters less when you have 100 scored submissions than when you have 2.

### Simple examples (few submissions)

**Example 1 — New creator**

- 0 verified scored submissions → aggregate **`null`**
- Campaign with min **2** → submit **disabled** until they earn a score

**Example 2 — Three submissions**

| Submission | Score |
| ---------- | ----- |
| #1         | 3     |
| #2         | 3     |
| #3         | 2     |

- Sum = 3 + 3 + 2 = **8**
- Count = **3**
- Average = 8 ÷ 3 = **2.67**
- Rounded → creator score **3** / 3

**Example 3 — Mixed history**

| Submission | Score |
| ---------- | ----- |
| #1         | 3     |
| #2         | 1     |
| #3         | 2     |

- Sum = 6, Count = 3, Average = **2.0** → creator score **2** / 3

**Example 4 — Score improves over time**

- Day 1: one verified score **1** → 1 ÷ 1 = **1** → cannot join campaigns requiring **2**
- Day 2: two more verified scores **3** and **3** → (1+3+3) ÷ 3 = **2.33** → rounds to **2** → can submit to min-**2** campaigns ✅

**Example 5 — Rejection does not change average**

- Submission rejected → no qualitative score stored → not included in count → aggregate unchanged

### Examples with many verified submissions (~100)

When a creator has **nearly 100 verified scored submissions**, the same formula applies — just with a bigger count. The score is still **out of 3**, not out of 100.

**Example A — Mostly excellent (95 × 3, 4 × 2, 1 × 1)**

```
Sum   = (95 × 3) + (4 × 2) + (1 × 1) = 285 + 8 + 1 = 294
Count = 100
Average = 294 ÷ 100 = 2.94
Rounded → creator score 3 / 3
```

Can submit to campaigns with minimum **1**, **2**, or **3** ✅

**Example B — Solid but not top tier (40 × 3, 50 × 2, 10 × 1)**

```
Sum   = (40 × 3) + (50 × 2) + (10 × 1) = 120 + 100 + 10 = 230
Count = 100
Average = 230 ÷ 100 = 2.30
Rounded → creator score 2 / 3
```

Can submit if brand minimum is **1** or **2** ✅ — **Submit entry disabled** if brand minimum is **3** ❌

**Example C — Borderline (exactly half 2s, half 3s: 50 × 3, 50 × 2)**

```
Sum   = 150 + 100 = 250
Count = 100
Average = 250 ÷ 100 = 2.50
Rounded → creator score 3 / 3   (2.5 rounds up to 3)
```

**Example D — Many weak submissions (20 × 3, 30 × 2, 50 × 1)**

```
Sum   = 60 + 60 + 50 = 170
Count = 100
Average = 170 ÷ 100 = 1.70
Rounded → creator score 2 / 3
```

Even with 50 submissions rated **1**, the average can still be **2** because of the other 50 higher ratings.

**Example E — All rated good (100 × 2)**

```
Sum   = 200
Count = 100
Average = 2.00
Rounded → creator score 2 / 3
```

**Example F — One new bad score barely moves a long history**

- Creator has **99** submissions all scored **3** → average **3.0** → score **3**
- Submission **100** verified with score **1**
- New average = (99×3 + 1) ÷ 100 = **298 ÷ 100 = 2.98** → still rounds to **3**

A single **1** among **99** threes barely changes the score. That is intentional — long track records are harder to move.

### Quick reference table (~100 submissions)

| Mix (3s / 2s / 1s) | Calculation | Average | Final score |
| ------------------ | ----------- | ------- | ----------- |
| 100 / 0 / 0        | 300 ÷ 100   | 3.00    | **3**       |
| 80 / 15 / 5        | 275 ÷ 100   | 2.75    | **3**       |
| 50 / 50 / 0        | 250 ÷ 100   | 2.50    | **3**       |
| 40 / 50 / 10       | 230 ÷ 100   | 2.30    | **2**       |
| 0 / 100 / 0        | 200 ÷ 100   | 2.00    | **2**       |
| 20 / 30 / 50       | 170 ÷ 100   | 1.70    | **2**       |
| 0 / 0 / 100        | 100 ÷ 100   | 1.00    | **1**       |

### Display on profile

| What | Display |
| ---- | ------- |
| Creator aggregate | **2 / 3** (or **3 / 3**, **1 / 3**) |
| Each submission row | Individual **1**, **2**, or **3** for that submission |
| Pending submission | **—** (not scored yet) |

**Not** shown as “75 out of 100” — that is Trust Score. Qualitative is always **1–3**.

---

## Per-submission score (at verification)

When a **brand** or **admin** verifies a submission:

1. Set status to `verified` (or `paid` later).
2. **Required:** choose qualitative score **1**, **2**, or **3**.
3. Score is saved on the submission row and the creator’s aggregate is recomputed.

**Verify UI (brand contest detail + admin moderation):**

- Add a **Qualitative score** control (radio or select: 1 / 2 / 3) next to the verify action.
- Cannot complete verify without selecting a score (when qualitative scoring is enabled for the platform).
- Show the score on the submission row after verification.

**Bulk verify:** same score picker per submission, or a default with per-row override.

**Changing score after verify:** admin/brand may edit qualitative score on an already-verified submission; aggregate recomputes immediately.

---

## Who sets the rules?

| Who       | What they can do                                                                 |
| --------- | -------------------------------------------------------------------------------- |
| **Brand** | Score submissions at verify; **optionally** set minimum qualitative score per campaign |
| **Admin** | Same as brand; edit scores; set/clear campaign minimum on any contest            |
| **Creator** | View aggregate score on profile; view **per-submission** qualitative score for every submission |

---

## When is qualitative score required to submit?

The minimum is stored on the contest when the **brand creates** (or edits) the campaign as `min_qualitative_score`.

| Brand minimum at create                                              | Creator aggregate score     | Submit entry button                   |
| -------------------------------------------------------------------- | --------------------------- | ------------------------------------- |
| **Not set** (empty)                                                  | any (including `null`)      | ✅ **Enabled** — no qualitative check |
| **Set** (e.g. **2**) and creator score **≥** minimum                 | e.g. **2** or **3**         | ✅ **Enabled**                        |
| **Set** and creator score **below** minimum                          | e.g. **1** when min is **2**| ❌ **Disabled** + warning             |
| **Set** and creator has **no** score yet (`null`)                    | `null`                      | ❌ **Disabled** + warning             |

**Important:** There is **no platform-wide fallback**. If the brand leaves the minimum blank at create time, qualitative score is **not** used for that campaign.

---

## What creators see & can do

### Finding campaigns (Opportunities list)

**By default, all eligible campaigns always show** in Opportunities — qualitative gates **do not** auto-hide campaigns.

Creators **always get / see** the campaign in the list and can open it to read the brief, rules, and payout details.

| Creator score vs brand minimum | See campaign in Opportunities | Open campaign page | Submit entry button |
| ------------------------------ | ----------------------------- | ------------------ | ------------------- |
| No minimum set                 | ✅                            | ✅                 | ✅ Enabled          |
| Score **≥** brand minimum      | ✅                            | ✅                 | ✅ Enabled          |
| Score **<** brand minimum      | ✅                            | ✅                 | ❌ **Disabled**     |
| Score not established (`null`) | ✅                            | ✅                 | ❌ **Disabled**     |

If the brand **set a minimum at create** and the creator’s score is **too low** (or not established):

- Campaign **still visible** in Opportunities ✅
- Creator **can open** and read everything ✅
- **Submit content / Submit entry** button is **disabled** (greyed out, not clickable) ❌
- A **warning message** is shown on the campaign page and submit page

If the brand **did not set** a minimum → submit entry works as today.

### Optional filter — “Meets qualitative requirement”

Creators who only want campaigns they can submit to can turn on an **optional** filter in the Opportunities toolbar (`app/dashboard/opportunities/client.tsx`, alongside Platform / Type / Sort).

| Filter value | What appears in the list |
| ------------ | ------------------------ |
| **All campaigns** (default) | Every published campaign — including ones where submit is blocked by qualitative score |
| **I meet qualitative requirement** | Only campaigns where the creator **can submit** for this gate (see rules below) |

**Include a campaign when filter is on:**

```
contest.min_qualitative_score is null
OR !contest.qualitative_score_enforced
OR (creator.qualitative_score is not null AND creator.qualitative_score >= contest.min_qualitative_score)
```

**Exclude when filter is on:**

- Brand set a minimum, gate is enforced, and creator score is **below** minimum
- Creator has **no** aggregate score yet (`null`) and campaign has a minimum set

**UI copy:**

| Control | Label |
| ------- | ----- |
| Filter select / toggle | **Qualitative eligibility** |
| Default option | **All campaigns** |
| Narrow option | **I meet qualitative requirement** |
| Help tooltip | Show only campaigns where your qualitative score meets the brand’s minimum. Campaigns with no quality requirement always appear. |

**Badge on contest cards (optional, when filter is off):** small label such as **Requires quality 2+** when `min_qualitative_score` is set.

**Combine with other gates:** Qualitative filter is **independent**. For “show only contests I can submit to” across trust, qualitative, and earnings, also offer a combined **Can submit** filter (documented in [Minimum Earnings Gate](./MINIMUM_EARNINGS_GATE.md) and [Trust Score](./TRUST_SCORE_SYSTEM.md)) that passes only when **all** active gates pass.

**Persist** filter choice in `lib/campaign-list-filters-storage.ts` (`OPPORTUNITIES_LIST_FILTERS_KEY`) with the other Opportunities filters.

### Submit page — score too low (UI)

When the brand **set a minimum at create** and the creator’s aggregate score is **below** that minimum (or not established):

1. **Submit entry button is disabled** (greyed out, not clickable — same on campaign detail and full submit page).
2. A **banner** is shown above or below the button.

**Message copy:**

> **Qualitative score too low to submit**  
> Your qualitative score is **1** (or **Not established yet**). This campaign requires at least **2**.  
> You can still view this campaign and your existing submissions. Submit new content after your qualitative score reaches **2** or higher.

Replace values with the creator’s real aggregate score and the campaign minimum.

**Also block on the server** if someone bypasses the UI — return the same message in the API error.

**Where the submit entry button is disabled**

- Opportunities → campaign detail → **Submit content** / **Submit entry**
- Full submit page: `app/dashboard/opportunities/[id]/submit/`
- Same check if they already joined the campaign and their score dropped later

**UI rule for developers:**

```
if (contest.min_qualitative_score is null) {
  submitEntryButton.enabled = true
} else if (creator.qualitative_score >= contest.min_qualitative_score) {
  submitEntryButton.enabled = true
} else {
  submitEntryButton.enabled = false   // greyed out
  showWarningBanner = true
}
```

---

## Creator profile — qualitative score display

Add qualitative score information on the creator **Profile** page (`/dashboard/profile`).

### 1. Aggregate card (summary)

A **Qualitative Score** card (alongside the existing Trust Score card):

**Header**

- Title: **Qualitative Score**
- Large display: **2** / 3 (or **—** if `null`)
- Color band: green for **3**, amber for **2**, red for **1**, muted for not established

**Breakdown rows**

| Label                    | Example | Notes                                      |
| ------------------------ | ------- | ------------------------------------------ |
| **Scored submissions**   | 8       | Verified/paid with a qualitative score       |
| **Average (raw)**        | 2.4     | Before rounding — optional, for transparency |
| **Score 3 count**        | 3       | Excellent                                  |
| **Score 2 count**        | 4       | Good                                       |
| **Score 1 count**        | 1       | Below par                                  |

**Footer hint**

> Brands rate your verified content from 1–3. Some campaigns require a minimum score to submit.

### 2. Per-submission list (required)

On the profile page, show **qualitative score for every submission** the creator has made:

| Column / field   | Display                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| Campaign         | Contest title                                                           |
| Submitted        | Date                                                                    |
| Status           | pending / verified / rejected / paid                                    |
| **Qualitative**  | **1**, **2**, or **3** if verified/paid and scored; **—** if pending; **N/A** if rejected or verified before scoring was introduced |

This can be a table under the card or a dedicated **My submissions** section on profile. Creators must be able to see **all** their submissions and each one’s qualitative score (or why it is missing).

---

## Brand setup — minimum score at contest create

When the **brand creates a contest** (`app/dashboard/contests/create/client.tsx`), add a field in the create flow (same step as trust score / campaign settings):

**Field: Minimum qualitative score** (1, 2, or 3) — **optional**

| Brand selects at create | Who can use Submit entry on this campaign |
| ----------------------- | ----------------------------------------- |
| **Leave empty**         | All creators — submit entry **enabled**   |
| **1**                   | Creators with aggregate score **1, 2, or 3** |
| **2**                   | Creators with aggregate score **2 or 3** only |
| **3**                   | Creators with aggregate score **3** only |

The value is saved on the contest as `min_qualitative_score` when the brand publishes or saves the draft.

**Help text for brands (show on create form):**

> Optional. Choose the minimum creator quality level required to submit to this campaign. Leave blank to allow everyone. If you set a minimum, creators below that score will still see your campaign in Opportunities, but the **Submit entry** button will be disabled until their qualitative score is high enough. You rate each verified submission 1–3 after review.

**Edit flow:** brand can change or clear the minimum on `app/dashboard/contests/[id]/edit/client.tsx` before the campaign ends.

**Applies to:** video campaigns (same scope as trust score gate — `contest_format = video`). Text/image (Twitter-style) campaigns may skip qualitative gate in v1 unless product expands scope.

---

## Admin setup

1. **Verify / moderation UI** — assign 1/2/3 when verifying; edit score on verified rows
2. **Creator admin view** — read-only aggregate + submission breakdown
3. **Any campaign** — set or clear `min_qualitative_score` (same fields as brand)

---

## When does the score update?

Whenever:

- A submission is **verified** with a qualitative score → submission row updated, creator aggregate recomputed
- Qualitative score is **edited** on a verified submission → aggregate recomputed
- Submission moves to **paid** (score unchanged unless edited)
- **Rejected** → no qualitative score; aggregate unchanged

Wire recompute in:

- `app/api/admin/verify-submission/route.ts`
- `app/api/admin/bulk-verify-submissions/route.ts`
- Brand verify flows in contest detail client

---

## Database migrations

Run in order (`db/migrations/`).

### Migration 1 — `submissions`

```sql
-- Per-submission qualitative score (1-3), set at verify time.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS qualitative_score smallint NULL,
  ADD COLUMN IF NOT EXISTS qualitative_scored_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS qualitative_scored_by uuid NULL REFERENCES public.users(id);

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_qualitative_score_range
    CHECK (qualitative_score IS NULL OR (qualitative_score >= 1 AND qualitative_score <= 3));

COMMENT ON COLUMN public.submissions.qualitative_score IS '1=below par, 2=good, 3=excellent. Set when status becomes verified/paid.';
COMMENT ON COLUMN public.submissions.qualitative_scored_by IS 'Brand or admin user who assigned the score.';

CREATE INDEX IF NOT EXISTS idx_submissions_creator_qualitative
  ON public.submissions (creator_id, qualitative_score)
  WHERE qualitative_score IS NOT NULL;
```

### Migration 2 — `creator_profiles` (cached aggregate)

```sql
-- Cached aggregate qualitative metrics on creator profile.

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS qualitative_score smallint NULL,
  ADD COLUMN IF NOT EXISTS qualitative_scored_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualitative_score_1_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualitative_score_2_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualitative_score_3_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualitative_metrics_updated_at timestamptz NULL;

ALTER TABLE public.creator_profiles
  ADD CONSTRAINT creator_profiles_qualitative_score_range
    CHECK (qualitative_score IS NULL OR (qualitative_score >= 1 AND qualitative_score <= 3));

COMMENT ON COLUMN public.creator_profiles.qualitative_score IS 'Rounded average of qualitative_score on verified/paid submissions. NULL if none scored yet.';

CREATE INDEX IF NOT EXISTS idx_creator_profiles_qualitative_score
  ON public.creator_profiles (qualitative_score)
  WHERE qualitative_score IS NOT NULL;
```

### Migration 3 — `contests`

```sql
-- Per-campaign minimum qualitative score (brand/admin).

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS min_qualitative_score smallint NULL,
  ADD COLUMN IF NOT EXISTS qualitative_score_enforced boolean NOT NULL DEFAULT true;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_min_qualitative_score_range
    CHECK (min_qualitative_score IS NULL OR (min_qualitative_score >= 1 AND min_qualitative_score <= 3));

COMMENT ON COLUMN public.contests.min_qualitative_score IS 'Optional. NULL = no qualitative requirement. 1-3 = creator qualitative_score must be >= this value to submit.';
COMMENT ON COLUMN public.contests.qualitative_score_enforced IS 'When false, campaign ignores qualitative gate even if min_qualitative_score is set.';

CREATE INDEX IF NOT EXISTS idx_contests_min_qualitative_score
  ON public.contests (min_qualitative_score)
  WHERE min_qualitative_score IS NOT NULL;
```

### Migration 4 — backfill

```sql
-- Existing verified/paid submissions have NULL qualitative_score until manually scored or bulk backfilled.
-- Creator aggregate stays NULL until at least one submission is scored.

UPDATE public.creator_profiles
SET
  qualitative_score = NULL,
  qualitative_scored_count = 0,
  qualitative_score_1_count = 0,
  qualitative_score_2_count = 0,
  qualitative_score_3_count = 0,
  qualitative_metrics_updated_at = now();
```

Optional: admin script to default historical verified submissions to **2** if product wants existing creators to pass gates immediately.

### Migration 5 — submission insert gate (trigger)

```sql
CREATE OR REPLACE FUNCTION public.enforce_submission_qualitative_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_qual smallint;
  v_enforced boolean;
  v_format text;
  v_creator_qual smallint;
BEGIN
  SELECT c.min_qualitative_score, c.qualitative_score_enforced, c.contest_format
  INTO v_min_qual, v_enforced, v_format
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_enforced, true) OR v_min_qual IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cp.qualitative_score INTO v_creator_qual
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  IF v_creator_qual IS NULL OR v_creator_qual < v_min_qual THEN
    RAISE EXCEPTION
      'qualitative_score_too_low: Creator qualitative score (%) is below campaign minimum (%)',
      COALESCE(v_creator_qual::text, 'not established'),
      v_min_qual
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enforce_qualitative_score ON public.submissions;

CREATE TRIGGER submissions_enforce_qualitative_score
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_qualitative_score();
```

### After migrations

1. Update `types/supabase.ts` for new columns.
2. Add `lib/qualitative-score.ts` — compute, recompute, gate helpers.
3. Wire verify APIs to require and persist `qualitative_score`.
4. Wire Opportunities list optional filter **Qualitative eligibility** (default: all campaigns).

---

## API shapes

### `GET /api/creators/qualitative-score`

```json
{
  "qualitative_score": 2,
  "scored_count": 5,
  "score_1_count": 1,
  "score_2_count": 2,
  "score_3_count": 2,
  "average_raw": 2.2
}
```

`qualitative_score: null` when no scored verified submissions.

### `GET /api/creators/submissions` (profile list)

```json
{
  "submissions": [
    {
      "id": "uuid",
      "contest_title": "Summer Launch",
      "status": "verified",
      "qualitative_score": 3,
      "created_at": "2026-06-01T12:00:00Z"
    },
    {
      "id": "uuid",
      "contest_title": "Brand X CPM",
      "status": "pending",
      "qualitative_score": null,
      "created_at": "2026-06-10T09:00:00Z"
    }
  ]
}
```

### Verify submission `POST` body (add field)

```json
{
  "submissionId": "uuid",
  "action": "verified",
  "qualitative_score": 2
}
```

`qualitative_score` **required** when `action` is `verified` (and recommended when marking `paid` if not already set).

---

## Build notes (for developers)

**Store on submission:** `qualitative_score`, `qualitative_scored_at`, `qualitative_scored_by`

**Store on creator (`creator_profiles`):** `qualitative_score`, count columns, `qualitative_metrics_updated_at`

**Store on contest:** `min_qualitative_score`, `qualitative_score_enforced`

**Must check on server** when creating a submission (UI disables button + warning; API and DB trigger must block too).

**Enforce submit (UI + API):**

```
if (contest.min_qualitative_score is null OR !qualitative_score_enforced) {
  // No qualitative condition
} else if (creator.qualitative_score is null OR creator.qualitative_score < contest.min_qualitative_score) {
  disable submit + show warning
  block API / trigger on insert
} else {
  enable submit
}
```

**Opportunities list:** Show **all** campaigns by default. Optional **Qualitative eligibility** filter lets creators narrow to campaigns they qualify for (see [Finding campaigns](#finding-campaigns-opportunities-list)).

**Opportunities list filter (client-side):**

```typescript
// lib/qualitative-score.ts

export function isCreatorQualitativeContestEligible(input: {
  minScore: number | null;
  enforced?: boolean | null;
  creatorScore: number | null;
}): boolean {
  if (!input.enforced || input.minScore === null) return true;
  if (input.creatorScore === null) return false;
  return input.creatorScore >= input.minScore;
}
```

When `qualitativeEligibilityFilter === "meets_requirement"`, filter `contestsToDisplay` with this helper. Use cached `creator_profiles.qualitative_score` from the same source as the submit gate.

**Key files to hook:**

| Area              | Path                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| Calculation       | `lib/qualitative-score.ts` (new)                                     |
| Profile card      | `components/QualitativeScoreCard.tsx` (new)                          |
| Profile submissions | `app/dashboard/profile/client.tsx`                                 |
| Verify UI         | `app/dashboard/contests/[id]/contest-detail-client.tsx`, admin tools |
| Verify API        | `app/api/admin/verify-submission/route.ts`, bulk-verify              |
| Contest create    | `app/dashboard/contests/create/client.tsx`, edit client              |
| Submit gate       | `app/dashboard/opportunities/[id]/`, submit page, submission API     |
| Opportunities qualitative filter | `app/dashboard/opportunities/client.tsx`, `lib/campaign-list-filters-storage.ts` |
| Creator API       | `app/api/creators/qualitative-score/route.ts` (new)                  |

Mirror patterns from [TRUST_SCORE_SYSTEM.md](./TRUST_SCORE_SYSTEM.md) and `lib/trust-score.ts`.

---

## Implementation plan (phases)

### Phase 1 — Data & scoring

- [ ] Run migrations 1–5
- [ ] `lib/qualitative-score.ts` — compute aggregate, recompute on verify
- [ ] Require `qualitative_score` on verify in APIs

### Phase 2 — Verification UI

- [ ] Brand contest detail: score picker on verify
- [ ] Admin moderation: same picker
- [ ] Bulk verify: per-row or batch default score

### Phase 3 — Creator profile

- [ ] `GET /api/creators/qualitative-score`
- [ ] `QualitativeScoreCard` on profile
- [ ] **Submission list with qualitative score for every submission**

### Phase 4 — Campaign gate

- [ ] Contest fields: `min_qualitative_score` (brand create/edit + admin API)
- [ ] Opportunities detail + submit page: disabled button + warning
- [ ] Server block on submission insert (app + trigger)
- [ ] Opportunities optional filter: **Qualitative eligibility** + combined **Can submit** (with earnings / trust)

### Phase 5 — Admin

- [ ] Admin creator view: aggregate + per-submission scores (read-only)
- [ ] Optional: edit qualitative score on verified submission

---

## Quick checklist

- [ ] Brand sets **optional minimum (1–3) at contest create** — saved as `min_qualitative_score`
- [ ] Scores **1, 2, 3** assigned at **verify** by brand/admin on each submission
- [ ] Creator aggregate = **rounded average** of scored verified/paid submissions
- [ ] **No score yet** (`null`) → **Submit entry disabled** when campaign has a minimum
- [ ] **Not set** at create → no qualitative check; submit entry enabled for all
- [ ] Creator score **<** brand minimum → campaign **still in Opportunities** by default; **Submit entry disabled** + warning
- [ ] Optional filter **I meet qualitative requirement** → hides campaigns where score is too low or not established
- [ ] Creator score **≥** brand minimum → **Submit entry enabled**
- [ ] **Profile:** aggregate card + **qualitative score on every submission**
- [ ] Recalculate on verify / score edit
- [ ] Server + DB enforcement on submit (UI disable is not enough)

---

## Related docs

- [TRUST_SCORE_SYSTEM.md](./TRUST_SCORE_SYSTEM.md) — rejection-based trust gate (0–100)
- [REFERRAL_PROGRAM.md](./REFERRAL_PROGRAM.md) — referrals (separate from quality scoring)
