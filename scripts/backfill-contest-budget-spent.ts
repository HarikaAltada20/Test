/**
 * One-time (or repeatable) heal: persist calculated budget_spent /
 * pool_budget_spent_cents onto contests.contest_based_details so list cards
 * match detail Budget Tracker.
 *
 * Usage:
 *   npx tsx scripts/backfill-contest-budget-spent.ts
 *   npx tsx scripts/backfill-contest-budget-spent.ts --dry-run
 *   npx tsx scripts/backfill-contest-budget-spent.ts --ids=uuid1,uuid2
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const idsArg = args.find((a) => a.startsWith("--ids="));
  const onlyIds = idsArg
    ? idsArg
        .slice("--ids=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const { createAdminClient } = await import("../utils/supabase/admin");
  const { persistContestBudgetSpent } = await import(
    "../lib/persist-contest-budget-spent"
  );
  const { getPoolBudgetSpentCentsForDisplay } = await import(
    "../lib/contest-budget-tile-metrics"
  );

  const supabase = createAdminClient();

  let contestIds: string[] = [];

  if (onlyIds?.length) {
    contestIds = onlyIds;
  } else {
    const pageSize = 200;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("contests")
        .select("id")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(`Failed to list contests: ${error.message}`);
      }
      const rows = data || [];
      contestIds.push(...rows.map((r) => r.id as string));
      if (rows.length < pageSize) break;
      from += pageSize;
    }
  }

  console.log(
    dryRun
      ? `Dry run: would persist budget for ${contestIds.length} contest(s)`
      : `Persisting budget_spent for ${contestIds.length} contest(s)...`,
  );

  let ok = 0;
  let failed = 0;

  for (const id of contestIds) {
    if (dryRun) {
      const { data: row } = await supabase
        .from("contests")
        .select("id, title, contest_type, post_contest_status, contest_based_details")
        .eq("id", id)
        .maybeSingle();

      const spent = getPoolBudgetSpentCentsForDisplay({
        contest_type: row?.contest_type,
        post_contest_status: row?.post_contest_status,
        contest_based_details: row?.contest_based_details as Record<
          string,
          unknown
        > | null,
      });
      console.log(
        `[dry-run] ${id} type=${row?.contest_type} stored_spent_cents=${spent} title=${row?.title ?? ""}`,
      );
      ok += 1;
      continue;
    }

    const success = await persistContestBudgetSpent(id, supabase as any);
    if (success) {
      ok += 1;
      const { data: row } = await supabase
        .from("contests")
        .select("title, contest_type, post_contest_status, contest_based_details")
        .eq("id", id)
        .maybeSingle();
      const spent = getPoolBudgetSpentCentsForDisplay({
        contest_type: row?.contest_type,
        post_contest_status: row?.post_contest_status,
        contest_based_details: row?.contest_based_details as Record<
          string,
          unknown
        > | null,
      });
      console.log(
        `OK ${id} type=${row?.contest_type} spent_cents=${spent} title=${row?.title ?? ""}`,
      );
    } else {
      failed += 1;
      console.error(`FAIL ${id}`);
    }
  }

  console.log(`Done. ok=${ok} failed=${failed} dryRun=${dryRun}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
