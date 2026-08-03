# Instagram download cookies (production)

## Why cookies “work once” then fail

Instagram **rotates / invalidates `sessionid`** when:

1. You keep using the **same account in a browser** after exporting cookies
2. Downloads run from **cloud IPs** (Vercel) while the browser session is still active
3. Concurrent serverless requests shared one `/tmp/instagram_cookies.txt` file (fixed)
4. Rotated cookies were **not saved** anywhere durable (fixed via DB)

Local works more often because your IP/session stay aligned with the browser. Production does not.

There is **no forever cookie**. Cookie scraping is inherently temporary. What we can do is make sessions last much longer and make refresh easy.

## Permanent ops workflow (required)

1. Create a **dedicated Instagram account** used only for server downloads (not your personal/admin IG).
2. Log into that account once in a browser → export Netscape `cookies.txt` (e.g. “Get cookies.txt LOCALLY”).
3. **Immediately log out of that account in the browser** (or stop using it entirely).  
   If you stay logged in, Instagram rotates `sessionid` and production dies after ~1 download.
4. Upload cookies (no redeploy needed):

```http
PUT /api/admin/instagram-cookies
Content-Type: application/json

{ "cookies": "<full Netscape cookies.txt content>", "note": "refresh 2026-08-03" }
```

Or set `INSTAGRAM_COOKIES` env (seed). Live rotated cookies are stored in Supabase table `instagram_download_cookies`.

5. Apply migration if not already applied:

`SUPABASE/migrations/20260803_instagram_download_cookies.sql`

6. Verify:

```http
GET /api/admin/instagram-cookies
GET /api/admin/download-reel?checkCookies=true
```

## What the app does now

- Loads cookies from **DB first** (live session), then env/file seed
- Writes a **unique temp cookie file per request** (no serverless race)
- After a successful download, **persists cookies yt-dlp refreshed** back to DB
- Admin can **hot-swap cookies** via `PUT /api/admin/instagram-cookies` without redeploy
- Avoids a hardcoded mismatched User-Agent that often invalidates Instagram sessions

## Env formatting note

`INSTAGRAM_COOKIES` must be a valid Netscape cookie file (real newlines, or base64 of that file). Include `sessionid` and `csrftoken` for `instagram.com`.

## When to refresh

- Auth / “cookies expired” errors
- After password / security / logout on the dedicated account
- Preventive: every few weeks if downloads are heavy

## Empty media response (cookies look valid)

If logs show `valid: true` / `hasSessionId: true` but yt-dlp says **empty media response**, Instagram rejected the session or fingerprint — not a missing cookie file.

Fix:
1. Redeploy (build now always pulls latest `yt-dlp_linux` with impersonation support)
2. Re-export cookies from the **dedicated** account and `PUT /api/admin/instagram-cookies`
3. Do not stay logged into that account in a browser
4. Confirm the reel opens for that same account

Downloads now try `cookies + --impersonate chrome`, then fall back to cookies-only.
