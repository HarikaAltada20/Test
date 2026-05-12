# Payout Regression Checklist

Use this checklist before shipping payout changes.

## 1) Adjustment parity: single vs bulk

- Contest mode `combined`, adjustment `25%`:
  - `mark paid` single submission credits adjusted reward.
  - `bulk standard` for same submissions credits same per-row reward totals.
- Contest mode `bonus_only`, adjustment `25%`:
  - Reward remains unchanged.
  - Bonus is adjusted in single + bulk.
- Contest mode `cpm_only`, adjustment `25%`:
  - Bonus remains unchanged.
  - Reward is adjusted in single + bulk.

## 2) Bonus cap/budget behavior

- Cap available for full bonus:
  - Bonus credits full amount.
- Cap has partial remainder:
  - Bonus credits partial remainder (not hard-fail).
- Cap exhausted:
  - Bonus is skipped with explicit reason in response payload.

## 3) Mark both behavior

- When reward is payable and bonus is capped:
  - Reward is credited.
  - Bonus is skipped.
  - Response includes `bonus_outcome`.

## 4) Twitter routes parity

- `pay-twitter-tweet` applies adjustment (non-custom).
- `pay-twitter-bonus` applies cap-aware partial remainder + bonus adjustment.
- `pay-twitter-creator` applies adjustment (non-custom).
- `bulk-pay-twitter-cpm` totals align with per-item credits.

## 5) Expected UI consistency

- TikTok CPM rows:
  - Expected reward uses same effective views source as shown views.
- Twitter rows:
  - No forced expected-reward zeroing from display override logic.

## 6) Admin UX clarity

- Payout adjustment control shows current saved percent value (defaults to `0.00%`).
- Bulk result payload surfaces bonus reason counts (`allocated`, `partial_remainder`, `cap_exhausted`, `ineligible`).
