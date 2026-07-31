import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { YtDlp } from "ytdlp-nodejs";
import { readFile, writeFile, unlink, stat, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync, statSync, chmodSync } from "fs";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

// ⭐ Get yt-dlp binary path (bundled for Vercel)
function getYtDlpBinaryPath(): string | undefined {
  const isLinux = process.platform === 'linux';
  if (!isLinux) {
    return undefined;
  }

  const tmpBinary = join(tmpdir(), "yt-dlp");

  if (existsSync(tmpBinary)) {
    try {
      chmodSync(tmpBinary, 0o755);
      return tmpBinary;
    } catch (e) {
      console.warn(`[YTDLP] Warning chmodding ${tmpBinary}:`, e);
    }
  }

  const possiblePaths = [
    join(process.cwd(), "bin", "yt-dlp"),
    join(process.cwd(), "..", "bin", "yt-dlp"),
    join(__dirname, "..", "..", "..", "bin", "yt-dlp"),
  ];

  for (const srcPath of possiblePaths) {
    if (existsSync(srcPath)) {
      try {
        const stats = statSync(srcPath);
        if (stats.isFile()) {
          try {
            const { readFileSync, writeFileSync } = require("fs");
            const binaryBuffer = readFileSync(srcPath);
            writeFileSync(tmpBinary, binaryBuffer);
            chmodSync(tmpBinary, 0o755);
            console.log(`[YTDLP] Copied binary to ${tmpBinary} and set 0755 permissions`);
            return tmpBinary;
          } catch (copyErr: any) {
            console.warn(`[YTDLP] Failed to copy binary to /tmp:`, copyErr);
            return srcPath;
          }
        }
      } catch (err) {
        continue;
      }
    }
  }
  return undefined;
}

// Instagram reliability info & errors parsing (aligned with download-reel)
function parseInstagramError(errorMessage: string): {
  userMessage: string;
  reason: string;
} {
  const errorLower = errorMessage.toLowerCase();
  if (errorLower.includes("empty media response") || errorLower.includes("instagram sent an empty media response")) {
    return {
      userMessage: "This Instagram video is not accessible. The post may be private, deleted, or restricted.",
      reason: "Instagram returned empty media response",
    };
  }
  if (errorLower.includes("instagram api is not granting access") || errorLower.includes("api is not granting access")) {
    return {
      userMessage: "Instagram is blocking access to this video. Authentication may have failed.",
      reason: "Instagram API access denied",
    };
  }
  if (errorLower.includes("rate limit") || errorLower.includes("too many requests") || errorLower.includes("429")) {
    return {
      userMessage: "Too many requests to Instagram. Please wait a few minutes.",
      reason: "Rate limit exceeded",
    };
  }
  return {
    userMessage: "Instagram download failed. The post may be private or restricted.",
    reason: errorMessage,
  };
}

async function checkCookieStatus(): Promise<{ valid: boolean; exists: boolean; path: string | null; error?: string }> {
  await initializeCookies();
  const cookiePath = INSTAGRAM_COOKIES;
  const status = { exists: false, path: null as string | null, valid: false, error: undefined as string | undefined };

  try {
    if (!cookiePath || !existsSync(cookiePath)) {
      status.error = "Cookies file not found";
      return status;
    }
    status.exists = true;
    status.path = cookiePath;

    const cookieContent = await readFile(cookiePath, "utf-8");
    const lines = cookieContent.split("\n").filter((line) => line.trim() && !line.startsWith("#"));

    if (lines.length === 0) {
      status.error = "Cookies file is empty";
      return status;
    }

    let hasValidCookie = false;
    let hasSessionId = false;
    let hasCsrfToken = false;

    for (const line of lines) {
      let parts = line.split("\t");
      if (parts.length < 7) {
        parts = line.split("\\t");
      }
      if (parts.length < 7) {
        parts = line.trim().split(/\s+/);
      }
      if (parts.length < 7) continue;

      const domain = parts[0];
      const name = parts[5];
      const value = parts[6];

      if (domain.includes("instagram.com")) {
        hasValidCookie = true;
        if (name === "sessionid" && value && value.length > 10) {
          hasSessionId = true;
        }
        if (name === "csrftoken" && value && value.length > 5) {
          hasCsrfToken = true;
        }
      }
    }

    status.valid = hasValidCookie && hasSessionId && hasCsrfToken;
    if (!hasValidCookie) status.error = "No Instagram cookies found";
    else if (!hasSessionId) status.error = "Missing sessionid cookie";
    else if (!hasCsrfToken) status.error = "Missing csrftoken cookie";
  } catch (error: any) {
    status.error = error.message;
  }
  return status;
}

