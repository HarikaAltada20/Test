/**
 * Process admin email delivery queue: pop one job, deliver one batch, chain if more remain.
 */

import { NextResponse } from "next/server";
import {
  findCampaignNeedingDelivery,
  processEmailCampaignDeliveryJob,
} from "@/lib/admin-email/delivery";
import {
  popAdminEmailDeliveryJob,
  removeAdminEmailDeliveryFromProcessing,
  recoverAdminEmailDeliveryProcessingToQueue,
  isAdminEmailDeliveryQueueEnabled,
} from "@/lib/queue/admin-email-delivery-queue";
import { authorizeProcessAdminEmailDeliveryQueue } from "@/lib/qstash";

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    return new URL(request.url).origin;
  } catch {
    return (
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
    ).replace(/\/$/, "");
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
  const authorized = await authorizeProcessAdminEmailDeliveryQueue(
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
  const authorized = await authorizeProcessAdminEmailDeliveryQueue(
    request,
    rawBody,
  );
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request), rawBody);
}

async function handleRequest(
  baseUrl: string,
  rawBody: string,
): Promise<NextResponse> {
  let campaignId = parseCampaignIdFromBody(rawBody);
  let rawJobString: string | null = null;

  if (isAdminEmailDeliveryQueueEnabled()) {
    let popped = await popAdminEmailDeliveryJob();
    if (!popped) {
      const recovered = await recoverAdminEmailDeliveryProcessingToQueue({
        maxToMove: 25,
      });
      if (recovered.moved > 0) {
        popped = await popAdminEmailDeliveryJob();
      }
    }
    if (popped) {
      campaignId = popped.job.campaignId;
      rawJobString = popped.raw;
    }
  }

  if (!campaignId) {
    campaignId = await findCampaignNeedingDelivery() ?? undefined;
  }

  if (!campaignId) {
    return NextResponse.json({
      processed: 0,
      message: "No campaign to process",
    });
  }

  try {
    const result = await processEmailCampaignDeliveryJob(campaignId, baseUrl);
    if (rawJobString) {
      await removeAdminEmailDeliveryFromProcessing(rawJobString);
    }
    console.log("[admin-email] delivery queue processed", {
      campaignId,
      ...result,
    });
    return NextResponse.json({
      processed: 1,
      campaignId,
      ...result,
    });
  } catch (err) {
    if (rawJobString) {
      await removeAdminEmailDeliveryFromProcessing(rawJobString);
    }
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
