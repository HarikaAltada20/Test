/** Shared labels + badge styles for ended contests (creator Opportunities + brand contest list). */

export const KNOWN_POST_CONTEST_STATUSES = new Set([
  "pending_review",
  "in_review",
  "verification_complete",
  "payouts_processed",
]);

/** Label from post_contest_status; null/unknown → Pending review */
export function getEndedOpportunityPhaseLabel(
  postContestStatus: string | null | undefined,
): string {
  const s = postContestStatus ?? "";
  if (!s || !KNOWN_POST_CONTEST_STATUSES.has(s)) {
    return "Pending review";
  }
  switch (s) {
    case "pending_review":
      return "Pending review";
    case "in_review":
      return "In review";
    case "verification_complete":
      return "Payments processing";
    case "payouts_processed":
      return "Paid";
    default:
      return "Pending review";
  }
}

export type EndedPhaseKey =
  | "pending_review"
  | "in_review"
  | "verification_complete"
  | "payouts_processed";

export function getEndedPhaseKey(
  postContestStatus: string | null | undefined,
): EndedPhaseKey {
  const s = postContestStatus ?? "";
  if (!s || !KNOWN_POST_CONTEST_STATUSES.has(s)) {
    return "pending_review";
  }
  return s as EndedPhaseKey;
}

/** Styling for ended-contest phase badges */
export function getEndedOpportunityBadgeClassName(
  isDark: boolean,
  postContestStatus: string | null | undefined,
): string {
  const phase = getEndedPhaseKey(postContestStatus);
  if (isDark) {
    switch (phase) {
      case "pending_review":
        return "bg-yellow-900/40 text-yellow-200 border-yellow-500";
      case "in_review":
        return "bg-orange-900/40 text-orange-200 border-orange-500";
      case "verification_complete":
        return "bg-purple-900/40 text-purple-200 border-purple-500";
      case "payouts_processed":
        return "bg-[#7F39EC] text-white border-[#7F39EC]";
      default:
        return "bg-yellow-900/40 text-yellow-200 border-yellow-500";
    }
  }
  switch (phase) {
    case "pending_review":
      return "bg-yellow-100 text-yellow-900 border-yellow-400";
    case "in_review":
      return "bg-orange-100 text-orange-900 border-orange-400";
    case "verification_complete":
      return "bg-purple-100 text-purple-800 border-purple-400";
    case "payouts_processed":
      return "bg-[#7F39EC] text-white border-[#7F39EC]";
    default:
      return "bg-yellow-100 text-yellow-900 border-yellow-400";
  }
}
