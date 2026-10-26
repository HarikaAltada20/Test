import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrustScoreMetrics } from "@/lib/trust-score";
import type { CreatorQualityMetrics } from "@/lib/quality-score";
import {
  formatQualityScoreDisplay,
  formatQualitySumDisplay,
  formatTrustScoreDisplay,
} from "@/lib/creator-profile-stats";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

type CreatorStatsCardProps = {
  trustMetrics: TrustScoreMetrics | null;
  qualityMetrics?: CreatorQualityMetrics | null;
  totalEarningsCents?: number;
  totalViews?: number;
  loading?: boolean;
  className?: string;
  isDark?: boolean;
};

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toLocaleString();
}

function Figure({
  label,
  value,
  isDark,
}: {
  label: string;
  value: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="px-5 py-5">
      <p className={cn("text-[28px] font-semibold leading-none tracking-tight", isDark ? "text-white" : "text-[#171717]")}>
        {value}
      </p>
      <p className={cn("mt-2 text-base", isDark ? "text-slate-400" : "text-[#737373]")}>{label}</p>
    </div>
  );
}

function Line({
  label,
  value,
  isDark,
}: {
  label: string;
  value: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={cn("text-base", isDark ? "text-slate-400" : "text-[#737373]")}>{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", isDark ? "text-white" : "text-[#171717]")}>{value}</span>
    </div>
  );
}

export function CreatorStatsCard({
  trustMetrics,
  qualityMetrics,
  totalEarningsCents = 0,
  totalViews = 0,
  loading = false,
  className,
  isDark = false,
}: CreatorStatsCardProps) {
  const trustScore = trustMetrics?.trust_score ?? 100;
  const trustNumber = trustMetrics?.trust_number ?? 0;
  const line = isDark ? "border-white/10" : "border-neutral-200";
  const split = isDark ? "divide-white/10" : "divide-neutral-200";
  const muted = isDark ? "text-slate-400" : "text-[#737373]";
  const ink = isDark ? "text-white" : "text-[#171717]";

  const highlights = [
    { label: "Trust %", value: formatTrustScoreDisplay(trustScore) },
    { label: "Trust score", value: trustNumber > 0 ? `+${trustNumber}` : trustNumber },
    { label: "Total earnings", value: formatCurrencyFromCents(totalEarningsCents) },
    { label: "Verified views", value: formatViews(totalViews) },
  ];

  return (
    <Card className={cn("overflow-hidden rounded-2xl shadow-none", isDark ? "border-slate-700 bg-[#180438]" : "border-neutral-200 bg-white", className)}>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-5 pb-4 pt-5">
          <h3 className={cn("text-base font-semibold", ink)}>Creator stats</h3>
          <p className={cn("text-base", muted)}>Brands can set minimums on these to join a campaign.</p>
        </div>

        {loading ? (
          <div className="space-y-3 px-5 pb-5">
            <div className="h-20 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : (
          <>
            <div className={cn("grid grid-cols-2 border-t sm:grid-cols-4", line)}>
              {highlights.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    "border-b",
                    line,
                    index % 2 === 1 && "border-l",
                    index > 0 && "sm:border-l",
                  )}
                >
                  <Figure label={item.label} value={item.value} isDark={isDark} />
                </div>
              ))}
            </div>

            <div className={cn("grid sm:grid-cols-2 sm:divide-x", split)}>
              <div className="px-5 py-4">
                <p className={cn("text-base font-semibold", ink)}>Quality</p>
                <div className="mt-1">
                  <Line label="Best" value={formatQualityScoreDisplay(qualityMetrics?.best_quality_score)} isDark={isDark} />
                  <Line label="Average" value={formatQualityScoreDisplay(qualityMetrics?.avg_quality_score)} isDark={isDark} />
                  <Line label="Total score" value={formatQualitySumDisplay(qualityMetrics?.quality_score_sum)} isDark={isDark} />
                </div>
              </div>
              <div className={cn("border-t px-5 py-4 sm:border-t-0", line)}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className={cn("text-base font-semibold", ink)}>Submissions</p>
                  <p className={cn("text-base", muted)}>
                    {(trustMetrics?.total_reels ?? 0) > 0
                      ? `${trustMetrics?.total_reels ?? 0} submitted`
                      : "Nothing submitted yet"}
                  </p>
                </div>
                <div className="mt-1">
                  <Line label="Total reels" value={trustMetrics?.total_reels ?? 0} isDark={isDark} />
                  <Line label="Verified" value={trustMetrics?.verified_reels ?? 0} isDark={isDark} />
                  <Line label="Rejected" value={trustMetrics?.rejected_reels ?? 0} isDark={isDark} />
                  <Line label="Pending" value={trustMetrics?.pending_reels ?? 0} isDark={isDark} />
                </div>
              </div>
            </div>

            <p className={cn("border-t px-5 py-4 text-base leading-relaxed", line, muted)}>
              Brands set minimums per campaign for trust, quality, earnings, and views. You can submit when your stats meet every requirement on a campaign.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
