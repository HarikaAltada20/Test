import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDailyChallengeLeaderboard } from "@/lib/daily-challenge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const payload = await getDailyChallengeLeaderboard({
      period: "today",
      scope: "verified",
      page: 1,
      limit: 100,
      meUserId: user.id,
    });
    return NextResponse.json({ me: payload.me, generatedAt: payload.generatedAt });
  } catch (error) {
    console.error("[competition/me/progress] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
