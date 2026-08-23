import { POST as moderateSubmission } from "../moderate-submission/route";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tweetIds, action, reason, admin_user_id, skipWalletReversal } =
      await request.json();

    if (!Array.isArray(tweetIds)) {
      return NextResponse.json(
        { error: "tweetIds must be an array" },
        { status: 400 }
      );
    }

    const results: { id: string; data: any }[] = [];
    const errors: { id: string; error: string }[] = [];
    const batchSize = 10;
    
    // Copy headers safely
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));

    for (let i = 0; i < tweetIds.length; i += batchSize) {
      const batch = tweetIds.slice(i, i + batchSize);
      const promises = batch.map(async (id) => {
        // Construct mock request for the single endpoint
        const mockRequest = new Request(request.url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            tweetId: id,
            action,
            reason,
            ...(skipWalletReversal === true ? { skipWalletReversal: true } : {}),
            ...(typeof admin_user_id === "string" && admin_user_id.trim()
              ? { admin_user_id: admin_user_id.trim() }
              : {}),
          }),
        });

        // Pass params Promise downstream requirement in Next 15+
        const res = await moderateSubmission(mockRequest, { params });
        
        let data: any;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          data = await res.text();
        }

        if (!res.ok) {
          const errorMessage = typeof data === "string" ? data : data?.error || "Failed to moderate tweet";
          throw new Error(errorMessage);
        }
        return data;
      });

      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          results.push({ id: batch[idx], data: res.value });
        } else {
          const errorMessage = res.reason?.message || String(res.reason);
          console.warn(
            "[bulk-moderate-submissions] tweet failed:",
            batch[idx],
            errorMessage,
          );
          errors.push({
            id: batch[idx],
            error: errorMessage,
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
    console.error("[bulk-moderate-submissions] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error in bulk moderation" },
      { status: 500 }
    );
  }
}
