"use client";

import { AlertTriangle, Ban, CheckCircle2, XCircle } from "lucide-react";
import type { PostCampaignRefreshRunCounts } from "@/lib/post-campaign-refresh-client";
import { cn } from "@/lib/utils";

export type MetricsRefreshToastPlatform = "youtube" | "instagram" | "tiktok";

export type MetricsRefreshToastPlatformResult = {
  platform: MetricsRefreshToastPlatform;
  status: string;
  run: PostCampaignRefreshRunCounts & {
    error_message?: string | null;
    scope?: string | null;
  };
  /** Live submissions show totals; post-campaign focuses on outcome counts. */
  mode?: "live" | "post_campaign";
  includeReviewed?: boolean;
};

const PLATFORM_LABEL: Record<MetricsRefreshToastPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function CountWithIcon({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  iconClassName: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClassName)} aria-hidden />
      <span>
        {label} {value}
      </span>
    </span>
  );
}

function PlatformRefreshBlock({
  entry,
}: {
  entry: MetricsRefreshToastPlatformResult;
}) {
  const { platform, status, run, mode = "live", includeReviewed } = entry;
  const label = PLATFORM_LABEL[platform];
  const failed = status === "failed" || status === "cancelled";

  if (failed) {
    return (
      <div className="space-y-0.5">
        <div className="font-semibold">{label}</div>
        <p className="text-[0.8125rem] leading-snug opacity-90">
          {run.error_message?.slice(0, 400) ||
            (status === "cancelled"
              ? "Refresh was cancelled."
              : "The refresh run ended with an error.")}
        </p>
      </div>
    );
  }

  const success = run.success_count ?? 0;
  const temporary = run.temporary_failure_count ?? 0;
  const permanent = run.permanent_failure_count ?? 0;
  const skipped = run.skipped_recent_count ?? 0;
  const total = run.total_submissions ?? 0;
  const processed = run.processed_submissions ?? 0;
  const reviewed = run.reviewed_count ?? 0;
  const scope = run.scope;

  return (
    <div className="space-y-1.5">
      <div className="font-semibold">
        {label}
        {mode === "live" && scope ? (
          <span className="font-normal opacity-80"> · Scope: {scope}</span>
        ) : null}
        {mode === "post_campaign" && scope ? (
          <span className="font-normal opacity-80"> · Scope: {scope}</span>
        ) : null}
      </div>
      {mode === "live" ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[0.8125rem] opacity-90">
          <span>Total {total}</span>
          <span aria-hidden>·</span>
          <span>Processed {processed}</span>
          {includeReviewed ? (
            <>
              <span aria-hidden>·</span>
              <span>Reviewed {reviewed}</span>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.8125rem]">
        <CountWithIcon
          icon={CheckCircle2}
          label="Success"
          value={success}
          iconClassName="text-emerald-600 dark:text-emerald-400"
        />
        <CountWithIcon
          icon={AlertTriangle}
          label="Temporary failure"
          value={temporary}
          iconClassName="text-amber-600 dark:text-amber-400"
        />
        <CountWithIcon
          icon={XCircle}
          label="Permanent failure"
          value={permanent}
          iconClassName="text-red-600 dark:text-red-400"
        />
        <CountWithIcon
          icon={Ban}
          label="Skipped"
          value={skipped}
          iconClassName="text-slate-500 dark:text-slate-400"
        />
      </div>
    </div>
  );
}

/**
 * One toast body for single- or multi-platform metrics refresh completion.
 * Differentiates success / temporary failure / permanent failure / skipped with icons.
 */
export function MetricsRefreshToastDescription({
  platforms,
}: {
  platforms: MetricsRefreshToastPlatformResult[];
}) {
  if (platforms.length === 0) {
    return <p>Refresh finished.</p>;
  }

  return (
    <div className="mt-0.5 flex flex-col gap-3">
      {platforms.map((entry) => (
        <PlatformRefreshBlock
          key={`${entry.platform}-${entry.status}`}
          entry={entry}
        />
      ))}
    </div>
  );
}

export function metricsRefreshToastTitleFromResults(
  platforms: MetricsRefreshToastPlatformResult[],
  options?: { prefix?: "Metrics" | "Post-campaign" },
): string {
  const prefix = options?.prefix;
  if (platforms.length === 0) {
    return prefix ? `${prefix} refresh completed` : "Metrics refresh completed";
  }

  const anyFailed = platforms.some(
    (p) => p.status === "failed" || p.status === "cancelled",
  );
  if (platforms.length === 1) {
    const only = platforms[0]!;
    const label = PLATFORM_LABEL[only.platform];
    const head = prefix ? `${prefix} ${label}` : label;
    if (only.status === "failed") return `${head} refresh failed`;
    if (only.status === "cancelled") return `${head} refresh cancelled`;
    return `${head} refresh completed`;
  }

  const multiHead = prefix ? `${prefix} multi-platform` : "Multi-platform";
  if (anyFailed) return `${multiHead} refresh finished with errors`;
  return `${multiHead} refresh completed`;
}

export function metricsRefreshToastVariantFromResults(
  platforms: MetricsRefreshToastPlatformResult[],
): "success" | "destructive" {
  const anyFailed = platforms.some(
    (p) => p.status === "failed" || p.status === "cancelled",
  );
  return anyFailed ? "destructive" : "success";
}

/** Drop completed platforms with nothing to report (no toast noise). */
export function filterMetricsRefreshToastPlatforms(
  platforms: MetricsRefreshToastPlatformResult[],
): MetricsRefreshToastPlatformResult[] {
  return platforms.filter((p) => {
    if (p.status === "failed" || p.status === "cancelled") return true;
    const total = p.run.total_submissions ?? 0;
    if (total > 0) return true;
    if (p.mode === "post_campaign") {
      const outcomes =
        (p.run.success_count ?? 0) +
        (p.run.temporary_failure_count ?? 0) +
        (p.run.permanent_failure_count ?? 0) +
        (p.run.skipped_recent_count ?? 0);
      return outcomes > 0;
    }
    return false;
  });
}
