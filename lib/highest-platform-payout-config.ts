/**
 * Saving and locking the campaign-wide "highest-earning platform only" switch
 * (contest_based_details.highest_platform_payout_only).
 *
 * Every save writes the flag explicitly, so a rebuilt or merged details object
 * never drops a `true` or keeps a stale one. Who may change it: brand and admin
 * until the campaign starts, admin only while it is live, nobody once it ends.
 */
import {
  HIGHEST_PLATFORM_PAYOUT_KEY,
  canUseHighestPlatformPayout,
} from "@/lib/highest-platform-payout";

/**
 * Copy of `details` with the flag set to `true` when the switch is on and the
 * campaign can use it; otherwise the key is removed.
 */
export function withHighestPlatformPayoutFlag(
  details: Record<string, unknown> | null | undefined,
  enabled: boolean,
  contestType: string | null | undefined,
  platformCount: number,
  contestFormat?: string | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(details ?? {}) };
  if (
    enabled &&
    canUseHighestPlatformPayout(contestType, platformCount, contestFormat)
  ) {
    next[HIGHEST_PLATFORM_PAYOUT_KEY] = true;
  } else {
    delete next[HIGHEST_PLATFORM_PAYOUT_KEY];
  }
  return next;
}

export type HighestPlatformLockContest = {
  moderation_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  post_contest_status?: string | null;
};

function isPast(date: string | null | undefined, now: number): boolean {
  if (!date) return false;
  const time = new Date(date).getTime();
  return Number.isFinite(time) && time <= now;
}

/**
 * The post-campaign review has started, or a campaign that left draft is past
 * its end date. A draft never ran, so old dates on it do not count.
 */
export function hasCampaignEnded(
  contest: HighestPlatformLockContest | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!contest) return false;
  if (contest.post_contest_status) return true;
  return contest.moderation_status !== "draft" && isPast(contest.end_date, now);
}

/** Why the switch cannot be changed right now, or null when it can. */
export function highestPlatformPayoutLockReason(
  contest: HighestPlatformLockContest | null | undefined,
  isAdmin: boolean,
  now: number = Date.now(),
): string | null {
  if (!contest) return null;
  if (hasCampaignEnded(contest, now)) {
    return "Locked because the campaign has ended.";
  }
  if (
    !isAdmin &&
    contest.moderation_status === "published" &&
    isPast(contest.start_date, now)
  ) {
    return "Only an admin can change this while the campaign is live.";
  }
  return null;
}
