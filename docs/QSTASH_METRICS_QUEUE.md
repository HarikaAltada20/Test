# QStash for Metrics Refresh Queue

The metrics refresh queue can be driven by **QStash** instead of a Vercel cron. When QStash is configured, jobs are triggered event-driven (no `* * * * *` cron), with built-in retries and scaling.

---

## Why QStash?

|                | Vercel Cron (every minute) | QStash                              |
| -------------- | -------------------------- | ----------------------------------- |
| **Executions** | Limited (e.g. 100k/month)  | Built for queues and scale          |
| **Trigger**    | Polling every minute       | Event-driven when jobs are enqueued |
| **Retries**    | None                       | Built-in retries on failure         |
| **Spikes**     | Same load every minute     | Smooths traffic, handles spikes     |

With QStash you can scale to 10k–100k+ posts without cron limit pressure.

---

## Architecture with QStash

1. **User clicks “Refresh”** → Job is pushed to Redis → **QStash is triggered** (one message to `/api/cron/process-metrics-queue`).
2. **QStash** calls your API → Route pops one job from Redis and processes it (raid or one Twitter batch).
3. If there are **more batches**, the route enqueues the next job and **triggers QStash again** for the next run.
4. No Vercel cron is needed for `process-metrics-queue`; the `* * * * *` cron has been removed from `vercel.json`.

When QStash is **not** configured, the app falls back to triggering the processor via a direct `POST` after each enqueue (same as before), so existing deployments keep working.

---

## Environment Variables

Add these in Vercel (or your host) and in local `.env` when using QStash:

