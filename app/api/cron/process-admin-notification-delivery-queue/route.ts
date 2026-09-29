/**
 * Process admin notification delivery queue: pop one job (LMOVE to processing),
 * deliver one batch of pending recipients, chain if more remain.
 * Triggered by QStash, CRON_SECRET, or direct POST with { campaignId } when Redis is off.
 */

import { NextResponse } from "next/server";
import {
  processCampaignDeliveryJob,
  resumeStuckCampaignDeliveries,
} from "@/lib/admin-notifications/delivery";
import {
  popAdminNotificationDeliveryJob,
  removeAdminNotificationDeliveryFromProcessing,
  recoverAdminNotificationDeliveryProcessingToQueue,
  isAdminNotificationDeliveryQueueEnabled,
} from "@/lib/queue/admin-notification-delivery-queue";
import { authorizeProcessAdminNotificationDeliveryQueue } from "@/lib/qstash";

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    const u = new URL(request.url);
    return u.origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

function parseCampaignIdFromBody(rawBody: string): string | undefined {
  if (!rawBody.trim()) return undefined;
  try {
    const parsed = JSON.parse(rawBody) as { campaignId?: string };
    if (parsed.campaignId && typeof parsed.campaignId === "string") {
      return parsed.campaignId;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function GET(request: Request) {
  const authorized = await authorizeProcessAdminNotificationDeliveryQueue(
    request,
    "",
  );
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request), "");
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessAdminNotificationDeliveryQueue(
    request,
    rawBody,
  );
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-admin-notification-delivery-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );
  return handleRequest(getBaseUrlFromRequest(request), rawBody);
}

async function handleRequest(
  baseUrl: string,
  rawBody: string,
): Promise<NextResponse> {
  let campaignId = parseCampaignIdFromBody(rawBody);
  let rawJobString: string | null = null;

  if (isAdminNotificationDeliveryQueueEnabled()) {
    let popped = await popAdminNotificationDeliveryJob();
    if (!popped) {
      const recovered = await recoverAdminNotificationDeliveryProcessingToQueue({
        maxToMove: 25,
      });
      if (recovered.moved > 0) {
        popped = await popAdminNotificationDeliveryJob();
      }
    }
    if (popped) {
      campaignId = popped.job.campaignId;
      rawJobString = popped.raw;
    }
  }

  if (!campaignId) {
    const resumed = await resumeStuckCampaignDeliveries(10, baseUrl);
    if (isAdminNotificationDeliveryQueueEnabled()) {
      const popped = await popAdminNotificationDeliveryJob();
      if (popped) {
        campaignId = popped.job.campaignId;
        rawJobString = popped.raw;
      }
    }
    if (!campaignId) {
      return NextResponse.json({
        processed: 0,
        resumed,
        message: resumed > 0 ? "Resumed stuck campaigns" : "No campaign to process",
      });
    }
  }

  try {
    const result = await processCampaignDeliveryJob(campaignId, baseUrl);
    if (rawJobString) {
      await removeAdminNotificationDeliveryFromProcessing(rawJobString);
    }
    return NextResponse.json({
      processed: 1,
      campaignId,
      ...result,
    });
  } catch (err) {
    console.error("[process-admin-notification-delivery-queue] failed:", err);
    return NextResponse.json(
      {
        processed: 1,
        campaignId,
        error: err instanceof Error ? err.message : "Delivery failed",
      },
      { status: 500 },
    );
  }
}
