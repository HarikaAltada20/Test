import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  countCampaignStatsByIds,
  getCampaignDeliveryProgress,
} from "@/lib/admin-notifications/delivery-progress";

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

  const campaignIds = (data ?? []).map((c) => c.id);
  const statsByCampaign = await countCampaignStatsByIds(db, campaignIds);
  const countPatches = (data ?? [])
    .map((campaign) => {
      const stats = statsByCampaign.get(campaign.id);
      if (!stats) return null;

      const nextRecipientCount = stats.recipientCount;
      const nextSuccessCount = stats.deliveredCount;
      const nextFailureCount = stats.failureCount;

      const hasMismatch =
        (campaign.recipient_count ?? 0) !== nextRecipientCount ||
        (campaign.success_count ?? 0) !== nextSuccessCount ||
        (campaign.failure_count ?? 0) !== nextFailureCount;

      if (!hasMismatch) return null;

      return {
        campaignId: campaign.id,
        patch: {
          recipient_count: nextRecipientCount,
          success_count: nextSuccessCount,
          failure_count: nextFailureCount,
        },
      };
    })
    .filter(
      (
        item,
      ): item is {
        campaignId: string;
        patch: {
          recipient_count: number;
          success_count: number;
          failure_count: number;
        };
      } => Boolean(item),
    );

  if (countPatches.length > 0) {
    await Promise.all(
      countPatches.map(({ campaignId, patch }) =>
        db
          .from("admin_notification_campaigns")
          .update(patch)
          .eq("id", campaignId),
      ),
    );
  }

  const campaigns = await Promise.all(
    (data ?? []).map(async (c) => {
      const stats = statsByCampaign.get(c.id);
      const recipientCount = stats?.recipientCount ?? c.recipient_count ?? 0;
      const deliveredCount = stats?.deliveredCount ?? c.success_count ?? 0;
      const failureCount = stats?.failureCount ?? c.failure_count ?? 0;
      const readCount = stats?.readCount ?? 0;

      const deliveryProgress =
        c.status === "processing" || c.status === "pending"
          ? await getCampaignDeliveryProgress(c.id, recipientCount)
          : null;

      return {
        id: c.id,
        messageTemplate: c.message_template,
        notificationType: c.notification_type,
        recipientCount,
        successCount: deliveredCount,
        failureCount,
        status: c.status,
        scheduledAt: c.scheduled_at,
        createdAt: c.created_at,
        completedAt: c.completed_at,
        recipientMode: c.recipient_mode,
        readCount,
        readPercent:
          deliveredCount > 0
            ? Math.round((readCount / deliveredCount) * 1000) / 10
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
