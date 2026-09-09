#!/usr/bin/env node
/**
 * Download pinned Windows sidecars and verify every archive with SHA-256.
 * Sources: official yt-dlp and Deno releases, and Gyan's FFmpeg release build.
 */

import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const checksumsPath = join(__dirname, "sidecar-checksums.json");
const binariesDir = join(root, "src-tauri", "binaries");
const cacheDir = join(root, ".sidecar-cache");
const target = "x86_64-pc-windows-msvc";

async function download(url, destination) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`Downloading ${url}`);
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "goc-downloader-sidecar-fetch/1" },
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
      return;
    } catch (error) {
      rmSync(destination, { force: true });
      if (attempt === 5) throw error;
      console.warn(`Download failed (attempt ${attempt}/5); retrying...`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function verify(path, expected) {
  const actual = sha256(path);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    rmSync(path, { force: true });
    throw new Error(
      `SHA-256 mismatch for ${path}\nexpected ${expected}\nactual   ${actual}`,
    );
  }
  console.log(`Verified ${path} (${actual})`);
}

async function acquire(url, destination, expectedSha256) {
  if (
    existsSync(destination) &&
    sha256(destination).toLowerCase() === expectedSha256.toLowerCase()
  ) {
    console.log(`Using verified cached file ${destination}`);
    return;
  }
  await download(url, destination);
  verify(destination, expectedSha256);
}

function expandZip(zipPath, destination) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  const quote = (value) => `'${value.replaceAll("'", "''")}'`;
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath ${quote(zipPath)} -DestinationPath ${quote(destination)} -Force`,
    ],
    { stdio: "inherit" },
  );
}

function findFile(rootDir, filename) {
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const path = join(rootDir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
      return path;
    }
    if (entry.isDirectory()) {
      const nested = findFile(path, filename);
      if (nested) return nested;
    }
  }
  return null;
}

function install(source, name) {
  if (!source || !existsSync(source)) {
    throw new Error(`Could not locate ${name}`);
  }
  // Unsuffixed copy is used by `tauri dev`; target-suffixed copy is required
  // by Tauri externalBin packaging.
  copyFileSync(source, join(binariesDir, `${name}.exe`));
  copyFileSync(source, join(binariesDir, `${name}-${target}.exe`));
  console.log(`Installed ${name}`);
  return sha256(join(binariesDir, `${name}.exe`));
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("This fetcher currently supports Windows x64 only");
  }
  const config = JSON.parse(readFileSync(checksumsPath, "utf8"));
  mkdirSync(binariesDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  const binaryHashes = {};

  const yt = config.downloads.ytDlp;
  const ytPath = join(cacheDir, "yt-dlp.exe");
  await acquire(yt.url, ytPath, yt.sha256);
  binaryHashes["yt-dlp"] = { sha256: install(ytPath, "yt-dlp") };

  const deno = config.downloads.deno;
  const denoZip = join(cacheDir, "deno.zip");
  await acquire(deno.url, denoZip, deno.sha256);
  const denoDir = join(cacheDir, "deno");
  expandZip(denoZip, denoDir);
  binaryHashes.deno = { sha256: install(findFile(denoDir, "deno.exe"), "deno") };

  const ffmpeg = config.downloads.ffmpeg;
  const ffmpegZip = join(cacheDir, "ffmpeg.zip");
  await acquire(ffmpeg.url, ffmpegZip, ffmpeg.sha256);
  const ffmpegDir = join(cacheDir, "ffmpeg");
  expandZip(ffmpegZip, ffmpegDir);
  binaryHashes.ffmpeg = {
    sha256: install(findFile(ffmpegDir, "ffmpeg.exe"), "ffmpeg"),
  };
  binaryHashes.ffprobe = {
    sha256: install(findFile(ffmpegDir, "ffprobe.exe"), "ffprobe"),
  };

  const binaryManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    notes: "SHA-256 of installed Windows x64 sidecar executables (not archives).",
    binaries: binaryHashes,
  };
  const binaryManifestPath = join(binariesDir, "sidecar-checksums.json");
  const resourcesManifestPath = join(
    root,
    "src-tauri",
    "resources",
    "sidecar-checksums.json",
  );
  mkdirSync(join(root, "src-tauri", "resources"), { recursive: true });
  const json = `${JSON.stringify(binaryManifest, null, 2)}\n`;
  writeFileSync(binaryManifestPath, json);
  writeFileSync(resourcesManifestPath, json);
  // Keep scripts/sidecar-checksums.json archive pins; merge binary hashes for diagnostics.
  config.binaries = binaryHashes;
  writeFileSync(checksumsPath, `${JSON.stringify(config, null, 2)}\n`);

  console.log("\nAll sidecars downloaded and verified.");
  console.log(`Installed in: ${binariesDir}`);
  console.log(`Binary checksums written to ${binaryManifestPath}`);
}

main().catch((error) => {
  console.error(`\nSidecar installation failed: ${error.message}`);
  process.exitCode = 1;
});
