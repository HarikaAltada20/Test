import { createAdminClient } from "@/utils/supabase/admin";
import {
  enqueueAdminNotificationDeliveryJob,
  isAdminNotificationDeliveryQueueEnabled,
} from "@/lib/queue/admin-notification-delivery-queue";
import {
  isQStashEnabled,
  triggerProcessAdminNotificationDeliveryQueue,
} from "@/lib/qstash";
import {
  resolveNotificationTemplate,
  type ContestTemplateContext,
} from "./template";
import type { RecipientUserRow } from "./types";
import { loadRecipientUsersByIds } from "./recipients";
import { DELIVERY_BATCH_SIZE, PUBLIC_ANNOUNCEMENT_TITLE } from "./types";
import {
  campaignRecipientDeliveryStatusPatch,
} from "@/lib/admin-notifications/recipient-timestamps";
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

/** Next pending recipient user IDs for one delivery batch. */
export async function loadNextPendingRecipientUserIds(
  campaignId: string,
  limit = DELIVERY_BATCH_SIZE,
): Promise<string[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "pending")
    .order("user_id", { ascending: true })
    .limit(limit);

  if (error || !data?.length) return [];
  return data.map((r) => r.user_id);
}

export async function countPendingCampaignRecipients(
  campaignId: string,
): Promise<number> {
  const db = createAdminClient();
  const { count, error } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "pending");

  if (error) return 0;
  return count ?? 0;
}

async function loadUsersByIds(userIds: string[]): Promise<RecipientUserRow[]> {
  return loadRecipientUsersByIds(userIds);
}

