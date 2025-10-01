# Earnings Cap Clarification

**Important:** The `max_earnings_per_creator` field is **per-contest**, NOT platform-wide.

---

## 🎯 How It Works

### Per-Contest Earnings Cap

When a brand enables `max_earnings_per_creator` (e.g., $500):

```
Contest A: Max earnings = $500
├─ Creator X earns $500 from Contest A ✅
├─ Creator X hits the cap for Contest A
└─ Creator X is warned but CAN STILL submit to Contest A
    (just won't earn more from it)

Contest B: Max earnings = $1000 (different contest)
├─ Creator X earns $800 from Contest B ✅
└─ Creator X's earnings from Contest A don't count here
```

**Key Point:** Each contest has its own independent earnings cap!

---

## ❌ What It's NOT

### NOT a Platform-Wide Cap

```
❌ WRONG: Creator can only earn $500 total on the platform
✅ CORRECT: Creator can only earn $500 from THIS SPECIFIC contest
```

### Platform-Wide Earnings

```
Creator X's Total Platform Earnings:
├─ Contest A: $500 ✅
├─ Contest B: $800 ✅
├─ Contest C: $300 ✅
├─ Contest D: $1200 ✅
└─ TOTAL: $2800 ✅ (No platform limit!)
```

---

## 💡 Use Cases

### Why Brands Use Per-Contest Caps:

1. **Fair Distribution**
   - Prevent one creator from dominating all prizes
   - Encourage more creators to participate
   - Spread rewards across community

2. **Budget Control**
   - With multiple submissions enabled
   - One creator could submit 10 times and earn 10x
   - Cap ensures predictable per-creator costs

3. **Competition Balance**
   - Keeps contest competitive
   - Gives more creators a chance to win
   - Prevents monopolization

### Example Scenario:

```
Contest: YouTube Shorts Challenge
- Multiple submissions: 5 per creator
- Flat fee bonus: $10 per submission
- CPM rate: $5 per 1000 views
- Max earnings per creator: $200

Creator Journey:
├─ Submission 1: $10 flat fee + $50 CPM = $60
├─ Submission 2: $10 flat fee + $40 CPM = $50
├─ Submission 3: $10 flat fee + $60 CPM = $70
├─ Submission 4: $10 flat fee + $30 CPM = $40
│   └─ Total so far: $220 - OVER LIMIT!
│   └─ Only gets $20 (to reach $200 cap)
└─ Submission 5: Can submit, but earns $0 (already at cap)
    └─ Warning shown: "You've reached the $200 earning limit for this contest"
```

---

## 🔍 Technical Implementation

### Database Storage

```sql
-- Per-contest field (NOT in users table!)
contests.max_earnings_per_creator INTEGER
```

### Calculation Logic

```typescript
// Calculate total earnings for THIS contest only
const creatorEarnings = await calculateCreatorEarningsForContest(
  contestId,
  creatorId
);

// Check against THIS contest's cap
if (contest.max_earnings_per_creator) {
  if (creatorEarnings >= contest.max_earnings_per_creator) {
    showWarning("You've reached the earning limit for THIS contest");
    // Still allow submission, just no more earnings
  }
}
```

### Query Example

```sql
-- Get creator's earnings from specific contest
SELECT 
  SUM(earnings) as total_earned
FROM submissions
WHERE contest_id = 'contest-123'
  AND creator_id = 'creator-456'
  AND status IN ('verified', 'paid');

-- Compare to contest's cap
SELECT max_earnings_per_creator
FROM contests
WHERE id = 'contest-123';
```

---

## 📋 Display to Creators

### In Contest Details:

```
📊 Contest Earnings Information:

• Main Earnings: CPM/Leaderboard
• Flat Fee Bonus: $10 per verified submission
• Maximum You Can Earn: $500 from this contest
• Your Current Earnings: $350 / $500
```

### Warning Message:

```
⚠️ Earning Limit Reached

You've reached the maximum earning limit ($500) for this contest.

You can still submit entries, but you won't earn additional rewards 
from this specific campaign.

Your earnings from other contests are not affected!
```

---

## ✅ Remember

1. **Per-Contest Only** - Each contest independent
2. **Optional Feature** - Brands choose to enable or not
3. **Warning, Not Block** - Creators can still submit
4. **Transparent** - Creators see limit upfront
5. **Fair Distribution** - Helps spread rewards

---

## 🚀 Future Considerations

Possible enhancements (NOT in Phase 1):

- [ ] Show progress bar: "Earned $350 / $500"
- [ ] Group submissions by contest in dashboard
- [ ] Filter view: "Contests where I haven't hit cap"
- [ ] Analytics: Average earnings per contest

---

**Bottom Line:** It's a per-campaign budget control tool for brands, NOT a platform-wide creator limit! 🎯

