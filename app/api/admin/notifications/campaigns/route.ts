import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { processDueScheduledCampaigns } from "@/lib/admin-notifications/delivery";
import { getCampaignDeliveryProgress } from "@/lib/admin-notifications/delivery-progress";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { isAdmin, error } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)),
  );
  const offset = Math.max(
    0,
    parseInt(url.searchParams.get("offset") ?? "0", 10),
  );

  const db = createAdminClient();

  try {
    await processDueScheduledCampaigns(50);
  } catch (err) {
    console.error("Failed to process due scheduled campaigns:", err);
  }

  const { data, error: listError, count } = await db
    .from("admin_notification_campaigns")
    .select(
      "id, notification_type, message_template, recipient_count, success_count, failure_count, status, scheduled_at, created_at, completed_at, recipient_mode",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const campaigns = await Promise.all(
    (data ?? []).map(async (c) => {
      const { count: readCount } = await db
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .eq("is_read", true);

      const delivered = c.success_count ?? 0;
      const deliveryProgress =
        c.status === "processing" || c.status === "pending"
          ? await getCampaignDeliveryProgress(
              c.id,
              c.recipient_count ?? undefined,
            )
          : null;

      return {
        id: c.id,
        messageTemplate: c.message_template,
        notificationType: c.notification_type,
        recipientCount: c.recipient_count,
        successCount: c.success_count,
        failureCount: c.failure_count,
        status: c.status,
        scheduledAt: c.scheduled_at,
        createdAt: c.created_at,
        completedAt: c.completed_at,
        recipientMode: c.recipient_mode,
        readCount: readCount ?? 0,
        readPercent:
          delivered > 0
            ? Math.round(((readCount ?? 0) / delivered) * 1000) / 10
            : null,
        deliveryProgress,
      };
    }),
  );

  return NextResponse.json({
    campaigns,
    total: count ?? campaigns.length,
    limit,
    offset,
  });
}
