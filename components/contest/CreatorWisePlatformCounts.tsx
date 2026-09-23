"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPlatformIcon } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

const VISIBLE_WHEN_OVERFLOW = 2;

export type CreatorWisePlatformCount = {
  platform: VideoContestPlatform;
  count: number;
};

function PlatformCountChip({
  platform,
  count,
  isDark,
}: CreatorWisePlatformCount & { isDark: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          {getPlatformIcon(platform)}
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              isDark ? "text-white" : "text-slate-800",
            )}
          >
            {count}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {VIDEO_PLATFORM_LABELS[platform]}: {count}
      </TooltipContent>
    </Tooltip>
  );
}

export function CreatorWisePlatformCounts({
  rows,
  isDark,
}: {
  rows: CreatorWisePlatformCount[];
  isDark: boolean;
}) {
  if (rows.length === 0) return null;

  const overflow = rows.length >= 3;
  const visible = overflow ? rows.slice(0, VISIBLE_WHEN_OVERFLOW) : rows;
  const hiddenCount = rows.length - visible.length;

  return (
    <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
      {visible.map((row) => (
        <PlatformCountChip
          key={row.platform}
          platform={row.platform}
          count={row.count}
          isDark={isDark}
        />
      ))}
      {overflow ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-6 items-center rounded-md px-1.5 text-[11px] font-semibold leading-none transition-colors",
                isDark
                  ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-700",
              )}
              aria-label={`Show ${hiddenCount} more platform${hiddenCount === 1 ? "" : "s"}`}
            >
              +{hiddenCount} more
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className={cn(
              "w-auto min-w-[10rem] p-2",
              isDark ? "bg-[#0f172a] border-slate-700" : "bg-white",
            )}
          >
            <div className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <div
                  key={row.platform}
                  className="inline-flex items-center gap-2"
                >
                  {getPlatformIcon(row.platform)}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isDark ? "text-slate-200" : "text-slate-700",
                    )}
                  >
                    {VIDEO_PLATFORM_LABELS[row.platform]}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-xs font-semibold tabular-nums",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
