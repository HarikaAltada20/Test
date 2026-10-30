"use client";

import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";

interface BrandDetailedAnalyticsProps {
  userId: string;
  contentType?: "video" | "text_image";
  videoPlatform?: string;
  twitterAnalytics?: boolean;
  contestTypeFilter: string;
  onContestTypeFilterChange?: (value: string) => void;
  activeFilter?: string;
  analyticsQueryString: string;
}

export default function BrandDetailedAnalytics({
  userId,
  contentType = "video",
  videoPlatform = "all",
  twitterAnalytics = false,
  contestTypeFilter,
  onContestTypeFilterChange,
  activeFilter = "all",
  analyticsQueryString,
}: BrandDetailedAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const { isDark } = useAnalyticsDarkMode();

  useEffect(() => {
    fetchAnalyticsData();
  }, [analyticsQueryString]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/analytics/brand-detailed?${analyticsQueryString}`;

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const result = await response.json();
      setAnalyticsData(result);
    } catch (err) {
      console.error("Error fetching brand detailed analytics data:", err);
      setError("Failed to fetch brand detailed analytics data");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !analyticsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#171717]"></div>
      </div>
    );
  }

  if (error || !analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">
          {error || "Failed to load brand detailed analytics"}
        </p>
        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2 h-10 rounded-full bg-[#171717] px-5 text-sm text-white hover:bg-[#171717]/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overview } = analyticsData;

  // Fallback values to prevent errors when data is missing
  const safeOverview = {
    totalQuoteReposts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalContests: 0,
    totalDraftContests: 0,
    totalPendingContests: 0,
    totalApprovedContests: 0,
    totalPublishedContests: 0,
    totalRejectedContests: 0,
    totalActiveContests: 0,
    totalUpcomingContests: 0,
    totalEndedContests: 0,
    totalCompletedContests: 0,
    totalSubmissions: 0,
    verifiedSubmissions: 0,
    pendingSubmissions: 0,
    rejectedSubmissions: 0,
    paidSubmissions: 0,
    totalViews: 0,
    totalVerifiedViews: 0,
    totalPendingViews: 0,
    totalRejectedViews: 0,
    totalPaidViews: 0,
    totalExpectedViews: 0,
    viewsByStatusYoutubeInstagram: {
      expected: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      paid: 0,
      total: 0,
    },
    viewsByStatusTwitter: {
      expected: 0,
      verified: 0,
      pending: 0,
      rejected: 0,
      paid: 0,
      total: 0,
    },
    totalMoneyPaid: 0,
    totalProjectedSpent: 0,
    moneyPaidUnpublished: 0,
    moneyInDraftNotPaid: 0,
    paymentsBreakdown: {
      withCommission: 0,
      withoutCommission: 0,
      commission: 0,
    },
    ...overview,
  };

  const line = isDark ? "border-white/10" : "border-neutral-200";
  const labelTone = isDark ? "text-white" : "text-[#171717]";
  const captionTone = isDark ? "text-slate-200" : "text-[#44403c]";
  const shell = isDark
    ? "overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-white"
    : "overflow-hidden rounded-2xl border border-neutral-200 bg-white text-[#171717]";

  const info = (text: string) => (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={text}
            className={cn("inline-flex shrink-0 outline-none focus-visible:outline-none", captionTone)}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const figure = (
    item: { label: string; value: string; caption?: string; tooltip?: string },
    className?: string,
  ) => (
    <div key={item.label} className={cn("px-5 py-4", line, className)}>
      <p className={cn("flex items-center gap-1.5 text-sm font-medium", labelTone)}>
        <span>{item.label}</span>
        {item.tooltip ? info(item.tooltip) : null}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
      {item.caption ? <p className={cn("mt-1 text-sm", captionTone)}>{item.caption}</p> : null}
    </div>
  );

  const campaignStatus = [
    {
      label: "Draft Campaigns",
      value: String(safeOverview.totalDraftContests),
      caption: "Draft campaigns",
      tooltip: "Campaigns currently in draft (not submitted for approval)",
    },
    {
      label: "Pending Approval",
      value: String(safeOverview.totalPendingContests),
      caption: "Pending approval",
      tooltip: "Campaigns submitted for approval",
    },
    {
      label: "Approved",
      value: String(safeOverview.totalApprovedContests),
      caption: "Approved campaigns",
      tooltip: "Campaigns approved and ready to publish",
    },
    {
      label: "Published",
      value: String(safeOverview.totalPublishedContests),
      caption: "Published campaigns",
      tooltip: 'Campaigns with moderation status set to "published"',
    },
    {
      label: "Active (Live)",
      value: String(safeOverview.totalActiveContests),
      caption: "Currently live",
      tooltip: "Published campaigns currently live",
    },
    {
      label: "Completed",
      value: String(safeOverview.totalCompletedContests),
      caption: "Payouts processed",
      tooltip: "Ended campaigns where payouts are processed (post_contest_status = payouts_processed)",
    },
    {
      label: "Total Rejected",
      value: String(safeOverview.totalRejectedContests),
      caption: "Rejected campaigns",
      tooltip: "Campaigns that were rejected and need changes",
    },
    {
      label: "Upcoming",
      value: String(safeOverview.totalUpcomingContests),
      caption: "Scheduled campaigns",
      tooltip: "Published campaigns with lifecycle status = upcoming",
    },
    {
      label: "Ended",
      value: String(safeOverview.totalEndedContests),
      caption: "Published but ended",
      tooltip: "Published campaigns that have ended but payouts are not yet processed",
    },
  ];

  const submissions = [
    { label: "Verified Submissions", value: safeOverview.verifiedSubmissions.toLocaleString(), caption: "Verified" },
    { label: "Pending Submissions", value: safeOverview.pendingSubmissions.toLocaleString(), caption: "Pending" },
    { label: "Rejected Submissions", value: safeOverview.rejectedSubmissions.toLocaleString(), caption: "Rejected" },
    { label: "Paid Submissions", value: safeOverview.paidSubmissions.toLocaleString(), caption: "Paid" },
    { label: "Total Submissions", value: safeOverview.totalSubmissions.toLocaleString(), caption: "All submissions" },
  ];

  const youtubeViews = safeOverview.viewsByStatusYoutubeInstagram ?? {};
  const twitterViews = safeOverview.viewsByStatusTwitter ?? {};
  const showViews = contentType === "video" || (contentType === "text_image" && twitterAnalytics);
  const views = contentType === "video"
    ? [
        { label: "Expected Views", value: (youtubeViews.expected ?? 0).toLocaleString(), caption: "Pending + Verified + Paid", tooltip: "Pending + Verified + Paid views" },
        { label: "Verified Views", value: (youtubeViews.verified ?? 0).toLocaleString(), caption: "Verified", tooltip: "Views from submissions marked as verified" },
        { label: "Pending Views", value: (youtubeViews.pending ?? 0).toLocaleString(), caption: "Pending", tooltip: "Views from submissions marked as pending" },
        { label: "Rejected Views", value: (youtubeViews.rejected ?? 0).toLocaleString(), caption: "From rejected entries", tooltip: "From rejected  entries" },
        { label: "Paid Views", value: (youtubeViews.paid ?? 0).toLocaleString(), caption: "From paid entries", tooltip: "From paid entries" },
        { label: "Total Views", value: (youtubeViews.total ?? 0).toLocaleString(), caption: "All views", tooltip: "All views across submissions" },
      ]
    : [
        { label: "Expected Views", value: (twitterViews.expected ?? 0).toLocaleString(), caption: "Pending + Verified + Paid", tooltip: "Pending + Verified + Paid views (Twitter)" },
        { label: "Verified Views", value: (twitterViews.verified ?? 0).toLocaleString(), caption: "Verified", tooltip: "Views from Twitter submissions marked as verified" },
        { label: "Pending Views", value: (twitterViews.pending ?? 0).toLocaleString(), caption: "Pending", tooltip: "Views from Twitter submissions marked as pending" },
        { label: "Rejected Views", value: (twitterViews.rejected ?? 0).toLocaleString(), caption: "From rejected entries", tooltip: "From rejected Twitter entries" },
        { label: "Paid Views", value: (twitterViews.paid ?? 0).toLocaleString(), caption: "From paid entries", tooltip: "From paid Twitter entries" },
        { label: "Total Views", value: (twitterViews.total ?? 0).toLocaleString(), caption: "All views", tooltip: "All Twitter views (impressions) across submissions" },
      ];

  const payments = safeOverview.paymentsBreakdown ?? { withCommission: 0, withoutCommission: 0, commission: 0 };
  const moneyGroups = [
    {
      title: "Paid",
      cells: [
        {
          label: "Money Paid (Published)",
          value: formatCurrencyFromCents(safeOverview.totalMoneyPaid),
          caption: "Completed payments for published campaigns",
          tooltip: "Sum of completed payments for campaigns that are published",
        },
        {
          label: "Money Paid (Unpublished)",
          value: formatCurrencyFromCents(safeOverview.moneyPaidUnpublished),
          caption: "Paid but not published",
          tooltip: "Completed payments for campaigns not yet published (draft/approved)",
        },
        {
          label: "Money Paid (Published + Unpublished)",
          value: formatCurrencyFromCents(safeOverview.totalMoneyPaid + safeOverview.moneyPaidUnpublished),
          caption: "All campaigns with completed payment",
          tooltip: "Sum of completed payments across all campaigns (published and unpublished)",
        },
      ],
    },
    {
      title: "Commission",
      cells: [
        {
          label: "Total (Without Commission)",
          value: formatCurrencyFromCents(payments.withoutCommission),
          caption: "Total money paid excluding commission",
          tooltip: "Sum of prize pool / CPM budget only (excludes commission)",
        },
        {
          label: "Total Commission",
          value: formatCurrencyFromCents(payments.commission),
          caption: "Total commission paid",
          tooltip: "Commission collected from completed payments",
        },
        {
          label: "Total (With Commission)",
          value: formatCurrencyFromCents(payments.withCommission),
          caption: "Total money paid including commission",
          tooltip: "Total payments received (includes commission)",
        },
      ],
    },
    {
      title: "Projected",
      cells: [
        {
          label: "Projected (Without Commission)",
          value: formatCurrencyFromCents(safeOverview.totalProjectedSpent),
          caption: "Budgets/prize pools set (paid + not-yet-paid)",
          tooltip: "Projected prize pool / CPM budgets only (excludes commission)",
        },
        {
          label: "Projected (With Commission)",
          value: formatCurrencyFromCents(safeOverview.totalProjectedSpent + (payments.commission || 0)),
          caption: "Includes payments made + budgets set on not-yet-paid campaigns",
          tooltip: "Projected budgets plus estimated commission (based on payment details)",
        },
        {
          label: "Total Money in Draft (Not Paid)",
          value: formatCurrencyFromCents(safeOverview.moneyInDraftNotPaid),
          caption: "Draft campaigns only (unpaid)",
          tooltip: "Budgets/prize pools on campaigns still in draft and not yet paid",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-2xl font-semibold tracking-tight", isDark ? "text-white" : "text-[#171717]")}>
          Brand Analytics
        </h2>
        <p className={cn("mt-1 text-base", captionTone)}>Detailed performance metrics for your campaigns</p>
      </div>

      <section className={shell}>
        <h3 className={cn("border-b px-5 py-4 text-base font-semibold", line)}>Campaign Status Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {campaignStatus.map((item, index) =>
            figure(
              item,
              cn(
                index > 0 && "border-t",
                index % 3 !== 0 && "sm:border-l",
                index < 3 && "sm:border-t-0",
              ),
            ),
          )}
        </div>
      </section>

      <section className={shell}>
        <h3 className={cn("border-b px-5 py-4 text-base font-semibold", line)}>Submissions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
          {submissions.map((item, index) =>
            figure(
              item,
              cn(
                index > 0 && "border-t",
                index % 2 === 1 && "sm:border-l",
                index < 2 && "sm:border-t-0",
                index >= 2 && "sm:border-t",
                index > 0 && "xl:border-l",
                index === 0 && "xl:border-l-0",
                "xl:border-t-0",
                index === submissions.length - 1 && "sm:col-span-2 xl:col-span-1",
              ),
            ),
          )}
        </div>
      </section>

      {showViews && (
        <section className={shell}>
          <h3 className={cn("border-b px-5 py-4 text-base font-semibold", line)}>Views</h3>
          <div className="grid grid-cols-1 md:grid-cols-3">
            {views.map((item, index) =>
              figure(
                item,
                cn(
                  index > 0 && "border-t",
                  index % 3 !== 0 && "md:border-l",
                  index < 3 && "md:border-t-0",
                ),
              ),
            )}
          </div>
        </section>
      )}

      <section className={shell}>
        <h3 className={cn("border-b px-5 py-4 text-base font-semibold", line)}>Financial Breakdown</h3>
        {moneyGroups.map((group) => (
          <div key={group.title}>
            <p className={cn("border-b px-5 py-2.5 text-sm font-semibold", line, isDark ? "bg-white/5 text-white" : "bg-[#F6F6F7] text-[#171717]")}>
              {group.title}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3">
              {group.cells.map((item, index) =>
                figure(item, cn(index > 0 && "border-t", index > 0 && "md:border-l md:border-t-0")),
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
