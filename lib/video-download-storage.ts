import { createReadStream } from "fs";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  VIDEO_DOWNLOAD_JOB_TTL_SECONDS,
  VIDEO_DOWNLOAD_LEGACY_STORAGE_BUCKET,
  VIDEO_DOWNLOAD_LEGACY_STORAGE_PREFIX,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
} from "@/lib/queue/video-download-queue";

const LIST_PAGE_SIZE = 100;
const VIDEO_DOWNLOAD_FILE_SIZE_LIMIT_BYTES = 262144000;

let ensuredPrivateBucket = false;

export async function ensureVideoDownloadBucket(): Promise<void> {
  if (ensuredPrivateBucket) return;
  const supabase = createAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(listError.message || "Could not list storage buckets");
  }
  if (buckets?.some((bucket) => bucket.id === VIDEO_DOWNLOAD_STORAGE_BUCKET || bucket.name === VIDEO_DOWNLOAD_STORAGE_BUCKET)) {
    ensuredPrivateBucket = true;
    return;
  }
  const { error } = await supabase.storage.createBucket(VIDEO_DOWNLOAD_STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: VIDEO_DOWNLOAD_FILE_SIZE_LIMIT_BYTES,
    allowedMimeTypes: ["application/zip", "application/x-zip-compressed"],
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(error.message || "Could not create video-downloads bucket");
  }
  ensuredPrivateBucket = true;
}

export async function uploadVideoDownloadZip(options: {
  storagePath: string;
  zipPath: string;
}): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const stream = createReadStream(options.zipPath);
  const { error } = await supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .upload(options.storagePath, stream, {
      contentType: "application/zip",
      upsert: true,
      duplex: "half",
    });
  if (error) {
    return { error: error.message || "Failed to store ZIP archive" };
  }
  return {};
}

function isExpiredStorageObject(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  return (
    Number.isFinite(createdMs) &&
    Date.now() - createdMs >= VIDEO_DOWNLOAD_JOB_TTL_SECONDS * 1000
  );
}

async function listStoragePage(
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string,
  offset: number,
) {
  return supabase.storage.from(bucket).list(prefix, {
    limit: LIST_PAGE_SIZE,
    offset,
  });
}

async function deleteExpiredObjectsInPrefix(options: {
  bucket: string;
  prefix: string;
  maxDeletes: number;
}): Promise<number> {
  const supabase = createAdminClient();
  const { bucket, prefix, maxDeletes } = options;
  let deleted = 0;
  const maxPages = 20;

  for (let page = 0; page < maxPages && deleted < maxDeletes; page++) {
    const { data: entries, error: listError } = await listStoragePage(
      supabase,
      bucket,
      prefix,
      page * LIST_PAGE_SIZE,
    );
    if (listError) {
      console.error(
        `[video-download-storage] list failed bucket=${bucket} prefix=${prefix}:`,
        listError.message,
      );
      break;
    }
    if (!entries?.length) break;

    for (const entry of entries) {
      if (deleted >= maxDeletes) break;
      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id == null;

      if (isFolder) {
        for (let filePage = 0; filePage < maxPages && deleted < maxDeletes; filePage++) {
          const { data: files, error: filesError } = await listStoragePage(
            supabase,
            bucket,
            entryPath,
            filePage * LIST_PAGE_SIZE,
          );
          if (filesError) {
            console.error(
              `[video-download-storage] list folder failed ${bucket}/${entryPath}:`,
              filesError.message,
            );
            break;
          }
          if (!files?.length) break;
          const expiredPaths = files
            .filter((file) => file.id != null && isExpiredStorageObject(file.created_at))
            .map((file) => `${entryPath}/${file.name}`)
            .slice(0, maxDeletes - deleted);
          if (expiredPaths.length > 0) {
            const { error: removeError } = await supabase.storage
              .from(bucket)
              .remove(expiredPaths);
            if (removeError) {
              console.error(
                `[video-download-storage] remove failed ${bucket}:`,
                removeError.message,
              );
            } else {
              deleted += expiredPaths.length;
            }
          }
          if (files.length < LIST_PAGE_SIZE) break;
        }
        continue;
      }

      if (!isExpiredStorageObject(entry.created_at)) continue;
      const { error: removeError } = await supabase.storage
        .from(bucket)
        .remove([entryPath]);
      if (removeError) {
        console.error(
          `[video-download-storage] remove failed ${bucket}/${entryPath}:`,
          removeError.message,
        );
        continue;
      }
      deleted += 1;
    }

    if (entries.length < LIST_PAGE_SIZE) break;
  }

  return deleted;
}

/**
 * Deletes ZIP archives older than VIDEO_DOWNLOAD_JOB_TTL_SECONDS from the
 * private bucket, and leftover objects under contest-assets/video-downloads/.
 */
export async function cleanupExpiredVideoDownloadZips(options?: {
  maxDeletes?: number;
}): Promise<{ deleted: number }> {
  const maxDeletes = Math.max(1, Math.min(options?.maxDeletes ?? 100, 500));
  try {
    const privateDeleted = await deleteExpiredObjectsInPrefix({
      bucket: VIDEO_DOWNLOAD_STORAGE_BUCKET,
      prefix: "",
      maxDeletes,
    });
    const leftover = maxDeletes - privateDeleted;
    const legacyDeleted =
      leftover > 0
        ? await deleteExpiredObjectsInPrefix({
            bucket: VIDEO_DOWNLOAD_LEGACY_STORAGE_BUCKET,
            prefix: VIDEO_DOWNLOAD_LEGACY_STORAGE_PREFIX,
            maxDeletes: leftover,
          })
        : 0;
    const deleted = privateDeleted + legacyDeleted;
    if (deleted > 0) {
      console.log(`[video-download-storage] Deleted ${deleted} expired ZIP object(s)`);
    }
    return { deleted };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[video-download-storage] cleanup failed:", message);
    return { deleted: 0 };
  }
}
