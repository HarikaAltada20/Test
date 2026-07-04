import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TrustScoreMetrics } from "@/lib/trust-score";
import type { CreatorQualityMetrics } from "@/lib/quality-score";
import {
  formatQualityScoreDisplay,
  formatQualitySumDisplay,
  formatTrustScoreDisplay,
} from "@/lib/creator-profile-stats";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  Hash,
  Info,
  ListChecks,
  ShieldCheck,
  Star,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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

function getTrustTone(score: number) {
  if (score >= 80) {
    return {
      text: "text-emerald-600",
      bar: "bg-emerald-500",
      ring: "stroke-emerald-500",
      soft: "bg-emerald-500/10",
      icon: "text-emerald-600",
    };
  }
  if (score >= 50) {
    return {
      text: "text-amber-600",
      bar: "bg-amber-500",
      ring: "stroke-amber-500",
      soft: "bg-amber-500/10",
      icon: "text-amber-600",
    };
  }
  return {
    text: "text-red-600",
    bar: "bg-red-500",
    ring: "stroke-red-500",
    soft: "bg-red-500/10",
    icon: "text-red-600",
  };
}

function SectionLabel({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-wider",
        isDark ? "text-[#D9C0FF]" : "text-[#7F39EC]",
      )}
    >
      {children}
    </p>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  iconClass,
  valueClass,
  isDark,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isDark
          ? "border-white/10 bg-[#1f0a46]/80 hover:border-[#7F39EC]/40"
          : "border-slate-200/80 bg-slate-50/50 hover:border-[#7F39EC]/30 hover:bg-white",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isDark ? "bg-white/10" : "bg-white shadow-sm",
          )}
        >
          <Icon className={cn("h-4 w-4", iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-medium",
              isDark ? "text-slate-400" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-2xl font-bold leading-none",
              valueClass ?? (isDark ? "text-white" : "text-foreground"),
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustScoreHero({
  score,
  trustNumber,
  isDark,
}: {
  score: number;
  trustNumber: number;
  isDark: boolean;
}) {
  const rounded = Math.round(score);
  const tone = getTrustTone(score);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (rounded / 100) * circumference;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        isDark
          ? "border-[#7F39EC]/30 bg-gradient-to-br from-[#1f0a46] to-[#180438]"
          : "border-[#7F39EC]/20 bg-gradient-to-br from-[#F8F4FF] to-white",
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                className={cn(isDark ? "stroke-white/10" : "stroke-slate-200")}
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                className={tone.ring}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-xl font-bold leading-none", tone.text)}>
                {rounded}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isDark ? "text-slate-400" : "text-muted-foreground",
                )}
              >
                /100
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className={cn("h-4 w-4", tone.icon)} />
              <p
                className={cn(
                  "text-sm font-semibold",
                  isDark ? "text-white" : "text-foreground",
                )}
              >
                Trust %
              </p>
            </div>
            <p
              className={cn(
                "mt-1 text-2xl font-bold sm:text-3xl",
                tone.text,
              )}
            >
              {formatTrustScoreDisplay(score)}
            </p>
            <div
              className={cn(
                "mt-3 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full",
                isDark ? "bg-white/10" : "bg-slate-200",
              )}
            >
              <div
                className={cn("h-full rounded-full transition-all", tone.bar)}
                style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-[140px] flex-col rounded-xl border px-4 py-3 sm:items-end sm:text-right",
            isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white/80",
          )}
        >
          <div className="flex items-center gap-2 sm:justify-end">
            <Hash className={cn("h-4 w-4", isDark ? "text-[#D9C0FF]" : "text-[#7F39EC]")} />
            <p
              className={cn(
                "text-xs font-medium",
                isDark ? "text-slate-400" : "text-muted-foreground",
              )}
            >
              Trust Score
            </p>
          </div>
          <p
            className={cn(
              "mt-1 text-3xl font-bold",
              trustNumber >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {trustNumber >= 0 ? `+${trustNumber}` : trustNumber}
          </p>
          <p
            className={cn(
              "mt-1 text-xs",
              isDark ? "text-slate-500" : "text-muted-foreground",
            )}
          >
            Verified − rejected
          </p>
        </div>
      </div>
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

  const reelStats = [
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
        "overflow-hidden shadow-sm",
        isDark ? "border-[#7F39EC]/40 bg-[#180438]" : "border-[#7F39EC]/20 bg-white",
        className,
      )}
    >
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              isDark ? "bg-[#7F39EC]/20" : "bg-[#7F39EC]/10",
            )}
          >
            <BarChart3 className={cn("h-5 w-5", isDark ? "text-[#D9C0FF]" : "text-[#7F39EC]")} />
          </div>
          <div>
            <CardTitle className="text-xl">Creator Stats</CardTitle>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-slate-400" : "text-muted-foreground",
              )}
            >
              Your platform totals for campaign eligibility
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <TrustScoreHero
              score={trustScore}
              trustNumber={trustNumber}
              isDark={isDark}
            />

            <div className="space-y-3">
              <SectionLabel isDark={isDark}>Quality & performance</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Best Quality"
                  value={formatQualityScoreDisplay(qualityMetrics?.best_quality_score)}
                  icon={Star}
                  iconClass="text-amber-500"
                  isDark={isDark}
                />
                <StatTile
                  label="Avg Quality"
                  value={formatQualityScoreDisplay(qualityMetrics?.avg_quality_score)}
                  icon={Star}
                  iconClass="text-[#7F39EC]"
                  isDark={isDark}
                />
                <StatTile
                  label="Total Quality Score"
                  value={formatQualitySumDisplay(qualityMetrics?.quality_score_sum)}
                  icon={Star}
                  iconClass="text-orange-500"
                  isDark={isDark}
                />
                <StatTile
                  label="Total Earnings"
                  value={formatCurrencyFromCents(totalEarningsCents)}
                  icon={DollarSign}
                  iconClass="text-emerald-600"
                  valueClass="text-xl sm:text-2xl"
                  isDark={isDark}
                />
                <StatTile
                  label="Total verified views"
                  value={formatViews(totalViews)}
                  icon={Eye}
                  iconClass="text-blue-600"
                  isDark={isDark}
                />
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel isDark={isDark}>Submission breakdown</SectionLabel>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {reelStats.map((stat) => (
                  <StatTile
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    icon={stat.icon}
                    iconClass={stat.iconClass}
                    isDark={isDark}
                  />
                ))}
              </div>
            </div>

            <div
              className={cn(
                "flex gap-3 rounded-xl border px-4 py-3",
                isDark
                  ? "border-[#7F39EC]/25 bg-[#7F39EC]/10"
                  : "border-[#7F39EC]/15 bg-[#F8F4FF]",
              )}
            >
              <Info
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  isDark ? "text-[#D9C0FF]" : "text-[#7F39EC]",
                )}
              />
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  isDark ? "text-slate-300" : "text-muted-foreground",
                )}
              >
                Brands set minimums per campaign for trust %, trust score, quality,
                earnings, and views. You can submit when your stats meet every
                requirement on a campaign.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
