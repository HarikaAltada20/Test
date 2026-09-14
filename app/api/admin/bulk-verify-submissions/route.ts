import {
  processVerifySubmission,
  type VerifySubmissionActorOverride,
} from "../verify-submission/route";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { applyBulkDualRewardsWalletReversals } from "@/lib/dual-rewards-bulk-reversal";
import {
  assertBulkVerifyWalletContinuationSigningReady,
  issueBulkVerifyWalletDebitBypass,
} from "@/lib/bulk-verify-wallet-continuation";

const PAYMENT_BULK_ACTIONS = new Set([
  "paid",
  "mark_bonus_paid",
  "mark_both_paid",
]);

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

const OWNERSHIP_ID_CHUNK_SIZE = 200;

async function assertAdvertiserOwnsSubmissions(
  submissionIds: string[],
  advertiserId: string,
): Promise<NextResponse | null> {
  if (submissionIds.length === 0) {
    return null;
  }

  const supabase = await createClient();
  const rows: { id: string; contests: { advertiser_id: string } | { advertiser_id: string }[] }[] =
    [];

  for (let i = 0; i < submissionIds.length; i += OWNERSHIP_ID_CHUNK_SIZE) {
    const chunk = submissionIds.slice(i, i + OWNERSHIP_ID_CHUNK_SIZE);
    const { data: chunkRows, error } = await supabase
      .from("submissions")
      .select("id, contests!inner(advertiser_id)")
      .in("id", chunk);

    if (error) {
      return NextResponse.json(
        { error: "Failed to verify submission ownership" },
        { status: 500 },
      );
    }

    rows.push(...((chunkRows ?? []) as typeof rows));
  }

  const foundIds = new Set(rows.map((r) => r.id));
  const missing = submissionIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "One or more submissions were not found" },
      { status: 404 },
    );
  }

  const unauthorized = rows.some(
    (row) => getContestAdvertiserId(row.contests) !== advertiserId,
  );
  if (unauthorized) {
    return NextResponse.json(
      { error: "You can only manage submissions for your own contests" },
      { status: 403 },
    );
  }

  return null;
}

/** Default matches previous behavior (10 parallel verifies). Override via env if you see DB/connect saturation. */
function getVerifyConcurrency(options?: {
  deferHeavySideEffects?: boolean;
}): number {
  const raw = process.env.BULK_VERIFY_SUBMISSIONS_CONCURRENCY;
  // Queue path: keep concurrency low to avoid statement timeouts on large contests.
  const fallback = options?.deferHeavySideEffects ? 3 : 10;
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, options?.deferHeavySideEffects ? 5 : 25);
}

function isPaidReversalBulkAction(action: string): boolean {
  return action === "verified" || action === "pending" || action === "rejected";
}

function isTransientVerifyError(err: unknown): boolean {
  const parts: string[] = [];
  const collect = (x: unknown) => {
    if (x == null) return;
    if (typeof x === "string") {
      parts.push(x);
      return;
    }
    if (x instanceof Error) {
      parts.push(x.message);
      collect((x as Error & { cause?: unknown }).cause);
      return;
    }
    try {
      parts.push(String(x));
    } catch {
      /* ignore */
    }
  };
  collect(err);
  const msg = parts.join(" ").toLowerCase();
  return (
    msg.includes("connecttimeout") ||
    msg.includes("und_err_connect_timeout") ||
    (msg.includes("timeout") && msg.includes("connect")) ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    (msg.includes("socket") && msg.includes("hang")) ||
    msg.includes("statement timeout") ||
    msg.includes("canceling statement") ||
    msg.includes("57014") ||
    msg.includes("retryable")
  );
}

