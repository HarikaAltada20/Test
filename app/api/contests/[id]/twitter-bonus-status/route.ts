import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * GET /api/contests/[id]/twitter-bonus-status?tweetIds=id1,id2,id3
 * Returns bonus_paid status and amount for each Twitter tweet (by twitter_campaign_tweets.id).
 * Source of truth is twitter_campaign_tweets (not money_transactions), so Bonus Granted in the UI
 * matches payout records and moderation state.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const tweetIdsParam = request.nextUrl.searchParams.get("tweetIds");
    if (!tweetIdsParam) {
      return NextResponse.json(
        { error: "tweetIds query param required" },
        { status: 400 }
      );
    }
    const tweetIds = tweetIdsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (tweetIds.length === 0) {
      return NextResponse.json({ statusByTweetId: {} });
    }

    const supabaseAdmin = createAdminClient();
    const { data: rows, error } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("id, bonus_paid, bonus_amount, bonus_paid_at")
      .eq("contest_id", contestId)
      .in("id", tweetIds);

    if (error) {
      console.error("[twitter-bonus-status] Query error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to load tweet bonus status" },
        { status: 500 }
      );
    }

    const byId = new Map(
      (rows || []).map((r: any) => [
        String(r.id),
        {
          bonus_paid: Boolean(r.bonus_paid),
          bonus_amount: Math.round(Number(r.bonus_amount) || 0),
          bonus_paid_at: (r.bonus_paid_at as string | null) ?? null,
        },
      ])
    );

    const statusByTweetId: Record<
      string,
      {
        bonus_paid: boolean;
        bonus_amount: number;
        bonus_paid_at: string | null;
      }
    > = {};
    for (const id of tweetIds) {
      statusByTweetId[id] = byId.get(String(id)) ?? {
        bonus_paid: false,
        bonus_amount: 0,
        bonus_paid_at: null,
      };
    }

    return NextResponse.json({ statusByTweetId });
  } catch (error: any) {
    console.error("[twitter-bonus-status] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
