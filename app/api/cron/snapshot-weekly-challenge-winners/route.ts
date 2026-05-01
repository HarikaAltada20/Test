import { NextRequest, NextResponse } from "next/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import { snapshotWinnersForPeriod } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

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

    const snapshot = await snapshotWinnersForPeriod("last_week", {
      reason: "weekly_auto_snapshot",
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
    console.error("[cron/snapshot-weekly-challenge-winners] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
