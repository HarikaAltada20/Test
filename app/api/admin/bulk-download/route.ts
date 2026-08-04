import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { YtDlp } from "ytdlp-nodejs";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync, statSync, chmodSync } from "fs";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";
import { prepareYouTubeCookies } from "@/lib/youtube-cookies";
import {
  downloadInstagramVideoBuffer,
  InstagramDownloadError,
} from "@/lib/instagram-download/download";

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
      console.warn(`[YTDLP] Warning chmodding ${tmpBinary}, removing for re-copy:`, e);
      try {
        const { unlinkSync } = require("fs");
        unlinkSync(tmpBinary);
      } catch {
        // ignore
      }
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
            const { copyFileSync } = require("fs");
            copyFileSync(srcPath, tmpBinary);
            chmodSync(tmpBinary, 0o755);
            console.log(`[YTDLP] Copied binary to ${tmpBinary} and set 0755 permissions`);
            return tmpBinary;
          } catch (copyErr: any) {
            console.warn(`[YTDLP] Failed to copy binary to /tmp:`, copyErr);
            // Do NOT return srcPath because ytdlp-nodejs will call chmodSync on read-only /var/task and throw EROFS
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
  if (errorLower.includes("empty media response") || errorLower.includes("not found") || errorLower.includes("404")) {
    return {
      userMessage: "This Instagram video is not accessible. The post may be private, deleted, or restricted.",
      reason: "Instagram post not found or inaccessible",
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

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 100);
}

async function downloadVideoFile(
  ytdlp: YtDlp,
  url: string,
  outputPath: string,
  isInstagram: boolean
): Promise<void> {
  if (isInstagram) {
    const buffer = await downloadInstagramVideoBuffer(url);
    await writeFile(outputPath, buffer);
    return;
  }

  const prepared = await prepareYouTubeCookies();

  const additionalOptions = [
    "--add-header", "Accept-Language:en-US,en;q=0.9",
    "--js-runtimes", "node",
    "--extractor-args", "youtube:player_client=android,web",
    "--merge-output-format", "mp4",
  ];

  const formatSelector =
    "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bestvideo+bestaudio/best";

  try {
    try {
      await ytdlp.downloadAsync(url, {
        format: formatSelector,
        output: outputPath,
        cookies: prepared.path || undefined,
        noWarnings: true,
        noUpdate: true,
        referer: "https://www.youtube.com/",
        additionalOptions,
      });
    } catch (firstError: any) {
      if (prepared.path) {
        console.warn(
          `[YTDLP] YouTube download with cookies failed, retrying without cookies: ${firstError.message}`
        );
        await ytdlp.downloadAsync(url, {
          format: formatSelector,
          output: outputPath,
          cookies: undefined,
          noWarnings: true,
          noUpdate: true,
          referer: "https://www.youtube.com/",
          additionalOptions,
        });
      } else {
        throw firstError;
      }
    }
  } finally {
    await prepared.cleanup();
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
        if (item.isInstagram && err instanceof InstagramDownloadError) {
          failedQueue.push({ url: item.url, error: err.message });
        } else {
          const parsed = parseInstagramError(err.message);
          failedQueue.push({ url: item.url, error: parsed.userMessage });
        }
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