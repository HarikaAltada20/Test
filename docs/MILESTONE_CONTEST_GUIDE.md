# Milestone Contest Implementation Guide (Brand, Creator, and Submissions)


## 1) Product Philosophy and Core Logic

A milestone contest is designed to reward performance in measurable steps rather than one final winner outcome. The brand sets view-based targets, creators submit content, the system verifies metrics, and payouts are determined by reached milestones.

The most important design choice is that milestone rewards are **non-cumulative**. This means each creator receives payout only for the **highest milestone reached**, not the sum of all milestones crossed. This avoids accidental over-distribution and keeps payout logic predictable for both brands and creators.

Example:

- Milestone A: 10K views -> $10
- Milestone B: 100K views -> $50  
  If a creator reaches 100K views, they receive **$50 total**, not $60.

All payouts should be stored and processed in cents for precision and to avoid floating-point currency issues.

---

## 2) Brand Side: End-to-End Contest Setup

From the brand dashboard, the contest creation flow should guide users through strategy-driven decisions rather than just field entry. The expected sequence is:

### Step 1: Contest Type and Basic Meta

The brand selects **Milestone Reward Contest** as contest type. The system should collect standard metadata (title, campaign goal, timeline, optional content rules) before allowing milestone configuration.

### Step 2: Milestone Configuration

Each milestone is defined by:

- `target_views` (integer, required, greater than 0)
- `payout_cents` (integer, required, minimum 10)
- optional `winner_limit` (null for unlimited, or positive integer)

Validation rules:

- `payout_cents >= 10` (minimum $0.10)
- milestones should be strictly increasing by `target_views`
- duplicate target view values should be blocked

UX recommendation:

- show real-time "USD preview" from cents
- show warning if milestones are too close (for example, 100K and 101K) because this can confuse creators

### Step 3: Winner Distribution Strategy

Brands should choose payout behavior per milestone:

- **Unlimited winners** (default): everyone who qualifies gets paid
- **Limited winners**: only first N qualified creators get paid for that milestone

When limited winners are used, eligibility resolution must rely on deterministic ordering:

1. First sort by time when threshold is verified (`verified_at_threshold_time`)
2. Tie-break by earliest submission timestamp
3. Final tie-break by creator ID (stable deterministic fallback)

This avoids payout disputes later.

### Step 4: Bonus Milestones (Optional but Powerful)

The brand can add bonus pools to reward exceptional creators beyond standard milestone tiers. Bonus milestones are leaderboard-style rewards evaluated after verification windows.

Two bonus types are supported:

1. **Most Verified Views per Creator**
2. **Most Verified Reels per Creator**

Both must support an **independent minimum eligibility condition**. This is critical and should be configurable separately for each bonus.

Examples:

- Most Verified Views bonus: minimum 200,000 total verified views, optionally plus a minimum verified reel count.
- Most Verified Reels bonus: minimum 5 verified reels, optionally plus a minimum total verified view count.

A creator can lead a metric but still be ineligible if the configured minimum thresholds are not met.

---


### A) Most Verified Views per Creator

Definition:

- Compute each creator's `total_verified_views` for the contest.
- Only include views from verified submissions linked to that contest.

Eligibility condition (configurable):

- `total_verified_views >= min_total_views` when that minimum is set (greater than zero).
- Optionally, `verified_reels_count >= min_verified_reels` when the brand also sets a reels floor (greater than zero). If only views minimum is configured, do not require a minimum reel count for eligibility.

Winner selection:

- among eligible creators, highest `total_verified_views` wins
- tie-breaker sequence:
  1. creator with more verified reels
  2. creator who reached min threshold earlier
  3. lowest creator ID as deterministic fallback

### B) Most Verified Reels per Creator

Definition:

- Compute each creator's `verified_reels_count`.
- Count only verified, non-rejected, contest-linked reels.

Eligibility condition (configurable):

- `verified_reels_count >= min_verified_reels` when that minimum is set (greater than zero).
- Optionally, `total_verified_views >= min_total_views` for the reels bonus when the brand also sets a views floor (greater than zero). If only the reels minimum is configured, do not require a minimum view total for eligibility.

Winner selection:

- among eligible creators, highest `verified_reels_count` wins
- tie-breaker sequence:
  1. higher total verified views
  2. earlier time of reaching required reel threshold
  3. lowest creator ID

### Worked examples: eligibility and winners

These examples assume totals are from **verified** (and counted) submissions only. Each bonus is evaluated **independently**: different creators can win views vs reels, or one creator can win both if they rank first in each eligible pool.

