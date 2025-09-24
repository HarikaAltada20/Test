"use client";

import React, { useState, useEffect, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubscriptionUpgradeModal } from "./SubscriptionUpgradeModal";
import { toast } from "sonner";
import {
  Crown,
  Star,
  Zap,
  Trophy,
  Calendar,
  ExternalLink,
  CreditCard,
  Check,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Clock,
  Gift,
  Shield,
  Info,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  DollarSign,
  X,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { subscriptionPlans } from "@/constants/subscriptionPlans";
import type {
  UserSubscription,
  SubscriptionPlan,
} from "@/lib/subscription-types";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoadingSpinner } from "./loading/LoadingSpinner";
import { cn } from "@/lib/utils";

interface ScheduledChange {
  id: string;
  type: "upgrade" | "downgrade";
  targetPlan: SubscriptionPlan;
  scheduledDate: string;
  priceDifference: number;
  status: string;
}

export const SubscriptionManagementBilling = memo(
  function SubscriptionManagement() {
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<"light" | "dark">("light");
    const [currentSubscription, setCurrentSubscription] =
      useState<UserSubscription | null>(null);
    const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(
      null
    );
    const [isLoading, setIsLoading] = useState(true); // Start with loading true
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
    const [selectedTargetPlan, setSelectedTargetPlan] =
      useState<SubscriptionPlan | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingPlanId, setProcessingPlanId] = useState<string | null>(
      null
    );
    const [hasProcessedSuccess, setHasProcessedSuccess] = useState(false);
    const [hasInitialFetch, setHasInitialFetch] = useState(false);
    const [scheduledChanges, setScheduledChanges] = useState<ScheduledChange[]>(
      []
    );
    const [billingDetails, setBillingDetails] = useState<{
      currentPeriodStart: string;
      currentPeriodEnd: string;
      nextBillingDate: string;
      daysUntilNextBilling: number;
      isCanceled: boolean;
      cancelAtPeriodEnd: boolean;
    } | null>(null);

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

    // Only run once on mount
    useEffect(() => {
      fetchCurrentSubscription();
    }, []);

    // Handle success/error from URL params
    useEffect(() => {
      const success = searchParams.get("success");
      const error = searchParams.get("error");
      const sessionId = searchParams.get("session_id");

      if (success === "true" && sessionId) {
        setHasProcessedSuccess(true);
        toast.success("Subscription updated successfully!");
        // Refresh subscription data
        setTimeout(() => {
          fetchCurrentSubscription();
          setHasProcessedSuccess(false);
        }, 2000);
      } else if (error) {
        toast.error(`Subscription update failed: ${error}`);
      }
    }, [searchParams]);

    const fetchCurrentSubscription = async () => {
      try {
        // Prevent duplicate calls if already loading
        if (isLoading && hasInitialFetch) {
          console.log("Subscription fetch already in progress, skipping...");
          return;
        }

        setIsLoading(true);
        setHasInitialFetch(true);
        console.log("Fetching current subscription...");

        // Fetch basic subscription data
        const subscriptionResponse = await fetch("/api/subscriptions/current");
        const subscriptionResult = await subscriptionResponse.json();

        if (subscriptionResponse.ok) {
          setCurrentSubscription(subscriptionResult.subscription);
          setCurrentPlan(subscriptionResult.plan);

          // Fetch detailed billing information
          if (subscriptionResult.subscription) {
            try {
              const billingResponse = await fetch(
                "/api/subscriptions/billing-details"
              );
              const billingResult = await billingResponse.json();

              if (billingResponse.ok) {
                console.log("📋 Billing details received:", billingResult);
                setBillingDetails(billingResult.billingDetails);
                setScheduledChanges(billingResult.scheduledChanges);
                console.log(
                  "📋 Scheduled changes set:",
                  billingResult.scheduledChanges
                );
              } else {
                // Fallback to basic billing details
                const now = new Date();
                const periodStart = new Date(
                  subscriptionResult.subscription.current_period_start
                );
                const periodEnd = new Date(
                  subscriptionResult.subscription.current_period_end
                );
                const daysUntilNextBilling = Math.ceil(
                  (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );

                setBillingDetails({
                  currentPeriodStart: periodStart.toISOString(),
                  currentPeriodEnd: periodEnd.toISOString(),
                  nextBillingDate: periodEnd.toISOString(),
                  daysUntilNextBilling: Math.max(0, daysUntilNextBilling),
                  isCanceled:
                    subscriptionResult.subscription.status === "canceled",
                  cancelAtPeriodEnd:
                    subscriptionResult.subscription.cancel_at_period_end,
                });
                setScheduledChanges([]);
              }
            } catch (billingError) {
              console.error("Error fetching billing details:", billingError);
              // Fallback to basic billing details
              const now = new Date();
              const periodStart = new Date(
                subscriptionResult.subscription.current_period_start
              );
              const periodEnd = new Date(
                subscriptionResult.subscription.current_period_end
              );
              const daysUntilNextBilling = Math.ceil(
                (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );

              setBillingDetails({
                currentPeriodStart: periodStart.toISOString(),
                currentPeriodEnd: periodEnd.toISOString(),
                nextBillingDate: periodEnd.toISOString(),
                daysUntilNextBilling: Math.max(0, daysUntilNextBilling),
                isCanceled:
                  subscriptionResult.subscription.status === "canceled",
                cancelAtPeriodEnd:
                  subscriptionResult.subscription.cancel_at_period_end,
              });
              setScheduledChanges([]);
            }
          }

          console.log("Subscription data updated successfully");
        } else if (subscriptionResponse.status === 401) {
          // Handle unauthorized gracefully - user might not be logged in
          console.log("User not authenticated, showing available plans");
          setCurrentSubscription(null);
          setCurrentPlan(null);
          setBillingDetails(null);
          setScheduledChanges([]);
        } else {
          // Handle other errors gracefully
          console.log("No active subscription found, showing available plans");
          setCurrentSubscription(null);
          setCurrentPlan(null);
          setBillingDetails(null);
          setScheduledChanges([]);
        }
      } catch (error) {
        console.log("Error fetching subscription, showing available plans");
        setCurrentSubscription(null);
        setCurrentPlan(null);
        setBillingDetails(null);
        setScheduledChanges([]);
      } finally {
        setIsLoading(false);
      }
    };

    const handleUpgradeClick = (targetPlan: SubscriptionPlan) => {
      // Handle users without any subscription (new users)
      if (!currentPlan && !currentSubscription) {
        // New users can only select the free plan directly
        if (targetPlan.price === 0) {
          handleSubscribe(targetPlan.id);
          return;
        } else {
          // For paid plans, redirect to subscription creation
          handleSubscribe(targetPlan.id);
          return;
        }
      }

      if (!currentPlan) return;

      // For free plan users going to paid plans, bypass the modal and subscribe directly
      if (isOnFreePlan() && targetPlan.price > 0) {
        handleSubscribe(targetPlan.id);
        return;
      }

      // For all other cases, show the upgrade modal
      setSelectedTargetPlan(targetPlan);
      setUpgradeModalOpen(true);
    };

    const handleSubscribe = async (planId: string) => {
      setIsProcessing(true);
      setProcessingPlanId(planId);

      try {
        const targetPlan = subscriptionPlans.find((p) => p.id === planId);
        if (!targetPlan) {
          throw new Error("Target plan not found");
        }

        // For users without any subscription (new users)
        if (!currentPlan && !currentSubscription) {
          // Use the create subscription API for new users

          const response = await fetch("/api/subscriptions/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: planId,
              priceId: targetPlan.prices?.monthly?.id,
              upgradeType: "immediate",
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Subscription creation failed");
          }

          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          } else {
            toast.success(
              result.message || "Subscription created successfully!"
            );
            fetchCurrentSubscription();
          }
          return;
        }

        // For existing users with subscriptions, use upgrade API
        if (!currentPlan) return;

        const response = await fetch("/api/subscriptions/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetProductId: planId,
            targetPriceId: targetPlan.prices?.monthly?.id,
            upgradeType: "immediate",
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Subscription update failed");
        }

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          toast.success(result.message || "Subscription updated successfully!");
          fetchCurrentSubscription();
        }
      } catch (error) {
        console.error("Subscription error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to process subscription"
        );
      } finally {
        setIsProcessing(false);
        setProcessingPlanId(null);
      }
    };

    const handleCustomerPortal = async () => {
      if (!currentSubscription || currentSubscription.id === "free-plan")
        return;

      setIsProcessing(true);

      try {
        console.log("🔍 Requesting customer portal access...");
        const response = await fetch("/api/subscriptions/portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        console.log("📋 Portal response status:", response.status);
        const result = await response.json();
        console.log("📋 Portal response result:", result);

        if (!response.ok) {
          throw new Error(result.error || "Failed to access billing portal");
        }

        if (!result.portalUrl) {
          console.error("❌ No portal URL in response:", result);
          throw new Error("No portal URL received from server");
        }

        console.log("✅ Redirecting to portal URL:", result.portalUrl);
        window.location.href = result.portalUrl;
      } catch (error) {
        console.error("❌ Portal error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to access billing portal"
        );
      } finally {
        setIsProcessing(false);
      }
    };

    const handleCancelScheduledChange = async (scheduleId: string) => {
      console.log("🔍 Attempting to cancel scheduled change:", scheduleId);
      setIsProcessing(true);

      try {
        const response = await fetch(
          "/api/subscriptions/cancel-scheduled-change",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduleId }),
          }
        );

        console.log("📋 Response status:", response.status);
        const result = await response.json();
        console.log("📋 Response result:", result);

        if (!response.ok) {
          throw new Error(result.error || "Failed to cancel scheduled change");
        }

        toast.success(
          result.message || "Scheduled change canceled successfully"
        );
        // Refresh subscription data to update the UI
        fetchCurrentSubscription();
      } catch (error) {
        console.error("❌ Error canceling scheduled change:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to cancel scheduled change"
        );
      } finally {
        setIsProcessing(false);
      }
    };

    const isOnFreePlan = () => {
      return !currentSubscription || currentSubscription.id === "free-plan";
    };

    const getPlanIcon = (planName: string) => {
      switch (planName) {
        case "EXPLORER":
          return <Gift className="h-6 w-6" />;
        case "STARTER":
          return <Star className="h-6 w-6" />;
        case "BUILDER":
          return <Zap className="h-6 w-6" />;
        case "CHAMPION":
          return <Crown className="h-6 w-6" />;
        default:
          return <Trophy className="h-6 w-6" />;
      }
    };

    const getPlanColor = (planName: string) => {
      switch (planName) {
        case "EXPLORER":
          return "from-gray-400 to-gray-500";
        case "STARTER":
          return "from-blue-400 to-blue-500";
        case "BUILDER":
          return "from-purple-400 to-purple-500";
        case "CHAMPION":
          return "from-yellow-400 to-yellow-500";
        default:
          return "from-gray-400 to-gray-500";
      }
    };

    const getPlanFeatures = (plan: SubscriptionPlan) => {
      const features = [];
      features.push(`${plan.features.maxActiveContests} active contests`);
      features.push(`${plan.features.commissionPercentage}% commission`);
      features.push(`Up to ${plan.features.maxWinnersPerContest} winners`);
      features.push(`${plan.features.analytics} analytics`);
      return features;
    };

    const formatBillingPeriod = (startDate: string, endDate: string) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };

    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const formatDateRange = (startDate: string, endDate: string) => {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const startFormatted = start.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const endFormatted = end.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      return `${startFormatted} - ${endFormatted}`;
    };
    const isDark = mode === "dark";

    const getStatusBadge = (subscription: UserSubscription) => {
      if (subscription.status === "active") {
        if (subscription.cancel_at_period_end) {
          // Check if there are active scheduled changes to show upgrade/downgrade status
          const activeChanges = scheduledChanges.filter(
            (change) => change.status !== "canceled"
          );
          if (activeChanges.length > 0) {
            const change = activeChanges[0]; // Get the first active scheduled change
            return (
              <Badge
                className={
                  change.type === "upgrade"
                    ? isDark
                      ? "border bg-[#7F39EC] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
                      : "border bg-[#4A00BE] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
                    : isDark
                    ? "border bg-[#7F39EC] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
                    : "border bg-[#4A00BE] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
                }
              >
                {change.type === "upgrade" ? "Upgrading" : "Downgrading"}
              </Badge>
            );
          }
          // If all scheduled changes are canceled or no scheduled changes, show "Canceling" since subscription will end
          return (
            <Badge
              className={
                isDark
                  ? "bg-red-900 text-red-200 hover:bg-red-900"
                  : "bg-red-100 text-red-800 hover:bg-red-100"
              }
            >
              Canceling
            </Badge>
          );
        }
        return (
          <Badge
            className={
              isDark
                ? "border bg-[#7F39EC] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
                : "border bg-[#4A00BE] rounded-lg px-4 py-1.5 text-md text-white hover:bg-[#4A00BE]"
            }
          >
            Active
          </Badge>
        );
      }
      return (
        <Badge
          className={
            isDark
              ? "bg-red-900 text-red-200 hover:bg-red-900"
              : "bg-red-100 text-red-800 hover:bg-red-100"
          }
        >
          {subscription.status}
        </Badge>
      );
    };

    if (isLoading) {
      return (
        <div className="space-y-8">
          <div 
           className={cn(
            "text-center py-8",
            isDark ? "text-white" : "text-gray-600 "
          )}>
            {/* <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div> */}
            <PageLoadingSpinner mode="light" />
            <h2 className="text-2xl font-bold mb-2">
              Loading Subscription Details
            </h2>
            <p>
              Please wait while we fetch your subscription information...
            </p>
          </div>

          {/* <Card className="border-2 border-dashed border-gray-200 bg-gray-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-400" />
              <Skeleton className="h-6 w-48" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-10 w-32 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
          </CardContent>
        </Card> */}
          {/* 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="border-2 border-dashed border-gray-200 bg-gray-50/50"
            >
              <CardHeader className="pb-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-2">
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div> */}
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Current Subscription Status */}
        {currentSubscription && currentPlan && (
          <div>
            <div className="pl-1 mb-3">
              <CardTitle className="flex items-center gap-2 text-2xl">
                {/* <div className="border rounded-3xl p-2">
              <Shield className="h-6 w-6 text-black" />
              </div> */}
                Current Subscription
              </CardTitle>
            </div>
            <div className="p-1 space-y-6">
              {/* Plan Details */}
              <div className="border border-2 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-4 rounded-xl bg-gradient-to-r ${getPlanColor(
                      currentPlan.name
                    )} text-white shadow-lg`}
                  >
                    {getPlanIcon(currentPlan.name)}
                  </div>
                  <div>
                    <h3
                      className={cn(
                        "text-xl font-bold",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {currentPlan.displayName || currentPlan.name}
                    </h3>
                    <p
                      className={cn(
                        "text-lg font-medium",
                        isDark ? "text-purple-400" : "text-black"
                      )}
                    >
                      {formatCurrencyFromCents(currentPlan.price)}
                      {currentPlan.price > 0 ? "/month" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {getStatusBadge(currentSubscription)}
                  {currentPlan.price > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleCustomerPortal}
                      disabled={isProcessing}
                      className={cn(
                        "border text-md text-white transition-colors",
                        isDark ? "bg-[#7F39EC]" : "bg-[#4A00BE]"
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      Manage Billing
                    </Button>
                  )}
                </div>
              </div>

              {/* Billing Period Information */}
              {billingDetails && (
                <div className="px-2 space-y-4">
                  <div className="flex items-center gap-2">
                    {/* <div className="border rounded-3xl p-2">
                  <CalendarDays className="h-5 w-5 text-white " />
                  </div> */}
                    <span
                      className={cn(
                        "font-semibold  text-lg",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      Billing Period
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div
                      className={cn(
                        "rounded-2xl p-4 shadow-sm border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#D9C0FF26] border-[#7F39EC] text-black"
                      )}
                    >
                      <p className="text-sm  mb-1">Current Period</p>
                      <p className="font-semibold ">
                        {formatDateRange(
                          billingDetails.currentPeriodStart,
                          billingDetails.currentPeriodEnd
                        )}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl p-4 shadow-sm border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#D9C0FF26] border-[#7F39EC] text-black"
                      )}
                    >
                      <p className="text-sm  mb-1">Next Billing Date</p>
                      <p className="font-semibold">
                        {formatDate(billingDetails.nextBillingDate)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "rounded-2xl p-4 shadow-sm border",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                          : "bg-[#D9C0FF26] border-[#7F39EC] text-black"
                      )}
                    >
                      <p className="text-sm  mb-1">Days Until Next Billing</p>
                      <p className="font-semibold">
                        {billingDetails.daysUntilNextBilling} days
                      </p>
                    </div>
                  </div>

                  {/* Plan Status Information */}
                  {billingDetails.cancelAtPeriodEnd &&
                    (scheduledChanges.length > 0 &&
                    scheduledChanges.some(
                      (change) => change.status !== "canceled"
                    ) ? (
                      // Show plan change information when there are active scheduled changes
                      <Alert className="border-[#7F39EC] bg-[#D9C0FF26]">
                        <Info className="h-4 w-4 text-black" />
                        <AlertDescription>
                          <strong>Plan Change Scheduled:</strong> Your current
                          plan will end on{" "}
                          {formatDate(billingDetails.nextBillingDate)} and
                          you'll be{" "}
                          {scheduledChanges.find(
                            (change) => change.status !== "canceled"
                          )?.type === "upgrade"
                            ? "upgraded to a better plan"
                            : "downgraded to a different plan"}
                          . You'll continue to have access to all current
                          features until then.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      // Show cancellation warning when canceled but no active scheduled changes
                      <Alert className="border-red-200 bg-red-50">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <AlertDescription>
                          <strong>Subscription Ending:</strong> Your
                          subscription will be canceled on{" "}
                          {formatDate(billingDetails.nextBillingDate)}. You'll
                          lose access to premium features after this date.
                        </AlertDescription>
                      </Alert>
                    ))}
                </div>
              )}

              {/* Scheduled Changes - Only show if there are actual changes */}
              {scheduledChanges.length > 0 &&
                scheduledChanges.some(
                  (change) => change.status !== "canceled"
                ) && (
                  <div className="px-2 space-y-6">
                    <div className="flex items-center gap-2">
                      {/* <Clock className="h-5 w-5 text-green-600" /> */}
                      <span
                      className={cn(
                        "font-semibold text-gray-900 text-lg",
                        isDark
                          ? "text-white"
                          : "text-gray-900"
                      )}>
                        Upcoming Plan Change
                      </span>
                    </div>

                    <Alert className="border-[#7F39EC] bg-[#D9C0FF26]">
                      <Info className="h-4 w-4 text-black" />
                      <AlertDescription >
                        <strong>Important:</strong> Your plan will change on{" "}
                        {billingDetails
                          ? formatDate(billingDetails.nextBillingDate)
                          : "the next billing date"}
                        . Your current plan remains active until then.
                      </AlertDescription>
                    </Alert>

                    {scheduledChanges
                      .filter((change) => change.status !== "canceled")
                      .map((change, index) => (
                        <div key={index} className="space-y-6">
                          {/* Current vs Upcoming Plan Comparison */}
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                              {/* Current Plan */}
                              <div 
                              className={cn(
                                "p-5 rounded-xl border",
                                isDark
                                  ? "bg-[linear-gradient(180deg,rgba(201,167,255,0.1225)_2%,rgba(201,167,255,0.03)_100%)] border-gray-600"
                                  : "bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)] border-gray-300"
                              )}>
                                <h4 className={cn(
                                  "font-bold mb-4 text-lg",
                                  isDark
                                    ? "text-white"
                                    : "text-gray-900"
                                )}>
                                  Current Plan (Until{" "}
                                  {billingDetails
                                    ? formatDate(billingDetails.nextBillingDate)
                                    : "next billing"}
                                  )
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                                        currentPlan?.name || ""
                                      )} text-white`}
                                    >
                                      {getPlanIcon(currentPlan?.name || "")}
                                    </div>
                                    <div>
                                      <p 
                                       className={cn(
                                        "font-semibold",
                                        isDark
                                          ? "text-purple-400"
                                          : " text-[#B16FF4]"
                                      )}>
                                        {currentPlan?.displayName}
                                      </p>
                                      <p 
                                      className={cn(
                                        "text-xl font-semibold",
                                        isDark
                                          ? "text-white"
                                          : "text-black"
                                      )}>
                                        {formatCurrencyFromCents(
                                          currentPlan?.price || 0
                                        )}
                                        /month
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {currentPlan &&
                                      getPlanFeatures(currentPlan).map(
                                        (feature, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center gap-2"
                                          >
                                            <Check
                                            className={cn(
                                              "h-4 w-4 ",
                                              isDark
                                                ? "text-purple-400"
                                                : "text-purple-600"
                                            )} />
                                            <span 
                                            className={cn(
                                              "text-md ",
                                              isDark
                                                ? "text-white"
                                                : "text-black"
                                            )}>
                                              {feature}
                                            </span>
                                          </div>
                                        )
                                      )}
                                  </div>
                                </div>
                              </div>

                              {/* Upcoming Plan */}
                              <div 
                              className={cn(
                                "p-5 rounded-xl border",
                                isDark
                                  ? "bg-[linear-gradient(180deg,rgba(201,167,255,0.1225)_2%,rgba(201,167,255,0.03)_100%)] border-gray-600"
                                  : "bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)] border-gray-300"
                              )}>
                                <h4 className={cn(
                                  "font-bold mb-4 text-lg",
                                  isDark
                                    ? "text-white"
                                    : "text-gray-900"
                                )}>
                                  Upcoming Plan (From{" "}
                                  {formatDate(change.scheduledDate)})
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                                        change.targetPlan.name
                                      )} text-white`}
                                    >
                                      {getPlanIcon(change.targetPlan.name)}
                                    </div>
                                    <div>
                                      <p 
                                      className={cn(
                                        "font-semibold",
                                        isDark
                                          ? "text-purple-400"
                                          : " text-[#B16FF4]"
                                      )}>
                                        {change.targetPlan.displayName}
                                      </p>
                                      <p className={cn("text-xl font-semibold",
                                        isDark
                                          ? "text-white"
                                          : "text-black"
                                      )}>
                                        {formatCurrencyFromCents(
                                          change.targetPlan.price
                                        )}
                                        /month
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {getPlanFeatures(change.targetPlan).map(
                                      (feature, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2"
                                        >
                                          <Check 
                                          className={cn(
                                            "h-3 w-3",
                                            isDark
                                              ? "text-purple-400"
                                              : "text-purple-600"
                                          )} />
                                          <span className={cn(
                                            "text-md",
                                            isDark
                                              ? "text-white"
                                              : "text-black"
                                          )}>
                                            {feature}
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Price Change Summary */}
                            <div className="mt-6 pt-6">
                              <div 
                              className={cn(
                                "border rounded-lg py-5 px-4",
                                isDark
                                  ? "border-gray-600"
                                  : "border-gray-300"
                              )}>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                  <div className="flex items-start sm:items-center gap-3">
                                    {change.type === "upgrade" ? (
                                      <div 
                                      className={cn(
                                        "p-2 rounded-full",
                                        isDark
                                          ? "bg-[#FFFFFF42] text-white"
                                          : "bg-[#D8C3FF] text-[#4A00BE]"
                                      )}>
                                        <ArrowUp className="h-5 w-5" />
                                      </div>
                                    ) : (
                                      <div 
                                      className={cn(
                                        "p-2 rounded-full",
                                        isDark
                                          ? "bg-[#FFFFFF42] text-white"
                                          : "bg-[#D8C3FF] text-[#4A00BE]"
                                      )}>
                                        <ArrowDown className="h-5 w-5" />
                                      </div>
                                    )}
                                    <div>
                                      <span className={cn(
                                        "font-bold text-lg",
                                        isDark
                                          ? "text-white"
                                          : "text-gray-900"
                                      )}>
                                        {change.type === "upgrade"
                                          ? "Upgrade"
                                          : "Downgrade"}{" "}
                                        Summary
                                      </span>
                                      <p className={cn(
                                        "text-sm",
                                        isDark
                                          ? "text-white"
                                          : "text-gray-600"
                                      )}>
                                        Effective from{" "}
                                        {formatDate(change.scheduledDate)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-left sm:text-right">
                                    <p className={cn(
                                      "font-bold text-xl",
                                      isDark
                                        ? "text-white"
                                        : "text-gray-900"
                                    )}>
                                      {change.priceDifference > 0 ? "+" : ""}
                                      {formatCurrencyFromCents(
                                        change.priceDifference
                                      )}
                                      /month
                                    </p>
                                    <p className={cn(
                                      "text-sm",
                                      isDark
                                        ? "text-white"
                                        : "text-gray-600"
                                    )}>
                                      price change
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Cancel Button */}
                          {change.status !== "canceled" && (
                            <div className="flex justify-end pt-4">
                              <Button
                                variant="outline"
                                onClick={() =>
                                  handleCancelScheduledChange(change.id)
                                }
                                disabled={isProcessing}
                                className={cn(
                                  "relative transition-colors",
                                  isDark
                                    ? "bg-[#7F39EC] text-white"
                                    : "border-red-200 border-2 text-red-700 hover:border-red-300"
                                )}
                              >
                              
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                                Cancel Plan Change
                              </Button>
                            </div>
                          )}

                          {/* Already Canceled Message */}
                          {change.status === "canceled" && (
                            <div className="flex justify-end pt-4">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Check className="h-4 w-4 text-green-600" />
                                Plan change already canceled
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

              {/* Plan Features */}
              <div className="px-2 space-y-5">
                <h4
                  className={cn(
                    "font-medium text-lg text-black",
                    isDark ? "text-white" : "text-black"
                  )}
                >
                  Current Plan Features
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {getPlanFeatures(currentPlan).map((feature, index) => (
                    <div
                      key={index}
                      className={cn(
                        "border rounded-full p-3 flex justify-center items-center gap-2",
                        isDark
                          ? "border-gray-600 text-white"
                          : "border-gray-300 text-black"
                      )}
                    >
                      <Check
                        className="h-6 w-6 text-purple-500"
                        strokeWidth={3}
                      />

                      <span className="text-lg">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Billing Cycle Info - Only show when plan actually continues (not canceled) */}
              {billingDetails?.cancelAtPeriodEnd &&
                scheduledChanges.length > 0 &&
                scheduledChanges.some(
                  (change) => change.status !== "canceled"
                ) && (
                  <div className="px-2 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      {/* <Calendar className="h-5 w-5 text-blue-600" /> */}
                      <span className={cn(
                        "font-semibold text-lg",
                        isDark
                          ? "text-white"
                          : "text-gray-900"
                      )}>
                       
                        Next Billing Cycle
                      </span>
                    </div>
                    <div 
                    className={cn(
                      "rounded-lg p-4 border",
                      isDark
                        ? "border-gray-600"
                        : "border-gray-300"
                    )}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg  bg-gradient-to-r ${getPlanColor(
                            scheduledChanges.find(
                              (change) => change.status !== "canceled"
                            )?.targetPlan.name || ""
                          )} text-white`}
                        >
                          {getPlanIcon(
                            scheduledChanges.find(
                              (change) => change.status !== "canceled"
                            )?.targetPlan.name || ""
                          )}
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold",
                            isDark
                              ? "text-white"
                              : "text-gray-900"
                          )}>
                            {
                              scheduledChanges.find(
                                (change) => change.status !== "canceled"
                              )?.targetPlan.displayName
                            }
                          </p>
                          <p className={cn(
                            "text-xl font-semibold",
                            isDark
                              ? "text-white"
                              : "text-black"
                          )}>
                          
                            {formatCurrencyFromCents(
                              scheduledChanges.find(
                                (change) => change.status !== "canceled"
                              )?.targetPlan.price || 0
                            )}
                            /month
                          </p>
                          <p className={cn(
                            "text-sm",
                            isDark
                              ? "text-white"
                              : "text-black"
                          )}>
                            Starting{" "}
                            {formatDate(billingDetails.nextBillingDate)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3">
                        <p className={cn(
                          "text-sm",
                          isDark
                            ? "text-white"
                            : "text-gray-600"
                        )}>
                          {scheduledChanges.find(
                            (change) => change.status !== "canceled"
                          )?.type === "upgrade"
                            ? "You'll be upgraded to a better plan with more features."
                            : "You'll be downgraded to a different plan with adjusted features."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Subscription Ending Info - Show when subscription is being canceled */}
              {billingDetails?.cancelAtPeriodEnd &&
                (scheduledChanges.length === 0 ||
                  !scheduledChanges.some(
                    (change) => change.status !== "canceled"
                  )) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {/* <AlertTriangle className="h-5 w-5 text-red-600" /> */}
                      <span
                      className={cn(
                        "text-sm",
                        isDark
                          ? "text-white"
                          : "text-gray-900"
                      )}>
                        Subscription Ending
                      </span>
                    </div>
                    <div 
                    className={cn(
                      "border rounded-lg py-4 px-5",
                      isDark
                        ? "border-gray-600"
                        : "border-gray-400"
                    )}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                            currentPlan?.name || ""
                          )} text-white opacity-60`}
                        >
                          {getPlanIcon(currentPlan?.name || "")}
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold",
                            isDark
                              ? "text-white"
                              : "text-gray-900"
                          )}>
                            {currentPlan?.displayName}
                          </p>
                          <p className={cn(
                            "text-sm",
                            isDark
                              ? "text-white"
                              : "text-gray-600"
                          )}>
                            Ends on {formatDate(billingDetails.nextBillingDate)}
                          </p>
                          <p className={cn(
                            "text-xs text-red-600",
                            isDark
                              ? "text-white"
                              : "text-red-600"
                          )}>
                            No renewal scheduled
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3">
                        <p className={cn(
                          "text-sm",
                          isDark
                            ? "text-white"
                            : "text-gray-600"
                        )}>
                          Your subscription will end and you'll lose access to
                          premium features.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Available Plans */}
        <div className="space-y-6">
          {/* <h2 className="text-2xl font-bold mb-2">Available Plans</h2>
          <p className="text-gray-600">
            {!currentPlan && !currentSubscription
              ? "Welcome! Start with our free plan or choose a paid plan that fits your needs"
              : "Choose the plan that best fits your needs"}
          </p> */}
          <div className="pt-10 px-3">
            <h2
              className={cn(
                "text-lg md:text-2xl font-semibold text-black transition-all duration-700 mb-1 ease-out transform",
                isDark ? "text-white" : "text-black"
              )}
            >
              Available Plans
            </h2>
            <p
              className={cn(
                "text-md md:text-lg text-black mb-10 leading-relaxed",
                isDark ? "text-white" : "text-black"
              )}
            >
              {!currentPlan && !currentSubscription
                ? "Welcome! Start with our free plan or choose a paid plan that fits your needs"
                : "Choose the plan that best fits your needs"}
            </p>
          </div>
          {/* New User Info */}
          {!currentPlan && !currentSubscription && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-blue-900">
                  Getting Started
                </span>
              </div>
              <p className="text-blue-800 text-sm">
                New to our platform? Start with the{" "}
                <strong>Explorer Plan (Free)</strong> to test our features, or
                choose a paid plan to unlock more contests and better commission
                rates.
              </p>
            </div>
          )}

          <div className="px-2 pb-20 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 justify-items-center">
            {subscriptionPlans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isProcessingThisPlan = processingPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl w-full max-w-sm mx-auto p-6 hover:shadow-lg hover:scale-105 transition
                                     ${
                                       isCurrentPlan
                                         ? isDark
                                           ? "border-2 border-[#C9A7FF] shadow-xl"
                                           : "border-2 border-purple-500 shadow-xl"
                                         : isDark
                                         ? "border border-[#838383] shadow-xl"
                                         : "border border-[#838383] shadow-xl"
                                     } ${
                    isDark
                      ? "bg-[linear-gradient(180deg,rgba(201,167,255,0.1225)_2%,rgba(201,167,255,0.03)_100%)]"
                      : "bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)]"
                  }`}
                >
                  {isCurrentPlan && (
                    // <div className="absolute -top-3 right-4">
                    //     <Badge className="bg-green-600 text-white">Current Plan</Badge>
                    // </div>
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge
                        className={
                          isDark
                            ? "bg-purple-600 text-white"
                            : "bg-purple-600 text-white"
                        }
                      >
                        Current Plan
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mt-6 space-y-3">
                    <div
                      className={`mx-auto p-3 rounded-xl bg-gradient-to-r ${getPlanColor(
                        plan.name
                      )} text-white w-fit`}
                    >
                      {getPlanIcon(plan.name)}
                    </div>
                    <CardTitle
                      className={cn(
                        "text-xl",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {plan.displayName || plan.name}
                    </CardTitle>
                    <div
                      className={cn(
                        "text-3xl font-bold",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {formatCurrencyFromCents(plan.price)}
                      <span
                        className={cn(
                          "text-sm font-normal",
                          isDark ? "text-gray-300" : "text-gray-600"
                        )}
                      >
                        {plan.price > 0 ? "/month" : ""}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-md py-3 text-black",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {plan.features.description}
                    </p>
                  </div>

                  <div className="flex-1 mt-4 flex flex-col">
                    <div className="space-y-5 mb-6">
                      {getPlanFeatures(plan).map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Check
                            className={cn(
                              "h-4 w-4 ",
                              isDark ? "text-purple-400" : "text-purple-500"
                            )}
                          />
                          <span
                            className={cn(
                              "text-md",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-auto">
                      {isCurrentPlan ? (
                        <Button
                          variant="outline"
                          className={`w-full w-full rounded-3xl mt-8 relative font-bold px-8 py-5 text-lg overflow-hidden ${
                            isDark ? "text-white bg-[#7F39EC]" : "text-black"
                          }`}
                          disabled
                        >
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleUpgradeClick(plan)}
                          disabled={isProcessing}
                          className="w-full rounded-3xl mt-8 relative text-white text-white font-bold px-8 py-5 text-lg overflow-hidden"
                          style={{
                            background:
                              "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                          }}
                          variant={
                            !currentPlan &&
                            !currentSubscription &&
                            plan.price === 0
                              ? "default"
                              : "default"
                          }
                        >
                          {isProcessingThisPlan ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              {/* New users without subscription */}
                              {!currentPlan && !currentSubscription ? (
                                plan.price === 0 ? (
                                  <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Start Free
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Subscribe
                                  </>
                                )
                              ) : currentPlan &&
                                plan.price > currentPlan.price ? (
                                <>
                                  <TrendingUp className="h-4 w-4" />
                                  Upgrade
                                </>
                              ) : currentPlan &&
                                plan.price < currentPlan.price ? (
                                <>
                                  <ArrowDown className="h-4 w-4 mr-2" />
                                  Downgrade
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Select Plan
                                </>
                              )}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upgrade Modal */}
        {selectedTargetPlan && (
          <SubscriptionUpgradeModal
            isOpen={upgradeModalOpen}
            onClose={() => {
              setUpgradeModalOpen(false);
              setSelectedTargetPlan(null);
            }}
            currentPlan={currentPlan!}
            targetPlan={selectedTargetPlan}
            onUpgradeSuccess={() => {
              fetchCurrentSubscription();
              setUpgradeModalOpen(false);
              setSelectedTargetPlan(null);
            }}
            onUpgradeError={(error) => {
              console.error("Upgrade error:", error);
            }}
          />
        )}
      </div>
    );
  }
);
