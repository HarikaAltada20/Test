import { createClient } from "@/utils/supabase/server";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import { NextResponse } from "next/server";

/**
 * Bust Next.js cached leaderboard payload for this contest (after new submission, etc.).
 * Requires authenticated user.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ contestId: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contestId } = await context.params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID required" }, { status: 400 });
    }

    revalidateLeaderboardCache(contestId);

    return NextResponse.json({ ok: true, contestId });
  } catch (e: any) {
    console.error("[leaderboard/revalidate]", e);
    return NextResponse.json(
      { error: e?.message || "Revalidate failed" },
      { status: 500 },
    );
  }
}
