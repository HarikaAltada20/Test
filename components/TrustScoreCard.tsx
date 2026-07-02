import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTrustScoreDisplay } from "@/lib/creator-profile-stats";
import type { TrustScoreMetrics } from "@/lib/trust-score";
import { CheckCircle2, Clock3, ListChecks, XCircle } from "lucide-react";

type TrustScoreCardProps = {
  metrics: TrustScoreMetrics | null;
  loading?: boolean;
  className?: string;
  isDark?: boolean;
};

export function TrustScoreCard({
  metrics,
  loading = false,
  className,
  isDark = false,
}: TrustScoreCardProps) {
  const score = metrics?.trust_score ?? 100;

  const toneClass =
    score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  const statCards = [
    {
      label: "Total reels",
      value: metrics?.total_reels ?? 0,
      icon: ListChecks,
      iconClass: "text-violet-600",
    },
    {
      label: "Verified reels",
      value: metrics?.verified_reels ?? 0,
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
    },
    {
      label: "Rejected reels",
      value: metrics?.rejected_reels ?? 0,
      icon: XCircle,
      iconClass: "text-rose-600",
    },
    {
      label: "Pending reels",
      value: metrics?.pending_reels ?? 0,
      icon: Clock3,
      iconClass: "text-amber-600",
    },
  ];

  return (
    <Card
      className={cn(
        "shadow-sm",
        isDark ? "border-[#7F39EC]/40 bg-[#180438]" : "border-[#7F39EC]/20 bg-white",
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-xl">Trust Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 w-36 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <div className={cn("text-4xl font-bold", toneClass)}>
              {formatTrustScoreDisplay(score)}
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                isDark ? "text-slate-200" : "text-slate-700",
              )}
            >
              Trust Score: {metrics?.trust_number ?? 0}
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
                      isDark
                        ? "border border-white/10 bg-[#1f0a46]"
                        : "border border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", stat.iconClass)} />
                      <span className={cn("text-md", isDark ? "text-slate-300" : "text-gray-700")}>
                        {stat.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-2 text-2xl font-semibold",
                        isDark ? "text-white" : "text-foreground"
                      )}
                    >
                      {stat.value}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Brands set trust % and trust score minimums on each campaign.
              The numbers above are your platform totals—check a campaign&apos;s
              eligibility section to see whether you meet what that brand requires.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
