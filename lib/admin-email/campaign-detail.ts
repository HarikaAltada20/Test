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

  const recipientCount = campaign.recipient_count ?? 0;

  const { count: pendingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending");

  const remainingCount = pendingCount ?? 0;
  const sentCount = Math.max(0, recipientCount - remainingCount);

  const { data: trackingRows } = await db
    .from("admin_email_tracking")
    .select("open_count, click_count")
    .eq("campaign_id", campaignId);

  let openCount = 0;
  let clickCount = 0;
  for (const row of trackingRows ?? []) {
    const opens = row.open_count ?? 0;
    const clicks = row.click_count ?? 0;
    if (opens > 0 || clicks > 0) openCount += 1;
    if (clicks > 0) clickCount += 1;
  }

  const { count: stepSendCount } = await db
    .from("admin_email_sequence_step_sends")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .not("ses_message_id", "is", null);

  const deliveredCount =
    (stepSendCount ?? 0) > 0 ? (stepSendCount ?? 0) : sentCount;

  const { count: bounceCount } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "bounced");

  const effectiveStatus =
    remainingCount > 0 && ["completed", "partial"].includes(campaign.status)
      ? "configured"
      : campaign.status;
  const progressPercent =
    recipientCount > 0 ? (sentCount / recipientCount) * 100 : 0;

  type CampaignProject = {
    id: string;
    name: string;
    full_domain: string | null;
    use_platform_sender: boolean;
  };

  const rawProject = campaign.project as CampaignProject | CampaignProject[] | null;
  const project = Array.isArray(rawProject) ? (rawProject[0] ?? null) : rawProject;

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
      openRate: deliveredCount > 0 ? openCount / deliveredCount : 0,
      openCount,
      clickRate: deliveredCount > 0 ? clickCount / deliveredCount : 0,
      clickCount,
      bounceRate: deliveredCount > 0 ? (bounceCount ?? 0) / deliveredCount : 0,
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
