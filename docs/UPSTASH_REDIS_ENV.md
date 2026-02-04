# Upstash Redis — Environment Variables

This doc lists what to add to your `.env` (and Vercel Environment Variables) so the **metrics refresh queue** works. The queue uses **Upstash Redis** to run Twitter metrics refresh in the background and avoid Vercel timeouts.

---

## Required for the queue

| Variable | Description | Example (do not commit real values) |
|----------|-------------|--------------------------------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token (password) | `AXxxxx...` |

**If either is missing:** the app falls back to **sync** refresh (no queue). Large Twitter campaigns may hit Vercel timeouts.

---

## Where to get Upstash values

1. Go to [Upstash Console](https://console.upstash.com/).
2. Create or open a **Redis** database.
3. Open the database → **REST API** (or **Details**).
4. Copy:
   - **UPSTASH_REDIS_REST_URL** — the REST URL (e.g. `https://xxx-xxx.upstash.io`).
   - **UPSTASH_REDIS_REST_TOKEN** — the token shown there (sometimes labeled as password).

Use the same names in your env: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

---

## Optional but recommended (cron worker)

| Variable | Description | Example |
|----------|-------------|---------|
| `CRON_SECRET` | Secret used to authorize the cron job and internal API calls from the queue worker | Any long random string |

- The cron route `/api/cron/process-metrics-queue` checks `Authorization: Bearer <CRON_SECRET>`.
- The worker also sends this header when calling `fetch-raid-engagements` and `twitter-refresh-tweets`.
- **If `CRON_SECRET` is set:** requests without the correct header get `401 Unauthorized`.
- **If unset:** auth is skipped (less secure).

---

## Optional (base URL for cron)

| Variable | Description | When it’s used |
|----------|-------------|----------------|
| `VERCEL_URL` | Set automatically by Vercel (e.g. `your-app.vercel.app`) | Cron worker uses `https://${VERCEL_URL}` to call your API. |
| `NEXT_PUBLIC_APP_URL` | Your app’s public URL | Used if `VERCEL_URL` is not set (e.g. self-hosted or local). |

You usually **don’t need to set these manually** on Vercel; `VERCEL_URL` is provided. For local or custom hosting, set `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000` or `https://your-domain.com`).

---

## Example `.env` (local)

```env
# Upstash Redis (required for metrics queue)
UPSTASH_REDIS_REST_URL=https://xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Cron auth (recommended)
CRON_SECRET=your_long_random_secret

# Only if not using Vercel (e.g. local)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do **not** commit real values to git. Add `.env` to `.gitignore` and use Vercel (or your host) Environment Variables for production.

---

## Vercel: where to add them

1. **Vercel Dashboard** → your project → **Settings** → **Environment Variables**.
2. Add each variable:
   - **Key:** e.g. `UPSTASH_REDIS_REST_URL`
   - **Value:** paste from Upstash (or your secret)
   - **Environments:** Production, Preview, Development (as needed).
3. Redeploy so new env vars are applied.

---

## Quick check

- **Queue enabled:** The app uses `isMetricsQueueEnabled()` which is true only when both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
- **Logs:** If Redis is missing, you’ll see warnings like `[metrics-refresh-queue] UPSTASH_REDIS_REST_URL is missing` and refresh will run in sync mode.

See also: [METRICS_REFRESH_QUEUE.md](./METRICS_REFRESH_QUEUE.md) for how the queue and cron work.
