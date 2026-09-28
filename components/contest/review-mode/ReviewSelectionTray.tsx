"use client";

import {
  CheckCircle,
  Clock,
  Download,
  ListFilter,
  Loader2,
  Lock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReviewModerationAction } from "./types";

export type ReviewSelectionBreakdown = {
  total: number;
  /** Ids each bulk action would change; paid clips are never included. */
  verify: string[];
  reject: string[];
  pending: string[];
  paid: number;
};

type ReviewSelectionTrayProps = {
  breakdown: ReviewSelectionBreakdown;
  canBulkModerate: boolean;
  busyAction: ReviewModerationAction | null;
  canDownload: boolean;
  downloading: boolean;
  isFocusedOnSelection: boolean;
  onModerate: (action: ReviewModerationAction, ids: string[]) => void;
  onDownload: () => void;
  onReviewOnlySelected: () => void;
  onClear: () => void;
};

/** Full-width bar under the header, mirroring the submissions table's bulk bar. */
export function ReviewSelectionTray({
  breakdown,
  canBulkModerate,
  busyAction,
  canDownload,
  downloading,
  isFocusedOnSelection,
  onModerate,
  onDownload,
  onReviewOnlySelected,
  onClear,
}: ReviewSelectionTrayProps) {
  if (breakdown.total === 0) return null;
  const busy = busyAction !== null;

  const actions: {
    action: ReviewModerationAction;
    label: string;
    ids: string[];
    Icon: typeof CheckCircle;
    className: string;
  }[] = [
    {
      action: "verify",
      label: "Mark as Verified",
      ids: breakdown.verify,
      Icon: CheckCircle,
      className: "border-green-500 bg-green-900/30 text-green-400 hover:bg-green-900/50",
    },
    {
      action: "reject",
      label: "Mark as Rejected",
      ids: breakdown.reject,
      Icon: XCircle,
      className: "border-red-500 bg-red-900/30 text-red-400 hover:bg-red-900/50",
    },
    {
      action: "pending",
      label: "Mark as Pending",
      ids: breakdown.pending,
      Icon: Clock,
      className: "border-yellow-500 bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 lg:px-5">
      <span className="text-sm font-semibold tabular-nums text-violet-300">
        {breakdown.total} selected
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        disabled={busy}
        className="h-8 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        Clear
      </Button>
      {breakdown.paid > 0 && (
        <span
          className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-300"
          title="Paid clips are skipped here. Reverse them from the submissions table."
        >
          <Lock className="h-3 w-3" />
          {breakdown.paid} paid · locked
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {canBulkModerate &&
          actions
            .filter((a) => a.ids.length > 0)
            .map(({ action, label, ids, Icon, className }) => (
              <Button
                key={action}
                size="sm"
                disabled={busy}
                onClick={() => onModerate(action, ids)}
                className={`h-8 shrink-0 gap-1 whitespace-nowrap rounded-md border ${className}`}
              >
                {busyAction === action ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                {label}
                {ids.length !== breakdown.total && (
                  <span className="tabular-nums opacity-80">({ids.length})</span>
                )}
              </Button>
            ))}
        {!isFocusedOnSelection && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReviewOnlySelected}
            className="h-8 shrink-0 gap-1 whitespace-nowrap rounded-md border-slate-600 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
          >
            <ListFilter className="h-4 w-4" />
            Review only these
          </Button>
        )}
        {canDownload && (
          <Button
            size="sm"
            onClick={onDownload}
            disabled={downloading || busy}
            className="h-8 shrink-0 gap-1 whitespace-nowrap rounded-md border border-purple-500 bg-purple-900/30 text-purple-300 hover:bg-purple-900/50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? "Downloading..." : "Download Videos (ZIP)"}
          </Button>
        )}
      </div>
    </div>
  );
}
