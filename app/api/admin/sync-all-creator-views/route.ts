import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { MetricsService } from "@/lib/metrics-service";

export async function POST() {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await MetricsService.syncAllCreatorProfileViews();

    return NextResponse.json({
      success: true,
      message: "Creator profile views synced across all campaigns.",
      views_sync: result,
    });
  } catch (error: unknown) {
    console.error("[sync-all-creator-views] failed:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
