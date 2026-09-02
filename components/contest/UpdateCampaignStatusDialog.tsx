"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { PostContestStatus } from "@/lib/constants-status";
import {
  getAvailablePostContestTransitions,
  getPostContestStatusBadgeClassName,
  getPostContestStatusLabel,
  getRecommendedPostContestTransition,
  getStatusTransitionImpact,
  STATUS_TRANSITION_IMPACT_TITLE,
  statusTransitionRequiresViewSync,
  type PostContestStatusOption,
} from "@/lib/post-contest-status-ui";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

type ViewsSyncSummary = {
  upserted_or_updated?: number;
  deleted_rejected_credits?: number;
};

export type UpdateCampaignStatusDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  currentStatus: string | null | undefined;
  isAdmin: boolean;
  isDark: boolean;
  submissionCount?: number;
  onSuccess: (newStatus: PostContestStatus) => void;
};

function formatViewsSyncToast(sync: ViewsSyncSummary | undefined): string {
  if (!sync) return "";
  const updated = Number(sync.upserted_or_updated) || 0;
  if (updated <= 0) {
    return " Creator view snapshots were already up to date.";
  }
  return ` Synced ${updated} creator view snapshot${updated === 1 ? "" : "s"}.`;
}

function getContestStatusToast(
  status: PostContestStatus,
  sync?: ViewsSyncSummary,
) {
  const syncSuffix = formatViewsSyncToast(sync);
  switch (status) {
    case "pending_review":
      return {
        title: "Status: Pending Review",
        description: `Campaign is now in the pending review phase.${syncSuffix}`,
        variant: "pending" as const,
      };
    case "in_review":
      return {
        title: "Status: In Review",
        description: `Campaign is currently under review.${syncSuffix}`,
        variant: "pending" as const,
      };
    case "verification_complete":
      return {
        title: "Status: Verification Completed",
        description: `Submissions have been reviewed. Payouts are processing.${syncSuffix}`,
        variant: "success" as const,
      };
    case "payouts_processed":
      return {
        title: "Status: Payouts Processed",
        description: `All payments have been released.${syncSuffix}`,
        variant: "payment" as const,
      };
    default:
      return {
        title: "Status updated",
        description: `Campaign status was updated.${syncSuffix}`,
        variant: "default" as const,
      };
  }
}

function StatusBadge({
  label,
  status,
  isDark,
  muted,
}: {
  label: string;
  status: string | null | undefined;
  isDark: boolean;
  muted?: boolean;
}) {
  return (
    <Badge
      className={cn(
        getPostContestStatusBadgeClassName(isDark, status),
        "whitespace-nowrap text-xs font-medium px-3 py-1 rounded-full border max-w-full truncate",
        muted && "opacity-60",
      )}
    >
      {label}
    </Badge>
  );
}

function StatusOptionCard({
  option,
  selected,
  disabled,
  isDark,
  onSelect,
}: {
  option: PostContestStatusOption;
  selected: boolean;
  disabled: boolean;
  isDark: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-xl border p-3 sm:p-3.5 transition-colors",
        disabled && "opacity-60 cursor-not-allowed",
        selected
          ? isDark
            ? "border-purple-400 bg-purple-500/10 ring-1 ring-purple-400/50"
            : "border-purple-500 bg-purple-50 ring-1 ring-purple-300"
          : isDark
            ? "border-white/10 hover:border-white/20 hover:bg-white/5"
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
            selected
              ? "border-purple-500 bg-purple-500"
              : isDark
                ? "border-white/30"
                : "border-gray-300",
          )}
          aria-hidden
        >
          {selected ? (
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium text-sm leading-snug",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            {option.label}
          </p>
          <p
            className={cn(
              "text-xs mt-1 leading-relaxed",
              isDark ? "text-gray-400" : "text-muted-foreground",
            )}
          >
            {option.description}
          </p>
        </div>
      </div>
    </button>
  );
}

