"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

/** Campaign-wide "highest-earning platform only" checkbox for the Prize step. */
export function HighestPlatformPayoutSwitch({
  checked,
  onCheckedChange,
  platforms,
  multipleSubmissionsEnabled,
  lockedReason,
  isDark = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Selected platforms in campaign order; the first one wins ties. */
  platforms: VideoContestPlatform[];
  multipleSubmissionsEnabled: boolean;
  /** Shown under the help text; the checkbox is disabled while set. */
  lockedReason?: string | null;
  isDark?: boolean;
  className?: string;
}) {
  const tieBreak = platforms[0] ? VIDEO_PLATFORM_LABELS[platforms[0]] : null;
  const mutedText = isDark ? "text-slate-400" : "text-[#737373]";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        isDark ? "border-white/10 bg-white/[0.03]" : "border-[#e5e5e5] bg-[#fafafa]",
        className,
      )}
    >
      <Checkbox
        id="highestPlatformPayoutOnly"
        checked={checked}
        disabled={Boolean(lockedReason)}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className={cn(
          "mt-0.5 h-5 w-5 border",
          isDark
            ? "border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0a0a0a]"
            : "border-[#1a1a1a] data-[state=checked]:border-[#0a0a0a] data-[state=checked]:bg-[#0a0a0a] data-[state=checked]:text-white",
        )}
      />
      <div className="space-y-1">
        <Label
          htmlFor="highestPlatformPayoutOnly"
          className={cn("text-base font-semibold", isDark ? "text-white" : "text-[#0a0a0a]")}
        >
          Pay creators for their highest-earning platform only
        </Label>
        <p className={cn("text-sm", mutedText)}>
          A creator who posts on more than one platform is paid only for the
          platform that earns them the most (bonuses included). Their other
          platforms count $0.
          {tieBreak ? ` Ties go to ${tieBreak}.` : ""}
        </p>
        {!multipleSubmissionsEnabled && (
          <p className={cn("text-sm", mutedText)}>
            This only matters when creators can submit more than once.
          </p>
        )}
        {lockedReason && (
          <p className={cn("text-sm font-medium", mutedText)}>{lockedReason}</p>
        )}
      </div>
    </div>
  );
}
