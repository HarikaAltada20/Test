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
import { AlertTriangle, ArrowRight, Loader2, SlidersHorizontal } from "lucide-react";

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
        "w-full text-left rounded-xl border p-2.5 sm:p-3 transition-all",
        disabled && "opacity-60 cursor-not-allowed",
        selected
          ? isDark
            ? "border-white bg-white/10 ring-1 ring-white/30 shadow-xs"
            : "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900 shadow-xs"
          : isDark
            ? "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
            : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
            selected
              ? isDark
                ? "border-white bg-white"
                : "border-neutral-900 bg-neutral-900"
              : isDark
                ? "border-white/30"
                : "border-neutral-300",
          )}
          aria-hidden
        >
          {selected ? (
            <span className={cn("h-1.5 w-1.5 rounded-full", isDark ? "bg-[#111113]" : "bg-white")} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-xs sm:text-sm leading-snug",
              selected
                ? isDark ? "text-white" : "text-neutral-900"
                : isDark ? "text-neutral-200" : "text-neutral-800",
            )}
          >
            {option.label}
          </p>
          <p
            className={cn(
              "text-[11px] sm:text-xs mt-0.5 leading-relaxed",
              isDark ? "text-neutral-400" : "text-neutral-500",
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
        "rounded-xl border p-3 space-y-2",
        isDark
          ? "border-white/10 bg-white/5"
          : "border-[#ececef] bg-[#f6f6f7]",
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1a1a1a] dark:text-white" />
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
          "flex max-h-[90vh] w-[min(460px,calc(100vw-1.5rem))] max-w-[460px] flex-col gap-3 overflow-y-auto rounded-2xl border p-4 shadow-xl",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-[#ececef] bg-white text-[#1a1a1a]",
        )}
      >
        <div>
          <DialogHeader className="flex flex-row items-center gap-3 text-left space-y-0 pr-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className={cn(
                  "text-base sm:text-lg font-bold leading-tight",
                  isDark ? "text-white" : "text-neutral-900",
                )}
              >
                Update Campaign Status
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "text-xs leading-normal mt-0.5",
                  isDark ? "text-neutral-400" : "text-neutral-500",
                )}
              >
                Move this ended campaign to the next post-contest phase.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-3 space-y-3">
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
                    "rounded-xl border px-3 py-2.5",
                    isDark
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-neutral-200 bg-neutral-50/70",
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider mb-2",
                      isDark ? "text-neutral-400" : "text-neutral-400",
                    )}
                  >
                    Status transition
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-end gap-0.5 min-w-0">
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold tracking-wider",
                          isDark ? "text-neutral-400" : "text-neutral-400",
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
                        "h-4 w-4 shrink-0 text-neutral-400",
                      )}
                      aria-hidden
                    />
                    <div className="flex flex-col items-start gap-0.5 min-w-0">
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold tracking-wider",
                          isDark ? "text-neutral-400" : "text-neutral-400",
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

                <div className="space-y-1.5">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
                    )}
                  >
                    Choose new status
                  </p>
                  {availableOptions.length === 0 ? (
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        isDark ? "text-neutral-400" : "text-neutral-500",
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
                      "items-start rounded-xl border p-3",
                      isDark
                        ? "border-white/10 bg-white/5 [&>svg]:text-slate-300"
                        : "border-[#ececef] bg-[#f6f6f7] [&>svg]:text-[#1a1a1a]",
                    )}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <AlertTitle
                      className={cn(
                        "mb-1 text-xs font-semibold",
                        isDark ? "text-white" : "text-[#1a1a1a]",
                      )}
                    >
                      {STATUS_TRANSITION_IMPACT_TITLE}
                    </AlertTitle>
                    <AlertDescription
                      className={cn(
                        "text-xs leading-relaxed",
                        isDark ? "text-slate-300" : "text-[#737373]",
                      )}
                    >
                      <ul className="space-y-1 list-none pl-0">
                        {impactLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {showSyncWarning ? (
                        <p
                          className={cn(
                            "mt-2 text-[11px] leading-relaxed",
                            isDark ? "text-slate-400" : "text-[#737373]",
                          )}
                        >
                          If any step fails, the status will not change.
                        </p>
                      ) : null}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-1.5">
                  <label
                    htmlFor="campaign-status-reason"
                    className={cn(
                      "text-xs font-semibold",
                      isDark ? "text-white" : "text-neutral-900",
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
                      "resize-none min-h-[64px] text-xs rounded-xl border transition-colors",
                      isDark
                        ? "bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-white/20"
                        : "bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-neutral-900/10",
                    )}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                : "border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
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
              "h-10 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "bg-white text-[#1a1a1a] hover:bg-[#f3f3f5]"
                : "bg-[#1a1a1a] text-white hover:bg-black",
            )}
          >
            Confirm update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
