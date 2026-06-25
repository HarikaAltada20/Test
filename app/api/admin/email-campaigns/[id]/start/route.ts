import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { startEmailCampaignDelivery } from "@/lib/admin-email/delivery";
import { campaignHasSenders } from "@/lib/admin-email/campaign-senders";
import { getQStashPublishBaseUrl } from "@/lib/qstash";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();

  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select(
      "id, status, email_subject, message_template, from_email, from_sender_id, from_sender_ids, project_id, scheduled_at, recipient_count",
    )
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { count: pendingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .in("email_delivery_status", ["pending", "in_sequence"]);

  const pendingLeads = pendingCount ?? 0;
  const normalizedStatus =
    pendingLeads > 0 && ["completed", "partial"].includes(campaign.status)
      ? "configured"
      : campaign.status;

  if (
    !["configured", "draft", "scheduled", "paused", "active"].includes(
      normalizedStatus,
    ) ||
    (normalizedStatus === "active" && pendingLeads <= 0)
  ) {
    return NextResponse.json(
      { error: `Cannot start campaign in status: ${campaign.status}` },
      { status: 400 },
    );
  }

  if (normalizedStatus !== campaign.status) {
    await db
      .from("admin_email_campaigns")
      .update({ status: normalizedStatus, completed_at: null })
      .eq("id", id);
  }

  if (!campaign.email_subject || !campaign.message_template) {
    return NextResponse.json(
      {
        error:
          "Configure sequence (subject/body) and options (sender) before starting",
      },
      { status: 400 },
    );
  }

  const hasSenders = await campaignHasSenders(db, campaign);
  if (!hasSenders) {
    return NextResponse.json(
      {
        error:
          "Configure at least one sender account in Options before starting",
      },
      { status: 400 },
    );
  }

  if ((campaign.recipient_count ?? 0) <= 0 && pendingLeads <= 0) {
    return NextResponse.json(
      { error: "Add leads to this campaign before starting" },
      { status: 400 },
    );
  }

  const scheduledAt = campaign.scheduled_at
    ? new Date(campaign.scheduled_at)
    : null;
  const isFuture =
    scheduledAt && scheduledAt.getTime() > Date.now() + 60_000;

  if (isFuture) {
    await db
      .from("admin_email_campaigns")
      .update({ status: "scheduled" })
      .eq("id", id);
    return NextResponse.json({ status: "scheduled", scheduledAt: campaign.scheduled_at });
  }

  const baseUrl = getQStashPublishBaseUrl(req);
  const started = await startEmailCampaignDelivery(id, baseUrl);

  if (!started.started) {
    return NextResponse.json(
      { error: started.reason ?? "Failed to start campaign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: "active", campaignId: id });
}
