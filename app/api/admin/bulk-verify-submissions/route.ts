import { POST as verifySubmission } from "../verify-submission/route";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { applyBulkDualRewardsWalletReversals } from "@/lib/dual-rewards-bulk-reversal";
import { recomputeTrustForCreatorIds } from "@/lib/trust-score";

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

      if (userDataError || !userData || userData.user_type !== "advertiser") {
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

      const ownershipError = await assertAdvertiserOwnsSubmissions(
        submissionIds,
        authUser.id,
      );
      if (ownershipError) {
        return ownershipError;
      }
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
    // Wallet reversals run once above; per-item verify uses skipWalletDebit — safe to parallelize.
    const concurrency = getVerifyConcurrency();

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

    const TRUST_RECOMPUTE_ACTIONS = new Set([
      "verified",
      "rejected",
      "approve",
      "reject",
    ]);
    if (results.length > 0 && TRUST_RECOMPUTE_ACTIONS.has(action)) {
      const supabaseAdmin = createAdminClient();
      const processedIds = results.map((r) => r.id);
      const { data: submissionRows } = await supabaseAdmin
        .from("submissions")
        .select("creator_id")
        .in("id", processedIds);
      const creatorIds = (submissionRows || [])
        .map((row) => row.creator_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      await recomputeTrustForCreatorIds(supabaseAdmin, creatorIds);
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
