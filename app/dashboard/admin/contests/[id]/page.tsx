import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import ContestDetailClient from "../../../contests/[id]/contest-detail-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { isMilestoneContestType } from "@/lib/contest-type";
import { REVERSAL_TRANSACTION_REMARK } from "@/lib/payment-utils";
import {
  loadContestDetailSubmissionCounts,
} from "@/lib/contest-detail-submissions";
import { fetchPostCampaignMetricsCount } from "@/lib/post-campaign-metrics";
import { shouldShowPostCampaignSubmissionsToggle } from "@/lib/contest-metrics-refresh-eligibility";
import { isVideoContestFormat } from "@/lib/trust-score";
import { flattenContestInspirationLinks } from "@/lib/video-platform-campaigns";

export default async function AdminContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const contestId = resolvedParams.id;

  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log(
      "Non-admin user attempted to access admin contest detail:",
      error,
    );
    redirect("/dashboard");
  }

  const supabase = await createClient();

  try {
    const { data: contestData } = await supabase
      .from("contests_with_status")
      .select("*")
      .eq("id", contestId)
      .single();

    console.log("Admin accessing contestData:", contestData);

    if (!contestData) {
      redirect("/dashboard/admin/contests");
    }

    const isVideoContest = isVideoContestFormat(contestData.contest_format);

    let contestSettings: {
      payout_adjustment_percentage: number | null;
      payout_adjustment_mode: string | null;
      trust_score: number | null;
      trust_number: number | null;
      min_best_quality_score: number | null;
      min_avg_quality_score: number | null;
      min_quality_score: number | null;
      min_platform_earnings: number | null;
      min_platform_views: number | null;
    } = {
      payout_adjustment_percentage: null,
      payout_adjustment_mode: null,
      trust_score: null,
      trust_number: null,
      min_best_quality_score: null,
      min_avg_quality_score: null,
      min_quality_score: null,
      min_platform_earnings: null,
      min_platform_views: null,
    };
    const { data: payoutRow } = await supabase
      .from("contests")
      .select(
        "payout_adjustment_percentage, payout_adjustment_mode, trust_score, trust_number, min_best_quality_score, min_avg_quality_score, min_quality_score, min_platform_earnings, min_platform_views",
      )
      .eq("id", contestId)
      .maybeSingle();
    if (payoutRow) {
      contestSettings = {
        payout_adjustment_percentage:
          payoutRow.payout_adjustment_percentage ?? null,
        payout_adjustment_mode: payoutRow.payout_adjustment_mode ?? null,
        trust_score: payoutRow.trust_score ?? null,
        trust_number: payoutRow.trust_number ?? null,
        min_best_quality_score: payoutRow.min_best_quality_score ?? null,
        min_avg_quality_score: payoutRow.min_avg_quality_score ?? null,
        min_quality_score: payoutRow.min_quality_score ?? null,
        min_platform_earnings: payoutRow.min_platform_earnings ?? null,
        min_platform_views: payoutRow.min_platform_views ?? null,
      };
    }

    let postCampaignLastMetricsUpdated: string | null = null;
    {
      const { data: pcRow } = await supabase
        .from("contests")
        .select("post_campaign_last_metrics_updated")
        .eq("id", contestId)
        .maybeSingle();
      postCampaignLastMetricsUpdated =
        pcRow?.post_campaign_last_metrics_updated ?? null;
    }

    const finalInspirationLinks = flattenContestInspirationLinks(
      contestData.inspiration_links,
    );

    const isTwitterCampaign =
      (contestData.platform?.toLowerCase() === "twitter" ||
        contestData.platform?.toLowerCase() === "x") &&
      contestData.contest_format === "text_image";

    const shouldPrefetchPostCampaign =
      shouldShowPostCampaignSubmissionsToggle(contestData);

    let initialPostCampaignMetricsCount: number | null = null;
    if (shouldPrefetchPostCampaign) {
      try {
        const admin = createAdminClient();
        initialPostCampaignMetricsCount = await fetchPostCampaignMetricsCount(
          admin,
          contestId,
        );
      } catch (err) {
        console.error(
          `[Admin page.tsx] Failed to prefetch post-campaign metrics count for ${contestId}:`,
          err,
        );
      }
    }

    console.log(`[Admin page.tsx] Contest detection:`, {
      platform: contestData.platform,
      contest_format: contestData.contest_format,
      isTwitterCampaign,
    });

    let milestoneBonusPaidByCreator: Record<
      string,
      { viewsPaidCents: number; reelsPaidCents: number }
    > = {};
    if (isMilestoneContestType(contestData.contest_type)) {
      try {
        const supabaseAdmin = createAdminClient();
        const [{ data: milestoneRewards }, { data: milestoneRefunds }] =
          await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("amount, metadata, user_id")
              .eq("type", "reward")
              .eq("status", "success")
              .contains("metadata", { contest_id: contestId }),
            supabaseAdmin
              .from("money_transactions")
              .select("amount, metadata, remarks, user_id")
              .eq("type", "refund")
              .contains("metadata", { contest_id: contestId }),
          ]);

        const addByTrack = (
          row: any,
          sign: 1 | -1,
          acc: Map<string, { views: number; reels: number }>,
        ) => {
          const creatorId = String(row?.user_id || "").trim();
          if (!creatorId) return;
          const bt = String(row?.metadata?.bonus_type || "");
          const amount = Number(row?.amount) || 0;
          if (amount <= 0) return;
          if (
            bt !== "milestone_most_verified_views" &&
            bt !== "milestone_most_verified_reels"
          )
            return;
          const cur = acc.get(creatorId) || { views: 0, reels: 0 };
          if (bt === "milestone_most_verified_views") {
            cur.views += sign * amount;
          } else {
            cur.reels += sign * amount;
          }
          acc.set(creatorId, cur);
        };

        const paidByTrack = new Map<string, { views: number; reels: number }>();
        (milestoneRewards || []).forEach((r: any) =>
          addByTrack(r, 1, paidByTrack),
        );
        (milestoneRefunds || [])
          .filter(
            (r: any) =>
              !r?.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
          )
          .forEach((r: any) => addByTrack(r, -1, paidByTrack));

        paidByTrack.forEach((v, creatorId) => {
          milestoneBonusPaidByCreator[creatorId] = {
            viewsPaidCents: Math.max(0, v.views || 0),
            reelsPaidCents: Math.max(0, v.reels || 0),
          };
        });
      } catch (err) {
        console.error(
          "[admin contest page] Error fetching milestone bonus paid split by track:",
          err,
        );
      }
    }

    let creatorModerationData: Record<
      string,
      {
        moderation_status?: string;
        rejection_reason?: string | null;
        manual_points_adjustment?: number;
        manual_points_reason?: string | null;
        total_points?: number;
        total_eligible_tweets?: number;
        total_likes?: number;
        total_replies?: number;
        total_retweets?: number;
        total_quote_reposts?: number;
        total_impressions?: number;
        current_rank?: number;
        paid_at?: string | null;
        earnings?: number;
        paid_rank?: number | null;
      }
    > = {};
    if (isTwitterCampaign) {
      try {
        const { data: leaderboardData, error: leaderboardError } =
          await supabase
            .from("twitter_campaign_leaderboard")
            .select(
              "creator_id, moderation_status, rejection_reason, manual_points_adjustment, manual_points_reason, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, current_rank, paid_at, earnings, paid_rank",
            )
            .eq("contest_id", contestId);

        if (leaderboardError) {
          console.error(
            `[Admin page.tsx] Error fetching creator leaderboard data:`,
            leaderboardError,
          );
        } else if (leaderboardData) {
          leaderboardData.forEach((entry: any) => {
            if (entry.creator_id) {
              creatorModerationData[entry.creator_id] = {
                moderation_status: entry.moderation_status || "pending",
                rejection_reason: entry.rejection_reason || null,
                manual_points_adjustment: entry.manual_points_adjustment || 0,
                manual_points_reason: entry.manual_points_reason || null,
                total_points: entry.total_points || 0,
                total_eligible_tweets: entry.total_eligible_tweets || 0,
                total_likes: entry.total_likes || 0,
                total_replies: entry.total_replies || 0,
                total_retweets: entry.total_retweets || 0,
                total_quote_reposts: entry.total_quote_reposts || 0,
                total_impressions: entry.total_impressions || 0,
                current_rank: entry.current_rank || null,
                paid_at: entry.paid_at || null,
                earnings: entry.earnings || 0,
                paid_rank: entry.paid_rank || null,
              };
            }
          });
        }
      } catch (err) {
        console.error(
          `[Admin page.tsx] Error fetching creator leaderboard data:`,
          err,
        );
      }
    }

    // Virtualization only needs rows client-side. Skip SSR of up to 1000 enriched
    // rows (slow HTML) — load counts here; client hydrates in 1000-row chunks.
    const submissionCounts = await loadContestDetailSubmissionCounts(
      supabase,
      contestId,
      contestData,
    );
    const allSubmissions: any[] = [];
    const initialSubmissionTotal = submissionCounts.total;
    const submissionsFetchError: string | undefined = undefined;

    console.log(
      `[Admin page.tsx] SSR submissions counts for ${contestId}: 0 seeded / ${initialSubmissionTotal} (client hydrate)`,
    );

    const calculateDurationDays = (
      start: string | null,
      end: string | null,
    ): number | null => {
      if (!start || !end) return null;
      try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } catch (err) {
        console.error("Error calculating duration:", err);
        return null;
      }
    };

    const durationDays = calculateDurationDays(
      contestData.start_date,
      contestData.end_date,
    );

    const contest = {
      id: contestData.id,
      title: contestData.title,
      status: contestData.status,
      moderation_status: contestData.moderation_status,
      post_contest_status: contestData.post_contest_status,
      thumbnail_url: contestData.thumbnail_url,
      brief_html: contestData.brief_html,
      platform: contestData.platform,
      start_date: contestData.start_date,
      end_date: contestData.end_date,
      rules_html: contestData.rules_html,
      inspiration_links: finalInspirationLinks,
      resources: contestData.resources,
      contest_type: contestData.contest_type,
      contest_based_details: contestData.contest_based_details,
      last_metrics_updated: contestData.last_metrics_updated,
      post_campaign_last_metrics_updated: postCampaignLastMetricsUpdated,
      submitted_for_approval_at: contestData.submitted_for_approval_at,
      approved_at: contestData.approved_at,
      approved_by: contestData.approved_by,
      published_at: contestData.published_at,
      rejection_reason: contestData.rejection_reason,
      multiple_submissions_enabled: contestData.multiple_submissions_enabled,
      max_submissions_per_creator: contestData.max_submissions_per_creator,
      content_type: contestData.content_type,
      bonus_details: contestData.bonus_details,
      max_earnings_per_creator: contestData.max_earnings_per_creator,
      categories: contestData.categories,
      subcategories: contestData.subcategories,
      interests: contestData.interests,
      region: contestData.region,
      contest_format: contestData.contest_format,
      payout_adjustment_percentage: contestSettings.payout_adjustment_percentage,
      payout_adjustment_mode: contestSettings.payout_adjustment_mode,
      trust_score: isVideoContest
        ? (contestSettings.trust_score ?? contestData.trust_score ?? null)
        : null,
      trust_number: isVideoContest
        ? (contestSettings.trust_number ?? contestData.trust_number ?? null)
        : null,
      min_best_quality_score: isVideoContest
        ? (contestSettings.min_best_quality_score ??
          contestData.min_best_quality_score ??
          null)
        : null,
      min_avg_quality_score: isVideoContest
        ? (contestSettings.min_avg_quality_score ??
          contestData.min_avg_quality_score ??
          null)
        : null,
      min_quality_score: isVideoContest
        ? (contestSettings.min_quality_score ??
          contestData.min_quality_score ??
          null)
        : null,
      min_platform_earnings: isVideoContest
        ? (contestSettings.min_platform_earnings ??
          contestData.min_platform_earnings ??
          null)
        : null,
      min_platform_views: isVideoContest
        ? (contestSettings.min_platform_views ??
          contestData.min_platform_views ??
          null)
        : null,
    };

    let brandProfile: {
      company_name: string | null;
      website_url: string | null;
    } = { company_name: null, website_url: null };
    if (contestData.advertiser_id) {
      const adminDb = createAdminClient();
      const { data: advertiserProfile, error: advertiserProfileError } =
        await adminDb
          .from("advertiser_profiles")
          .select("company_name, website_url")
          .eq("id", contestData.advertiser_id)
          .maybeSingle();
      if (advertiserProfileError) {
        console.warn(
          `[AdminContestDetailPage] Failed to load advertiser profile for contest ${contestId} (advertiser ${contestData.advertiser_id}):`,
          advertiserProfileError.message,
        );
      }
      if (advertiserProfile) {
        brandProfile = advertiserProfile;
      }
      if (!brandProfile.company_name?.trim()) {
        const { data: advertiserUser } = await adminDb
          .from("users")
          .select("full_name, username")
          .eq("id", contestData.advertiser_id)
          .maybeSingle();
        const fallbackName =
          advertiserUser?.full_name?.trim() ||
          advertiserUser?.username?.trim() ||
          null;
        if (fallbackName) {
          brandProfile = { ...brandProfile, company_name: fallbackName };
        }
      }
    }

    return (
      <TooltipProvider>
        <div className="mb-4">
          <a
            href={`/dashboard/admin/affiliate/${contestId}`}
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Settle Affiliate Earnings
          </a>
        </div>
        <ContestDetailClient
          contest={contest}
          initialSubmissions={allSubmissions}
          initialSubmissionTotal={initialSubmissionTotal}
          initialSubmissionCounts={submissionCounts}
          initialPostCampaignMetricsCount={initialPostCampaignMetricsCount}
          durationDays={durationDays}
          contestId={contestId}
          isAdminView={true}
          creatorModerationData={creatorModerationData}
          milestoneBonusPaidByCreator={milestoneBonusPaidByCreator}
          submissionsFetchError={submissionsFetchError}
          brandProfile={brandProfile}
        />
      </TooltipProvider>
    );
  } catch (err) {
    console.error("Error in admin contest detail page:", err);
    redirect("/dashboard/admin/contests");
  }
}
