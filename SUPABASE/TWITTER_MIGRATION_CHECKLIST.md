# Twitter Migration Checklist

Use this checklist to ensure a smooth migration to production.

## Pre-Migration

- [ ] **⚠️ BACKUP YOUR DATABASE** - **MANDATORY STEP - DO NOT SKIP!**
  - [ ] See [DATABASE_BACKUP_GUIDE.md](./DATABASE_BACKUP_GUIDE.md) for instructions
  - [ ] Create backup via Supabase Dashboard OR command line
  - [ ] Verify backup was created successfully
  - [ ] Note backup location/name for easy access
  - [ ] **DO NOT PROCEED** until backup is confirmed complete
- [ ] **Review the migration file** - Read through `migrate_twitter_to_main.sql` to understand what will change
- [ ] **Test in staging first** - If you have a staging environment, test there first
- [ ] **Check dependencies** - Verify all required tables exist:
  - [ ] `contests` table
  - [ ] `users` table
  - [ ] `creator_profiles` table
  - [ ] `contest_moderation_status_enum` enum type
- [ ] **Check environment variables** - Ensure Twitter API keys are configured:
  - [ ] `RAPIDAPI_HOST`
  - [ ] `RAPIDAPI_KEY` or `TWITTER_RAPIDAPI_KEY`

## Migration Execution

- [ ] **Run the migration** - Execute `migrate_twitter_to_main.sql` using one of:
  - [ ] Supabase Dashboard SQL Editor
  - [ ] Supabase CLI
  - [ ] psql command line
- [ ] **Verify no errors** - Check that the migration completed without errors
- [ ] **Run verification queries** - Use the queries in `TWITTER_MIGRATION_README.md`

## Post-Migration Verification

- [ ] **Tables created:**
  - [ ] `twitter_campaign_participants`
  - [ ] `twitter_campaign_tweets`
  - [ ] `twitter_campaign_leaderboard`
  - [ ] `twitter_campaign_metrics`
- [ ] **Column added:**
  - [ ] `creator_profiles.twitter_account` (JSONB)
- [ ] **Indexes created:**
  - [ ] All `idx_twitter_*` indexes exist
  - [ ] JSONB GIN indexes for `contest_based_details`
- [ ] **Functions created:**
  - [ ] `update_twitter_tweet_updated_at()`
  - [ ] `increment_participant_tweet_count()`
  - [ ] `get_twitter_campaign_type()`
- [ ] **Triggers created:**
  - [ ] `update_twitter_tweets_updated_at`
  - [ ] `increment_participant_tweet_count_trigger`
- [ ] **View updated:**
  - [ ] `contests_with_status` view includes all columns

## Application Testing

- [ ] **Twitter account connection:**
  - [ ] Can connect Twitter account via API
  - [ ] Twitter account data saves to `creator_profiles.twitter_account`
  - [ ] Can disconnect Twitter account
- [ ] **Campaign creation:**
  - [ ] Can create Twitter campaign (platform = "twitter", contest_format = "text_image")
  - [ ] Campaign data saves to `contest_based_details.twitter_campaign`
  - [ ] Can create both "raid" and "awareness" campaign types
- [ ] **Campaign participation:**
  - [ ] Creators can join Twitter campaigns
  - [ ] Participant record created in `twitter_campaign_participants`
- [ ] **Tweet fetching:**
  - [ ] System can fetch tweets for participants
  - [ ] Tweets saved to `twitter_campaign_tweets`
  - [ ] Eligibility filtering works
- [ ] **Leaderboard:**
  - [ ] Leaderboard entries created in `twitter_campaign_leaderboard`
  - [ ] Points calculation works
  - [ ] Rankings update correctly
- [ ] **Moderation:**
  - [ ] Can moderate individual tweets
  - [ ] Can moderate creators (affects all their tweets)
  - [ ] Manual points adjustment works
- [ ] **Metrics:**
  - [ ] Campaign metrics sync to `twitter_campaign_metrics`
  - [ ] Raid target metrics update correctly

## Performance & Monitoring

- [ ] **Query performance:**
  - [ ] Leaderboard queries are fast
  - [ ] Tweet filtering queries are optimized
  - [ ] JSONB queries use indexes
- [ ] **Monitor:**
  - [ ] Database size growth
  - [ ] Query execution times
  - [ ] Index usage statistics

## Documentation

- [ ] **Update team documentation:**
  - [ ] Document new Twitter campaign features
  - [ ] Update API documentation
  - [ ] Update admin guide for moderation

## Rollback Plan (if needed)

- [ ] **Have rollback plan ready:**
  - [ ] Know how to restore from backup
  - [ ] Document any manual cleanup needed
  - [ ] Test rollback in staging first

## Notes

Add any notes or issues encountered during migration:

```
Date: ___________
Migrated by: ___________
Issues: ___________
Resolution: ___________
```
