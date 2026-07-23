/**
 * Safety-net: refresh contest_stats for contests that drifted after metrics sync
 * (views/impressions no longer trigger per-row recounts).
 *
 * Triggers:
 * - QStash schedule every 10 minutes (primary)
 * - Vercel Cron once daily (backup) — see vercel.json
 *
 * Auth: Upstash-Signature, Authorization: Bearer CRON_SECRET, or x-vercel-cron.
 */

import { NextResponse } from "next/server";
import {
  findStaleContestStatsIds,
  refreshContestStatsForContestIds,
} from "@/lib/contest-stats";
import {
  authorizeRefreshStaleContestStats,
  ensureRefreshStaleContestStatsSchedule,
} from "@/lib/qstash";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function invokeSource(request: Request): string {
  if (request.headers.get("Upstash-Signature")) return "QStash";
  if (request.headers.get("x-vercel-cron")) return "Vercel Cron";
  return "CRON/direct";
}

export async function GET(request: Request) {
  const authorized = await authorizeRefreshStaleContestStats(request, "");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log(
    `[refresh-stale-contest-stats] Invoked by ${invokeSource(request)}`,
  );
  return handle(request);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeRefreshStaleContestStats(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(
    `[refresh-stale-contest-stats] Invoked by ${invokeSource(request)}`,
  );

  // QStash / manual POST keeps the 10-min schedule in sync.
  const ensured = await ensureRefreshStaleContestStatsSchedule();
  if (ensured.error) {
    console.warn(
      "[refresh-stale-contest-stats] schedule ensure:",
      ensured.error,
    );
  }

  return handle(request);
}

async function handle(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 50, 1),
    200,
  );
  const staleMinutes = Math.min(
    Math.max(Number(url.searchParams.get("staleMinutes")) || 15, 5),
    120,
  );

  const started = Date.now();
  const staleIds = await findStaleContestStatsIds(limit, staleMinutes);

  if (staleIds.length === 0) {
    return NextResponse.json({
      refreshed: 0,
      message: "No stale contest_stats",
      elapsedMs: Date.now() - started,
    });
  }

  await refreshContestStatsForContestIds(staleIds, { concurrency: 5 });

  return NextResponse.json({
    refreshed: staleIds.length,
    contestIds: staleIds,
    elapsedMs: Date.now() - started,
  });
}
