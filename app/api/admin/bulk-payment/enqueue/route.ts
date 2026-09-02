import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  BULK_PAYMENT_BATCH_SIZE,
  computeBulkPaymentTotalBatches,
  enqueueBulkPaymentJob,
  isBulkPaymentQueueEnabled,
  type BulkPaymentPayoutChannel,
  type BulkPaymentQueueItem,
  type BulkPaymentType,
} from "@/lib/queue/bulk-payment-queue";
import {
  isQStashEnabled,
  triggerProcessBulkPaymentQueue,
} from "@/lib/qstash";
import {
  MAX_BULK_PAYMENT_CREATORS,
  MAX_BULK_PAYMENT_SUBMISSIONS,
} from "@/lib/queue/bulk-job-limits";
import {
  bulkContestConflictMessage,
  findActiveBulkContestConflict,
} from "@/lib/bulk-job-contest-lock";

const ALLOWED_PAYMENT_TYPES = new Set(["standard", "bonus", "both"]);
const ALLOWED_CHANNELS = new Set([
  "submissions",
  "twitter_cpm",
  "twitter_creator",
]);
const OWNERSHIP_ID_CHUNK_SIZE = 200;

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    return new URL(request.url).origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

function normalizeItems(raw: unknown): BulkPaymentQueueItem[] {
  if (!Array.isArray(raw)) return [];
  const byCreator = new Map<string, string[]>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const creatorId = String(
      (entry as { creatorId?: unknown; creator_id?: unknown }).creatorId ??
        (entry as { creator_id?: unknown }).creator_id ??
        "",
    ).trim();
    const submissionIdsRaw =
      (entry as { submissionIds?: unknown; submission_ids?: unknown; tweet_ids?: unknown })
        .submissionIds ??
      (entry as { submission_ids?: unknown }).submission_ids ??
      (entry as { tweet_ids?: unknown }).tweet_ids;
    const submissionIds = Array.isArray(submissionIdsRaw)
      ? submissionIdsRaw.map(String).map((id) => id.trim()).filter(Boolean)
      : [];
    if (!creatorId || submissionIds.length === 0) continue;
    const existing = byCreator.get(creatorId) ?? [];
    existing.push(...submissionIds);
    byCreator.set(creatorId, existing);
  }
  return [...byCreator.entries()].map(([creatorId, submissionIds]) => ({
    creatorId,
    submissionIds: [...new Set(submissionIds)],
  }));
}

