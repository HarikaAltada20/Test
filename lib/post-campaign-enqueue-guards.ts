import { NextResponse } from "next/server";
import {
  METRICS_REFRESH_COOLDOWN_MS_ADMIN,
  METRICS_REFRESH_COOLDOWN_MS_BRAND,
} from "@/lib/constants";

export type MetricsRefreshTarget = "submissions" | "post_campaign";

export type MetricsRunTable =
  | "instagram_insights_refresh_runs"
  | "youtube_metrics_refresh_runs"
  | "tiktok_metrics_refresh_runs";

/**
 * If a run has no heartbeat for this long, treat it as stuck.
 * Matches the UI "re-enable after ~5m" escape hatch with margin for slow batches.
 */
export const STALE_METRICS_RUN_MS = 10 * 60 * 1000;

export type MetricsRunHeartbeat = {
  started_at?: string | null;
  updated_at?: string | null;
  last_batch_completed_at?: string | null;
};

/** True when the run has not progressed recently enough to still count as active. */
export function isMetricsRunStale(
  run: MetricsRunHeartbeat,
  nowMs: number = Date.now(),
  staleAfterMs: number = STALE_METRICS_RUN_MS,
): boolean {
  const candidates = [
    run.last_batch_completed_at,
    run.updated_at,
    run.started_at,
  ]
    .map((v) => (v ? new Date(v).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  if (candidates.length === 0) return true;
  const heartbeat = Math.max(...candidates);
  return nowMs - heartbeat >= staleAfterMs;
}

/**
 * Mark stale pending/running rows as failed so a stuck queue cannot brick refresh forever.
 * Returns how many rows were abandoned.
 */
export async function abandonStaleActiveMetricsRuns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  table: MetricsRunTable,
  contestId: string,
  options?: {
    metricsTarget?: MetricsRefreshTarget;
    staleAfterMs?: number;
  },
): Promise<number> {
  const metricsTarget = options?.metricsTarget;
  const staleAfterMs = options?.staleAfterMs ?? STALE_METRICS_RUN_MS;

  let query = supabaseAdmin
    .from(table)
    .select("id, started_at, updated_at, last_batch_completed_at, status")
    .eq("contest_id", contestId)
    .in("status", ["pending", "running"]);
  if (metricsTarget) {
    query = query.eq("metrics_target", metricsTarget);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<
    MetricsRunHeartbeat & { id: string; status: string }
  >;
  const staleIds = rows
    .filter((row) => isMetricsRunStale(row, Date.now(), staleAfterMs))
    .map((row) => row.id);
  if (staleIds.length === 0) return 0;

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update({
      status: "failed",
      error_message:
        "Abandoned: no batch progress for too long (stale metrics refresh run)",
      finished_at: now,
      updated_at: now,
    })
    .in("id", staleIds)
    .in("status", ["pending", "running"]);
  if (updateError) throw new Error(updateError.message);
  return staleIds.length;
}

export function parseMetricsTarget(raw: unknown): MetricsRefreshTarget {
  return raw === "post_campaign" ? "post_campaign" : "submissions";
}

/**
 * Resolve a run row's metrics_target (null/undefined → submissions for pre-migration rows).
 * Returns true when the job target does not match the run.
 */
export function isMetricsTargetMismatch(
  runMetricsTarget: string | null | undefined,
  jobTarget: MetricsRefreshTarget,
): boolean {
  const resolved = parseMetricsTarget(runMetricsTarget);
  return resolved !== jobTarget;
}

/** Advertiser or admin required for post-campaign enqueue (not cron). */
export function assertPostCampaignEnqueueAccess(
  isPostCampaign: boolean,
  cronAuth: boolean,
  userId: string | undefined,
  advertiserId: string,
  isAdmin: boolean,
): NextResponse | null {
  if (!isPostCampaign || cronAuth) return null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin && advertiserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Compute nextRefreshAvailable from the last completed refresh timestamp. */
export function postCampaignNextRefreshAvailable(
  postCampaignLastMetricsUpdated: string | null | undefined,
  isAdmin: boolean,
): string | null {
  if (!postCampaignLastMetricsUpdated) return null;
  const lastUpdateMs = new Date(postCampaignLastMetricsUpdated).getTime();
  if (Number.isNaN(lastUpdateMs)) return null;
  const cooldownMs = isAdmin
    ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
    : METRICS_REFRESH_COOLDOWN_MS_BRAND;
  return new Date(lastUpdateMs + cooldownMs).toISOString();
}

/** Server-side post-campaign cooldown (brand vs admin). */
export function postCampaignCooldownResponse(
  postCampaignLastMetricsUpdated: string | null | undefined,
  isAdmin: boolean,
): NextResponse | null {
  if (!postCampaignLastMetricsUpdated) return null;

  const cooldownMs = isAdmin
    ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
    : METRICS_REFRESH_COOLDOWN_MS_BRAND;
  const lastUpdateMs = new Date(postCampaignLastMetricsUpdated).getTime();
  if (Number.isNaN(lastUpdateMs)) return null;

  const elapsed = Date.now() - lastUpdateMs;
  if (elapsed >= cooldownMs) return null;

  const remainingMs = cooldownMs - elapsed;
  const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
  return NextResponse.json(
    {
      error: `Post-campaign metrics were updated recently. Please wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? "s" : ""}.`,
      nextRefreshAvailable: postCampaignNextRefreshAvailable(
        postCampaignLastMetricsUpdated,
        isAdmin,
      ),
    },
    { status: 429 },
  );
}

function cooldownMsFor(isAdmin: boolean): number {
  return isAdmin
    ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
    : METRICS_REFRESH_COOLDOWN_MS_BRAND;
}

export type PostCampaignSyncSlotClaim = {
  /** Value before claim — restore via releasePostCampaignSyncSlot on sync failure. */
  previousSyncedAt: string | null;
};

export type ClaimPostCampaignSyncSlotResult =
  | { ok: true; claim: PostCampaignSyncSlotClaim }
  | { ok: false; response: NextResponse };

/**
 * Claim a post-campaign sync slot by CAS-updating post_campaign_last_synced_at.
 * Prevents concurrent/spam first syncs when refresh timestamp is still null.
 * Returns 429/409 response when the slot cannot be claimed.
 */
export async function claimPostCampaignSyncSlot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
  isAdmin: boolean,
): Promise<ClaimPostCampaignSyncSlotResult> {
  const { data: contest, error } = await supabaseAdmin
    .from("contests")
    .select("post_campaign_last_metrics_updated, post_campaign_last_synced_at")
    .eq("id", contestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contest) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Contest not found" }, { status: 404 }),
    };
  }

  const previousSyncedAt =
    (contest.post_campaign_last_synced_at as string | null | undefined) ?? null;

  const cooldownAnchor =
    contest.post_campaign_last_metrics_updated ??
    contest.post_campaign_last_synced_at;
  const cooldownDenied = postCampaignCooldownResponse(cooldownAnchor, isAdmin);
  if (cooldownDenied) {
    return { ok: false, response: cooldownDenied };
  }

  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(
    Date.now() - cooldownMsFor(isAdmin),
  ).toISOString();

  // CAS: only claim if never synced/refreshed-recently, or last sync older than cooldown.
  let query = supabaseAdmin
    .from("contests")
    .update({ post_campaign_last_synced_at: nowIso })
    .eq("id", contestId);

  if (contest.post_campaign_last_synced_at) {
    query = query.lt("post_campaign_last_synced_at", cutoffIso);
  } else {
    query = query.is("post_campaign_last_synced_at", null);
  }

  const { data: claimed, error: claimError } = await query
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "A post-campaign sync is already in progress or was started recently. Please wait and try again.",
          alreadyActive: true,
        },
        { status: 409 },
      ),
    };
  }
  return { ok: true, claim: { previousSyncedAt } };
}

