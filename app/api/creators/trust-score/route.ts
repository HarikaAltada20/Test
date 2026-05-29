import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  assertCreatorMeetsContestTrustRequirement,
  buildTrustScoreMetricsFromCounts,
  getCreatorTrustScoreForUser,
  getTrustMetricsFromStatuses,
  recomputeCreatorTrustMetrics,
  type TrustScoreMetrics,
} from "@/lib/trust-score";

export const dynamic = "force-dynamic";

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const clampPercentage = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const normalizeMetrics = (raw: unknown): TrustScoreMetrics | null => {
  if (!raw || typeof raw !== "object") return null;
  const metrics = raw as Record<string, unknown>;

  const totalReels = Math.max(0, toFiniteNumber(metrics.total_reels) ?? 0);
  const verifiedReels = Math.max(0, toFiniteNumber(metrics.verified_reels) ?? 0);
  const rejectedReels = Math.max(0, toFiniteNumber(metrics.rejected_reels) ?? 0);
  const pendingReels = Math.max(0, toFiniteNumber(metrics.pending_reels) ?? 0);

  const computed = buildTrustScoreMetricsFromCounts({
    total_reels: totalReels,
    verified_reels: verifiedReels,
    rejected_reels: rejectedReels,
    pending_reels: pendingReels,
  });

  const trustScore = toFiniteNumber(metrics.trust_score);
  const rejectedPct = toFiniteNumber(metrics.rejected_pct);
  const verifiedPct = toFiniteNumber(metrics.verified_pct);
  const pendingPct = toFiniteNumber(metrics.pending_pct);

  return {
    ...computed,
    trust_score: trustScore === null ? computed.trust_score : clampPercentage(trustScore),
    rejected_pct: rejectedPct === null ? computed.rejected_pct : clampPercentage(rejectedPct),
    verified_pct: verifiedPct === null ? computed.verified_pct : clampPercentage(verifiedPct),
    pending_pct: pendingPct === null ? computed.pending_pct : clampPercentage(pendingPct),
  };
};

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

    const { data: profileData, error: profileError } = await supabase
      .from("creator_profiles")
      .select("trust_score_metrics")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message || "Failed to load trust score" },
        { status: 500 },
      );
    }

    const persistedMetrics = normalizeMetrics(profileData?.trust_score_metrics);
    if (persistedMetrics) {
      return NextResponse.json(persistedMetrics);
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("status")
      .eq("creator_id", user.id);

    if (submissionsError) {
      return NextResponse.json(
        { error: submissionsError.message || "Failed to load trust score" },
        { status: 500 },
      );
    }

    const metrics = getTrustMetricsFromStatuses(
      (submissions || []).map((row) => row.status),
    );

    return NextResponse.json(metrics);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while loading trust score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pre-submit trust check (mirrors DB trigger; clearer errors for UI). */
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
    const contestId =
      typeof body?.contestId === "string" ? body.contestId.trim() : "";

    if (!contestId) {
      return NextResponse.json({ error: "contestId is required" }, { status: 400 });
    }

    const result = await assertCreatorMeetsContestTrustRequirement(
      supabase,
      contestId,
      user.id,
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const trustScore = await getCreatorTrustScoreForUser(supabase, user.id);
    return NextResponse.json({ allowed: true, trust_score: trustScore });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during trust check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recompute and persist trust_score_metrics from all submissions (call after submit). */
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

    const result = await recomputeCreatorTrustMetrics(supabase, user.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.metrics);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while refreshing trust score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
