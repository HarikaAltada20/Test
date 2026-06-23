import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseScheduleData } from "@/lib/admin-email/schedule-store";
import type { StoredSequence } from "@/lib/admin-email/sequence-types";

function cloneSequenceData(
  source: StoredSequence | null | undefined,
): StoredSequence | null {
  if (!source) return null;
  if (!source.steps?.length) {
    return {
      id: randomUUID(),
      name: source.name,
      description: source.description,
      steps: [],
    };
  }

  return {
    id: randomUUID(),
    name: source.name,
    description: source.description,
    steps: source.steps.map((step) => ({
      id: randomUUID(),
      step_number: step.step_number,
      subject: step.subject,
      body: step.body,
      delay_days: step.delay_days,
      variants: (step.variants ?? []).map((variant) => ({
        id: randomUUID(),
        variant_name: variant.variant_name,
        subject: variant.subject,
        body: variant.body,
        is_active: variant.is_active,
        variant_letter: variant.variant_letter,
      })),
    })),
  };
}

function cloneScheduleData(source: unknown): unknown | null {
  if (!source) return null;
  const parsed = parseScheduleData(source);
  if (!parsed.schedules.length) {
    return parsed;
  }

  const idMap = new Map<string, string>();
  const schedules = parsed.schedules.map((schedule) => {
    const newId = randomUUID();
    idMap.set(schedule.id, newId);
    return { ...schedule, id: newId };
  });

  const activeScheduleId =
    parsed.activeScheduleId === "default"
      ? "default"
      : (idMap.get(parsed.activeScheduleId) ?? schedules[0]?.id ?? "default");

  return {
    activeScheduleId,
    schedules,
  };
}

type SourceRecipientRow = {
  user_id: string;
  user_type_at_send: string;
};

async function copyCampaignRecipients(
  sourceCampaignId: string,
  newCampaignId: string,
): Promise<number> {
  const db = createAdminClient();
  const PAGE = 1000;
  let offset = 0;
  let copied = 0;
  const now = new Date().toISOString();

  while (true) {
    const { data: rows, error } = await db
      .from("admin_email_campaign_recipients")
      .select("user_id, user_type_at_send")
      .eq("campaign_id", sourceCampaignId)
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (rows ?? []) as SourceRecipientRow[];
    if (batch.length === 0) break;

    const insertRows = batch.map((row) => ({
      campaign_id: newCampaignId,
      user_id: row.user_id,
      user_type_at_send: row.user_type_at_send,
      email_delivery_status: "pending" as const,
      current_step_number: 1,
      next_email_scheduled_at: null,
      ses_message_id: null,
      from_email: null,
      skipped_reason: null,
      opened_at: null,
      clicked_at: null,
      created_at: now,
      updated_at: now,
    }));

    const CHUNK = 500;
    for (let i = 0; i < insertRows.length; i += CHUNK) {
      const { error: insertError } = await db
        .from("admin_email_campaign_recipients")
        .insert(insertRows.slice(i, i + CHUNK));
      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    copied += batch.length;
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  return copied;
}

export async function duplicateEmailCampaign(
  sourceCampaignId: string,
  createdBy: string,
  nameOverride?: string,
) {
  const db = createAdminClient();
  const { data: source, error: sourceError } = await db
    .from("admin_email_campaigns")
    .select(
      `
      project_id,
      name,
      email_subject,
      message_template,
      from_email,
      from_sender_id,
      from_sender_ids,
      use_project_schedule,
      daily_limit,
      schedule_from_time,
      schedule_to_time,
      schedule_timezone,
      schedule_days,
      stop_on_reply,
      sequence_data,
      schedule_data,
      contest_id,
      recipient_mode,
      filter_snapshot
    `,
    )
    .eq("id", sourceCampaignId)
    .single();

  if (sourceError || !source) {
    throw new Error("Campaign not found");
  }

  const baseName = nameOverride?.trim() || `${source.name} (Copy)`;
  let duplicateName = baseName;
  let suffix = 2;

  while (true) {
    const { data: existing } = await db
      .from("admin_email_campaigns")
      .select("id")
      .eq("project_id", source.project_id)
      .eq("name", duplicateName)
      .maybeSingle();

    if (!existing) break;
    duplicateName = `${baseName} ${suffix}`;
    suffix += 1;
  }

  const sequenceData = cloneSequenceData(
    source.sequence_data as StoredSequence | null,
  );
  const scheduleData = cloneScheduleData(source.schedule_data);

  const { data: campaign, error: insertError } = await db
    .from("admin_email_campaigns")
    .insert({
      project_id: source.project_id,
      name: duplicateName,
      status: "draft",
      email_subject: source.email_subject,
      message_template: source.message_template,
      from_email: source.from_email,
      from_sender_id: source.from_sender_id,
      from_sender_ids: source.from_sender_ids ?? [],
      use_project_schedule: source.use_project_schedule,
      daily_limit: source.daily_limit,
      schedule_from_time: source.schedule_from_time,
      schedule_to_time: source.schedule_to_time,
      schedule_timezone: source.schedule_timezone,
      schedule_days: source.schedule_days,
      stop_on_reply: source.stop_on_reply,
      sequence_data: sequenceData,
      schedule_data: scheduleData,
      contest_id: source.contest_id,
      recipient_count: 0,
      sent_count: 0,
      recipient_mode: null,
      filter_snapshot: null,
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      created_by: createdBy,
    })
    .select("id, name, status, project_id")
    .single();

  if (insertError || !campaign) {
    throw new Error(insertError?.message ?? "Failed to duplicate campaign");
  }

  let copiedRecipientCount = 0;
  try {
    copiedRecipientCount = await copyCampaignRecipients(
      sourceCampaignId,
      campaign.id,
    );
  } catch (recipientError) {
    await db.from("admin_email_campaigns").delete().eq("id", campaign.id);
    throw recipientError instanceof Error
      ? recipientError
      : new Error("Failed to copy campaign leads");
  }

  if (copiedRecipientCount > 0) {
    const { error: updateError } = await db
      .from("admin_email_campaigns")
      .update({
        recipient_count: copiedRecipientCount,
        recipient_mode: source.recipient_mode,
        filter_snapshot: source.filter_snapshot,
        status: "configured",
      })
      .eq("id", campaign.id);

    if (updateError) {
      await db
        .from("admin_email_campaign_recipients")
        .delete()
        .eq("campaign_id", campaign.id);
      await db.from("admin_email_campaigns").delete().eq("id", campaign.id);
      throw new Error(updateError.message);
    }
  }

  return {
    ...campaign,
    status: copiedRecipientCount > 0 ? "configured" : campaign.status,
    copiedRecipientCount,
  };
}
