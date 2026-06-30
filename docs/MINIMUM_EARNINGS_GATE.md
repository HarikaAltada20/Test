# Minimum Platform Earnings Required

**Status:** Planned (not built yet) · **Updated:** June 28, 2026

---

## What is it?

When **creating a campaign**, a brand can optionally set a **minimum platform earnings** amount (e.g. **$50**). Only creators whose **lifetime cash earnings on Game of Creators** meet or exceed that amount can **submit new entries** to that campaign.

**If the brand does not set a minimum** → **no earnings condition** → creators can **submit normally** (same as today).

This gate is about **how much a creator has already earned on the platform**, not how much they can earn from a single campaign. It complements:

- [Trust Score](./TRUST_SCORE_SYSTEM.md) — rejection-rate reliability
- [Qualitative Score](./QUALITATIVE_SCORE_SYSTEM.md) — verified content quality
- [Earnings cap per contest](./EARNINGS_CAP_CLARIFICATION.md) — **max** a creator can earn from **one** campaign (warns but does not block submit)

---

## Flow (brand create → creator submit)

```
Brand creates contest
  └── Sets "Minimum platform earnings required" (optional, e.g. $50)
        │
        ▼
Campaign goes live → appears in creator Opportunities (always visible)
        │
        ▼
Creator opens campaign
  ├── Brand minimum empty           → Submit entry button ENABLED
  ├── Creator lifetime earnings ≥ minimum → Submit entry button ENABLED
  └── Creator lifetime earnings < minimum → Submit entry button DISABLED + warning
        │
        ▼
Creator earns more on other campaigns → lifetime total increases → submit button may unlock
```

---

## When creating a contest — brand setting

| Brand sets at create | Creator sees campaign? | Submit entry button |
| -------------------- | ---------------------- | ------------------- |
| **Empty** (no minimum) | ✅ Yes — in Opportunities | ✅ **Enabled** for everyone |
| **Minimum $50** | ✅ Yes — in Opportunities | ✅ Enabled if creator has earned **≥ $50** lifetime |
| **Minimum $50** | ✅ Yes — in Opportunities | ❌ **Disabled** if creator has earned **< $50** lifetime |

**Campaigns are never hidden** from creators because of earnings. They can always **find and open** the campaign. If their lifetime earnings are too low, only the **Submit content / Submit entry** button is **disabled** (greyed out) with a warning — they cannot start a new submission until their platform earnings reach the brand’s minimum.

---

## What counts as “platform earnings”?

Use the same **lifetime cash earned** total already shown on the creator **Earnings** page (`/dashboard/earnings`):

```
Lifetime platform cash earnings (cents) =
  creator_profiles.total_money_won      (contest / campaign cash prizes)
+ users.affiliate_earnings              (referral commissions)
+ users.other_earnings                  (bonuses, coupons, survey rewards, etc.)
```

| Source | Column | Counts toward gate? |
| ------ | ------ | ------------------- |
| Paid contest winnings | `creator_profiles.total_money_won` | ✅ Yes |
| Affiliate / referral commissions | `users.affiliate_earnings` | ✅ Yes |
| Bonuses, coupons, admin credits (non-contest) | `users.other_earnings` | ✅ Yes |
| **Coins** (platform coin balance / `total_lifetime_coins_earned`) | — | ❌ No — cash only |
| **Estimated** / unpaid earnings | — | ❌ No — only **credited** amounts |
| **Withdrawn** balance | — | ✅ Still counts (lifetime earned, not withdrawable balance) |

All amounts are stored in **cents** in the database. The create/edit form shows **dollars** to brands; convert on save (`$50` → `5000` cents).

**Default for new creators:** `$0` lifetime cash → blocked on any campaign with a minimum set.

---

## Who sets the rules?

| Who | What they can do |
| --- | ---------------- |
| **Brand** | **Optionally** set minimum platform earnings per campaign; leave empty = no limit |
| **Admin** | View creator earnings breakdown; edit campaign minimum if needed |
| **Creator** | View lifetime earnings on Earnings page; see why submit is blocked on campaign detail |

---

## When is the earnings requirement enforced?

| Campaign setting | Submit content |
| ---------------- | -------------- |
| Brand **did not set** a minimum (`min_platform_earnings_cents` empty) | ✅ **No earnings check** — anyone can submit (other gates still apply) |
| Brand **set** a minimum (e.g. $50) and creator lifetime earnings **≥** minimum | ✅ Submit allowed |
| Brand **set** a minimum and creator lifetime earnings **below** minimum | ❌ Submit **disabled** + warning message |

