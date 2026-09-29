import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { processDueScheduledCampaigns } from "@/lib/admin-notifications/delivery";

export const dynamic = "force-dynamic";

/** Process all scheduled campaigns that are due (admin session). */
export async function POST() {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  try {
    const processed = await processDueScheduledCampaigns(50);
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[process-due] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 },
    );
  }
}
