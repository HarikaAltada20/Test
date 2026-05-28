import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  buildTrustScoreMetricsFromCounts,
  getTrustMetricsFromStatuses,
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

const clampPercentage = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

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

    // Preferred source: persisted trust score metrics from creators/creator_profiles table.
    // Fallback to recomputing from submissions only when persisted metrics are unavailable.
    let persistedMetrics: TrustScoreMetrics | null = null;

    try {
      const { data: creatorsMetricData } = await supabase
        .from("creators")
        .select("trust_score_metric")
        .eq("id", user.id)
        .maybeSingle();

      persistedMetrics = normalizeMetrics(creatorsMetricData?.trust_score_metric);
    } catch {
      // Ignore and continue to other sources.
    }

    if (!persistedMetrics) {
      try {
        const { data: creatorsMetricsData } = await supabase
          .from("creators")
          .select("trust_score_metrics")
          .eq("id", user.id)
          .maybeSingle();

        persistedMetrics = normalizeMetrics(creatorsMetricsData?.trust_score_metrics);
      } catch {
        // Ignore and continue to creator_profiles.
      }
    }

    if (!persistedMetrics) {
      const { data: profileData } = await supabase
        .from("creator_profiles")
        .select("trust_score_metrics")
        .eq("id", user.id)
        .maybeSingle();

      persistedMetrics = normalizeMetrics(profileData?.trust_score_metrics);
    }

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error while loading trust score" },
      { status: 500 },
    );
  }
}
