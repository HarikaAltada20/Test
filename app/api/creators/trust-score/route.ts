import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadTrustMetricsResponse,
  checkContestRequirementsResponse,
  refreshTrustMetricsResponse,
} from "@/lib/creator-stats-api-handlers";

export const dynamic = "force-dynamic";

/**
 * @deprecated Prefer `/api/creators/stats` for full creator metrics.
 * This route remains for backward compatibility and delegates to shared handlers.
 */
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

    return loadTrustMetricsResponse(supabase, user.id);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while loading trust score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pre-submit requirements check (delegates to shared stats handler). */
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

    const result = await checkContestRequirementsResponse(
      supabase,
      user.id,
      contestId,
    );
    if (result.status !== 200) {
      return result;
    }

    const metricsResponse = await loadTrustMetricsResponse(supabase, user.id);
    const metrics = await metricsResponse.json();
    return NextResponse.json({
      allowed: true,
      trust_score: metrics.trust_score,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during requirements check";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recompute metrics (delegates to shared stats refresh). */
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

    return refreshTrustMetricsResponse(supabase, user.id);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while refreshing trust score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
