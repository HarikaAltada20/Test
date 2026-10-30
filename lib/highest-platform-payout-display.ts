/**
 * Display copy for "pay creators for their highest-earning platform only" on
 * the brand/admin campaign page, the creator popup and exports. Pure helpers
 * over the result of computeHighestPlatformDecisions (never recompute winners).
 */
import { centsToDollars } from "@/lib/currency-utils";
import {
  highestPlatformLabel,
  isSubmissionCountedForPayout,
  notCountedLabel,
  type CreatorPlatformDecision,
  type HighestPlatformDecisions,
} from "@/lib/highest-platform-payout";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type SubmissionRef = { id?: unknown; creator_id?: unknown; status?: unknown };

function formatUsd(cents: number): string {
  return `$${centsToDollars(Math.max(0, cents)).toFixed(2)}`;
}

function decisionForCreator(
  decisions: HighestPlatformDecisions | null | undefined,
  creatorId: unknown,
): CreatorPlatformDecision | undefined {
  if (!decisions?.enabled || !creatorId) return undefined;
  return decisions.byCreator.get(String(creatorId));
}

/** Each platform's total in campaign order, e.g. "YouTube $12.00 (counts) · Instagram $8.00". */
export function formatHighestPlatformTotals(
  decision: CreatorPlatformDecision | null | undefined,
  platforms: readonly VideoContestPlatform[],
): string {
  if (!decision) return "";
  const keys = Object.keys(decision.totalsCents) as VideoContestPlatform[];
  const order = [...platforms, ...keys.filter((p) => !platforms.includes(p))];
  return order
    .filter((p) => decision.totalsCents[p] != null)
    .map(
      (p) =>
        `${VIDEO_PLATFORM_LABELS[p]} ${formatUsd(decision.totalsCents[p] ?? 0)}${
          p === decision.winner ? " (counts)" : ""
        }`,
    )
    .join(" · ");
}

/** "Paid platform: Instagram" once paid there, otherwise "Leading: Instagram". */
export function highestPlatformCreatorLabel(
  decision: CreatorPlatformDecision | null | undefined,
): string {
  const winner = highestPlatformLabel(decision?.winner);
  if (!winner) return "";
  return decision?.lockedByPayment
    ? `Paid platform: ${winner}`
    : `Leading: ${winner}`;
}

/**
 * Creator-level label + tooltip; null when the rule is off or the creator has
 * earnings on fewer than two platforms (nothing to choose between).
 */
export function highestPlatformCreatorInfo(
  decisions: HighestPlatformDecisions | null | undefined,
  creatorId: unknown,
): { label: string; detail: string } | null {
  const decision = decisionForCreator(decisions, creatorId);
  if (!decision?.winner || Object.keys(decision.totalsCents).length < 2) {
    return null;
  }
  return {
    label: highestPlatformCreatorLabel(decision),
    detail: `Earnings by platform: ${formatHighestPlatformTotals(
      decision,
      decisions?.platforms ?? [],
    )}`,
  };
}

/** Chip label + tooltip for a submission that does not count; null when it counts. */
export function highestPlatformNotCountedInfo(
  decisions: HighestPlatformDecisions | null | undefined,
  submission: SubmissionRef,
): { label: string; detail: string } | null {
  if (isSubmissionCountedForPayout(decisions, String(submission.id ?? ""))) {
    return null;
  }
  const decision = decisionForCreator(decisions, submission.creator_id);
  const totals = formatHighestPlatformTotals(
    decision,
    decisions?.platforms ?? [],
  );
  return {
    label: notCountedLabel(decision),
    detail: totals
      ? `Only the creator's highest-earning platform is paid. Earnings by platform: ${totals}`
      : "Only the creator's highest-earning platform is paid.",
  };
}

/** Export cell: "Yes", or "No – paid for Instagram" when another platform counts. */
export function highestPlatformCountsTowardPayoutCell(
  decisions: HighestPlatformDecisions | null | undefined,
  submission: SubmissionRef,
): string {
  if (
    decisions?.enabled &&
    String(submission.status ?? "").toLowerCase() === "rejected"
  ) {
    return "No";
  }
  if (isSubmissionCountedForPayout(decisions, String(submission.id ?? ""))) {
    return "Yes";
  }
  const winner = highestPlatformLabel(
    decisionForCreator(decisions, submission.creator_id)?.winner,
  );
  return winner ? `No – paid for ${winner}` : "No";
}

/** Export cell: the creator's paid (or currently leading) platform, "" when none. */
export function highestPlatformPaidPlatformCell(
  decisions: HighestPlatformDecisions | null | undefined,
  creatorId: unknown,
): string {
  return highestPlatformLabel(decisionForCreator(decisions, creatorId)?.winner);
}

/** How many of `rows` do not count toward payout (0 when the rule is off). */
export function countNotCountedSubmissions(
  decisions: HighestPlatformDecisions | null | undefined,
  rows: ReadonlyArray<{ id: string }>,
): number {
  if (!decisions?.enabled || decisions.excludedSubmissionIds.size === 0) {
    return 0;
  }
  let count = 0;
  for (const row of rows) {
    if (decisions.excludedSubmissionIds.has(String(row.id))) count += 1;
  }
  return count;
}

/** One-line rule note for export headers and report covers. */
export function highestPlatformExportRuleNote(
  platforms: readonly VideoContestPlatform[],
): string {
  const tieBreak = platforms[0]
    ? ` Ties go to ${VIDEO_PLATFORM_LABELS[platforms[0]]}.`
    : "";
  return `Each creator is paid only for their highest-earning platform; their other platforms count $0.${tieBreak}`;
}
