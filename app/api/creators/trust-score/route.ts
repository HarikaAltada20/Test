import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  assertCreatorMeetsContestRequirements,
  recomputeCreatorProfileMetrics,
} from "@/lib/creator-requirements";
import { getCreatorTrustMetricsLive } from "@/lib/trust-score";

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

/** Pre-submit requirements check (mirrors DB trigger; clearer errors for UI). */
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

    const metrics = await getCreatorTrustMetricsLive(supabase, user.id);
    return NextResponse.json({ allowed: true, trust_score: metrics.trust_score });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during requirements check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recompute and persist creator profile metrics from all submissions. */
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

    await recomputeCreatorProfileMetrics(supabase, user.id);
    const metrics = await getCreatorTrustMetricsLive(supabase, user.id);
    return NextResponse.json(metrics);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while refreshing trust score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
