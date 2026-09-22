# Game of Creators Desktop Downloader

Server-side support for the Windows desktop downloader. Brands and admins can download **YouTube** submissions on their machine via a signed `.gocdownload` manifest. Instagram and mixed selections continue to use the existing **cloud** Redis/Vercel ZIP path.

The desktop app source is **not** kept in this monorepo (keeps `main` lean). Distribute the prebuilt Windows installer via `GOC_DOWNLOADER_INSTALL_URL` in `lib/goc-download/config.ts`. Rebuild the app from a separate repo or historical `goc-downloader` branch when you need a new installer.

## Architecture

```
Web UI (BulkVideoDownloadDialog)
  ├─ Desktop (recommended) → POST /api/admin/bulk-download/desktop-manifest
  │                            → signed .gocdownload attachment
  │                            → desktop app downloads via yt-dlp locally
  │                            → POST /api/admin/bulk-download/desktop-status (HMAC)
  └─ Cloud fallback        → POST /api/admin/bulk-download (unchanged)
```

Shared item resolution lives in `lib/bulk-download-resolve-items.ts` so cloud and desktop agree on ownership, filenames, and selection order. Cloud **skips** rejected items; desktop is **strict** (any rejection fails the request).

Manifest crypto:

1. Build unsigned payload (`lib/goc-download/build-manifest.ts`)
2. Canonicalize with RFC 8785 / JCS subset (`lib/goc-download/canonicalize.ts`) — Rust mirrors with `serde_jcs`
3. Sign with Ed25519 (`lib/goc-download/sign.ts`)
4. Desktop verifies signature, then downloads; status callbacks never accept media bytes

Fixed cross-language vector: `lib/goc-download/test-vector.ts`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED` | no | Set `true` to show “Download on this computer” in the UI |
| `NEXT_PUBLIC_GOC_DOWNLOADER_INSTALL_URL` | no | *(Unused)* Installer URL is hardcoded in `lib/goc-download/config.ts` (`GOC_DOWNLOADER_INSTALL_URL`) |
| `NEXT_PUBLIC_CLOUD_DOWNLOAD_FALLBACK_ENABLED` | no | Default on; set `false` to hide cloud option when desktop is enabled |
| `GOC_DOWNLOAD_SIGNING_PRIVATE_KEY` | yes (desktop) | Ed25519 PKCS8 PEM private key (escape newlines as `\n` in env) |
| `GOC_DOWNLOAD_SIGNING_KEY_ID` | yes (desktop) | Key id embedded in manifests; must match a public key shipped in the desktop app |
| `GOC_DOWNLOAD_STATUS_HMAC_SECRET` | yes (desktop) | Dedicated HMAC secret for status tokens (≥32 chars) — **do not reuse `CRON_SECRET`** |
| `GOC_DOWNLOAD_MANIFEST_TTL_SECONDS` | no | Manifest expiry window (default `3600`) |

Desktop v1 limits: at most **100** videos per `.gocdownload` manifest. HTTPS YouTube URLs only.

### Release notes (manual production key/signing)

1. Generate a production Ed25519 keypair; store the private key in Vercel as `GOC_DOWNLOAD_SIGNING_PRIVATE_KEY` and set `GOC_DOWNLOAD_SIGNING_KEY_ID`.
2. Ship the matching public key inside the Windows installer build (key id must match `GOC_DOWNLOAD_SIGNING_KEY_ID`, e.g. `prod-1`).
3. The Windows NSIS setup `.exe` is linked from `GOC_DOWNLOADER_INSTALL_URL` in `lib/goc-download/config.ts` (currently a public Drive download). Update that constant when you ship a new installer.

### Generating a signing key (OpenSSL)

```bash
openssl genpkey -algorithm Ed25519 -out goc-download-ed25519.pem
# Store PEM contents in GOC_DOWNLOAD_SIGNING_PRIVATE_KEY (Vercel/env vault).
# Distribute only the public key to the desktop app / release config.
```

## Database

Apply `db/migrations/20260905_bulk_video_download_desktop.sql`:

- `bulk_video_download_jobs.source` ∈ (`cloud`, `desktop`), default `cloud`
- optional `delivery_mode`
- `bulk_video_download_desktop_events` for idempotent status `eventId`s (service role only)

## Security model

- Manifests are session-auth’d at creation (`verifyAdminOrBrandDownloadAccess`)
- Ownership enforced via shared resolver + contest submission checks
- Status endpoint uses Bearer HMAC token scoped to `{purpose, jobId, userId, exp}` — not cookies
- Status events are metadata-only and idempotent; terminal job states never regress
- Filenames must pass Windows path-safety checks; YouTube hosts are exact-match only

## Rollout / feature flags

1. Ship migration + server code with flags **off**
2. Configure signing key + status HMAC in staging
3. Set `NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED=true` for internal users
4. Publish installer URL; enable for all brands when desktop app is stable
5. Keep cloud fallback enabled until desktop coverage is sufficient

## Rollback to cloud

1. Set `NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED=false` (UI hides desktop path immediately)
2. Optionally set `NEXT_PUBLIC_CLOUD_DOWNLOAD_FALLBACK_ENABLED=true` (default)
3. Existing cloud `/api/admin/bulk-download` path remains intact — no Redis queue changes required
4. Desktop jobs already in flight can finish reporting status until tokens expire

## Local scripts

```bash
npm run test:goc-download
# or:
npx --yes tsx --test lib/bulk-download-resolve-items.test.ts lib/goc-download/*.test.ts
```

Desktop app builds are out of this repo. Use the hosted installer for QA.
