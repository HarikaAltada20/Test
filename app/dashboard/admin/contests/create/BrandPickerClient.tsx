"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdvertiserSearchSelect,
  type AdvertiserSearchOption,
} from "@/components/admin/AdvertiserSearchSelect";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Copy,
  Crown,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trophy,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DuplicateCampaignDialog } from "@/components/campaign-duplicate/DuplicateCampaignDialog";

type BrandSummary = {
  advertiser: AdvertiserSearchOption;
  plan: {
    productId: string;
    name: string;
    displayName: string;
    status: string;
    priceCents: number;
  };
  features: {
    maxActiveContests: number;
    minContestBudget: number;
    maxWinnersPerContest: number;
    commissionPercentage: number;
    contestTypes: string[];
    analytics: string;
    support: string;
  };
  activeContests: {
    current: number;
    max: number;
    canCreate: boolean;
    message?: string;
  };
};

function formatContestTypes(types: string[]) {
  return types.map((t) => {
    if (t === "cpm") return "CPM";
    if (t === "leaderboard") return "Leaderboard";
    if (t === "milestone") return "Milestone";
    return t;
  });
}

function planStatusLabel(status: string) {
  if (status === "free") return "Free tier";
  if (status === "active") return "Active";
  if (status === "trialing") return "Trial";
  if (status === "canceled") return "Canceled";
  return status.replace(/_/g, " ");
}