/** Deliver one batch; only rows still `pending` are updated. */
export async function deliverCampaignBatch(
  campaignId: string,
  userIds: string[],
): Promise<{ successCount: number; failureCount: number }> {
  if (userIds.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

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

  const { data: stillPending } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id")
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "pending")
    .in("user_id", userIds);

  const pendingSet = new Set((stillPending ?? []).map((r) => r.user_id));
  const idsToDeliver = userIds.filter((id) => pendingSet.has(id));
  if (idsToDeliver.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const users = await loadUsersByIds(idsToDeliver);
  const userById = new Map(users.map((u) => [u.id, u]));

  const contest = await loadContestTemplateContext(campaign.contest_id);
  const tz = campaign.timezone_label === "local" ? "local" : ("UTC" as const);

  let successCount = 0;
  let failureCount = 0;

  for (const userId of idsToDeliver) {
    const deliveredAt = userNotificationNow();

    const user = userById.get(userId);
    if (!user) {
      failureCount += 1;
      await db
        .from("admin_notification_campaign_recipients")
        .update(campaignRecipientDeliveryStatusPatch("failed", deliveredAt))
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("delivery_status", "pending");
      continue;
    }

    const messageResolved = resolveNotificationTemplate(
      campaign.message_template,
      user,
      tz,
      { contest },
    );

    const { data: existingNotification } = await db
      .from("user_notifications")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    let notifError: { code?: string; message: string } | null = null;
    if (!existingNotification) {
      const insertResult = await db.from("user_notifications").insert({
        user_id: user.id,
        campaign_id: campaignId,
        contest_id: contest?.id ?? null,
        notification_type: campaign.notification_type,
        title: PUBLIC_ANNOUNCEMENT_TITLE,
        message_template: campaign.message_template,
        message_resolved: messageResolved,
        ...userNotificationInsertTimestamps(deliveredAt),
      });
      notifError = insertResult.error;
    }

    if (notifError) {
      // Parallel workers can still race and one can hit duplicate key; treat as delivered.
      if (notifError.code === "23505") {
        const { data: markedDuplicateDelivered } = await db
          .from("admin_notification_campaign_recipients")
          .update(campaignRecipientDeliveryStatusPatch("delivered", deliveredAt))
          .eq("campaign_id", campaignId)
          .eq("user_id", user.id)
          .eq("delivery_status", "pending")
          .select("user_id")
          .maybeSingle();
        if (markedDuplicateDelivered) {
          successCount += 1;
        }
        continue;
      }
      failureCount += 1;
      await db
        .from("admin_notification_campaign_recipients")
        .update(campaignRecipientDeliveryStatusPatch("failed", deliveredAt))
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .eq("delivery_status", "pending");
      continue;
    }

    const { data: markedDelivered, error: markDeliveredError } = await db
      .from("admin_notification_campaign_recipients")
      .update(campaignRecipientDeliveryStatusPatch("delivered", deliveredAt))
      .eq("campaign_id", campaignId)
      .eq("user_id", user.id)
      .eq("delivery_status", "pending")
      .select("user_id")
      .maybeSingle();

    // Another worker already handled this recipient state transition.
    if (!markedDelivered) {
      if (markDeliveredError) {
        console.warn(
          "[admin-notifications] failed to mark recipient delivered:",
          campaignId,
          user.id,
          markDeliveredError.message,
        );
      }
      continue;
    }

    successCount += 1;
  }

  return { successCount, failureCount };
}

export async function finalizeCampaignDelivery(campaignId: string): Promise<{
  successCount: number;
  failureCount: number;
  status: "completed" | "partial" | "failed";
}> {
  const db = createAdminClient();

  const countFor = async (status?: string) => {
    let query = db
      .from("admin_notification_campaign_recipients")
      .select("user_id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    if (status) {
      query = query.eq("delivery_status", status);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  };

  const [successCount, failureCount, recipientCount] = await Promise.all([
    countFor("delivered"),
    countFor("failed"),
    countFor(),
  ]);
  const status =
    failureCount === 0 && successCount > 0
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
      recipient_count: recipientCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return { successCount, failureCount, status };
}

async function triggerDeliveryProcessor(
  baseUrl?: string,
  campaignId?: string,
): Promise<{ triggered: boolean; error?: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const url = `${(baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/cron/process-admin-notification-delivery-queue`;
  const body = campaignId ? JSON.stringify({ campaignId }) : "{}";

  const doFetch = async (): Promise<{ triggered: boolean; error?: string }> => {
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
        const message = `HTTP ${res.status} from delivery processor`;
        console.warn("[admin-notifications] trigger delivery processor failed:", message);
        return { triggered: false, error: message };
      }
      return { triggered: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(
        "[admin-notifications] trigger delivery processor failed:",
        message,
      );
      return { triggered: false, error: message };
    }
  };

  if (isQStashEnabled()) {
    const res = await triggerProcessAdminNotificationDeliveryQueue(
      baseUrl,
      campaignId,
    );
    if (!res?.error) {
      return { triggered: true };
    }
    const fallback = await doFetch();
    if (fallback.triggered) return fallback;
    return {
      triggered: false,
      error: `QStash trigger failed: ${res.error}; fallback failed: ${fallback.error ?? "unknown"}`,
    };
  }
  return doFetch();
}

/**
 * Start queued fan-out for a campaign (immediate or after schedule lock).
 * Sets status to processing and enqueues the first worker job.
 */
export async function startQueuedCampaignDelivery(
  campaignId: string,
  baseUrl?: string,
): Promise<{ started: boolean; reason?: string }> {
  const db = createAdminClient();

  const pending = await countPendingCampaignRecipients(campaignId);
  if (pending === 0) {
    await db
      .from("admin_notification_campaigns")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);
    return { started: false, reason: "no_recipients" };
  }

  if (isAdminNotificationDeliveryQueueEnabled()) {
    const { error } = await enqueueAdminNotificationDeliveryJob({ campaignId });
    if (error) {
      console.error(
        "[admin-notifications] enqueue failed; falling back to HTTP chain:",
        error,
      );
      const triggered = await triggerDeliveryProcessor(baseUrl, campaignId);
      if (!triggered.triggered) {
        return { started: false, reason: "processor_trigger_failed" };
      }
      return { started: true };
    }
    await db
      .from("admin_notification_campaigns")
      .update({ status: "processing" })
      .eq("id", campaignId);

    const triggered = await triggerDeliveryProcessor(baseUrl, campaignId);
    if (!triggered.triggered) {
      console.warn(
        "[admin-notifications] processor trigger failed after enqueue; will rely on queue/cron retry:",
        campaignId,
        triggered.error ?? "unknown error",
      );
    }
    return { started: true };
  }

  // No Redis: drive the processor directly via HTTP (chains per batch).
  console.warn(
    "[admin-notifications] Redis queue not configured; using HTTP processor chain",
  );
  await db
    .from("admin_notification_campaigns")
    .update({ status: "processing" })
    .eq("id", campaignId);
  const triggered = await triggerDeliveryProcessor(baseUrl, campaignId);
  if (!triggered.triggered) {
    return { started: false, reason: "processor_trigger_failed" };
  }
  return { started: true };
}

