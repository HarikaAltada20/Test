/**
 * Strict Windows-safe filename / archive-name validation for desktop manifests.
 * Rejects traversal, absolute paths, ADS, reserved device names, and control chars.
 */

const RESERVED_DEVICE_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

const UNSAFE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/;

export type PathSafetyResult =
  | { ok: true; name: string }
  | { ok: false; reason: string };

function baseNameWithoutExt(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return name;
  return name.slice(0, i);
}

/**
 * Validate a single path segment intended as a download filename or ZIP name.
 * Must be a bare filename (no directories).
 */
export function assertSafeWindowsFilename(raw: unknown): PathSafetyResult {
  return assertSafeDownloadFilename(raw);
}

export function assertSafeDownloadFilename(raw: unknown): PathSafetyResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Filename must be a string" };
  }
  const name = raw;
  if (!name || !name.trim()) {
    return { ok: false, reason: "Filename is empty" };
  }
  if (name !== name.trim()) {
    return { ok: false, reason: "Filename has leading/trailing whitespace" };
  }
  if (name.length > 240) {
    return { ok: false, reason: "Filename exceeds 240 characters" };
  }
  if (name.includes("\0")) {
    return { ok: false, reason: "Filename contains NUL" };
  }
  if (/[/\\]/.test(name)) {
    return { ok: false, reason: "Filename must not contain path separators" };
  }
  if (name.includes("..")) {
    return { ok: false, reason: "Filename must not contain .." };
  }
  if (/^[a-zA-Z]:/.test(name) || name.startsWith("\\\\")) {
    return { ok: false, reason: "Absolute paths are not allowed" };
  }
  // NTFS alternate data stream marker
  if (name.includes(":")) {
    return { ok: false, reason: "Filename must not contain colon (ADS)" };
  }
  if (UNSAFE_CHARS.test(name)) {
    return { ok: false, reason: "Filename contains unsafe characters" };
  }
  if (/[. ]$/.test(name)) {
    return { ok: false, reason: "Filename must not end with dot or space" };
  }
  const stem = baseNameWithoutExt(name).toUpperCase();
  if (
    RESERVED_DEVICE_NAMES.has(stem) ||
    RESERVED_DEVICE_NAMES.has(name.toUpperCase())
  ) {
    return { ok: false, reason: `Reserved Windows device name: ${stem}` };
  }
  return { ok: true, name };
}

export function isSafeDownloadFilename(raw: unknown): boolean {
  return assertSafeDownloadFilename(raw).ok;
}

export function isSafeWindowsFilename(raw: unknown): boolean {
  return isSafeDownloadFilename(raw);
}
