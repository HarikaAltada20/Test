import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { processBulkVerifySubmissions } from "@/app/api/admin/bulk-verify-submissions/route";
import { assertBulkVerifyWalletContinuationSigningReady } from "@/lib/bulk-verify-wallet-continuation";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isPaidReversalBulkAction(action: string): boolean {
  return action === "verified" || action === "pending" || action === "rejected";
}

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "Bulk moderation batch auth misconfigured: CRON_SECRET missing" },
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
    const offset =
      typeof body.offset === "number" && Number.isFinite(body.offset)
        ? Math.max(0, Math.floor(body.offset))
        : 0;
    const batchSize =
      typeof body.batchSize === "number" && Number.isFinite(body.batchSize)
        ? Math.max(1, Math.min(25, Math.floor(body.batchSize)))
        : 10;
    const submissionIds = Array.isArray(body.submissionIds)
      ? body.submissionIds.map(String).filter(Boolean)
      : [];

    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    if (submissionIds.length === 0) {
      return NextResponse.json(
        { error: "submissionIds are required on the queue batch payload" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("bulk_submission_moderation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !jobRow) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (jobRow.status !== "running" && jobRow.status !== "queued") {
      return NextResponse.json({
        hasMore: false,
        runStatus: jobRow.status,
        cancelled: jobRow.status === "failed",
      });
    }

    const chunkIds = submissionIds.slice(offset, offset + batchSize);

    if (chunkIds.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        failed: 0,
        results: [],
        errors: [],
        chunkIds,
        hasMore: false,
      });
    }

    const action = String(jobRow.action);
    const deferWalletToEnd = isPaidReversalBulkAction(action);

    // Wallet debit + money_transactions run once at job completion (per creator).
    // Each chunk only changes status; bypass tokens skip mid-job ledger writes.
    if (deferWalletToEnd) {
      try {
        assertBulkVerifyWalletContinuationSigningReady();
      } catch (secretErr) {
        console.error(
          "[bulk-verify batch] Wallet bypass signing not ready:",
          secretErr,
        );
        return NextResponse.json(
          {
            error:
              "Cannot start wallet reversal: server signing secret is not configured (CRON_SECRET).",
          },
          { status: 500 },
        );
      }
    }

    const response = await processBulkVerifySubmissions(
      {
        submissionIds: chunkIds,
        action,
        reason: jobRow.reason ?? undefined,
        qualityScore:
          jobRow.action === "verified"
            ? jobRow.quality_score ?? undefined
            : undefined,
      },
      {
        actorId: String(jobRow.user_id),
        isAdmin: jobRow.user_type === "admin",
        ownershipPrevalidated: true,
        deferHeavySideEffects: true,
        skipWalletReversal: deferWalletToEnd,
        // Bypass every id in the chunk; unpaid rows never enter the reversal path.
        walletSkipSubmissionIds: deferWalletToEnd ? chunkIds : [],
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string })?.error ||
            `Bulk moderation batch failed with HTTP ${response.status}`,
          details: data,
          chunkIds,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ...(data as Record<string, unknown>),
      chunkIds,
      hasMore: offset + chunkIds.length < submissionIds.length,
      nextOffset: offset + chunkIds.length,
    });
  } catch (error) {
    console.error("[bulk-verify batch]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected batch error",
      },
      { status: 500 },
    );
  }
}
