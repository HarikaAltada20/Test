import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { REVERSAL_TRANSACTION_REMARK } from "@/lib/payment-utils";

/**
 * GET /api/contests/[id]/twitter-bonus-status?tweetIds=id1,id2,id3
 * Returns bonus_paid status and amount for each Twitter tweet (by twitter_campaign_tweets.id).
 * Used to hydrate Bonus Granted in the UI when server-side data is missing or after client updates.
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
    const tweetIds = tweetIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
    if (tweetIds.length === 0) {
      return NextResponse.json({ statusByTweetId: {} });
    }

    const supabaseAdmin = createAdminClient();
    const [
      { data: bonusRewards },
      { data: bonusRefunds },
    ] = await Promise.all([
      supabaseAdmin
        .from("money_transactions")
        .select("amount, created_at, metadata, user_id")
        .eq("type", "reward")
        .contains("metadata", {
          contest_id: contestId,
          bonus_type: "flat_fee",
        }),
      supabaseAdmin
        .from("money_transactions")
        .select("amount, metadata, remarks, user_id")
        .eq("type", "refund")
        .contains("metadata", {
          contest_id: contestId,
          bonus_type: "flat_fee",
        }),
    ]);

    const rewardSumByTweet = new Map<string, { sum: number; latestAt: string }>();
    const refundSumByTweet = new Map<string, number>();
    const creatorLevelRefund = new Map<string, number>();

    (bonusRewards || []).forEach((r: any) => {
      const m = r.metadata || {};
      const at = r.created_at || "";
      const bulkMap = m.twitter_bulk_bonus_breakdown;
      if (bulkMap && typeof bulkMap === "object") {
        for (const [tid, cents] of Object.entries(bulkMap)) {
          const amt = Number(cents) || 0;
          if (amt <= 0) continue;
          const id = String(tid);
          const cur = rewardSumByTweet.get(id);
          rewardSumByTweet.set(id, {
            sum: (cur?.sum ?? 0) + amt,
            latestAt:
              !cur || (at && at > (cur.latestAt || "")) ? at : cur.latestAt,
          });
        }
      }
      const rawTweetId = m.tweet_id;
      const tweetId = rawTweetId != null ? String(rawTweetId) : null;
      if (tweetId) {
        const amt = Number(r.amount) || 0;
        const cur = rewardSumByTweet.get(tweetId);
        rewardSumByTweet.set(tweetId, {
          sum: (cur?.sum ?? 0) + amt,
          latestAt:
            !cur || (at && at > (cur.latestAt || "")) ? at : cur.latestAt,
        });
      }
    });

    (bonusRefunds || [])
      .filter(
        (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
      )
      .forEach((r: any) => {
        const rawTweetId = r.metadata?.tweet_id;
        const tweetId = rawTweetId != null ? String(rawTweetId) : null;
        const amt = Number(r.amount) || 0;
        if (tweetId) {
          refundSumByTweet.set(
            tweetId,
            (refundSumByTweet.get(tweetId) ?? 0) + amt
          );
        } else {
          const creatorId = r.user_id;
          if (creatorId) {
            creatorLevelRefund.set(
              creatorId,
              (creatorLevelRefund.get(creatorId) ?? 0) + amt
            );
          }
        }
      });

    const statusByTweetId: Record<
      string,
      { bonus_paid: boolean; bonus_amount: number; bonus_paid_at: string | null }
    > = {};
    for (const id of tweetIds) {
      const tweetId = String(id);
      const reward = rewardSumByTweet.get(tweetId);
      const refundSum = refundSumByTweet.get(tweetId) ?? 0;
      const net = reward ? Math.max(0, reward.sum - refundSum) : 0;
      statusByTweetId[id] = {
        bonus_paid: net > 0,
        bonus_amount: net,
        bonus_paid_at: net > 0 && reward?.latestAt ? reward.latestAt : null,
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