/**
 * Process one queue job (or direct HTTP invocation) for a campaign batch.
 */
export async function processCampaignDeliveryJob(
  campaignId: string,
  baseUrl?: string,
): Promise<{
  batchDelivered: number;
  hasMore: boolean;
  finalized: boolean;
}> {
  const userIds = await loadNextPendingRecipientUserIds(campaignId);
  if (userIds.length === 0) {
    await finalizeCampaignDelivery(campaignId);
    return {
      batchDelivered: 0,
      hasMore: false,
      finalized: true,
    };
  }

  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_notification_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle();

  if (
    campaign?.status === "cancelled" ||
    campaign?.status === "completed" ||
    campaign?.status === "failed"
  ) {
    return { batchDelivered: 0, hasMore: false, finalized: false };
  }

  if (campaign?.status !== "processing") {
    await db
      .from("admin_notification_campaigns")
      .update({ status: "processing" })
      .eq("id", campaignId);
  }

  const { successCount, failureCount } = await deliverCampaignBatch(
    campaignId,
    userIds,
  );
  const batchDelivered = successCount + failureCount;

  const stillPending = await countPendingCampaignRecipients(campaignId);
  if (stillPending > 0) {
    if (isAdminNotificationDeliveryQueueEnabled()) {
      await enqueueAdminNotificationDeliveryJob({ campaignId });
    }
    const triggered = await triggerDeliveryProcessor(baseUrl, campaignId);
    if (!triggered.triggered) {
      console.error(
        "[admin-notifications] failed to chain next delivery batch:",
        campaignId,
        triggered.error ?? "unknown error",
      );
    }
    return { batchDelivered, hasMore: true, finalized: false };
  }

  await finalizeCampaignDelivery(campaignId);
  return { batchDelivered, hasMore: false, finalized: true };
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

  return loadUsersByIds(recipientRows.map((r) => r.user_id));
}

/** Allow delivery up to 2 minutes before scheduled_at (clock / QStash skew). */
const SCHEDULE_DELIVERY_GRACE_MS = 2 * 60 * 1000;

/** Start queued delivery for one scheduled campaign when due. */
export async function processScheduledCampaignById(
  campaignId: string,
  options?: { force?: boolean; baseUrl?: string },
): Promise<{ processed: boolean; reason?: string }> {
  const db = createAdminClient();
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

  const started = await startQueuedCampaignDelivery(
    campaignId,
    options?.baseUrl,
  );
  if (!started.started) {
    return { processed: false, reason: started.reason ?? "start_failed" };
  }
  return { processed: true };
}

/** Re-enqueue delivery for campaigns stuck in `processing` with pending recipients. */
export async function resumeStuckCampaignDeliveries(
  limit = 10,
  baseUrl?: string,
): Promise<number> {
  const db = createAdminClient();
  const { data: campaigns, error } = await db
    .from("admin_notification_campaigns")
    .select("id")
    .eq("status", "processing")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !campaigns?.length) return 0;

  let resumed = 0;
  for (const row of campaigns) {
    const pending = await countPendingCampaignRecipients(row.id);
    if (pending === 0) {
      await finalizeCampaignDelivery(row.id);
      continue;
    }
    if (isAdminNotificationDeliveryQueueEnabled()) {
      await enqueueAdminNotificationDeliveryJob({ campaignId: row.id });
    }
    const triggered = await triggerDeliveryProcessor(baseUrl, row.id);
    if (!triggered.triggered) {
      console.error(
        "[admin-notifications] failed to resume stuck campaign delivery:",
        row.id,
        triggered.error ?? "unknown error",
      );
      continue;
    }
    resumed += 1;
  }
  return resumed;
}

export async function processDueScheduledCampaigns(
  limit = 50,
  baseUrl?: string,
): Promise<number> {
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
    const result = await processScheduledCampaignById(row.id, { baseUrl });
    if (result.processed) processed += 1;
  }

  return processed;
}
