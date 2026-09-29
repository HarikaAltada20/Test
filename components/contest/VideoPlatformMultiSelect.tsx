"use client";

import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  VIDEO_CONTEST_PLATFORMS,
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type VideoPlatformMultiSelectProps = {
  value: VideoContestPlatform[];
  onChange: (platforms: VideoContestPlatform[]) => void;
  isDark?: boolean;
  disabled?: boolean;
};

export function VideoPlatformMultiSelect({
  value,
  onChange,
  isDark = false,
  disabled = false,
}: VideoPlatformMultiSelectProps) {
  const toggle = (platform: VideoContestPlatform, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      if (value.includes(platform)) return;
      onChange([...value, platform]);
      return;
    }
    if (value.length <= 1) return;
    onChange(value.filter((p) => p !== platform));
  };

  const summary =
    value.length === 0
      ? "Select campaign platform"
      : value.map((p) => VIDEO_PLATFORM_LABELS[p]).join(", ");

  return (
    <div className="space-y-2">
      <Label htmlFor="platform">Platform</Label>
      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id="platform"
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-lg border px-4 py-3 text-md font-medium text-left",
              isDark
                ? "bg-[#180438] border-gray-600 text-white"
                : "bg-white border-input",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {summary}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "w-[var(--radix-popover-trigger-width)] p-2",
            isDark && "bg-[#180438] border-gray-600 text-white",
          )}
        >
          <div className="space-y-1">
            {VIDEO_CONTEST_PLATFORMS.map((platform) => {
              const selected = value.includes(platform);
              return (
                <label
                  key={platform}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer",
                    isDark ? "hover:bg-[#D9C0FF26]" : "hover:bg-[#D9C0FF26]",
                  )}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled || (selected && value.length <= 1)}
                    onCheckedChange={(next) => toggle(platform, next === true)}
                  />
                  <span className="font-medium">
                    {VIDEO_PLATFORM_LABELS[platform]}
                  </span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <p className="text-sm text-muted-foreground">
        Select one or more platforms. Each platform can have its own campaign
        type, payout structure, brief, and rules.
      </p>
    </div>
  );
}
