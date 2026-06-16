import { createAdminClient } from "@/utils/supabase/admin";

type ProjectRelation = {
  name: string;
  ses_verification_status: string;
};

/** Supabase embeds can be a row or an array depending on inferred cardinality. */
function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type EmailCampaignListItem = {
  id: string;
  project_id: string;
  name: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  email_subject: string | null;
  message_template: string | null;
  from_email: string | null;
  created_at: string;
  project?: {
    name: string;
    ses_verification_status: string;
  } | null;
  stats: {
    openCount: number;
    clickCount: number;
    clickRate: number;
    progressPercent: number;
  };
};

export async function listEmailCampaigns(projectId?: string | null) {
  const db = createAdminClient();

  let query = db
    .from("admin_email_campaigns")
    .select(
      `
      id, project_id, name, status, recipient_count, sent_count,
      email_subject, message_template, from_email, created_at,
      project:admin_email_projects (name, ses_verification_status)
    `,
    )
    .order("created_at", { ascending: false });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: campaigns, error } = await query;
  if (error) throw new Error(error.message);

  const rows = campaigns ?? [];
  if (rows.length === 0) return [] as EmailCampaignListItem[];

  const campaignIds = rows.map((c) => c.id);
  const { data: trackingRows } = await db
    .from("admin_email_tracking")
    .select("campaign_id, open_count, click_count")
    .in("campaign_id", campaignIds);

  const trackingByCampaign = new Map<
    string,
    { openCount: number; clickCount: number }
  >();
  for (const id of campaignIds) {
    trackingByCampaign.set(id, { openCount: 0, clickCount: 0 });
  }
  for (const row of trackingRows ?? []) {
    const agg = trackingByCampaign.get(row.campaign_id);
    if (!agg) continue;
    if ((row.open_count ?? 0) > 0) agg.openCount += 1;
    if ((row.click_count ?? 0) > 0) agg.clickCount += 1;
  }

  return rows.map((c) => {
    const recipientCount = c.recipient_count ?? 0;
    const sentCount = c.sent_count ?? 0;
    const tracking = trackingByCampaign.get(c.id) ?? {
      openCount: 0,
      clickCount: 0,
    };
    const project = relationOne<ProjectRelation>(c.project);

    return {
      id: c.id,
      project_id: c.project_id,
      name: c.name,
      status: c.status,
      recipient_count: recipientCount,
      sent_count: sentCount,
      email_subject: c.email_subject ?? null,
      message_template: c.message_template ?? null,
      from_email: c.from_email ?? null,
      created_at: c.created_at,
      project: project
        ? {
            name: project.name,
            ses_verification_status: project.ses_verification_status,
          }
        : null,
      stats: {
        openCount: tracking.openCount,
        clickCount: tracking.clickCount,
        clickRate: sentCount > 0 ? tracking.clickCount / sentCount : 0,
        progressPercent:
          recipientCount > 0 ? (sentCount / recipientCount) * 100 : 0,
      },
    };
  });
}
