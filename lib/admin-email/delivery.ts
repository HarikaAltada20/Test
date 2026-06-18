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
import type { CampaignTemplateContext } from "@/lib/admin-notifications/template";
import type { RecipientUserRow } from "@/lib/admin-notifications/types";
import { loadRecipientUsersByIds } from "@/lib/admin-notifications/recipients";
import {
  pickSenderForRecipient,
  resolveCampaignSenders,
  campaignHasSenders,
} from "@/lib/admin-email/campaign-senders";
import { EMAIL_DELIVERY_BATCH_SIZE } from "./types";
import { resolveRecipientEmailContent } from "./sequence-store";
import type { StoredSequence } from "./sequence-types";
import {
  getActiveVariantsForStep,
  getNextStoredStep,
  getStoredStepByNumber,
  resolveStepEmailContent,
  computeNextStepScheduledAt,
} from "./sequence-store";
import { pickVariantByRecipientIndex } from "./sequence-variant-pick";
import { evaluateCampaignSendGate, resolveEffectiveSchedule } from "./schedule";
import { parseScheduleData } from "./schedule-store";

function shouldBypassScheduleGate(campaign: {
  scheduled_at: string | null;
  schedule_data?: unknown;
  use_project_schedule?: boolean;
}): boolean {
  if (campaign.scheduled_at) return false;
  if (campaign.use_project_schedule) return false;
  const scheduleData = parseScheduleData(campaign.schedule_data);
  if (scheduleData.schedules.length === 0) return true;
  return scheduleData.activeScheduleId === "default";
}

function isRecipientReadyForSend(
  row: {
    email_delivery_status: string;
    next_email_scheduled_at: string | null;
  },
  now: string,
): boolean {
  if (row.email_delivery_status === "pending") return true;
  if (!row.next_email_scheduled_at) return true;
  return row.next_email_scheduled_at <= now;
}

/** Reset stuck recipient rows so delivery can pick them up. */
export async function repairRecipientsForDelivery(
  campaignId: string,
): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data: pendingRows } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending");

  const pendingUserIds = (pendingRows ?? []).map((row) => row.user_id);
  if (pendingUserIds.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < pendingUserIds.length; i += CHUNK) {
      const chunk = pendingUserIds.slice(i, i + CHUNK);
      await db
        .from("admin_email_sequence_step_sends")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("step_number", 1)
        .in("user_id", chunk);
    }
  }

  await db
    .from("admin_email_campaign_recipients")
    .update({
      current_step_number: 1,
      next_email_scheduled_at: null,
      updated_at: now,
    })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "pending");

  await db
    .from("admin_email_campaign_recipients")
    .update({
      next_email_scheduled_at: now,
      updated_at: now,
    })
    .eq("campaign_id", campaignId)
    .eq("email_delivery_status", "in_sequence")
    .is("next_email_scheduled_at", null);
}

async function countIncompleteRecipients(campaignId: string): Promise<number> {
  const db = createAdminClient();
  const { count } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("email_delivery_status", ["pending", "in_sequence"]);
  return count ?? 0;
}

async function loadPendingRecipientUserIds(
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

  return (data ?? []).map((row) => row.user_id);
}

async function loadUsersByIds(userIds: string[]): Promise<RecipientUserRow[]> {
  return loadRecipientUsersByIds(userIds);
}

export async function loadNextPendingEmailRecipients(
  campaignId: string,
  limit = EMAIL_DELIVERY_BATCH_SIZE,
): Promise<string[]> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id, email_delivery_status, next_email_scheduled_at")
    .eq("campaign_id", campaignId)
    .in("email_delivery_status", ["pending", "in_sequence"])
    .order("user_id", { ascending: true })
    .limit(Math.max(limit * 4, limit));

  const ready = (data ?? []).filter((row) => isRecipientReadyForSend(row, now));

  return ready.slice(0, limit).map((r) => r.user_id);
}

export async function countPendingEmailRecipients(
  campaignId: string,
): Promise<number> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id, email_delivery_status, next_email_scheduled_at")
    .eq("campaign_id", campaignId)
    .in("email_delivery_status", ["pending", "in_sequence"]);

  return (data ?? []).filter((row) => {
    if (
      row.email_delivery_status === "pending" &&
      !row.next_email_scheduled_at
    ) {
      return true;
    }
    if (row.next_email_scheduled_at && row.next_email_scheduled_at <= now) {
      return true;
    }
    if (row.email_delivery_status === "in_sequence") {
      return true;
    }
    return false;
  }).length;
}

