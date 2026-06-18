import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeCampaignSenderIds } from "@/lib/admin-email/campaign-senders";

export async function getEmailCampaignDetail(campaignId: string) {
  const db = createAdminClient();

  const { data: campaign, error } = await db
    .from("admin_email_campaigns")
    .select(
      `
      id,
      project_id,
      name,
      status,
      email_subject,
      message_template,
      from_email,
      from_sender_id,
      from_sender_ids,
      recipient_mode,
      filter_snapshot,
      recipient_count,
      sent_count,
      created_by,
      scheduled_at,
      started_at,
      completed_at,
      use_project_schedule,
      daily_limit,
      schedule_from_time,
      schedule_to_time,
      schedule_timezone,
      schedule_days,
      stop_on_reply,
      contest_id,
      created_at,
      updated_at,
      project:admin_email_projects (id, name, full_domain, use_platform_sender)
    `,
    )
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return null;

  const [
    { count: pendingCount },
    { count: bounceCount },
    { count: openCount },
    { count: clickCount },
  ] = await Promise.all([
    db
      .from("admin_email_campaign_recipients")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("email_delivery_status", "pending"),
    db
      .from("admin_email_campaign_recipients")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("email_delivery_status", "bounced"),
    db
      .from("admin_email_tracking")
      .select("tracking_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .or("open_count.gt.0,click_count.gt.0"),
    db
      .from("admin_email_tracking")
      .select("tracking_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .gt("click_count", 0),
  ]);

  const recipientCount = campaign.recipient_count ?? 0;
  const sentCount = campaign.sent_count ?? 0;
  const remainingCount = pendingCount ?? 0;
  const effectiveStatus =
    remainingCount > 0 && ["completed", "partial"].includes(campaign.status)
      ? "configured"
      : campaign.status;
  const progressPercent =
    recipientCount > 0 ? (sentCount / recipientCount) * 100 : 0;

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
      openRate: sentCount > 0 ? (openCount ?? 0) / sentCount : 0,
      openCount: openCount ?? 0,
      clickRate: sentCount > 0 ? (clickCount ?? 0) / sentCount : 0,
      clickCount: clickCount ?? 0,
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
      fromSenderIds: normalizeCampaignSenderIds(
        campaign.from_sender_ids,
        campaign.from_sender_id,
      ),
      stopOnReply: campaign.stop_on_reply,
    },
  };
}