function normalizeNetscapeCookies(rawCookies: string): string {
  let content = rawCookies.trim();

  // Strip wrapping quotes if user pasted "..." or '...'
  if (
    (content.startsWith('"') && content.endsWith('"')) ||
    (content.startsWith("'") && content.endsWith("'"))
  ) {
    content = content.slice(1, -1).trim();
  }

  // Auto-detect base64 encoded cookies
  if (!content.includes("\n") && !content.includes("\\n") && content.length > 50) {
    try {
      const decoded = Buffer.from(content, "base64").toString("utf-8");
      if (decoded.includes("instagram.com") || decoded.includes("# Netscape")) {
        content = decoded;
      }
    } catch {
      // Not base64
    }
  }

  if (content.includes("\\n")) {
    content = content.replace(/\\n/g, "\n");
  }

  if (content.includes("\\t")) {
    content = content.replace(/\\t/g, "\t");
  }

  const lines = content.split("\n");
  const normalized = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    if ((line.match(/\t/g) || []).length >= 6) return line;

    const parts = trimmed.split(/\s+/);
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

let INSTAGRAM_COOKIES: string | null = null;
async function initializeCookies(): Promise<void> {
  try {
    if (process.env.INSTAGRAM_COOKIES) {
      const formattedCookies = normalizeNetscapeCookies(process.env.INSTAGRAM_COOKIES);

      const cookiePath = join(tmpdir(), "cookies.txt");
      await writeFile(cookiePath, formattedCookies, "utf-8");
      INSTAGRAM_COOKIES = cookiePath;
    } else {
      const cookiePath = join(tmpdir(), "cookies.txt");
      if (existsSync(cookiePath)) {
        await unlink(cookiePath).catch(() => {});
      }
      INSTAGRAM_COOKIES = null;
    }
  } catch (error: any) {
    console.error("Error initializing cookies:", error.message);
    INSTAGRAM_COOKIES = null;
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

// Single video downloader logic
async function downloadVideoFile(ytdlp: YtDlp, url: string, outputPath: string, isInstagram: boolean): Promise<void> {
  if (isInstagram) {
    await initializeCookies();
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: outputPath,
      cookies: INSTAGRAM_COOKIES || undefined,
    });
  } else {
    await ytdlp.downloadAsync(url, {
      format: "best[ext=mp4]/best",
      output: outputPath,
    });
  }
}

async function verifyAdminOrBrandAccess() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { allowed: false, user: null };
  const { data: userData } = await supabase
    .from("users")
    .select("user_type, email")
    .eq("id", user.id)
    .single();
  const allowed =
    userData?.user_type === "admin" || userData?.user_type === "advertiser";
  return { allowed, user: allowed ? { id: user.id, email: userData?.email, user_type: userData?.user_type } : null };
}

