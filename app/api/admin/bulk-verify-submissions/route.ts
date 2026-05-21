import { POST as verifySubmission } from "../verify-submission/route";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { applyBulkDualRewardsWalletReversals } from "@/lib/dual-rewards-bulk-reversal";

/** Default matches previous behavior (10 parallel verifies). Override via env if you see DB/connect saturation. */
function getVerifyConcurrency(): number {
  const raw = process.env.BULK_VERIFY_SUBMISSIONS_CONCURRENCY;
  if (raw === undefined || raw === "") return 10;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 25);
}

function isPaidReversalBulkAction(action: string): boolean {
  return action === "verified" || action === "pending" || action === "rejected";
}

function isTransientVerifyNetworkError(err: unknown): boolean {
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
    (msg.includes("socket") && msg.includes("hang"))
  );
}

async function invokeVerifyWithRetries(
  buildRequest: () => Request,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await verifySubmission(buildRequest());
    } catch (e) {
      lastError = e;
      if (!isTransientVerifyNetworkError(e) || attempt === maxAttempts) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  try {
    const { submissionIds, action, reason, paymentDetails } =
      await request.json();

    if (!Array.isArray(submissionIds)) {
      return NextResponse.json(
        { error: "submissionIds must be an array" },
        { status: 400 },
      );
    }

    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 },
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
      const walletResult = await applyBulkDualRewardsWalletReversals({
        supabaseAdmin,
        submissionIds,
      });
      if (!walletResult.ok) {
        return NextResponse.json(
          {
            error: walletResult.error,
            failed: walletResult.failedSubmissionIds?.length ?? submissionIds.length,
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

    const results: { id: string; data: unknown }[] = [];
    const errors: { id: string; error: string }[] = [];
    const concurrency = isPaidReversalBulkAction(action)
      ? 1
      : getVerifyConcurrency();

    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));

    for (let i = 0; i < submissionIds.length; i += concurrency) {
      const chunk = submissionIds.slice(i, i + concurrency);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (id) => {
          const buildRequest = () =>
            new Request(request.url, {
              method: "POST",
              headers,
              body: JSON.stringify({
                submissionId: id,
                action,
                reason,
                paymentDetails,
                skipWalletDebit: skipWalletDebitIds.has(String(id)),
              }),
            });

          const res = await invokeVerifyWithRetries(buildRequest);

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

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
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
