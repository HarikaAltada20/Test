import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManualPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (points: number, reason: string) => void;
  isLoading?: boolean;
  adjustmentType?: "tweet" | "leaderboard";
  currentPoints?: number;
  creatorName?: string;
  totalPoints?: number;
  basePoints?: number;
  manualPoints?: number;
  creatorManualPointsAdjustment?: number;
}

export default function ManualPointsModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  adjustmentType = "tweet",
  currentPoints = 0,
  creatorName,
  totalPoints,
  basePoints,
  manualPoints,
  creatorManualPointsAdjustment,
}: ManualPointsModalProps) {
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") {
      return dataMode;
    }
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  };

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);

  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };

    setMode(readMode());

    const observer = new MutationObserver(() => {
      setMode(readMode());
    });
    const dataModeTarget = document.querySelector("[data-mode]");
    if (dataModeTarget) {
      observer.observe(dataModeTarget, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPoints("");
      setReason("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const pointsNum = parseInt(points, 10);
    if (!isNaN(pointsNum) && reason.trim().length >= 10) {
      onConfirm(pointsNum, reason.trim());
    }
  };

  const handleClose = () => {
    setPoints("");
    setReason("");
    onClose();
  };

  const isConfirmDisabled = () => {
    const pointsNum = parseInt(points, 10);
    return isNaN(pointsNum) || reason.trim().length < 10;
  };

  const getValidationMessage = () => {
    if (points && isNaN(parseInt(points, 10))) {
      return "Please enter a valid number for points";
    }
    if (reason.trim().length > 0 && reason.trim().length < 10) {
      return "Please provide a more detailed reason (at least 10 characters)";
    }
    return "";
  };

  const isDark = mode === "dark";
  const isLeaderboard = adjustmentType === "leaderboard";
  const numberFormatter = new Intl.NumberFormat("en-US");

  const formatValue = (value: number) =>
    numberFormatter.format(Math.abs(Math.round(value)));

  const formatWithSign = (value: number) => {
    if (value > 0) {
      return `+${numberFormatter.format(Math.round(value))}`;
    }
    if (value < 0) {
      return `-${numberFormatter.format(Math.abs(Math.round(value)))}`;
    }
    return numberFormatter.format(Math.round(value));
  };

  const getManualTextColor = (value: number) => {
    if (value > 0) return "text-[#16a34a]";
    if (value < 0) return "text-[#dc2626]";
    return isDark ? "text-white" : "text-[#1a1a1a]";
  };

  const trimmedCreator = creatorName?.trim();
  const creatorLabel = !trimmedCreator
    ? "this creator"
    : trimmedCreator.startsWith("@") || trimmedCreator.includes(" ")
      ? trimmedCreator
      : `@${trimmedCreator}`;

  const basePointsValue = basePoints ?? 0;
  const manualPointsValue = manualPoints ?? 0;
  const creatorAdjustmentValue = creatorManualPointsAdjustment ?? 0;
  const computedTotalPoints =
    basePointsValue + manualPointsValue + creatorAdjustmentValue;
  const totalPointsValue =
    typeof totalPoints === "number"
      ? totalPoints
      : typeof currentPoints === "number"
      ? currentPoints
      : computedTotalPoints;
  const totalManualPointsValue = manualPointsValue;
  const pointsNum = parseInt(points, 10);
  const hasAdjustment = points.trim() !== "" && !isNaN(pointsNum);
  const nextTotal = hasAdjustment
    ? totalPointsValue + pointsNum
    : totalPointsValue;

  const statCards = [
    {
      label: "Total Points",
      value: totalPointsValue,
      isManual: false,
    },
    {
      label: "Base Points",
      value: basePointsValue,
      isManual: false,
    },
    {
      label: "Manual Points",
      value: totalManualPointsValue,
      isManual: true,
    },
    {
      label: "Creator adj.",
      value: creatorAdjustmentValue,
      isManual: true,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
      <DialogContent
        className={cn(
          "w-[min(540px,95vw)] gap-5 overflow-y-auto rounded-2xl p-5 sm:max-w-[540px] sm:p-6",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-[#ececef] bg-white text-[#1a1a1a]",
        )}
      >
        <DialogHeader className="space-y-0 pr-6">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className={cn(
                  "text-base font-semibold leading-tight",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                {isLeaderboard ? "Adjust Creator Points" : "Adjust Tweet Points"}
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "mt-1 text-[13px] leading-snug",
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
              >
                {isLeaderboard
                  ? `Adjust points for all tweets by ${creatorLabel}. Changes are recorded for audit.`
                  : trimmedCreator
                    ? `Adjust points for this tweet by ${creatorLabel}. Changes are recorded for audit.`
                    : "Adjust points for this tweet. Changes are recorded for audit."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {isLeaderboard ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-xl px-3 py-2.5",
                    isDark ? "bg-white/5" : "bg-[#f6f6f7]",
                  )}
                >
                  <p
                    className={cn(
                      "text-[12px]",
                      isDark ? "text-slate-400" : "text-[#737373]",
                    )}
                  >
                    {card.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[15px] font-semibold tabular-nums leading-none",
                      card.isManual
                        ? getManualTextColor(card.value)
                        : isDark
                          ? "text-white"
                          : "text-[#1a1a1a]",
                    )}
                  >
                    {card.isManual
                      ? formatWithSign(card.value)
                      : formatValue(card.value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "w-fit min-w-[120px] rounded-xl px-3 py-2.5",
                isDark ? "bg-white/5" : "bg-[#f6f6f7]",
              )}
            >
              <p
                className={cn(
                  "text-[12px]",
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
              >
                Total Points
              </p>
              <p
                className={cn(
                  "mt-1 text-[15px] font-semibold tabular-nums leading-none",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                {formatValue(totalPointsValue)}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="points-input"
              className={cn(
                "text-sm font-semibold",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              Points Adjustment *
            </Label>
            <div className="relative">
              <Input
                id="points-input"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className={cn(
                  "h-11 rounded-xl border pr-36 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  isDark
                    ? "border-white/20 bg-[#161616] text-white"
                    : "border-[#1a1a1a] bg-white text-[#1a1a1a]",
                )}
              />
              {hasAdjustment && (
                <div
                  className={cn(
                    "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm tabular-nums",
                    isDark ? "text-slate-400" : "text-[#737373]",
                  )}
                >
                  {formatValue(totalPointsValue)} →{" "}
                  {nextTotal < 0
                    ? `-${formatValue(nextTotal)}`
                    : formatValue(nextTotal)}
                </div>
              )}
            </div>
            <p className={cn("text-xs", isDark ? "text-slate-400" : "text-[#737373]")}>
              Use a minus sign to subtract, for example -20.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="reason-textarea"
              className={cn(
                "text-sm font-semibold",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              Reason for Adjustment *
            </Label>
            <div className="relative">
              <Textarea
                id="reason-textarea"
                placeholder="Explain why these points are changing."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
                className={cn(
                  "min-h-[112px] resize-none rounded-xl pb-7 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                  isDark
                    ? "border-white/15 bg-[#161616] text-white placeholder:text-slate-500"
                    : "border-[#e5e5e5] bg-white text-[#1a1a1a] placeholder:text-[#a3a3a3]",
                )}
              />
              <div
                className={cn(
                  "absolute bottom-2.5 right-3 text-xs tabular-nums",
                  isDark ? "text-slate-500" : "text-[#a3a3a3]",
                )}
              >
                {reason.length}/500
              </div>
            </div>
            {getValidationMessage() && (
              <p className="text-xs text-[#dc2626]">{getValidationMessage()}</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-end gap-2 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
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
            onClick={handleConfirm}
            disabled={isConfirmDisabled() || isLoading}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "bg-white text-[#1a1a1a] hover:bg-[#f3f3f5]"
                : "bg-[#1a1a1a] text-white hover:bg-black",
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isLoading ? "Applying..." : "Apply adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
