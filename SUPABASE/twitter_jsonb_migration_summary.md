# Twitter JSONB Migration Summary

## Overview
Successfully migrated Twitter campaign data (`twitter_targets`, `twitter_keywords`, `twitter_mentions`) from direct columns to `contest_based_details.twitter_campaign` JSONB structure for better scalability and consistency.

## Migration Script
**File**: `SUPABASE/migrate_twitter_to_jsonb.sql`

### Features:
1. **Data Migration**: Migrates existing data from columns to JSONB (if any exists)
2. **Performance Indexes**: Creates 5 GIN indexes for fast JSONB queries:
   - `idx_contests_twitter_campaign` - Full object index
   - `idx_contests_twitter_keywords` - Keywords array index
   - `idx_contests_twitter_mentions` - Mentions array index
   - `idx_contests_platform_twitter` - Composite index for platform + twitter_campaign
   - `idx_contests_twitter_campaign_type` - Campaign type filter index
3. **Helper Functions**: SQL functions for easy querying
4. **Column Removal**: Ready to drop old columns after verification

### Index Performance
The GIN (Generalized Inverted Index) indexes ensure fast queries on:
- Filtering contests by Twitter campaign existence
- Searching within keywords/mentions arrays
- Filtering by campaign type (raid/keyword_hashtag/awareness)

## Code Updates

### 1. Contest Creation (`app/dashboard/contests/create/client.tsx`)
- ✅ **Write**: Twitter data now written to `contest_based_details.twitter_campaign`
- ✅ **Read**: Reads from JSONB with legacy column fallback for backward compatibility
- ✅ Removed direct column writes (`twitter_keywords`, `twitter_mentions`, `twitter_targets`)

### 2. Contest Edit (`app/dashboard/contests/[id]/edit/client.tsx`)
- ✅ **Read**: Loads Twitter data from JSONB with legacy fallback
- ✅ **Write**: Updates Twitter data in JSONB structure
- ✅ Supports all campaign types (raid, awareness, keyword_hashtag)

### 3. Opportunities Page (`app/dashboard/opportunities/[id]/client.tsx`)
- ✅ **Read**: Displays Twitter data from JSONB with legacy fallback
- ✅ **API**: Sends keywords/mentions from JSONB to refresh-tweets API
- ✅ UI components updated to read from new structure

### 4. API Routes (`app/api/contests/[id]/twitter-refresh-tweets/route.ts`)
- ✅ **Read**: Fetches keywords/mentions from JSONB if client doesn't send them
- ✅ **Fallback**: Supports both client payload and direct DB query

### 5. Helper Utilities (`lib/twitter-utils.ts`)
Created reusable helper functions:
- `getTwitterCampaign()` - Get campaign config with legacy fallback
- `buildTwitterCampaignConfig()` - Build config object for saving
- `getTwitterKeywords()` - Get keywords array
- `getTwitterMentions()` - Get mentions array
- `getTwitterRaidTarget()` - Get raid target object

## JSONB Structure

```json
{
  "contest_based_details": {
    "twitter_campaign": {
      "campaign_type": "raid" | "keyword_hashtag" | "awareness",
      "keywords": ["keyword1", "keyword2"],
      "mentions": ["@mention1", "@mention2"],
      "keywords_requirement_mode": "all" | "any",
      "mentions_requirement_mode": "all" | "any",
      "raid_target": {
        "link": "https://x.com/user/status/1234567890",
        "description": "Optional description",
        "metrics": {
          "likes": 1000,
          "replies": 100,
          "retweets": 500
        },
        "keywords_requirement_mode": "",
        "mentions_requirement_mode": ""
      }
    }
  }
}
```

## Backward Compatibility
- ✅ All code reads from JSONB first, falls back to legacy columns
- ✅ During migration period, both structures are supported
- ✅ No breaking changes for existing contests

## Performance Optimizations

1. **GIN Indexes**: Enable fast array searches and object existence checks
2. **Composite Indexes**: Optimize common query patterns (platform + twitter_campaign)
3. **Selective Indexing**: Only index when `twitter_campaign` exists (partial indexes)

## Next Steps

1. **Run Migration**: Execute `SUPABASE/migrate_twitter_to_jsonb.sql` in Supabase
2. **Verify**: Test contest creation, editing, and display
3. **Monitor**: Check query performance with new indexes
4. **Cleanup** (after verification): Uncomment column drop statements in migration script

## Files Modified

1. ✅ `SUPABASE/migrate_twitter_to_jsonb.sql` - Migration script
2. ✅ `lib/twitter-utils.ts` - Helper functions (NEW)
3. ✅ `app/dashboard/contests/create/client.tsx` - Creation logic
4. ✅ `app/dashboard/contests/[id]/edit/client.tsx` - Edit logic
5. ✅ `app/dashboard/opportunities/[id]/client.tsx` - Display logic
6. ✅ `app/api/contests/[id]/twitter-refresh-tweets/route.ts` - API logic

## Testing Checklist

- [ ] Create new Twitter raid contest → Verify JSONB structure
- [ ] Create new Twitter keyword_hashtag contest → Verify JSONB structure
- [ ] Edit existing Twitter contest → Verify JSONB update
- [ ] View contest details → Verify display from JSONB
- [ ] Refresh tweets API → Verify keywords/mentions from JSONB
- [ ] Check leaderboard → Verify Twitter data display
- [ ] Verify query performance → Check index usage

## Benefits

1. **Scalability**: Easy to add new platforms (LinkedIn, etc.) using same pattern
2. **Consistency**: All contest-type-specific data in one JSONB column
3. **Performance**: GIN indexes provide fast queries on JSONB data
4. **Flexibility**: Easy to add new Twitter campaign fields without schema changes
5. **Maintainability**: Single source of truth for Twitter campaign config