function LoadingPanel({
  isDark,
  showSyncWarning,
  submissionCount,
  elapsedSeconds,
}: {
  isDark: boolean;
  showSyncWarning: boolean;
  submissionCount?: number;
  elapsedSeconds: number;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 space-y-3",
        isDark
          ? "border-purple-400/30 bg-purple-500/5"
          : "border-purple-200 bg-purple-50/60",
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-purple-500" />
        <p
          className={cn(
            "font-medium text-sm leading-snug",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Updating campaign status…
        </p>
      </div>
      <p
        className={cn(
          "text-sm leading-relaxed",
          isDark ? "text-gray-300" : "text-gray-600",
        )}
      >
        {showSyncWarning
          ? `Syncing creator views for this campaign${
              submissionCount ? ` (${submissionCount} submissions)` : ""
            }. This can take 1–2 minutes — please keep this window open.`
          : "Saving the new campaign status."}
      </p>
      {showSyncWarning ? (
        <ul
          className={cn(
            "text-sm space-y-1.5 list-disc pl-5 leading-relaxed",
            isDark ? "text-gray-400" : "text-muted-foreground",
          )}
        >
          <li>Syncing creator profile views</li>
          <li>Locking verified view counts</li>
          <li>Saving new status</li>
        </ul>
      ) : null}
      {elapsedSeconds >= 8 ? (
        <p
          className={cn(
            "text-xs tabular-nums",
            isDark ? "text-gray-500" : "text-muted-foreground",
          )}
        >
          Still working… {elapsedSeconds}s elapsed
        </p>
      ) : null}
    </div>
  );
}

export function UpdateCampaignStatusDialog({
  open,
  onOpenChange,
  contestId,
  currentStatus,
  isAdmin,
  isDark,
  submissionCount,
  onSuccess,
}: UpdateCampaignStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<PostContestStatus | "">(
    "",
  );
  const [reason, setReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const availableOptions = getAvailablePostContestTransitions({
    current: currentStatus,
    isAdmin,
  });

  useEffect(() => {
    if (!open) return;
    const recommended = getRecommendedPostContestTransition(
      currentStatus,
      isAdmin,
    );
    setSelectedStatus(recommended ?? "");
    setReason("");
    setElapsedSeconds(0);
  }, [open, currentStatus, isAdmin]);

  useEffect(() => {
    if (!isUpdating) {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isUpdating]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUpdating && !nextOpen) return;
    if (!nextOpen) {
      setSelectedStatus("");
      setReason("");
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!selectedStatus) {
      toast({
        title: "Select a status",
        description: "Please choose the new campaign status.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/contests/${contestId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          reason: reason.trim() || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const details =
          typeof result.details === "string" && result.details
            ? ` ${result.details}`
            : "";
        throw new Error(
          `${result.error || "Failed to update status"}${details}`.trim(),
        );
      }

      const newStatus = (result.new_status ||
        selectedStatus) as PostContestStatus;
      toast(getContestStatusToast(newStatus, result.views_sync));
      onSuccess(newStatus);
      setSelectedStatus("");
      setReason("");
      onOpenChange(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update campaign status";
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedLabel = selectedStatus
    ? getPostContestStatusLabel(selectedStatus)
    : "Select status";
  const currentLabel = getPostContestStatusLabel(currentStatus);
  const impactLines = selectedStatus
    ? getStatusTransitionImpact(selectedStatus)
    : [];
  const showSyncWarning =
    selectedStatus !== "" && statusTransitionRequiresViewSync(selectedStatus);
  const showImpactAlert = selectedStatus !== "" && impactLines.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} isdark={isDark}>
      <DialogContent
        hideCloseButton={isUpdating}
        className={cn(
          "w-[calc(100vw-1.5rem)] max-w-[480px] gap-0 p-0 overflow-hidden",
          "max-h-[min(92vh,720px)] flex flex-col",
        )}
      >
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-6 overflow-y-auto flex-1 min-h-0">
          <DialogHeader className="space-y-2 text-left pr-6">
            <DialogTitle
              className={cn(
                "text-lg sm:text-xl font-semibold leading-tight",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              Update Campaign Status
            </DialogTitle>
            <DialogDescription
              className={cn(
                "text-sm leading-relaxed",
                isDark ? "text-gray-400" : "text-muted-foreground",
              )}
            >
              Move this ended campaign to the next post-contest phase.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 sm:space-y-5">
            {isUpdating ? (
              <LoadingPanel
                isDark={isDark}
                showSyncWarning={showSyncWarning}
                submissionCount={submissionCount}
                elapsedSeconds={elapsedSeconds}
              />
            ) : (
              <>
                <div
                  className={cn(
                    "rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5",
                    isDark
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-gray-200 bg-gray-50/80",
                  )}
                >
                  <p
                    className={cn(
                      "text-xs font-medium uppercase tracking-wide mb-2.5",
                      isDark ? "text-gray-500" : "text-gray-500",
                    )}
                  >
                    Status transition
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center sm:items-end gap-1 min-w-0">
                      <span
                        className={cn(
                          "text-[11px] uppercase tracking-wide",
                          isDark ? "text-gray-500" : "text-gray-400",
                        )}
                      >
                        Current
                      </span>
                      <StatusBadge
                        label={currentLabel}
                        status={currentStatus}
                        isDark={isDark}
                      />
                    </div>
                    <ArrowRight
                      className={cn(
                        "h-4 w-4 shrink-0 self-center rotate-90 sm:rotate-0",
                        isDark ? "text-gray-500" : "text-gray-400",
                      )}
                      aria-hidden
                    />
                    <div className="flex flex-col items-center sm:items-start gap-1 min-w-0">
                      <span
                        className={cn(
                          "text-[11px] uppercase tracking-wide",
                          isDark ? "text-gray-500" : "text-gray-400",
                        )}
                      >
                        New
                      </span>
                      <StatusBadge
                        label={selectedLabel}
                        status={selectedStatus || currentStatus}
                        isDark={isDark}
                        muted={!selectedStatus}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Choose new status
                  </p>
                  {availableOptions.length === 0 ? (
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isDark ? "text-gray-400" : "text-muted-foreground",
                      )}
                    >
                      No further status changes are available for this campaign.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableOptions.map((option) => (
                        <StatusOptionCard
                          key={option.value}
                          option={option}
                          selected={selectedStatus === option.value}
                          disabled={isUpdating}
                          isDark={isDark}
                          onSelect={() => setSelectedStatus(option.value)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {showImpactAlert ? (
                  <Alert
                    className={cn(
                      "items-start mb-1",
                      isDark
                        ? "border-sky-500/30 bg-sky-500/10 [&>svg]:text-sky-400"
                        : "border-sky-200 bg-sky-50 [&>svg]:text-sky-600",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <AlertTitle
                      className={cn(
                        "text-sm font-semibold mb-1.5",
                        isDark ? "text-sky-100" : "text-sky-900",
                      )}
                    >
                      {STATUS_TRANSITION_IMPACT_TITLE}
                    </AlertTitle>
                    <AlertDescription
                      className={cn(
                        "text-sm leading-relaxed",
                        isDark ? "text-sky-100/90" : "text-sky-900/90",
                      )}
                    >
                      <ul className="space-y-1.5 list-none pl-0">
                        {impactLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {showSyncWarning ? (
                        <p
                          className={cn(
                            "mt-3 text-xs leading-relaxed",
                            isDark ? "text-sky-200/70" : "text-sky-800/80",
                          )}
                        >
                          If any step fails, the status will not change.
                        </p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <label
                    htmlFor="campaign-status-reason"
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Reason (optional)
                  </label>
                  <Textarea
                    id="campaign-status-reason"
                    placeholder="Add a note about this status change…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isUpdating}
                    className={cn(
                      "resize-none min-h-[72px] text-sm",
                      isDark
                        ? "bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                        : undefined,
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter
          className={cn(
            "shrink-0 flex flex-col gap-2 sm:flex-row sm:justify-end",
            "px-4 sm:px-6 py-4 border-t",
            isDark ? "border-white/10 bg-[#06021D]/95" : "border-gray-200 bg-gray-50/50",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
            className={cn(
              "w-full sm:w-auto rounded-full order-2 sm:order-1",
              isDark
                ? "border-gray-600 text-gray-200 hover:bg-white/5"
                : "border-gray-300",
            )}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={
              isUpdating || !selectedStatus || availableOptions.length === 0
            }
            loading={isUpdating}
            loadingText="Updating…"
            className={cn(
              "w-full sm:w-auto min-w-[140px] rounded-full order-1 sm:order-2",
              isDark
                ? "bg-[#7F39EC] hover:bg-[#6B31C7] text-white"
                : "bg-[#7F39EC] hover:bg-[#6B31C7] text-white",
            )}
          >
            Confirm update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
