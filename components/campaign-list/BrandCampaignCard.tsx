"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CampaignAccessInfo } from "@/components/campaign-access/CampaignAccessInfo";
import { ContestRequirementBadges } from "@/components/ContestRequirementBadges";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { getEndedOpportunityPhaseLabel } from "@/lib/contest-ended-phase-display";
import { getPoolBudgetSpentCentsForDisplay } from "@/lib/contest-budget-tile-metrics";
import {
  formatCompactCount,
  getAdminApprovalPercent,
  getAdminSubmissionTotal,
  getMultipleSubmissionsBadgeLabel,
} from "@/lib/contest-list-card-metrics";
import { isCpmContestType } from "@/lib/contest-type";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { cn, formatLocalDateTime } from "@/lib/utils";
import {
  formatContestListCpmRatesText,
  formatContestPlatformLabel,
  resolveBonusDetails,
  resolveContestPlatformCpmRates,
  resolveContestPoolBudgetCents,
  resolveFlatFeeBonusListDisplay,
  resolveLeaderboardFlatFeeBonusBudgetCents,
} from "@/lib/video-platform-campaigns";
import {
  ContestListIcon,
  type ContestListIconName,
} from "./contest-list-icons";

type ContestDetails = {
  leaderboard_contest?: {
    total_prize?: number;
    flat_fee_bonus?: number;
  };
  cpm_contest?: {
    cpm_rate_usd?: number;
  };
  milestone_contest?: {
    total_budget_cents?: number;
    budget_spent?: number;
    milestones?: unknown;
  };
  twitter_campaign?: {
    campaign_type?: "raid" | "awareness" | string;
  };
} | null;

