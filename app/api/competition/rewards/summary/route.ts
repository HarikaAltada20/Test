import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getDailyChallengeRewardsOverview } from "@/lib/daily-challenge";
import { parseOptionalUuid } from "@/lib/daily-challenge-history";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const eventId = parseOptionalUuid(request.nextUrl.searchParams.get("event_id"));
    const overview = await getDailyChallengeRewardsOverview(eventId);
    return NextResponse.json(overview);
  } catch (error) {
    console.error("[competition/rewards/summary] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
