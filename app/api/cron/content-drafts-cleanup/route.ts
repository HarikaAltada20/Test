/**
 * Daily housekeeping for Review before posting:
 *   1. Deletes draft video files 30 days after their campaign ended (the
 *      drafts, versions and conversation are kept).
 *   2. Deletes uploads that never became a draft (abandoned or refused) after 24 h.
 *   3. Closes drafts left in "revision requested" for 30 days without a new version.
 *
 * Auth: Authorization: Bearer CRON_SECRET (Vercel Cron sends it when set).
 */

import { NextResponse } from "next/server";
import { authorizeCronBearerFallback } from "@/lib/qstash";
import { createAdminClient } from "@/utils/supabase/admin";
import { removeDraftFiles } from "@/lib/content-draft-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FILES_RETENTION_DAYS = 30;
const ORPHAN_AFTER_HOURS = 24;
const REVISION_EXPIRY_DAYS = 30;
const BATCH = 200;
const MAX_ROUNDS = 10;

type DueRow = { draft_id: string; paths: string[] | null };

async function run() {
  const admin = createAdminClient();
  let purgedDrafts = 0;
  let removedFiles = 0;
  let orphanFiles = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await admin.rpc("content_draft_files_due", {
      p_days: FILES_RETENTION_DAYS,
      p_limit: BATCH,
    });
    if (error) throw error;
    const due = (data ?? []) as DueRow[];
    if (due.length === 0) break;
    removedFiles += await removeDraftFiles(
      admin,
      due.flatMap((d) => d.paths ?? []),
    );
    const { data: marked, error: markError } = await admin.rpc("mark_content_draft_files_purged", {
      p_draft_ids: due.map((d) => d.draft_id),
    });
    if (markError) throw markError;
    purgedDrafts += Number(marked ?? 0);
    if (due.length < BATCH) break;
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await admin.rpc("content_draft_orphan_files", {
      p_hours: ORPHAN_AFTER_HOURS,
      p_limit: BATCH,
    });
    if (error) throw error;
    const paths = ((data ?? []) as { path: string }[]).map((r) => r.path);
    if (paths.length === 0) break;
    orphanFiles += await removeDraftFiles(admin, paths);
    if (paths.length < BATCH) break;
  }

  const { data: expired, error: expireError } = await admin.rpc("expire_stale_content_drafts", {
    p_days: REVISION_EXPIRY_DAYS,
  });
  if (expireError) throw expireError;

  return {
    purgedDrafts,
    removedFiles,
    orphanFiles,
    expiredDrafts: Number(expired ?? 0),
  };
}

export async function GET(request: Request) {
  if (!authorizeCronBearerFallback(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    console.log("[content-drafts-cleanup]", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[content-drafts-cleanup] failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
