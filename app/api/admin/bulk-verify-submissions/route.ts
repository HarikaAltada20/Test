import { POST as verifySubmission } from "../verify-submission/route";
import { NextResponse } from "next/server";

/** Default matches previous behavior (10 parallel verifies). Override via env if you see DB/connect saturation. */
function getVerifyConcurrency(): number {
  const raw = process.env.BULK_VERIFY_SUBMISSIONS_CONCURRENCY;
  if (raw === undefined || raw === "") return 10;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 25);
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
    const { submissionIds, action, reason, paymentDetails } = await request.json();

    if (!Array.isArray(submissionIds)) {
      return NextResponse.json(
        { error: "submissionIds must be an array" },
        { status: 400 }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];
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
              }),
            });

          const res = await invokeVerifyWithRetries(buildRequest);

          let data: any;
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await res.json();
          } else {
            data = await res.text();
          }

          if (!res.ok) {
            const errorMessage =
              typeof data === "string" ? data : data?.error || "Failed to verify submission";
            throw new Error(errorMessage);
          }
          return data;
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
      success: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (error: any) {
    console.error("[bulk-verify-submissions] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error in bulk verify" },
      { status: 500 }
    );
  }
}
