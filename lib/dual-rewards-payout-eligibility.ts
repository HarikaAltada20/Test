import type { SupabaseClient } from "@supabase/supabase-js";
import type { MilestonePayoutRule } from "@/lib/contest-utils-client";
import {
  buildMilestoneSubmissionPayoutCentsMapForCreator,
  getMilestoneEligibleViewsFromRow,
  getMilestonePayoutCentsFromViews,
  milestonesRequireContestWideFcfs,
} from "@/lib/milestone-contest-expected-spend";
import { buildDualRewardCreatorCapSplitMaps } from "@/lib/dual-rewards-creator-cap";

export const DUAL_PAYOUT_ELIGIBLE_STATUSES = [
  "pending",
  "verified",
  "paid",
] as const;

export const DUAL_PAYOUT_ELIGIBLE_SUBMISSION_SELECT =
  "id, creator_id, status, views, created_at, platform, other_stats";

/** Contest-wide rows for milestone FCFS (no per-creator filter). */
export const DUAL_PAYOUT_MILESTONE_FCFS_SELECT =
  "id, creator_id, created_at, status, views, platform, other_stats";

export type DualPayoutEligibleRecord = {
  id: string;
  creator_id?: string | null;
  created_at: string;
  status?: string | null;
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
};

export type DualCreatorCapMaps = {
  milestoneCappedBySubmissionId: Map<string, number>;
  cpmCappedBySubmissionId: Map<string, number>;
};

export function toDualPayoutEligibleRecords(
  subs: Array<Record<string, unknown>>,
): DualPayoutEligibleRecord[] {
  return subs.map((sub) => ({
    id: String(sub.id),
    creator_id: sub.creator_id as string | null | undefined,
    created_at: String(sub.created_at ?? ""),
    status: sub.status as string | null | undefined,
    views: sub.views != null ? Number(sub.views) : null,
    platform: sub.platform != null ? String(sub.platform) : null,
    other_stats: sub.other_stats,
  }));
}

export function computeDualCpmRawCentsFromRow(
  row: { views?: number | null },
  cpm:
    | {
        cpm_rate_usd?: number;
        min_views?: number;
        max_views?: number;
      }
    | null
    | undefined,
): number {
  const rate = typeof cpm?.cpm_rate_usd === "number" ? cpm.cpm_rate_usd : 0;
  let effectiveViews = Number(row.views) || 0;
  if (typeof cpm?.min_views === "number" && effectiveViews < cpm.min_views) {
    effectiveViews = 0;
  }
  if (typeof cpm?.max_views === "number" && effectiveViews > cpm.max_views) {
    effectiveViews = cpm.max_views;
  }
  return Math.round(((effectiveViews * rate) / 1000) * 100);
}

function buildMilestoneRawMapForCreator(
  creatorRecords: DualPayoutEligibleRecord[],
  milestones: MilestonePayoutRule[],
  contestFcfsRows: DualPayoutEligibleRecord[] | null,
  creatorId: string,
): Map<string, number> {
  if (
    contestFcfsRows &&
    contestFcfsRows.length > 0 &&
    milestonesRequireContestWideFcfs(milestones)
  ) {
    return buildMilestoneSubmissionPayoutCentsMapForCreator(
      contestFcfsRows,
      milestones,
      creatorId,
    );
  }

  const map = new Map<string, number>();
  for (const r of creatorRecords) {
    const views = getMilestoneEligibleViewsFromRow(r);
    map.set(String(r.id), getMilestonePayoutCentsFromViews(views, milestones));
  }
  return map;
}

/** Cap maps from creator rows + precomputed milestone raw amounts. */
export function buildDualCreatorCapMapsFromCreatorRows(
  creatorRecords: DualPayoutEligibleRecord[],
  milestoneRawBySubmissionId: Map<string, number>,
  cpmCfg: unknown,
  maxCap: number,
): DualCreatorCapMaps {
  const dualRows = [...creatorRecords]
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map((r) => ({
      id: String(r.id),
      created_at: String(r.created_at || ""),
      mRawCents: Number(milestoneRawBySubmissionId.get(String(r.id)) || 0),
      cRawCents: computeDualCpmRawCentsFromRow(r, cpmCfg as any),
    }));
  return buildDualRewardCreatorCapSplitMaps(dualRows, maxCap);
}

