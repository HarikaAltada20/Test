import { NextResponse } from "next/server";
import { CampaignAccessError } from "@/lib/campaign-access-server";
import {
  APPLICATION_RESULT_HTTP_STATUS,
  APPLICATION_RESULT_MESSAGES,
  MAX_REJECTION_REASON_LENGTH,
  isApplicationResult,
} from "@/lib/campaign-access";
import { invalidateOpportunitiesListCacheForUser } from "@/lib/campaign-list-cache";
import { notifyApplicationReviewed } from "@/lib/campaign-access-notifications";

/** Row returned by review_contest_application / bulk_review_contest_applications. */
export type ReviewRow = {
  result: string;
  application_id: string | null;
  contest_id: string | null;
  user_id: string | null;
};

/** JSON response for an application function result code. */
export function applicationResultResponse(
  code: unknown,
  extra: Record<string, unknown> = {},
): NextResponse {
  if (!isApplicationResult(code)) {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }
  const status = APPLICATION_RESULT_HTTP_STATUS[code];
  const message = APPLICATION_RESULT_MESSAGES[code];
  return NextResponse.json(
    status >= 400
      ? { error: message, result: code, ...extra }
      : { result: code, message, ...extra },
    { status },
  );
}

export function parseReviewBody(body: unknown): {
  decision: "approve" | "reject";
  reason: string | null;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.decision !== "approve" && b.decision !== "reject") {
    throw new CampaignAccessError("decision must be approve or reject", 400);
  }
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason.length > MAX_REJECTION_REASON_LENGTH) {
    throw new CampaignAccessError(
      `Reason must be ${MAX_REJECTION_REASON_LENGTH} characters or fewer`,
      400,
    );
  }
  return { decision: b.decision, reason: b.decision === "reject" && reason ? reason : null };
}

/** After reviews: refresh reviewed creators' list caches and notify them. */
export async function afterReview(rows: ReviewRow[], reason: string | null): Promise<void> {
  const approved = rows.filter((r) => r.result === "approved" && r.user_id);
  const rejected = rows.filter((r) => r.result === "rejected" && r.user_id);
  await Promise.all(
    [...approved, ...rejected].map((r) => invalidateOpportunitiesListCacheForUser(r.user_id)),
  );

  const contestId = rows.find((r) => r.contest_id)?.contest_id;
  if (!contestId) return;
  if (approved.length) {
    await notifyApplicationReviewed(contestId, approved.map((r) => r.user_id!), "approved", null);
  }
  if (rejected.length) {
    await notifyApplicationReviewed(contestId, rejected.map((r) => r.user_id!), "rejected", reason);
  }
}
