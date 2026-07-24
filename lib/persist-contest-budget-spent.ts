/**
 * Persist calculated budget_spent into contests.contest_based_details so list
 * cards and SQL budget sorts match detail/analytics without live hydrate.
 *
 * Covers leaderboard, CPM, milestone, and dual_rewards (pool_budget_spent_cents).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { enrichContestWithCalculatedBudgets } from "@/lib/contest-service";
import { clearContestsCache } from "@/lib/cache-utils";
import { invalidateCampaignListCachesAfterMutation } from "@/lib/campaign-list-cache";

type Details = Record<string, unknown>;

function asRecord(value: unknown): Details {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Details)
    : {};
}

/**
 * Merge only spend fields from enrichment into the latest DB JSON
 * (avoids clobbering unrelated nested config updated concurrently).
 */
export function mergePersistedBudgetSpentFields(
  baseDetails: unknown,
  enrichedDetails: unknown,
): Details {
  const base = asRecord(baseDetails);
  const enriched = asRecord(enrichedDetails);
  const next: Details = { ...base };

  const enrichedLb = asRecord(enriched.leaderboard_contest);
  if (enrichedLb.budget_spent != null) {
    next.leaderboard_contest = {
      ...asRecord(base.leaderboard_contest),
      budget_spent: Number(enrichedLb.budget_spent) || 0,
    };
  }

  const enrichedCpm = asRecord(enriched.cpm_contest);
  if (enrichedCpm.budget_spent != null) {
    next.cpm_contest = {
      ...asRecord(base.cpm_contest),
      budget_spent: Number(enrichedCpm.budget_spent) || 0,
    };
  }

  const enrichedMs = asRecord(enriched.milestone_contest);
  if (enrichedMs.budget_spent != null) {
    next.milestone_contest = {
      ...asRecord(base.milestone_contest),
      budget_spent: Number(enrichedMs.budget_spent) || 0,
    };
  }

  if (enriched.pool_budget_spent_cents != null) {
    next.pool_budget_spent_cents =
      Number(enriched.pool_budget_spent_cents) || 0;
  }

  return next;
}

export async function persistContestBudgetSpent(
  contestId: string | null | undefined,
  supabaseClient?: SupabaseClient,
): Promise<boolean> {
  if (!contestId) return false;

  const supabase = supabaseClient ?? createAdminClient();

  const { data: contest, error: loadError } = await supabase
    .from("contests_with_status")
    .select(
      "id, advertiser_id, contest_type, platform, contest_format, post_contest_status, max_earnings_per_creator, contest_based_details, status, moderation_status",
    )
    .eq("id", contestId)
    .maybeSingle();

  if (loadError || !contest) {
    console.error(
      "[persist-contest-budget-spent] load failed:",
      contestId,
      loadError?.message,
    );
    return false;
  }

  try {
    // Avoid serving a stale enrich cache from an earlier request in this process.
    clearContestsCache();

    const enriched = await enrichContestWithCalculatedBudgets(
      contest,
      supabase,
    );

    const { data: fresh, error: freshError } = await supabase
      .from("contests")
      .select("contest_based_details, advertiser_id")
      .eq("id", contestId)
      .maybeSingle();

    if (freshError) {
      console.error(
        "[persist-contest-budget-spent] re-read failed:",
        contestId,
        freshError.message,
      );
      return false;
    }

    const merged = mergePersistedBudgetSpentFields(
      fresh?.contest_based_details ?? contest.contest_based_details,
      enriched.contest_based_details,
    );

    const { error: updateError } = await supabase
      .from("contests")
      .update({
        contest_based_details: merged,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contestId);

    if (updateError) {
      console.error(
        "[persist-contest-budget-spent] update failed:",
        contestId,
        updateError.message,
      );
      return false;
    }

    clearContestsCache();
    const advertiserId =
      fresh?.advertiser_id ??
      (contest as { advertiser_id?: string }).advertiser_id;
    await invalidateCampaignListCachesAfterMutation({
      advertiserId,
      // Spend change does not change opportunity visibility.
      touchOpportunities: false,
    });

    return true;
  } catch (err) {
    console.error(
      "[persist-contest-budget-spent] unexpected:",
      contestId,
      err,
    );
    return false;
  }
}

/** Fire-and-log helper for request paths that should not fail on budget persist. */
export function schedulePersistContestBudgetSpent(
  contestId: string | null | undefined,
): void {
  if (!contestId) return;
  void persistContestBudgetSpent(contestId).then((ok) => {
    if (!ok) {
      console.warn(
        "[persist-contest-budget-spent] scheduled persist did not complete:",
        contestId,
      );
    }
  });
}

export async function persistContestBudgetSpentForContestIds(
  contestIds: string[],
  options?: { concurrency?: number },
): Promise<void> {
  const unique = [...new Set(contestIds.filter(Boolean))];
  if (unique.length === 0) return;

  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 3, 8));
  let index = 0;
  let failures = 0;

  async function worker() {
    while (index < unique.length) {
      const id = unique[index++];
      const ok = await persistContestBudgetSpent(id);
      if (!ok) failures += 1;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, unique.length) }, () =>
      worker(),
    ),
  );

  if (failures > 0) {
    console.error(
      `[persist-contest-budget-spent] ${failures}/${unique.length} contests failed`,
    );
  }
}
