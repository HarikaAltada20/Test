import { NextRequest, NextResponse } from "next/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import { isIstFirstCalendarDay, snapshotWinnersForPeriod } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

// Vercel cron runs in UTC. We must align with IST calendar months (same as the leaderboard).
//
// Schedule: `0 21 28-31 * *` → 02:30 IST on the 1st (21:00 UTC on the prior UTC calendar day).
// Avoid `0 21 1 * *` (“1st of month” in UTC): on the UTC 1st, IST is already the 2nd.
// With `isIstFirstCalendarDay()` below, those runs would skip and monthly locks would never execute.
// IST month rollover is ~prev UTC evening; `0 21 28-31 * *` hits that window.

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "Server misconfigured: CRON_SECRET not set" },
        { status: 503 },
      );
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isIstFirstCalendarDay()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "not_first_ist_calendar_day",
        ranAt: new Date().toISOString(),
      });
    }

    const snapshot = await snapshotWinnersForPeriod("last_month", {
      reason: "monthly_auto_snapshot",
      allowOverwrite: false,
      useAdminClient: true,
    });
    if (!snapshot?.ok) {
      return NextResponse.json({
        success: false,
        snapshot,
        ranAt: new Date().toISOString(),
      });
    }
    const cleared = clearDailyChallengeCache();

    return NextResponse.json({
      success: true,
      snapshot,
      cacheEntriesCleared: cleared,
      ranAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/snapshot-monthly-challenge-winners] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
