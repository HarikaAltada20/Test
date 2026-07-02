import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  assertCreatorMeetsContestRequirements,
  buildCreatorRequirementsSnapshotFromProfile,
  getCreatorRequirementsSnapshot,
  parseContestCreatorRequirements,
  evaluateCreatorRequirements,
  recomputeCreatorProfileMetrics,
} from "@/lib/creator-requirements";
import { getCreatorStatsFromProfile } from "@/lib/creator-profile-stats";

export const dynamic = "force-dynamic";

/** Live creator stats for profile + submit gates. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select(
        "trust_score_metrics, avg_quality_score, best_quality_score, total_money_won, total_views",
      )
      .eq("id", user.id)
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while loading creator stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pre-submit requirements check for a contest. */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const contestId = typeof body?.contestId === "string" ? body.contestId.trim() : "";
    if (!contestId) {
      return NextResponse.json({ error: "contestId is required" }, { status: 400 });
    }

    const result = await assertCreatorMeetsContestRequirements(
      supabase,
      contestId,
      user.id,
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during requirements check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Check eligibility for a contest (returns failures list). */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const contestId = typeof body?.contestId === "string" ? body.contestId.trim() : "";
    if (!contestId) {
      return NextResponse.json({ error: "contestId is required" }, { status: 400 });
    }

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
    const snapshot = await getCreatorRequirementsSnapshot(supabase, user.id);
    const failures = evaluateCreatorRequirements({ requirements, snapshot });

    return NextResponse.json({
      eligible: failures.length === 0,
      failures,
      snapshot,
      requirements,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during eligibility check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recompute cached profile metrics from submissions. */
export async function PATCH() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const recomputeResult = await recomputeCreatorProfileMetrics(supabase, user.id);
    if (!recomputeResult.ok) {
      return NextResponse.json(
        { error: recomputeResult.errors.join("; ") },
        { status: 500 },
      );
    }
    const snapshot = await getCreatorRequirementsSnapshot(supabase, user.id);

    return NextResponse.json(snapshot);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while refreshing creator stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
