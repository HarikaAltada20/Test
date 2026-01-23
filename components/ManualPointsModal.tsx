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
import { Loader2, Star, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    if (value > 0) return "text-emerald-400";
    if (value < 0) return "text-rose-400";
    return isDark ? "text-white" : "text-slate-900";
  };

  const totalPointsValue = totalPoints ?? currentPoints ?? 0;
  const basePointsValue = basePoints ?? 0;
  const creatorAdjustmentValue = creatorManualPointsAdjustment ?? 0;
  const totalManualPointsValue = (manualPoints ?? 0) + creatorAdjustmentValue;

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
      label: "Creator Manual Points Adjustment",
      value: creatorAdjustmentValue,
      isManual: true,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
      <DialogContent
        className={cn(
          "max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto",
          isDark ? "text-white" : "text-gray-800"
        )}
      >
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                isDark ? "bg-purple-900/50" : "bg-purple-100"
              )}
            >
              {isLeaderboard ? (
                <Users className="h-5 w-5 text-purple-600" />
              ) : (
                <Star className="h-5 w-5 text-purple-600" />
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {isLeaderboard
                  ? "Adjust Creator Points"
                  : "Adjust Tweet Points"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {isLeaderboard
                  ? `Adjust points for all tweets by ${
                      creatorName || "this creator"
                    }. This will affect their total leaderboard score.`
                  : "Manually adjust points for this specific tweet. Provide a reason for the adjustment."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6 px-1">
          {/* Points Summary Cards */}
          {isLeaderboard ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-2xl border px-4 py-3 shadow-sm",
                    isDark
                      ? "border-slate-800 bg-slate-900"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-2xl font-semibold",
                      card.isManual
                        ? getManualTextColor(card.value)
                        : isDark
                        ? "text-white"
                        : "text-slate-900"
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
                "rounded-2xl border px-4 py-3 shadow-sm max-w-sm",
                isDark
                  ? "border-slate-800 bg-slate-900"
                  : "border-slate-200 bg-white"
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Points
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  isDark ? "text-white" : "text-slate-900"
                )}
              >
                {formatValue(totalPointsValue)}
              </p>
            </div>
          )}

          {/* Points Adjustment Input */}
          <div className="space-y-3">
            <Label htmlFor="points-input" className="text-sm font-medium">
              Points Adjustment *
            </Label>
            <div className="relative">
              <Input
                id="points-input"
                type="number"
                placeholder={
                  isLeaderboard ? "e.g., +50 or -20" : "e.g., +10 or -5"
                }
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                points
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a positive number to add points, or a negative number to
              subtract points.
            </p>
            {points && !isNaN(parseInt(points, 10)) && (
              <div
                className={cn(
                  "p-2 rounded text-sm",
                  parseInt(points, 10) > 0
                    ? isDark
                      ? "bg-green-900/20 text-green-400"
                      : "bg-green-50 text-green-700"
                    : isDark
                    ? "bg-red-900/20 text-red-400"
                    : "bg-red-50 text-red-700"
                )}
              >
                {parseInt(points, 10) > 0 ? "+" : ""}
                {parseInt(points, 10)} points will be{" "}
                {parseInt(points, 10) > 0 ? "added" : "subtracted"}
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div className="space-y-3">
            <Label htmlFor="reason-textarea" className="text-sm font-medium">
              Reason for Adjustment *
            </Label>
            <div className="relative">
              <Textarea
                id="reason-textarea"
                placeholder="Please provide a detailed reason for this points adjustment. This will be recorded for audit purposes..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none pr-12"
                maxLength={500}
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {reason.length}/500
              </div>
            </div>
            {getValidationMessage() && (
              <Alert
                className={cn(
                  isDark
                    ? "border-red-800 bg-red-900/20"
                    : "border-red-200 bg-red-50"
                )}
              >
                <AlertDescription
                  className={cn(isDark ? "text-red-400" : "text-red-800")}
                >
                  {getValidationMessage()}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Info Alert */}
          <Alert
            className={cn(
              isDark
                ? "bg-[#7F39EC17] border-[#7F39EC17]"
                : "border-purple-200 bg-purple-50"
            )}
          >
            <AlertDescription
              className={cn(isDark ? "text-purple-300" : "text-purple-800")}
            >
              <span className="font-medium">Note:</span>{" "}
              {isLeaderboard
                ? "This adjustment will be applied to the creator's total leaderboard score and will affect their ranking."
                : "This adjustment will be added to the tweet's calculated points. The reason will be visible in the submission details."}
            </AlertDescription>
          </Alert>
          {isLeaderboard && (
            <p className={cn("text-sm text-muted-foreground mt-2 px-1")}>
              Creator manual point adjustments are now cumulative, ensuring new
              points are added to the existing total without overriding previous
              values.
            </p>
          )}
        </div>

        <DialogFooter className="gap-3 pt-6 border-t mt-6">
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled() || isLoading}
            className={cn(
              "w-full text-md rounded-full flex-1 sm:flex-none",
              isDark
                ? "bg-[#7F39EC] py-3 text-white"
                : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Adjusting...
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2 inline" />
                Confirm Adjustment
              </>
            )}
          </button>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className={cn(
              "w-full text-md rounded-full flex-1 sm:flex-none",
              isDark
                ? "py-3 border border-[#FF5353] text-[#FF5353]"
                : "bg-[#FF323224] text-[#E50000] py-4"
            )}
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