/** Earliest future send time for leads waiting between sequence steps. */
export async function getNextSequenceScheduledAt(
  campaignId: string,
): Promise<Date | null> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { data } = await db
    .from("admin_email_campaign_recipients")
    .select("next_email_scheduled_at")
    .eq("campaign_id", campaignId)
    .in("email_delivery_status", ["pending", "in_sequence"])
    .not("next_email_scheduled_at", "is", null)
    .gt("next_email_scheduled_at", now)
    .order("next_email_scheduled_at", { ascending: true })
    .limit(1);

  const raw = data?.[0]?.next_email_scheduled_at;
  return raw ? new Date(raw) : null;
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
      "id, name, email_subject, message_template, from_email, from_sender_id, from_sender_ids, status, contest_id, project_id, sequence_data",
    )
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message ?? "Campaign not found");
  }

  if (campaign.status === "paused" || campaign.status === "completed") {
    return { successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  if (!campaign.email_subject || !campaign.message_template) {
    throw new Error("Campaign is not fully configured");
  }

  const campaignSenders = await resolveCampaignSenders(db, campaign);
  if (campaignSenders.length === 0) {
    throw new Error("Campaign has no sender accounts configured");
  }

  const { data: suppressed } = await db
    .from("email_suppressions")
    .select("email");

  const suppressedSet = new Set(
    (suppressed ?? []).map((s) => s.email.toLowerCase()),
  );

  const users = await loadUsersByIds(userIds);
  const campaignContext: CampaignTemplateContext | null = campaign.name?.trim()
    ? { name: campaign.name.trim() }
    : null;
  const campaignFallback = {
    subject: campaign.email_subject || "",
    body: campaign.message_template || "",
  };
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  const now = new Date().toISOString();

  const sequence = campaign.sequence_data as StoredSequence | null;
  const sequenceSteps = sequence?.steps ?? [];
  const useSequenceSteps = sequenceSteps.length > 0;

  for (const user of users) {
    const { data: recipientRow } = await db
      .from("admin_email_campaign_recipients")
      .select(
        "user_id, email_delivery_status, current_step_number, next_email_scheduled_at, from_email",
      )
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      !recipientRow ||
      !["pending", "in_sequence"].includes(recipientRow.email_delivery_status)
    ) {
      skippedCount += 1;
      continue;
    }

    const scheduledAt = recipientRow.next_email_scheduled_at;
    if (
      scheduledAt &&
      new Date(scheduledAt).getTime() > Date.now() &&
      recipientRow.email_delivery_status === "in_sequence"
    ) {
      skippedCount += 1;
      continue;
    }

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
        .in("email_delivery_status", ["pending", "in_sequence"]);
      skippedCount += 1;
      continue;
    }

    const stepNumber = recipientRow.current_step_number ?? 1;

    const { data: existingSend } = await db
      .from("admin_email_sequence_step_sends")
      .select("id, ses_message_id, variant_id")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .eq("step_number", stepNumber)
      .maybeSingle();

    let reservedVariantId: string | null = existingSend?.variant_id ?? null;

    if (existingSend?.ses_message_id) {
      // Already sent via SES — sync recipient state only.
      const nextStep = useSequenceSteps
        ? getNextStoredStep(sequence, stepNumber)
        : null;
      if (nextStep) {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "in_sequence",
            current_step_number: nextStep.step_number,
            next_email_scheduled_at: computeNextStepScheduledAt(
              nextStep,
              new Date(),
            ).toISOString(),
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .in("email_delivery_status", ["pending", "in_sequence"]);
      } else {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "sent",
            next_email_scheduled_at: null,
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .in("email_delivery_status", ["pending", "in_sequence"]);
      }
      skippedCount += 1;
      continue;
    }

    if (existingSend && !existingSend.ses_message_id) {
      await db
        .from("admin_email_sequence_step_sends")
        .delete()
        .eq("id", existingSend.id);
    }

    let emailSubject: string;
    let messageTemplate: string;
    let stepId: string | null = null;
    let variantId: string | null = reservedVariantId;

    if (useSequenceSteps) {
      const step = getStoredStepByNumber(sequence, stepNumber);
      if (!step) {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "sent",
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .in("email_delivery_status", ["pending", "in_sequence"]);
        skippedCount += 1;
        continue;
      }

      stepId = step.id;
      const activeVariants = getActiveVariantsForStep(step);
      let variant =
        reservedVariantId != null
          ? (activeVariants.find((v) => v.id === reservedVariantId) ?? null)
          : null;
      if (!variant && activeVariants.length > 0) {
        variant = await pickVariantByRecipientIndex(
          campaignId,
          user.id,
          activeVariants,
        );
        variantId = variant.id;
      }

      const resolved = resolveStepEmailContent(step, variant, campaignFallback);
      emailSubject = resolved.subject;
      messageTemplate = resolved.body;
      variantId = resolved.variantId ?? variantId;
    } else {
      const resolved = resolveRecipientEmailContent(
        sequence,
        user.id,
        campaignFallback,
      );
      emailSubject = resolved.subject;
      messageTemplate = resolved.body;
      variantId = resolved.variantId ?? null;
    }

    if (!emailSubject.trim() || !messageTemplate.trim()) {
      failureCount += 1;
      continue;
    }

    const { data: trackingRow } = await db
      .from("admin_email_tracking")
      .upsert(
        {
          campaign_id: campaignId,
          user_id: user.id,
          step_number: stepNumber,
        },
        { onConflict: "campaign_id,user_id,step_number" },
      )
      .select("tracking_id")
      .single();

    const trackingId = trackingRow?.tracking_id;
    if (!trackingId) {
      failureCount += 1;
      continue;
    }

    const subject = buildBulkEmailSubject(emailSubject, user, {
      campaign: campaignContext,
    });
    const { html, text, plainTextOnly, useRaw } = buildBulkEmailHtml({
      bodyTemplate: messageTemplate,
      user,
      trackingId,
      campaign: campaignContext,
      personalInbox: true,
    });

    const sendFromEmail =
      recipientRow.from_email?.trim() ||
      pickSenderForRecipient(user.id, campaignSenders).email;

    const sendResult = await sendSesEmail({
      from: sendFromEmail,
      fromName: getBulkEmailFromName(sendFromEmail),
      to: user.email,
      subject,
      html,
      text,
      replyTo: getBulkEmailReplyTo(sendFromEmail),
      plainTextOnly,
      useRaw,
    });

    if (sendResult.messageId) {
      if (useSequenceSteps && stepId) {
        await db.from("admin_email_sequence_step_sends").insert({
          campaign_id: campaignId,
          user_id: user.id,
          step_number: stepNumber,
          step_id: stepId,
          variant_id: variantId,
          tracking_id: trackingId,
          ses_message_id: sendResult.messageId,
          email_delivery_status: "sent",
          sent_at: now,
        });
      }

      const nextStep = useSequenceSteps
        ? getNextStoredStep(sequence, stepNumber)
        : null;

      if (nextStep) {
        const nextScheduledAt = computeNextStepScheduledAt(
          nextStep,
          new Date(),
        ).toISOString();

        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "in_sequence",
            current_step_number: nextStep.step_number,
            next_email_scheduled_at: nextScheduledAt,
            ses_message_id: sendResult.messageId,
            from_email: sendFromEmail,
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .in("email_delivery_status", ["pending", "in_sequence"]);
      } else {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "sent",
            ses_message_id: sendResult.messageId,
            from_email: sendFromEmail,
            next_email_scheduled_at: null,
            updated_at: now,
          })
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .in("email_delivery_status", ["pending", "in_sequence"]);
      }

      const { logOutboundUniboxMessage } = await import("./unibox");
      await logOutboundUniboxMessage({
        projectId: campaign.project_id,
        campaignId,
        userId: user.id,
        contactEmail: user.email,
        contactName: user.full_name ?? user.username,
        fromEmail: sendFromEmail,
        fromName: getBulkEmailFromName(sendFromEmail),
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
        .in("email_delivery_status", ["pending", "in_sequence"]);
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
  const incomplete = await countIncompleteRecipients(campaignId);
  await refreshEmailCampaignSentCount(campaignId);

  if (incomplete === 0) {
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

function clampSendIntervalSeconds(seconds: number | null | undefined): number {
  return Math.max(1, Math.min(seconds ?? 60, 3600));
}

async function scheduleNextDeliveryJob(
  campaignId: string,
  baseUrl: string | undefined,
  options: { bypassScheduleGate: boolean; sendIntervalSeconds: number },
): Promise<void> {
  if (options.bypassScheduleGate) {
    if (isAdminEmailDeliveryQueueEnabled()) {
      await enqueueAdminEmailDeliveryJob({ campaignId });
    }
    await triggerEmailDeliveryProcessor(baseUrl, campaignId);
    return;
  }

  const intervalMs =
    clampSendIntervalSeconds(options.sendIntervalSeconds) * 1000;
  await scheduleEmailDeliveryRetry(
    campaignId,
    new Date(Date.now() + intervalMs),
    baseUrl,
  );
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

  await repairRecipientsForDelivery(campaignId);

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
      "daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days, send_interval_seconds",
    )
    .eq("id", campaign.project_id)
    .maybeSingle();

  const schedule = resolveEffectiveSchedule(campaign, project);
  const bypassScheduleGate = shouldBypassScheduleGate(campaign);
  const sendIntervalSeconds = clampSendIntervalSeconds(
    project?.send_interval_seconds,
  );
  const emailsPerJob = bypassScheduleGate ? undefined : 1;
  const projectScopeId = campaign.use_project_schedule
    ? campaign.project_id
    : undefined;
  const gate = bypassScheduleGate
    ? { allowed: true as const, batchLimit: EMAIL_DELIVERY_BATCH_SIZE }
    : await evaluateCampaignSendGate(campaignId, schedule, {
        scheduledAt: campaign.scheduled_at,
        projectId: projectScopeId,
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

  const jobBatchLimit = emailsPerJob ?? gate.batchLimit;
  let userIds = await loadNextPendingEmailRecipients(campaignId, jobBatchLimit);
  if (userIds.length === 0) {
    userIds = await loadPendingRecipientUserIds(campaignId, jobBatchLimit);
  }
  if (userIds.length === 0) {
    const stillIncomplete = await countIncompleteRecipients(campaignId);
    if (stillIncomplete > 0) {
      const nextAt = await getNextSequenceScheduledAt(campaignId);
      if (nextAt) {
        await scheduleEmailDeliveryRetry(campaignId, nextAt, baseUrl);
        return {
          batchDelivered: 0,
          hasMore: true,
          finalized: false,
          deferred: true,
          deferReason: "sequence_delay",
        };
      }
      await scheduleEmailDeliveryRetry(
        campaignId,
        new Date(Date.now() + 60_000),
        baseUrl,
      );
      return {
        batchDelivered: 0,
        hasMore: true,
        finalized: false,
        deferred: true,
        deferReason: "pending_wait",
      };
    }
    await finalizeEmailCampaignDelivery(campaignId);
    return { batchDelivered: 0, hasMore: false, finalized: true };
  }

  const { successCount, failureCount, skippedCount } =
    await deliverEmailCampaignBatch(campaignId, userIds);
  const batchDelivered = successCount + failureCount + skippedCount;

  const stillPending = await countIncompleteRecipients(campaignId);
  if (stillPending > 0) {
    const readyNow = await loadNextPendingEmailRecipients(campaignId, 1);
    if (readyNow.length === 0) {
      const nextAt = await getNextSequenceScheduledAt(campaignId);
      if (nextAt) {
        await scheduleEmailDeliveryRetry(campaignId, nextAt, baseUrl);
        return {
          batchDelivered,
          hasMore: true,
          finalized: false,
          deferred: true,
          deferReason: "sequence_delay",
        };
      }
    }

    const nextGate = bypassScheduleGate
      ? { allowed: true as const, batchLimit: EMAIL_DELIVERY_BATCH_SIZE }
      : await evaluateCampaignSendGate(campaignId, schedule, {
          scheduledAt: campaign.scheduled_at,
          projectId: projectScopeId,
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

    await scheduleNextDeliveryJob(campaignId, baseUrl, {
      bypassScheduleGate,
      sendIntervalSeconds,
    });
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
    .select(
      "id, status, email_subject, message_template, from_email, from_sender_id, from_sender_ids, project_id",
    )
    .eq("id", campaignId)
    .single();

  if (!campaign) return { started: false, reason: "not_found" };
  if (!campaign.email_subject || !campaign.message_template) {
    return { started: false, reason: "not_configured" };
  }

  const hasSenders = await campaignHasSenders(db, campaign);
  if (!hasSenders) {
    return { started: false, reason: "not_configured" };
  }

  const now = new Date().toISOString();
  await db
    .from("admin_email_campaigns")
    .update({
      status: "active",
      started_at: now,
      completed_at: null,
    })
    .eq("id", campaignId);

  await repairRecipientsForDelivery(campaignId);

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
