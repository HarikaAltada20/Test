# 💰 Bulk Payment System - Complete Implementation

## 📋 Table of Contents
1. [Overview](#overview)
2. [Payment Options](#payment-options)
3. [API Endpoints](#api-endpoints)
4. [Frontend Implementation](#frontend-implementation)
5. [Payment Flow](#payment-flow)
6. [Cap Handling](#cap-handling)
7. [Testing Guide](#testing-guide)
8. [Comparison](#comparison)

---

## 🎯 Overview

The GoViral platform now supports **TWO payment modes** for bulk submission payments:

### **Individual Payment Mode**
- Multiple API calls (one per submission)
- Multiple wallet transactions
- Full transparency
- Partial failure handling
- **Status**: ✅ Fully Implemented

### **Bulk Payment Mode**
- Single API call
- Single wallet transaction
- Faster processing
- Atomic operation
- **Status**: ✅ Fully Implemented

### **Platform routing (bulk)**

| Platform / content | Data store | Bulk endpoint |
|--------------------|------------|----------------|
| YouTube, Instagram | `submissions` | `POST /api/admin/bulk-payment` |
| Twitter / X **CPM** (text/image) | `twitter_campaign_tweets` | `POST /api/contests/[id]/bulk-pay-twitter-cpm` |
| Twitter **leaderboard** | `twitter_campaign_tweets` + creator payout | *(Bulk in modal still uses per-row payment APIs; use creator-level pay where applicable.)* |

The creator submissions modal chooses the bulk URL based on `contest.contest_type === "cpm"` and Twitter/X platform so **Twitter CPM bulk matches Instagram: one wallet transaction**.

---

## 💳 Payment Options

Brands have **6 payment buttons** in the creator submissions modal:

### Without "(Bulk)" - Individual Transactions
1. **Mark as Paid**
   - Pays CPM/Leaderboard earnings only
   - Creates individual transaction per submission

2. **Mark Bonus as Paid**
   - Pays flat fee bonus only
   - Creates individual transaction per submission

3. **Mark Both as Paid**
   - Pays CPM + Bonus combined
   - Creates individual transaction per submission

### With "(Bulk)" - Single Transaction
4. **Mark as Paid (Bulk)**
   - Pays CPM/Leaderboard earnings only
   - Creates ONE transaction for all submissions

5. **Mark Bonus as Paid (Bulk)**
   - Pays flat fee bonus only
   - Creates ONE transaction for all submissions

6. **Mark Both as Paid (Bulk)**
   - Pays CPM + Bonus combined
   - Creates ONE transaction for all submissions

---

## 🔌 API Endpoints

### **POST** `/api/admin/bulk-payment`

Used for **YouTube and Instagram** (and any contest whose rows live in `submissions`).


#### Request Body
```json
{
  "submission_ids": ["uuid1", "uuid2", "uuid3"],
  "payment_type": "both",
  "contest_id": "contest-uuid",
  "creator_id": "creator-uuid"
}
```

#### Parameters
- `submission_ids` (required): Array of submission UUIDs
- `payment_type` (required): `"standard"` | `"bonus"` | `"both"`
- `contest_id` (required): Contest UUID
- `creator_id` (required): Creator UUID

#### Response (Success)
```json
{
  "success": true,
  "message": "Successfully paid 10 submissions",
  "data": {
    "total_amount": 15000,
    "total_cpm": 10000,
    "total_bonus": 5000,
    "paid_count": 10,
    "skipped_count": 2,
    "breakdown": [
      {
        "submission_id": "uuid1",
        "video_title": "Amazing Video",
        "cpm_amount": 500,
        "bonus_amount": 100,
        "created_at": "2025-10-01T10:00:00Z"
      }
    ],
    "transaction_id": "txn-uuid",
    "cap_reached": false,
    "remaining_cap": 5000
  }
}
```

#### Response (Error)
```json
{
  "error": "No verified submissions found",
  "details": "All submissions must be verified before payment"
}
```

---

### **POST** `/api/contests/[contestId]/bulk-pay-twitter-cpm`

Used for **Twitter / X CPM** contests when the brand selects multiple tweets for the same creator and uses a **(Bulk)** payment action.

#### Request Body
```json
{
  "tweet_ids": ["uuid1", "uuid2", "uuid3"],
  "payment_type": "both",
  "creator_id": "creator-uuid"
}
```

(`contestId` is taken from the URL path `[contestId]`.)

#### Parameters
- `tweet_ids` (required): Array of `twitter_campaign_tweets.id` values (must all belong to `creator_id`)
- `payment_type` (required): `"standard"` | `"bonus"` | `"both"`
- `creator_id` (required): Creator UUID

#### Behavior (summary)
- Validates contest is Twitter/X **CPM** and `post_contest_status === "verification_complete"`.
- Sorts tweets by `tweet_created_at` (earliest first).
- Applies per-creator CPM cap using existing `money_transactions` semantics (including `payout_type: "twitter_cpm_bulk"` totals via `metadata.total_cpm`).
- Credits the creator **once** with `payout_type: "twitter_cpm_bulk"`; optional `bonus_type: "flat_fee"` when bonus is included; per-tweet amounts in `cpm_breakdown` and `twitter_bulk_bonus_breakdown`.
- Updates each paid tweet: `moderation_status: "paid"`, `earnings` (CPM cents). Updates `twitter_campaign_leaderboard.earnings` by the sum of CPM paid in this call.

#### Response `data` shape (success)
Aligns with the modal alert fields: `total_amount`, `total_cpm`, `total_bonus`, `paid_count`, `skipped_count`, `transaction_id`, plus `cpm_breakdown` / `bonus_breakdown` objects keyed by tweet id.

The UI hydrates Twitter bonus rows via `GET /api/contests/[id]/twitter-bonus-status`, which also reads `twitter_bulk_bonus_breakdown` on reward transactions.

---

## 🎨 Frontend Implementation

### Component: `CreatorSubmissionsModal.tsx`

#### State Management
```tsx
const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
const [selectAll, setSelectAll] = useState(false);
```

#### Bulk payment function (`CreatorSubmissionsModal.tsx`)

- **Verified-only**: Non-Twitter rows use `status === "verified"`; Twitter tweets use `moderation_status === "verified"` (or equivalent).
- **Sort**: By `created_at` ascending.
- **Bulk (`isBulkTransaction === true`)**:
  - **Twitter CPM** (`contest.contest_type === "cpm"` and platform Twitter/X): `POST /api/contests/${contest.id}/bulk-pay-twitter-cpm` with `{ tweet_ids, payment_type, creator_id }`.
  - **Otherwise** (e.g. Instagram / YouTube): `POST /api/admin/bulk-payment` with `{ submission_ids, payment_type, contest_id, creator_id }`.
- **Non-bulk**: Sequential `onPayment(sub.id, type)` (Twitter still uses per-tweet APIs such as `pay-twitter-tweet` / `pay-twitter-bonus` as appropriate).

#### UI Buttons
```tsx
<Button onClick={() => handleBulkPayment('standard', false)}>
  Mark as Paid
</Button>
<Button onClick={() => handleBulkPayment('standard', true)}>
  Mark as Paid (Bulk)
</Button>
```

---

## 🔄 Payment Flow

### Individual Payment Flow
```
User selects 10 submissions
↓
User clicks "Mark Both as Paid"
↓
Frontend filters to verified submissions (8 verified)
↓
Frontend sorts by submission time (earliest first)
↓
Frontend calls API 8 times (one per submission)
↓
Each call:
  - Checks if already paid
  - Calculates earnings (respects cap)
  - Credits wallet
  - Updates submission status
↓
Shows summary: "✓ Successfully paid 8 submissions!"
```

### Bulk Payment Flow
```
User selects 10 submissions
↓
User clicks "Mark Both as Paid (Bulk)"
↓
Frontend filters to verified submissions (8 verified)
↓
Frontend sorts by submission time (earliest first)
↓
Frontend calls bulk API once with all 8 submission IDs
↓
Backend:
  - Fetches all submissions
  - Filters to verified only
  - Sorts by submission time
  - Calculates total earnings (respects cap)
  - Credits wallet ONCE with breakdown
  - Updates all submissions
  - Returns detailed summary
↓
Shows alert with breakdown:
  ✓ Bulk Payment Successful!
  
  Paid Submissions: 8
  Skipped: 2
  
  CPM Earnings: $100.00
  Flat Fee Bonus: $50.00
  Total Paid: $150.00
```

### Twitter CPM bulk flow (same UX, different endpoint)

Same as above, except IDs are **tweet** ids and the backend uses `twitter_campaign_tweets` + `bulk-pay-twitter-cpm`. Per-tweet **earnings** (cents) are stored on the tweet row so normal list views can show granted amounts consistently with Instagram.

---

## 🧮 Cap Handling

### Earnings Cap Logic

#### Individual Mode
```typescript
// Backend (verify-submission API)
const alreadyPaid = getAlreadyPaidAmount(creator_id, contest_id);
const maxCap = contest.max_earnings_per_creator;

if (alreadyPaid + submission.earnings > maxCap) {
  // Partial payment or reject
}
```

#### Bulk Mode
```typescript
// Backend (bulk-payment API)
let runningTotal = getAlreadyPaidAmount(creator_id, contest_id);
const maxCap = contest.max_earnings_per_creator;

for (const sub of sortedSubmissions) {
  if (runningTotal + sub.earnings > maxCap) {
    const remaining = maxCap - runningTotal;
    sub.earnings = remaining; // Partial payment
    runningTotal = maxCap;
    break; // Cap reached
  }
  runningTotal += sub.earnings;
}
```

### Bonus Handling
- **Flat fee bonus is NOT capped**
- Bonus is paid for ALL verified submissions
- Bonus is independent of CPM/Leaderboard earnings cap
- Total payment = `capped_earnings + uncapped_bonus`

### Example with Cap
```
Contest: max_earnings_per_creator = $100.00
Already Paid: $80.00
Selected Submissions:
  1. Video A (submitted first) - $15.00
  2. Video B (submitted second) - $10.00
  3. Video C (submitted third) - $8.00

Bulk Payment Calculation:
  Video A: $15.00 ✓ (running total: $95.00)
  Video B: $5.00 ✓ (running total: $100.00, capped!)
  Video C: $0.00 ✗ (cap reached)

Bonus (if enabled at $1.00 each):
  Video A: $1.00 ✓
  Video B: $1.00 ✓
  Video C: $1.00 ✓

Total Paid:
  CPM: $20.00 (capped to $20.00)
  Bonus: $3.00 (not capped)
  Total: $23.00
```

---

## 🧪 Testing Guide

### Test Case 1: Individual Payment (No Cap)
```
Setup:
  - Contest: CPM, $1.00 per 1000 views
  - No earnings cap
  - Flat fee bonus: $1.00
  - 5 verified submissions with 10,000 views each

Steps:
  1. Select all 5 submissions
  2. Click "Mark Both as Paid"
  3. Wait for sequential processing

Expected Result:
  ✓ Successfully paid 5 submissions!
  
  Wallet transactions: 5 separate
  Each transaction: $10.00 (CPM) + $1.00 (bonus) = $11.00
  Total: $55.00
```

### Test Case 2: Bulk Payment (No Cap)
```
Setup:
  - Same as Test Case 1

Steps:
  1. Select all 5 submissions
  2. Click "Mark Both as Paid (Bulk)"
  3. Wait for single API call

Expected Result:
  ✓ Bulk Payment Successful!
  
  Paid Submissions: 5
  CPM Earnings: $50.00
  Flat Fee Bonus: $5.00
  Total Paid: $55.00
  
  Wallet transactions: 1
  Transaction breakdown: All 5 submissions listed
```

### Test Case 3: Bulk Payment (With Cap)
```
Setup:
  - Contest: CPM, $1.00 per 1000 views
  - Earnings cap: $25.00
  - Already paid: $10.00
  - Flat fee bonus: $1.00
  - 5 verified submissions with 10,000 views each

Steps:
  1. Select all 5 submissions (sorted by submission time)
  2. Click "Mark Both as Paid (Bulk)"

Expected Result:
  ✓ Bulk Payment Successful!
  
  Paid Submissions: 5
  CPM Earnings: $15.00 (capped from $50.00)
  Flat Fee Bonus: $5.00 (not capped)
  Total Paid: $20.00
  
  ⚠️ Earnings cap reached!
  Remaining cap: $0.00
  
  Breakdown:
    Video 1 (earliest): $10.00 CPM + $1.00 bonus
    Video 2: $5.00 CPM + $1.00 bonus (cap reached)
    Video 3: $0.00 CPM + $1.00 bonus
    Video 4: $0.00 CPM + $1.00 bonus
    Video 5: $0.00 CPM + $1.00 bonus
```

### Test Case 4: Already Paid Submissions
```
Setup:
  - 10 submissions selected
  - 3 already paid
  - 7 verified and unpaid

Steps:
  1. Select all 10 submissions
  2. Click "Mark as Paid (Bulk)"

Expected Result:
  ✓ Bulk Payment Successful!
  
  Paid Submissions: 7
  Skipped (already paid): 3
  Total Paid: $70.00
```

### Test Case 5: Bonus Only Payment
```
Setup:
  - 5 verified submissions
  - All already paid for CPM
  - Bonus not yet paid

Steps:
  1. Select all 5 submissions
  2. Click "Mark Bonus as Paid (Bulk)"

Expected Result:
  ✓ Bulk Payment Successful!
  
  Paid Submissions: 5
  CPM Earnings: $0.00
  Flat Fee Bonus: $5.00
  Total Paid: $5.00
```

---

## 📊 Comparison: Individual vs Bulk

| Feature | Individual | Bulk |
|---------|-----------|------|
| **API Calls** | N calls (1 per submission) | 1 call |
| **Wallet Transactions** | N transactions | 1 transaction |
| **Processing Time** | ~5 sec for 10 submissions | ~1 sec for 10 submissions |
| **Transaction History** | Very detailed (per submission) | Single entry with breakdown |
| **Atomicity** | Partial failures possible | All or nothing |
| **Cap Handling** | Per submission | Bulk calculation |
| **Error Handling** | Continue on failure | Rollback on failure |
| **Audit Trail** | Multiple line items | Single line item (detailed metadata) |
| **Speed** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Transparency** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **User Experience** | Sequential (slower) | Instant (faster) |
| **Recommended For** | 1-5 submissions | 10+ submissions |

---

## 💡 Best Practices

### When to Use Individual Payment
✅ Paying 1-5 submissions
✅ Need granular audit trail
✅ Want per-submission transaction history
✅ Testing/debugging payments
✅ Refunding individual submissions later

### When to Use Bulk Payment
✅ Paying 10+ submissions
✅ Speed is important
✅ Clean wallet history
✅ Professional bulk operations
✅ End-of-month payment cycles

---

## 🔒 Security & Validation

### Backend Validation
```typescript
✅ User authentication
✅ Admin/Advertiser authorization
✅ Contest ownership verification
✅ Submission verification status check
✅ Duplicate payment prevention
✅ Earnings cap enforcement
✅ Transaction atomicity
```

### Frontend Validation
```typescript
✅ Only verified submissions selectable
✅ Sort by submission time (earliest first)
✅ Filter already paid submissions
✅ Show real-time payment progress
✅ Display detailed success/error messages
```

---

## 📝 Database Changes

### Submission status fields (`submissions`)

```sql
-- Track CPM/Leaderboard payment
paid: boolean (default false)
paid_at: timestamp

-- Track bonus payment
bonus_paid: boolean (default false)
bonus_paid_at: timestamp
```

### Twitter CPM tweet fields (`twitter_campaign_tweets`)

```sql
-- Per-tweet CPM amount credited (cents); set when marked paid (single or bulk)
earnings: integer (nullable)

moderation_status: includes 'paid' when CPM (and/or workflow) completed for that tweet
```

### Wallet transaction metadata

**Instagram / YouTube bulk** (`/api/admin/bulk-payment`):

```json
{
  "contest_id": "uuid",
  "payment_type": "both",
  "submission_count": 10,
  "total_cpm": 10000,
  "total_bonus": 5000,
  "cap_reached": false,
  "breakdown": [
    {
      "submission_id": "uuid",
      "video_title": "Amazing Video",
      "cpm_amount": 500,
      "bonus_amount": 100
    }
  ]
}
```

**Twitter CPM bulk** (`bulk-pay-twitter-cpm`):

```json
{
  "contest_id": "uuid",
  "twitter_creator_id": "uuid",
  "payout_type": "twitter_cpm_bulk",
  "payment_type": "both",
  "total_cpm": 10000,
  "total_bonus": 5000,
  "tweet_count": 8,
  "bonus_type": "flat_fee",
  "cpm_breakdown": { "tweet-uuid-1": 1100, "tweet-uuid-2": 950 },
  "twitter_bulk_bonus_breakdown": { "tweet-uuid-1": 1000, "tweet-uuid-2": 1000 }
}
```

---

## 🚀 Implementation Status

### ✅ Completed
- [x] Bulk payment API endpoint (`/api/admin/bulk-payment`)
- [x] Twitter CPM bulk payment API (`/api/contests/[id]/bulk-pay-twitter-cpm`)
- [x] Frontend bulk payment integration (routes bulk by platform / contest type)
- [x] Individual payment flow
- [x] Earnings cap handling
- [x] Bonus payment logic
- [x] Success/error messaging
- [x] Transaction metadata
- [x] Sorting by submission time
- [x] Already paid filtering
- [x] Verification status checks
- [x] UI with 6 payment buttons
- [x] Wallet integration
- [x] Database updates
- [x] Documentation

### 🎉 Ready for Production
All features fully implemented and tested!

---

## 📞 Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify submissions are in "verified" status
3. Check earnings cap configuration
4. Review wallet transaction history
5. Test with individual payment first

---

**Last Updated**: April 12, 2026  
**Version**: 1.1.0  
**Status**: ✅ Production Ready (apply `twitter_campaign_tweets.earnings` migration for Twitter CPM bulk)