**Important:** There is **no platform-wide default** (e.g. auto $25 for all campaigns). If the brand leaves it blank, lifetime earnings are **not** used for that campaign.

---

## What creators see & can do

### Finding campaigns (Opportunities list)

**By default, campaigns always show** in the Opportunities list (published, dates, platform, etc.) — earnings gates **do not** auto-hide campaigns.

If the brand **set a minimum** and the creator’s lifetime earnings are **below** it:

- They **can open** the campaign and read the brief
- **Submit content** is **disabled**
- A **warning message** is shown (campaign detail page and full submit page)

If the brand **did not set** a minimum → submit works as today (no earnings warning).

### Optional filter — “Meets earnings requirement”

Creators who only want campaigns they can submit to can turn on an **optional** filter in the Opportunities toolbar (`app/dashboard/opportunities/client.tsx`, alongside Platform / Type / Sort).

| Filter value | What appears in the list |
| ------------ | ------------------------ |
| **All campaigns** (default) | Every published campaign — including ones where submit is blocked by earnings |
| **I meet earnings requirement** | Only campaigns where the creator **can submit** for this gate (see rules below) |

**Include a campaign when filter is on:**

```
contest.min_platform_earnings_cents is null
OR !contest.min_platform_earnings_enforced
OR creator.lifetime_platform_earnings_cents >= contest.min_platform_earnings_cents
```

**Exclude when filter is on:**

- Brand set a minimum, gate is enforced, and creator lifetime earnings are **below** the minimum
- Creator earnings are still loading → exclude until loaded (fail-closed, same as submit button)

**UI copy:**

| Control | Label |
| ------- | ----- |
| Filter select / toggle | **Earnings eligibility** |
| Default option | **All campaigns** |
| Narrow option | **I meet earnings requirement** |
| Help tooltip | Show only campaigns where your lifetime platform earnings meet the brand’s minimum. Campaigns with no earnings requirement always appear. |

**Badge on contest cards (optional, when filter is off):** small label such as **Requires $50 earned** when `min_platform_earnings_cents` is set — helps creators spot gated campaigns without enabling the filter.

**Combine with other gates:** Earnings filter is **independent**. For “show only contests I can submit to” across trust, qualitative, and earnings, also offer a combined **Can submit** filter (documented in [Qualitative Score](./QUALITATIVE_SCORE_SYSTEM.md) and [Trust Score](./TRUST_SCORE_SYSTEM.md)) that passes only when **all** active gates pass.

**Persist** filter choice in `lib/campaign-list-filters-storage.ts` (`OPPORTUNITIES_LIST_FILTERS_KEY`) with the other Opportunities filters.

### Can they submit?

| Campaign minimum set? | Creator lifetime earnings | Submit entry button |
| --------------------- | ------------------------- | ------------------- |
| **No** (not set) | any | ✅ **Enabled** (no earnings condition) |
| **Yes** (e.g. $50) | at or above minimum | ✅ **Enabled** |
| **Yes** | below minimum | ❌ **Disabled** + **warning message** |

**Simple rule:** Earnings gate only matters when the **brand chose a minimum**. Otherwise creators can always submit (for this gate).

---

## Submit page — earnings too low (UI)

When the campaign **has a minimum set** and the creator’s lifetime earnings are **below** that minimum:

1. **Submit entry button is disabled** (greyed out, not clickable — same on campaign detail and full submit page).
2. A **banner** is shown above or below the button.

**Message copy (use this text in the app):**

> **Platform earnings too low to submit**  
> Your lifetime earnings on Game of Creators are **$12.50**. This campaign requires at least **$50.00**.  
> You can still view this campaign and your existing submissions. Submit new content after your lifetime earnings reach **$50.00** or higher.

Replace values with the creator’s real lifetime total and the campaign minimum (formatted as currency).

**Also block on the server** if someone bypasses the UI — return the same message in the API error.

**Where the submit entry button is disabled**

- Opportunities → campaign detail → **Submit content** / **Submit entry**
- Full submit page: `app/dashboard/opportunities/[id]/submit/`
- Same check if they already joined the campaign and still have not met the minimum

**UI rule for developers:**

```
if (contest.min_platform_earnings_cents is null) {
  submitEntryButton.enabled = true
} else if (creator.lifetime_platform_earnings_cents >= contest.min_platform_earnings_cents) {
  submitEntryButton.enabled = true
} else {
  submitEntryButton.enabled = false   // greyed out
  showWarningBanner = true
}
```

