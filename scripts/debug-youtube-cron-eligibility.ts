/**
 * Read-only diagnostic for YouTube metrics cron contest eligibility.
 * Does NOT call YouTube API or update submissions.
 *
 * Usage:
 *   npx tsx scripts/debug-youtube-cron-eligibility.ts
 *   npx tsx scripts/debug-youtube-cron-eligibility.ts <contest-id>
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  isContestEligibleForScheduledMetricsCron,
  isContestEligibleForScheduledMetricsRefresh,
  isPostContestMetricsLocked,
  SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER,
} from "../lib/contest-metrics-refresh-eligibility";

config({ path: ".env.local" });
config();

const DEFAULT_BUG_CONTEST_ID = "58e8c4be-303c-46a9-8fa8-22288d9e6016";

type ContestRow = {
  id: string;
  title?: string | null;
  post_contest_status?: string | null;
  views_locked_at?: string | null;
  contest_type?: string | null;
  last_metrics_updated?: string | null;
};

function summarizeByStatus(contests: ContestRow[]) {
  const byStatus = new Map<string, number>();
  for (const c of contests) {
    const key = c.post_contest_status ?? "(null)";
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...byStatus.entries()].sort());
}

async function countSubmissions(
  supabase: ReturnType<typeof createClient>,
  contestIds: string[],
) {
  if (!contestIds.length) return 0;
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .in("contest_id", contestIds)
    .neq("status", "rejected")
    .not("content_link", "is", null);
  if (error) throw new Error(`Submission count failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local",
    );
    process.exit(1);
  }

  const targetContestId = process.argv[2]?.trim() || DEFAULT_BUG_CONTEST_ID;
  const supabase = createClient(url, key);

  console.log("=== YouTube cron eligibility diagnostic (read-only) ===\n");
  console.log(`Supabase URL: ${url}`);
  console.log(`Target contest: ${targetContestId}\n`);

  // 1) Target contest snapshot
  const { data: targetContest, error: targetError } = await supabase
    .from("contests")
    .select(
      "id, title, post_contest_status, views_locked_at, contest_type, last_metrics_updated",
    )
    .eq("id", targetContestId)
    .maybeSingle();

  if (targetError) {
    throw new Error(`Target contest fetch failed: ${targetError.message}`);
  }

  if (!targetContest) {
    console.log("Target contest: NOT FOUND in this database.\n");
  } else {
    const eligible = isContestEligibleForScheduledMetricsRefresh(targetContest);
    const locked = isPostContestMetricsLocked(targetContest.post_contest_status);
    console.log("--- Target contest ---");
    console.log(`  title: ${targetContest.title ?? "(no title)"}`);
    console.log(`  post_contest_status: ${targetContest.post_contest_status ?? "(null)"}`);
    console.log(`  views_locked_at: ${targetContest.views_locked_at ?? "(null)"}`);
    console.log(`  contest_type: ${targetContest.contest_type ?? "(null)"}`);
    console.log(`  last_metrics_updated: ${targetContest.last_metrics_updated ?? "(null)"}`);
    console.log(`  isPostContestMetricsLocked: ${locked}`);
    console.log(`  isContestEligibleForScheduledMetricsRefresh: ${eligible}`);
    console.log(
      `  cron WOULD ${eligible ? "INCLUDE" : "EXCLUDE"} this contest\n`,
    );
  }

  // 2) Old buggy query (views_locked_at only — no post_contest filter)
  const { data: oldQueryContests, error: oldError } = await supabase
    .from("contests")
    .select("id, post_contest_status, views_locked_at")
    .is("views_locked_at", null);

  if (oldError) {
    throw new Error(`Old-style query failed: ${oldError.message}`);
  }

  const oldRows = (oldQueryContests ?? []) as ContestRow[];
  const oldIncludesTarget = oldRows.some((c) => c.id === targetContestId);
  const oldLockedIncluded = oldRows.filter((c) =>
    isPostContestMetricsLocked(c.post_contest_status),
  );

  console.log("--- Old cron query (views_locked_at IS NULL only) ---");
  console.log(`  total contests: ${oldRows.length}`);
  console.log(`  by post_contest_status:`, summarizeByStatus(oldRows));
  console.log(`  includes target contest: ${oldIncludesTarget}`);
  console.log(
    `  locked-status contests wrongly included: ${oldLockedIncluded.length}`,
  );
  if (oldLockedIncluded.length) {
    console.log(
      "  sample locked IDs:",
      oldLockedIncluded.slice(0, 5).map((c) => ({
        id: c.id,
        post_contest_status: c.post_contest_status,
      })),
    );
  }
  console.log();

  // 3) Current cron Supabase .or() filter (same as route.ts)
  const nowIso = new Date().toISOString();
  const { data: newQueryContests, error: newError } = await supabase
    .from("contests")
    .select(
      "id, post_contest_status, views_locked_at, start_date, end_date, moderation_status",
    )
    .eq("platform", "youtube")
    .eq("moderation_status", "published")
    .is("views_locked_at", null)
    .not("start_date", "is", null)
    .not("end_date", "is", null)
    .lte("start_date", nowIso)
    .or(SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER);

  if (newError) {
    throw new Error(`Current cron query failed: ${newError.message}`);
  }

  const newRowsRaw = (newQueryContests ?? []) as ContestRow[];
  const newIncludesTarget = newRowsRaw.some((c) => c.id === targetContestId);

  console.log("--- Current cron Supabase query ---");
  console.log(
    `  filter: platform=youtube, moderation_status=published, start_date<=now, dates set, ${SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER}`,
  );
  console.log(`  total contests returned: ${newRowsRaw.length}`);
  console.log(`  by post_contest_status:`, summarizeByStatus(newRowsRaw));
  console.log(`  includes target contest: ${newIncludesTarget}`);
  console.log();

  // 4) JS safety filter (recommended hardening)
  const newRowsFiltered = newRowsRaw.filter(
    isContestEligibleForScheduledMetricsCron,
  );
  const filteredIncludesTarget = newRowsFiltered.some(
    (c) => c.id === targetContestId,
  );
  const leakedAfterOr = newRowsRaw.filter(
    (c) => !isContestEligibleForScheduledMetricsCron(c),
  );

  console.log("--- After JS isContestEligibleForScheduledMetricsCron ---");
  console.log(`  eligible contests: ${newRowsFiltered.length}`);
  console.log(`  includes target contest: ${filteredIncludesTarget}`);
  console.log(`  leaked through .or() but blocked by JS: ${leakedAfterOr.length}`);
  if (leakedAfterOr.length) {
    console.log(
      "  leaked contests:",
      leakedAfterOr.slice(0, 10).map((c) => ({
        id: c.id,
        post_contest_status: c.post_contest_status,
      })),
    );
  }
  console.log();

  // 5) Submission impact estimate
  const oldIds = oldRows.map((c) => c.id);
  const newIds = newRowsFiltered.map((c) => c.id);
  const [oldSubCount, newSubCount] = await Promise.all([
    countSubmissions(supabase, oldIds),
    countSubmissions(supabase, newIds),
  ]);

  let targetSubCount = 0;
  if (targetContest) {
    targetSubCount = await countSubmissions(supabase, [targetContestId]);
  }

  console.log("--- Submissions that cron would touch (estimate) ---");
  console.log(`  with old query: ${oldSubCount}`);
  console.log(`  with current query + JS filter: ${newSubCount}`);
  console.log(`  for target contest only: ${targetSubCount}`);
  console.log();

  // 6) Verdict
  console.log("=== Verdict ===");
  if (!targetContest) {
    console.log(
      "Target contest not in DB — point script at prod/staging .env.local or pass contest id.",
    );
  } else if (oldIncludesTarget && !filteredIncludesTarget) {
    console.log(
      "BUG REPRODUCED (historical): Old query includes in_review target; fixed query excludes it.",
    );
    console.log(
      "If production ran old code at cron time, that explains stripped other_stats.",
    );
  } else if (newIncludesTarget || filteredIncludesTarget) {
    console.log(
      "ACTIVE BUG: Target in_review contest still eligible — check Supabase .or() filter or deployment.",
    );
  } else if (leakedAfterOr.length) {
    console.log(
      "PARTIAL BUG: Supabase .or() returns locked contests; JS filter would block them.",
    );
    console.log("Add JS filter in cron route before building activeIds.");
  } else {
    console.log(
      "Current code + DB: in_review target is correctly excluded. If bug happened recently, check Vercel deploy commit at cron time.",
    );
  }

  console.log(
    "\nOptional: dry-run live route (no writes):\n" +
      '  curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/update-youtube-metrics?dryRun=1"',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
