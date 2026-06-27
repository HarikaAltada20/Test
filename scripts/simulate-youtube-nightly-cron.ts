/**
 * End-to-end simulation of the nightly YouTube metrics cron.
 *
 * Invokes the same route Vercel runs at 1 AM: GET /api/cron/update-youtube-metrics
 *
 * Workflow:
 *   1. Restore detailed analytics on the target contest (admin UI or refresh-detailed-analytics)
 *   2. npm run simulate:youtube-cron -- --baseline --contest-id=<uuid>
 *   3. npm run simulate:youtube-cron -- --confirm --contest-id=<uuid> --contest-only
 *   4. After code fix, repeat step 3 and expect detailed keys lost: 0
 *
 * Options:
 *   --contest-id=<uuid>   Contest to watch in before/after diff
 *   --contest-only        Pass ?contestId= to cron (only update that contest; recommended)
 *   --http                Call cron via HTTP (needs `npm run dev`)
 *   --invoke-local        Call route handler directly (default)
 *   --dry-run             Call cron with ?dryRun=1 only (no writes)
 *   --baseline            Snapshot only, no cron
 */

import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getExistingYouTubeStats } from "../lib/youtube-other-stats";
import {
  detailedAnalyticsKeysPresent,
  isYoutubeStatsBasicOnly,
  YOUTUBE_DETAILED_ANALYTICS_KEYS,
} from "../lib/youtube-detailed-stats-keys";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

config({ path: ".env.local" });
config();

const DEFAULT_CONTEST_ID = "58e8c4be-303c-46a9-8fa8-22288d9e6016";

type ContestRow = {
  id: string;
  title: string | null;
  post_contest_status: string | null;
};

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
  detailedKeys: string[];
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
    withDetailedAnalytics: number;
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
  let contestOnly = false;

  for (const arg of args) {
    if (arg === "--dry-run") dryRunOnly = true;
    else if (arg === "--confirm") confirm = true;
    else if (arg === "--baseline") baselineOnly = true;
    else if (arg === "--http") useHttp = true;
    else if (arg === "--invoke-local") useHttp = false;
    else if (arg === "--contest-only") contestOnly = true;
    else if (arg.startsWith("--contest-id="))
      contestId = arg.slice("--contest-id=".length);
    else if (arg.startsWith("--base-url="))
      baseUrl = arg.slice("--base-url=".length).replace(/\/$/, "");
  }

  return {
    contestId,
    baseUrl,
    dryRunOnly,
    confirm,
    baselineOnly,
    useHttp,
    contestOnly,
  };
}

