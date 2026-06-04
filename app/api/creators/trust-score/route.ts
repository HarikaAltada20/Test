import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  assertCreatorMeetsContestTrustRequirement,
  getCreatorTrustMetricsLive,
  getCreatorTrustScoreForUser,
  recomputeCreatorTrustMetrics,
} from "@/lib/trust-score";

export const dynamic = "force-dynamic";

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

    const metrics = await getCreatorTrustMetricsLive(supabase, user.id);
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
