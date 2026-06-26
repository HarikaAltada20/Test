/**
 * End-to-end simulation of the nightly YouTube metrics cron.
 *
 * Use this AFTER you restore full analytics on the target contest (admin refresh).
 * Compares submission state before vs after a real local cron run.
 *
 * Workflow:
 *   1. Restore metrics on the contest (admin UI or refresh-detailed-analytics API)
 *   2. Terminal A: npm run dev
 *   3. Terminal B:
 *        npm run simulate:youtube-cron -- --dry-run          # safe: no DB writes
 *        npm run simulate:youtube-cron -- --confirm           # full nightly cron simulation
 *
 * Options:
 *   --contest-id=<uuid>   Contest to watch (default: Finance with Sharan)
 *   --http                Call cron via HTTP (needs `npm run dev`)
 *   --invoke-local        Call route handler directly (default, no dev server)
 *   --base-url=<url>      Dev server for --http (default: http://localhost:3000)
 *   --dry-run             Call cron with ?dryRun=1 only (no writes)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getExistingYouTubeStats } from "../lib/youtube-other-stats";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

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

type SubmissionSnapshot = {
  id: string;
  views: number | null;
  updated_at: string | null;
  richKeys: string[];
  youtubeStats: Record<string, unknown>;
};

type ContestSnapshot = {
  capturedAt: string;
  contestId: string;
  contestTitle: string | null;
  postContestStatus: string | null;
  submissions: SubmissionSnapshot[];
  summary: {
    total: number;
    withRichAnalytics: number;
    basicOnly: number;
  };
};

function parseArgs() {
  const args = process.argv.slice(2);
  let contestId = DEFAULT_CONTEST_ID;
  let baseUrl = "http://localhost:3000";
  let dryRunOnly = false;
  let confirm = false;
  let baselineOnly = false;
  let useHttp = false;

  for (const arg of args) {
    if (arg === "--dry-run") dryRunOnly = true;
    else if (arg === "--confirm") confirm = true;
    else if (arg === "--baseline") baselineOnly = true;
    else if (arg === "--http") useHttp = true;
    else if (arg === "--invoke-local") useHttp = false;
    else if (arg.startsWith("--contest-id="))
      contestId = arg.slice("--contest-id=".length);
    else if (arg.startsWith("--base-url="))
      baseUrl = arg.slice("--base-url=".length).replace(/\/$/, "");
  }

  return { contestId, baseUrl, dryRunOnly, confirm, baselineOnly, useHttp };
}

function richKeysPresent(stats: Record<string, unknown>): string[] {
  return RICH_KEYS.filter((k) => stats[k] != null);
}

function isBasicOnly(stats: Record<string, unknown>): boolean {
  const keys = Object.keys(stats);
  const rich = richKeysPresent(stats);
  return (
    keys.length > 0 &&
    rich.length === 0 &&
    keys.every((k) =>
      ["views", "likes", "comments", "analytics_needs_reauth", "last_basic_update"].includes(
        k,
      ),
    )
  );
}

async function captureContestSnapshot(
  supabase: ReturnType<typeof createClient>,
  contestId: string,
): Promise<ContestSnapshot> {
  const { data: contest, error: contestError } = await supabase
    .from("contests")
    .select("id, title, post_contest_status")
    .eq("id", contestId)
    .maybeSingle();

  if (contestError) throw new Error(contestError.message);
  if (!contest) throw new Error(`Contest ${contestId} not found`);

  const { data: rows, error: subError } = await supabase
    .from("submissions")
    .select("id, views, updated_at, other_stats")
    .eq("contest_id", contestId)
    .neq("status", "rejected")
    .not("content_link", "is", null);

  if (subError) throw new Error(subError.message);

  const submissions: SubmissionSnapshot[] = (rows ?? []).map((row) => {
    const r = row as SubmissionRow;
    const yt = getExistingYouTubeStats(r.other_stats);
    return {
      id: r.id,
      views: r.views,
      updated_at: r.updated_at,
      richKeys: richKeysPresent(yt),
      youtubeStats: yt,
    };
  });

  const withRichAnalytics = submissions.filter((s) => s.richKeys.length > 0).length;
  const basicOnly = submissions.filter((s) => isBasicOnly(s.youtubeStats)).length;

  return {
    capturedAt: new Date().toISOString(),
    contestId,
    contestTitle: contest.title ?? null,
    postContestStatus: contest.post_contest_status ?? null,
    submissions,
    summary: {
      total: submissions.length,
      withRichAnalytics,
      basicOnly,
    },
  };
}

function saveSnapshot(label: string, snapshot: ContestSnapshot) {
  const dir = join(process.cwd(), "scripts", ".simulation-snapshots");
  mkdirSync(dir, { recursive: true });
  const file = join(
    dir,
    `${label}-${snapshot.contestId.slice(0, 8)}-${Date.now()}.json`,
  );
  writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
  return file;
}

async function invokeCronLocal(
  secret: string,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  const path = `/api/cron/update-youtube-metrics${dryRun ? "?dryRun=1" : ""}`;
  console.log(`\nInvoking route handler directly: GET ${path}`);

  const { GET } = await import("../app/api/cron/update-youtube-metrics/route");
  const request = new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const response = await GET(request);
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  console.log(`Cron response (${response.status}):`, JSON.stringify(body, null, 2));
  if (!response.ok) {
    throw new Error(`Cron failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function callCron(
  baseUrl: string,
  secret: string,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}/api/cron/update-youtube-metrics${dryRun ? "?dryRun=1" : ""}`;
  console.log(`\nCalling cron: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    console.log(`Cron response (${res.status}):`, JSON.stringify(body, null, 2));
    if (!res.ok) {
      throw new Error(`Cron failed (${res.status}): ${JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

type CompareResult = {
  updatedCount: number;
  viewsChangedCount: number;
  richKeysLostCount: number;
  richKeysGainedCount: number;
  unchangedCount: number;
  changedSamples: Array<{
    id: string;
    beforeUpdatedAt: string | null;
    afterUpdatedAt: string | null;
    richKeysBefore: string[];
    richKeysAfter: string[];
    viewsBefore: number | null;
    viewsAfter: number | null;
  }>;
};

function compareSnapshots(
  before: ContestSnapshot,
  after: ContestSnapshot,
): CompareResult {
  const beforeMap = new Map(before.submissions.map((s) => [s.id, s]));
  const result: CompareResult = {
    updatedCount: 0,
    viewsChangedCount: 0,
    richKeysLostCount: 0,
    richKeysGainedCount: 0,
    unchangedCount: 0,
    changedSamples: [],
  };

  for (const afterSub of after.submissions) {
    const beforeSub = beforeMap.get(afterSub.id);
    if (!beforeSub) continue;

    const updatedAtChanged = beforeSub.updated_at !== afterSub.updated_at;
    const viewsChanged = beforeSub.views !== afterSub.views;
    const richBefore = new Set(beforeSub.richKeys);
    const richAfter = new Set(afterSub.richKeys);
    const lostRich = beforeSub.richKeys.filter((k) => !richAfter.has(k));
    const gainedRich = afterSub.richKeys.filter((k) => !richBefore.has(k));

    if (updatedAtChanged) result.updatedCount++;
    else result.unchangedCount++;

    if (viewsChanged) result.viewsChangedCount++;
    if (lostRich.length) result.richKeysLostCount++;
    if (gainedRich.length) result.richKeysGainedCount++;

    if (updatedAtChanged || viewsChanged || lostRich.length || gainedRich.length) {
      if (result.changedSamples.length < 8) {
        result.changedSamples.push({
          id: afterSub.id,
          beforeUpdatedAt: beforeSub.updated_at,
          afterUpdatedAt: afterSub.updated_at,
          richKeysBefore: beforeSub.richKeys,
          richKeysAfter: afterSub.richKeys,
          viewsBefore: beforeSub.views,
          viewsAfter: afterSub.views,
        });
      }
    }
  }

  return result;
}

function printSnapshotSummary(label: string, snap: ContestSnapshot) {
  console.log(`\n--- ${label} (${snap.capturedAt}) ---`);
  console.log(`Contest: ${snap.contestTitle}`);
  console.log(`post_contest_status: ${snap.postContestStatus ?? "(null)"}`);
  console.log(`Submissions: ${snap.summary.total}`);
  console.log(`  with rich analytics: ${snap.summary.withRichAnalytics}`);
  console.log(`  basic-only: ${snap.summary.basicOnly}`);
}

function printVerdict(
  snap: ContestSnapshot,
  compare: CompareResult | null,
  cronBody: Record<string, unknown> | null,
  mode: "dry-run" | "full" | "baseline",
) {
  console.log("\n========================================");
  console.log("VERDICT");
  console.log("========================================");

  const isLocked =
    snap.postContestStatus === "in_review" ||
    snap.postContestStatus === "verification_complete" ||
    snap.postContestStatus === "payouts_processed";

  if (mode === "baseline") {
    console.log("Baseline captured only. Restore analytics if needed, then re-run with --dry-run or --confirm.");
    if (snap.summary.withRichAnalytics === 0) {
      console.log(
        "\n⚠️  No submissions have rich analytics yet. Restore first via:",
      );
      console.log(
        '  POST /api/youtube/refresh-detailed-analytics  { "type": "all", "contestId": "..." }',
      );
    }
    return;
  }

  if (mode === "dry-run") {
    const activeIds = (cronBody?.activeContestIds as string[] | undefined) ?? [];
    const included = activeIds.includes(snap.contestId);
    if (isLocked && !included) {
      console.log("✅ PASS (dry-run): in_review contest is NOT in cron activeContestIds.");
    } else if (isLocked && included) {
      console.log("❌ FAIL (dry-run): in_review contest WOULD be refreshed by cron.");
    } else if (!isLocked && included) {
      console.log("ℹ️  Contest is eligible; it appears in activeContestIds (expected if not locked).");
    }
    console.log("\nDry-run does not write DB. Run with --confirm after rich analytics are restored.");
    return;
  }

  if (!compare) return;

  if (isLocked) {
    if (compare.updatedCount === 0) {
      console.log(
        "✅ PASS (lock): Nightly cron did NOT update any submissions on this in_review contest.",
      );
    } else {
      console.log(
        `❌ FAIL (lock): Cron updated ${compare.updatedCount} submission(s) on in_review contest.`,
      );
    }
  }

  if (compare.richKeysLostCount > 0) {
    console.log(
      `❌ FAIL (preserve): ${compare.richKeysLostCount} submission(s) lost rich analytics keys.`,
    );
  } else if (compare.updatedCount > 0 && snap.summary.withRichAnalytics > 0) {
    console.log(
      "✅ PASS (preserve): Submissions were updated but rich analytics keys were not stripped.",
    );
  } else if (compare.updatedCount === 0 && snap.summary.withRichAnalytics > 0) {
    console.log(
      "✅ PASS (preserve): Rich analytics unchanged (no cron touch on this contest).",
    );
  }

  if (compare.changedSamples.length) {
    console.log("\nChanged submission samples:");
    for (const s of compare.changedSamples) {
      console.log(
        `  ${s.id}\n    updated_at: ${s.beforeUpdatedAt} → ${s.afterUpdatedAt}\n    rich keys: [${s.richKeysBefore.join(", ")}] → [${s.richKeysAfter.join(", ")}]\n    views: ${s.viewsBefore} → ${s.viewsAfter}`,
      );
    }
  }
}

async function main() {
  const { contestId, baseUrl, dryRunOnly, confirm, baselineOnly, useHttp } =
    parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  console.log("=== YouTube nightly cron simulation ===");
  console.log(`Watch contest: ${contestId}`);
  console.log(`Cron mode: ${useHttp ? `HTTP → ${baseUrl}` : "direct route invoke (same code as Vercel)"}`);

  const supabase = createClient(url, key);

  const before = await captureContestSnapshot(supabase, contestId);
  printSnapshotSummary("BEFORE", before);
  const beforeFile = saveSnapshot("before", before);
  console.log(`Saved: ${beforeFile}`);

  if (baselineOnly) {
    printVerdict(before, null, null, "baseline");
    return;
  }

  if (!cronSecret) {
    console.error("CRON_SECRET missing — add to .env or .env.local");
    process.exit(1);
  }

  if (!dryRunOnly && !confirm) {
    console.error(
      "\nRefusing to run REAL cron without --confirm (it updates eligible contests in your DB).",
    );
    console.error("  Safe check:  npm run simulate:youtube-cron -- --dry-run");
    console.error("  Full test:   npm run simulate:youtube-cron -- --confirm");
    process.exit(1);
  }

  let cronBody: Record<string, unknown>;
  try {
    cronBody = useHttp
      ? await callCron(baseUrl, cronSecret, dryRunOnly)
      : await invokeCronLocal(cronSecret, dryRunOnly);
  } catch (e) {
    if (useHttp) {
      console.error(
        "\nCould not reach cron. Is `npm run dev` running on",
        baseUrl,
        "?",
      );
    }
    throw e;
  }

  if (dryRunOnly) {
    printVerdict(before, null, cronBody, "dry-run");
    return;
  }

  console.log("\nWaiting 3s for DB writes to settle...");
  await new Promise((r) => setTimeout(r, 3000));

  const after = await captureContestSnapshot(supabase, contestId);
  printSnapshotSummary("AFTER", after);
  const afterFile = saveSnapshot("after", after);
  console.log(`Saved: ${afterFile}`);

  const compare = compareSnapshots(before, after);
  console.log("\n--- Diff on watched contest ---");
  console.log(`  submissions unchanged (updated_at): ${compare.unchangedCount}`);
  console.log(`  submissions updated (updated_at):   ${compare.updatedCount}`);
  console.log(`  views changed:                    ${compare.viewsChangedCount}`);
  console.log(`  rich keys lost:                   ${compare.richKeysLostCount}`);
  console.log(`  rich keys gained:                 ${compare.richKeysGainedCount}`);

  printVerdict(before, compare, cronBody, "full");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
