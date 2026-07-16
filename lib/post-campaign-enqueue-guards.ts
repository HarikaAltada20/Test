import { NextResponse } from "next/server";
import {
  METRICS_REFRESH_COOLDOWN_MS_ADMIN,
  METRICS_REFRESH_COOLDOWN_MS_BRAND,
} from "@/lib/constants";

export type MetricsRefreshTarget = "submissions" | "post_campaign";

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

type MetricsRunTable =
  | "instagram_insights_refresh_runs"
  | "youtube_metrics_refresh_runs"
  | "tiktok_metrics_refresh_runs";

/** True when a post-campaign metrics queue run is already active for this contest. */
export async function hasActivePostCampaignMetricsRun(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  table: MetricsRunTable,
  contestId: string,
): Promise<boolean> {
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
