import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncTwitterLeaderboardFromTweets } from "@/lib/twitter/sync-twitter-leaderboard-from-tweets";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import {
  postContestStatusLocksSubmissionModeration,
  SUBMISSION_MODERATION_LOCKED_MESSAGE,
} from "@/lib/post-contest-moderation-lock";
import { schedulePersistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";
import {
  authorizeQueueWorker,
  readQueuedActorUserId,
} from "@/lib/queue/queue-worker-auth";
import { reverseTwitterTweetPayment } from "@/lib/twitter-tweet-payment-reversal";

/**
 * POST /api/contests/[id]/moderate-submission
 *
 * Accept or reject a Twitter campaign tweet
 * Note: This is for Twitter campaigns only (automated fetching system)
 * For manual submissions (YouTube/Instagram), use the existing verify-submission endpoint
 *
 * Body:
 * - tweetId: string (twitter_campaign_tweets.id)
 * - action: "approve" | "reject" | "pending" | "paid"
 * - reason?: string (required for reject)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const queueAuth = authorizeQueueWorker(request);
    if (queueAuth.fromQueue && !queueAuth.authorized) {
      return queueAuth.response!;
    }

    const { id: contestId } = await params;
    const body = (await request.json()) as {
      tweetId?: string;
      action?: string;
      reason?: string;
      admin_user_id?: string;
      actor_user_id?: string;
      skipWalletReversal?: boolean;
    };
    const { tweetId, action, reason } = body;
    const skipWalletReversal = body.skipWalletReversal === true;

    const validActions = ["approve", "reject", "pending", "paid"];
    if (!tweetId || !action || !validActions.includes(action)) {
      return NextResponse.json(
        {
          error: `tweetId and action (${validActions.join("/")}) are required`,
        },
        { status: 400 }
      );
    }

    if (action === "reject" && !reason) {
      return NextResponse.json(
        { error: "Reason is required when rejecting" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    let contest: {
      id: string;
      advertiser_id: string;
      platform: string | null;
      contest_type: string | null;
      title: string | null;
      post_contest_status: string | null;
    } | null = null;

    if (queueAuth.fromQueue) {
      const actorId = readQueuedActorUserId(body);
      if (!actorId) {
        return NextResponse.json(
          { error: "admin_user_id is required for queued moderation" },
          { status: 400 },
        );
      }
      const { data, error } = await supabaseAdmin
        .from("contests")
        .select(
          "id, advertiser_id, platform, contest_type, title, post_contest_status",
        )
        .eq("id", contestId)
        .single();
      if (error || !data) {
        return NextResponse.json(
          { error: "Contest not found or access denied" },
          { status: 404 },
        );
      }
      contest = data;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if user is admin or contest owner
      const { data: userData } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();

      const isAdmin = userData?.user_type === "admin";

      // Get contest to verify ownership and type (for CPM reversal)
      let contestQuery = supabase
        .from("contests")
        .select("id, advertiser_id, platform, contest_type, title, post_contest_status")
        .eq("id", contestId);

      if (!isAdmin) {
        contestQuery = contestQuery.eq("advertiser_id", user.id);
      }

      const { data, error: contestError } = await contestQuery.single();
      if (contestError || !data) {
        return NextResponse.json(
          { error: "Contest not found or access denied" },
          { status: 404 }
        );
      }
      contest = data;
    }

    if (!contest) {
      return NextResponse.json(
        { error: "Contest not found or access denied" },
        { status: 404 }
      );
    }

    if (
      postContestStatusLocksSubmissionModeration(contest.post_contest_status) &&
      (action === "approve" || action === "reject" || action === "pending")
    ) {
      return NextResponse.json(
        { error: SUBMISSION_MODERATION_LOCKED_MESSAGE },
        { status: 400 },
      );
    }

    let refund: {
      cpmCents: number;
      bonusCents: number;
      totalCents: number;
    } | null = null;

    // Fetch current tweet state before any update (for per-tweet reversal).
    // bonus_paid/bonus_amount are needed as a fallback when the bonus was credited
    // through bulk-pay-twitter-cpm (which stores per-tweet bonus inside
    // metadata.twitter_bulk_bonus_breakdown rather than metadata.tweet_id).
    const { data: currentTweet, error: tweetFetchError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select(
        "id, creator_id, moderation_status, earnings, bonus_paid, bonus_amount"
      )
      .eq("id", tweetId)
      .eq("contest_id", contestId)
      .single();

    if (tweetFetchError || !currentTweet) {
      return NextResponse.json(
        { error: "Tweet not found for this contest" },
        { status: 404 }
      );
    }

    const platform = (contest as any).platform?.toLowerCase();
    const isTwitterPlatform = platform === "twitter" || platform === "x";
    const isTwitterCpm =
      isTwitterPlatform && (contest as any).contest_type === "cpm";

    // In-batch wallet reverse only when this tweet is currently paid.
    // Queued bulk jobs skip this and reverse once at job end (same as video).
    // Never block verified/pending/rejected on a refund debit failure.
    if (
      !skipWalletReversal &&
      currentTweet.moderation_status === "paid" &&
      action !== "paid" &&
      isTwitterPlatform &&
      currentTweet.creator_id
    ) {
      const reversed = await reverseTwitterTweetPayment({
        supabaseAdmin,
        contestId,
        contestTitle: (contest as any)?.title || "Contest",
        tweetId,
        creatorId: currentTweet.creator_id,
        storedCpmCents: currentTweet.earnings,
        storedBonusCents: (currentTweet as any).bonus_amount,
        bonusPaid: (currentTweet as any).bonus_paid,
      });
      if (!reversed.ok) {
        console.error(
          "[moderate-submission] Wallet reversal failed; continuing status update:",
          reversed.error,
        );
      } else if (reversed.refund.totalCents > 0) {
        refund = {
          cpmCents: reversed.refund.cpmCents,
          bonusCents: reversed.refund.bonusCents,
          totalCents: reversed.refund.totalCents,
        };
      }
    }

    const moderationStatus =
      action === "approve"
        ? "verified"
        : action === "reject"
        ? "rejected"
        : action === "paid"
        ? "paid"
        : "pending";

    // Update Twitter campaign tweet
    const updateData: any = {
      moderation_status: moderationStatus,
    };

    // Leaving "paid": clear stored CPM cents and bonus state so SSR/UI never show stale
    // granted amounts. Bonus columns must reset alongside the reward — otherwise the row
    // still reports bonus_paid=true after the wallet refund logged above, which leaves
    // twitter_campaign_tweets out of sync with money_transactions.
    if (
      !skipWalletReversal &&
      isTwitterPlatform &&
      currentTweet.moderation_status === "paid" &&
      action !== "paid"
    ) {
      updateData.earnings = null;
      updateData.bonus_paid = false;
      updateData.bonus_paid_at = null;
      updateData.bonus_amount = null;
    }

    if (action === "reject") {
      // Store rejection reason in manual_points_reason field
      updateData.manual_points_reason = reason;
    } else if (action !== "paid") {
      // Clear reason on approve/pending (unless there's a manual points adjustment)
      const { data: existingTweet } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("manual_points_adjustment, manual_points_reason")
        .eq("id", tweetId)
        .single();

      if (
        !existingTweet?.manual_points_adjustment ||
        existingTweet.manual_points_adjustment === 0
      ) {
        updateData.manual_points_reason = null;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .update(updateData)
      .eq("id", tweetId)
      .eq("contest_id", contestId);

    if (updateError) {
      console.error("[moderate-submission] Error updating tweet:", updateError);
      return NextResponse.json(
        { error: "Failed to update tweet" },
        { status: 500 }
      );
    }

    // After tweet earnings cleared/set, recompute leaderboard CPM from paid rows.
    if (
      isTwitterCpm &&
      currentTweet?.creator_id &&
      (currentTweet.moderation_status === "paid" || action === "paid")
    ) {
      try {
        const { reconcileTwitterLeaderboardCpmEarnings } = await import(
          "@/lib/twitter/reconcile-leaderboard-cpm-earnings"
        );
        const reconciled = await reconcileTwitterLeaderboardCpmEarnings(
          contestId,
          currentTweet.creator_id,
          supabaseAdmin,
        );
        if (!reconciled.ok) {
          console.error(
            "[moderate-submission] Leaderboard earnings reconcile failed:",
            reconciled.error,
          );
        }
      } catch (reconcileErr) {
        console.error(
          "[moderate-submission] Leaderboard earnings reconcile error:",
          reconcileErr,
        );
      }
    }

    // DB-only leaderboard recompute (no Twitter/RapidAPI; preserve refresh cooldown metadata)
    if (currentTweet?.creator_id) {
      try {
        await syncTwitterLeaderboardFromTweets(contestId, supabaseAdmin, {
          preserveRefreshMetadata: true,
        });
        revalidateLeaderboardCache(contestId);
      } catch (refreshError) {
        console.error(
          "[moderate-submission] Error syncing leaderboard:",
          refreshError
        );
      }
    }

    const actionMessage =
      action === "approve"
        ? "approved"
        : action === "reject"
        ? "rejected"
        : action === "paid"
        ? "marked as paid"
        : "set to pending";
    schedulePersistContestBudgetSpent(contestId);
    return NextResponse.json({
      success: true,
      message: `Tweet ${actionMessage} successfully`,
      refund,
    });
  } catch (error: any) {
    console.error("[moderate-submission] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
