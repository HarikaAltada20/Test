/**
 * Audit YouTube submissions for stripped other_stats (basic-only after cron bug).
 * Read-only — does not call YouTube API or update rows.
 *
 * Usage:
 *   npx tsx scripts/audit-youtube-stripped-stats.ts
 *   npx tsx scripts/audit-youtube-stripped-stats.ts <contest-id>
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getExistingYouTubeStats } from "../lib/youtube-other-stats";

config({ path: ".env.local" });
config();

const DEFAULT_CONTEST_ID = "58e8c4be-303c-46a9-8fa8-22288d9e6016";

const RICH_KEYS = [
  "traffic_sources",
  "demographics",
  "watch_time",
  "average_view_duration",
  "average_view_percentage",
  "core",
] as const;

type SubmissionRow = {
  id: string;
  views: number | null;
  updated_at: string | null;
  other_stats: unknown;
};

function classifyYoutubeStats(stats: Record<string, unknown>) {
  const keys = Object.keys(stats);
  const richPresent = RICH_KEYS.filter((k) => stats[k] != null);
  const basicOnly =
    keys.length > 0 &&
    richPresent.length === 0 &&
    keys.every((k) =>
      ["views", "likes", "comments", "analytics_needs_reauth", "last_basic_update"].includes(
        k,
      ),
    );
  const empty = keys.length === 0;
  return { richPresent, basicOnly, empty, keyCount: keys.length };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars in .env.local / .env");
    process.exit(1);
  }

  const contestId = process.argv[2]?.trim() || DEFAULT_CONTEST_ID;
  const supabase = createClient(url, key);

  const { data: contest, error: contestError } = await supabase
    .from("contests")
    .select("id, title, post_contest_status, last_metrics_updated")
    .eq("id", contestId)
    .maybeSingle();

  if (contestError) throw new Error(contestError.message);
  if (!contest) {
    console.error(`Contest ${contestId} not found`);
    process.exit(1);
  }

  console.log("=== YouTube other_stats audit (read-only) ===\n");
  console.log(`Contest: ${contest.title}`);
  console.log(`ID: ${contest.id}`);
  console.log(`post_contest_status: ${contest.post_contest_status ?? "(null)"}`);
  console.log(`last_metrics_updated: ${contest.last_metrics_updated ?? "(null)"}\n`);

  const { data: submissions, error: subError } = await supabase
    .from("submissions")
    .select("id, views, updated_at, other_stats")
    .eq("contest_id", contestId)
    .neq("status", "rejected")
    .not("content_link", "is", null);

  if (subError) throw new Error(subError.message);

  const rows = (submissions ?? []) as SubmissionRow[];
  let basicOnly = 0;
  let rich = 0;
  let empty = 0;
  const basicOnlySamples: Array<{ id: string; updated_at: string | null }> = [];
  const cronSuspect: Array<{ id: string; updated_at: string | null }> = [];

  for (const row of rows) {
    const yt = getExistingYouTubeStats(row.other_stats);
    const c = classifyYoutubeStats(yt);
    if (c.empty) empty++;
    else if (c.basicOnly) {
      basicOnly++;
      if (basicOnlySamples.length < 5) {
        basicOnlySamples.push({ id: row.id, updated_at: row.updated_at });
      }
      // Cron ran ~2026-06-26 01:32 UTC — flag rows updated that morning
      if (row.updated_at?.startsWith("2026-06-26T01:3")) {
        cronSuspect.push({ id: row.id, updated_at: row.updated_at });
      }
    } else if (c.richPresent.length > 0) rich++;
  }

  console.log(`Total YouTube submissions: ${rows.length}`);
  console.log(`  With rich analytics: ${rich}`);
  console.log(`  Basic-only (likely stripped): ${basicOnly}`);
  console.log(`  Empty youtube stats: ${empty}`);
  console.log(`  Updated ~2026-06-26 01:3x UTC (cron window): ${cronSuspect.length}`);

  if (basicOnlySamples.length) {
    console.log("\nSample basic-only submission IDs:");
    for (const s of basicOnlySamples) {
      console.log(`  ${s.id}  updated_at=${s.updated_at}`);
    }
  }

  console.log("\n--- Restore options ---");
  if (contest.post_contest_status === "in_review") {
    console.log(
      "UI refresh is disabled in in_review. Use admin API (works while locked):",
    );
    console.log(
      `  POST /api/youtube/refresh-detailed-analytics`,
    );
    console.log(
      `  Body: { "type": "all", "contestId": "${contestId}" }`,
    );
    console.log("  (Requires admin session cookie or run from admin dashboard dev tools.)");
  } else {
    console.log(
      "Use admin contest page → Refresh all metrics, or the same API as above.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
