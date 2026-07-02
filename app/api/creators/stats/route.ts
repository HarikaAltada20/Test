import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  loadCreatorStatsResponse,
  checkContestRequirementsResponse,
  evaluateContestEligibilityResponse,
  refreshCreatorStatsResponse,
} from "@/lib/creator-stats-api-handlers";

export const dynamic = "force-dynamic";

/** Live creator stats for profile + submit gates. Use ?fresh=1 to recompute from submissions first. */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    return loadCreatorStatsResponse(supabase, user.id, { recompute: fresh });
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

    return checkContestRequirementsResponse(supabase, user.id, contestId);
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

    return evaluateContestEligibilityResponse(supabase, user.id, contestId);
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

    return refreshCreatorStatsResponse(supabase, user.id);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while refreshing creator stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