async function fetchCreatorPayoutSubmissions(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  creatorId: string,
): Promise<
  | { records: DualPayoutEligibleRecord[]; error?: undefined }
  | { records?: undefined; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(DUAL_PAYOUT_ELIGIBLE_SUBMISSION_SELECT)
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .in("status", [...DUAL_PAYOUT_ELIGIBLE_STATUSES])
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }
  return { records: toDualPayoutEligibleRecords(data || []) };
}

async function fetchContestMilestoneFcfsRows(
  supabaseAdmin: SupabaseClient,
  contestId: string,
): Promise<
  | { records: DualPayoutEligibleRecord[]; error?: undefined }
  | { records?: undefined; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(DUAL_PAYOUT_MILESTONE_FCFS_SELECT)
    .eq("contest_id", contestId)
    .in("status", [...DUAL_PAYOUT_ELIGIBLE_STATUSES])
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }
  return { records: toDualPayoutEligibleRecords(data || []) };
}

/**
 * Loads creator-scoped submissions for cap/CPM; contest-wide rows only when
 * milestones use winner_limit FCFS. Builds cap maps once.
 */
export async function loadDualCreatorCapMaps(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  creatorId: string,
  milestones: MilestonePayoutRule[],
  cpmCfg: unknown,
  maxCap: number,
): Promise<
  | { maps: DualCreatorCapMaps; error?: undefined }
  | { maps?: undefined; error: string }
> {
  const needsFcfs = milestonesRequireContestWideFcfs(milestones);

  const creatorResult = await fetchCreatorPayoutSubmissions(
    supabaseAdmin,
    contestId,
    creatorId,
  );
  if (creatorResult.error) {
    return { error: creatorResult.error };
  }

  let contestFcfsRows: DualPayoutEligibleRecord[] = [];
  if (needsFcfs) {
    const contestResult = await fetchContestMilestoneFcfsRows(
      supabaseAdmin,
      contestId,
    );
    if (contestResult.error) {
      return { error: contestResult.error };
    }
    contestFcfsRows = contestResult.records ?? [];
  }

  const creatorRecords = creatorResult.records ?? [];
  const milestoneRaw = buildMilestoneRawMapForCreator(
    creatorRecords,
    milestones,
    needsFcfs ? contestFcfsRows : null,
    creatorId,
  );

  const maps = buildDualCreatorCapMapsFromCreatorRows(
    creatorRecords,
    milestoneRaw,
    cpmCfg,
    maxCap,
  );

  return { maps };
}

/** @deprecated Prefer `loadDualCreatorCapMaps` (creator-scoped + conditional FCFS). */
export async function fetchDualPayoutEligibleSubmissions(
  supabaseAdmin: SupabaseClient,
  contestId: string,
): Promise<
  | { records: DualPayoutEligibleRecord[]; error?: undefined }
  | { records?: undefined; error: string }
> {
  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(DUAL_PAYOUT_ELIGIBLE_SUBMISSION_SELECT)
    .eq("contest_id", contestId)
    .in("status", [...DUAL_PAYOUT_ELIGIBLE_STATUSES])
    .order("created_at", { ascending: true });

  if (error) {
    return { error: error.message };
  }
  return { records: toDualPayoutEligibleRecords(data || []) };
}

/**
 * @deprecated Use `loadDualCreatorCapMaps`. Kept for callers that already have all rows.
 */
export function buildDualCreatorCapMaps(
  records: DualPayoutEligibleRecord[],
  milestones: unknown[],
  cpmCfg: unknown,
  creatorId: string,
  maxCap: number,
): DualCreatorCapMaps & { payoutBySubmissionId: Map<string, number> } {
  const milestoneRules = milestones as MilestonePayoutRule[];
  const creatorRecords = records.filter(
    (r) => String(r.creator_id) === String(creatorId),
  );
  const milestoneRaw = buildMilestoneRawMapForCreator(
    creatorRecords,
    milestoneRules,
    milestonesRequireContestWideFcfs(milestoneRules) ? records : null,
    creatorId,
  );
  const maps = buildDualCreatorCapMapsFromCreatorRows(
    creatorRecords,
    milestoneRaw,
    cpmCfg,
    maxCap,
  );
  return { ...maps, payoutBySubmissionId: milestoneRaw };
}