export async function POST(request: Request) {
  try {
    if (!isBulkPaymentQueueEnabled()) {
      return NextResponse.json(
        { error: "Bulk payment queue is not configured" },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const contestId =
      typeof body?.contestId === "string"
        ? body.contestId.trim()
        : typeof body?.contest_id === "string"
          ? body.contest_id.trim()
          : "";
    const paymentType = String(
      body?.paymentType ?? body?.payment_type ?? "",
    ) as BulkPaymentType;
    const payoutChannel = String(
      body?.payoutChannel ?? body?.payout_channel ?? "submissions",
    ) as BulkPaymentPayoutChannel;
    const items = normalizeItems(body?.items);

    if (!contestId) {
      return NextResponse.json(
        { error: "contestId is required" },
        { status: 400 },
      );
    }
    if (!ALLOWED_PAYMENT_TYPES.has(paymentType)) {
      return NextResponse.json(
        { error: "paymentType must be standard, bonus, or both" },
        { status: 400 },
      );
    }
    if (!ALLOWED_CHANNELS.has(payoutChannel)) {
      return NextResponse.json(
        { error: "payoutChannel must be submissions, twitter_cpm, or twitter_creator" },
        { status: 400 },
      );
    }
    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "items must be a non-empty array of { creatorId, submissionIds }",
        },
        { status: 400 },
      );
    }

    const totalSubmissionCountPreview = items.reduce(
      (sum, item) => sum + item.submissionIds.length,
      0,
    );
    if (items.length > MAX_BULK_PAYMENT_CREATORS) {
      return NextResponse.json(
        {
          error: `Too many creators. Bulk payment supports at most ${MAX_BULK_PAYMENT_CREATORS} creators per job.`,
          max: MAX_BULK_PAYMENT_CREATORS,
        },
        { status: 400 },
      );
    }
    if (totalSubmissionCountPreview > MAX_BULK_PAYMENT_SUBMISSIONS) {
      return NextResponse.json(
        {
          error: `Too many submissions. Bulk payment supports at most ${MAX_BULK_PAYMENT_SUBMISSIONS} submissions per job.`,
          max: MAX_BULK_PAYMENT_SUBMISSIONS,
        },
        { status: 400 },
      );
    }

    const { isAdmin, user: adminUser, error: adminError } =
      await verifyAdminAccess();
    if (!isAdmin || !adminUser?.id) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select("id, post_contest_status")
      .eq("id", contestId)
      .single();
    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }
    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 },
      );
    }

    // Ownership / contest membership check for all submission (or tweet) ids.
    const allIds = items.flatMap((item) => item.submissionIds);
    const idToCreator = new Map<string, string>();
    if (payoutChannel === "twitter_cpm" || payoutChannel === "twitter_creator") {
      for (let i = 0; i < allIds.length; i += OWNERSHIP_ID_CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + OWNERSHIP_ID_CHUNK_SIZE);
        const { data, error } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .select("id, contest_id, creator_id")
          .in("id", chunk)
          .eq("contest_id", contestId);
        if (error) {
          return NextResponse.json(
            { error: "Failed to validate tweets" },
            { status: 500 },
          );
        }
        const found = new Set((data ?? []).map((row) => String(row.id)));
        if (found.size !== chunk.length) {
          return NextResponse.json(
            { error: "One or more tweets were not found for this contest" },
            { status: 404 },
          );
        }
        for (const row of data ?? []) {
          idToCreator.set(String(row.id), String(row.creator_id));
        }
      }
    } else {
      for (let i = 0; i < allIds.length; i += OWNERSHIP_ID_CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + OWNERSHIP_ID_CHUNK_SIZE);
        const { data, error } = await supabaseAdmin
          .from("submissions")
          .select("id, contest_id, creator_id")
          .in("id", chunk)
          .eq("contest_id", contestId);
        if (error) {
          return NextResponse.json(
            { error: "Failed to validate submissions" },
            { status: 500 },
          );
        }
        const found = new Set((data ?? []).map((row) => String(row.id)));
        if (found.size !== chunk.length) {
          return NextResponse.json(
            {
              error:
                "One or more submissions were not found for this contest",
            },
            { status: 404 },
          );
        }
        for (const row of data ?? []) {
          idToCreator.set(String(row.id), String(row.creator_id));
        }
      }
    }

    for (const item of items) {
      for (const submissionId of item.submissionIds) {
        const ownerId = idToCreator.get(submissionId);
        if (!ownerId || ownerId !== item.creatorId) {
          return NextResponse.json(
            {
              error:
                "One or more submissionIds do not belong to the specified creatorId",
            },
            { status: 400 },
          );
        }
      }
    }

    const totalSubmissionCount = items.reduce(
      (sum, item) => sum + item.submissionIds.length,
      0,
    );

    const moderationConflict = await findActiveBulkContestConflict(
      supabaseAdmin,
      contestId,
      "payment",
    );
    if (moderationConflict) {
      return NextResponse.json(
        { error: bulkContestConflictMessage(moderationConflict) },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("bulk_payment_jobs")
      .insert({
        contest_id: contestId,
        user_id: adminUser.id,
        user_type: "admin",
        payment_type: paymentType,
        payout_channel: payoutChannel,
        status: "queued",
        total_count: totalSubmissionCount,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        total_amount_cents: 0,
        total_cpm_cents: 0,
        total_bonus_cents: 0,
        total_milestone_cents: 0,
        payload: { items },
        queue_offset: 0,
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, contest_id, user_id, user_type, payment_type, payout_channel, status, total_count, processed_count, success_count, failed_count, total_amount_cents, total_cpm_cents, total_bonus_cents, total_milestone_cents, error_message, created_at, started_at, finished_at, updated_at",
      )
      .single();

    if (insertError || !inserted) {
      console.error("[bulk-payment enqueue] insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create bulk payment job" },
        { status: 500 },
      );
    }

    const totalBatches = computeBulkPaymentTotalBatches(
      items.length,
      BULK_PAYMENT_BATCH_SIZE,
    );
    const enqueueResult = await enqueueBulkPaymentJob({
      contestId,
      jobId: inserted.id,
      paymentType,
      payoutChannel,
      batchIndex: 0,
      batchSize: BULK_PAYMENT_BATCH_SIZE,
      totalBatches,
      items,
      offset: 0,
      attempt: 0,
    });
    if (enqueueResult.error) {
      await supabaseAdmin
        .from("bulk_payment_jobs")
        .update({
          status: "failed",
          error_message: enqueueResult.error,
          finished_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
      return NextResponse.json(
        {
          error: `Failed to enqueue bulk payment job: ${enqueueResult.error}`,
        },
        { status: 500 },
      );
    }

    const baseUrl = getBaseUrlFromRequest(request).replace(/\/$/, "");
    const doFetch = () =>
      fetch(`${baseUrl}/api/cron/process-bulk-payment-queue`, {
        method: "POST",
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      }).catch((error) => {
        console.warn("[bulk-payment enqueue] trigger failed:", error);
      });

    if (isQStashEnabled()) {
      triggerProcessBulkPaymentQueue(baseUrl)
        .then((res) => {
          if (res?.error) doFetch();
        })
        .catch(() => doFetch());
    } else {
      doFetch();
    }

    return NextResponse.json({
      jobId: inserted.id,
      job: inserted,
      queued: true,
    });
  } catch (error) {
    console.error("[bulk-payment enqueue]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected enqueue error",
      },
      { status: 500 },
    );
  }
}
