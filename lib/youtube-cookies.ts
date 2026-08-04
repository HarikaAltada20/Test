import { createHash, randomUUID } from "crypto";
import { existsSync } from "fs";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export type CookieSource = "env" | "file" | null;

export interface PreparedCookies {
  path: string | null;
  source: CookieSource;
  contentHash: string | null;
  cleanup: () => Promise<void>;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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

/** Prepare a temp Netscape cookie file for yt-dlp YouTube downloads. */
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
