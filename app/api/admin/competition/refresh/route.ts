import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { clearDailyChallengeCache } from "@/lib/cache-utils";
import { snapshotTodayWinners } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const cleared = clearDailyChallengeCache();
    const snapshot = await snapshotTodayWinners("manual_admin_refresh");

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
