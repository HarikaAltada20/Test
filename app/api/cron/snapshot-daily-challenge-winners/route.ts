import { NextRequest, NextResponse } from "next/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import {
  getYesterdayIstDateKey,
  snapshotWinnersForIstDate,
} from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshotDate = getYesterdayIstDateKey();
    const snapshot = await snapshotWinnersForIstDate(snapshotDate, {
      reason: "daily_auto_snapshot",
      allowOverwrite: false,
    });
    const cleared = clearDailyChallengeCache();

    return NextResponse.json({
      success: true,
      snapshotDate,
      snapshot,
      cacheEntriesCleared: cleared,
      ranAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[cron/snapshot-daily-challenge-winners] error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
