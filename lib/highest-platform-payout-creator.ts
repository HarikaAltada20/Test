/**
 * Creator view of the "highest-earning platform only" rule: the caller's own
 * decision for one campaign (served by GET /api/submissions/highest-platform,
 * which decides from the campaign's full submission list) and the labels the
 * creator screens show next to each submission.
 */
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  highestPlatformBucket,
  highestPlatformLabel,
  notCountedLabel,
  type HighestPlatformDecisions,
} from "@/lib/highest-platform-payout";
import type { VideoContestPlatform } from "@/lib/video-platform-campaigns";

/** Max campaigns per request to the highest-platform route. */
export const HIGHEST_PLATFORM_SUMMARY_MAX_CONTESTS = 50;

export type CreatorHighestPlatformSummary = {
  contestId: string;
  /** Campaign platforms in tie-break order. */
  platforms: VideoContestPlatform[];
  winner: VideoContestPlatform | null;
  provisional: boolean;
  lockedByPayment: boolean;
  /** Each platform's total (after caps, before payout adjustment), cents. */
  totalsCents: Partial<Record<VideoContestPlatform, number>>;
  /** The caller's own submissions that do not count. */
  excludedSubmissionIds: string[];
};

export type CreatorSubmissionPayoutTag = {
  /** false → "Not counted" chip; true → "Leading" / "Paid platform" tag. */
  counted: boolean;
  label: string;
  detail: string;
};

/** One creator's slice of the campaign decisions (never other creators' data). */
export function buildCreatorHighestPlatformSummary(
  contestId: string,
  decisions: HighestPlatformDecisions,
  creatorId: string,
  creatorSubmissionIds: Iterable<string>,
): CreatorHighestPlatformSummary | null {
  if (!decisions.enabled) return null;
  const decision = decisions.byCreator.get(creatorId);
  if (!decision) return null;
  const excludedSubmissionIds: string[] = [];
  for (const id of creatorSubmissionIds) {
    if (decisions.excludedSubmissionIds.has(String(id))) {
      excludedSubmissionIds.push(String(id));
    }
  }
  return {
    contestId,
    platforms: decisions.platforms,
    winner: decision.winner,
    provisional: decision.provisional,
    lockedByPayment: decision.lockedByPayment,
    totalsCents: decision.totalsCents,
    excludedSubmissionIds,
  };
}

export function isCreatorSubmissionExcluded(
  summary: CreatorHighestPlatformSummary | null | undefined,
  submissionId: string | null | undefined,
): boolean {
  if (!summary || !submissionId) return false;
  return summary.excludedSubmissionIds.includes(String(submissionId));
}

/** "Your totals: YouTube $42.00 · Instagram $18.00." */
export function creatorPlatformTotalsText(
  summary: CreatorHighestPlatformSummary,
): string {
  const parts = summary.platforms
    .filter((platform) => summary.totalsCents[platform] != null)
    .map(
      (platform) =>
        `${highestPlatformLabel(platform)} ${formatCurrencyFromCents(summary.totalsCents[platform] ?? 0)}`,
    );
  return parts.length > 0 ? `Your totals: ${parts.join(" · ")}.` : "";
}

/** True when the creator has entries on more than one platform. */
function isMultiPlatformCreator(summary: CreatorHighestPlatformSummary): boolean {
  return (
    summary.excludedSubmissionIds.length > 0 ||
    Object.keys(summary.totalsCents).length >= 2
  );
}

/**
 * Chip/tag for one of the creator's own submissions, or null when the rule
 * does not change anything for it.
 */
export function creatorSubmissionPayoutTag(
  summary: CreatorHighestPlatformSummary | null | undefined,
  submission: { id: string; platform?: string | null; status?: string | null },
): CreatorSubmissionPayoutTag | null {
  if (!summary?.winner) return null;
  if (String(submission.status || "").toLowerCase() === "rejected") return null;
  const totals = creatorPlatformTotalsText(summary);
  const winner = highestPlatformLabel(summary.winner);

  if (isCreatorSubmissionExcluded(summary, submission.id)) {
    return {
      counted: false,
      label: notCountedLabel({ ...summary, creatorId: "" }),
      detail: `${totals} Only ${winner} is paid.`.trim(),
    };
  }

  if (
    !isMultiPlatformCreator(summary) ||
    highestPlatformBucket(submission.platform, summary.platforms) !==
      summary.winner
  ) {
    return null;
  }
  return summary.lockedByPayment
    ? {
        counted: true,
        label: "Paid platform",
        detail: `${totals} You're paid for ${winner}.`.trim(),
      }
    : {
        counted: true,
        label: "Leading",
        detail:
          `${totals} ${winner} earns you the most right now. Your leading platform can change until views are locked for payout.`.trim(),
      };
}

/** Client fetch of the caller's summaries, keyed by contest id. */
export async function fetchCreatorHighestPlatformSummaries(
  contestIds: string[],
): Promise<Record<string, CreatorHighestPlatformSummary>> {
  const ids = Array.from(new Set(contestIds.filter(Boolean)));
  const out: Record<string, CreatorHighestPlatformSummary> = {};
  for (let i = 0; i < ids.length; i += HIGHEST_PLATFORM_SUMMARY_MAX_CONTESTS) {
    const chunk = ids.slice(i, i + HIGHEST_PLATFORM_SUMMARY_MAX_CONTESTS);
    const res = await fetch(
      `/api/submissions/highest-platform?contestIds=${encodeURIComponent(chunk.join(","))}`,
    );
    if (!res.ok) {
      throw new Error(`Failed to load best-platform payouts (${res.status})`);
    }
    const data = (await res.json()) as {
      summaries?: CreatorHighestPlatformSummary[];
    };
    for (const summary of data.summaries ?? []) {
      out[summary.contestId] = summary;
    }
  }
  return out;
}
