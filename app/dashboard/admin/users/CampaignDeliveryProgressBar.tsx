"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type DeliveryProgressData = {
  deliveredCount: number;
  failedCount: number;
  pendingCount: number;
  processedCount: number;
  recipientCount: number;
  percentComplete: number;
};

type Props = {
  progress: DeliveryProgressData;
  compact?: boolean;
  className?: string;
};

export function CampaignDeliveryProgressBar({
  progress,
  compact = false,
  className,
}: Props) {
  const { processedCount, recipientCount, percentComplete, failedCount } =
    progress;

  return (
    <div
      className={cn(
        compact ? "space-y-1.5" : "space-y-2 rounded-xl border border-border/80 bg-white px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          compact ? "text-xs text-muted-foreground" : "text-sm",
        )}
      >
        <span
          className={cn(
            "flex items-center gap-1.5",
            !compact && "font-medium text-foreground",
          )}
        >
          <Loader2 className="h-3 w-3 animate-spin text-[#4A00BE]" />
          {compact ? `${processedCount}/${recipientCount}` : "Delivering notifications"}
        </span>
        <span
          className={cn(
            "tabular-nums font-semibold",
            compact ? "text-foreground" : "text-[#4A00BE]",
          )}
        >
          {percentComplete}%
        </span>
      </div>
      <Progress
        value={percentComplete}
        className={cn(compact ? "h-2" : "h-2.5", "[&>div]:bg-[#4A00BE]")}
      />
      {!compact && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {processedCount} of {recipientCount} recipients processed
        </p>
      )}
      {!compact && failedCount > 0 && (
        <p className="text-xs text-destructive">{failedCount} failed so far</p>
      )}
    </div>
  );
}
