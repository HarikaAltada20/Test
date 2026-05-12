import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import { CompetitionPeriod, snapshotTodayWinners } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

const VALID_PERIODS: CompetitionPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
];

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const period = (body?.period || "today") as CompetitionPeriod;
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const cleared = clearDailyChallengeCache();
    const snapshot = await snapshotTodayWinners("manual_admin_refresh", period);

    return NextResponse.json({
      success: true,
      cacheEntriesCleared: cleared,
      snapshot,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/competition/refresh] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
