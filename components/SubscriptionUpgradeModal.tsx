"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, DollarSign, Users, Trophy, X } from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import type { SubscriptionPlan } from "@/lib/subscription-types";
import { cn } from "@/lib/utils";

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  onUpgradeSuccess: () => void;
  onUpgradeError: (error: string) => void;
}

type UpgradeType = "immediate" | "scheduled";

export function SubscriptionUpgradeModal({
  isOpen,
  onClose,
  currentPlan,
  targetPlan,
  onUpgradeSuccess,
  onUpgradeError,
}: SubscriptionUpgradeModalProps) {
  const [upgradeType, setUpgradeType] = useState<UpgradeType>("scheduled");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const pathname = usePathname();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const isDark = mode === "dark";
  const isPricingDark = pathname === "/pricing" || isDark;

  const isUpgrade = targetPlan.price > currentPlan.price;
  const priceDifference = targetPlan.price - currentPlan.price;

  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + 30);

  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setScheduledDate(nextBillingDate.toISOString().split("T")[0]);
      setUpgradeType("scheduled");
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    setIsProcessing(true);

    try {
      const targetPriceId = targetPlan.prices?.monthly?.id;
      if (!targetPriceId) {
        throw new Error("Price ID not found for target plan");
      }

      const response = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetProductId: targetPlan.id,
          targetPriceId,
          upgradeType,
          scheduledDate:
            upgradeType === "scheduled" ? scheduledDate : undefined,
        }),
      });

      const result = await response.json();
      console.log("[Client] 📋 Subscription upgrade result:", result);

      if (!response.ok) {
        throw new Error(result.error || "Upgrade failed");
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.success(result.message || "Upgrade processed successfully");
        onUpgradeSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to process upgrade";
      toast.error(errorMessage);
      onUpgradeError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const getFeatureDifferences = () => {
    const differences = [];

    if (
      targetPlan.features.maxActiveContests !==
      currentPlan.features.maxActiveContests
    ) {
      differences.push({
        label: "Active Contests",
        current: currentPlan.features.maxActiveContests,
        target: targetPlan.features.maxActiveContests,
        icon: <Users className="h-4 w-4 shrink-0" />,
      });
    }

    if (
      targetPlan.features.commissionPercentage !==
      currentPlan.features.commissionPercentage
    ) {
      differences.push({
        label: "Commission Rate",
        current: `${currentPlan.features.commissionPercentage}%`,
        target: `${targetPlan.features.commissionPercentage}%`,
        icon: <DollarSign className="h-4 w-4 shrink-0" />,
      });
    }

    if (
      targetPlan.features.maxWinnersPerContest !==
      currentPlan.features.maxWinnersPerContest
    ) {
      differences.push({
        label: "Max Winners",
        current: currentPlan.features.maxWinnersPerContest,
        target: targetPlan.features.maxWinnersPerContest,
        icon: <Trophy className="h-4 w-4 shrink-0" />,
      });
    }

    return differences;
  };

  const mutedText = isPricingDark ? "text-slate-400" : "text-[#66666F]";
  const strongText = isPricingDark ? "text-white" : "text-[#171717]";
  const softBorder = isPricingDark ? "border-slate-700" : "border-neutral-200";
  const featureDiffs = getFeatureDifferences();
  const changeVerb = isUpgrade ? "upgrade" : "downgrade";

  const optionCardClass = (selected: boolean) =>
    cn(
      "cursor-pointer rounded-xl border p-3.5 transition-colors",
      selected
        ? isPricingDark
          ? "border-white/40 bg-white/10"
          : "border-[#171717] bg-[#F6F6F7]"
        : isPricingDark
          ? "border-slate-700 bg-transparent hover:bg-white/5"
          : "border-neutral-200 bg-white hover:bg-[#FAFAFA]",
    );

  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent
        hideCloseButton
        className={cn(
          "max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto rounded-2xl p-0 sm:p-0",
          isPricingDark
            ? "border-slate-700 bg-slate-900 text-white pricing-scroll"
            : "border-neutral-200 bg-white text-[#171717]",
        )}
      >
        <div className="space-y-5 p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle
                className={cn("text-base font-semibold sm:text-lg", strongText)}
              >
                {isUpgrade ? "Upgrade" : "Downgrade"} Your Subscription
              </DialogTitle>
              <DialogDescription
                className={cn("text-md leading-relaxed", mutedText)}
              >
                {currentPlan.displayName || currentPlan.name}
                {" → "}
                {targetPlan.displayName || targetPlan.name}. Features and
                limits will update to match the new plan.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isProcessing}
                aria-label="Close"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full border-0 shadow-none",
                  isPricingDark
                    ? "text-slate-200 hover:bg-white/10 hover:text-white"
                    : "text-[#171717] hover:bg-[#F4F4F5]",
                )}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          {/* Plan comparison */}
          <div
            className={cn(
              "grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border p-3 sm:gap-3 sm:p-4",
              softBorder,
              isPricingDark ? "bg-white/5" : "bg-[#F6F6F7]",
            )}
          >
            <div className="min-w-0 space-y-1.5">
              <p className={cn("text-[11px] font-medium uppercase tracking-wide", mutedText)}>
                Current
              </p>
              <p className={cn("truncate text-sm font-semibold", strongText)}>
                {currentPlan.displayName || currentPlan.name}
              </p>
              <p className={cn("text-sm font-medium tabular-nums", mutedText)}>
                {formatCurrencyFromCents(currentPlan.price)}
                <span className="text-xs font-normal">/mo</span>
              </p>
            </div>

            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                isPricingDark ? "bg-white/10" : "bg-white",
              )}
            >
              <ArrowRight className={cn("h-3.5 w-3.5", mutedText)} />
            </div>

            <div className="min-w-0 space-y-1.5 text-right">
              <p className={cn("text-[11px] font-medium uppercase tracking-wide", mutedText)}>
                New
              </p>
              <p className={cn("truncate text-sm font-semibold", strongText)}>
                {targetPlan.displayName || targetPlan.name}
              </p>
              <p className="text-sm font-semibold tabular-nums text-[#16a34a]">
                {formatCurrencyFromCents(targetPlan.price)}
                <span className={cn("text-xs font-normal", mutedText)}>/mo</span>
              </p>
              {priceDifference !== 0 && (
                <p className={cn("text-[11px]", mutedText)}>
                  {priceDifference > 0 ? "+" : ""}
                  {formatCurrencyFromCents(priceDifference)} /mo
                </p>
              )}
            </div>
          </div>

          {/* Feature differences */}
          {featureDiffs.length > 0 && (
            <div className="space-y-2">
              <h4 className={cn("text-md font-semibold", strongText)}>
                What&apos;s changing
              </h4>
              <div
                className={cn(
                  "divide-y overflow-hidden rounded-xl border",
                  softBorder,
                  isPricingDark ? "divide-slate-700" : "divide-neutral-200",
                )}
              >
                {featureDiffs.map((diff) => (
                  <div
                    key={diff.label}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                  >
                    <div className={cn("flex min-w-0 items-center gap-2 text-sm", mutedText)}>
                      {diff.icon}
                      <span className={cn("truncate font-medium", strongText)}>
                        {diff.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 text-sm font-medium tabular-nums",
                        strongText,
                      )}
                    >
                      <span className={mutedText}>{diff.current}</span>
                      <span className={mutedText}>→</span>
                      <span>{diff.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2">
            <h4 className={cn("text-md font-semibold", strongText)}>
              Choose your {changeVerb} option
            </h4>
            <RadioGroup
              value={upgradeType}
              onValueChange={(value) => setUpgradeType(value as UpgradeType)}
              className="gap-2.5"
            >
              <Label htmlFor="scheduled" className={optionCardClass(upgradeType === "scheduled")}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="scheduled"
                    id="scheduled"
                    className={cn(
                      "mt-0.5 shrink-0",
                      isPricingDark
                        ? "border-slate-500 text-white data-[state=checked]:border-white"
                        : "border-neutral-300 text-[#171717] data-[state=checked]:border-[#171717]",
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-md font-medium", strongText)}>
                        Scheduled {isUpgrade ? "Upgrade" : "Downgrade"}
                      </span>
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-2 py-0 text-[11px] font-medium shadow-none",
                          isPricingDark
                            ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15"
                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
                        )}
                      >
                        Recommended
                      </Badge>
                    </div>
                    <p className={cn("text-sm leading-relaxed", mutedText)}>
                      Keep your current plan until the billing period ends, then
                      switch automatically. No time or money lost.
                    </p>
                    {upgradeType === "scheduled" && (
                      <p className={cn("text-sm", mutedText)}>
                        Starts{" "}
                        <span className={cn("font-medium", strongText)}>
                          {new Date(scheduledDate).toLocaleDateString()}
                        </span>
                        {" · "}
                        Next charge{" "}
                        <span className={cn("font-medium", strongText)}>
                          {formatCurrencyFromCents(targetPlan.price)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </Label>

              <Label htmlFor="immediate" className={optionCardClass(upgradeType === "immediate")}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="immediate"
                    id="immediate"
                    className={cn(
                      "mt-0.5 shrink-0",
                      isPricingDark
                        ? "border-slate-500 text-white data-[state=checked]:border-white"
                        : "border-neutral-300 text-[#171717] data-[state=checked]:border-[#171717]",
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-md font-medium", strongText)}>
                        Immediate {isUpgrade ? "Upgrade" : "Downgrade"}
                      </span>
                      <Badge
                        className={cn(
                          "rounded-full border-0 px-2 py-0 text-[11px] font-medium shadow-none",
                          isPricingDark
                            ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/15"
                            : "bg-amber-50 text-amber-800 hover:bg-amber-50",
                        )}
                      >
                        Lose remaining time
                      </Badge>
                    </div>
                    <p className={cn("text-sm leading-relaxed", mutedText)}>
                      {isUpgrade
                        ? "Cancel now and start the new plan immediately. Remaining time on your current plan is forfeited."
                        : targetPlan.price === 0
                          ? "Cancel your paid plan now and return to the free plan. Remaining time is forfeited."
                          : "Switch to the new plan immediately. Remaining time on your current plan is forfeited."}
                    </p>
                  </div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Actions — scroll with content, not sticky */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleUpgrade}
              loading={isProcessing}
              loadingText="Processing..."
              className={cn(
                "h-11 w-full rounded-full text-sm font-medium shadow-none",
                isPricingDark
                  ? "border border-white/20 bg-white text-[#171717] hover:bg-neutral-100"
                  : "bg-[#171717] text-white hover:bg-[#2a2a2a]",
              )}
            >
              {upgradeType === "scheduled" ? (
                <>Schedule {isUpgrade ? "Upgrade" : "Downgrade"}</>
              ) : (
                <>
                  {isUpgrade ? "Upgrade" : "Downgrade"} Now
                  {targetPlan.price > 0 &&
                    ` · ${formatCurrencyFromCents(targetPlan.price)}`}
                </>
              )}
            </Button>
            <Button
              onClick={onClose}
              disabled={isProcessing}
              variant="ghost"
              className={cn(
                "h-10 w-full rounded-full border border-neutral-400 rounded-full text-sm font-medium shadow-none",
                isPricingDark
                  ? "text-slate-100 hover:bg-white/10"
                  : "text-[#171717] hover:bg-[#F4F4F5]",
              )}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
