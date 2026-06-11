import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { MetricsService } from "@/lib/metrics-service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json(
        { error: "contest id is required" },
        { status: 400 },
      );
    }

    const syncResult =
      await MetricsService.syncContestViewsToCreatorProfiles(contestId);

    return NextResponse.json({
      success: true,
      message: "Creator profile views synced for this campaign.",
      views_sync: syncResult,
    });
  } catch (error: unknown) {
    console.error("[sync-creator-views] failed:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