#### Example 1 — Both bonuses use a views floor and a reels floor

Brand configuration:

- **Views bonus:** minimum **500,000** total verified views **and** minimum **3** verified reels.
- **Reels bonus:** minimum **5** verified reels **and** minimum **400,000** total verified views.

Creator totals at contest end:

| Creator | Total verified views | Verified reels |
|---------|----------------------:|---------------:|
| Sam     | 600,000               | 4              |
| Ria     | 450,000               | 6              |
| Leo     | 520,000               | 2              |

**Views bonus:** Sam is the only creator with at least 500K views **and** at least 3 reels. Ria fails the view floor; Leo fails the reel floor. **Winner: Sam.**

**Reels bonus:** Ria is the only creator with at least 5 reels **and** at least 400K views. Sam and Leo fail the reel floor. **Winner: Ria.**

Outcome: **Sam** wins the views bonus; **Ria** wins the reels bonus.

#### Example 2 — Views bonus: only a minimum view total

Brand configuration:

- **Views bonus:** minimum **500,000** views; **no** minimum reels configured (treated as not applied for eligibility).

Creator totals:

| Creator | Total verified views | Verified reels |
|---------|----------------------:|---------------:|
| Sam     | 550,000               | 1              |
| Ria     | 600,000               | 10             |

Both meet the view floor. Highest views wins. **Winner: Ria (600K).** Sam’s reel count does not disqualify him; extra reels only matter as a **tie-breaker** if two creators have the same total views.

#### Example 3 — Reels bonus: only a minimum reel count

Brand configuration:

- **Reels bonus:** minimum **5** verified reels; **no** minimum total views configured (treated as not applied for eligibility).

Creator totals:

| Creator | Verified reels | Total verified views |
|---------|-----------------:|----------------------:|
| Sam     | 7                | 50,000                |
| Ria     | 6                | 1,000,000             |

Both meet the reel floor. Highest reel count wins. **Winner: Sam (7 reels).** Low views do not disqualify Sam.

#### Example 4 — Only one bonus category is configured

If the contest defines **only** the reels bonus block in configuration, the views bonus pool is not evaluated (no views winner from that track). If **only** the views bonus block exists, the reels bonus pool is not evaluated. This keeps “views-only” or “reels-only” campaigns unambiguous.

### Why separate conditions matter

The system must not assume one shared minimum condition for all bonuses. Brand teams often run campaigns where "views quality" and "content volume" are separate strategic goals. Therefore, the UI and backend should persist independent rule blocks per bonus type.

---

## 4) Creator Side: Participation and Transparency

On the creator side, the experience should feel like a progress journey with clear payoff understanding.

### Contest Discovery and Join Flow

A creator opens contest details and sees:

- contest objective
- milestone ladder with payouts
- bonus opportunities and eligibility requirements

Creators should explicitly see that milestone payouts are non-cumulative to prevent expectation mismatch.

### Submission Lifecycle

Each creator submission can move through states:


- pending
- Verified
- Rejected (with reason)

Only **verified** submissions contribute toward milestone and bonus calculations.

### Progress Experience

The creator dashboard should display:

- current verified views
- highest milestone reached
- payout currently secured
- next milestone target and gap remaining
- bonus tracking cards:
  - total verified views vs bonus min condition
  - verified reels count vs bonus min condition

This helps creators understand not just "where they are," but "what they need next."

---

## 5) My Submissions Section: Operational Source of Truth

The My Submissions page is where creators and support teams validate outcomes. It should provide audit-friendly clarity.

### Required fields per submission row

- submission ID
- platform/post link
- submission date
- current status
- verified views (if verified)
- verification timestamp
- rejection reason (if rejected)
- milestone contribution indicator

### Aggregate panel at top

The section should summarize:

- total submissions
- verified submissions
- total verified views
- current highest milestone
- current estimated payout
- bonus eligibility status for:
  - Most Verified Views
  - Most Verified Reels

## 6) Payout Computation Model

To ensure deterministic outcomes, payout computation should happen in two phases:

### Phase 1: Milestone payout per creator

1. Compute creator verified views total.
2. Identify highest milestone where threshold is met.
3. Apply winner-limit logic if configured.
4. Assign milestone payout for that creator.

### Phase 2: Bonus payout assignment

1. Evaluate each bonus type independently.
2. Apply each bonus's minimum eligibility condition.
3. Rank eligible creators and assign bonus winners.
4. Store selection reason and tie-break metadata for audit.

