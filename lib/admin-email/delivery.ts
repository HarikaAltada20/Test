import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildBulkEmailHtml,
  buildBulkEmailSubject,
  getUnsubscribeFooter,
} from "@/lib/email/admin-bulk-email";
import { sendSesEmail } from "@/lib/email/ses-client";
import {
  enqueueAdminEmailDeliveryJob,
  isAdminEmailDeliveryQueueEnabled,
} from "@/lib/queue/admin-email-delivery-queue";
import {
  isQStashEnabled,
  triggerProcessAdminEmailDeliveryQueue,
} from "@/lib/qstash";
import type { ContestTemplateContext } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import { EMAIL_DELIVERY_BATCH_SIZE } from "./types";

async function loadContestContext(
  contestId: string | null,
): Promise<ContestTemplateContext | null> {
  if (!contestId) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("contests")
    .select("id, title")
    .eq("id", contestId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, title: data.title?.trim() || "Untitled contest" };
}

async function loadUsersByIds(userIds: string[]): Promise<RecipientUserRow[]> {
  if (userIds.length === 0) return [];
  const db = createAdminClient();
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

export async function loadNextPendingEmailRecipients(
  campaignId: string,
  limit = EMAIL_DELIVERY_BATCH_SIZE,
): Promise<string[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending")
    .order("user_id", { ascending: true })
    .limit(limit);
  return (data ?? []).map((r) => r.user_id);
}

export async function countPendingEmailRecipients(
  campaignId: string,
): Promise<number> {
  const db = createAdminClient();
  const { count } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending");
  return count ?? 0;
}

export async function deliverEmailCampaignBatch(
  campaignId: string,
  userIds: string[],
): Promise<{ successCount: number; failureCount: number; skippedCount: number }> {
  if (userIds.length === 0) {
    return { successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  const db = createAdminClient();
  const { data: campaign, error: campaignError } = await db
    .from("admin_email_campaigns")
    .select(
      "id, email_subject, message_template, from_email, status, contest_id, project_id",
    )
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Campaign not found");
  }

  if (campaign.status === "paused" || campaign.status === "completed") {
    return { successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  if (!campaign.email_subject || !campaign.message_template || !campaign.from_email) {
    throw new Error("Campaign is not fully configured");
  }

  const { data: suppressed } = await db
    .from("email_suppressions")
    .select("email");

  const suppressedSet = new Set(
    (suppressed ?? []).map((s) => s.email.toLowerCase()),
  );

  const users = await loadUsersByIds(userIds);
  const contest = await loadContestContext(campaign.contest_id);
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  const now = new Date().toISOString();

  for (const user of users) {
    if (!user.email || suppressedSet.has(user.email.toLowerCase())) {
      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "skipped",
          skipped_reason: "suppressed",
          updated_at: now,
        })
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("email_delivery_status", "pending");
      skippedCount += 1;
      continue;
    }

    const { data: trackingRow } = await db
      .from("admin_email_tracking")
      .upsert(
        { campaign_id: campaignId, user_id: user.id },
        { onConflict: "campaign_id,user_id" },
      )
      .select("tracking_id")
      .single();

    const trackingId = trackingRow?.tracking_id;
    if (!trackingId) {
      failureCount += 1;
      continue;
    }

    const subject = buildBulkEmailSubject(
      campaign.email_subject,
      user,
      contest,
    );
    const { html } = buildBulkEmailHtml({
      bodyTemplate: campaign.message_template,
      user,
      trackingId,
      contest,
    });
    const fullHtml = html + getUnsubscribeFooter(user.id);

    const sendResult = await sendSesEmail({
      from: campaign.from_email,
      to: user.email,
      subject,
      html: fullHtml,
    });

    if (sendResult.messageId) {
      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "sent",
          ses_message_id: sendResult.messageId,
          from_email: campaign.from_email,
          updated_at: now,
        })
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("email_delivery_status", "pending");
      successCount += 1;
    } else {
      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "failed",
          skipped_reason: sendResult.error ?? "send failed",
          updated_at: now,
        })
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("email_delivery_status", "pending");
      failureCount += 1;
    }
  }

  await refreshEmailCampaignSentCount(campaignId);
  return { successCount, failureCount, skippedCount };
}

