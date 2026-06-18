import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAdvertiserContestsWithCalculatedBudgets } from "@/lib/contest-service";
import { enrichContestsWithListCardStats } from "@/lib/contest-list-card-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = (user.user_metadata || {})?.user_type;
    if (userType === "creator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contests = await getAdvertiserContestsWithCalculatedBudgets(
      user.id,
      supabase,
    );

    const contestsWithCardStats = await enrichContestsWithListCardStats(contests);

    return NextResponse.json({ contests: contestsWithCardStats });
  } catch (err: any) {
    console.error("[/api/contests/list] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch contests" },
      { status: 500 }
    );
  }
}
