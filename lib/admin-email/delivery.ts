import { createAdminClient } from "@/utils/supabase/admin";
import {
  buildBulkEmailHtml,
  buildBulkEmailSubject,
  getBulkEmailFromName,
  getBulkEmailReplyTo,
} from "@/lib/email/admin-bulk-email";
import { sendSesEmail } from "@/lib/email/ses-client";
import {
  enqueueAdminEmailDeliveryJob,
  isAdminEmailDeliveryQueueEnabled,
} from "@/lib/queue/admin-email-delivery-queue";
import {
  isLoopbackUrl,
  isQStashEnabled,
  resolveQstashBaseUrl,
  triggerProcessAdminEmailDeliveryQueue,
  triggerProcessAdminEmailDeliveryQueueDelayed,
} from "@/lib/qstash";
import type { ContestTemplateContext } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import { EMAIL_DELIVERY_BATCH_SIZE } from "./types";
import { resolveRecipientEmailContent } from "./sequence-store";
import type { StoredSequence } from "./sequence-types";
import { evaluateCampaignSendGate, resolveEffectiveSchedule } from "./schedule";

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
): Promise<{
  successCount: number;
  failureCount: number;
  skippedCount: number;
}> {
  if (userIds.length === 0) {
    return { successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  const db = createAdminClient();
  const { data: campaign, error: campaignError } = await db
    .from("admin_email_campaigns")
    .select(
      "id, email_subject, message_template, from_email, status, contest_id, project_id, sequence_data",
    )
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Campaign not found");
  }

  if (campaign.status === "paused" || campaign.status === "completed") {
    return { successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  if (
    !campaign.email_subject ||
    !campaign.message_template ||
    !campaign.from_email
  ) {
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
  const campaignFallback = {
    subject: campaign.email_subject || "",
    body: campaign.message_template || "",
  };
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

    const { subject: emailSubject, body: messageTemplate } =
      resolveRecipientEmailContent(
        campaign.sequence_data as StoredSequence | null,
        user.id,
        campaignFallback,
      );

    if (!emailSubject.trim() || !messageTemplate.trim()) {
      failureCount += 1;
      continue;
    }

    const subject = buildBulkEmailSubject(emailSubject, user, contest);
    const { html, text, plainTextOnly, useRaw } = buildBulkEmailHtml({
      bodyTemplate: messageTemplate,
      user,
      trackingId,
      contest,
      personalInbox: true,
    });

    const sendResult = await sendSesEmail({
      from: campaign.from_email,
      fromName: getBulkEmailFromName(campaign.from_email),
      to: user.email,
      subject,
      html,
      text,
      replyTo: getBulkEmailReplyTo(campaign.from_email),
      plainTextOnly,
      useRaw,
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

      const { logOutboundUniboxMessage } = await import("./unibox");
      await logOutboundUniboxMessage({
        projectId: campaign.project_id,
        campaignId,
        userId: user.id,
        contactEmail: user.email,
        contactName: user.full_name ?? user.username,
        fromEmail: campaign.from_email,
        fromName: getBulkEmailFromName(campaign.from_email),
        subject,
        bodyHtml: html,
        bodyText: text,
        sesMessageId: sendResult.messageId,
      });

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

async function refreshEmailCampaignSentCount(
  campaignId: string,
): Promise<void> {
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

async function finalizeEmailCampaignDelivery(
  campaignId: string,
): Promise<void> {
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

async function scheduleEmailDeliveryRetry(
  campaignId: string,
  retryAt: Date,
  baseUrl?: string,
): Promise<void> {
  if (isAdminEmailDeliveryQueueEnabled()) {
    await enqueueAdminEmailDeliveryJob({ campaignId });
  }

  const qstashBaseUrl = resolveQstashBaseUrl(baseUrl);
  const qstash = await triggerProcessAdminEmailDeliveryQueueDelayed(
    qstashBaseUrl,
    campaignId,
    retryAt,
  );
  if (!qstash.error) return;

  const delayMs = Math.max(1_000, retryAt.getTime() - Date.now());
  const cappedDelayMs = Math.min(delayMs, 24 * 60 * 60 * 1000);
  const url = `${qstashBaseUrl}/api/cron/process-admin-email-delivery-queue`;
  const cronSecret = process.env.CRON_SECRET;
  setTimeout(() => {
    void fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({ campaignId }),
    }).catch((err) => {
      console.warn("[admin-email] deferred delivery retry failed:", err);
    });
  }, cappedDelayMs);
}

async function triggerEmailDeliveryProcessor(
  baseUrl?: string,
  campaignId?: string,
): Promise<{ triggered: boolean; error?: string }> {
  const qstashBaseUrl = resolveQstashBaseUrl(baseUrl);

  if (isQStashEnabled() && !isLoopbackUrl(qstashBaseUrl)) {
    const qstash = campaignId
      ? await triggerProcessAdminEmailDeliveryQueueDelayed(
          qstashBaseUrl,
          campaignId,
          new Date(),
        )
      : await triggerProcessAdminEmailDeliveryQueue(qstashBaseUrl);
    if (!qstash.error) {
      return { triggered: true };
    }
    console.warn(
      "[admin-email] QStash trigger failed, falling back to direct processor:",
      qstash.error,
    );
  }

  let targetCampaignId = campaignId;
  if (!targetCampaignId) {
    targetCampaignId = (await findCampaignNeedingDelivery()) ?? undefined;
  }
  if (!targetCampaignId) {
    return { triggered: false, error: "no_campaign" };
  }
  try {
    await processEmailCampaignDeliveryJob(targetCampaignId, qstashBaseUrl);
    return { triggered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[admin-email] direct delivery processor failed:", message);
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
  deferred?: boolean;
  deferReason?: string;
}> {
  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select(
      `
      id,
      status,
      scheduled_at,
      started_at,
      project_id,
      use_project_schedule,
      daily_limit,
      schedule_from_time,
      schedule_to_time,
      schedule_timezone,
      schedule_days,
      schedule_data
    `,
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (
    !campaign ||
    campaign.status === "paused" ||
    campaign.status === "completed"
  ) {
    return { batchDelivered: 0, hasMore: false, finalized: false };
  }

  if (campaign.status === "scheduled") {
    const due = campaign.scheduled_at ? new Date(campaign.scheduled_at) : null;
    if (due && due.getTime() > Date.now() + 60_000) {
      await scheduleEmailDeliveryRetry(campaignId, due, baseUrl);
      return {
        batchDelivered: 0,
        hasMore: true,
        finalized: false,
        deferred: true,
        deferReason: "not_due",
      };
    }

    await db
      .from("admin_email_campaigns")
      .update({
        status: "active",
        started_at: campaign.started_at ?? new Date().toISOString(),
      })
      .eq("id", campaignId);
    campaign.status = "active";
  }

  const { data: project } = await db
    .from("admin_email_projects")
    .select(
      "daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days",
    )
    .eq("id", campaign.project_id)
    .maybeSingle();

  const schedule = resolveEffectiveSchedule(campaign, project);
  const gate = await evaluateCampaignSendGate(campaignId, schedule, {
    scheduledAt: campaign.scheduled_at,
  });

  if (!gate.allowed) {
    await scheduleEmailDeliveryRetry(campaignId, gate.retryAt, baseUrl);
    console.log("[admin-email] delivery deferred by schedule", {
      campaignId,
      reason: gate.reason,
      retryAt: gate.retryAt.toISOString(),
      timezone: schedule.timezone,
      fromTime: schedule.fromTime,
      toTime: schedule.toTime,
    });
    return {
      batchDelivered: 0,
      hasMore: true,
      finalized: false,
      deferred: true,
      deferReason: gate.reason,
    };
  }

  const userIds = await loadNextPendingEmailRecipients(
    campaignId,
    gate.batchLimit,
  );
  if (userIds.length === 0) {
    await finalizeEmailCampaignDelivery(campaignId);
    return { batchDelivered: 0, hasMore: false, finalized: true };
  }

  const { successCount, failureCount, skippedCount } =
    await deliverEmailCampaignBatch(campaignId, userIds);
  const batchDelivered = successCount + failureCount + skippedCount;

  const stillPending = await countPendingEmailRecipients(campaignId);
  if (stillPending > 0) {
    const nextGate = await evaluateCampaignSendGate(campaignId, schedule, {
      scheduledAt: campaign.scheduled_at,
    });
    if (!nextGate.allowed) {
      await scheduleEmailDeliveryRetry(campaignId, nextGate.retryAt, baseUrl);
      return {
        batchDelivered,
        hasMore: true,
        finalized: false,
        deferred: true,
        deferReason: nextGate.reason,
      };
    }

    if (isAdminEmailDeliveryQueueEnabled()) {
      await enqueueAdminEmailDeliveryJob({ campaignId });
    }
    await triggerEmailDeliveryProcessor(baseUrl, campaignId);
    return { batchDelivered, hasMore: true, finalized: false };
  }

  await finalizeEmailCampaignDelivery(campaignId);
  return { batchDelivered, hasMore: false, finalized: true };
}

/** Find an active campaign with pending recipients (cron fallback). */
export async function findCampaignNeedingDelivery(): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("admin_email_campaigns")
    .select("id")
    .in("status", ["active", "scheduled"])
    .order("started_at", { ascending: true, nullsFirst: true })
    .limit(25);

  for (const row of data ?? []) {
    const pending = await countPendingEmailRecipients(row.id);
    if (pending > 0) return row.id;
  }
  return null;
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
  if (
    !campaign.email_subject ||
    !campaign.message_template ||
    !campaign.from_email
  ) {
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

  const qstashBaseUrl = resolveQstashBaseUrl(baseUrl);

  if (isAdminEmailDeliveryQueueEnabled()) {
    const { error } = await enqueueAdminEmailDeliveryJob({ campaignId });
    if (error) {
      return { started: false, reason: "enqueue_failed" };
    }
    if (isQStashEnabled() && !isLoopbackUrl(qstashBaseUrl)) {
      const qstash = await triggerProcessAdminEmailDeliveryQueue(qstashBaseUrl);
      if (!qstash.error) {
        console.log("[admin-email] campaign started via QStash", {
          campaignId,
          qstashBaseUrl,
          messageId: qstash.messageId,
        });
        return { started: true };
      }
      console.warn(
        "[admin-email] QStash trigger failed, falling back to direct processor:",
        qstash.error,
      );
    }
    const triggered = await triggerEmailDeliveryProcessor(
      qstashBaseUrl,
      campaignId,
    );
    if (!triggered.triggered) {
      return { started: false, reason: "processor_trigger_failed" };
    }
    return { started: true };
  }

  const triggered = await triggerEmailDeliveryProcessor(
    qstashBaseUrl,
    campaignId,
  );
  if (!triggered.triggered) {
    return { started: false, reason: "processor_trigger_failed" };
  }
  return { started: true };
}
