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
  const mutedText = isDark ? "text-gray-300" : "text-gray-600";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        isDark ? "border-gray-600" : "border-gray-300",
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
          isDark ? "border-gray-300" : "border-gray-500",
        )}
      />
      <div className="space-y-1">
        <Label
          htmlFor="highestPlatformPayoutOnly"
          className="text-base font-semibold"
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