export function AdminCreateForBrandClient() {
  const router = useRouter();
  const [selectedBrand, setSelectedBrand] =
    useState<AdvertiserSearchOption | null>(null);
  const [summary, setSummary] = useState<BrandSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    if (!selectedBrand) {
      setSummary(null);
      setSummaryError(null);
      return;
    }

    let cancelled = false;
    const loadSummary = async () => {
      setLoadingSummary(true);
      setSummaryError(null);
      try {
        const res = await fetch(
          `/api/admin/advertisers/${selectedBrand.id}/summary`,
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load brand details");
        }
        if (!cancelled) {
          setSummary({
            advertiser: {
              ...selectedBrand,
              ...json.advertiser,
            },
            plan: json.plan,
            features: json.features,
            activeContests: json.activeContests,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setSummaryError(
            err instanceof Error ? err.message : "Failed to load brand details",
          );
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    };

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [selectedBrand]);

  const handleBrandChange = (brand: AdvertiserSearchOption | null) => {
    setSelectedBrand(brand);
    setSummary(null);
    setSummaryError(null);
  };

  const canContinue =
    selectedBrand &&
    summary &&
    !loadingSummary &&
    summary.activeContests.canCreate;

  const walletLow =
    summary && summary.advertiser.available_deposit_balance === 0;

  const handleContinue = () => {
    if (!selectedBrand || !summary?.activeContests.canCreate) return;
    router.push(
      `/dashboard/admin/contests/create/wizard?advertiserId=${selectedBrand.id}`,
    );
  };

  const displayName =
    selectedBrand?.company_name ||
    selectedBrand?.full_name ||
    selectedBrand?.email;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-[#ececef] bg-white shadow-[0_8px_28px_-18px_rgba(26,26,26,0.28)] dark:border-white/10 dark:bg-[#161616]">
        <div className="border-b border-[#ececef] bg-gradient-to-r from-[#f6f6f7] to-transparent px-6 py-5 dark:border-white/10 dark:from-white/5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">
                Select brand account
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                Search by company, email, or name. Campaign limits, commission,
                and payment all follow the brand&apos;s plan.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
          <div className="space-y-5 border-b border-[#ececef] p-6 dark:border-white/10 lg:border-b-0 lg:border-r">
            <AdvertiserSearchSelect
              value={selectedBrand}
              onChange={handleBrandChange}
              label="Brand"
            />

            {!selectedBrand && (
              <div className="rounded-xl border border-dashed border-[#e6e6e8]/80 bg-[#f6f6f7]/30 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5">
                <Sparkles className="mx-auto h-8 w-8 text-[#1a1a1a]/60" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Start by searching for a brand
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Their subscription plan and wallet details will appear here.
                </p>
              </div>
            )}

            {selectedBrand && loadingSummary && (
              <div className="flex items-center justify-center gap-2 rounded-xl border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading plan details…
              </div>
            )}

            {summaryError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {summaryError}
              </div>
            )}
          </div>

          <div className="p-6">
            {summary ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold truncate">
                      {displayName}
                    </h3>
                    <Badge className="bg-[#1a1a1a] hover:bg-black text-white border-0">
                      <Crown className="mr-1 h-3 w-3" />
                      {summary.plan.displayName}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {planStatusLabel(summary.plan.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {summary.advertiser.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#ececef] bg-gradient-to-br from-white to-[#f6f6f7] p-4 dark:border-white/10 dark:from-[#161616] dark:to-[#161616]">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Wallet className="h-3.5 w-3.5" />
                      Wallet
                    </div>
                    <p className="mt-2 text-xl font-bold tabular-nums">
                      {formatCurrencyFromCents(
                        summary.advertiser.available_deposit_balance,
                      )}
                    </p>
                    {walletLow && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Top up required before pay-as-brand
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#ececef] bg-gradient-to-br from-white to-[#f6f6f7] p-4 dark:border-white/10 dark:from-[#161616] dark:to-[#161616]">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Trophy className="h-3.5 w-3.5" />
                      Active slots
                    </div>
                    <p className="mt-2 text-xl font-bold tabular-nums">
                      {summary.activeContests.current}
                      <span className="text-base font-medium text-muted-foreground">
                        {" "}
                        / {summary.activeContests.max}
                      </span>
                    </p>
                    {!summary.activeContests.canCreate && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Limit reached
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#ececef] p-4 dark:border-white/10">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Plan limits for this brand
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <PlanDetail
                      label="Commission"
                      value={`${summary.features.commissionPercentage}%`}
                    />
                    <PlanDetail
                      label="Max winners"
                      value={String(summary.features.maxWinnersPerContest)}
                    />
                    <PlanDetail
                      label="Min budget"
                      value={formatCurrencyFromCents(
                        summary.features.minContestBudget,
                      )}
                    />
                    <PlanDetail
                      label="Support"
                      value={summary.features.support}
                      capitalize
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formatContestTypes(summary.features.contestTypes).map(
                      (type) => (
                        <Badge
                          key={type}
                          variant="secondary"
                          className="bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white"
                        >
                          <Zap className="mr-1 h-3 w-3" />
                          {type}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>

                {!summary.activeContests.canCreate && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {summary.activeContests.message}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-[#e6e6e8]/60 bg-muted/20 px-6 text-center dark:border-white/10">
                <Crown className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">
                  Plan summary
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground/80">
                  Select a brand to review their subscription, wallet balance,
                  and campaign limits before continuing.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-[#ececef] bg-muted/20 px-6 py-4 dark:border-white/10">
          {loadingSummary ? (
            <div className="flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking plan…
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinue}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all",
                  "bg-[#1a1a1a] ring-1 ring-black/5 hover:opacity-95 active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
                  "dark:bg-[#1a1a1a] dark:ring-white/10",
                )}
              >
                <Plus className="h-4 w-4" />
                Start from scratch
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setCopyOpen(true)}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3.5 text-sm font-semibold shadow-sm transition-all",
                  "border-[#1a1a1a] text-[#1a1a1a] hover:bg-[#f6f6f7] active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100",
                  "dark:border-white/20 dark:text-white dark:hover:bg-white/10",
                )}
              >
                <Copy className="h-4 w-4" />
                Copy an existing campaign
              </button>
            </div>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Wizard uses this brand&apos;s plan for contest types, limits, and
            commission. Payment is wallet-only.
          </p>
        </div>
      </div>

      {selectedBrand && (
        <DuplicateCampaignDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          isAdmin
          targetAdvertiserId={selectedBrand.id}
          targetBrandName={displayName || null}
        />
      )}
    </div>
  );
}

function PlanDetail({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold",
          capitalize && "capitalize",
        )}
      >
        {value}
      </p>
    </div>
  );
}
