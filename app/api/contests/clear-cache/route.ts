import { NextResponse } from "next/server";
import { clearContestsCache } from "@/lib/cache-utils";
import { invalidateAllCampaignListCache } from "@/lib/campaign-list-cache";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    console.log("[/api/contests/clear-cache] Clearing contest cache...");

    const clearedCount = clearContestsCache();
    const listCleared = await invalidateAllCampaignListCache();

    console.log(
      `[/api/contests/clear-cache] Cache cleared successfully. Memory=${clearedCount} RedisList=${listCleared}`,
    );

    return NextResponse.json({
      success: true,
      message: "Contest cache cleared successfully",
      clearedCount,
      listCacheCleared: listCleared,
    });
  } catch (error: any) {
    console.error("[/api/contests/clear-cache] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to clear cache" },
      { status: 500 },
    );
  }
}
