import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { cancelAdminNotificationQStashSchedule } from "@/lib/qstash";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function PATCH(_req: Request, context: RouteContext) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;
  const db = createAdminClient();

  const { data: campaign, error: fetchError } = await db
    .from("admin_notification_campaigns")
    .select("id, status, scheduled_at, qstash_message_id")
    .eq("id", campaignId)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled campaigns can be cancelled" },
      { status: 400 },
    );
  }

  if (campaign.scheduled_at && new Date(campaign.scheduled_at) <= new Date()) {
    return NextResponse.json(
      { error: "Campaign is already due for delivery" },
      { status: 400 },
    );
  }

  if (campaign.qstash_message_id) {
    const cancelResult = await cancelAdminNotificationQStashSchedule(
      campaign.qstash_message_id,
    );
    if (!cancelResult.ok) {
      return NextResponse.json(
        {
          error: `Failed to cancel scheduled QStash delivery: ${cancelResult.error ?? "unknown error"}`,
        },
        { status: 502 },
      );
    }
  }

  const { data: updatedCampaign, error: updateError } = await db
    .from("admin_notification_campaigns")
    .update({ status: "cancelled", qstash_message_id: null })
    .eq("id", campaignId)
    .eq("status", "scheduled")
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  if (!updatedCampaign) {
    return NextResponse.json(
      {
        error:
          "Campaign could not be cancelled because its status changed. Refresh and try again.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, status: "cancelled" });
}
