# Twitter Integration Schema Analysis & Recommendations

## Current Implementation Issues

### ❌ Current Approach (Not Ideal):
```sql
-- Direct columns on contests table
ALTER TABLE contests ADD COLUMN twitter_targets JSONB;
ALTER TABLE contests ADD COLUMN twitter_keywords TEXT[];
ALTER TABLE contests ADD COLUMN twitter_mentions TEXT[];
```

### Problems:
1. **Not Scalable**: Adding direct columns for each platform (Twitter, LinkedIn, TikTok, etc.) will pollute the contests table
2. **Inconsistent**: You already use `contest_based_details` JSONB for leaderboard and CPM contests
3. **Hard to Query**: Mixed approach (columns + JSONB) makes queries complex
4. **Maintenance**: Adding new Twitter features requires schema migrations

---

## ✅ Recommended Approach: Use `contest_based_details` JSONB

### Benefits:
1. **Scalable**: Easy to add LinkedIn, TikTok, or any new platform
2. **Consistent**: Follows existing pattern for `leaderboard_contest` and `cpm_contest`
3. **Flexible**: Can store complex nested structures without schema changes
4. **Clean**: Keeps contests table focused on core fields

### Recommended Structure:

```json
{
  "leaderboard_contest": { ... },
  "cpm_contest": { ... },
  "twitter_campaign": {
    "campaign_type": "raid" | "awareness",
    
    // For keyword/hashtag campaigns
    "keywords": ["keyword1", "keyword2"],
    "mentions": ["@mention1", "@mention2"],
    "hashtags": ["#hashtag1"],
    "keywords_requirement_mode": "all" | "any",
    "mentions_requirement_mode": "all" | "any",
    
    // For raid campaigns
    "raid_target": {
      "link": "https://x.com/user/status/123",
      "tweet_id": "1234567890",
      "description": "Optional description",
      "metrics": {
        "likes": 1000,
        "replies": 100,
        "retweets": 500
      }
    },
    
    // Points/scoring configuration
    "points_config": {
      "likes": 1,
      "replies": 5,
      "retweets": 3,
      "impressions_multiplier": 0.001
    }
  }
}
```

---

## Migration Strategy

### Option 1: Keep Current + Add to JSONB (Gradual Migration)
- Keep existing columns for backward compatibility
- Start writing to `contest_based_details.twitter_campaign` for new contests
- Migrate existing data gradually
- Eventually deprecate the columns

### Option 2: Full Migration (Recommended)
- Create migration to move data from columns → JSONB
- Update all application code to use JSONB
- Drop the old columns after migration

---

## Query Examples

### Current (with columns):
```sql
SELECT * FROM contests 
WHERE twitter_keywords @> ARRAY['keyword'];
```

### Recommended (with JSONB):
```sql
SELECT * FROM contests 
WHERE contest_based_details->'twitter_campaign'->'keywords' ? 'keyword';

-- Or with GIN index:
CREATE INDEX idx_contests_twitter_keywords 
ON contests USING GIN ((contest_based_details->'twitter_campaign'->'keywords'));
```

---

## Indexes Needed

```sql
-- Index for Twitter campaign filtering
CREATE INDEX idx_contests_twitter_campaign 
ON contests USING GIN ((contest_based_details->'twitter_campaign'));

-- Index for specific fields
CREATE INDEX idx_contests_twitter_keywords 
ON contests USING GIN ((contest_based_details->'twitter_campaign'->'keywords'));

CREATE INDEX idx_contests_twitter_mentions 
ON contests USING GIN ((contest_based_details->'twitter_campaign'->'mentions'));
```

---

## Decision Matrix

| Factor | Direct Columns | JSONB (Recommended) |
|--------|---------------|---------------------|
| Scalability | ❌ Poor | ✅ Excellent |
| Consistency | ❌ Inconsistent | ✅ Consistent |
| Flexibility | ❌ Schema changes needed | ✅ No schema changes |
| Query Performance | ✅ Good (with indexes) | ✅ Good (with GIN indexes) |
| Type Safety | ✅ Yes | ⚠️ Runtime validation |
| Maintenance | ❌ Complex | ✅ Simple |

---

## Recommendation

**Use `contest_based_details.twitter_campaign` JSONB approach** because:
1. You're planning for LinkedIn and other platforms
2. It matches your existing architecture pattern
3. More maintainable long-term
4. Better for future extensibility

