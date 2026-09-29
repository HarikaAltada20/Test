/**
 * Run warm-up daily metrics locally (health excludes today's sends).
 * Same as admin calculate-metrics — NOT the 23:59 nightly close-out.
 *
 * Usage: npx tsx scripts/run-warm-up-metrics.ts
 * Nightly cron (includes today): action=metrics on /api/cron/process-warm-up-sends
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const projectId = process.argv[2]?.trim() || undefined;
  const { calculateDailyMetrics } = await import(
    "../lib/admin-email/warm-up-service"
  );

  console.log(
    projectId
      ? `Calculating warm-up metrics (pre-today health) for project ${projectId}...`
      : "Calculating warm-up metrics (pre-today health) for all projects...",
  );

  const result = await calculateDailyMetrics(projectId, { closeOutDay: false });
  console.log("Done:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