async function captureContestSnapshot(
  supabase: SupabaseClient,
  contestId: string,
): Promise<ContestSnapshot> {
  const { data: contestData, error: contestError } = await supabase
    .from("contests")
    .select("id, title, post_contest_status")
    .eq("id", contestId)
    .maybeSingle();

  if (contestError) throw new Error(contestError.message);
  const contest = contestData as ContestRow | null;
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
      detailedKeys: detailedAnalyticsKeysPresent(yt),
      youtubeStats: yt,
    };
  });

  const withDetailedAnalytics = submissions.filter(
    (s) => s.detailedKeys.length > 0,
  ).length;
  const basicOnly = submissions.filter((s) =>
    isYoutubeStatsBasicOnly(s.youtubeStats),
  ).length;

  return {
    capturedAt: new Date().toISOString(),
    contestId,
    contestTitle: contest.title ?? null,
    postContestStatus: contest.post_contest_status ?? null,
    submissions,
    summary: {
      total: submissions.length,
      withDetailedAnalytics,
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

function buildCronPath(
  dryRun: boolean,
  contestOnly: boolean,
  watchContestId: string,
): string {
  const params = new URLSearchParams();
  if (dryRun) params.set("dryRun", "1");
  if (contestOnly) params.set("contestId", watchContestId);
  const qs = params.toString();
  return `/api/cron/update-youtube-metrics${qs ? `?${qs}` : ""}`;
}

async function invokeCronLocal(
  secret: string,
  path: string,
): Promise<Record<string, unknown>> {
  console.log(`\nInvoking route handler directly: GET ${path}`);

  const { GET } = await import("../app/api/cron/update-youtube-metrics/route");
  const request = new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const response = await GET(request);
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  console.log(`Cron response (${response.status}):`, JSON.stringify(body, null, 2));
  if (!response.ok) {
    throw new Error(`Cron failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function callCron(
  baseUrl: string,
  secret: string,
  path: string,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}${path}`;
  console.log(`\nCalling cron: ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);
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
  detailedKeysLostCount: number;
  detailedKeysGainedCount: number;
  becameBasicOnlyCount: number;
  unchangedCount: number;
  changedSamples: Array<{
    id: string;
    beforeUpdatedAt: string | null;
    afterUpdatedAt: string | null;
    detailedKeysBefore: string[];
    detailedKeysAfter: string[];
    lostKeys: string[];
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
    detailedKeysLostCount: 0,
    detailedKeysGainedCount: 0,
    becameBasicOnlyCount: 0,
    unchangedCount: 0,
    changedSamples: [],
  };

  for (const afterSub of after.submissions) {
    const beforeSub = beforeMap.get(afterSub.id);
    if (!beforeSub) continue;

    const updatedAtChanged = beforeSub.updated_at !== afterSub.updated_at;
    const viewsChanged = beforeSub.views !== afterSub.views;
    const detailedBefore = new Set(beforeSub.detailedKeys);
    const detailedAfter = new Set(afterSub.detailedKeys);
    const lostKeys = beforeSub.detailedKeys.filter((k) => !detailedAfter.has(k));
    const gainedKeys = afterSub.detailedKeys.filter((k) => !detailedBefore.has(k));

    if (updatedAtChanged) result.updatedCount++;
    else result.unchangedCount++;

    if (viewsChanged) result.viewsChangedCount++;
    if (lostKeys.length) result.detailedKeysLostCount++;
    if (gainedKeys.length) result.detailedKeysGainedCount++;

    const wasBasicOnly = isYoutubeStatsBasicOnly(beforeSub.youtubeStats);
    const isBasicOnlyNow = isYoutubeStatsBasicOnly(afterSub.youtubeStats);
    if (!wasBasicOnly && isBasicOnlyNow) result.becameBasicOnlyCount++;

    if (
      updatedAtChanged ||
      viewsChanged ||
      lostKeys.length ||
      gainedKeys.length ||
      (!wasBasicOnly && isBasicOnlyNow)
    ) {
      if (result.changedSamples.length < 10) {
        result.changedSamples.push({
          id: afterSub.id,
          beforeUpdatedAt: beforeSub.updated_at,
          afterUpdatedAt: afterSub.updated_at,
          detailedKeysBefore: beforeSub.detailedKeys,
          detailedKeysAfter: afterSub.detailedKeys,
          lostKeys,
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
  console.log(
    `  with detailed analytics (${YOUTUBE_DETAILED_ANALYTICS_KEYS.length} tracked keys): ${snap.summary.withDetailedAnalytics}`,
  );
  console.log(`  basic-only (likely stripped): ${snap.summary.basicOnly}`);
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
    console.log(
      "Baseline captured only. Run with --confirm --contest-only to invoke the real cron route.",
    );
    if (snap.summary.withDetailedAnalytics === 0) {
      console.log(
        "\n⚠️  No submissions have detailed analytics yet. Restore first via:",
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
      console.log("✅ PASS (dry-run): locked contest is NOT in activeContestIds.");
    } else if (isLocked && included) {
      console.log("❌ FAIL (dry-run): locked contest WOULD be refreshed by cron.");
    } else if (!isLocked && included) {
      console.log("ℹ️  Contest is eligible and appears in activeContestIds.");
    }
    console.log(
      `\nTracked detailed keys: ${YOUTUBE_DETAILED_ANALYTICS_KEYS.join(", ")}`,
    );
    return;
  }

  if (!compare) return;

  if (compare.detailedKeysLostCount > 0 || compare.becameBasicOnlyCount > 0) {
    console.log(
      `❌ FAIL (preserve): ${compare.detailedKeysLostCount} submission(s) lost detailed keys; ${compare.becameBasicOnlyCount} became basic-only.`,
    );
  } else if (compare.updatedCount > 0 && snap.summary.withDetailedAnalytics > 0) {
    console.log(
      "✅ PASS (preserve): Cron updated submissions without stripping detailed analytics.",
    );
  } else if (
    compare.updatedCount === 0 &&
    snap.summary.withDetailedAnalytics > 0
  ) {
    console.log(
      "✅ PASS (preserve): Detailed analytics unchanged (cron did not touch this contest).",
    );
  }

  if (compare.changedSamples.length) {
    console.log("\nChanged submission samples:");
    for (const s of compare.changedSamples) {
      console.log(
        `  ${s.id}\n    updated_at: ${s.beforeUpdatedAt} → ${s.afterUpdatedAt}\n    detailed keys: [${s.detailedKeysBefore.join(", ")}] → [${s.detailedKeysAfter.join(", ")}]${s.lostKeys.length ? `\n    LOST: [${s.lostKeys.join(", ")}]` : ""}\n    views: ${s.viewsBefore} → ${s.viewsAfter}`,
      );
    }
  }
}

async function main() {
  const {
    contestId,
    baseUrl,
    dryRunOnly,
    confirm,
    baselineOnly,
    useHttp,
    contestOnly,
  } = parseArgs();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  const cronPath = buildCronPath(dryRunOnly, contestOnly, contestId);

  console.log("=== YouTube nightly cron simulation ===");
  console.log(`Watch contest: ${contestId}`);
  console.log(
    `Cron invoke: GET ${cronPath}${contestOnly ? " (contest-scoped — same as ?contestId=)" : " (FULL nightly — all eligible contests)"}`,
  );
  console.log(
    `Mode: ${useHttp ? `HTTP → ${baseUrl}` : "direct route import (identical handler code)"}`,
  );

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
      "\nRefusing to run REAL cron without --confirm (writes to DB).",
    );
    console.error(
      "  Safe:   npm run simulate:youtube-cron -- --dry-run --contest-id=<id> --contest-only",
    );
    console.error(
      "  Full:   npm run simulate:youtube-cron -- --confirm --contest-id=<id> --contest-only",
    );
    process.exit(1);
  }

  if (!dryRunOnly && !contestOnly) {
    console.warn(
      "\n⚠️  Running FULL nightly cron (all eligible YouTube contests). Prefer --contest-only for local tests.\n",
    );
  }

  let cronBody: Record<string, unknown>;
  try {
    cronBody = useHttp
      ? await callCron(baseUrl, cronSecret, cronPath)
      : await invokeCronLocal(cronSecret, cronPath);
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
  console.log(`  views changed:                      ${compare.viewsChangedCount}`);
  console.log(`  detailed keys lost (submissions):   ${compare.detailedKeysLostCount}`);
  console.log(`  became basic-only:                  ${compare.becameBasicOnlyCount}`);
  console.log(
    `  with detailed analytics:            ${before.summary.withDetailedAnalytics} → ${after.summary.withDetailedAnalytics}`,
  );

  printVerdict(before, compare, cronBody, "full");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
