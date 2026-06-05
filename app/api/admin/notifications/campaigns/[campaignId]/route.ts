import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildCampaignDetailSummary,
  fetchAllCampaignRecipients,
  fetchCampaignRecipientsPage,
} from "@/lib/admin-notifications/campaign-detail";
import {
  countCampaignStatsByIds,
  getCampaignDeliveryProgress,
} from "@/lib/admin-notifications/delivery-progress";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const { campaignId } = await context.params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10)),
  );
  const userType = url.searchParams.get("userType");
  const readStatus = url.searchParams.get("readStatus");
  const search = url.searchParams.get("search");
  const sortColumn = url.searchParams.get("sortColumn");
  const sortOrder = url.searchParams.get("sortOrder") as "asc" | "desc" | null;
  const allRecipients = url.searchParams.get("allRecipients") === "true";

  const db = createAdminClient();

  const { data: campaign, error: campaignError } = await db
    .from("admin_notification_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const statsByCampaign = await countCampaignStatsByIds(db, [campaignId]);
  const stats = statsByCampaign.get(campaignId);
  const recipientCount = stats?.recipientCount ?? campaign.recipient_count ?? 0;
  const successCount = stats?.deliveredCount ?? campaign.success_count ?? 0;
  const failureCount = stats?.failureCount ?? campaign.failure_count ?? 0;

  if (
    recipientCount !== (campaign.recipient_count ?? 0) ||
    successCount !== (campaign.success_count ?? 0) ||
    failureCount !== (campaign.failure_count ?? 0)
  ) {
    await db
      .from("admin_notification_campaigns")
      .update({
        recipient_count: recipientCount,
        success_count: successCount,
        failure_count: failureCount,
      })
      .eq("id", campaignId);
  }

  const deliveryProgressPromise =
    campaign.status === "processing" || campaign.status === "pending"
      ? getCampaignDeliveryProgress(campaignId, recipientCount)
      : Promise.resolve(null);

  if (allRecipients) {
    const [summary, recipients, deliveryProgress] = await Promise.all([
      buildCampaignDetailSummary(db, campaignId),
      fetchAllCampaignRecipients(db, campaignId),
      deliveryProgressPromise,
    ]);

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        messageTemplate: campaign.message_template,
        status: campaign.status,
        scheduledAt: campaign.scheduled_at,
        createdAt: campaign.created_at,
        completedAt: campaign.completed_at,
        recipientCount,
      },
      deliveryProgress,
      summary,
      allRecipients: recipients,
    });
  }

  const [summary, recipientPage, deliveryProgress] = await Promise.all([
    buildCampaignDetailSummary(db, campaignId),
    fetchCampaignRecipientsPage(db, campaignId, {
      page,
      limit,
      userType,
      readStatus,
      search,
      sortColumn,
      sortOrder,
    }),
    deliveryProgressPromise,
  ]);

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      messageTemplate: campaign.message_template,
      status: campaign.status,
      scheduledAt: campaign.scheduled_at,
      createdAt: campaign.created_at,
      completedAt: campaign.completed_at,
      recipientCount,
    },
    deliveryProgress,
    summary,
    recipients: recipientPage.recipients,
    recipientsTotal: recipientPage.total,
    recipientsPage: recipientPage.page,
    recipientsLimit: recipientPage.limit,
    recipientsTotalPages: recipientPage.totalPages,
  });
}