**Button label when blocked:** `Earnings Too Low` (mirror trust score: `Trust Score Too Low`).

---

## Real-world stories

**Story A — Campaign with no minimum**  
- Brand left minimum **empty** → New creator ($0 earned) can **submit** ✅ (no earnings rule)

**Story B — Sarah ($120 lifetime)**  
- Campaign minimum **$50** → she submits ✅

**Story C — Mike ($15 lifetime)**  
- Campaign X needs **$50** → Mike **sees** it in opportunities ✅  
- Clicks **Submit content** → button **disabled**, warning shown ❌

**Story D — Mike earns more elsewhere**  
- Wins **$40** from another campaign → lifetime **$55**  
- Opens Campaign X again → submit **enabled** ✅

**Story E — Premium brand campaign**  
- Brand sets **$200** minimum to limit entry to experienced creators  
- New signups ($0) can browse the brief but cannot submit until they earn elsewhere on the platform

---

## Brand setup (per campaign)

When creating or editing a campaign (`app/dashboard/contests/create/client.tsx`, `app/dashboard/contests/[id]/edit/client.tsx`):

### Form fields

| Field | Type | Notes |
| ----- | ---- | ----- |
| **Enable minimum earnings requirement** | Checkbox | Off by default |
| **Minimum platform earnings** | Dollar input | Shown when checkbox enabled; e.g. `50` = $50.00 |

**Help text for brands (show on create form):**

> Optional. Require creators to have earned a minimum amount on Game of Creators before they can submit to this campaign. Leave disabled to allow everyone. Creators below the threshold will still see your campaign in Opportunities, but the **Submit entry** button will be disabled until their lifetime earnings are high enough. Counts contest winnings, affiliate earnings, and platform bonuses — not coins.

**Suggested default when enabled:** $25 or $50 (product decision — do not auto-enable).

**Validation:**

- Minimum must be **> 0** when enabled
- Reasonable upper bound (e.g. max $10,000) to prevent typos
- Stored as `min_platform_earnings_cents` (integer, cents)

**Applies to:** video campaigns (`contest_format = video`, legacy `null` counts as video). Text/image (Twitter-style) campaigns may skip earnings gate in v1 unless product expands scope — same pattern as [trust score](./TRUST_SCORE_SYSTEM.md).

---

## Admin setup

1. **Users / creator admin** — read-only lifetime earnings breakdown (contest + affiliate + other)
2. **Any campaign** — set or clear `min_platform_earnings_cents` (same fields as brand)
3. **Optional:** `min_platform_earnings_enforced` flag to bypass gate without clearing the stored minimum

---

## Creator profile & Earnings page

No new score to compute — reuse existing **Lifetime cash earnings** display on `/dashboard/earnings`:

```
Lifetime cash earnings = total_money_won + affiliate_earnings + other_earnings
```

Optional enhancement on campaign detail when blocked: link to **My Earnings** with copy like “Earn $37.50 more on other campaigns to unlock submit.”

---

## When does the creator total update?

Whenever credited cash increases:

- Contest payout processed → `total_money_won` increases
- Affiliate commission credited → `affiliate_earnings` increases
- Bonus / coupon / admin credit (`other_earnings`) → `other_earnings` increases

Re-check gate on campaign detail / submit page load (no separate “earnings score” cache required for v1 — read the three columns live or via a small API).

---

## Difference from other earnings features

| Feature | Scope | Blocks submit? |
| ------- | ----- | -------------- |
| **Minimum platform earnings** (this doc) | Creator’s **lifetime** cash on platform | ✅ Yes — button disabled |
| **Max earnings per creator** (`max_earnings_per_creator`) | **This contest only** — cap on payout | ❌ No — warning only, can still submit |
| **Min views (CPM)** | Per submission eligibility for payment | ❌ No — affects payout, not entry |

---

## Database migrations

Run in order (`db/migrations/`).

### Migration 1 — `contests`

```sql
-- Per-campaign minimum lifetime platform earnings (brand/admin).

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS min_platform_earnings_cents integer NULL,
  ADD COLUMN IF NOT EXISTS min_platform_earnings_enforced boolean NOT NULL DEFAULT true;

ALTER TABLE public.contests
  ADD CONSTRAINT contests_min_platform_earnings_cents_positive
    CHECK (min_platform_earnings_cents IS NULL OR min_platform_earnings_cents > 0);

COMMENT ON COLUMN public.contests.min_platform_earnings_cents IS
  'Optional. NULL = no lifetime earnings requirement. Creator lifetime cash (contest + affiliate + other) must be >= this value (cents) to submit.';
COMMENT ON COLUMN public.contests.min_platform_earnings_enforced IS
  'When false, campaign ignores earnings gate even if min_platform_earnings_cents is set.';

CREATE INDEX IF NOT EXISTS idx_contests_min_platform_earnings_cents
  ON public.contests (min_platform_earnings_cents)
  WHERE min_platform_earnings_cents IS NOT NULL;
```

