import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { processScheduledCampaignById } from "@/lib/admin-notifications/delivery";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

/** Deliver one scheduled campaign when due (admin session). */
export async function POST(_req: Request, context: RouteContext) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;

  try {
    const result = await processScheduledCampaignById(campaignId, {
      force: true,
    });
    return NextResponse.json({ ok: true, campaignId, ...result });
  } catch (err) {
    console.error("[deliver-campaign] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delivery failed" },
      { status: 500 },
    );
  }
}
