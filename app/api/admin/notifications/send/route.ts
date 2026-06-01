import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  countRecipientsByType,
  resolveRecipientUsers,
} from "@/lib/admin-notifications/recipients";
import {
  runCampaignDelivery,
  shouldDeliverSynchronously,
} from "@/lib/admin-notifications/delivery";
import {
  getQStashPublishBaseUrl,
  scheduleAdminNotificationCampaign,
} from "@/lib/qstash";
import { processScheduledCampaignById } from "@/lib/admin-notifications/delivery";
import type {
  AdminNotificationRecipientMode,
  SendTiming,
  UserManagementFilterSnapshot,
} from "@/lib/admin-notifications/types";

const MIN_SCHEDULE_MS = 5 * 60 * 1000;
const MAX_SCHEDULE_MS = 365 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { isAdmin, user, error } = await verifyAdminAccess();
  if (!isAdmin || !user) {
    return NextResponse.json(
      { error: error || "Admin required" },
      { status: 403 },
    );
  }

  let body: {
    notificationType?: string;
    messageBody?: string;
    recipientMode?: AdminNotificationRecipientMode;
    userIds?: string[];
    filters?: UserManagementFilterSnapshot;
    sendTiming?: SendTiming;
    scheduledAt?: string | null;
    timezoneLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notificationType = body.notificationType ?? "public";
  if (notificationType !== "public") {
    return NextResponse.json(
      { error: "Only public notifications are supported" },
      { status: 400 },
    );
  }

  const messageBody = (body.messageBody ?? "").trim();
  if (messageBody.length < 1 || messageBody.length > 2000) {
    return NextResponse.json(
      { error: "Message must be between 1 and 2000 characters" },
      { status: 400 },
    );
  }

  const recipientMode = body.recipientMode;
  if (
    recipientMode !== "selected_user_ids" &&
    recipientMode !== "select_all_filtered"
  ) {
    return NextResponse.json(
      { error: "Invalid recipientMode" },
      { status: 400 },
    );
  }

  const sendTiming: SendTiming =
    body.sendTiming === "scheduled" ? "scheduled" : "immediate";

  let scheduledAt: string | null = null;
  if (sendTiming === "scheduled") {
    if (!body.scheduledAt) {
      return NextResponse.json(
        { error: "Pick a date and time." },
        { status: 400 },
      );
    }
    const scheduledDate = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduled date" },
        { status: 400 },
      );
    }
    const diff = scheduledDate.getTime() - Date.now();
    if (diff < MIN_SCHEDULE_MS) {
      return NextResponse.json(
        { error: "Choose a time at least 5 minutes from now." },
        { status: 400 },
      );
    }
    if (diff > MAX_SCHEDULE_MS) {
      return NextResponse.json(
        { error: "Cannot schedule more than 1 year ahead." },
        { status: 400 },
      );
    }
    scheduledAt = scheduledDate.toISOString();
  }

  const filterSnapshot: UserManagementFilterSnapshot = {
    ...(body.filters ?? {}),
    isActive: body.filters?.isActive !== false,
  };

  const { users, error: recipientError } = await resolveRecipientUsers({
    recipientMode,
    userIds: body.userIds,
    filters: filterSnapshot,
  });

  if (recipientError || users.length === 0) {
    return NextResponse.json(
      { error: recipientError || "No recipients" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const initialStatus = sendTiming === "scheduled" ? "scheduled" : "pending";

  const { data: campaign, error: insertError } = await db
    .from("admin_notification_campaigns")
    .insert({
      created_by: user.id,
      notification_type: "public",
      message_template: messageBody,
      recipient_mode: recipientMode,
      filter_snapshot:
        recipientMode === "select_all_filtered" ? filterSnapshot : null,
      recipient_count: users.length,
      status: initialStatus,
      scheduled_at: scheduledAt,
      timezone_label: body.timezoneLabel ?? "UTC",
    })
    .select("id")
    .single();

  if (insertError || !campaign) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create campaign" },
      { status: 500 },
    );
  }

  const recipientRows = users.map((u) => ({
    campaign_id: campaign.id,
    user_id: u.id,
    user_type_at_send: u.user_type,
    delivery_status: "pending" as const,
  }));

  const CHUNK = 500;
  for (let i = 0; i < recipientRows.length; i += CHUNK) {
    const { error: recipError } = await db
      .from("admin_notification_campaign_recipients")
      .insert(recipientRows.slice(i, i + CHUNK));
    if (recipError) {
      await db
        .from("admin_notification_campaigns")
        .delete()
        .eq("id", campaign.id);
      return NextResponse.json({ error: recipError.message }, { status: 500 });
    }
  }

  if (sendTiming === "scheduled") {
    const scheduledDate = new Date(scheduledAt!);
    const qstashBaseUrl = getQStashPublishBaseUrl(req);
    const scheduleResult = await scheduleAdminNotificationCampaign(
      campaign.id,
      scheduledDate,
      qstashBaseUrl,
    );
    if (scheduleResult.messageId) {
      await db
        .from("admin_notification_campaigns")
        .update({ qstash_message_id: scheduleResult.messageId })
        .eq("id", campaign.id);
    } else if (scheduleResult.error) {
      console.warn(
        "[admin-notifications] QStash schedule skipped:",
        scheduleResult.error,
        scheduleResult.publishUrl ?? qstashBaseUrl,
        "— will deliver via admin UI sweep or daily cron when due",
      );
    }

    const msUntil = scheduledDate.getTime() - Date.now();
    if (!scheduleResult.messageId && msUntil <= 0) {
      await processScheduledCampaignById(campaign.id);
    }

    const SERVER_WAIT_MAX_MS = 24 * 60 * 60 * 1000;
    if (msUntil > 0 && msUntil <= SERVER_WAIT_MAX_MS) {
      const campaignId = campaign.id;
      after(async () => {
        await new Promise((resolve) => setTimeout(resolve, msUntil));
        try {
          await processScheduledCampaignById(campaignId);
        } catch (err) {
          console.error(
            "[admin-notifications] server scheduled delivery failed:",
            err,
          );
        }
      });
    }

    return NextResponse.json({
      campaignId: campaign.id,
      recipientCount: users.length,
      successCount: 0,
      failureCount: 0,
      status: "scheduled",
      scheduledAt,
      qstashScheduled: !!scheduleResult.messageId,
      qstashMessageId: scheduleResult.messageId ?? null,
      qstashPublishUrl: scheduleResult.publishUrl ?? qstashBaseUrl,
      recipientCountByType: countRecipientsByType(users),
    });
  }

  if (shouldDeliverSynchronously(users.length)) {
    const result = await runCampaignDelivery(campaign.id, users);
    return NextResponse.json({
      campaignId: campaign.id,
      recipientCount: users.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      status: result.status,
      scheduledAt: null,
      recipientCountByType: countRecipientsByType(users),
    });
  }

  void runCampaignDelivery(campaign.id, users).catch((err) => {
    console.error("Async campaign delivery failed:", err);
  });

  return NextResponse.json({
    campaignId: campaign.id,
    recipientCount: users.length,
    successCount: 0,
    failureCount: 0,
    status: "processing",
    scheduledAt: null,
    recipientCountByType: countRecipientsByType(users),
  });
}
