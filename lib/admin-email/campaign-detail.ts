import { createAdminClient } from "@/utils/supabase/admin";

export async function getEmailCampaignDetail(campaignId: string) {
  const db = createAdminClient();

  const { data: campaign, error } = await db
    .from("admin_email_campaigns")
    .select(
      `
      *,
      project:admin_email_projects (id, name, full_domain, use_platform_sender)
    `,
    )
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return null;

  const { count: pendingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending");

  const recipientCount = campaign.recipient_count ?? 0;
  const sentCount = campaign.sent_count ?? 0;
  const remainingCount = pendingCount ?? 0;
  const effectiveStatus =
    remainingCount > 0 && ["completed", "partial"].includes(campaign.status)
      ? "configured"
      : campaign.status;
  const progressPercent =
    recipientCount > 0 ? (sentCount / recipientCount) * 100 : 0;

  const { data: trackingRows } = await db
    .from("admin_email_tracking")
    .select("open_count, click_count")
    .eq("campaign_id", campaignId);

  let openCount = 0;
  let clickCount = 0;
  for (const row of trackingRows ?? []) {
    if ((row.open_count ?? 0) > 0) openCount += 1;
    if ((row.click_count ?? 0) > 0) clickCount += 1;
  }

  const { count: bounceCount } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "bounced");

  const project = campaign.project as {
    id: string;
    name: string;
    full_domain: string | null;
    use_platform_sender: boolean;
  } | null;

  return {
    id: campaign.id,
    projectId: campaign.project_id,
    projectName: project?.name ?? "",
    name: campaign.name,
    emailSubject: campaign.email_subject,
    messageTemplate: campaign.message_template,
    status: effectiveStatus,
    recipientCount,
    sentCount,
    remainingCount,
    progressPercent,
    startedAt: campaign.started_at,
    completedAt: campaign.completed_at,
    scheduledAt: campaign.scheduled_at,
    estimatedCompletionAt: null,
    fromEmail: campaign.from_email,
    recipientMode: campaign.recipient_mode,
    filterSnapshot: campaign.filter_snapshot,
    createdAt: campaign.created_at,
    contestId: campaign.contest_id,
    summary: {
      openRate: sentCount > 0 ? openCount / sentCount : 0,
      openCount,
      clickRate: sentCount > 0 ? clickCount / sentCount : 0,
      clickCount,
      bounceRate: sentCount > 0 ? (bounceCount ?? 0) / sentCount : 0,
      bounceCount: bounceCount ?? 0,
    },
    schedule: {
      useProjectDefault: campaign.use_project_schedule,
      dailyLimit: campaign.daily_limit,
      fromTime: campaign.schedule_from_time,
      toTime: campaign.schedule_to_time,
      timezone: campaign.schedule_timezone,
      days: campaign.schedule_days,
    },
    sequence: {
      steps: [
        {
          stepNumber: 1,
          subject: campaign.email_subject ?? "",
          body: campaign.message_template ?? "",
        },
      ],
    },
    options: {
      fromEmail: campaign.from_email,
      fromSenderId: campaign.from_sender_id,
      stopOnReply: campaign.stop_on_reply,
    },
  };
}
