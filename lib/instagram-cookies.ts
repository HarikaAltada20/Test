import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import { readFile, unlink, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { createAdminClient } from "@/utils/supabase/admin";

export type CookieSource = "db" | "env" | "file" | null;

export interface CookieStatus {
  exists: boolean;
  path: string | null;
  source: CookieSource;
  valid: boolean;
  expired: boolean;
  hasSessionId: boolean;
  hasCsrfToken: boolean;
  expiresSoon: boolean;
  lastModified: Date | null;
  error?: string;
  debug?: {
    envLength: number;
    totalFileLines: number;
    nonCommentLines: number;
    sampleFirstLine?: string;
    detectedCookies: string[];
  };
}

export interface PreparedCookies {
  path: string | null;
  source: CookieSource;
  contentHash: string | null;
  cleanup: () => Promise<void>;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function extractSessionId(content: string): string | null {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    let parts = trimmed.split("\t");
    if (parts.length < 7) parts = trimmed.split(/\s+/);
    if (parts.length < 7) continue;
    if (parts[5] === "sessionid" && parts.slice(6).join(" ").length > 10) {
      return parts.slice(6).join(" ");
    }
  }
  return null;
}

/** Normalize Netscape cookies (base64, literal \\n/\\t, space-separated columns). */
export function normalizeNetscapeCookies(rawCookies: string): string {
  let content = rawCookies.trim();

  if (
    (content.startsWith('"') && content.endsWith('"')) ||
    (content.startsWith("'") && content.endsWith("'"))
  ) {
    content = content.slice(1, -1).trim();
  }

  if (!content.includes("\n") && !content.includes("\\n") && content.length > 50) {
    try {
      const decoded = Buffer.from(content, "base64").toString("utf-8");
      if (
        decoded.includes("instagram.com") ||
        decoded.includes("youtube.com") ||
        decoded.includes("# Netscape")
      ) {
        content = decoded;
      }
    } catch {
      // Not base64
    }
  }

  content = content.replace(/\\+n/g, "\n");
  content = content.replace(/\\+t/g, "\t");

  const lines = content.split("\n");
  const normalized = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    let parts = trimmed.split("\t");
    if (parts.length < 7) {
      parts = trimmed.split(/\s+/);
    }

    if (parts.length >= 7) {
      const domain = parts[0];
      const subdomains = parts[1];
      const path = parts[2];
      const secure = parts[3];
      const expiry = parts[4];
      const name = parts[5];
      const value = parts.slice(6).join(" ");
      return `${domain}\t${subdomains}\t${path}\t${secure}\t${expiry}\t${name}\t${value}`;
    }
    return line;
  });

  return normalized.join("\n");
}

async function loadCookiesFromDb(): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("instagram_download_cookies")
      .select("cookies_netscape")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      // Table may not exist yet — fall back to env/file.
      console.warn("[ig-cookies] DB load skipped:", error.message);
      return null;
    }
    const raw = data?.cookies_netscape?.trim();
    return raw ? normalizeNetscapeCookies(raw) : null;
  } catch (err: any) {
    console.warn("[ig-cookies] DB load failed:", err?.message || err);
    return null;
  }
}

async function loadCookiesFromEnvOrFile(): Promise<{
  content: string | null;
  source: CookieSource;
}> {
  const rawIgEnv = process.env.INSTAGRAM_COOKIES;
  if (rawIgEnv?.trim()) {
    return {
      content: normalizeNetscapeCookies(rawIgEnv),
      source: "env",
    };
  }

  const localIgFile = join(process.cwd(), "instagram_cookies.txt");
  const localCookieFile = join(process.cwd(), "cookies.txt");
  if (existsSync(localIgFile)) {
    return { content: await readFile(localIgFile, "utf-8"), source: "file" };
  }
  if (existsSync(localCookieFile)) {
    return { content: await readFile(localCookieFile, "utf-8"), source: "file" };
  }
  return { content: null, source: null };
}

/**
 * Write a unique per-request cookie file.
 * Prefer live DB cookies (rotated sessions), then env/file seed.
 */
export async function prepareInstagramCookies(): Promise<PreparedCookies> {
  const dbContent = await loadCookiesFromDb();
  let content = dbContent;
  let source: CookieSource = dbContent ? "db" : null;

  if (!content) {
    const seed = await loadCookiesFromEnvOrFile();
    content = seed.content;
    source = seed.source;

    // Seed DB once so refreshes can persist across serverless instances.
    if (content) {
      await upsertInstagramCookies(content, "seeded from env/file").catch((err) => {
        console.warn("[ig-cookies] seed upsert skipped:", err?.message || err);
      });
    }
  }

  if (!content?.trim()) {
    return {
      path: null,
      source: null,
      contentHash: null,
      cleanup: async () => {},
    };
  }

  const path = join(tmpdir(), `ig_cookies_${randomUUID()}.txt`);
  await writeFile(path, content, "utf-8");
  const contentHash = hashContent(content);

  return {
    path,
    source,
    contentHash,
    cleanup: async () => {
      await unlink(path).catch(() => {});
    },
  };
}

