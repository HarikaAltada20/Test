# Setup Checklist - Payout Processor & Twitter Metrics Queue

This checklist verifies that both systems are properly configured and working.

## ✅ 1. Payout Processor (`/api/jobs/process-payouts`)

### Current Status
- ✅ Route exists: `app/api/jobs/process-payouts/route.ts`
- ✅ Uses `CRON_SECRET` for authentication
- ⚠️ **QStash schedule is PAUSED** (from Upstash Console image)
- ⚠️ Route only accepts `GET` requests (QStash schedules typically use `POST`)

### Required Configuration

#### A. QStash Schedule Setup
**Action Required**: Unpause and verify the QStash schedule in [Upstash Console](https://console.upstash.com/qstash) → Schedules:

1. **Schedule Details**:
   - **URL**: `https://www.gameofcreators.com/api/jobs/process-payouts`
   - **Method**: `GET` (or update route to accept `POST`)
   - **Schedule**: `* * * * *` (every minute)
   - **Headers**: 
     ```
     Authorization: Bearer T4zLg6xWvR7nY9sKbQfA8hC1eU3jM5dP0iB2oG6kVZ7xYJqD
     ```
   - **Status**: Must be **ACTIVE** (currently paused)

2. **Verify Schedule**:
   - Go to Upstash Console → QStash → Schedules
   - Find `www.gameofcreators.com/api/jobs/process-payouts`
   - Click to **unpause** if paused
   - Verify "Next Run" shows a future timestamp
   - Check "Last Run" to confirm recent executions

#### B. Route Compatibility Issue
**Issue**: QStash schedules typically send `POST` requests, but your route only accepts `GET`.

**Options**:
1. **Option 1 (Recommended)**: Update QStash schedule to use `GET` method
   - In Upstash Console → Schedules → Edit schedule
   - Change method to `GET`
   - Add header: `Authorization: Bearer ${CRON_SECRET}`

2. **Option 2**: Update route to accept both `GET` and `POST`
   ```typescript
   // In app/api/jobs/process-payouts/route.ts
   export async function GET(request: Request) { /* ... */ }
   export async function POST(request: Request) { 
     // Same logic as GET
     return GET(request);
   }
   ```

#### C. Environment Variables
Verify these are set in Vercel (Production):
- ✅ `CRON_SECRET` - Should be set (check `.env` file)

### Verification Steps
1. **Check QStash Logs**:
   - Go to Upstash Console → QStash → Logs
   - Filter for `/api/jobs/process-payouts`
   - Verify messages show status **DELIVERED** (not FAILED or RETRY)
   - Check response status is `200` (not `401` or `405`)

2. **Check Application Logs**:
   - Look for calls to `/api/jobs/process-payouts`
   - Verify jobs are being processed (check `payout_jobs` table)

3. **Test Manually**:
   ```bash
   curl -X GET https://www.gameofcreators.com/api/jobs/process-payouts \
     -H "Authorization: Bearer T4zLg6xWvR7nY9sKbQfA8hC1eU3jM5dP0iB2oG6kVZ7xYJqD"
   ```
   Should return `{"message":"No queued jobs"}` or `{"processed":N,"results":[...]}`

---

## ✅ 2. Twitter Metrics Refresh Queue (`/api/cron/process-metrics-queue`)

### Current Status
- ✅ Route exists: `app/api/cron/process-metrics-queue/route.ts`
- ✅ Supports QStash signature verification
- ✅ Supports `CRON_SECRET` fallback
- ✅ Jobs are enqueued to Redis (`metrics_refresh:queue`)
- ✅ QStash triggers are called after enqueueing

### Required Configuration

#### A. Environment Variables
Verify these are set in Vercel (Production):
- ✅ `UPSTASH_REDIS_REST_URL` - Redis REST API URL
- ✅ `UPSTASH_REDIS_REST_TOKEN` - Redis REST API token
- ✅ `QSTASH_TOKEN` - QStash publish token
- ✅ `QSTASH_CURRENT_SIGNING_KEY` - QStash signing key (for verification)
- ✅ `QSTASH_NEXT_SIGNING_KEY` - QStash next signing key (for key rotation)
- ✅ `CRON_SECRET` - Fallback auth (optional but recommended)
- ✅ `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` - Base URL for QStash signature verification

**From your `.env`**:
```
UPSTASH_REDIS_REST_URL="https://famous-grouse-47996.upstash.io"
UPSTASH_REDIS_REST_TOKEN="Abt8AAIncDIyODJiMWY0MDNhYmM0MTRjYTRjZWI5YzhiNTM2MTlmN3AyNDc5OTY"
QSTASH_TOKEN="eyJVc2VySUQiOiJlMTEzYjg2MS1jOTNhLTRjYTYtOTlmNi01ZDNmOTkzMGE1OGQiLCJQYXNzd29yZCI6IjBkODk1NDZmYmRiZjQzN2I5ZWYwZmE2OTRmMjA1Zjg2In0="
QSTASH_CURRENT_SIGNING_KEY="sig_81dXBFcgny5vtVak9Wtm1unzsaVS"
QSTASH_NEXT_SIGNING_KEY="sig_4hs8sPjkDiqGTtVKXWNHFZL7KDnz"
CRON_SECRET=T4zLg6xWvR7nY9sKbQfA8hC1eU3jM5dP0iB2oG6kVZ7xYJqD
NEXT_PUBLIC_APP_URL="https://www.gameofcreators.com"
```

#### B. QStash Configuration
**No schedule needed** - This uses **event-driven** QStash (not scheduled):
- Jobs are enqueued to Redis
- `triggerProcessMetricsQueue()` publishes to QStash
- QStash calls `/api/cron/process-metrics-queue` immediately
- Processor pops one job, processes it, and triggers QStash again if more batches exist

**Verify**:
- QStash is configured for **publishing** (not scheduling)
- No schedule should exist for `/api/cron/process-metrics-queue` in QStash → Schedules

#### C. Redis Queue
**Verify Redis is accessible**:
1. Go to [Upstash Console](https://console.upstash.com/) → Redis
2. Open database: `famous-grouse-47996`
3. Go to **Data Browser**
4. Look for keys:
   - `metrics_refresh:queue` - Should be empty most of the time (jobs are popped quickly)
   - `metrics_refresh:state:{contestId}` - Should exist during active refresh (TTL: 2 hours)

### Verification Steps

#### 1. Check QStash Logs (Event-Driven)
- Go to Upstash Console → QStash → **Logs** (not Schedules)
- Filter for `/api/cron/process-metrics-queue`
- Trigger a refresh on a Twitter contest
- Verify messages appear with status **DELIVERED**
- Check response status is `200`

#### 2. Check Application Logs
When you click "Refresh" on a Twitter contest, you should see:
```
[metrics-refresh-queue] Enqueued job contestId=... (Redis)
[refresh-metrics] QStash trigger sent messageId=...
[process-metrics-queue] Invoked by QStash
[process-metrics-queue] Processing job contestId=...
```

If you see `Invoked by CRON/direct` instead of `Invoked by QStash`, QStash is not being used (fallback to direct POST).

#### 3. Test Queue Functionality
1. **Trigger a refresh** on a Twitter contest (from opportunities or brand dashboard)
2. **Check Redis**:
   ```bash
   # In Upstash Console → Redis → Data Browser
   # Look for: metrics_refresh:queue
   # Should see job briefly, then it gets popped
   ```
3. **Check QStash Logs**:
   - Should see messages to `/api/cron/process-metrics-queue`
   - Status should be **DELIVERED**
4. **Check metrics update**:
   - Contest `last_metrics_updated` should update
   - Tweet metrics should refresh

#### 4. Verify Signature Verification
If you get `401 Unauthorized` from QStash:
- Check `NEXT_PUBLIC_APP_URL` matches the URL QStash is calling
- Verify `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` match Upstash Console
- Check that the route receives `Upstash-Signature` header

---

## 🔍 3. Common Issues & Solutions

### Issue: Payout Processor Not Running
**Symptoms**:
- `total_submissions_won` and `total_contests_won` not updating
- Payout jobs stuck in `queued` status

**Solutions**:
1. **Unpause QStash schedule** (most likely issue from image)
2. **Verify schedule method** matches route (`GET` vs `POST`)
3. **Check `CRON_SECRET`** matches in QStash header and environment
4. **Check QStash Logs** for delivery failures
5. **Manual test**: Call endpoint directly with `curl` to verify route works

### Issue: Twitter Metrics Queue Not Processing
**Symptoms**:
- Refresh button shows "queued" but metrics never update
- No logs from `process-metrics-queue`

**Solutions**:
1. **Check Redis connection**:
   - Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are correct
   - Test Redis connection in Upstash Console

2. **Check QStash publishing**:
   - Verify `QSTASH_TOKEN` is set
   - Check logs for `QStash trigger sent messageId=...`
   - If missing, QStash is not configured or token is invalid

3. **Check QStash delivery**:
   - Go to QStash → Logs
   - Look for messages to `/api/cron/process-metrics-queue`
   - If status is FAILED, check response body for error

4. **Check signature verification**:
   - If `401 Unauthorized`, verify signing keys match Upstash Console
   - Verify `NEXT_PUBLIC_APP_URL` matches the URL QStash calls

5. **Fallback test**:
   - Temporarily remove `QSTASH_TOKEN` to test direct POST fallback
   - Should see `Invoked by CRON/direct` in logs

### Issue: Both Systems Using Same QStash Token
**Current Setup**:
- ✅ Both systems can use the same QStash account/token
- ✅ Different endpoints (`/api/jobs/process-payouts` vs `/api/cron/process-metrics-queue`)
- ✅ Different trigger mechanisms (schedule vs event-driven)

**No conflict** - This is fine!

---

## 📋 Quick Verification Checklist

### Payout Processor
- [ ] QStash schedule exists for `/api/jobs/process-payouts`
- [ ] Schedule is **ACTIVE** (not paused)
- [ ] Schedule method matches route (`GET` or update route to accept `POST`)
- [ ] Schedule includes `Authorization: Bearer ${CRON_SECRET}` header
- [ ] Schedule runs every minute (`* * * * *`)
- [ ] QStash Logs show **DELIVERED** status
- [ ] Application logs show payout jobs being processed
- [ ] `payout_jobs` table shows jobs moving from `queued` → `done`

### Twitter Metrics Queue
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
- [ ] `QSTASH_TOKEN` is set
- [ ] `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are set
- [ ] `NEXT_PUBLIC_APP_URL` is set to `https://www.gameofcreators.com`
- [ ] Redis is accessible (check Upstash Console)
- [ ] QStash Logs show messages to `/api/cron/process-metrics-queue` with **DELIVERED** status
- [ ] Application logs show `Invoked by QStash` (not `CRON/direct`)
- [ ] Metrics refresh completes successfully when triggered

---

## 🚨 Immediate Action Items

Based on the QStash Console image:

1. **URGENT**: Unpause the QStash schedule for `/api/jobs/process-payouts`
   - This is preventing payout processing and metric updates

2. **Verify**: Check if schedule uses `GET` or `POST` method
   - If `POST`, update route to accept `POST` or change schedule to `GET`

3. **Test**: After unpausing, check QStash Logs to verify delivery

4. **Monitor**: Check `payout_jobs` table to confirm jobs are processing

---

## 📚 Related Documentation

- [METRICS_FIX_README.md](./METRICS_FIX_README.md) - Payout processor and metrics update logic
- [QSTASH_METRICS_QUEUE.md](./QSTASH_METRICS_QUEUE.md) - Twitter metrics queue with QStash
- [UPSTASH_REDIS_ENV.md](./UPSTASH_REDIS_ENV.md) - Redis environment variables
- [PAYOUT_SYSTEM_ARCHITECTURE.md](./PAYOUT_SYSTEM_ARCHITECTURE.md) - Payout system overview
