import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCampaignDeliveryProgress } from "@/lib/admin-notifications/delivery-progress";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

/** Lightweight delivery progress for polling while status is processing. */
export async function GET(_req: Request, context: RouteContext) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;
  const db = createAdminClient();

  const { data: campaign, error: campaignError } = await db
    .from("admin_notification_campaigns")
    .select("id, status, recipient_count")
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const progress = await getCampaignDeliveryProgress(
    campaignId,
    campaign.recipient_count ?? undefined,
  );

  return NextResponse.json({
    campaignId: campaign.id,
    status: campaign.status,
    ...progress,
  });
}
