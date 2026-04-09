"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Info, Globe, Users, User, Layout, Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TikTokDemographicRow {
  dimension_value: string;
  distribution: number;
}

interface TikTokDemographics {
  audience_age?: TikTokDemographicRow[];
  audience_gender?: TikTokDemographicRow[];
  audience_country?: TikTokDemographicRow[];
  audience_device?: TikTokDemographicRow[];
}

export type TikTokCreatorAnalyticsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  creatorId: string;
  creatorLabel: string;
  isDark?: boolean;
  onFetchComplete?: () => void;
};

const TIKTOK_AQUA = "#00f2ea";
const TIKTOK_PINK = "#ff0050";

export function TikTokCreatorAnalyticsModal({
  open,
  onOpenChange,
  contestId,
  creatorId,
  creatorLabel,
  isDark,
  onFetchComplete,
}: TikTokCreatorAnalyticsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    demographics: TikTokDemographics | null;
    lastSyncedAt: string | null;
    hasMarketingAccount: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && creatorId) {
      fetchAnalytics();
    }
  }, [open, creatorId, contestId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/contests/${contestId}/creators/${creatorId}/tiktok-account-analytics`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch TikTok analytics");
      }
      const jsonData = await response.json();
      setData(jsonData);
    } catch (err: any) {
      console.error("[TikTokAnalyticsModal] fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      onFetchComplete?.();
    }
  };

  const demographics = data?.demographics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0",
        isDark ? "bg-[#06021D] border-white/10 text-white" : "bg-white"
      )}>
        <DialogHeader className={cn(
          "p-6 border-b",
          isDark ? "border-white/10 bg-[#170337]" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                TikTok Audience Analytics
                <span className="text-sm font-normal text-muted-foreground mr-2">
                  for {creatorLabel}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Audience demographics data from TikTok Business API keys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm text-muted-foreground">Fetching TikTok analytics...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-red-500 font-medium">{error}</p>
              <Button onClick={fetchAnalytics} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          ) : !data?.hasMarketingAccount ? (
            <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <div className="bg-amber-100 text-amber-600 p-4 rounded-full mb-4">
                <Info className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Business Key Connected</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                This creator hasn't connected a TikTok Business account yet, or the permissions are missing. 
                Demographics data is only available for Business/TCM connected accounts.
              </p>
            </div>
          ) : !demographics ? (
            <div className="py-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8">
              <div className="bg-slate-100 text-slate-400 p-4 rounded-full mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Demographics Data</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                TikTok hasn't returned demographics data for this creator yet. This can happen if the audience is too small or if data is still being processed.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
               {/* Last Synced Info */}
               <div className={cn(
                 "flex items-center gap-2 p-3 rounded-xl text-xs",
                 isDark ? "bg-white/5 text-slate-400" : "bg-slate-50 text-slate-500"
               )}>
                 <Clock className="h-3.5 w-3.5" />
                 Last updated: {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : 'Never'}
               </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gender Breakdown */}
                <DemographicCard
                  title="Gender"
                  icon={<User className="h-4 w-4" />}
                  rows={demographics.audience_gender || []}
                  isDark={isDark}
                  hint="Distribution of audience by gender."
                />

                {/* Age Breakdown */}
                <DemographicCard
                  title="Age Range"
                  icon={<Users className="h-4 w-4" />}
                  rows={demographics.audience_age || []}
                  isDark={isDark}
                  hint="Distribution of audience by age range."
                />

                {/* Country Breakdown */}
                <DemographicCard
                  title="Top Countries"
                  icon={<Globe className="h-4 w-4" />}
                  rows={demographics.audience_country || []}
                  isDark={isDark}
                  hint="Top locations of the audience by country."
                />

                {/* Devices Breakdown */}
                <DemographicCard
                  title="Devices"
                  icon={<Layout className="h-4 w-4" />}
                  rows={demographics.audience_device || []}
                  isDark={isDark}
                  hint="Distribution of devices used by the audience."
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DemographicCard({
  title,
  icon,
  rows,
  isDark,
  hint
}: {
  title: string;
  icon: React.ReactNode;
  rows: TikTokDemographicRow[];
  isDark?: boolean;
  hint: string;
}) {
  return (
    <div className={cn(
      "rounded-2xl p-4 space-y-4 border",
      isDark ? "bg-white/[0.04] border-white/10" : "bg-slate-50/80 border-slate-200"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600"
          )}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">
                {hint}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length > 0 ? (
          rows.sort((a,b) => b.distribution - a.distribution).map((row, i) => (
            <div key={row.dimension_value} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium truncate max-w-[150px]" title={row.dimension_value}>
                  {formatLabel(row.dimension_value)}
                </span>
                <span className="font-bold tabular-nums">
                  {(row.distribution * 100).toFixed(1)}%
                </span>
              </div>
              <div className={cn(
                "h-2 w-full rounded-full overflow-hidden",
                isDark ? "bg-white/10" : "bg-slate-200"
              )}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${row.distribution * 100}%`,
                    backgroundColor: i % 2 === 0 ? TIKTOK_AQUA : TIKTOK_PINK
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic py-4 text-center">No data available</p>
        )}
      </div>
    </div>
  );
}

function formatLabel(label: string): string {
  // TikTok gender labels can be 'Male', 'Female', etc.
  // Age can be '18-24', etc.
  // Country can be ISO codes or full names.
  if (label === "M") return "Male";
  if (label === "F") return "Female";
  if (label === "O") return "Other";
  
  // Try to use Intl for country names if it looks like a 2-letter code
  if (label.length === 2 && label === label.toUpperCase()) {
    try {
      const regionName = new Intl.DisplayNames(['en'], {type: 'region'}).of(label);
      if (regionName) return regionName;
    } catch {}
  }
  
  return label;
}
