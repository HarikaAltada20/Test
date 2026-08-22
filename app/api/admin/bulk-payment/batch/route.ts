import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  BulkPaymentPayoutChannel,
  BulkPaymentType,
} from "@/lib/queue/bulk-payment-queue";
import {
  parseBulkPaymentJobPayload,
  readQueueOffset,
} from "@/lib/queue/bulk-job-payload";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const xfProto = request.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    return new URL(request.url).origin;
  } catch {
    const url =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

function countFromPayload(
  payload: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = Number(payload[key]);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        {
          error: "Bulk payment batch auth misconfigured: CRON_SECRET missing",
        },
        { status: 503 },
      );
    }

    const fromQueue =
      request.headers.get("X-From-Queue") === "1" ||
      request.headers.get("x-from-queue") === "1";
    const auth = request.headers.get("Authorization");
    if (!fromQueue || auth !== `Bearer ${cronSecret}`) {
      return unauthorized();
    }

    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    const batchSize =
      typeof body.batchSize === "number" && Number.isFinite(body.batchSize)
        ? Math.max(1, Math.min(5, Math.floor(body.batchSize)))
        : 1;

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("bulk_payment_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !jobRow) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const payloadFromDb = parseBulkPaymentJobPayload(jobRow.payload);
    const legacyItems = Array.isArray(body.items) ? body.items : [];
    const items = payloadFromDb?.items ?? legacyItems;
    const offset =
      typeof body.offset === "number" && Number.isFinite(body.offset)
        ? Math.max(0, Math.floor(body.offset))
        : readQueueOffset(jobRow, 0);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Job payload missing payment items" },
        { status: 500 },
      );
    }

    if (jobRow.status !== "running" && jobRow.status !== "queued") {
      return NextResponse.json({
        hasMore: false,
        runStatus: jobRow.status,
        cancelled: jobRow.status === "failed",
      });
    }

    const chunk = items.slice(offset, offset + batchSize);
    if (chunk.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
        paid: 0,
        skipped: 0,
        creatorsProcessed: 0,
        total_amount: 0,
        total_cpm: 0,
        total_bonus: 0,
        total_milestone: 0,
        errors: [],
        hasMore: false,
        nextOffset: offset,
      });
    }

    const contestId = String(jobRow.contest_id);
    const paymentType = String(jobRow.payment_type) as BulkPaymentType;
    const payoutChannel = String(
      jobRow.payout_channel,
    ) as BulkPaymentPayoutChannel;
    const adminUserId = String(jobRow.user_id);
    const baseUrl = getBaseUrlFromRequest(request).replace(/\/$/, "");

    // Submission-wise counters (progress bar / toast), same shape as bulk verify.
    let paid = 0;
    let skipped = 0;
    let failed = 0;
    let totalAmount = 0;
    let totalCpm = 0;
    let totalBonus = 0;
    let totalMilestone = 0;
    let creatorsProcessed = 0;
    const errors: { creatorId: string; error: string }[] = [];

    for (const rawItem of chunk) {
      const creatorId = String(
        (rawItem as { creatorId?: unknown })?.creatorId || "",
      ).trim();
      const submissionIds = Array.isArray(
        (rawItem as { submissionIds?: unknown })?.submissionIds,
      )
        ? (rawItem as { submissionIds: unknown[] }).submissionIds
            .map(String)
            .filter(Boolean)
        : [];
      const submissionCount = submissionIds.length;

      if (!creatorId || submissionCount === 0) {
        failed += Math.max(1, submissionCount);
        creatorsProcessed += 1;
        errors.push({
          creatorId: creatorId || "unknown",
          error: "Invalid creator pay item",
        });
        continue;
      }

      try {
        const payUrl =
          payoutChannel === "twitter_cpm"
            ? `${baseUrl}/api/contests/${contestId}/bulk-pay-twitter-cpm`
            : `${baseUrl}/api/admin/bulk-payment`;

        const payBody =
          payoutChannel === "twitter_cpm"
            ? {
                tweet_ids: submissionIds,
                payment_type: paymentType,
                creator_id: creatorId,
                admin_user_id: adminUserId,
              }
            : {
                submission_ids: submissionIds,
                payment_type: paymentType,
                contest_id: contestId,
                creator_id: creatorId,
                admin_user_id: adminUserId,
              };

        const response = await fetch(payUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-From-Queue": "1",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify(payBody),
        });
        const data = await response.json().catch(() => ({}));
        creatorsProcessed += 1;

        if (!response.ok) {
          const message =
            (data as { error?: string })?.error ||
            `Bulk payment failed with HTTP ${response.status}`;
          const lower = message.toLowerCase();
          if (
            lower.includes("no eligible") ||
            lower.includes("no verified") ||
            lower.includes("no unpaid") ||
            lower.includes("nothing to pay")
          ) {
            skipped += submissionCount;
          } else {
            failed += submissionCount;
            errors.push({ creatorId, error: message });
          }
          continue;
        }

        const payload = ((data as { data?: Record<string, unknown> })?.data ||
          data) as Record<string, unknown>;
        const amount = Number(payload.total_amount) || 0;
        const paidFromApi = countFromPayload(payload, [
          "paid_count",
          "applied_count",
        ]);
        const skippedFromApi = countFromPayload(payload, ["skipped_count"]);

        if (paidFromApi != null || skippedFromApi != null) {
          const paidSubs = Math.max(0, paidFromApi ?? 0);
          const skippedSubs = Math.max(
            0,
            skippedFromApi ?? Math.max(0, submissionCount - paidSubs),
          );
          // Clamp so this creator never overshoots its submission list.
          const clampedPaid = Math.min(submissionCount, paidSubs);
          const clampedSkipped = Math.min(
            submissionCount - clampedPaid,
            skippedSubs,
          );
          const remainder =
            submissionCount - clampedPaid - clampedSkipped;
          paid += clampedPaid;
          skipped += clampedSkipped + Math.max(0, remainder);
        } else if (amount > 0) {
          paid += submissionCount;
        } else {
          skipped += submissionCount;
        }

        totalAmount += amount;
        totalCpm +=
          Number(payload.total_cpm ?? payload.total_reward ?? 0) || 0;
        totalBonus += Number(payload.total_bonus) || 0;
        totalMilestone += Number(payload.total_milestone) || 0;
      } catch (err) {
        creatorsProcessed += 1;
        failed += submissionCount;
        errors.push({
          creatorId,
          error: err instanceof Error ? err.message : "Unknown payment error",
        });
      }
    }

    return NextResponse.json({
      success: failed === 0,
      // Submission-wise (UI progress / toast)
      processed: paid + skipped + failed,
      paid,
      skipped,
      failed,
      // Creator hops completed this batch (queue offset advances by this)
      creatorsProcessed,
      total_amount: totalAmount,
      total_cpm: totalCpm,
      total_bonus: totalBonus,
      total_milestone: totalMilestone,
      errors,
      hasMore: offset + chunk.length < items.length,
      nextOffset: offset + chunk.length,
    });
  } catch (error) {
    console.error("[bulk-payment batch]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected batch error",
      },
      { status: 500 },
    );
  }
}
