import { createAdminClient } from "@/utils/supabase/admin";

export type CampaignDeliveryProgress = {
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  processedCount: number;
  recipientCount: number;
  percentComplete: number;
};

/** Live delivery counts from recipient rows (accurate during batch processing). */
export async function getCampaignDeliveryProgress(
  campaignId: string,
  recipientCountFallback?: number,
): Promise<CampaignDeliveryProgress> {
  const db = createAdminClient();

  const countFor = async (status: string) => {
    const { count, error } = await db
      .from("admin_notification_campaign_recipients")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("delivery_status", status);
    if (error) return 0;
    return count ?? 0;
  };

  const [deliveredCount, failedCount, pendingCount] = await Promise.all([
    countFor("delivered"),
    countFor("failed"),
    countFor("pending"),
  ]);

  const processedCount = deliveredCount + failedCount;
  const recipientCount =
    recipientCountFallback ??
    processedCount + pendingCount;

  const percentComplete =
    recipientCount > 0
      ? Math.min(100, Math.round((processedCount / recipientCount) * 100))
      : 0;

  return {
    deliveredCount,
    failedCount,
    pendingCount,
    processedCount,
    recipientCount,
    percentComplete,
  };
}

export {
  computeCampaignReadSummary,
  computeReadCountByCampaign,
  countCampaignStatsByIds,
  fetchAllPaginated,
  type CampaignCountStats,
  type CampaignNotificationRow,
  type CampaignRecipientKeyRow,
  type CampaignRecipientRow,
  type CampaignReadSummary,
} from "./read-stats";