/** Undo a sync slot claim when syncPostCampaignFromSubmissions fails. */
export async function releasePostCampaignSyncSlot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
  claim: PostCampaignSyncSlotClaim,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("contests")
    .update({ post_campaign_last_synced_at: claim.previousSyncedAt })
    .eq("id", contestId);
  if (error) throw new Error(error.message);
}

/** True when a post-campaign metrics queue run is already active for this contest. */
export async function hasActivePostCampaignMetricsRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  table: MetricsRunTable,
  contestId: string,
): Promise<boolean> {
  await abandonStaleActiveMetricsRuns(supabaseAdmin, table, contestId, {
    metricsTarget: "post_campaign",
  });
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("contest_id", contestId)
    .eq("metrics_target", "post_campaign")
    .in("status", ["pending", "running"])
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}

/**
 * Block enqueue when the *other* metrics_target already has an active run.
 * Same-target active runs are handled by the existing alreadyActive path.
 * Stale cross-target runs are abandoned first so a stuck job cannot brick both targets.
 */
export async function assertNoCrossTargetActiveRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  table: MetricsRunTable,
  contestId: string,
  requestedTarget: MetricsRefreshTarget,
): Promise<NextResponse | null> {
  const otherTarget: MetricsRefreshTarget =
    requestedTarget === "post_campaign" ? "submissions" : "post_campaign";
  await abandonStaleActiveMetricsRuns(supabaseAdmin, table, contestId, {
    metricsTarget: otherTarget,
  });
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, metrics_target, status")
    .eq("contest_id", contestId)
    .eq("metrics_target", otherTarget)
    .in("status", ["pending", "running"])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const otherLabel =
    otherTarget === "post_campaign" ? "post-campaign" : "submissions";
  return NextResponse.json(
    {
      error: `A ${otherLabel} metrics refresh is already in progress for this contest. Wait for it to finish before starting a ${requestedTarget === "post_campaign" ? "post-campaign" : "submissions"} refresh.`,
      alreadyActive: true,
      blockingTarget: otherTarget,
      blockingRunId: data.id,
    },
    { status: 409 },
  );
}

export function activePostCampaignRunResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "A post-campaign metrics refresh is already in progress for this contest.",
      alreadyActive: true,
    },
    { status: 409 },
  );
}