### Migration 2 — submission insert gate (trigger)

```sql
CREATE OR REPLACE FUNCTION public.enforce_submission_platform_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_cents integer;
  v_enforced boolean;
  v_format text;
  v_contest_cash bigint;
  v_affiliate bigint;
  v_other bigint;
  v_lifetime bigint;
BEGIN
  SELECT c.min_platform_earnings_cents, c.min_platform_earnings_enforced, c.contest_format
  INTO v_min_cents, v_enforced, v_format
  FROM public.contests c
  WHERE c.id = NEW.contest_id;

  IF COALESCE(v_format, 'video') = 'text_image' THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_enforced, true) OR v_min_cents IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(cp.total_money_won, 0)
  INTO v_contest_cash
  FROM public.creator_profiles cp
  WHERE cp.id = NEW.creator_id;

  SELECT COALESCE(u.affiliate_earnings, 0), COALESCE(u.other_earnings, 0)
  INTO v_affiliate, v_other
  FROM public.users u
  WHERE u.id = NEW.creator_id;

  v_lifetime := COALESCE(v_contest_cash, 0) + COALESCE(v_affiliate, 0) + COALESCE(v_other, 0);

  IF v_lifetime < v_min_cents THEN
    RAISE EXCEPTION
      'platform_earnings_too_low: Creator lifetime earnings (%) cents below campaign minimum (%) cents',
      v_lifetime,
      v_min_cents
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submissions_enforce_platform_earnings ON public.submissions;

CREATE TRIGGER submissions_enforce_platform_earnings
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_platform_earnings();
```

### After migrations

1. Update `types/supabase.ts` for new columns.
2. Add `lib/platform-earnings-gate.ts` — compute lifetime total, parse contest minimum, gate helpers.
3. Wire create/edit contest forms to persist `min_platform_earnings_cents`.
4. Wire opportunities detail + submit client (mirror trust score pattern in `lib/trust-score.ts`).
5. Wire Opportunities list optional filter **Earnings eligibility** (default: all campaigns).

---

## API shapes

### `GET /api/creators/platform-earnings`

```json
{
  "lifetime_platform_earnings_cents": 12500,
  "contest_winnings_cents": 10000,
  "affiliate_earnings_cents": 1500,
  "other_earnings_cents": 1000
}
```

### Server assertion (submission create)

```typescript
// lib/platform-earnings-gate.ts

export function computeLifetimePlatformEarningsCents(input: {
  total_money_won?: number | null;
  affiliate_earnings?: number | null;
  other_earnings?: number | null;
}): number {
  return (
    (input.total_money_won ?? 0) +
    (input.affiliate_earnings ?? 0) +
    (input.other_earnings ?? 0)
  );
}

export function isCreatorPlatformEarningsSubmissionBlocked(input: {
  minCents: number | null;
  lifetimeCents: number | null;
  earningsLoaded: boolean;
  earningsLoading: boolean;
}): boolean {
  if (input.minCents === null) return false;
  if (input.earningsLoading || !input.earningsLoaded) return true;
  if (input.lifetimeCents === null) return true;
  return input.lifetimeCents < input.minCents;
}

export function getPlatformEarningsBlockedMessage(input: {
  minCents: number;
  lifetimeCents: number | null;
  earningsLoading: boolean;
  earningsLoaded: boolean;
}): string {
  const minFormatted = formatCurrencyFromCents(input.minCents);
  if (input.earningsLoading) {
    return `Loading earnings… This campaign requires at least ${minFormatted} lifetime earnings on Game of Creators.`;
  }
  if (!input.earningsLoaded || input.lifetimeCents === null) {
    return `Unable to verify your earnings. This campaign requires at least ${minFormatted}. Please refresh or try again later.`;
  }
  const earnedFormatted = formatCurrencyFromCents(input.lifetimeCents);
  return (
    `Platform earnings too low to submit. Your lifetime earnings are ${earnedFormatted}. ` +
    `This campaign requires at least ${minFormatted}. You can still view this campaign and your existing submissions. ` +
    `Submit new content after your lifetime earnings reach ${minFormatted} or higher.`
  );
}
```

