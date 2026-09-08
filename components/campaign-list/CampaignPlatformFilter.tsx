"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_FILTER_PLATFORM_LABELS,
  CAMPAIGN_FILTER_PLATFORMS,
  campaignPlatformFilterLabel,
  normalizeCampaignPlatformFilter,
  type CampaignFilterPlatform,
  toggleCampaignPlatformFilter,
} from "@/lib/campaign-platform-filter";

type CampaignPlatformFilterProps = {
  value: string;
  onChange: (value: string) => void;
  platforms?: readonly CampaignFilterPlatform[];
  isDark?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function CampaignPlatformFilter({
  value,
  onChange,
  platforms = CAMPAIGN_FILTER_PLATFORMS,
  isDark = false,
  className,
  triggerClassName,
}: CampaignPlatformFilterProps) {
  const available = CAMPAIGN_FILTER_PLATFORMS.filter((platform) =>
    platforms.includes(platform),
  );
  const normalized = normalizeCampaignPlatformFilter(value, available);
  const allSelected = normalized === "all";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full min-w-0 h-12 justify-between rounded-xl font-medium",
            isDark
              ? "border-gray-600 bg-[#07031D] text-white hover:bg-gray-700"
              : "border-gray-400 bg-white text-gray-900 hover:bg-gray-50",
            triggerClassName,
          )}
        >
          <span className="truncate">
            {campaignPlatformFilterLabel(normalized, available)}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-2 rounded-xl",
          isDark
            ? "bg-[#0f172a] border-slate-800 text-slate-100"
            : "bg-white border-slate-200",
          className,
        )}
      >
        <div className="flex flex-col gap-1">
          <PlatformFilterRow
            label="All Platforms"
            checked={allSelected}
            isDark={isDark}
            onToggle={() => onChange("all")}
          />
          {available.map((platform) => (
            <PlatformFilterRow
              key={platform}
              label={CAMPAIGN_FILTER_PLATFORM_LABELS[platform]}
              checked={!allSelected && normalized.split(",").includes(platform)}
              isDark={isDark}
              onToggle={() =>
                onChange(
                  toggleCampaignPlatformFilter(normalized, platform, available),
                )
              }
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PlatformFilterRow({
  label,
  checked,
  isDark,
  onToggle,
}: {
  label: string;
  checked: boolean;
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors",
        isDark ? "hover:bg-slate-800" : "hover:bg-slate-50",
      )}
    >
      <span
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
          checked
            ? "bg-[#4211a1] border-[#4211a1]"
            : isDark
              ? "border-slate-700 bg-slate-900"
              : "border-slate-300 bg-white",
        )}
      >
        {checked ? (
          <Check className="w-3 h-3 text-white" strokeWidth={4} />
        ) : null}
      </span>
      <span
        className={cn(
          "text-[13px] font-medium",
          isDark ? "text-slate-300" : "text-slate-600",
        )}
      >
        {label}
      </span>
    </button>
  );
}