async function refreshEmailCampaignSentCount(campaignId: string): Promise<void> {
  const db = createAdminClient();
  const { count: totalSent } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("email_delivery_status", ["sent", "delivered", "opened", "clicked"]);

  await db
    .from("admin_email_campaigns")
    .update({ sent_count: totalSent ?? 0 })
    .eq("id", campaignId);
}

async function finalizeEmailCampaignDelivery(campaignId: string): Promise<void> {
  const db = createAdminClient();
  const pending = await countPendingEmailRecipients(campaignId);
  await refreshEmailCampaignSentCount(campaignId);

  if (pending === 0) {
    const { count: failedCount } = await db
      .from("admin_email_campaign_recipients")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("email_delivery_status", ["failed", "bounced"]);

    await db
      .from("admin_email_campaigns")
      .update({
        status: (failedCount ?? 0) > 0 ? "partial" : "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
  }
}

async function triggerEmailDeliveryProcessor(
  baseUrl?: string,
  campaignId?: string,
): Promise<{ triggered: boolean; error?: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const url = `${(baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/cron/process-admin-email-delivery-queue`;
  const body = campaignId ? JSON.stringify({ campaignId }) : "{}";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body,
    });
    if (!res.ok) {
      return { triggered: false, error: `HTTP ${res.status}` };
    }
    return { triggered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { triggered: false, error: message };
  }
}

export async function processEmailCampaignDeliveryJob(
  campaignId: string,
  baseUrl?: string,
): Promise<{
  batchDelivered: number;
  hasMore: boolean;
  finalized: boolean;
}> {
  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  if (
    !campaign ||
    campaign.status === "paused" ||
    campaign.status === "completed"
  ) {
    return { batchDelivered: 0, hasMore: false, finalized: false };
  }

  const userIds = await loadNextPendingEmailRecipients(campaignId);
  if (userIds.length === 0) {
    await finalizeEmailCampaignDelivery(campaignId);
    return { batchDelivered: 0, hasMore: false, finalized: true };
  }

  const { successCount, failureCount, skippedCount } =
    await deliverEmailCampaignBatch(campaignId, userIds);
  const batchDelivered = successCount + failureCount + skippedCount;

  const stillPending = await countPendingEmailRecipients(campaignId);
  if (stillPending > 0) {
    if (isAdminEmailDeliveryQueueEnabled()) {
      await enqueueAdminEmailDeliveryJob({ campaignId });
    }
    await triggerEmailDeliveryProcessor(baseUrl, campaignId);
    return { batchDelivered, hasMore: true, finalized: false };
  }

  await finalizeEmailCampaignDelivery(campaignId);
  return { batchDelivered, hasMore: false, finalized: true };
}

export async function startEmailCampaignDelivery(
  campaignId: string,
  baseUrl?: string,
): Promise<{ started: boolean; reason?: string }> {
  const db = createAdminClient();

  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("id, status, email_subject, message_template, from_email")
    .eq("id", campaignId)
    .single();

  if (!campaign) return { started: false, reason: "not_found" };
  if (!campaign.email_subject || !campaign.message_template || !campaign.from_email) {
    return { started: false, reason: "not_configured" };
  }

  const now = new Date().toISOString();
  await db
    .from("admin_email_campaigns")
    .update({
      status: "active",
      started_at: now,
    })
    .eq("id", campaignId);

  if (isAdminEmailDeliveryQueueEnabled()) {
    const { error } = await enqueueAdminEmailDeliveryJob({ campaignId });
    if (error) {
      return { started: false, reason: "enqueue_failed" };
    }
    if (isQStashEnabled()) {
      await triggerProcessAdminEmailDeliveryQueue(baseUrl);
    } else {
      const triggered = await triggerEmailDeliveryProcessor(baseUrl, campaignId);
      if (!triggered.triggered) {
        return { started: false, reason: "processor_trigger_failed" };
      }
    }
    return { started: true };
  }

  const triggered = await triggerEmailDeliveryProcessor(baseUrl, campaignId);
  if (!triggered.triggered) {
    return { started: false, reason: "processor_trigger_failed" };
  }
  return { started: true };
}
