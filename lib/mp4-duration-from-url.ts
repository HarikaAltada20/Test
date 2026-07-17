/**
 * Extract MP4 duration (seconds) from a CDN URL by reading the `mvhd` atom.
 * Used because Instagram Graph does not expose `video_duration` on media nodes.
 */

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function readU64(buf: Buffer, offset: number): number {
  // Duration/timescale fits in JS number for typical reel lengths.
  const high = buf.readUInt32BE(offset);
  const low = buf.readUInt32BE(offset + 4);
  return high * 2 ** 32 + low;
}

function durationFromMvhd(buf: Buffer, mvhdIndex: number): number | null {
  // atom size (4) + 'mvhd' (4) => version at +8
  const version = buf[mvhdIndex + 8];
  if (version === 0) {
    if (mvhdIndex + 28 > buf.length) return null;
    const timescale = readU32(buf, mvhdIndex + 20);
    const duration = readU32(buf, mvhdIndex + 24);
    if (!timescale || !duration) return null;
    return Math.round(duration / timescale);
  }
  if (version === 1) {
    if (mvhdIndex + 40 > buf.length) return null;
    const timescale = readU32(buf, mvhdIndex + 28);
    const duration = readU64(buf, mvhdIndex + 32);
    if (!timescale || !duration) return null;
    return Math.round(duration / timescale);
  }
  return null;
}

function findMvhdDuration(buf: Buffer): number | null {
  const marker = Buffer.from("mvhd");
  let from = 0;
  while (from < buf.length) {
    const idx = buf.indexOf(marker, from);
    if (idx < 0) return null;
    // Prefer atom layout where 'mvhd' is preceded by a size field.
    if (idx >= 4) {
      const parsed = durationFromMvhd(buf, idx - 4);
      if (parsed != null && parsed > 0 && parsed < 3600 * 6) return parsed;
    }
    from = idx + 4;
  }
  return null;
}

async function fetchRange(
  url: string,
  start: number,
  end: number,
  signal: AbortSignal,
): Promise<Buffer | null> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Range: `bytes=${start}-${end}` },
    signal,
    redirect: "follow",
  });
  if (!(res.ok || res.status === 206)) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * Best-effort reel/video length in seconds from an Instagram `media_url` CDN link.
 * Returns null on CORS/network/parse failure (caller should leave duration unset).
 */
export async function fetchMp4DurationSeconds(
  mediaUrl: string,
  options?: { timeoutMs?: number },
): Promise<number | null> {
  if (!mediaUrl || typeof mediaUrl !== "string") return null;
  const timeoutMs = options?.timeoutMs ?? 8_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Prefer start of file (moov often first for progressive/CDN streaming).
    const head = await fetchRange(mediaUrl, 0, 1024 * 1024 - 1, controller.signal);
    if (head) {
      const fromHead = findMvhdDuration(head);
      if (fromHead != null) return fromHead;
    }

    // Fallback: moov-at-end — probe last 512KB via a probe of Content-Length.
    const probe = await fetch(mediaUrl, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    const lenHeader = probe.headers.get("content-length");
    const total = lenHeader ? Number(lenHeader) : NaN;
    if (Number.isFinite(total) && total > 0) {
      const start = Math.max(0, total - 512 * 1024);
      const tail = await fetchRange(
        mediaUrl,
        start,
        total - 1,
        controller.signal,
      );
      if (tail) {
        const fromTail = findMvhdDuration(tail);
        if (fromTail != null) return fromTail;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
