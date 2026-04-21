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

- Most Verified Views bonus condition: minimum 200,000 total verified views
- Most Verified Reels bonus condition: minimum 5 verified reels

A creator can lead a metric but still be ineligible if the minimum threshold is not met.

---


### A) Most Verified Views per Creator

Definition:

- Compute each creator's `total_verified_views` for the contest.
- Only include views from verified submissions linked to that contest.

Eligibility condition (configurable):

- `total_verified_views >= min_views_required`
- example: `min_views_required = 200000`

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

- `verified_reels_count >= min_reels_required`
- optional additional condition can be enabled:
  - `total_verified_views >= min_views_required_for_reels_bonus`

Winner selection:

- among eligible creators, highest `verified_reels_count` wins
- tie-breaker sequence:
  1. higher total verified views
  2. earlier time of reaching required reel threshold
  3. lowest creator ID

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

Outcome illustration:

- Creator A: 650K verified views, 4 verified reels
  - milestone payout = $250
  - views bonus = eligible and likely winner if top views
  - reels bonus = not eligible (below 5 reels)

- Creator B: 320K verified views, 9 verified reels
  - milestone payout = $40 (if not crossing 500K)
  - reels bonus = eligible and can win if top reel count
  - views bonus = eligible (crossed 200K), ranking decides

---

## Final Implementation Note

If this is implemented with clear rule separation (milestones vs bonuses), strict verification-only aggregation, and transparent creator-facing eligibility status, the system will be scalable, dispute-resistant, and easy for brands to operate.

The two requested bonus milestones should always be treated as independent competitive tracks with their own condition blocks:

- **Most Verified Views per Creator** with configurable minimum total views (example: 200K)
- **Most Verified Reels per Creator** with configurable minimum verified reels (and optional minimum views condition)