Final payable amount per creator:

- `highest_milestone_payout + won_bonus_payouts`

---

## 7) Data and Configuration Blueprint

At implementation level, these entities should exist (naming may vary by schema):

- `contests`
- `contest_milestones`
- `contest_bonus_rules`
- `contest_submissions`
- `submission_verification_events`
- `contest_creator_aggregates`
- `contest_payout_allocations`

Key fields for bonus rules:

- `bonus_type` (`MOST_VERIFIED_VIEWS`, `MOST_VERIFIED_REELS`)
- `payout_cents`
- `min_views_required` (nullable per type)
- `min_reels_required` (nullable per type)
- `is_enabled`

Store all rank computations with timestamps so re-runs are reproducible and explainable.

---

## 8) Validation and Guardrails

To avoid invalid campaign setups:

- block contest publishing if no milestones configured
- block any milestone payout below 10 cents
- block duplicate milestone thresholds
- warn if bonus enabled without payout value
- block logically impossible conditions (for example, min reels > max allowed submissions if such a limit exists)

For creator trust:

- always show "verified metrics only" badge near progress
- always expose disqualification reason when eligibility fails

---

## 9) Recommended UX Copy (Plain and Transparent)

Suggested statements to display in product UI:

- "You receive the payout of your highest reached milestone. Milestones are not cumulative."
- "Bonus winners are evaluated separately from milestone rewards."
- "To qualify for Most Verified Views bonus, you must first reach at least 200,000 verified views."
- "To qualify for Most Verified Reels bonus, you must meet the minimum verified reel requirement set by the brand."

Simple language reduces support load and payout disputes.

---

## 10) Example Configuration (Practical)

Milestones:

- 10K views -> $5
- 100K views -> $40
- 500K views -> $250

Bonus milestones:

- Most Verified Views per Creator -> $300 bonus, minimum 200K verified views
- Most Verified Reels per Creator -> $200 bonus, minimum 5 verified reels

Outcome illustration (same milestone ladder as above; bonuses are **separate** from milestone tiers):

**Milestone payouts (highest qualifying tier only; not cumulative)**

- **Creator A:** 650K verified views, 4 verified reels → qualifies for the **500K** row → **$250**.
- **Creator B:** 320K verified views, 9 verified reels → below 500K but at/above **100K** → **$40** (assuming 320K sits on the 100K tier in this ladder).

**Most Verified Views bonus** ($300 in this sample, **min 200K** verified views)

- If the brand sets **only** a view minimum (no extra reels floor), eligibility is **views ≥ 200K** only.
  - **A (650K, 4 reels):** eligible; usually **wins the views bonus** if nobody else eligible has more than 650K views.
  - **B (320K, 9 reels):** eligible; **loses the views rank to A** on total views (320K is lower than 650K). Extra reels help only on **ties** in total views, not as a separate disqualifier.
- If the brand also sets a **minimum verified reel count** for this bonus, a creator must clear **both** the view floor and the reel floor to be eligible (see **Step 4 — Example 1**).

**Most Verified Reels bonus** ($200 in this sample, **min 5** verified reels)

- If the brand sets **only** a reel minimum (no extra views floor), eligibility is **reels ≥ 5** only.
  - **A (4 reels):** **not eligible** (below 5 reels).
  - **B (9 reels):** **eligible**; **wins the reels bonus** if no other eligible creator has more than 9 reels.
- If the brand also sets a **minimum total views** for this bonus, a creator must clear **both** the reel floor and the view floor (see **Step 4 — Example 1**).

**Cross-track outcome for this A/B pair (config as written: views min 200K, reels min 5, no extra cross-floors):** A takes **views bonus** (highest eligible views); B takes **reels bonus** (A never enters the reels pool).

For full tables—**both floors on each track**, **views-only minimum**, **reels-only minimum**, and **only one bonus category configured**—see **Step 4 → Worked examples** (Examples 1–4) earlier in this document.

---

## Final Implementation Note

If this is implemented with clear rule separation (milestones vs bonuses), strict verification-only aggregation, and transparent creator-facing eligibility status, the system will be scalable, dispute-resistant, and easy for brands to operate.

The two requested bonus milestones should always be treated as independent competitive tracks with their own condition blocks:

- **Most Verified Views per Creator** with configurable minimum total views (example: 200K)
- **Most Verified Reels per Creator** with configurable minimum verified reels (and optional minimum views condition)



