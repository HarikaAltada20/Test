import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrustScoreMetrics } from "@/lib/trust-score";
import type { CreatorQualityMetrics } from "@/lib/quality-score";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { CheckCircle2, Clock3, ListChecks, Star, XCircle } from "lucide-react";

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
  const trustTone =
    trustScore >= 80 ? "text-emerald-600" : trustScore >= 50 ? "text-amber-600" : "text-red-600";

  const statCards = [
    {
      label: "Total reels",
      value: trustMetrics?.total_reels ?? 0,
      icon: ListChecks,
      iconClass: "text-violet-600",
    },
    {
      label: "Verified reels",
      value: trustMetrics?.verified_reels ?? 0,
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
    },
    {
      label: "Rejected reels",
      value: trustMetrics?.rejected_reels ?? 0,
      icon: XCircle,
      iconClass: "text-rose-600",
    },
    {
      label: "Pending reels",
      value: trustMetrics?.pending_reels ?? 0,
      icon: Clock3,
      iconClass: "text-amber-600",
    },
  ];

  return (
    <Card
      className={cn(
        "shadow-sm",
        isDark ? "border-[#7F39EC]/40 bg-[#180438]" : "border-[#7F39EC]/20 bg-white",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Creator Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 w-36 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <p className="text-sm text-muted-foreground">Trust Score</p>
                <p className={cn("text-3xl font-bold", trustTone)}>{trustScore}%</p>
              </div>
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <p className="text-sm text-muted-foreground">Trust Number</p>
                <p className="text-3xl font-bold">
                  {trustNumber >= 0 ? `+${trustNumber}` : trustNumber}
                </p>
              </div>
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5" /> Best Quality
                </div>
                <p className="text-3xl font-bold">
                  {qualityMetrics?.best_quality_score ?? "—"}
                </p>
              </div>
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <p className="text-sm text-muted-foreground">Avg Quality</p>
                <p className="text-3xl font-bold">
                  {qualityMetrics?.avg_quality_score ?? "—"}
                </p>
              </div>
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold">
                  {formatCurrencyFromCents(totalEarningsCents)}
                </p>
              </div>
              <div className={cn("rounded-xl border px-4 py-3", isDark ? "border-white/10 bg-[#1f0a46]" : "border-slate-200 bg-white")}>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-3xl font-bold">{formatViews(totalViews)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="grid min-w-[720px] grid-cols-4 gap-3">
                {statCards.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className={cn(
                        "rounded-xl px-4 py-3 shadow-sm",
                        isDark ? "border border-white/10 bg-[#1f0a46]" : "border border-slate-300 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", stat.iconClass)} />
                        <span className={cn("text-md", isDark ? "text-slate-300" : "text-gray-700")}>
                          {stat.label}
                        </span>
                      </div>
                      <div className={cn("mt-2 text-2xl font-semibold", isDark ? "text-white" : "text-foreground")}>
                        {stat.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Trust Score % = 100 − (rejected ÷ verified × 100). Trust Number = verified − rejected.
              Quality scores (1–3) are assigned when submissions are verified.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
