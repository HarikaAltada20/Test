import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { ContestListClient } from "../../contests/ContestListClient";
import { getAllContestsWithCalculatedBudgets } from "@/lib/contest-service";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";

// Define the type for a contest in the admin view
export type AdminContest = {
  id: string;
  title: string | null;
  platform: string | null;
  contest_type: string | null;
  created_at: string;
  moderation_status: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  live_submission_count: number | null;
  total_prize_money_sortable: number | null;
  contest_based_details: {
    leaderboard_contest?: {
      total_prize?: number;
    };
    cpm_contest?: {
      total_budget?: number;
    };
  } | null;
  thumbnail_url: string | null;
  advertiser_name: string; // Added for admin view
  verified_submission_count: number;
  pending_submission_count: number;
  rejected_submission_count: number;
  not_rejected_views: number;
  last_metrics_updated: string | null;
};

export const revalidate = 0;

type SubmissionStatusCounts = {
  verified: number;
  pending: number;
  rejected: number;
};

function applySubmissionStatusCount(
  counts: Map<string, SubmissionStatusCounts>,
  contestId: string | null | undefined,
  rawStatus: string | null | undefined,
) {
  if (!contestId) return;

  const status = (rawStatus || "pending").toLowerCase();
  const entry = counts.get(contestId) || { verified: 0, pending: 0, rejected: 0 };

  if (status === "rejected") {
    entry.rejected += 1;
  } else if (status === "pending") {
    entry.pending += 1;
  } else if (status === "verified" || status === "paid") {
    entry.verified += 1;
  }

  counts.set(contestId, entry);
}

/**
 * Counts verified ('verified' + 'paid') and pending per contest from
 * submissions and Twitter tweets (twitter_campaign_tweets).
 */
async function getSubmissionStatusCountsByContest(): Promise<
  Map<string, SubmissionStatusCounts>
> {
  const counts = new Map<string, SubmissionStatusCounts>();
  const supabaseAdmin = createAdminClient();
  const CHUNK_SIZE = 1000;

  const pageTable = async (
    table: "submissions" | "twitter_campaign_tweets",
    statusColumn: "status" | "moderation_status",
    extraFilter?: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: any,
    ) => any,
  ) => {
    let rangeFrom = 0;

    for (;;) {
      let query = supabaseAdmin
        .from(table)
        .select(`contest_id, ${statusColumn}`)
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (extraFilter) {
        query = extraFilter(query);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          `Failed to load ${table} status counts:`,
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        applySubmissionStatusCount(
          counts,
          row.contest_id,
          row[statusColumn] as string | null | undefined,
        );
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  await Promise.all([
    pageTable("submissions", "status", (query) =>
      query.in("status", ["pending", "verified", "paid"]),
    ),
    pageTable("twitter_campaign_tweets", "moderation_status", (query) =>
      query.is("deleted_at", null),
    ),
  ]);

  return counts;
}

/** Sum submission/tweet views excluding rejected rows, grouped by contest. */
async function getNotRejectedViewsByContest(): Promise<Map<string, number>> {
  const viewsByContest = new Map<string, number>();
  const supabaseAdmin = createAdminClient();
  const CHUNK_SIZE = 1000;

  const addViews = (
    contestId: string | null | undefined,
    rawViews: number | null | undefined,
  ) => {
    if (!contestId) return;
    const views = Number(rawViews) || 0;
    if (views <= 0) return;
    viewsByContest.set(contestId, (viewsByContest.get(contestId) || 0) + views);
  };

  const pageSubmissions = async () => {
    let rangeFrom = 0;

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .select("contest_id, views, status")
        .in("status", ["pending", "verified", "paid"])
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (error) {
        console.error(
          "Failed to load submission views for admin contest cards:",
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        addViews(row.contest_id, row.views);
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  const pageTwitterTweets = async () => {
    let rangeFrom = 0;

    for (;;) {
      const { data, error } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("contest_id, impressions, moderation_status")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (error) {
        console.error(
          "Failed to load Twitter tweet views for admin contest cards:",
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        const status = (row.moderation_status || "pending").toLowerCase();
        if (status === "rejected") continue;
        addViews(row.contest_id, row.impressions);
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  await Promise.all([pageSubmissions(), pageTwitterTweets()]);

  return viewsByContest;
}

export default async function AdminContestsPage() {
  // Verify admin access
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin contests:", error);
    redirect("/dashboard");
  }

  const supabase = await createClient();

  try {
    // Admin users see all contests from all brands with calculated budgets
    const [contestsWithCalculatedBudgets, submissionStatusCounts, notRejectedViews] =
      await Promise.all([
        getAllContestsWithCalculatedBudgets(supabase),
        getSubmissionStatusCountsByContest(),
        getNotRejectedViewsByContest(),
      ]);

    const typedContests = (contestsWithCalculatedBudgets || []).map(
      (contest) => {
        const statusCounts = submissionStatusCounts.get(contest.id);
        return {
          ...contest,
          advertiser_name:
            (contest.advertiser_profiles as any)?.company_name ||
            "Unknown Brand",
          verified_submission_count: statusCounts?.verified ?? 0,
          pending_submission_count: statusCounts?.pending ?? 0,
          rejected_submission_count: statusCounts?.rejected ?? 0,
          not_rejected_views: notRejectedViews.get(contest.id) ?? 0,
          last_metrics_updated: contest.last_metrics_updated ?? null,
        };
      }
    ) as any[];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              All Campaigns (Admin)
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Admin view - showing all campaigns from all brands on the platform
            </p>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] w-full items-center justify-center py-16">
              <PageLoadingSpinner mode="light" />
            </div>
          }
        >
          <ContestListClient
            initialContests={typedContests}
            isAdminView={true}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Error fetching admin contests:", error);
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error loading contests</p>
      </div>
    );
  }
}
