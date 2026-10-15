"use client";

import { createClient } from "@/utils/supabase/client";
import type {
  CampaignDraftFilter,
  CampaignDraftStatus,
  DraftDetail,
  DraftListPage,
  DraftMedia,
  DraftReviewDecision,
  DraftSort,
  MyDraftFilter,
} from "@/lib/content-drafts";

/**
 * Review before posting calls from the browser. The database functions check
 * who is calling (creator, campaign brand or admin), so most calls go straight
 * to Supabase; only signed media URLs need our API.
 */

type RpcError = { code?: string; message?: string } | null;

/** "Function does not exist": the migration hasn't been run yet. */
export function isMissingDraftFeature(error: RpcError | unknown): boolean {
  const e = error as RpcError;
  if (!e) return false;
  return (
    e.code === "PGRST202" ||
    e.code === "42883" ||
    /could not find the function|does not exist/i.test(e.message ?? "")
  );
}

export class DraftApiError extends Error {
  constructor(
    message: string,
    public missingFeature = false,
  ) {
    super(message);
  }
}

function fail(error: RpcError): never {
  throw new DraftApiError(
    error?.message || "Something went wrong. Try again.",
    isMissingDraftFeature(error),
  );
}

function firstRow<T>(data: unknown): T | undefined {
  return (Array.isArray(data) ? data[0] : data) as T | undefined;
}

export async function getCampaignDraftStatus(contestId: string): Promise<CampaignDraftStatus> {
  const { data, error } = await createClient().rpc("content_draft_campaign_status", {
    p_contest_id: contestId,
  });
  if (error) fail(error);
  return (data ?? { review_before_posting: false }) as CampaignDraftStatus;
}

export async function listMyDrafts(opts: {
  contestId?: string | null;
  status: MyDraftFilter;
  offset: number;
  limit: number;
}): Promise<DraftListPage> {
  const { data, error } = await createClient().rpc("my_content_drafts_page", {
    p_contest_id: opts.contestId ?? null,
    p_status: opts.status,
    p_offset: opts.offset,
    p_limit: opts.limit,
  });
  if (error) fail(error);
  return normalizePage(data);
}

export async function listCampaignDrafts(opts: {
  contestId: string;
  status: CampaignDraftFilter;
  search?: string;
  sort: DraftSort;
  offset: number;
  limit: number;
}): Promise<DraftListPage> {
  const { data, error } = await createClient().rpc("campaign_content_drafts_page", {
    p_contest_id: opts.contestId,
    p_status: opts.status,
    p_search: opts.search?.trim() || null,
    p_sort: opts.sort,
    p_offset: opts.offset,
    p_limit: opts.limit,
  });
  if (error) fail(error);
  if (data === null) throw new DraftApiError("You can't review drafts for this campaign.");
  return normalizePage(data);
}

function normalizePage(data: unknown): DraftListPage {
  const page = (data ?? {}) as Partial<DraftListPage>;
  return {
    total: Number(page.total ?? 0),
    counts: page.counts ?? {},
    rows: Array.isArray(page.rows) ? page.rows : [],
  };
}

/** Null when the draft doesn't exist or the caller can't see it. */
export async function getDraftDetail(draftId: string): Promise<DraftDetail | null> {
  const { data, error } = await createClient().rpc("content_draft_detail", {
    p_draft_id: draftId,
  });
  if (error) fail(error);
  return (data ?? null) as DraftDetail | null;
}

export type DraftVersionInput = {
  draftId: string;
  versionId: string;
  storagePath: string;
  posterPath: string | null;
  title: string;
  caption: string;
  hashtags: string[];
  note: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
};

export type SendResult = { result: string; detail: string | null; versionNo?: number | null };

export async function createDraft(contestId: string, input: DraftVersionInput): Promise<SendResult> {
  const { data, error } = await createClient().rpc("create_content_draft", {
    p_draft_id: input.draftId,
    p_contest_id: contestId,
    p_version_id: input.versionId,
    p_storage_path: input.storagePath,
    p_poster_path: input.posterPath,
    p_title: input.title,
    p_caption: input.caption || null,
    p_hashtags: input.hashtags,
    p_note: input.note || null,
    p_duration_sec: input.durationSec,
    p_width: input.width,
    p_height: input.height,
  });
  if (error) fail(error);
  const row = firstRow<{ result: string; detail: string | null }>(data);
  return { result: row?.result ?? "error", detail: row?.detail ?? null };
}

export async function addDraftVersion(input: DraftVersionInput): Promise<SendResult> {
  const { data, error } = await createClient().rpc("add_content_draft_version", {
    p_draft_id: input.draftId,
    p_version_id: input.versionId,
    p_storage_path: input.storagePath,
    p_poster_path: input.posterPath,
    p_title: input.title,
    p_caption: input.caption || null,
    p_hashtags: input.hashtags,
    p_note: input.note || null,
    p_duration_sec: input.durationSec,
    p_width: input.width,
    p_height: input.height,
  });
  if (error) fail(error);
  const row = firstRow<{ result: string; version_no: number | null; detail: string | null }>(data);
  return { result: row?.result ?? "error", detail: row?.detail ?? null, versionNo: row?.version_no ?? null };
}

export async function withdrawDraft(draftId: string): Promise<string> {
  const { data, error } = await createClient().rpc("withdraw_content_draft", {
    p_draft_id: draftId,
  });
  if (error) fail(error);
  return String(data ?? "error");
}

export async function reviewDraft(
  draftId: string,
  versionId: string | null,
  decision: DraftReviewDecision,
  reason: string | null,
): Promise<string> {
  const { data, error } = await createClient().rpc("review_content_draft", {
    p_draft_id: draftId,
    p_version_id: versionId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) fail(error);
  return firstRow<{ result: string }>(data)?.result ?? "error";
}

export async function commentOnDraft(draftId: string, body: string): Promise<string> {
  const { data, error } = await createClient().rpc("comment_on_content_draft", {
    p_draft_id: draftId,
    p_body: body,
  });
  if (error) fail(error);
  return firstRow<{ result: string }>(data)?.result ?? "error";
}

export async function fetchDraftMedia(versionIds: string[], video: boolean): Promise<DraftMedia[]> {
  if (versionIds.length === 0) return [];
  const res = await fetch("/api/content-drafts/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionIds, video }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { media?: DraftMedia[]; error?: string };
  if (!res.ok) throw new DraftApiError(json.error || "Couldn't load the video.");
  return json.media ?? [];
}
