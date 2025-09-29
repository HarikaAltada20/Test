"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Crown,
  Star,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { subscriptionPlans } from "@/constants/subscriptionPlans";
import type { SubscriptionPlan } from "@/lib/subscription-types";

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

  const isUpgrade = targetPlan.price > currentPlan.price;
  const priceDifference = targetPlan.price - currentPlan.price;
  const monthlyDifference = priceDifference;

  // Calculate next billing date (approximate - 30 days from now)
  const nextBillingDate = new Date();
  nextBillingDate.setDate(nextBillingDate.getDate() + 30);
  // Read mode from data attribute
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

    // Watch for changes in the data attribute
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
      // Default scheduled date to next billing cycle
      setScheduledDate(nextBillingDate.toISOString().split("T")[0]);
      setUpgradeType("scheduled"); // Default to scheduled (recommended)
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    setIsProcessing(true);

    try {
      // Get the monthly price ID for the target plan
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
        console.log("response is not okay", response);
        throw new Error(result.error || "Upgrade failed");
      }

      if (result.checkoutUrl) {
        // Redirect to Stripe checkout for immediate upgrades
        window.location.href = result.checkoutUrl;
      } else {
        // Show success message for scheduled upgrades or free plan upgrades
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

  const getPlanIcon = (planName: string) => {
    const name = planName.toUpperCase();
    if (name === "CHAMPION") return <Crown className="h-6 w-6" />;
    if (name === "BUILDER") return <Star className="h-6 w-6" />;
    if (name === "STARTER") return <Zap className="h-6 w-6" />;
    return <Trophy className="h-6 w-6" />;
  };

  const getPlanColor = (planName: string) => {
    const name = planName.toUpperCase();
    if (name === "CHAMPION") return "from-yellow-500 to-orange-600";
    if (name === "BUILDER") return "from-purple-500 to-blue-600";
    if (name === "STARTER") return "from-orange-500 to-red-600";
    return "from-gray-500 to-gray-600";
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
        icon: <Users className="h-4 w-4" />,
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
        icon: <DollarSign className="h-4 w-4" />,
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
        icon: <Trophy className="h-4 w-4" />,
      });
    }

    return differences;
  };

  // 👇 conditional color based on route and dark mode
  const dialogBg =
    pathname === "/pricing" || isDark
      ? "bg-[#06021D] border-gray-600 text-white"
      : "bg-white border-gray-200 text-black";



  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent
        className={`max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto ${dialogBg} ${
          pathname === "/pricing" || isDark ? "pricing-scroll" : ""
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            {/* {isUpgrade ? (
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                            <TrendingDown className="h-5 w-5 text-orange-600" />
                        )} */}
            {isUpgrade ? "Upgrade" : "Downgrade"} Your Subscription
          </DialogTitle>
          <DialogDescription
            className={`text-sm sm:text-base ${
              pathname === "/pricing" || isDark || isDark
                ? "text-white"
                : "text-gray-600"
            }`}
          >
            Choose how you'd like to {isUpgrade ? "upgrade" : "downgrade"} from{" "}
            {currentPlan.displayName || currentPlan.name} to{" "}
            {targetPlan.displayName || targetPlan.name}.
            {isUpgrade
              ? " You'll get access to more features and higher limits."
              : " Your features and limits will be adjusted to the new plan."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Plan Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Current Plan */}
            <div className={`border rounded-2xl ${
              pathname === "/pricing" || isDark
                ? "border-gray-600 text-white bg-[linear-gradient(180deg,rgba(201,167,255,0.1225)_2%,rgba(201,167,255,0.03)_100%)]"
                : "border-gray-300 bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)]"
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                      currentPlan.name
                    )} text-white`}
                  >
                    {getPlanIcon(currentPlan.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-bold">
                      Current Plan
                    </CardTitle>
                    <p className="font-semibold text-md text-[#B16FF4] truncate">
                      {currentPlan.displayName || currentPlan.name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {formatCurrencyFromCents(currentPlan.price)}
                  <span
                    className={`text-sm font-normal ${
                      pathname === "/pricing" || isDark
                        ? "text-white"
                        : "text-gray-600"
                    }`}
                  >
                    /month
                  </span>
                </div>
              </CardContent>
            </div>

            {/* Target Plan */}
            <div
             className={`border rounded-2xl ${
              pathname === "/pricing" || isDark
                ? "border-gray-600 text-white bg-[linear-gradient(180deg,rgba(201,167,255,0.1225)_2%,rgba(201,167,255,0.03)_100%)]"
                : "border-gray-300 bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)]"
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                      targetPlan.name
                    )} text-white`}
                  >
                    {getPlanIcon(targetPlan.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm">New Plan</CardTitle>
                    <p className="font-semibold text-[#B16FF4] text-md truncate">
                      {targetPlan.displayName || targetPlan.name}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-green-600">
                  {formatCurrencyFromCents(targetPlan.price)}
                  <span
                    className={`text-sm font-normal ${
                      pathname === "/pricing" || isDark
                        ? "text-white"
                        : "text-gray-600"
                    }`}
                  >
                    /month
                  </span>
                </div>
                {priceDifference !== 0 && (
                  <div
                    className={`text-sm ${
                      pathname === "/pricing" || isDark
                        ? "text-white"
                        : "text-gray-600"
                    } mt-1`}
                  >
                    {priceDifference > 0 ? "+" : ""}
                    {formatCurrencyFromCents(priceDifference)} difference
                  </div>
                )}
              </CardContent>
            </div>
          </div>

          {/* Feature Differences */}
          {getFeatureDifferences().length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">What's changing:</h4>
              <div className="space-y-3">
                {getFeatureDifferences().map((diff, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-2"
                  >
                    <div className="flex items-center text-md gap-2 min-w-0">
                      {diff.icon}
                      <span className="font-medium truncate">{diff.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-md flex-shrink-0">
                      <p>{diff.current}</p>
                      <span>→</span>
                      <p>{diff.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Options */}
          <div>
            <h4 className="font-semibold mb-4">
              Choose your {isUpgrade ? "upgrade" : "downgrade"} option:
            </h4>
            <RadioGroup
              value={upgradeType}
              onValueChange={(value) => setUpgradeType(value as UpgradeType)}
            >
              {/* Scheduled Change Option */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <Label
                    htmlFor="scheduled"
                    className="flex flex-col sm:flex-row sm:items-center gap-2 cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      {/* <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" /> */}
                      <span className="font-medium text-md">
                        Scheduled {isUpgrade ? "Upgrade" : "Downgrade"}{" "}
                        (Recommended)
                      </span>
                    </div>
                    <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-800 w-fit">
                      {isUpgrade ? "No time lost" : "Keep current benefits"}
                    </Badge>
                  </Label>
                </div>
                {upgradeType === "scheduled" && (
                  <Alert
                    className={`ml-2 ${
                      pathname === "/pricing" || isDark
                        ? "bg-[#B16FF43D] border text-white"
                        : "bg-white text-black border border-gray-200"
                    }`}
                  >
                    {/* <Clock className="h-4 w-4" /> */}
                    <AlertDescription>
                      <strong>Recommended:</strong>
                      <div className="space-y-2 mt-2">
                        <div>
                          • Your current plan will{" "}
                          <strong>continue until its natural end</strong>
                        </div>
                        <div>
                          • You <strong>keep all current benefits</strong> until
                          then
                        </div>
                        <div>
                          • Your new plan will{" "}
                          <strong>start automatically</strong> after current
                          period ends
                        </div>
                        <div>
                          • You will be charged{" "}
                          <strong>
                            {formatCurrencyFromCents(targetPlan.price)}
                          </strong>{" "}
                          for the new billing cycle
                        </div>
                        <div className="text-green-600 font-medium mt-2">
                          No loss of time or money - you get full value from
                          your current plan.
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Immediate Change Option */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="immediate"
                    id="immediate"
                    className=""
                  />
                  <Label
                    htmlFor="immediate"
                    className="flex flex-col sm:flex-row sm:items-center gap-2 cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      {/* <Zap className="h-4 w-4 text-orange-600 flex-shrink-0" /> */}
                      <span className="font-medium text-md">
                        Immediate {isUpgrade ? "Upgrade" : "Downgrade"}
                      </span>
                    </div>
                    <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-800 w-fit">
                      {isUpgrade
                        ? "Instant access - lose time"
                        : "Instant change - lose time"}
                    </Badge>
                  </Label>
                </div>
                {upgradeType === "immediate" && (
                  <Alert
                    className={`ml-2 ${
                      pathname === "/pricing" || isDark
                        ? "bg-[#B16FF43D] text-white"
                        : "bg-white text-black border border-gray-200"
                    }`}
                  >
                    {/* <AlertTriangle className="h-4 w-4" /> */}
                    <AlertDescription>
                      <strong>Important:</strong>{" "}
                      {isUpgrade ? (
                        <>
                          <div className="space-y-2">
                            <div>
                              • Your current subscription will be{" "}
                              <strong>cancelled immediately</strong>
                            </div>
                            <div>
                              • You will{" "}
                              <strong>lose any remaining time</strong> on your
                              current plan
                            </div>
                            <div>
                              • A new subscription for{" "}
                              <strong>
                                {formatCurrencyFromCents(targetPlan.price)}
                              </strong>{" "}
                              will be created immediately
                            </div>
                            <div>
                              • You get <strong>instant access</strong> to new
                              plan features
                            </div>
                            <div className="text-orange-600 font-medium mt-2">
                              This means you lose money/time from your current
                              plan but gain immediate benefits.
                            </div>
                          </div>
                        </>
                      ) : targetPlan.price === 0 ? (
                        <>
                          <div className="space-y-2">
                            <div>
                              • Your paid subscription will be{" "}
                              <strong>cancelled immediately</strong>
                            </div>
                            <div>
                              • You will{" "}
                              <strong>lose any remaining time</strong> on your
                              current plan
                            </div>
                            <div>
                              • You will return to the{" "}
                              <strong>free plan immediately</strong>
                            </div>
                            <div>• No new charges will be made</div>
                            <div className="text-orange-600 font-medium mt-2">
                              This means you lose money/time from your current
                              plan.
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <div>
                              • Your current subscription will be{" "}
                              <strong>cancelled immediately</strong>
                            </div>
                            <div>
                              • You will{" "}
                              <strong>lose any remaining time</strong> on your
                              current plan
                            </div>
                            <div>
                              • A new subscription for{" "}
                              <strong>
                                {formatCurrencyFromCents(targetPlan.price)}
                              </strong>{" "}
                              will be created immediately
                            </div>
                            <div>
                              • You get <strong>immediate access</strong> to new
                              plan features
                            </div>
                            <div className="text-orange-600 font-medium mt-2">
                              This means you lose money/time from your current
                              plan.
                            </div>
                          </div>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Success Info */}
          <Alert
            className={`${
              isUpgrade
                ? "bg-green-50 border-green-200"
                : "bg-[#D9C0FF26] border-[#7F39EC]"
            }`}
          >
            {/* <CheckCircle2
               className={`h-4 w-4 ${
                isUpgrade ? "text-green-600" : "text-[#7F39EC]"
              } ${pathname === "/pricing" || isDark ? "text-white" : "text-black"}`}
            /> */}
            <AlertDescription
              className={`${isUpgrade ? "text-green-800" : "text-black"} ${
                pathname === "/pricing" || isDark ? "text-white" : "text-black"
              }`}
            >
              {upgradeType === "scheduled"
                ? `Your ${
                    isUpgrade ? "upgrade" : "downgrade"
                  } is scheduled for ${new Date(
                    scheduledDate
                  ).toLocaleDateString()}. You can cancel this scheduled change anytime before it takes effect.`
                : `Your ${
                    isUpgrade ? "upgrade" : "downgrade"
                  } will take effect immediately after confirmation.`}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex flex-col gap-4">
          <Button
            onClick={handleUpgrade}
            loading={isProcessing}
            loadingText="Processing..."
            className={`w-full py-6 rounded-full text-md 
                ${
                  pathname === "/pricing" || isDark
                    ? "bg-[#7F39EC] text-white hover:bg-[#6A29D9]"
                    : "bg-[#D9C0FF61] text-[#7F39EC] hover:bg-[#D9C0FF61]"
                }`}
          >
            {upgradeType === "scheduled" ? (
              <>
                {/* <Calendar className="h-4 w-4 mr-2" /> */}
                Schedule {isUpgrade ? "Upgrade" : "Downgrade"}
              </>
            ) : (
              <>
                {/* <Zap className="h-4 w-4 mr-2" /> */}
                {isUpgrade ? "Upgrade" : "Downgrade"} Now
                {targetPlan.price > 0 &&
                  ` - ${formatCurrencyFromCents(targetPlan.price)}`}
              </>
            )}
          </Button>
          <Button
            onClick={onClose}
            disabled={isProcessing}
            className={`py-6 rounded-full text-md 
                ${
                  pathname === "/pricing" || isDark
                    ? "text-md border-2 border-red-500 text-red-500 bg-[#06021D]"
                    : "bg-[#FF323224] text-[#E50000]"
                }`}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
