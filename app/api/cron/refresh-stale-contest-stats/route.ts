/**
 * Safety-net: refresh contest_stats for contests that drifted after metrics sync
 * (views/impressions no longer trigger per-row recounts).
 *
 * Triggered by QStash schedule every 10 minutes (not Vercel Cron).
 * Auth: Upstash-Signature or Authorization: Bearer CRON_SECRET.
 *
 * Schedule is upserted via ensureRefreshStaleContestStatsSchedule (fixed scheduleId)
 * when metrics refresh runs, or on a manual POST with CRON_SECRET.
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

export async function GET(request: Request) {
  const authorized = await authorizeRefreshStaleContestStats(request, "");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handle(request, false);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeRefreshStaleContestStats(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[refresh-stale-contest-stats] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );

  return handle(request, true);
}

async function handle(
  request: Request,
  ensureSchedule: boolean,
): Promise<NextResponse> {
  // Keep the recurring QStash schedule in sync (destination URL / cron).
  if (ensureSchedule) {
    const ensured = await ensureRefreshStaleContestStatsSchedule();
    if (ensured.error) {
      console.warn(
        "[refresh-stale-contest-stats] schedule ensure:",
        ensured.error,
      );
    }
  }

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
