import { POST as verifySubmission } from "../verify-submission/route";
import { NextResponse } from "next/server";

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
    const batchSize = 10;
    
    // Copy headers safely
    const headers = new Headers();
    request.headers.forEach((value, key) => headers.set(key, value));

    for (let i = 0; i < submissionIds.length; i += batchSize) {
      const batch = submissionIds.slice(i, i + batchSize);
      const promises = batch.map(async (id) => {
        // Construct mock request for the single endpoint
        const mockRequest = new Request(request.url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            submissionId: id,
            action,
            reason,
            paymentDetails,
          }),
        });

        const res = await verifySubmission(mockRequest);
        
        let data: any;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await res.json();
        } else {
          data = await res.text();
        }

        if (!res.ok) {
          const errorMessage = typeof data === "string" ? data : data?.error || "Failed to verify submission";
          throw new Error(errorMessage);
        }
        return data;
      });

      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach((res, idx) => {
        if (res.status === "fulfilled") {
          results.push({ id: batch[idx], data: res.value });
        } else {
          errors.push({
            id: batch[idx],
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