export async function prepareYouTubeCookies(): Promise<PreparedCookies> {
  const rawYtEnv = process.env.YOUTUBE_COOKIES;
  let content: string | null = null;
  let source: CookieSource = null;

  if (rawYtEnv?.trim()) {
    content = normalizeNetscapeCookies(rawYtEnv);
    source = "env";
  } else {
    const localYtFile = join(process.cwd(), "youtube_cookies.txt");
    if (existsSync(localYtFile)) {
      content = await readFile(localYtFile, "utf-8");
      source = "file";
    }
  }

  if (!content?.trim()) {
    return {
      path: null,
      source: null,
      contentHash: null,
      cleanup: async () => {},
    };
  }

  const path = join(tmpdir(), `yt_cookies_${randomUUID()}.txt`);
  await writeFile(path, content, "utf-8");
  return {
    path,
    source,
    contentHash: hashContent(content),
    cleanup: async () => {
      await unlink(path).catch(() => {});
    },
  };
}

export async function upsertInstagramCookies(
  rawContent: string,
  note?: string,
  updatedBy?: string | null
): Promise<void> {
  const cookies = normalizeNetscapeCookies(rawContent);
  if (!extractSessionId(cookies)) {
    throw new Error("Cookies must include a valid sessionid");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("instagram_download_cookies").upsert(
    {
      id: 1,
      cookies_netscape: cookies,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
      note: note || null,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Failed to save Instagram cookies: ${error.message}`);
  }
}

/**
 * If yt-dlp rotated session cookies in the temp file, persist them for next requests.
 */
export async function persistRefreshedInstagramCookies(
  cookiePath: string | null,
  originalHash: string | null
): Promise<boolean> {
  if (!cookiePath || !existsSync(cookiePath)) return false;

  try {
    const nextContent = await readFile(cookiePath, "utf-8");
    const nextHash = hashContent(nextContent);
    if (originalHash && nextHash === originalHash) return false;

    const nextSession = extractSessionId(nextContent);
    if (!nextSession) return false;

    await upsertInstagramCookies(
      nextContent,
      "auto-refreshed after yt-dlp download"
    );
    console.log("[ig-cookies] Persisted rotated Instagram cookies to DB");
    return true;
  } catch (err: any) {
    console.warn("[ig-cookies] Persist refresh failed:", err?.message || err);
    return false;
  }
}

export async function checkInstagramCookieStatus(
  cookiePath?: string | null,
  source: CookieSource = null
): Promise<CookieStatus> {
  const prepared =
    cookiePath === undefined ? await prepareInstagramCookies() : null;
  const path = cookiePath === undefined ? prepared?.path ?? null : cookiePath;
  const resolvedSource =
    cookiePath === undefined ? prepared?.source ?? null : source;

  const status: CookieStatus = {
    exists: false,
    path: null,
    source: resolvedSource,
    valid: false,
    expired: false,
    hasSessionId: false,
    hasCsrfToken: false,
    expiresSoon: false,
    lastModified: null,
  };

  try {
    if (!path) {
      status.error =
        resolvedSource === null
          ? "No cookies configured. Set INSTAGRAM_COOKIES or upload via admin API."
          : "Cookies file not found";
      return status;
    }

    if (!existsSync(path)) {
      status.error = "Cookies file not found";
      return status;
    }

    status.exists = true;
    status.path = path;

    try {
      const stats = await stat(path);
      status.lastModified = stats.mtime;
    } catch {
      status.error = "Could not read file stats";
      return status;
    }

    const cookieContent = await readFile(path, "utf-8");
    const rawEnv = process.env.INSTAGRAM_COOKIES || "";
    const allLines = cookieContent.split("\n");
    const lines = allLines.filter(
      (line) => line.trim() && !line.startsWith("#")
    );
    const detectedCookieNames: string[] = [];

    status.debug = {
      envLength: rawEnv.length,
      totalFileLines: allLines.length,
      nonCommentLines: lines.length,
      sampleFirstLine: lines[0]
        ? lines[0].substring(0, 40) + "..."
        : undefined,
      detectedCookies: detectedCookieNames,
    };

    if (lines.length === 0) {
      status.error = `Cookies file has 0 valid lines (out of ${allLines.length} lines total). Check formatting.`;
      return status;
    }

    const now = Math.floor(Date.now() / 1000);
    let hasValidCookie = false;
    let earliestExpiry = Infinity;

    for (const line of lines) {
      let parts = line.split("\t");
      if (parts.length < 7) parts = line.split("\\t");
      if (parts.length < 7) parts = line.trim().split(/\s+/);
      if (parts.length < 7) continue;

      const domain = parts[0];
      const expiryStr = parts[4];
      const name = parts[5];
      const value = parts[6];

      if (name && !detectedCookieNames.includes(name)) {
        detectedCookieNames.push(name);
      }

      if (domain.includes("instagram.com")) {
        hasValidCookie = true;
        if (name === "sessionid" && value && value.length > 10) {
          status.hasSessionId = true;
        }
        if (name === "csrftoken" && value && value.length > 5) {
          status.hasCsrfToken = true;
        }

        const expiry = parseInt(expiryStr, 10);
        if (!isNaN(expiry) && expiry > 0) {
          if (expiry < earliestExpiry) earliestExpiry = expiry;
          if (expiry < now) status.expired = true;
        }
      }
    }

    status.valid =
      hasValidCookie && status.hasSessionId && status.hasCsrfToken;

    if (earliestExpiry !== Infinity) {
      const daysUntilExpiry = (earliestExpiry - now) / (24 * 60 * 60);
      status.expiresSoon = daysUntilExpiry > 0 && daysUntilExpiry < 7;
    }

    if (!hasValidCookie) {
      status.error = "No Instagram cookies found in file";
    } else if (!status.hasSessionId) {
      status.error = "Missing sessionid cookie (most important)";
    } else if (!status.hasCsrfToken) {
      status.error = "Missing csrftoken cookie";
    }
  } catch (error: any) {
    status.error = `Error reading cookies: ${error.message}`;
  } finally {
    if (prepared) await prepared.cleanup();
  }

  return status;
}

export type InstagramYtDlpMode = "impersonate" | "cookies-only";

/**
 * Shared yt-dlp options for Instagram.
 * Prefer impersonate+cookies — Instagram blocks bare API calls (empty media response)
 * even when a cookie file is present, unless the TLS fingerprint looks like a browser.
 */
export function instagramYtDlpOptions(
  cookiePath: string | null,
  mode: InstagramYtDlpMode = "impersonate"
): {
  cookies: string | undefined;
  noWarnings: boolean;
  noUpdate: boolean;
  impersonate?: string[];
  additionalOptions: string[];
} {
  const additionalOptions = [
    "--js-runtimes",
    "node",
    "--no-cookies-from-browser",
  ];

  // Keep headers minimal. Custom UA/Accept-Language often causes empty media / 403.
  if (mode === "impersonate") {
    return {
      cookies: cookiePath || undefined,
      noWarnings: true,
      noUpdate: true,
      impersonate: ["chrome"],
      additionalOptions,
    };
  }

  return {
    cookies: cookiePath || undefined,
    noWarnings: true,
    noUpdate: true,
    additionalOptions,
  };
}

/** True when Instagram rejected the request in a way that usually means soft-dead cookies or missing fingerprint. */
export function isInstagramEmptyMediaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("empty media response") ||
    lower.includes("instagram sent an empty media response")
  );
}

export function isImpersonationUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("no impersonate target") ||
    (lower.includes("impersonating") && lower.includes("not supported")) ||
    lower.includes("impersonate target is available")
  );
}

/**
 * Run Instagram yt-dlp with impersonate+cookies, then cookies-only fallback.
 */
export async function runInstagramYtDlpDownload(params: {
  downloadAsync: (url: string, options: Record<string, unknown>) => Promise<unknown>;
  url: string;
  output: string;
  cookiePath: string | null;
  logPrefix?: string;
}): Promise<{ mode: InstagramYtDlpMode }> {
  const { downloadAsync, url, output, cookiePath, logPrefix = "[IG]" } = params;
  const base = { format: "best[ext=mp4]/best", output };

  try {
    console.log(`${logPrefix} Attempt 1: cookies + impersonate chrome`);
    await downloadAsync(url, {
      ...base,
      ...instagramYtDlpOptions(cookiePath, "impersonate"),
    });
    return { mode: "impersonate" };
  } catch (firstError: any) {
    const msg = String(firstError?.message || firstError);
    console.warn(`${logPrefix} Attempt 1 failed: ${msg.slice(0, 300)}`);

    // Always try cookies-only once — impersonation may be missing on older binaries,
    // and empty-media sometimes succeeds on a second fingerprint path.
    console.log(`${logPrefix} Attempt 2: cookies only (no impersonate)`);
    try {
      await downloadAsync(url, {
        ...base,
        ...instagramYtDlpOptions(cookiePath, "cookies-only"),
      });
      return { mode: "cookies-only" };
    } catch (secondError: any) {
      // Prefer the more informative first error when impersonation was the intended path.
      if (
        isImpersonationUnavailableError(msg) ||
        isInstagramEmptyMediaError(String(secondError?.message || ""))
      ) {
        throw secondError;
      }
      throw firstError;
    }
  }
}
