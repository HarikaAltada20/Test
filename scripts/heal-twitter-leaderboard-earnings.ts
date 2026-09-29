/**
 * Recompute twitter_campaign_leaderboard.earnings from paid tweet rows.
 *
 * Usage:
 *   npx tsx scripts/heal-twitter-leaderboard-earnings.ts
 *   npx tsx scripts/heal-twitter-leaderboard-earnings.ts --contest=uuid
 *   npx tsx scripts/heal-twitter-leaderboard-earnings.ts --contest=uuid --creator=uuid
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const args = process.argv.slice(2);
  const contestArg = args.find((a) => a.startsWith("--contest="));
  const creatorArg = args.find((a) => a.startsWith("--creator="));
  const contestId = contestArg?.slice("--contest=".length)?.trim() || null;
  const creatorId = creatorArg?.slice("--creator=".length)?.trim() || null;

  const { createAdminClient } = await import("../utils/supabase/admin");
  const { reconcileTwitterLeaderboardCpmEarnings } = await import(
    "../lib/twitter/reconcile-leaderboard-cpm-earnings"
  );

  const supabase = createAdminClient();

  let contestIds: string[] = [];
  if (contestId) {
    contestIds = [contestId];
  } else {
    const { data, error } = await supabase
      .from("contests")
      .select("id")
      .eq("contest_type", "cpm")
      .or("platform.eq.twitter,platform.eq.x");
    if (error) throw new Error(error.message);
    contestIds = (data || []).map((r) => r.id as string);
  }

  console.log(`Reconciling leaderboard earnings for ${contestIds.length} contest(s)...`);

  let ok = 0;
  let failed = 0;

  for (const cid of contestIds) {
    let creatorQuery = supabase
      .from("twitter_campaign_leaderboard")
      .select("creator_id, earnings")
      .eq("contest_id", cid);
    if (creatorId) creatorQuery = creatorQuery.eq("creator_id", creatorId);

    const { data: rows, error } = await creatorQuery;
    if (error) {
      console.error(`FAIL list creators ${cid}:`, error.message);
      failed += 1;
      continue;
    }

    for (const row of rows || []) {
      const before = Number(row.earnings) || 0;
      const result = await reconcileTwitterLeaderboardCpmEarnings(
        cid,
        row.creator_id,
        supabase as any,
      );
      if (!result.ok) {
        failed += 1;
        console.error(
          `FAIL ${cid} creator=${row.creator_id}: ${result.error}`,
        );
        continue;
      }
      ok += 1;
      if (before !== result.earningsCents) {
        console.log(
          `FIXED ${cid} creator=${row.creator_id}: ${before} → ${result.earningsCents} cents`,
        );
      } else {
        console.log(
          `OK ${cid} creator=${row.creator_id}: ${result.earningsCents} cents`,
        );
      }
    }
  }

  console.log(`Done. ok=${ok} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