export async function POST(request: Request) {
  const requestId = randomUUID().substring(0, 8);
  const startTime = Date.now();
  const tempDir = join(tmpdir(), `bulk_${randomUUID()}`);

  try {
    // 1. Verify admin or brand access
    const { allowed } = await verifyAdminOrBrandAccess();
    if (!allowed) {
      return NextResponse.json({ error: "Admin or brand access required" }, { status: 403 });
    }

    // 2. Parse request payload
    const body = await request.json().catch(() => ({}));
    const { urls = [], submissionIds = [], options = {} } = body;
    const format = options.format === "audio" ? "mp3" : "mp4";

    const binaryPath = getYtDlpBinaryPath();
    const ytdlp = new YtDlp(binaryPath ? { binaryPath } : undefined);

    // Resolve download items
    const downloadQueue: { url: string; filename: string; isInstagram: boolean }[] = [];

    if (submissionIds && submissionIds.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${submissionIds.length} submission IDs`);
      const supabase = await createClient();
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select(`
          id,
          content_link,
          platform,
          contests(title),
          users!creator_id(username)
        `)
        .in("id", submissionIds);

      if (submissionsError) {
        console.error(`[BULK-${requestId}] Database fetch error:`, submissionsError);
        return NextResponse.json({ error: "Failed to fetch submissions information" }, { status: 500 });
      }

      for (const sub of submissions || []) {
        if (!sub.content_link) continue;
        const username = (sub.users as any)?.username || "unknown";
        const contestTitle = (sub.contests as any)?.title || "contest";
        const cleanName = sanitizeFilename(`${username}_${contestTitle}_${sub.id}`);
        const isInstagram = sub.content_link.includes("instagram.com");

        downloadQueue.push({
          url: sub.content_link,
          filename: `${cleanName}.${format}`,
          isInstagram,
        });
      }
    } else if (urls && urls.length > 0) {
      console.log(`[BULK-${requestId}] Resolving ${urls.length} custom URLs`);
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (!url) continue;
        const isInstagram = url.includes("instagram.com");
        
        let title = "video";
        try {
          const rawTitle = await ytdlp.getTitleAsync(url).catch(() => null);
          if (rawTitle) {
            title = sanitizeFilename(rawTitle);
          }
        } catch {
          // ignore title fetch failure, default to "video"
        }

        downloadQueue.push({
          url,
          filename: `${title}_${i + 1}.${format}`,
          isInstagram,
        });
      }
    }

    if (downloadQueue.length === 0) {
      return NextResponse.json({ error: "No valid URLs or submissions to download" }, { status: 400 });
    }

    // 3. Create temp directory
    await mkdir(tempDir, { recursive: true });

    // 4. Download files sequentially (to avoid overloading local resource limits)
    const zippedFiles: { path: string; name: string }[] = [];
    const failedQueue: { url: string; error: string }[] = [];

    for (const item of downloadQueue) {
      const targetPath = join(tempDir, item.filename);
      try {
        console.log(`[BULK-${requestId}] Downloading: ${item.url} -> ${targetPath}`);
        await downloadVideoFile(ytdlp, item.url, targetPath, item.isInstagram);
        
        if (existsSync(targetPath)) {
          zippedFiles.push({ path: targetPath, name: item.filename });
        } else {
          failedQueue.push({ url: item.url, error: "Download completed but file was not generated." });
        }
      } catch (err: any) {
        console.error(`[BULK-${requestId}] Failed downloading ${item.url}:`, err.message);
        const parsed = parseInstagramError(err.message);
        failedQueue.push({ url: item.url, error: parsed.userMessage });
      }
    }

    // 5. Create stream-based ZIP
    const passthrough = new PassThrough();
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.pipe(passthrough);

    // Add successfully downloaded files to the archive
    for (const file of zippedFiles) {
      archive.file(file.path, { name: file.name });
    }

    // Add failure report if any errors occurred
    if (failedQueue.length > 0) {
      const report = failedQueue
        .map((f, idx) => `${idx + 1}. URL: ${f.url}\n   Error: ${f.error}`)
        .join("\n\n");
      archive.append(report, { name: "failed_downloads_report.txt" });
    }

    // Finalize the archive (closes stream input)
    archive.finalize();

    // Clean up temporary files on stream closure
    passthrough.on("close", async () => {
      console.log(`[BULK-${requestId}] Clean up temp folder: ${tempDir}`);
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    });

    console.log(`[BULK-${requestId}] Initiating file download stream after ${Date.now() - startTime}ms`);
    return new NextResponse(passthrough as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="bulk_download_${requestId}.zip"`,
        "Cache-Control": "no-cache",
      },
    });

  } catch (error: any) {
    console.error(`[BULK-${requestId}] Fatal bulk downloader error:`, error);
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: error.message || "Failed to initiate bulk download" }, { status: 500 });
  }
}
