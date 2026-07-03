import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertCreatorMeetsContestRequirements,
  buildCreatorRequirementsSnapshotFromProfile,
  getCreatorRequirementsSnapshot,
  parseContestCreatorRequirements,
  evaluateCreatorRequirements,
  recomputeCreatorProfileMetrics,
} from "@/lib/creator-requirements";
import { getCreatorStatsFromProfile } from "@/lib/creator-profile-stats";
import { getCreatorTrustMetricsLive } from "@/lib/trust-score";

export async function loadCreatorStatsResponse(
  supabase: SupabaseClient,
  userId: string,
  options?: { recompute?: boolean },
) {
  if (options?.recompute) {
    const recomputeResult = await recomputeCreatorProfileMetrics(supabase, userId);
    if (!recomputeResult.ok) {
      return NextResponse.json(
        { error: recomputeResult.errors.join("; ") },
        { status: 500 },
      );
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("creator_profiles")
    .select(
      "trust_score_metrics, avg_quality_score, best_quality_score, total_money_won, total_views, has_explicit_quality_scores",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const stats = getCreatorStatsFromProfile(profile);
  const snapshot = buildCreatorRequirementsSnapshotFromProfile(profile);

  return NextResponse.json({
    ...snapshot,
    totalPlatformEarningsCents: snapshot.totalPlatformEarningsCents,
    trustScorePct: snapshot.trustScorePct,
    trustNumber: snapshot.trustNumber,
    avgQualityScore: snapshot.avgQualityScore,
    bestQualityScore: snapshot.bestQualityScore,
    totalViews: snapshot.totalViews,
    verifiedReels: snapshot.verifiedReels,
    rejectedReels: snapshot.rejectedReels,
    pendingReels: snapshot.pendingReels,
    trust_metrics: stats.trustMetrics,
    quality_metrics: stats.qualityMetrics,
    snapshot,
  });
}

export async function checkContestRequirementsResponse(
  supabase: SupabaseClient,
  userId: string,
  contestId: string,
) {
  const result = await assertCreatorMeetsContestRequirements(
    supabase,
    contestId,
    userId,
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        failures: result.failures,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ allowed: true });
}

export async function evaluateContestEligibilityResponse(
  supabase: SupabaseClient,
  userId: string,
  contestId: string,
) {
  const { data: contest, error: contestError } = await supabase
    .from("contests")
    .select(
      "trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_platform_earnings, min_platform_views, contest_format",
    )
    .eq("id", contestId)
    .maybeSingle();

  if (contestError || !contest) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 });
  }

  const requirements = parseContestCreatorRequirements(contest);
  const snapshot = await getCreatorRequirementsSnapshot(supabase, userId);
  const failures = evaluateCreatorRequirements({ requirements, snapshot });

  return NextResponse.json({
    eligible: failures.length === 0,
    failures,
    snapshot,
    requirements,
  });
}

export async function refreshCreatorStatsResponse(
  supabase: SupabaseClient,
  userId: string,
) {
  const recomputeResult = await recomputeCreatorProfileMetrics(supabase, userId);
  if (!recomputeResult.ok) {
    return NextResponse.json(
      { error: recomputeResult.errors.join("; ") },
      { status: 500 },
    );
  }
  const snapshot = await getCreatorRequirementsSnapshot(supabase, userId);
  return NextResponse.json(snapshot);
}

export async function loadTrustMetricsResponse(
  supabase: SupabaseClient,
  userId: string,
) {
  const metrics = await getCreatorTrustMetricsLive(supabase, userId);
  return NextResponse.json(metrics);
}

export async function refreshTrustMetricsResponse(
  supabase: SupabaseClient,
  userId: string,
) {
  const refreshResult = await refreshCreatorStatsResponse(supabase, userId);
  if (refreshResult.status !== 200) {
    return refreshResult;
  }
  const metrics = await getCreatorTrustMetricsLive(supabase, userId);
  return NextResponse.json(metrics);
}
