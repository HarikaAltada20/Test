/**
 * Safety-net: refresh contest_stats for contests that drifted after metrics sync
 * (views/impressions no longer trigger per-row recounts).
 *
 * Triggers:
 * - QStash schedule every 10 minutes (primary)
 * - Vercel Cron once daily (backup) — see vercel.json
 *
 * Auth: Upstash-Signature or Authorization: Bearer CRON_SECRET.
 * (Vercel Cron must send Bearer when CRON_SECRET is set — bare x-vercel-cron is rejected.)
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
import { logStaleContestStatsCron } from "@/lib/campaign-list-observability";

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
  const source = invokeSource(request);

  try {
    const staleIds = await findStaleContestStatsIds(limit, staleMinutes);

    if (staleIds.length === 0) {
      const elapsedMs = Date.now() - started;
      logStaleContestStatsCron({
        durationMs: elapsedMs,
        status: 200,
        refreshed: 0,
        source,
      });
      return NextResponse.json({
        refreshed: 0,
        message: "No stale contest_stats",
        elapsedMs,
      });
    }

    await refreshContestStatsForContestIds(staleIds, { concurrency: 5 });
    // Heal list budget trackers (milestone/CPM/dual/leaderboard) for the same set.
    const { persistContestBudgetSpentForContestIds } = await import(
      "@/lib/persist-contest-budget-spent"
    );
    await persistContestBudgetSpentForContestIds(staleIds, { concurrency: 3 });

    const elapsedMs = Date.now() - started;
    logStaleContestStatsCron({
      durationMs: elapsedMs,
      status: 200,
      refreshed: staleIds.length,
      source,
    });

    return NextResponse.json({
      refreshed: staleIds.length,
      contestIds: staleIds,
      elapsedMs,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "refresh-stale-contest-stats failed";
    const elapsedMs = Date.now() - started;
    logStaleContestStatsCron({
      durationMs: elapsedMs,
      status: 500,
      refreshed: 0,
      source,
      error: message,
    });
    return NextResponse.json({ error: message, elapsedMs }, { status: 500 });
  }
}
