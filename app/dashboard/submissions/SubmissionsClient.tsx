
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { SubmissionWithContest, CpmContestDetails } from "@/types/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Filter, Video, AlertCircle, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import Image from "next/image";
import React from "react";
import { centsToDollars } from "@/lib/currency-utils";
import { getFullRejectionDetails } from "@/lib/submission-metadata";
import { cn } from "@/lib/utils";

// Map human-readable rejection reason labels to their descriptions (new canonical set only)
const REJECTION_REASON_DESCRIPTIONS: Record<string, string> = {
  "Contest brief or rules not followed":
    "Submission does not follow the contest brief or rules",
  "Terms & Conditions violation":
    "Violates the platform or contest terms and conditions",
  "Inappropriate content":
    "Content contains inappropriate, offensive, or unsuitable material for our platform",
  "Copyright issue":
    "Content may violate copyright, trademark, or intellectual property rights",
  "Technical issues":
    "Content has technical problems, is not accessible, or was deleted",
  "Duplicate content":
    "Content appears to be duplicate or very similar to existing submissions or previous work",
  "Quality standards not met":
    "Content quality does not meet the required standards",
  "Custom Reason":
    "Other reason not listed above - please provide specific details",
};


interface SubmissionsClientProps {
  initialSubmissions: SubmissionWithContest[];
  fetchError?: string;
}

type ContestTypeFilter = "all" | "leaderboard" | "cpm";
type StatusFilter =
  | "all"
  | "active"
  | "pending"
  | "verified"
  | "rejected"
  | "ended"
  | "paid";
type PlatformFilter = "all" | "youtube" | "instagram" | "twitter" | "other";

