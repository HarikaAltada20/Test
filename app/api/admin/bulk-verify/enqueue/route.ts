import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  BULK_MODERATION_BATCH_SIZE,
  computeBulkModerationTotalBatches,
  enqueueBulkSubmissionModerationJob,
  isBulkSubmissionModerationQueueEnabled,
  type BulkModerationAction,
} from "@/lib/queue/bulk-submission-moderation-queue";
import {
  isQStashEnabled,
  triggerProcessBulkVerifyQueue,
} from "@/lib/qstash";
import { MAX_BULK_MODERATION_SUBMISSIONS } from "@/lib/queue/bulk-job-limits";
import type { BulkModerationChannel } from "@/lib/queue/bulk-job-payload";
import {
  bulkContestConflictMessage,
  findActiveBulkContestConflict,
} from "@/lib/bulk-job-contest-lock";

const ALLOWED_ACTIONS = new Set(["verified", "pending", "rejected"]);
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

function getContestAdvertiserId(
  contests:
    | { advertiser_id: string }
    | { advertiser_id: string }[]
    | null
    | undefined,
): string | undefined {
  if (!contests) return undefined;
  if (Array.isArray(contests)) return contests[0]?.advertiser_id;
  return contests.advertiser_id;
}

export async function POST(request: Request) {
  try {
    if (!isBulkSubmissionModerationQueueEnabled()) {
      return NextResponse.json(
        { error: "Bulk moderation queue is not configured" },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const submissionIds = Array.isArray(body?.submissionIds)
      ? body.submissionIds.map(String).filter(Boolean)
      : [];
    const action = String(body?.action || "");
    const reason =
      typeof body?.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null;
    const qualityScore =
      body?.qualityScore == null ? null : Number(body.qualityScore);

    if (submissionIds.length === 0) {
      return NextResponse.json(
        { error: "submissionIds must be a non-empty array" },
        { status: 400 },
      );
    }

    if (submissionIds.length > MAX_BULK_MODERATION_SUBMISSIONS) {
      return NextResponse.json(
        {
          error: `Too many submissions. Bulk moderation supports at most ${MAX_BULK_MODERATION_SUBMISSIONS} per job.`,
          max: MAX_BULK_MODERATION_SUBMISSIONS,
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "Only verified, pending, and rejected can be queued" },
        { status: 400 },
      );
    }

    const { isAdmin, user: adminUser, error: adminError } =
      await verifyAdminAccess();
    const supabase = await createClient();

    let actorId: string | null = adminUser?.id ?? null;
    let actorRole: "admin" | "advertiser" = "admin";

    if (!isAdmin) {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", authUser.id)
        .single();

      if (userDataError || !userData || userData.user_type !== "advertiser") {
        return NextResponse.json(
          { error: adminError || "Insufficient permissions" },
          { status: 403 },
        );
      }

      actorId = authUser.id;
      actorRole = "advertiser";
    }

    if (!actorId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const submissionRows: {
      id: string;
      contest_id: string;
      contests: { advertiser_id: string } | { advertiser_id: string }[];
    }[] = [];
    for (let i = 0; i < submissionIds.length; i += OWNERSHIP_ID_CHUNK_SIZE) {
      const chunk = submissionIds.slice(i, i + OWNERSHIP_ID_CHUNK_SIZE);
      const { data, error } = await supabase
        .from("submissions")
        .select("id, contest_id, contests!inner(advertiser_id)")
        .in("id", chunk);
      if (error) {
        return NextResponse.json(
          { error: "Failed to validate submissions" },
          { status: 500 },
        );
      }
      submissionRows.push(...((data ?? []) as typeof submissionRows));
    }

    const foundSubmissionIds = new Set(submissionRows.map((row) => row.id));
    const missingAfterSubmissions = submissionIds.filter(
      (id) => !foundSubmissionIds.has(id),
    );

    let channel: BulkModerationChannel = "submissions";
    let contestId = "";

    if (missingAfterSubmissions.length === 0) {
      const contestIds = [
        ...new Set(submissionRows.map((row) => String(row.contest_id))),
      ];
      if (contestIds.length !== 1) {
        return NextResponse.json(
          { error: "All queued submissions must belong to the same contest" },
          { status: 400 },
        );
      }
      contestId = contestIds[0];
      if (actorRole === "advertiser") {
        const unauthorized = submissionRows.some(
          (row) => getContestAdvertiserId(row.contests) !== actorId,
        );
        if (unauthorized) {
          return NextResponse.json(
            { error: "You can only manage submissions for your own contests" },
            { status: 403 },
          );
        }
      }
    } else if (foundSubmissionIds.size > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot mix video submissions and Twitter tweets in one bulk moderation job",
        },
        { status: 400 },
      );
    } else {
      const tweetRows: { id: string; contest_id: string }[] = [];
      for (
        let i = 0;
        i < missingAfterSubmissions.length;
        i += OWNERSHIP_ID_CHUNK_SIZE
      ) {
        const chunk = missingAfterSubmissions.slice(
          i,
          i + OWNERSHIP_ID_CHUNK_SIZE,
        );
        const { data, error } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .select("id, contest_id")
          .in("id", chunk);
        if (error) {
          return NextResponse.json(
            { error: "Failed to validate tweets" },
            { status: 500 },
          );
        }
        tweetRows.push(...((data ?? []) as typeof tweetRows));
      }

      const foundTweetIds = new Set(tweetRows.map((row) => String(row.id)));
      const uniqueMissing = [...new Set(missingAfterSubmissions)];
      if (foundTweetIds.size !== uniqueMissing.length) {
        return NextResponse.json(
          { error: "One or more submissions were not found" },
          { status: 404 },
        );
      }

      const contestIds = [
        ...new Set(tweetRows.map((row) => String(row.contest_id))),
      ];
      if (contestIds.length !== 1) {
        return NextResponse.json(
          { error: "All queued tweets must belong to the same contest" },
          { status: 400 },
        );
      }
      contestId = contestIds[0];
      channel = "twitter_tweets";

      const { data: contest, error: contestError } = await supabaseAdmin
        .from("contests")
        .select("id, advertiser_id, platform")
        .eq("id", contestId)
        .maybeSingle();
      if (contestError || !contest) {
        return NextResponse.json({ error: "Contest not found" }, { status: 404 });
      }
      const platform = String(contest.platform || "").toLowerCase();
      if (platform !== "twitter" && platform !== "x") {
        return NextResponse.json(
          { error: "Tweet IDs must belong to a Twitter/X contest" },
          { status: 400 },
        );
      }
      if (actorRole === "advertiser" && contest.advertiser_id !== actorId) {
        return NextResponse.json(
          { error: "You can only manage submissions for your own contests" },
          { status: 403 },
        );
      }
    }

    if (
      channel === "submissions" &&
      action === "verified" &&
      (!Number.isInteger(qualityScore) ||
        ![1, 2, 3].includes(qualityScore as number))
    ) {
      return NextResponse.json(
        { error: "qualityScore is required and must be 1, 2, or 3" },
        { status: 400 },
      );
    }

    const paymentConflict = await findActiveBulkContestConflict(
      supabaseAdmin,
      contestId,
      "moderation",
    );
    if (paymentConflict) {
      return NextResponse.json(
        { error: bulkContestConflictMessage(paymentConflict) },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("bulk_submission_moderation_jobs")
      .insert({
        contest_id: contestId,
        user_id: actorId,
        user_type: actorRole,
        action,
        status: "queued",
        total_count: submissionIds.length,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        quality_score:
          action === "verified" && channel === "submissions"
            ? qualityScore
            : null,
        reason,
        payload: { submissionIds, channel },
        queue_offset: 0,
        created_at: now,
        updated_at: now,
      })
      .select(
        "id, contest_id, user_id, user_type, action, status, total_count, processed_count, success_count, failed_count, quality_score, reason, error_message, created_at, started_at, finished_at, updated_at",
      )
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create bulk moderation job" },
        { status: 500 },
      );
    }

    const totalBatches = computeBulkModerationTotalBatches(
      submissionIds.length,
      BULK_MODERATION_BATCH_SIZE,
    );
    const enqueueResult = await enqueueBulkSubmissionModerationJob({
      contestId,
      jobId: inserted.id,
      action: action as BulkModerationAction,
      batchIndex: 0,
      batchSize: BULK_MODERATION_BATCH_SIZE,
      totalBatches,
      submissionIds,
      offset: 0,
      attempt: 0,
    });
    if (enqueueResult.error) {
      await supabaseAdmin
        .from("bulk_submission_moderation_jobs")
        .update({
          status: "failed",
          error_message: enqueueResult.error,
          finished_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);
      return NextResponse.json(
        { error: `Failed to enqueue bulk moderation job: ${enqueueResult.error}` },
        { status: 500 },
      );
    }

    const baseUrl = getBaseUrlFromRequest(request).replace(/\/$/, "");
    const doFetch = () =>
      fetch(`${baseUrl}/api/cron/process-bulk-verify-queue`, {
        method: "POST",
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      }).catch((error) => {
        console.warn("[bulk-verify enqueue] trigger failed:", error);
      });

    if (isQStashEnabled()) {
      triggerProcessBulkVerifyQueue(baseUrl)
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
    console.error("[bulk-verify enqueue]", error);
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
