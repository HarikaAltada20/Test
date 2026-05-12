import { NextRequest, NextResponse } from "next/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import { isIstFirstCalendarDay, snapshotWinnersForPeriod } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

// Vercel cron runs in UTC. We must align with IST calendar months (same as the leaderboard).
//
// Avoid `45 18 1 * *` (“1st of month”): that is day 1 in UTC only. At 18:45 UTC on the UTC 1st,
// clocks in Asia/Kolkata are already 00:15 on the **2nd** — not “evening on the 1st IST”.
// With `isIstFirstCalendarDay()` below, those runs would skip (IST day ≠ 1) and monthly locks
// would never execute. IST month rollover is ~prev UTC evening; `45 18 28-31 * *` hits that window.

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