export default function SubmissionsClient({
  initialSubmissions,
  fetchError,
}: SubmissionsClientProps) {
  const [allSubmissions, setAllSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);
  const [filteredSubmissions, setFilteredSubmissions] =
    useState<SubmissionWithContest[]>(initialSubmissions);

  const [contestTypeFilter, setContestTypeFilter] =
    useState<ContestTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";
  // Helper for dynamic card titles and descriptions
  const filterDisplayInfo: Record<
    StatusFilter,
    { title: string; description: string }
  > = {
    all: {
      title: "All Submissions",
      description: "Showing all your submissions across different statuses.",
    },
    active: {
      title: "Active Submissions",
      description:
        "Submissions for ongoing contests with 'pending' or 'verified' status.",
    },
    pending: {
      title: "Pending Submissions",
      description: "Submissions that are awaiting verification.",
    },
    verified: {
      title: "Verified Submissions",
      description: "Submissions that have been verified by the team.",
    },
    rejected: {
      title: "Rejected Submissions",
      description: "Submissions that have been rejected.",
    },
    ended: {
      title: "Ended Submissions",
      description: "Submissions for contests that have already ended.",
    },
    paid: {
      title: "Paid Submissions",
      description: "Submissions for which earnings have been paid out.",
    },
  };

  useEffect(() => {
    setAllSubmissions(initialSubmissions);
    setFilteredSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  useEffect(() => {
    let submissions = [...allSubmissions];

    // Filter by contest type
    if (contestTypeFilter !== "all") {
      submissions = submissions.filter(
        (sub) => sub.contests?.contest_type === contestTypeFilter
      );
    }

    // Filter by platform
    if (platformFilter !== "all") {
      submissions = submissions.filter(
        (sub) => sub.platform?.toLowerCase() === platformFilter
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      console.log("🔍 Filtering submissions by status:", statusFilter);
      console.log(
        "📊 All submissions before filtering:",
        allSubmissions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          contestType: sub.contests?.contest_type,
          isEnded: sub.contests?.end_date
            ? new Date(sub.contests.end_date) < new Date()
            : false,
          earnings: sub.earnings, // in cents
          earningsInDollars: sub.earnings ? centsToDollars(sub.earnings) : null,
          postContestStatus: sub.contests?.post_contest_status,
        }))
      );

      submissions = submissions.filter((sub) => {
        const contestEndDate = sub.contests?.end_date
          ? new Date(sub.contests.end_date)
          : null;
        const isEnded = contestEndDate ? contestEndDate < new Date() : false;

        let shouldInclude = false;
        switch (statusFilter) {
          case "active":
            shouldInclude =
              !isEnded &&
              (sub.status === "pending" || sub.status === "verified");
            break;
          case "pending":
            shouldInclude = sub.status === "pending";
            break;
          case "verified":
            shouldInclude = sub.status === "verified";
            break;
          case "rejected":
            shouldInclude = sub.status === "rejected";
            break;
          case "ended":
            shouldInclude = isEnded;
            break;
          case "paid":
            // Check if submission should be considered "paid" based on earnings and contest status
            const hasEarnings =
              sub.earnings !== null &&
              sub.earnings !== undefined &&
              sub.earnings > 0;
            const isContestCompleted =
              sub.contests?.post_contest_status === "verification_complete" ||
              sub.contests?.post_contest_status === "payouts_processed";
            const shouldBeConsideredPaid =
              sub.status === "paid" || (hasEarnings && isContestCompleted); // This means even the submission status is not paid and contest is ended and user has earnings show as paid ..

            console.log(`💰 Paid check for ${sub.id}:`, {
              status: sub.status,
              hasEarnings,
              earningsInCents: sub.earnings,
              earningsInDollars: sub.earnings
                ? centsToDollars(sub.earnings)
                : null,
              isContestCompleted,
              postContestStatus: sub.contests?.post_contest_status,
              shouldBeConsideredPaid,
            });

            shouldInclude = shouldBeConsideredPaid;
            break;
          default:
            shouldInclude = true;
        }

        console.log(
          `📋 Submission ${sub.id} (${sub.status}) - isEnded: ${isEnded}, shouldInclude: ${shouldInclude}`
        );
        return shouldInclude;
      });

      console.log(
        "✅ Filtered submissions:",
        submissions.map((sub) => ({
          id: sub.id,
          status: sub.status,
          contestType: sub.contests?.contest_type,
          earnings: sub.earnings ? centsToDollars(sub.earnings) : null,
        }))
      );
    }

    setFilteredSubmissions(submissions);
  }, [allSubmissions, contestTypeFilter, statusFilter, platformFilter]);

  const getStatusBadgeColor = (
    status: SubmissionWithContest["status"] | null,
    contestEndDate?: string | null
  ) => {
    if (contestEndDate && new Date(contestEndDate) < new Date())
      return "bg-gray-500"; // Ended
    if (status === "verified") return "bg-green-500";
    if (status === "pending") return "bg-yellow-500";
    if (status === "rejected") return "bg-red-500";
    if (status === "paid") return "bg-blue-500";
    return "bg-gray-400"; // Default or unknown
  };

  // Helper function to calculate leaderboard earnings
  const calculateLeaderboardEarnings = (
    submission: SubmissionWithContest,
    contest: any
  ) => {
    console.log("🔍 calculateLeaderboardEarnings called with:", {
      submissionId: submission.id,
      submissionStatus: submission.status,
      submissionEarnings: submission.earnings, // This is in cents
      submissionEarningsInDollars: submission.earnings
        ? centsToDollars(submission.earnings)
        : null,
      contestType: contest?.contest_type,
      contestEndDate: contest?.end_date,
      postContestStatus: contest?.post_contest_status,
      hasContestDetails: !!contest?.contest_based_details,
    });

    if (!contest?.contest_based_details) {
      console.log("❌ No contest details found, returning default");
      return { amount: 0, label: "Earnings" };
    }

    try {
      const contestDetails = contest.contest_based_details as any;
      const leaderboardConfig = contestDetails.leaderboard_contest;

      console.log("🔍 Contest details structure:", {
        contestDetails,
        leaderboardConfig,
        hasLeaderboardConfig: !!leaderboardConfig,
        prizes: leaderboardConfig?.prizes,
        totalPrize: leaderboardConfig?.total_prize,
      });

      if (!leaderboardConfig || !leaderboardConfig.prizes) {
        console.log("❌ No leaderboard config or prizes found");
        return { amount: 0, label: "Earnings" };
      }

      const postContestStatus = contest.post_contest_status;
      const isContestCompleted =
        postContestStatus === "verification_complete" ||
        postContestStatus === "payouts_processed";

      console.log("📊 Contest state analysis:", {
        postContestStatus,
        isContestCompleted,
        submissionStatus: submission.status,
        submissionEarnings: submission.earnings, // in cents
        submissionEarningsInDollars: submission.earnings
          ? centsToDollars(submission.earnings)
          : null,
      });

      // For rejected submissions
      if (submission.status === "rejected") {
        console.log("🚫 Submission rejected, returning appropriate message");
        if (isContestCompleted) {
          return { amount: 0, label: "No Prize Won" };
        } else {
          return { amount: 0, label: "Submission Rejected" };
        }
      }

      // For paid submissions
      if (submission.status === "paid") {
        console.log("💰 Submission paid, returning paid amount");
        // Convert cents to dollars for display
        const earningsInDollars = submission.earnings
          ? centsToDollars(submission.earnings)
          : 0;
        return { amount: earningsInDollars, label: "Paid" };
      }

      // For leaderboard contests - simplified logic
      if (contest.contest_type === "leaderboard") {
        console.log("🏆 Processing leaderboard contest logic");

        // If contest is not completed (earnings not calculated yet)
        if (!isContestCompleted) {
          console.log("⏳ Contest not completed yet");
          if (submission.earnings === null) {
            console.log("📋 Earnings is null, showing check leaderboard link");
            return { amount: -1, label: "check_leaderboard" };
          } else {
            console.log("💰 Earnings calculated, showing estimated amount");
            // Convert cents to dollars for display
            const earningsInDollars = centsToDollars(submission.earnings);
            return { amount: earningsInDollars, label: "Estimated Earnings" };
          }
        }

        // If contest is completed (earnings have been calculated)
        console.log("✅ Contest completed, checking final earnings");
        if (submission.earnings === null) {
          console.log(
            "❌ Earnings still null for completed contest, showing no prize won"
          );
          // Shouldn't happen for completed contests, but fallback
          return { amount: 0, label: "No Prize Won" };
        } else if (submission.earnings > 0) {
          console.log("🏆 Winner! Showing final earnings");
          // Convert cents to dollars for display
          const earningsInDollars = centsToDollars(submission.earnings);
          return { amount: earningsInDollars, label: "Final Earnings" };
        } else {
          console.log("😔 No prize won, showing zero earnings");
          return { amount: 0, label: "No Prize Won" };
        }
      }

      // For non-leaderboard contests, use default logic
      console.log("🔄 Using default fallback for non-leaderboard contest");
      // Convert cents to dollars for display
      const earningsInDollars = submission.earnings
        ? centsToDollars(submission.earnings)
        : 0;
      return { amount: earningsInDollars, label: "Earnings" };
    } catch (error) {
      console.warn("❌ Error calculating leaderboard earnings:", error);
      return { amount: 0, label: "Earnings" };
    }
  };

  const getDisplayStatus = (submission: SubmissionWithContest): string => {
    if (!submission.status) return "Unknown"; // Fallback for missing status
    // Capitalize first letter of submission.status for display
    return (
      submission.status.charAt(0).toUpperCase() + submission.status.slice(1)
    );
  };

  const postContestStatusMap: Record<string, string> = {
    pending_review: "Pending Review",
    in_review: "In Review",
    verification_complete: "Verification Complete",
    payouts_processed: "Payouts Processed",
  };

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          Error Fetching Submissions
        </h2>
        <p className="text-muted-foreground text-center">
          There was an issue retrieving your submissions: {fetchError}
        </p>
        <p className="text-muted-foreground text-center mt-2">
          Please try refreshing the page or contact support if the problem
          persists.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold">My Submissions</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button asChild className="w-full text-md py-3 sm:w-auto">
            <Link href="/dashboard/opportunities">Find Opportunities</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-3">
        <Select
          value={contestTypeFilter}
          onValueChange={(value) =>
            setContestTypeFilter(value as ContestTypeFilter)
          }
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="all">All Types of Contests</SelectItem>
            <SelectItem isDark={isDark} value="leaderboard">Leaderboard</SelectItem>
            <SelectItem isDark={isDark} value="cpm">CPM</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as PlatformFilter)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by Platform" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="all">All Platforms</SelectItem>
            <SelectItem isDark={isDark} value="youtube">YouTube</SelectItem>
            <SelectItem isDark={isDark} value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>
        {/* Consider replacing Button with Tabs for status filters for better UX */}
        <button className="w-full sm:w-auto py-2.5 px-4 border rounded-md flex items-center">
          <Filter className="h-4 w-4 mr-2" />
          <span>Filter by Status (Soon)</span>
        </button>
      </div>
      {/* Enhanced Tabs with better visual distinction and responsive design */}
      <Tabs
        defaultValue="all"
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        className="mb-8"
      >
        <TabsList className="flex gap-4">
          <TabsTrigger
            value="all"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="active"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Active
          </TabsTrigger>
          <TabsTrigger
            value="pending"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Pending
          </TabsTrigger>
          <TabsTrigger
            value="verified"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Verified
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Rejected
          </TabsTrigger>
          <TabsTrigger
            value="ended"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Ended
          </TabsTrigger>
          <TabsTrigger
            value="paid"
            className={cn(
              "border text-md",
              isDark ? "text-white border-gray-500" : "text-[#7F39EC] border-[#7F39EC]"
            )}
          >
            Paid
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          <div>
            <div className="py-4 md:px-4">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl md:text-2xl font-bold truncate">
                    {filterDisplayInfo[statusFilter].title}
                  </CardTitle>
                  <p className="mt-1 text-sm md:text-[14px] text-muted-foreground">
                    {filterDisplayInfo[statusFilter].description}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="px-3 py-1 text-sm md:text-md font-medium flex-shrink-0"
                >
                  {filteredSubmissions.length} submission
                  {filteredSubmissions.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
            <CardContent>
              <div className="grid gap-6">
                {filteredSubmissions.map((submission) => {
                  const contest = submission.contests;
                  // Correctly extract the nested cpm_contest object and type it
                  const cpmConfig =
                    contest?.contest_type === "cpm" &&
                      contest.contest_based_details &&
                      typeof contest.contest_based_details === "object" &&
                      contest.contest_based_details !== null &&
                      "cpm_contest" in contest.contest_based_details
                      ? (contest.contest_based_details
                        .cpm_contest as unknown as CpmContestDetails)
                      : null;

                  const displayStatus = getDisplayStatus(submission);
                  const views = submission.views ?? 0;
                  const contestId = submission.contests?.id;
                  const isEnded = contest?.end_date
                    ? new Date(contest.end_date) < new Date()
                    : false;
                  const rejectionDetails =
                    submission.status === "rejected"
                      ? getFullRejectionDetails(submission.metadata)
                      : null;

                  let primaryEarningsDisplay: React.ReactNode | null = null;

                  if (contest?.contest_type === "cpm") {
                    let cpmLabel = "";
                    let cpmAmount: string | number = "0.00";

                    if (submission.status === "paid") {
                      cpmLabel = "Paid";
                      // Convert cents to dollars for display
                      const earningsInDollars = submission.earnings
                        ? centsToDollars(submission.earnings)
                        : 0;
                      cpmAmount = earningsInDollars.toFixed(2);
                    } else if (submission.status === "rejected") {
                      cpmLabel = isEnded ? "Earnings" : "Est. Earnings";
                      cpmAmount = "0.00";
                    } else {
                      // pending or verified
                      let effectiveViews = views;
                      if (
                        cpmConfig?.min_views != null &&
                        views < cpmConfig.min_views
                      ) {
                        effectiveViews = 0;
                      } else if (
                        cpmConfig?.max_views != null &&
                        views > cpmConfig.max_views
                      ) {
                        effectiveViews = cpmConfig.max_views;
                      }
                      const calculatedEarnings =
                        (effectiveViews * (cpmConfig?.cpm_rate_usd || 0)) /
                        1000;
                      cpmAmount = calculatedEarnings.toFixed(2);
                      if (isEnded) {
                        cpmLabel = "Final Earnings";
                      } else {
                        cpmLabel = "Est. Earnings";
                      }
                    }
                    primaryEarningsDisplay = (
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {cpmLabel}:{" "}
                        <span className="text-base">${cpmAmount}</span> USD
                      </p>
                    );
                  } else if (contest?.contest_type === "leaderboard") {
                    // Simplified leaderboard logic using calculateLeaderboardEarnings function
                    console.log("🏆 Processing leaderboard contest:", {
                      submissionId: submission.id,
                      contestId: contestId,
                      isEnded,
                      status: submission.status,
                      hasContestDetails: !!contest?.contest_based_details,
                      contestBasedDetails: contest?.contest_based_details,
                      postContestStatus: contest?.post_contest_status,
                    });

                    // Use the simplified earnings calculation for all cases
                    const earningsData = calculateLeaderboardEarnings(
                      submission,
                      contest
                    );

                    console.log("🎯 Earnings data result:", earningsData);

                    if (earningsData.label === "check_leaderboard") {
                      console.log("🔗 Setting leaderboard link display");
                      primaryEarningsDisplay = (
                        <Link
                          href={`/dashboard/opportunities/${contestId}#leaderboard`}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline mt-0.5 block"
                        >
                          Check your ranking and earnings in the leaderboard.
                        </Link>
                      );
                    } else if (earningsData.label === "No Prize Won") {
                      console.log("❌ Setting no prize won display");
                      primaryEarningsDisplay = (
                        <div className="mt-0.5">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                            No Prize Won:{" "}
                            <span className="text-base">$0.00</span> USD
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                            Keep creating amazing content! 🎬
                          </p>
                        </div>
                      );
                    } else if (earningsData.label === "Submission Rejected") {
                      console.log("🚫 Setting rejected display");
                      primaryEarningsDisplay = (
                        <div className="mt-0.5">
                          <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                            Submission Rejected:{" "}
                            <span className="text-base">$0.00</span> USD
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                            Check contest guidelines for next time.
                          </p>
                        </div>
                      );
                    } else {
                      console.log("💰 Setting earnings display:", earningsData);
                      primaryEarningsDisplay = (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {earningsData.label}:{" "}
                          <span className="text-base">
                            ${earningsData.amount.toFixed(2)}
                          </span>{" "}
                          USD
                        </p>
                      );
                    }
                  }
                  // If contest_type is other than 'cpm' or 'leaderboard', primaryEarningsDisplay remains null.

                  return (
                    <div
                      key={submission.id}

                      className={cn(
                        "rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-shadow",
                        isDark ? "border border-gray-600" : "border border-[#D1B7F9] bg-white "
                      )}
                    >
                      <div className="flex items-center space-x-4 flex-grow">
                        {(() => {
                          const isInstagram =
                            (submission.platform || "").toLowerCase() === "instagram";
                          const isBroken = !!brokenThumbs[submission.id];
                          const hasThumb = !!submission.video_thumbnail_url;
                          const shouldShowIgPoster = isInstagram && (!hasThumb || isBroken);

                          if (shouldShowIgPoster) {
                            return (
                              <Image
                                src="/instagram-poster.svg"
                                alt="Instagram content"
                                width={120}
                                height={90}
                                className="rounded object-cover aspect-video"
                                priority={false}
                              />
                            );
                          }

                          if (hasThumb) {
                            return (
                              <Image
                                src={submission.video_thumbnail_url as string}
                                alt={submission.video_title || "Video thumbnail"}
                                width={120}
                                height={90}
                                className="rounded object-cover aspect-video"
                                onError={() =>
                                  setBrokenThumbs((prev) => ({
                                    ...prev,
                                    [submission.id]: true,
                                  }))
                                }
                              />
                            );
                          }

                          return (
                            <div className="w-[80px] h-[45px] rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                              <Video className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                            </div>
                          );
                        })()}
                        <div className="flex-grow">
                          {contestId ? (
                            <Link
                              href={`/dashboard/opportunities/${contestId}`}
                              className="hover:underline"
                            >
                              <p className={cn(
                                "text-xl font-semibold",
                                isDark ? "text-white" : "text-black"
                              )}>
                                {contest?.title || "Contest Title N/A"}
                              </p>
                            </Link>
                          ) : (
                            <p className={cn(
                              "text-xl font-semibold",
                              isDark ? "text-white" : "text-black"
                            )}>
                              {contest?.title || "Contest Title N/A"}
                            </p>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">
                            <span>
                              Submitted on{" "}
                              {submission.formatted_created_at || "Date N/A"} |{" "}
                            </span>
                            <Badge variant="outline" className="ml-1 text-xs">
                              {submission.platform
                                ? submission.platform.charAt(0).toUpperCase() +
                                submission.platform.slice(1)
                                : "N/A"}
                            </Badge>
                            {contest?.contest_type && (
                              <Badge
                                variant={
                                  contest.contest_type === "cpm"
                                    ? "secondary"
                                    : "default"
                                }
                                className="ml-1 text-xs"
                              >
                                {contest.contest_type.toUpperCase()}
                              </Badge>
                            )}
                            {isEnded &&
                              submission.contests?.post_contest_status &&
                              postContestStatusMap[
                              submission.contests.post_contest_status
                              ] && (
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                  Contest Stage:{" "}
                                  <span className="font-medium">
                                    {
                                      postContestStatusMap[
                                      submission.contests.post_contest_status
                                      ]
                                    }
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                        <div className="text-sm text-left sm:text-right p-3 rounded-md min-w-[200px]">
                          <p className={cn(
                            "font-medium",
                            isDark ? "text-slate-300" : "text-slate-700"
                          )}>
                            {views.toLocaleString()} views
                          </p>

                          {primaryEarningsDisplay}

                          <Badge
                            className={`mt-2 text-xs ${getStatusBadgeColor(
                              submission.status,
                              contest?.end_date
                            )}`}
                          >
                            {displayStatus}
                          </Badge>
                          {submission.status === "rejected" &&
                            rejectionDetails && (
                              <div className="mt-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 mt-0.5" />
                                  <div>
                                    <p className="font-semibold">
                                      Rejection Reason
                                    </p>
                                    <p className="mt-0.5">
                                      {rejectionDetails.reason}
                                    </p>
                                    {!rejectionDetails.additionalNotes && REJECTION_REASON_DESCRIPTIONS[
                                      rejectionDetails.reason
                                    ] && (
                                        <p className="mt-0.5 text-[11px] opacity-90">
                                          {REJECTION_REASON_DESCRIPTIONS[
                                            rejectionDetails.reason
                                          ]}
                                        </p>
                                      )}
                                    {rejectionDetails.additionalNotes && (
                                      <p className="mt-0.5">
                                        Notes:{" "}
                                        {rejectionDetails.additionalNotes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            asChild
                            className="w-full bg-[#4A00BE] text-white px-3 sm:w-auto"
                          >
                            <Link
                              href={submission.content_link || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center justify-center ${!submission.content_link
                                ? "pointer-events-none opacity-50"
                                : ""
                                }`}
                            >
                              <ExternalLink className="h-4 w-4 mr-1.5" /> View
                              Content
                            </Link>
                          </Button>
                          {contestId && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="w-full bg-[#4A00BE] text-white  px-3 sm:w-auto"
                            >
                              <Link
                                href={`/dashboard/opportunities/${contestId}`}
                                className="flex items-center justify-center"
                              >
                                <Info className="h-4 w-4 mr-1.5" /> View Contest
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-medium mb-2">No submissions found</h2>
              <p className="text-muted-foreground mb-4">
                You haven't submitted any content for contests matching the
                current filter criteria.
              </p>
              <Button asChild>
                <Link href="/dashboard/opportunities">
                  Browse Opportunities
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