export type BrandCampaignListContest = {
  id: string;
  title: string | null;
  access_mode?: string | null;
  access_list_skips_requirements?: boolean | null;
  applications_open?: boolean | null;
  pending_applications?: number | null;
  platform: string | null;
  contest_type: string | null;
  created_at: string;
  moderation_status: string;
  status: string | null;
  post_contest_status: string | null;
  start_date: string | null;
  end_date: string | null;
  live_submission_count?: number | null;
  contest_based_details: ContestDetails;
  thumbnail_url: string | null;
  verified_submission_count?: number | null;
  pending_submission_count?: number | null;
  rejected_submission_count?: number | null;
  not_rejected_views?: number | null;
  last_metrics_updated?: string | null;
  submitted_for_approval_at?: string | null;
  published_at?: string | null;
  rejection_reason?: string | null;
  multiple_submissions_enabled?: boolean;
  max_submissions_per_creator?: number;
  content_type?: string;
  bonus_details?: unknown;
  contest_format?: string | null;
  trust_score?: number | null;
  trust_number?: number | null;
  min_avg_quality_score?: number | null;
  min_best_quality_score?: number | null;
  min_quality_score?: number | null;
  min_platform_earnings?: number | null;
  min_platform_views?: number | null;
  twitter_participants_count?: number | null;
  twitter_max_participants?: number | null;
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function contestTypeLabel(contestType: string | null | undefined) {
  if (contestType === "cpm") return "CPM Based";
  if (contestType === "leaderboard") return "Leaderboard";
  if (contestType === "milestone") return "Milestone";
  if (contestType === "dual_rewards") return "Dual Rewards";
  if (!contestType) return "Campaign";
  return contestType.charAt(0).toUpperCase() + contestType.slice(1);
}

function isTwitterLike(platform?: string | null) {
  const lower = platform?.toLowerCase() ?? "";
  return lower === "twitter" || lower === "x" || lower.includes("twitter");
}

function platformIconName(platform: string): ContestListIconName {
  const lower = platform.toLowerCase();
  if (lower.includes("youtube")) return "youtube";
  if (lower.includes("instagram")) return "instagram";
  if (lower.includes("tiktok")) return "tiktok";
  if (lower.includes("twitter") || lower === "x" || lower.includes("x.com")) {
    return "x";
  }
  return "globe";
}

function platformTokens(platform: string | null | undefined): string[] {
  const raw = (platform ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/[,+/|&]+|\band\b/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function poolBudgetCents(contest: BrandCampaignListContest) {
  return resolveContestPoolBudgetCents(
    contest.contest_type,
    contest.contest_based_details,
    contest.platform,
  );
}

function bonusBudgetCents(contest: BrandCampaignListContest) {
  if (contest.contest_type !== "leaderboard") return 0;
  return resolveLeaderboardFlatFeeBonusBudgetCents(
    contest.contest_based_details as unknown as Record<string, unknown> | null,
    contest.platform,
  );
}

function spentCents(contest: BrandCampaignListContest) {
  return getPoolBudgetSpentCentsForDisplay({
    contest_type: contest.contest_type,
    post_contest_status: contest.post_contest_status,
    contest_based_details: contest.contest_based_details,
    platform: contest.platform,
  });
}

function cpmRateValue(contest: BrandCampaignListContest): string | null {
  if (!isCpmContestType(contest.contest_type)) return null;
  if (isTwitterLike(contest.platform)) {
    const rate = contest.contest_based_details?.cpm_contest?.cpm_rate_usd;
    if (rate == null) return null;
    return `${formatMoney(rate * 100)} / 1k`;
  }
  const rates = resolveContestPlatformCpmRates(
    contest.contest_based_details as Record<string, unknown> | null | undefined,
    contest.platform,
  );
  return formatContestListCpmRatesText(rates, formatMoney) || null;
}

function primaryBudgetText(contest: BrandCampaignListContest) {
  if (contest.contest_type === "leaderboard") {
    return formatMoney(
      contest.contest_based_details?.leaderboard_contest?.total_prize || 0,
    );
  }
  return formatMoney(poolBudgetCents(contest));
}

function statusChip(contest: BrandCampaignListContest): {
  label: string;
  dot: ContestListIconName;
  text: string;
} {
  if (contest.moderation_status === "published") {
    if (contest.status === "active") {
      return { label: "Live", dot: "dot-live", text: "text-[#059669]" };
    }
    if (contest.status === "upcoming") {
      return { label: "Upcoming", dot: "dot-review", text: "text-[#0284c7]" };
    }
    if (contest.status === "ended") {
      const label = getEndedOpportunityPhaseLabel(contest.post_contest_status);
      if (label === "In review") {
        return { label, dot: "dot-review", text: "text-[#0284c7]" };
      }
      if (label === "Paid") {
        return { label, dot: "dot-live", text: "text-[#059669]" };
      }
      return { label, dot: "dot-payments", text: "text-[#b45309]" };
    }
    return {
      label: contest.status || "Published",
      dot: "dot-draft",
      text: "text-[#404040]",
    };
  }
  if (contest.moderation_status === "pending_approval") {
    return {
      label: "Pending approval",
      dot: "dot-payments",
      text: "text-[#b45309]",
    };
  }
  if (contest.moderation_status === "approved") {
    return { label: "Ready", dot: "dot-live", text: "text-[#059669]" };
  }
  if (contest.moderation_status === "rejected") {
    return { label: "Rejected", dot: "dot-payments", text: "text-[#b45309]" };
  }
  return { label: "Draft", dot: "dot-draft", text: "text-[#404040]" };
}

function FactCell({
  label,
  icon,
  children,
  isDark,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex shrink-0 items-center gap-1.5">
        {icon}
        <p
          className={cn(
            "text-[10px] font-semibold tracking-[0.6px]",
            isDark ? "text-neutral-400" : "text-[#737373]",
          )}
        >
          {label}
        </p>
      </div>
      <div
        className={cn(
          "min-w-0 text-right text-[13px] font-semibold",
          isDark ? "text-white" : "text-[#0a0a0a]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function BrandCampaignCard({
  contest,
  isDark,
  layout = "grid",
  detailHref,
  navigating,
  onDetailClick,
  onDuplicate,
  canPublish,
  editLoading,
  editDatesLoading,
  onEdit,
  onEditDates,
  onPublish,
}: {
  contest: BrandCampaignListContest;
  isDark: boolean;
  layout?: "grid" | "list";
  detailHref: string;
  navigating: boolean;
  onDetailClick: (event: React.MouseEvent) => void;
  onDuplicate: () => void;
  canPublish: boolean;
  editLoading: boolean;
  editDatesLoading: boolean;
  onEdit: () => void;
  onEditDates: () => void;
  onPublish: () => void;
}) {
  const published = contest.moderation_status === "published";
  const platforms = platformTokens(contest.platform);
  const chip = statusChip(contest);
  const verified = contest.verified_submission_count ?? 0;
  const pending = contest.pending_submission_count ?? 0;
  const twitterTextImage =
    isTwitterLike(contest.platform) && contest.contest_format === "text_image";
  const twitterKind =
    contest.contest_based_details?.twitter_campaign?.campaign_type;
  const eyebrowSecondary = twitterTextImage
    ? twitterKind
      ? twitterKind.toUpperCase()
      : null
    : contest.content_type
      ? contest.content_type.toUpperCase()
      : null;
  const restricted =
    contest.access_mode === "restricted" || contest.access_mode === "private";
  const cpmValue = cpmRateValue(contest);
  const cpmLabel = isTwitterLike(contest.platform) ? "POINTS RATE" : "CPM RATE";
  const prize = contest.contest_based_details?.leaderboard_contest?.total_prize;
  const bonus = bonusBudgetCents(contest);
  const pool = poolBudgetCents(contest);
  const trackerTotal =
    contest.contest_type === "leaderboard"
      ? bonus
      : isCpmContestType(contest.contest_type) ||
          contest.contest_type === "milestone"
        ? pool
        : 0;
  const tracker =
    trackerTotal > 0
      ? (() => {
          const spent = Math.max(0, spentCents(contest));
          const percentage = (spent / trackerTotal) * 100;
          return {
            spent,
            percentage,
            remaining: Math.max(trackerTotal - spent, 0),
          };
        })()
      : null;
  const approval = getAdminApprovalPercent(contest);
  const views = contest.not_rejected_views ?? 0;
  const submissions = getAdminSubmissionTotal(contest);
  const flatFee = resolveFlatFeeBonusListDisplay(
    contest.contest_based_details &&
      typeof contest.contest_based_details === "object"
      ? (contest.contest_based_details as Record<string, unknown>)
      : null,
    contest.platform,
    contest.contest_type,
  );
  const datesSet = Boolean(contest.start_date && contest.end_date);
  const dateLabel = (value: string) => formatLocalDateTime(value, DATE_FORMAT);

  const thirdFacts: Array<{ label: string; value: string }> = [];
  if (contest.contest_type === "leaderboard") {
    if (prize != null && prize > 0) {
      thirdFacts.push({ label: "PRIZE POOL", value: formatMoney(prize) });
    }
    if (bonus > 0) {
      thirdFacts.push({ label: "BONUS BUDGET", value: formatMoney(bonus) });
    }
  } else if (contest.contest_type === "milestone") {
    if (pool > 0) {
      thirdFacts.push({ label: "TOTAL BUDGET", value: formatMoney(pool) });
    }
  } else if (isCpmContestType(contest.contest_type)) {
    if (pool > 0) {
      thirdFacts.push({ label: "TOTAL BUDGET", value: formatMoney(pool) });
    }
    if (cpmValue) thirdFacts.push({ label: cpmLabel, value: cpmValue });
  }

  const actionClass = cn(
    "pointer-events-auto relative z-[2] inline-flex items-center justify-center gap-2 rounded-full px-3.5 py-2.5 text-[13px] font-semibold text-white",
    isDark ? "bg-white text-[#0a0a0a]" : "bg-[#0a0a0a]",
  );
  const outlineClass = cn(
    "pointer-events-auto relative z-[2] inline-flex items-center justify-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold shadow-[0px_1px_1px_rgba(10,10,10,0.04)]",
    isDark
      ? "border-white/15 bg-transparent text-white"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
  );

  return (
    <article
      className={cn(
        "relative flex h-full overflow-hidden rounded-2xl border shadow-[0px_1px_3px_rgba(10,10,10,0.04)]",
        layout === "list" ? "flex-row" : "flex-col",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#e5e5e5] bg-white",
      )}
    >
      <Link
        href={detailHref}
        prefetch={false}
        className="absolute inset-0 z-[1]"
        aria-label={`View ${contest.title || "campaign"} details`}
        onClick={onDetailClick}
      />
      <div
        className={cn(
          "pointer-events-none relative shrink-0 overflow-hidden",
          layout === "list"
            ? cn(
                "flex h-full min-h-[160px] w-[280px] items-center justify-center self-stretch",
                isDark ? "bg-white/5" : "bg-[#f5f5f5]",
              )
            : "aspect-[16/10] w-full",
          contest.thumbnail_url ? "" : isDark ? "bg-white/5" : "bg-[#f5f5f5]",
        )}
      >
        {contest.thumbnail_url ? (
          <img
            src={contest.thumbnail_url}
            alt={contest.title || "Campaign thumbnail"}
            className={
              layout === "list"
                ? "h-full w-full object-contain"
                : "absolute inset-0 h-full w-full object-cover"
            }
          />
        ) : (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-1.5",
              layout === "list" ? "h-full w-full" : "absolute inset-0",
            )}
          >
            <ContestListIcon name="image" alt="" />
            <p
              className={cn(
                "text-xs font-medium",
                isDark ? "text-neutral-400" : "text-[#737373]",
              )}
            >
              No Image
            </p>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          {restricted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-[3px] text-xs font-semibold text-[#0a0a0a]">
              <ContestListIcon name="shield" alt="" />
              {contest.access_mode === "private" ? "Private" : "Restricted"}
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-[3px]">
            <ContestListIcon name={chip.dot} alt="" />
            <span className={cn("text-xs font-semibold", chip.text)}>
              {chip.label}
            </span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none relative z-[2] flex min-w-0 flex-1 flex-col",
          layout === "list" ? "gap-2 px-3 py-2.5" : "gap-3.5 p-4",
        )}
      >
        <h3
          className={cn(
            "font-bold leading-tight",
            published
              ? "text-[17px] leading-[1.25] tracking-[-0.17px]"
              : "line-clamp-2 text-lg",
            isDark ? "text-white" : published ? "text-[#0a0a0a]" : "text-[#0f172a]",
          )}
        >
          {contest.title || "Untitled Campaign"}
        </h3>

        {published ? (
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {eyebrowSecondary ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.4px]",
                  isDark
                    ? "border-white/15 bg-white/10 text-neutral-200"
                    : "border-[#e5e5e5] bg-[#f5f5f5] text-[#404040]",
                )}
              >
                {eyebrowSecondary}
              </span>
            ) : null}
            {resolveBonusDetails(contest)?.description_html ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.4px]",
                  isDark
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                    : "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
                )}
              >
                BONUS
              </span>
            ) : null}
            <ContestRequirementBadges contest={contest} isDark={isDark} size="compact" />
            {!twitterTextImage && contest.multiple_submissions_enabled ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-px text-[10px] font-semibold",
                  isDark ? "bg-white/10 text-white" : "bg-[#f5f5f5] text-[#404040]",
                )}
              >
                {getMultipleSubmissionsBadgeLabel(contest)}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#404040] dark:text-neutral-300">
              <span className="size-2 rounded-full bg-[#059669]" />
              Verified {verified}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#404040] dark:text-neutral-300">
              <span className="size-2 rounded-full bg-[#b45309]" />
              Pending {pending}
            </span>
            {layout === "list" ? (
              <CampaignAccessInfo
                accessMode={contest.access_mode}
                applicationsOpen={contest.applications_open ?? null}
                pendingCount={null}
                skipsRequirements={contest.access_list_skips_requirements}
                isDark={isDark}
              />
            ) : null}
          </div>
        ) : (
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-[#1a1a1a] px-2.5 py-1 text-sm text-white dark:bg-white dark:text-[#1a1a1a]">
              {formatContestPlatformLabel(contest.platform)}
            </span>
            <span className="inline-flex items-center rounded-md bg-[#1a1a1a] px-2.5 py-1 text-sm capitalize text-white dark:bg-white dark:text-[#1a1a1a]">
              {contestTypeLabel(contest.contest_type)}
            </span>
            <ContestRequirementBadges contest={contest} isDark={isDark} size="compact" />
          </div>
        )}

        {published && layout !== "list" ? (
          <div className="pointer-events-auto">
            <CampaignAccessInfo
              accessMode={contest.access_mode}
              applicationsOpen={contest.applications_open ?? null}
              pendingCount={null}
              skipsRequirements={contest.access_list_skips_requirements}
              isDark={isDark}
            />
          </div>
        ) : null}

        {published ? (
          <div className={cn("flex flex-col", layout === "list" ? "gap-1.5" : "gap-2")}>
            <div
              className={cn(
                "rounded-[10px] border",
                layout === "list"
                  ? "grid grid-cols-2 gap-x-6 gap-y-1.5 px-2.5 py-2"
                  : "flex flex-col gap-3 px-3 py-3",
                isDark ? "border-white/10" : "border-[#e5e5e5]",
              )}
            >
              <FactCell
                label="PLATFORM"
                isDark={isDark}
                icon={
                  <span className="inline-flex items-center gap-1">
                    {(platforms.length > 0 ? platforms : ["Unknown"]).map(
                      (platform) => (
                        <ContestListIcon
                          key={platform}
                          name={platformIconName(platform)}
                          alt=""
                        />
                      ),
                    )}
                  </span>
                }
              >
                {(platforms.length > 0 ? platforms : ["Unknown"])
                  .map((platform) => formatContestPlatformLabel(platform))
                  .join("  ")}
              </FactCell>
              <FactCell
                label="CAMPAIGN TYPE"
                icon={<ContestListIcon name="layers" alt="" />}
                isDark={isDark}
              >
                {contestTypeLabel(contest.contest_type)}
              </FactCell>
              <FactCell
                label="STARTS"
                icon={<ContestListIcon name="clock" alt="" />}
                isDark={isDark}
              >
                {contest.start_date ? dateLabel(contest.start_date) : "Not set"}
              </FactCell>
              <FactCell
                label="ENDS"
                icon={<ContestListIcon name="clock" alt="" />}
                isDark={isDark}
              >
                {contest.end_date ? dateLabel(contest.end_date) : "Not set"}
              </FactCell>
              {thirdFacts.map((fact) => (
                <FactCell
                  key={fact.label}
                  label={fact.label}
                  icon={<ContestListIcon name="dollar" alt="" />}
                  isDark={isDark}
                >
                  {fact.value}
                </FactCell>
              ))}
              {twitterTextImage ? (
                <FactCell label="PARTICIPANTS" isDark={isDark}>
                  {contest.twitter_max_participants
                    ? `${contest.twitter_participants_count ?? 0} / ${contest.twitter_max_participants}`
                    : String(contest.twitter_participants_count ?? 0)}
                </FactCell>
              ) : null}
            </div>
            {flatFee ? (
              <p
                className={cn(
                  "text-xs font-medium",
                  isDark ? "text-emerald-300" : "text-[#059669]",
                )}
              >
                Flat fee bonus:{" "}
                {flatFee.kind === "shared"
                  ? `${formatMoney(flatFee.amountCents)} / submission`
                  : `${flatFee.rows
                      .map((row) => formatMoney(row.amountCents))
                      .join(" · ")} / submission`}
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="flex flex-grow flex-col gap-2 text-base"
            style={{ color: isDark ? "white" : "#475569" }}
          >
            {datesSet ? (
              <div className="flex items-center gap-1">
                <ContestListIcon name="clock" alt="" />
                <span>
                  {formatLocalDateTime(contest.start_date)} -{" "}
                  {formatLocalDateTime(contest.end_date)}
                </span>
              </div>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-1",
                  isDark ? "text-amber-400" : "text-amber-600",
                )}
              >
                <ContestListIcon name="alert" alt="" />
                <span>Dates not set</span>
              </div>
            )}
            {contest.submitted_for_approval_at ? (
              <div className="flex items-center gap-1">
                <ContestListIcon name="clock" alt="" />
                <span>
                  Submitted:{" "}
                  <span className="font-medium">
                    {dateLabel(contest.submitted_for_approval_at)}
                  </span>
                </span>
              </div>
            ) : null}
            {contest.published_at ? (
              <div className="flex items-center gap-1">
                <ContestListIcon name="clock" alt="" />
                <span>
                  Published:{" "}
                  <span className="font-medium">
                    {dateLabel(contest.published_at)}
                  </span>
                </span>
              </div>
            ) : null}
            {contest.contest_based_details ? (
              <div className="flex items-center gap-1">
                <ContestListIcon name="dollar" alt="" />
                <span>
                  {contest.contest_type === "leaderboard" ? "Prize" : "Budget"}:{" "}
                  {primaryBudgetText(contest)}
                </span>
              </div>
            ) : null}
            {contest.moderation_status === "rejected" &&
            contest.rejection_reason ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {contest.rejection_reason}
              </p>
            ) : null}
          </div>
        )}

        {published && tracker ? (
          <div
            className={cn(
              "flex flex-col rounded-[10px] border",
              layout === "list" ? "gap-1 px-2.5 py-2" : "gap-2 px-3 py-3",
              isDark ? "border-white/10" : "border-[#e5e5e5]",
            )}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span
                className={cn(
                  "font-medium",
                  isDark ? "text-neutral-200" : "text-[#404040]",
                )}
              >
                Budget Tracker
              </span>
              <span className="shrink-0">
                <span
                  className={cn(
                    "font-bold",
                    isDark ? "text-white" : "text-[#0a0a0a]",
                  )}
                >
                  {formatMoney(tracker.spent)}
                </span>
                <span
                  className={isDark ? "text-neutral-400" : "text-[#737373]"}
                >
                  {" "}
                  / {formatMoney(trackerTotal)}
                </span>
              </span>
            </div>
            <div
              className={cn(
                "h-2.5 w-full overflow-hidden rounded-full",
                isDark ? "bg-white/15" : "bg-[#e5e5e5]",
              )}
            >
              <div
                className={cn(
                  "h-2.5 rounded-full",
                  isDark ? "bg-white" : "bg-[#404040]",
                )}
                style={{
                  width: `${Math.min(Math.max(tracker.percentage, 0), 100)}%`,
                }}
              />
            </div>
            <div
              className={cn(
                "flex items-center justify-between text-sm font-medium",
                isDark ? "text-neutral-300" : "text-[#737373]",
              )}
            >
              <span>{tracker.percentage.toFixed(1)}% used</span>
              <span>{formatMoney(tracker.remaining)} remaining</span>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-auto",
            layout === "list"
              ? "flex flex-row items-center gap-2"
              : "flex flex-col gap-3.5",
          )}
        >
          {published ? (
            <div
              className={cn(
                "flex items-center rounded-xl border px-1.5",
                layout === "list" ? "py-1.5" : "py-2.5",
                layout === "list" && "min-w-0 flex-1",
                isDark
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-[#e5e5e5] bg-[#fafafa]",
              )}
            >
              {[
                ["APPROVAL", `${approval}%`],
                ["VIEWS", formatCompactCount(views)],
                ["SUBMISSIONS", submissions.toLocaleString()],
              ].map(([label, value], index) => (
                <div key={label} className="flex min-w-0 flex-1 items-center">
                  {index > 0 ? (
                    <span
                      className={cn(
                        "h-7 w-px shrink-0",
                        isDark ? "bg-white/10" : "bg-[#e5e5e5]",
                      )}
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                    <span className="text-[10px] font-semibold tracking-[0.8px] text-[#737373]">
                      {label}
                    </span>
                    <span
                      className={cn(
                        "text-base font-extrabold tracking-[-0.16px]",
                        isDark ? "text-white" : "text-[#0a0a0a]",
                      )}
                    >
                      {value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div
            className={cn(
              "flex items-center gap-2",
              layout === "list" ? "shrink-0" : "flex-wrap",
            )}
          >
            {published ? (
              <Link
                href={detailHref}
                prefetch={false}
                onClick={(event) => {
                  event.stopPropagation();
                  onDetailClick(event);
                }}
                className={cn(
                  actionClass,
                  layout === "list" ? "shrink-0" : "min-w-0 flex-1",
                )}
              >
                {navigating ? (
                  <ButtonLoadingSpinner />
                ) : (
                  <ContestListIcon name="eye" alt="" />
                )}
                View Details
              </Link>
            ) : canPublish ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPublish();
                  }}
                  className={cn(
                    actionClass,
                    layout === "list" ? "shrink-0" : "min-w-0 flex-1",
                  )}
                >
                  <ContestListIcon name="play" alt="" />
                  Publish
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditDates();
                  }}
                  disabled={editDatesLoading}
                  className={outlineClass}
                >
                  {editDatesLoading ? (
                    <ButtonLoadingSpinner />
                  ) : (
                    <ContestListIcon name="clock" alt="" />
                  )}
                  Edit Dates
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                disabled={editLoading}
                className={cn(
                  actionClass,
                  layout === "list" ? "shrink-0" : "min-w-0 flex-1",
                )}
              >
                {editLoading ? (
                  <ButtonLoadingSpinner />
                ) : (
                  <ContestListIcon name="edit" alt="" />
                )}
                Edit Campaign
              </button>
            )}
            {!published ? (
              <span
                className="pointer-events-auto relative z-[2]"
                onClick={(event) => event.stopPropagation()}
              >
                <DeleteContestButton
                  contestId={contest.id}
                  contestTitle={contest.title || "this campaign"}
                  isDeletable
                  appearance="card"
                />
              </span>
            ) : null}
            <button
              type="button"
              title="Duplicate"
              aria-label={`Duplicate ${contest.title || "campaign"}`}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onDuplicate();
              }}
              className={cn(
                "pointer-events-auto relative z-[2] inline-flex size-10 shrink-0 items-center justify-center rounded-full border",
                isDark
                  ? "border-white/15 bg-transparent"
                  : "border-[#e5e5e5] bg-white",
              )}
            >
              <ContestListIcon name="copy" alt="" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
