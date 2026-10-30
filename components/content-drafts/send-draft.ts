"use client";

import { createClient } from "@/utils/supabase/client";
import {
  CONTENT_DRAFTS_BUCKET,
  draftPosterPath,
  draftVideoContentType,
  draftVideoExtension,
  draftVideoPath,
} from "@/lib/content-drafts";
import { DraftUploadError, resumableUpload, type VideoDetails } from "@/lib/content-draft-upload";
import { addDraftVersion, createDraft, type SendResult } from "./api";

export type DraftFields = {
  title: string;
  caption: string;
  hashtags: string[];
  note: string;
};

type SendOptions = {
  /** New draft in this campaign, or a revision of draftId. */
  mode: "create" | "revise";
  contestId: string;
  /** Generated once per card, so a retry never creates a second draft or version. */
  draftId: string;
  versionId: string;
  file: File;
  details: VideoDetails | null;
  fields: DraftFields;
  onProgress?: (uploaded: number, total: number) => void;
  onSaving?: () => void;
  signal?: AbortSignal;
};

async function sessionHeaders(): Promise<{ userId: string; headers: Record<string, string> }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.user?.id) {
    throw new DraftUploadError("Your session expired. Sign in again and retry.", false, 401);
  }
  return {
    userId: session.user.id,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    },
  };
}

/**
 * Uploads the video (and its poster frame) to the creator's folder, then
 * sends it for review. Safe to call again after a failure with the same ids:
 * finished uploads are skipped and the database ignores repeats.
 */
export async function sendDraft(opts: SendOptions): Promise<SendResult> {
  const ext = draftVideoExtension(opts.file);
  if (!ext) throw new DraftUploadError("Use an MP4, MOV or WebM video.", false);
  const contentType = opts.file.type && draftVideoExtension({ type: opts.file.type }) ? opts.file.type : draftVideoContentType(ext);

  const { userId } = await sessionHeaders();
  const videoPath = draftVideoPath(userId, opts.draftId, opts.versionId, ext);
  let posterPath: string | null = null;

  if (opts.details?.poster) {
    const path = draftPosterPath(userId, opts.draftId, opts.versionId);
    const { error } = await createClient()
      .storage.from(CONTENT_DRAFTS_BUCKET)
      .upload(path, opts.details.poster, { contentType: "image/jpeg", upsert: false });
    // The preview image is optional; "already exists" means a retry already sent it.
    if (!error || /exists|duplicate/i.test(error.message)) posterPath = path;
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  await resumableUpload({
    endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
    bucket: CONTENT_DRAFTS_BUCKET,
    objectName: videoPath,
    contentType,
    file: opts.file,
    getHeaders: async () => (await sessionHeaders()).headers,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });

  opts.onSaving?.();
  const input = {
    draftId: opts.draftId,
    versionId: opts.versionId,
    storagePath: videoPath,
    posterPath,
    title: opts.fields.title.trim(),
    caption: opts.fields.caption.trim(),
    hashtags: opts.fields.hashtags,
    note: opts.fields.note.trim(),
    durationSec: opts.details?.durationSec ?? null,
    width: opts.details?.width ?? null,
    height: opts.details?.height ?? null,
  };
  return opts.mode === "create" ? createDraft(opts.contestId, input) : addDraftVersion(input);
}

/** crypto.randomUUID with a fallback for older browsers. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
