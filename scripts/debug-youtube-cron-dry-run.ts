/** Local-only: hit YouTube cron dryRun (no DB writes). */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET missing from .env.local");
    process.exit(1);
  }

  const base = "http://localhost:3000/api/cron/update-youtube-metrics";
  const paths = [
    "?dryRun=1",
    "?dryRun=1&contestId=58e8c4be-303c-46a9-8fa8-22288d9e6016",
  ];

  for (const path of paths) {
    const r = await fetch(base + path, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await r.json();
    console.log(path, r.status, JSON.stringify(body, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
