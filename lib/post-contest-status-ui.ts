import { POST_CONTEST_STATUS, type PostContestStatus } from "@/lib/constants-status";
import { getEndedOpportunityBadgeClassName } from "@/lib/contest-ended-phase-display";

export type PostContestStatusOption = {
  value: PostContestStatus;
  label: string;
  description: string;
};

export const POST_CONTEST_STATUS_OPTIONS: PostContestStatusOption[] = [
  {
    value: POST_CONTEST_STATUS.pending_review,
    label: "Pending Review",
    description: "Review has not started yet",
  },
  {
    value: POST_CONTEST_STATUS.in_review,
    label: "In Review",
    description: "Submissions are in review",
  },
  {
    value: POST_CONTEST_STATUS.verification_complete,
    label: "Verification Completed",
    description: "Submissions have been reviewed. Payouts processing",
  },
  {
    value: POST_CONTEST_STATUS.payouts_processed,
    label: "Payouts Processed",
    description: "All payments have been released",
  },
];

const STATUS_ORDER: PostContestStatus[] = [
  POST_CONTEST_STATUS.pending_review,
  POST_CONTEST_STATUS.in_review,
  POST_CONTEST_STATUS.verification_complete,
  POST_CONTEST_STATUS.payouts_processed,
];

export function getPostContestStatusLabel(
  status: string | null | undefined,
): string {
  const normalized = String(status || "").trim();
  const match = POST_CONTEST_STATUS_OPTIONS.find(
    (opt) => opt.value === normalized,
  );
  if (match) return match.label;
  if (!normalized) return "Not set";
  return normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getPostContestStatusBadgeClassName(
  isDark: boolean,
  status: string | null | undefined,
): string {
  return getEndedOpportunityBadgeClassName(isDark, status);
}

export function getAvailablePostContestTransitions(params: {
  current: string | null | undefined;
  isAdmin: boolean;
}): PostContestStatusOption[] {
  const current = String(params.current || POST_CONTEST_STATUS.pending_review);
  const currentIndex = STATUS_ORDER.indexOf(current as PostContestStatus);

  if (!params.isAdmin) {
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    return POST_CONTEST_STATUS_OPTIONS.filter(
      (opt, index) =>
        index > startIndex && opt.value !== POST_CONTEST_STATUS.payouts_processed,
    );
  }

  return POST_CONTEST_STATUS_OPTIONS.filter((opt) => opt.value !== current);
}

/** Recommended default when opening the status dialog (next forward step). */
export function getRecommendedPostContestTransition(
  current: string | null | undefined,
  isAdmin: boolean,
): PostContestStatus | null {
  const available = getAvailablePostContestTransitions({ current, isAdmin });
  if (available.length === 0) return null;

  const currentIndex = STATUS_ORDER.indexOf(
    (current || POST_CONTEST_STATUS.pending_review) as PostContestStatus,
  );
  if (currentIndex >= 0 && currentIndex < STATUS_ORDER.length - 1) {
    const nextForward = STATUS_ORDER[currentIndex + 1];
    const forwardOption = available.find((opt) => opt.value === nextForward);
    if (forwardOption) return forwardOption.value;
  }

  return available[0]?.value ?? null;
}

export function statusTransitionRequiresViewSync(
  target: PostContestStatus,
): boolean {
  return (
    target === POST_CONTEST_STATUS.verification_complete ||
    target === POST_CONTEST_STATUS.payouts_processed
  );
}

export const STATUS_TRANSITION_IMPACT_TITLE =
  "What will happen if you continue";

export function getStatusTransitionImpact(
  target: PostContestStatus | string,
): string[] {
  switch (target) {
    case POST_CONTEST_STATUS.pending_review:
      return [
        "It will mark this campaign as pending review (review not started yet).",
        "It will keep submission moderation available.",
      ];
    case POST_CONTEST_STATUS.in_review:
      return [
        "It will mark this campaign as in review.",
        "It will keep submission moderation available.",
      ];
    case POST_CONTEST_STATUS.verification_complete:
      return [
        "It will sync verified and paid submission views to creator profiles.",
        "It will remove credited views for pending and rejected submissions.",
        "It will lock verified submission view counts for this campaign.",
        "It will enable payment actions in the admin dashboard.",
      ];
    case POST_CONTEST_STATUS.payouts_processed:
      return [
        "It will sync verified and paid submission views to creator profiles.",
        "It will lock view counts for this campaign.",
        "It will mark the campaign as fully paid out.",
        "It will lock submission moderation after payouts are complete.",
      ];
    default:
      return [];
  }
}
