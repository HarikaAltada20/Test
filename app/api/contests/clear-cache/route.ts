import { NextResponse } from "next/server";
import { clearContestsCache } from "@/lib/cache-utils";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    console.log("[/api/contests/clear-cache] Clearing contest cache...");
    
    // Clear all contests-related cache
    const clearedCount = clearContestsCache();
    
    console.log(`[/api/contests/clear-cache] Cache cleared successfully. Cleared ${clearedCount} entries.`);

    return NextResponse.json({
      success: true,
      message: "Contest cache cleared successfully",
      clearedCount,
    });
  } catch (error: any) {
    console.error("[/api/contests/clear-cache] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to clear cache" },
      { status: 500 }
    );
  }
}
