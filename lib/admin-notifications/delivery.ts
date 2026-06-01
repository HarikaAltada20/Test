import { createAdminClient } from "@/utils/supabase/admin";
import {
  resolveNotificationTemplate,
  type ContestTemplateContext,
} from "./template";
import type { RecipientUserRow } from "./types";
import { PUBLIC_ANNOUNCEMENT_TITLE, SYNC_DELIVERY_LIMIT } from "./types";
import {
  userNotificationInsertTimestamps,
  userNotificationNow,
} from "@/lib/user-notifications/timestamps";

async function loadContestTemplateContext(
  contestId: string | null | undefined,
): Promise<ContestTemplateContext | null> {
  if (!contestId) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("contests")
    .select("id, title")
    .eq("id", contestId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    title: data.title?.trim() || "Untitled contest",
  };
}

export async function deliverCampaignNotifications(
  campaignId: string,
  recipients: RecipientUserRow[],
): Promise<{
  successCount: number;
  failureCount: number;
  failedUserIds: string[];
}> {
  const db = createAdminClient();

  const { data: campaign, error: campaignError } = await db
    .from("admin_notification_campaigns")
    .select(
      "id, message_template, notification_type, timezone_label, contest_id",
    )
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Campaign not found");
  }

  const contest = await loadContestTemplateContext(campaign.contest_id);
  const tz =
    campaign.timezone_label === "local" ? "local" : ("UTC" as const);
  let successCount = 0;
  let failureCount = 0;
  const failedUserIds: string[] = [];

  for (const user of recipients) {
    const messageResolved = resolveNotificationTemplate(
      campaign.message_template,
      user,
      tz,
      contest,
    );

    const deliveredAt = userNotificationNow();
    const { error: notifError } = await db.from("user_notifications").insert({
      user_id: user.id,
      campaign_id: campaignId,
      contest_id: contest?.id ?? null,
      notification_type: campaign.notification_type,
      title: PUBLIC_ANNOUNCEMENT_TITLE,
      message_template: campaign.message_template,
      message_resolved: messageResolved,
      ...userNotificationInsertTimestamps(deliveredAt),
    });

    if (notifError) {
      failureCount += 1;
      failedUserIds.push(user.id);
      await db
        .from("admin_notification_campaign_recipients")
        .update({ delivery_status: "failed" })
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id);
      continue;
    }

    successCount += 1;
    await db
      .from("admin_notification_campaign_recipients")
      .update({ delivery_status: "delivered" })
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id);
  }

  return { successCount, failureCount, failedUserIds };
}

export async function runCampaignDelivery(
  campaignId: string,
  recipients: RecipientUserRow[],
): Promise<{
  successCount: number;
  failureCount: number;
  status: "completed" | "partial" | "failed";
}> {
  const db = createAdminClient();

  await db
    .from("admin_notification_campaigns")
    .update({ status: "processing" })
    .eq("id", campaignId);

  const { successCount, failureCount } = await deliverCampaignNotifications(
    campaignId,
    recipients,
  );

  const status =
    failureCount === 0
      ? "completed"
      : successCount === 0
        ? "failed"
        : "partial";

  await db
    .from("admin_notification_campaigns")
    .update({
      status,
      success_count: successCount,
      failure_count: failureCount,
      recipient_count: recipients.length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return { successCount, failureCount, status };
}

export function shouldDeliverSynchronously(recipientCount: number): boolean {
  return recipientCount <= SYNC_DELIVERY_LIMIT;
}

export async function loadCampaignRecipients(
  campaignId: string,
): Promise<RecipientUserRow[]> {
  const db = createAdminClient();

  const { data: recipientRows, error } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "pending");

  if (error || !recipientRows?.length) {
    return [];
  }

  const userIds = recipientRows.map((r) => r.user_id);
  const users: RecipientUserRow[] = [];
  const CHUNK = 500;

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data } = await db
      .from("users")
      .select(
        "id, email, full_name, username, user_type, coins, referral_code, created_at, is_active",
      )
      .in("id", chunk);
    users.push(...((data ?? []) as RecipientUserRow[]));
  }

  return users;
}

/** Allow delivery up to 2 minutes before scheduled_at (clock / QStash skew). */
const SCHEDULE_DELIVERY_GRACE_MS = 2 * 60 * 1000;

/** Deliver one scheduled campaign (QStash) or no-op if cancelled / not due. */
export async function processScheduledCampaignById(
  campaignId: string,
  options?: { force?: boolean },
): Promise<{ processed: boolean; reason?: string }> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const { data: campaign, error } = await db
    .from("admin_notification_campaigns")
    .select("id, status, scheduled_at")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    return { processed: false, reason: "not_found" };
  }
  if (campaign.status !== "scheduled") {
    return { processed: false, reason: `status_${campaign.status}` };
  }
  if (!options?.force && campaign.scheduled_at) {
    const dueMs = new Date(campaign.scheduled_at).getTime();
    if (dueMs > nowMs + SCHEDULE_DELIVERY_GRACE_MS) {
      return { processed: false, reason: "not_due" };
    }
  }

  const { data: locked } = await db
    .from("admin_notification_campaigns")
    .update({ status: "processing" })
    .eq("id", campaignId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (!locked) {
    return { processed: false, reason: "lock_failed" };
  }

  const recipients = await loadCampaignRecipients(campaignId);
  if (recipients.length === 0) {
    await db
      .from("admin_notification_campaigns")
      .update({
        status: "failed",
        completed_at: now,
      })
      .eq("id", campaignId);
    return { processed: false, reason: "no_recipients" };
  }

  await runCampaignDelivery(campaignId, recipients);
  return { processed: true };
}

export async function processDueScheduledCampaigns(limit = 50): Promise<number> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await db
    .from("admin_notification_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error || !due?.length) {
    return 0;
  }

  let processed = 0;
  for (const row of due) {
    const { data: locked } = await db
      .from("admin_notification_campaigns")
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();

    if (!locked) continue;

    const recipients = await loadCampaignRecipients(row.id);
    if (recipients.length === 0) {
      await db
        .from("admin_notification_campaigns")
        .update({
          status: "failed",
          completed_at: now,
        })
        .eq("id", row.id);
      continue;
    }

    await runCampaignDelivery(row.id, recipients);
    processed += 1;
  }

  return processed;
}