| Variable                     | Description                 | Where to get it                                                           |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `QSTASH_TOKEN`               | Publish messages to QStash  | [Upstash Console](https://console.upstash.com/qstash) → QStash → REST API |
| `QSTASH_CURRENT_SIGNING_KEY` | Verify requests from QStash | Same → Signing keys                                                       |
| `QSTASH_NEXT_SIGNING_KEY`    | Verify after key rotation   | Same                                                                      |

- **Publishing:** The app uses `QSTASH_TOKEN` to send a message to QStash that triggers `/api/cron/process-metrics-queue`.
- **Verification:** The route accepts requests that carry the `Upstash-Signature` header and verifies them with the signing keys. It also still accepts `Authorization: Bearer CRON_SECRET` for backward compatibility.

If `QSTASH_TOKEN` is not set, the app does not use QStash and instead uses a direct `POST` to the processor (and no cron is configured for the queue).

---

## Recurring: stale contest_stats refresh

`contest_stats` views are refreshed after metrics jobs. Two schedulers run the same safety net:

| Scheduler | Cadence | Role |
| --- | --- | --- |
| **QStash** | every 10 min (`*/10 * * * *`) | Primary |
| **Vercel Cron** | once daily (`25 5 * * *`) | Backup |

- **Endpoint:** `/api/cron/refresh-stale-contest-stats` (default `limit=50`)
- **QStash schedule id:** `goviral-refresh-stale-contest-stats`
- **Auth:** `Upstash-Signature`, `Authorization: Bearer CRON_SECRET`, or `x-vercel-cron`

The QStash schedule is upserted when metrics refresh runs, and on POST to this endpoint. Requires `QSTASH_TOKEN` + public `NEXT_PUBLIC_APP_URL` for the 10-minute path.

To bootstrap QStash manually after deploy:

```bash
curl -X POST "https://your-app.vercel.app/api/cron/refresh-stale-contest-stats" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Optional: Daily Crons via QStash

The daily jobs (`update-youtube-metrics`, `update-instagram-insights`) remain in **Vercel Cron** in `vercel.json` (e.g. once per day). If you prefer to move them to QStash as well:

1. In [Upstash Console](https://console.upstash.com/qstash) → Schedules, create a schedule for each:
   - **YouTube:** `0 1 * * *` (daily 01:00) → `POST https://your-app.vercel.app/api/cron/update-youtube-metrics`
   - **Instagram:** `0 2 * * *` (daily 02:00) → `POST https://your-app.vercel.app/api/cron/update-instagram-insights`
2. Remove those two entries from `vercel.json` if you want zero Vercel crons.

Your API routes must then accept QStash (e.g. verify `Upstash-Signature` or keep `CRON_SECRET` and configure QStash to send `Authorization: Bearer CRON_SECRET`).

---

## Local Mode (QStash CLI)

Local mode connects the **Upstash Console** to a local QStash server so you can view logs and data during development.

1. **Start the local QStash server**

   ```bash
   npx @upstash/qstash-cli@latest dev
   ```

   This runs a local QStash server (default: `http://localhost:8080`).

2. **Connect from Upstash Console**

   - In [Upstash Console](https://console.upstash.com/qstash), enable **Local Mode**.
   - Enter your local QStash server address: `http://localhost:8080`.
   - The console will show **Connection Status** (e.g. "Checking local server..." then connected).

3. **Browser note**

   Some browsers restrict requests to localhost. Chrome and Firefox support localhost requests; Safari may block them by default. Use Chrome or Firefox if the console cannot connect.

When using the local server, configure your app to publish to it (e.g. set `QSTASH_URL` to `http://localhost:8080` if your QStash client supports a custom base URL). Otherwise, use a tunnel (see below) to test against cloud QStash and view logs in the console.

---

## Testing QStash on localhost

QStash cannot call `localhost`, so if you open `http://localhost:3000` and click Refresh, the app uses a direct POST and you see `Invoked by CRON/direct` (no QStash). To **test QStash locally**, expose your app with a **tunnel** so QStash can reach it:

1. **Start a tunnel** (e.g. [ngrok](https://ngrok.com)):

   ```bash
   ngrok http 3000
   ```

   You’ll get a public URL like `https://abc123.ngrok.io`.

2. **Set the public URL in env** so QStash signature verification matches the URL it called (avoids 401 when QStash calls back):

   ```env
   NEXT_PUBLIC_APP_URL=https://abc123.ngrok.io
   ```

   Use your actual ngrok URL; update it when ngrok gives a new one.

3. **Run your app** (e.g. `npm run dev` on port 3000).

4. **Open the app via the tunnel URL** in the browser (e.g. `https://abc123.ngrok.io`), **not** `http://localhost:3000`.

5. **Trigger a refresh** (e.g. click “Refresh” on a contest). The app publishes to QStash with the ngrok URL (from the request host or `NEXT_PUBLIC_APP_URL`). QStash then calls the ngrok URL, which forwards to your local server. Signature verification uses `NEXT_PUBLIC_APP_URL`, so it must match the ngrok URL.

6. **Check:**
   - App logs: `QStash trigger sent messageId=...` and `[process-metrics-queue] Invoked by QStash`.
   - [Upstash Console](https://console.upstash.com/qstash) → **QStash** → **Logs**: messages to `/api/cron/process-metrics-queue` with status **DELIVERED**.

You need `QSTASH_TOKEN` and the signing keys in `.env`. If you get **401** when QStash calls back, set `NEXT_PUBLIC_APP_URL` to your tunnel URL (e.g. `https://abc123.ngrok.io`) so verification matches the URL QStash signed. The free ngrok URL changes each run; paid ngrok can use a fixed subdomain.

---

## How to verify QStash is working

**On localhost (no tunnel):** We never publish to QStash (QStash cannot call `localhost`), so you will always see `Invoked by CRON/direct` and **no messages in Upstash QStash**. The app falls back to a direct POST and the queue still runs. To see QStash in action, use a tunnel (above) or **deploy to Vercel** and trigger “Refresh” from the deployed app.

1. **Logs (your app)**

   - When a trigger is **sent** to QStash successfully, you’ll see:  
     `[refresh-metrics] QStash trigger sent messageId=...` or  
     `[twitter-refresh-feed] QStash trigger sent messageId=...`
   - When the **processor** is **invoked by QStash** (not by a direct POST or cron), you’ll see:  
     `[process-metrics-queue] Invoked by QStash`
   - If you see `Invoked by CRON/direct` instead, the request used `CRON_SECRET` or a direct POST (e.g. **localhost**, or QStash not configured).

2. **Upstash Console**

   - Go to [Upstash Console](https://console.upstash.com/qstash) → **QStash** → **Logs**.
   - You will only see messages here when the app runs on a **public URL** (e.g. Vercel) and triggers a refresh. On localhost there are no QStash messages.
   - Check that messages to your `/api/cron/process-metrics-queue` URL are **DELIVERED** (and not FAILED or RETRY).
   - Failed deliveries will show response status and body for debugging.

3. **Behavior**
   - **Working (production):** After you click “Refresh” on the **deployed** app, metrics update and logs show `QStash trigger sent messageId=...` and later `Invoked by QStash` for each batch; Upstash QStash → Logs shows those messages.
   - **Localhost:** You see `Invoked by CRON/direct` and no QStash logs; queue still works via direct POST.
   - **Not working:** You see `[qstash] triggerProcessMetricsQueue failed: ...` and the app falls back to direct POST; processor logs show `Invoked by CRON/direct`.

---

## Quick check

- **QStash enabled:** `QSTASH_TOKEN` is set → triggers use QStash; `/api/cron/process-metrics-queue` accepts `Upstash-Signature` or `CRON_SECRET`.
- **QStash disabled:** No `QSTASH_TOKEN` → triggers use direct `POST`; no per-minute cron in `vercel.json`.

See also: [UPSTASH_REDIS_ENV.md](./UPSTASH_REDIS_ENV.md) for Redis and [METRICS_REFRESH_QUEUE.md](./METRICS_REFRESH_QUEUE.md) for queue behavior.