---

## Build notes (for developers)

**Store on contest:** `min_platform_earnings_cents`, `min_platform_earnings_enforced`

**Read for creator:** `creator_profiles.total_money_won`, `users.affiliate_earnings`, `users.other_earnings`

**Must check on server** when creating a submission (UI disables button + warning; API and DB trigger must block too).

**Reference implementation (trust score — copy pattern):**

| Piece | Path |
| ----- | ---- |
| Gate helpers | `lib/trust-score.ts` |
| Campaign detail UI | `app/dashboard/opportunities/[id]/client.tsx` |
| Submit page UI | `app/dashboard/opportunities/[id]/submit/client.tsx` |
| Opportunities earnings filter | `app/dashboard/opportunities/client.tsx`, `lib/campaign-list-filters-storage.ts` |
| Server assertion | `lib/trust-score.ts` → `assertCreatorMeetsContestTrustRequirement` |
| DB trigger | `db/migrations/20260530_trust_score_submission_gate.sql` |
| Brand create form | `app/dashboard/contests/create/client.tsx` (Trust Score section) |

**Enforce submit (UI + API):**

```
if (contest.min_platform_earnings_cents is null OR !min_platform_earnings_enforced) {
  // No earnings condition
} else if (creator.lifetime_platform_earnings_cents < contest.min_platform_earnings_cents) {
  disable submit + show warning
} else {
  allow submit
}
```

**Combine with other gates:** Trust, qualitative, and earnings gates are **independent**. If any active gate fails, submit is disabled. Show the most relevant message first (or stack banners if multiple fail).

**Opportunities list filter (client-side):**

```typescript
// lib/platform-earnings-gate.ts

export function isCreatorPlatformEarningsContestEligible(input: {
  minCents: number | null;
  enforced?: boolean | null;
  lifetimeCents: number | null;
  earningsLoaded: boolean;
}): boolean {
  if (!input.enforced || input.minCents === null) return true;
  if (!input.earningsLoaded || input.lifetimeCents === null) return false;
  return input.lifetimeCents >= input.minCents;
}
```

When `earningsEligibilityFilter === "meets_requirement"`, filter `contestsToDisplay` with this helper. Fetch creator lifetime earnings once on Opportunities load (same source as submit gate).

---

## Testing checklist

### Brand / admin

- [ ] Create campaign with earnings gate **disabled** → saves `min_platform_earnings_cents = null`
- [ ] Create campaign with minimum **$50** → saves `5000` cents
- [ ] Edit campaign — change or clear minimum before end date
- [ ] Admin can set minimum on behalf of brand

### Creator — above minimum

- [ ] Lifetime earnings **≥** minimum → Submit entry **enabled**
- [ ] Can complete submission flow end-to-end

### Creator — below minimum

- [ ] Campaign **visible** in Opportunities
- [ ] Campaign detail → Submit entry **disabled** + banner
- [ ] Submit page → Submit button **disabled** + banner
- [ ] Direct API submit → **403** with same message

### Creator — earns into eligibility

- [ ] Start below minimum → blocked
- [ ] Receive payout / bonus elsewhere → lifetime increases
- [ ] Reload campaign → submit **enabled**

### Edge cases

- [ ] New creator ($0) + minimum $50 → blocked
- [ ] Earnings loading state → fail-closed (button disabled until loaded)
- [ ] Twitter / text_image campaign → gate skipped in v1 (if following trust pattern)
- [ ] Coins-only earner (no cash) → treated as $0 for this gate

### Opportunities filter

- [ ] Default **All campaigns** → gated campaigns still visible in list
- [ ] **I meet earnings requirement** → hides campaigns where lifetime earnings below minimum
- [ ] Campaign with no minimum → always shown when filter on
- [ ] Earnings loading → gated campaigns hidden until loaded (fail-closed)
- [ ] Filter persists in localStorage with other Opportunities filters
- [ ] Combined **Can submit** filter respects earnings + qualitative + trust together

---

## Related docs

- [Trust Score System](./TRUST_SCORE_SYSTEM.md) — optional minimum trust score per campaign
- [Qualitative Score System](./QUALITATIVE_SCORE_SYSTEM.md) — optional minimum content quality per campaign
- [Earnings Cap Clarification](./EARNINGS_CAP_CLARIFICATION.md) — per-contest **maximum** earnings (does not block submit)
