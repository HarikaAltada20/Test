import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { calculateTwitterCpmBudgetSpent } from "@/lib/contest-utils";
import { isContestEligibleForScheduledMetricsRefresh } from "@/lib/contest-metrics-refresh-eligibility";

export const dynamic = "force-dynamic";

// This cron job updates budget_spent for Twitter CPM contests
// It should be called periodically to keep budget calculations in sync
export async function GET(request: Request) {
  try {
    // Verify this is a cron job request
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all Twitter CPM contests that need budget updates
    const { data: contests, error: contestsError } = await supabaseAdmin
      .from("contests")
      .select(
        "id, title, contest_type, platform, contest_based_details, views_locked_at, post_contest_status",
      )
      .eq("contest_type", "cpm")
      .eq("platform", "twitter")
      .not("contest_based_details->cpm_contest->cpm_rate_usd", "is", null)
      .is("views_locked_at", null);

    if (contestsError) {
      console.error(
        "[Twitter CPM Metrics] Error fetching contests:",
        contestsError
      );
      return NextResponse.json(
        { error: "Failed to fetch contests" },
        { status: 500 }
      );
    }

    if (!contests || contests.length === 0) {
      console.log("[Twitter CPM Metrics] No Twitter CPM contests found");
      return NextResponse.json({
        success: true,
        message: "No Twitter CPM contests to process",
        processedCount: 0,
      });
    }

    const eligibleContests = (contests || []).filter(
      isContestEligibleForScheduledMetricsRefresh,
    );

    if (!eligibleContests.length) {
      console.log("[Twitter CPM Metrics] No eligible Twitter CPM contests found");
      return NextResponse.json({
        success: true,
        message: "No eligible Twitter CPM contests to process",
        processedCount: 0,
      });
    }

    let processedCount = 0;
    const now = new Date().toISOString();

    // Process each contest
    for (const contest of eligibleContests) {
      try {
        const cpmConfig = (contest as any).contest_based_details?.cpm_contest;
        const flatFeeBonus = cpmConfig?.flat_fee_bonus || 0;
        const flatFeeBonusCap = cpmConfig?.flat_fee_bonus_cap || null;

        if (!cpmConfig?.cpm_rate_usd) {
          console.warn(
            `[Twitter CPM Metrics] Contest ${contest.id} missing cpm_rate_usd, skipping`
          );
          continue;
        }

        // Fetch Twitter tweets for this contest with Twitter-specific fields
        const { data: twitterTweets, error: tweetsError } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .select(
            "id, creator_id, tweet_created_at, points, moderation_status, manual_points_adjustment, is_eligible, deleted_at",
          )
          .eq("contest_id", contest.id)
          .eq("is_eligible", true)
          .is("deleted_at", null)
          .in("moderation_status", ["verified", "paid"]);

        if (tweetsError) {
          console.error(
            `[Twitter CPM Metrics] Error fetching Twitter tweets for contest ${contest.id}:`,
            tweetsError
          );
          continue;
        }

        // Convert Twitter tweets to Submission format for budget calculation
        const submissions =
          twitterTweets?.map((tweet) => ({
            id: tweet.id,
            creator_id: tweet.creator_id,
            created_at: tweet.tweet_created_at,
            platform: "twitter",
            status: tweet.moderation_status,
            is_eligible: tweet.is_eligible === true,
            deleted_at: tweet.deleted_at ?? null,
            is_twitter_tweet: true as const,
            paid: tweet.moderation_status === "paid",
            earnings: null, // Twitter uses points, not direct earnings
            bonus_paid: false,
            bonus_amount: 0,
            other_stats: {
              base_points: tweet.points || 0,
              manual_points_adjustment: tweet.manual_points_adjustment || 0,
            },
            manual_points_adjustment: tweet.manual_points_adjustment || 0,
            views: 0, // Twitter doesn't use views
          })) || [];

        // Calculate actual budget spent using Twitter CPM formula
        const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
          submissions || [],
          cpmConfig.cpm_rate_usd,
          cpmConfig.max_earnings_per_creator,
          cpmConfig.min_views,
          cpmConfig.max_views,
          flatFeeBonus,
          flatFeeBonusCap
        );

        // Update the contest's budget_spent field
        const { error: updateError } = await supabaseAdmin
          .from("contests")
          .update({
            contest_based_details: {
              ...(contest as any).contest_based_details,
              cpm_contest: {
                ...cpmConfig,
                budget_spent: Math.round(actualBudgetSpent * 100), // Convert to cents
              },
            },
            last_metrics_updated: now,
          })
          .eq("id", contest.id);

        if (updateError) {
          console.error(
            `[Twitter CPM Metrics] Error updating budget for contest ${contest.id}:`,
            updateError
          );
        } else {
          console.log(
            `[Twitter CPM Metrics] Updated budget for contest ${contest.id} (${
              contest.title
            }): $${actualBudgetSpent.toFixed(2)}`
          );
          // Also run unified persist (list cache invalidate + dual/leaderboard/milestone parity).
          try {
            const { persistContestBudgetSpent } = await import(
              "@/lib/persist-contest-budget-spent"
            );
            await persistContestBudgetSpent(contest.id, supabaseAdmin as any);
          } catch (persistErr) {
            console.warn(
              `[Twitter CPM Metrics] persistContestBudgetSpent failed for ${contest.id}:`,
              persistErr,
            );
          }
          processedCount++;
        }
      } catch (contestError) {
        console.error(
          `[Twitter CPM Metrics] Error processing contest ${contest.id}:`,
          contestError
        );
      }
    }

    console.log(
      `[Twitter CPM Metrics] Completed processing ${processedCount}/${eligibleContests.length} Twitter CPM contests`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCount} Twitter CPM contests`,
      processedCount,
      totalCount: eligibleContests.length,
    });
  } catch (error: any) {
    console.error("[Twitter CPM Metrics] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
