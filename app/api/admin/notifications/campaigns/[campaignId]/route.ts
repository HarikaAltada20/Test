import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { processDueScheduledCampaigns } from "@/lib/admin-notifications/delivery";
import { getCampaignDeliveryProgress } from "@/lib/admin-notifications/delivery-progress";

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
  const userTypeFilter = url.searchParams.get("userType");
  const readFilter = url.searchParams.get("readFilter");

  const db = createAdminClient();

  try {
    await processDueScheduledCampaigns(50);
  } catch (err) {
    console.error("Failed to process due scheduled campaigns:", err);
  }

  const { data: campaign, error: campaignError } = await db
    .from("admin_notification_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: recipientRows, error: recipError } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id, user_type_at_send, delivery_status")
    .eq("campaign_id", campaignId);

  if (recipError) {
    return NextResponse.json({ error: recipError.message }, { status: 500 });
  }

  const userIds = (recipientRows ?? []).map((r) => r.user_id);
  const usersMap = new Map<
    string,
    { full_name: string | null; email: string }
  >();

  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data: users } = await db
      .from("users")
      .select("id, full_name, email")
      .in("id", chunk);
    for (const u of users ?? []) {
      usersMap.set(u.id, u);
    }
  }

  const { data: notifications } = await db
    .from("user_notifications")
    .select("user_id, is_read, read_at, created_at")
    .eq("campaign_id", campaignId);

  const notifByUser = new Map(
    (notifications ?? []).map((n) => [n.user_id, n]),
  );

  let recipients = (recipientRows ?? []).map((r) => {
    const u = usersMap.get(r.user_id);
    const n = notifByUser.get(r.user_id);
    return {
      userId: r.user_id,
      fullName: u?.full_name ?? "",
      email: u?.email ?? "",
      userTypeAtSend: r.user_type_at_send,
      deliveryStatus: r.delivery_status,
      isRead: n?.is_read ?? false,
      readAt: n?.read_at ?? null,
      sentAt: n?.created_at ?? null,
    };
  });

  if (userTypeFilter === "creator") {
    recipients = recipients.filter((r) => r.userTypeAtSend === "creator");
  } else if (userTypeFilter === "advertiser") {
    recipients = recipients.filter((r) => r.userTypeAtSend === "advertiser");
  }

  if (readFilter === "unread") {
    recipients = recipients.filter(
      (r) => r.deliveryStatus === "delivered" && !r.isRead,
    );
  }

  const delivered = (recipientRows ?? []).filter(
    (r) => r.delivery_status === "delivered",
  );
  const readCount = delivered.filter((r) => {
    const n = notifByUser.get(r.user_id);
    return n?.is_read;
  }).length;

  const byType = { creator: { sent: 0, read: 0 }, advertiser: { sent: 0, read: 0 }, admin: { sent: 0, read: 0 } };
  for (const r of delivered) {
    const key = r.user_type_at_send as keyof typeof byType;
    if (key in byType) {
      byType[key].sent += 1;
      if (notifByUser.get(r.user_id)?.is_read) {
        byType[key].read += 1;
      }
    }
  }

  const deliveryProgress =
    campaign.status === "processing" || campaign.status === "pending"
      ? await getCampaignDeliveryProgress(
          campaignId,
          campaign.recipient_count ?? undefined,
        )
      : null;

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      messageTemplate: campaign.message_template,
      status: campaign.status,
      scheduledAt: campaign.scheduled_at,
      createdAt: campaign.created_at,
      completedAt: campaign.completed_at,
      recipientCount: campaign.recipient_count,
    },
    deliveryProgress,
    summary: {
      sent: delivered.length,
      read: readCount,
      readPercent:
        delivered.length > 0
          ? Math.round((readCount / delivered.length) * 1000) / 10
          : 0,
      byType,
    },
    recipients,
  });
}
