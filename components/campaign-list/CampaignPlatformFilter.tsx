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
  MULTIPLE_CAMPAIGN_FILTER_PLATFORMS,
  campaignPlatformMatchMode,
  campaignPlatformFilterLabel,
  isAllCampaignPlatformFilter,
  isCampaignPlatformSelected,
  normalizeCampaignPlatformFilter,
  selectedCampaignPlatforms,
  setCampaignPlatformMatchMode,
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
  const matchMode = campaignPlatformMatchMode(normalized);
  const modePlatforms =
    matchMode === "multiple" ? MULTIPLE_CAMPAIGN_FILTER_PLATFORMS : available;
  const selectedPlatforms = selectedCampaignPlatforms(normalized, modePlatforms);
  const allSelected =
    matchMode === "multiple"
      ? selectedPlatforms.length === MULTIPLE_CAMPAIGN_FILTER_PLATFORMS.length
      : isAllCampaignPlatformFilter(normalized);
  const platformLabel = campaignPlatformFilterLabel(normalized, available);

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
            {isAllCampaignPlatformFilter(normalized)
              ? platformLabel
              : `${matchMode === "single" ? "Single" : "Multiple"}: ${platformLabel}`}
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
          <div
            className={cn(
              "grid grid-cols-2 gap-1 rounded-lg p-1 mb-1",
              isDark ? "bg-slate-900" : "bg-slate-100",
            )}
            role="group"
            aria-label="Campaign platform mode"
          >
            <MatchModeButton
              label="Single Platform"
              active={matchMode === "single"}
              isDark={isDark}
              onClick={() =>
                onChange(
                  setCampaignPlatformMatchMode(
                    normalized,
                    "single",
                    available,
                  ),
                )
              }
            />
            <MatchModeButton
              label="Multiple Platform"
              active={matchMode === "multiple"}
              isDark={isDark}
              onClick={() =>
                onChange(
                  setCampaignPlatformMatchMode(
                    normalized,
                    "multiple",
                    available,
                  ),
                )
              }
            />
          </div>
          <p
            className={cn(
              "px-2 pb-1 text-[11px] leading-4",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {matchMode === "single"
              ? "Choose platforms to see single-platform campaigns. All campaigns includes every campaign."
              : "Choose 2 or 3 platforms. Campaigns must match the exact selection."}
          </p>
          <PlatformFilterRow
            label={matchMode === "multiple" ? "All 3 platforms" : "All campaigns"}
            checked={allSelected}
            isDark={isDark}
            onToggle={() =>
              onChange(
                toggleCampaignPlatformFilter(normalized, "all", available),
              )
            }
          />
          {modePlatforms.map((platform) => (
            <PlatformFilterRow
              key={platform}
              label={CAMPAIGN_FILTER_PLATFORM_LABELS[platform]}
              checked={isCampaignPlatformSelected(
                normalized,
                platform,
                available,
              )}
              isDark={isDark}
              disabled={
                matchMode === "multiple" &&
                selectedPlatforms.length === 2 &&
                selectedPlatforms.includes(platform)
              }
              onToggle={() =>
                onChange(
                  toggleCampaignPlatformFilter(normalized, platform, available),
                )
              }
            />
          ))}
          {matchMode === "multiple" && (
            <p
              className={cn(
                "px-2 pt-1 text-[11px] leading-4",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              At least two platforms must stay selected. Twitter is available in Single Platform.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MatchModeButton({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-1.5 text-[12px] font-semibold transition-colors",
        active
          ? "bg-[#4211a1] text-white"
          : isDark
            ? "text-slate-300 hover:bg-slate-800"
            : "text-slate-600 hover:bg-white",
      )}
    >
      {label}
    </button>
  );
}

function PlatformFilterRow({
  label,
  checked,
  isDark,
  disabled = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  isDark: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55",
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