async function invokeVerifyWithRetries(
  payload: Record<string, unknown>,
  actorOverride?: VerifySubmissionActorOverride,
  maxAttempts = 4,
): Promise<Response> {
  let lastError: unknown;
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await processVerifySubmission(
        payload as any,
        actorOverride,
      );
      if (res.ok) return res;

      const contentType = res.headers.get("content-type") || "";
      let errorPayload: unknown = null;
      if (contentType.includes("application/json")) {
        errorPayload = await res.clone().json().catch(() => null);
      } else {
        errorPayload = await res.clone().text().catch(() => null);
      }
      const errorMessage =
        typeof errorPayload === "string"
          ? errorPayload
          : (errorPayload as { error?: string; retryable?: boolean } | null)
              ?.error || `HTTP ${res.status}`;
      const retryable =
        res.status === 503 ||
        (errorPayload as { retryable?: boolean } | null)?.retryable === true ||
        isTransientVerifyError(errorMessage);

      lastResponse = res;
      lastError = new Error(errorMessage);
      if (!retryable || attempt === maxAttempts) {
        return res;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    } catch (e) {
      lastError = e;
      if (!isTransientVerifyError(e) || attempt === maxAttempts) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}

export interface BulkSubmissionModerationActorOverride {
  actorId: string;
  isAdmin: boolean;
  ownershipPrevalidated?: boolean;
  deferHeavySideEffects?: boolean;
  /**
   * Queue path: wallet already reversed for the full selection (or will be
   * handled by the batch route). Do not create per-chunk money_transactions.
   */
  skipWalletReversal?: boolean;
  /** Submission ids whose wallet debit was already applied in the preflight. */
  walletSkipSubmissionIds?: string[];
  walletRefundSummaryBySubmissionId?: Record<
    string,
    {
      reward_refunded_cents: number;
      bonus_refunded_cents: number;
      total_refunded_cents: number;
      cpm_refunded_cents: number;
      milestone_refunded_cents: number;
    }
  >;
  /**
   * Queue first batch: reverse this full selection once (not just the chunk).
   * Ignored when skipWalletReversal is true.
   */
  walletReversalSubmissionIds?: string[];
}

export interface BulkSubmissionModerationPayload {
  submissionIds: string[];
  action: string;
  reason?: string;
  paymentDetails?: any;
  qualityScore?: number | null;
  walletReversalSubmissionIds?: string[];
  walletReversalContinuation?: string | null;
  skipWalletReversal?: boolean;
}

export async function processBulkVerifySubmissions(
  payload: BulkSubmissionModerationPayload,
  actorOverride?: BulkSubmissionModerationActorOverride,
) {
  try {
    const {
      submissionIds,
      action,
      reason,
      paymentDetails,
      qualityScore,
      /** @deprecated Full-selection preflight is unsafe in serverless requests. */
      walletReversalSubmissionIds,
      /** @deprecated Continuations are no longer accepted; each bounded chunk reverses itself. */
      walletReversalContinuation,
      /** @deprecated Never accepted from clients. */
      skipWalletReversal,
    } = payload;

    if (!Array.isArray(submissionIds)) {
      return NextResponse.json(
        { error: "submissionIds must be an array" },
        { status: 400 },
      );
    }
    if (submissionIds.length > 25) {
      return NextResponse.json(
        {
          error:
            "At most 25 submissions may be processed per request. Split larger selections into bounded chunks.",
        },
        { status: 413 },
      );
    }

    if (
      skipWalletReversal === true ||
      walletReversalContinuation ||
      (Array.isArray(walletReversalSubmissionIds) &&
        walletReversalSubmissionIds.length > 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Wallet reversal continuations and full-selection preflights are no longer accepted. Send only the bounded submissionIds chunk.",
        },
        { status: 400 },
      );
    }

    let resolvedBulkQualityScore: 1 | 2 | 3 | 4 | 5 | undefined;
    if (action === "verified") {
      const { requireVerifyQualityScore } = await import("@/lib/quality-score");
      const parsed = requireVerifyQualityScore(qualityScore);
      if (parsed === null) {
        return NextResponse.json(
          {
            error:
              "qualityScore is required and must be 1, 2, 3, 4, or 5 when bulk verifying submissions",
          },
          { status: 400 },
        );
      }
      resolvedBulkQualityScore = parsed;
    }

    let isAdmin = !!actorOverride?.isAdmin;
    let actorId: string | null = actorOverride?.actorId ?? null;

    if (!actorOverride) {
      const {
        isAdmin: resolvedIsAdmin,
        error: adminError,
        user: adminUser,
      } = await verifyAdminAccess();
      isAdmin = resolvedIsAdmin;
      actorId = adminUser?.id ?? null;

      if (!isAdmin) {
        const supabase = await createClient();
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !authUser) {
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

        if (
          userDataError ||
          !userData ||
          userData.user_type !== "advertiser"
        ) {
          return NextResponse.json(
            { error: adminError || "Admin access required" },
            { status: 403 },
          );
        }

        if (PAYMENT_BULK_ACTIONS.has(action)) {
          return NextResponse.json(
            { error: "Admin access required for payment actions" },
            { status: 403 },
          );
        }

        actorId = authUser.id;

        const ownershipError = await assertAdvertiserOwnsSubmissions(
          submissionIds,
          authUser.id,
        );
        if (ownershipError) {
          return ownershipError;
        }
      }
    } else if (!isAdmin && !actorOverride.ownershipPrevalidated) {
      const ownershipError = await assertAdvertiserOwnsSubmissions(
        submissionIds,
        actorOverride.actorId,
      );
      if (ownershipError) {
        return ownershipError;
      }
    }

    if (!actorId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const skipWalletDebitIds = new Set<string>();
    const bulkRefundSummaryById = new Map<
      string,
      {
        reward_refunded_cents: number;
        bonus_refunded_cents: number;
        total_refunded_cents: number;
        cpm_refunded_cents: number;
        milestone_refunded_cents: number;
      }
    >();

    if (isPaidReversalBulkAction(action)) {
      const supabaseAdmin = createAdminClient();

      // Queue path may skip chunk wallet work (already done for the full selection)
      // or reverse a larger id set than this bounded chunk.
      if (actorOverride?.skipWalletReversal === true) {
        for (const id of actorOverride.walletSkipSubmissionIds || []) {
          skipWalletDebitIds.add(String(id));
        }
        const summaries = actorOverride.walletRefundSummaryBySubmissionId || {};
        for (const [id, summary] of Object.entries(summaries)) {
          bulkRefundSummaryById.set(String(id), summary);
        }
      } else {
        const reversalIds = (
          Array.isArray(actorOverride?.walletReversalSubmissionIds) &&
          actorOverride.walletReversalSubmissionIds.length > 0
            ? actorOverride.walletReversalSubmissionIds
            : submissionIds
        ).map(String);

        // Every per-item call needs an unforgeable, short-lived authorization to
        // skip the debit already completed by this bounded preflight.
        try {
          assertBulkVerifyWalletContinuationSigningReady();
        } catch (secretErr) {
          console.error(
            "[bulk-verify-submissions] Wallet bypass signing not ready:",
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

        const walletResult = await applyBulkDualRewardsWalletReversals({
          supabaseAdmin,
          submissionIds: reversalIds,
        });
        if (!walletResult.ok) {
          console.error(
            "[bulk-verify-submissions] Wallet reversal preflight failed:",
            walletResult.error,
            {
              submissionCount: reversalIds.length,
              failedCount: walletResult.failedSubmissionIds?.length,
            },
          );
          return NextResponse.json(
            {
              error: walletResult.error,
              failed:
                walletResult.failedSubmissionIds?.length ?? reversalIds.length,
              failedSubmissionIds: walletResult.failedSubmissionIds,
            },
            { status: 500 },
          );
        }
        for (const id of walletResult.skipWalletDebitIds) {
          skipWalletDebitIds.add(id);
        }
        walletResult.refundSummaryBySubmissionId.forEach((summary, id) => {
          bulkRefundSummaryById.set(id, summary);
        });
      }

      if (skipWalletDebitIds.size > 0) {
        try {
          assertBulkVerifyWalletContinuationSigningReady();
        } catch (secretErr) {
          console.error(
            "[bulk-verify-submissions] Wallet bypass signing not ready:",
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
    }

    const results: { id: string; data: unknown }[] = [];
    const errors: { id: string; error: string }[] = [];
    // Wallet reversals run once above; per-item verify uses skipWalletDebit — safe to parallelize.
    const deferHeavySideEffects =
      actorOverride?.deferHeavySideEffects === true ||
      actorOverride?.ownershipPrevalidated === true;
    const concurrency = getVerifyConcurrency({ deferHeavySideEffects });

    for (let i = 0; i < submissionIds.length; i += concurrency) {
      const chunk = submissionIds.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (id) => {
          const res = await invokeVerifyWithRetries(
            {
              submissionId: id,
              action,
              reason,
              paymentDetails,
              qualityScore:
                action === "verified" ? resolvedBulkQualityScore : undefined,
              ...(skipWalletDebitIds.has(String(id))
                ? {
                    walletDebitBypassToken:
                      issueBulkVerifyWalletDebitBypass({
                        actorId,
                        action: String(action),
                        submissionId: String(id),
                        // Queue jobs can span many chunks; keep bypass valid for the run.
                        ttlMs: actorOverride?.deferHeavySideEffects
                          ? 30 * 60 * 1000
                          : undefined,
                      }),
                  }
                : {}),
            },
            actorOverride
              ? {
                  actorId: actorOverride.actorId,
                  isAdmin: actorOverride.isAdmin,
                  ownershipPrevalidated:
                    actorOverride.ownershipPrevalidated ?? true,
                  deferHeavySideEffects,
                }
              : undefined,
          );

          let data: unknown;
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await res.json();
          } else {
            data = await res.text();
          }

          if (!res.ok) {
            const errorMessage =
              typeof data === "string"
                ? data
                : (data as { error?: string })?.error ||
                  "Failed to verify submission";
            throw new Error(errorMessage);
          }

          const payload = data as Record<string, unknown>;
          const bulkSummary = bulkRefundSummaryById.get(String(id));
          if (bulkSummary && skipWalletDebitIds.has(String(id))) {
            payload.refund_summary = bulkSummary;
          }
          return payload;
        }),
      );

      chunkResults.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          results.push({ id: chunk[idx], data: res.value });
        } else {
          errors.push({
            id: chunk[idx],
            error: res.reason?.message || String(res.reason),
          });
        }
      });
    }

    const walletRefundSummaries =
      bulkRefundSummaryById.size > 0
        ? Object.fromEntries(bulkRefundSummaryById.entries())
        : undefined;

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
      ...(walletRefundSummaries
        ? { wallet_refund_summaries: walletRefundSummaries }
        : {}),
    });
  } catch (error: unknown) {
    console.error("[bulk-verify-submissions] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error in bulk verify",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as BulkSubmissionModerationPayload;
  return processBulkVerifySubmissions(payload);
}
