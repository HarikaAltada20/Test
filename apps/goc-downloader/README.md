# Game of Creators Downloader

Windows desktop companion for GoViral — download YouTube media from manual URLs or signed `.gocdownload` manifests.

This package is **standalone** (`apps/goc-downloader`). It has its own `package.json` and lockfile. Do **not** hoist installs to the GoViral repo root.

## Prerequisites

- Node.js 22+
- Rust stable via rustup (MSVC toolchain recommended for Tauri on Windows)
- WebView2 Runtime
- **Visual Studio Build Tools** with the “Desktop development with C++” workload (provides `link.exe`)
- Enough free disk on the drive hosting `%USERPROFILE%\.cargo` / rustup (or set `RUSTUP_HOME` / `CARGO_HOME` / `CARGO_TARGET_DIR` to another drive)

> This machine’s CI image (`windows-latest`) includes MSVC. Local `cargo test` / `tauri build` will fail with `linker link.exe not found` until Build Tools are installed.

## Setup

```bash
cd apps/goc-downloader
npm install
```

### Development keys (manifest verification)

```bash
npm run generate-dev-keys
```

Writes an Ed25519 keypair under `.keys/` (gitignored) and updates `src-tauri/resources/public_keys.json` with the **public** key only.

### Sidecars (yt-dlp, ffmpeg, ffprobe, deno)

Binaries are not committed. Pin versions/checksums in `scripts/sidecar-checksums.json`, then:

```bash
npm run fetch-sidecars
```

The fetch script is a stub in this scaffold (no huge downloads). Place verified binaries in `src-tauri/binaries/` using Tauri `externalBin` naming before `tauri build`.

## Develop

Frontend only:

```bash
npm run dev
```

Full desktop shell:

```bash
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

Produces a per-user NSIS installer (`com.gameofcreators.downloader`).

## Features (scaffold)

- Manual URL / `.txt` import downloads
- Signed `.gocdownload` import (Ed25519 + RFC 8785/JCS)
- Job history (SQLite) with interrupted → resumable recovery
- Settings: destination, concurrency 1–2, quality, ZIP
- Diagnostics: sidecar presence/versions/checksum status
- Deep link scheme: `goc-downloader://`
- File association: `.gocdownload`

## Icons

See `src-tauri/icons/README.md`. Replace placeholders with real Windows `.ico` / PNG sizes before release.

## Tests

```bash
# Frontend
npm test

# Rust unit tests (path safety, URL allowlist, manifest vector, DB recovery)
cd src-tauri
cargo test
```
