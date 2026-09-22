/** Runs the actual migration against an isolated, in-memory PostgreSQL database.
 * PGLITE_MODULE_PATH must point to @electric-sql/pglite/dist/index.js.
 * Run with: npx tsx scripts/test-youtube-metrics-database.ts
 * Never connects to the application's database or calls YouTube.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function main() {
  const modulePath = process.env.PGLITE_MODULE_PATH;
  if (!modulePath) throw new Error("Set PGLITE_MODULE_PATH to the temporary PGlite runtime.");
  const { PGlite } = await import(pathToFileURL(modulePath).href);
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.contests (id uuid PRIMARY KEY, post_contest_status text, views_locked_at timestamptz);
      CREATE TABLE public.submissions (id uuid PRIMARY KEY, contest_id uuid, views bigint, other_stats jsonb, insights_status text, last_insights_update timestamptz, updated_at timestamptz);
      CREATE TABLE public.post_campaign_submission_metrics (submission_id uuid PRIMARY KEY, views bigint, other_stats jsonb, insights_status text, last_insights_update timestamptz, updated_at timestamptz);
    `);
    await db.exec(readFileSync("db/migrations/20260923_atomic_youtube_metrics_patch.sql", "utf8"));
    const id = "00000000-0000-0000-0000-000000000001";
    const campaign = "00000000-0000-0000-0000-000000000002";
    const rowPatch = { insights_status: "ok", last_insights_update: "2026-09-23T07:50:00Z", updated_at: "2026-09-23T07:50:00Z" };
    await db.query("INSERT INTO public.contests VALUES ($1, NULL, NULL)", [campaign]);
    await db.query("INSERT INTO public.submissions (id, contest_id, views, other_stats) VALUES ($1,$2,10,$3)", [id, campaign, JSON.stringify({ youtube: { views: 10 }, instagram: { likes: 5 } })]);
    const patch = async (youtube: unknown, row: unknown = rowPatch, pc = false) => {
      const result = await db.query("SELECT public.patch_youtube_submission_metrics($1,$2,$3,$4) AS updated", [id, JSON.stringify(youtube), JSON.stringify(row), pc]);
      return result.rows[0].updated;
    };
    const saved = async () => (await db.query("SELECT * FROM public.submissions WHERE id=$1", [id])).rows[0];

    // Requests may have read the same basic-only snapshot. Each commits only its own scope.
    const detail = { traffic_sources: { SHORTS: 90 }, demographics: { gender: { female: 60 } }, estimated_minutes_watched: 500, bot_score: 75 };
    assert.equal(await patch(detail), true);
    assert.equal(await patch({ views: 20, likes: 0, comments: 0 }, { ...rowPatch, views: 20 }), true);
    let row = await saved();
    for (const [key, value] of Object.entries(detail)) assert.deepEqual(row.other_stats.youtube[key], value);
    assert.equal(Number(row.views), 20);
    assert.equal(row.other_stats.youtube.likes, 0);
    assert.deepEqual(row.other_stats.instagram, { likes: 5 });
    console.log("PASS: detailed analytics survive a later basic refresh; zero values and sibling platforms survive.");

    await patch({ demographics: { country: { US: 80 } } });
    await patch({ demographics: { gender: null, country: {} }, traffic_sources: null, estimated_minutes_watched: null, audience_retention: [] });
    row = await saved();
    assert.deepEqual(row.other_stats.youtube.demographics, { gender: { female: 60 }, country: { US: 80 } });
    assert.deepEqual(row.other_stats.youtube.traffic_sources, { SHORTS: 90 });
    assert.equal(row.other_stats.youtube.estimated_minutes_watched, 500);
    await patch({ analytics_needs_reauth: true, insights_error: "Token expired" }, { ...rowPatch, insights_status: "temporary_failure" });
    assert.deepEqual((await saved()).other_stats.youtube.demographics, row.other_stats.youtube.demographics);
    console.log("PASS: partial scopes, empty API responses, and auth failures preserve existing analytics.");

    for (const status of [null, "pending_review", "in_review", "verification_complete", "payouts_processed"]) {
      await db.query("UPDATE public.contests SET post_contest_status=$1 WHERE id=$2", [status, campaign]);
      const before = await saved();
      const allowed = status == null || status === "pending_review";
      assert.equal(await patch({ views: 30 }, { ...rowPatch, views: 30 }), allowed);
      if (!allowed) assert.deepEqual(await saved(), before);
    }
    await db.query("UPDATE public.contests SET post_contest_status='pending_review', views_locked_at=now() WHERE id=$1", [campaign]);
    assert.equal(await patch({ likes: 9 }), false);
    await db.query("INSERT INTO public.post_campaign_submission_metrics (submission_id, views, other_stats) VALUES ($1,5,$2)", [id, JSON.stringify({ youtube: detail })]);
    const frozen = await saved();
    assert.equal(await patch({ views: 99 }, { ...rowPatch, views: 99 }, true), true);
    assert.deepEqual(await saved(), frozen);
    const overlay = (await db.query("SELECT * FROM public.post_campaign_submission_metrics")).rows[0];
    assert.equal(Number(overlay.views), 99);
    assert.deepEqual(overlay.other_stats.youtube.demographics, detail.demographics);
    console.log("PASS: live/pending-review refresh remains enabled; review locks block writes; overlay updates leave frozen submissions untouched.");

    await db.query("UPDATE public.contests SET post_contest_status=NULL, views_locked_at=NULL WHERE id=$1", [campaign]);
    const legacy = { estimated_minutes_watched: 120, youtube: { views: 5 }, tiktok: { likes: 4 } };
    await db.query("UPDATE public.submissions SET other_stats=$1 WHERE id=$2", [JSON.stringify(JSON.stringify(legacy)), id]);
    await patch({ views: 22 });
    row = await saved();
    assert.equal(row.other_stats.youtube.estimated_minutes_watched, 120);
    assert.deepEqual(row.other_stats.tiktok, { likes: 4 });
    await db.query("UPDATE public.submissions SET other_stats=$1 WHERE id=$2", [JSON.stringify("malformed JSON"), id]);
    await assert.rejects(patch({ views: 23 }));
    assert.equal((await saved()).other_stats, "malformed JSON");
    console.log("PASS: legacy JSON is preserved; malformed JSON fails safely without replacing data.");

    const permissions = (await db.query(`SELECT
      has_function_privilege('anon', 'public.patch_youtube_submission_metrics(uuid,jsonb,jsonb,boolean)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'public.patch_youtube_submission_metrics(uuid,jsonb,jsonb,boolean)', 'EXECUTE') AS authenticated,
      has_function_privilege('service_role', 'public.patch_youtube_submission_metrics(uuid,jsonb,jsonb,boolean)', 'EXECUTE') AS service`)).rows[0];
    assert.deepEqual(permissions, { anon: false, authenticated: false, service: true });
    console.log("PASS: only service_role is allowed to call the metrics writer.");
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
