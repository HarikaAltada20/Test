"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCompactCount,
  getAdminApprovalPercent,
  getAdminSubmissionTotal,
  type ContestListMetricsContest,
} from "@/lib/contest-list-card-metrics";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { getPlatformIcon } from "@/lib/platform-icons";
import { formatLocalDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { resolveFlatFeeBonusListDisplay } from "@/lib/video-platform-campaigns";
import { CheckCircle, Gift, Hourglass } from "lucide-react";

type Size = "compact" | "default";

export function ContestListFlatFeeBonusBadge({
  contest,
  isDark = false,
  size = "compact",
}: {
  contest: {
    contest_type?: string | null;
    platform?: string | null;
    contest_based_details?: unknown;
  };
  isDark?: boolean;
  size?: Size;
}) {
  const display = resolveFlatFeeBonusListDisplay(
    contest.contest_based_details &&
      typeof contest.contest_based_details === "object"
      ? (contest.contest_based_details as Record<string, unknown>)
      : null,
    contest.platform,
    contest.contest_type,
  );
  if (!display) return null;

  const sizeClass =
    size === "compact" ? "text-[12px]" : "text-sm px-3 py-1 font-medium";
  const badgeClass = cn(
    sizeClass,
    isDark
      ? "bg-green-900/30 text-green-300 border-green-700/50"
      : "bg-green-50 text-green-700 border-green-200",
  );

  if (display.kind === "shared") {
    return (
      <Badge variant="outline" className={badgeClass}>
        <Gift className="h-3 w-3 mr-1" />
        {formatMoney(display.amountCents)}
        /submission
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={badgeClass}>
      <Gift className="h-3 w-3 mr-1 shrink-0" />
      <span className="inline-flex items-center gap-1.5">
        {display.rows.map((row) => (
          <span
            key={row.platform}
            className="inline-flex items-center gap-0.5"
            title={`${row.platform} bonus`}
          >
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center overflow-hidden [&_div]:!h-3.5 [&_div]:!w-3.5 [&_svg]:!h-3.5 [&_svg]:!w-3.5">
              {getPlatformIcon(row.platform, "sm")}
            </span>
            {formatMoney(row.amountCents)}
          </span>
        ))}
        <span>/submission</span>
      </span>
    </Badge>
  );
}

export function ContestListSubmissionBadges({
  contest,
  isDark = false,
  size = "compact",
}: {
  contest: ContestListMetricsContest;
  isDark?: boolean;
  size?: Size;
}) {
  const sizeClass =
    size === "compact" ? "text-[12px]" : "text-sm px-3 py-1 font-medium";

  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          sizeClass,
          isDark
            ? "bg-green-900/30 text-green-300 border-green-700/50"
            : "bg-green-50 text-green-700 border-green-200",
        )}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified: {contest.verified_submission_count ?? 0}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          sizeClass,
          isDark
            ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
            : "bg-amber-50 text-amber-700 border-amber-200",
        )}
      >
        <Hourglass className="h-3 w-3 mr-1" />
        Pending: {contest.pending_submission_count ?? 0}
      </Badge>
    </>
  );
}

export function ContestListStatsFooter({
  contest,
  isDark = false,
}: {
  contest: ContestListMetricsContest;
  isDark?: boolean;
}) {
  const total = getAdminSubmissionTotal(contest);
  const approval = getAdminApprovalPercent(contest);
  const views = contest.not_rejected_views ?? 0;
  const isEnded = contest.status === "ended";
  const isLive = contest.status === "active";
  const approvalHint = isEnded
    ? "Non-rejected ÷ total submissions"
    : isLive
      ? "Verified + paid ÷ total submissions"
      : "Verified + paid ÷ total submissions (live formula)";

  const labelClass = cn(
    "text-[10px] uppercase tracking-wide font-medium",
    isDark ? "text-slate-400" : "text-slate-500",
  );
  const valueClass = cn(
    "text-sm font-semibold tabular-nums mt-0.5",
    isDark ? "text-white" : "text-slate-900",
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "mt-3 pt-3 border-t",
          isDark ? "border-slate-700" : "border-slate-200",
        )}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <div className={labelClass}>Approval</div>
                <div className={valueClass}>{approval}%</div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">{approvalHint}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <div className={labelClass}>Views</div>
                <div className={valueClass}>{formatCompactCount(views)}</div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {views.toLocaleString()} views (excludes rejected)
            </TooltipContent>
          </Tooltip>
          <div>
            <div className={labelClass}>Submissions</div>
            <div className={valueClass}>{total.toLocaleString()}</div>
          </div>
        </div>
        {contest.last_metrics_updated && (
          <p
            className={cn(
              "text-[10px] text-center mt-2",
              isDark ? "text-slate-500" : "text-slate-400",
            )}
          >
            Metrics updated{" "}
            {formatLocalDateTime(contest.last_metrics_updated, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
