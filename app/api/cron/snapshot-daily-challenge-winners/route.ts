import { NextRequest, NextResponse } from "next/server";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import {
  getYesterdayIstDateKey,
  snapshotWinnersForIstDate,
} from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

// Vercel cron runs in UTC. Schedule `0 21 * * *` → 02:30 IST (verification buffer after midnight period end).

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

    const snapshotDate = getYesterdayIstDateKey();
    const snapshot = await snapshotWinnersForIstDate(snapshotDate, {
      reason: "daily_auto_snapshot",
      allowOverwrite: false,
      useAdminClient: true,
    });
    if (!snapshot?.ok) {
      return NextResponse.json(
        {
          error: "Snapshot failed",
          snapshotDate,
          snapshot,
        },
        { status: 500 },
      );
    }
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
