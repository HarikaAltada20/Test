import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTENT_DRAFTS_BUCKET, type DraftMedia } from "@/lib/content-drafts";

/**
 * Server-only storage calls for draft videos (signed playback URLs and
 * cleanup). Everything that touches the bucket goes through here, so moving
 * the files to S3/R2 later only changes this module and the upload client.
 */

/** Signed URLs last an hour; the player asks again if one expires mid-review. */
export const DRAFT_MEDIA_TTL_SECONDS = 60 * 60;
const REMOVE_BATCH = 100;

export type DraftVersionFiles = {
  id: string;
  version_no: number;
  storage_path: string;
  poster_path: string | null;
  mime_type: string;
  purged: boolean;
};

function downloadName(row: DraftVersionFiles): string {
  const ext = row.storage_path.match(/\.([a-z0-9]+)$/i)?.[1] ?? "mp4";
  return `draft-v${row.version_no}.${ext}`;
}

/**
 * Signed poster URLs for every row, and video + download URLs when `video`
 * is set. The caller must have checked the viewer may see these rows.
 */
export async function signDraftMedia(
  admin: SupabaseClient,
  rows: DraftVersionFiles[],
  { video }: { video: boolean },
): Promise<DraftMedia[]> {
  const bucket = admin.storage.from(CONTENT_DRAFTS_BUCKET);
  const live = rows.filter((r) => !r.purged);

  const posterPaths = live.map((r) => r.poster_path).filter((p): p is string => !!p);
  const posterUrls = new Map<string, string>();
  if (posterPaths.length > 0) {
    const { data, error } = await bucket.createSignedUrls(posterPaths, DRAFT_MEDIA_TTL_SECONDS);
    if (error) console.error("[content-drafts] poster signing failed:", error.message);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) posterUrls.set(item.path, item.signedUrl);
    }
  }

  return Promise.all(
    rows.map(async (row): Promise<DraftMedia> => {
      const base: DraftMedia = {
        version_id: row.id,
        video_url: null,
        download_url: null,
        poster_url: row.poster_path ? posterUrls.get(row.poster_path) ?? null : null,
        purged: row.purged,
      };
      if (!video || row.purged) return base;
      const [play, download] = await Promise.all([
        bucket.createSignedUrl(row.storage_path, DRAFT_MEDIA_TTL_SECONDS),
        bucket.createSignedUrl(row.storage_path, DRAFT_MEDIA_TTL_SECONDS, {
          download: downloadName(row),
        }),
      ]);
      if (play.error) console.error("[content-drafts] video signing failed:", play.error.message);
      return {
        ...base,
        video_url: play.data?.signedUrl ?? null,
        download_url: download.data?.signedUrl ?? null,
      };
    }),
  );
}

/** Deletes files from the bucket in batches. Returns how many paths were sent. */
export async function removeDraftFiles(admin: SupabaseClient, paths: string[]): Promise<number> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  let removed = 0;
  for (let i = 0; i < unique.length; i += REMOVE_BATCH) {
    const batch = unique.slice(i, i + REMOVE_BATCH);
    const { error } = await admin.storage.from(CONTENT_DRAFTS_BUCKET).remove(batch);
    if (error) throw error;
    removed += batch.length;
  }
  return removed;
}
