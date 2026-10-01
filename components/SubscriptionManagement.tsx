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
  CheckCircle2,
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
  Gem,
  ArrowRight,
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

export const SubscriptionManagement = memo(function SubscriptionManagement() {
  const searchParams = useSearchParams();
  const [currentSubscription, setCurrentSubscription] =
    useState<UserSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [hasEverHadPaidSubscription, setHasEverHadPaidSubscription] =
    useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedTargetPlan, setSelectedTargetPlan] =
    useState<SubscriptionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
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

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );

  const getDiscountedPrice = (price: number) => {
    return Math.round(price * 12 * 0.8);
  };

  const getFormattedFeaturesList = (plan: SubscriptionPlan) => {
    const name = plan.name.toUpperCase();
    const minBudgetFormatted = formatCurrencyFromCents(plan.features.minContestBudget);

    const list: string[] = [
      `Min. budget ${minBudgetFormatted}`,
      `Up to ${plan.features.maxWinnersPerContest} winners`,
      `${plan.features.commissionPercentage}% commission`,
    ];

    if (name === "EXPLORER") {
      list.push("Leaderboard-based campaigns only");
      list.push("CPM, Milestone & Dual Rewards campaigns in paid plans");
      list.push("Advanced");
    } else if (name === "STARTER") {
      list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
      list.push("All campaign types available");
      list.push("Advanced");
    } else if (name === "BUILDER") {
      list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
      list.push("All campaign types available");
      list.push("Prioritized customer support");
    } else if (name === "CHAMPION") {
      list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
      list.push("All campaign types available");
      list.push("Premium 24/7 dedicated support");
    } else {
      if (plan.features.contestTypes?.includes("cpm") || (plan.features.contestTypes && plan.features.contestTypes.length > 1)) {
        list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
        list.push("All campaign types available");
      } else {
        list.push("Leaderboard-based campaigns only");
        list.push("CPM, Milestone & Dual Rewards campaigns in paid plans");
      }
      if (plan.features.support === "priority") {
        list.push("Prioritized customer support");
      } else if (plan.features.support === "premium") {
        list.push("Premium 24/7 dedicated support");
      } else {
        list.push("Advanced");
      }
    }

    return list;
  };

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

      // Lifetime paid-plan flag (may be present even when there is no current subscription)
      if ("hasEverHadPaidSubscription" in subscriptionResult) {
        setHasEverHadPaidSubscription(
          Boolean(subscriptionResult.hasEverHadPaidSubscription)
        );
      } else {
        setHasEverHadPaidSubscription(false);
      }

      if (subscriptionResponse.ok) {
        setCurrentSubscription(subscriptionResult.subscription);
        setCurrentPlan(subscriptionResult.plan);

        // Fetch detailed billing information
        if (subscriptionResult.subscription) {
          try {
            const billingResponse = await fetch(
              `/api/subscriptions/billing-details?t=${Date.now()}`,
              { cache: "no-store" }
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
              isCanceled: subscriptionResult.subscription.status === "canceled",
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
        const trialDays = isEligibleForTrial(targetPlan) ? targetPlan.trialDays : undefined;

        console.log(`🔍 Creating subscription for plan ${planId}:`);
        console.log(`  - Target plan:`, targetPlan);
        console.log(`  - Trial eligible:`, isEligibleForTrial(targetPlan));
        console.log(`  - Trial days:`, trialDays);
        console.log(`  - Plan price:`, targetPlan.price);

        const response = await fetch("/api/subscriptions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: planId,
            priceId: targetPlan.prices?.monthly?.id,
            upgradeType: "immediate",
            trialDays,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Subscription creation failed");
        }

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          toast.success(result.message || "Subscription created successfully!");
          fetchCurrentSubscription();
        }
        return;
      }

      // For existing users with subscriptions, use upgrade API
      if (!currentPlan) return;

      // Check if user is on free plan and eligible for trial
      const trialDays = (isOnFreePlan() && isEligibleForTrial(targetPlan)) ? targetPlan.trialDays : undefined;

      console.log(`🔍 Upgrading subscription for plan ${planId}:`);
      console.log(`  - Target plan:`, targetPlan);
      console.log(`  - Current plan:`, currentPlan);
      console.log(`  - Is on free plan:`, isOnFreePlan());
      console.log(`  - Trial eligible:`, isEligibleForTrial(targetPlan));
      console.log(`  - Trial days:`, trialDays);

      const response = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetProductId: planId,
          targetPriceId: targetPlan.prices?.monthly?.id,
          upgradeType: "immediate",
          trialDays,
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
    if (!currentSubscription || currentSubscription.id === "free-plan") return;

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

      toast.success(result.message || "Scheduled change canceled successfully");
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
    // Check if no subscription at all
    if (!currentSubscription) {
      return true;
    }
    
    // Check if explicitly free-plan
    if (currentSubscription.id === "free-plan") {
      return true;
    }
    
    // Check if current plan is Explorer (free plan)
    if (currentPlan && currentPlan.name === "EXPLORER") {
      return true;
    }
    
    // Check if current plan has price 0 (free plan)
    if (currentPlan && currentPlan.price === 0) {
      return true;
    }
    
    return false;
  };

  const isEligibleForTrial = (plan: SubscriptionPlan) => {
    // Once a user has ever had ANY paid subscription (even discounted to $0),
    // they are no longer eligible for plan-level free trials.
    if (hasEverHadPaidSubscription) {
      return false;
    }

    // Only new users (no subscription) or users on free plans are eligible for trials
    if (!isOnFreePlan()) {
      return false;
    }
    
    // Only plans with trialDays are eligible
    if (!plan.trialDays || plan.trialDays <= 0) {
      return false;
    }
    
    // Only paid plans are eligible for trials
    if (plan.price === 0) {
      return false;
    }
    
    return true;
  };

  const getTrialDisplayText = (plan: SubscriptionPlan) => {
    if (!isEligibleForTrial(plan)) return null;
    
    return `${plan.trialDays}-day free trial`;
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case "EXPLORER":
        return <Trophy className="h-5 w-5" />;
      case "STARTER":
        return <Zap className="h-5 w-5" />;
      case "BUILDER":
        return <Star className="h-5 w-5" />;
      case "CHAMPION":
        return <Crown className="h-5 w-5" />;
      default:
        return <Trophy className="h-5 w-5" />;
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

  type FeatureItem = string | { title: string; sub?: string };

  const getPlanFeatures = (plan: SubscriptionPlan | null | undefined): FeatureItem[] => {
    if (!plan || !plan.features) return [];
    const features: FeatureItem[] = [];
    features.push(`${plan.features.maxActiveContests} active contests`);
    features.push(`${plan.features.commissionPercentage}% commission`);
    features.push(`Up to ${plan.features.maxWinnersPerContest} winners`);
    if (plan.features.analytics) {
      features.push(`${plan.features.analytics} analytics`);
    }
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
                  ? "border bg-[#4A00BE] rounded-lg px-5 py-2 text-base text-white hover:bg-[#4A00BE]"
                  : "border bg-[#4A00BE] rounded-lg px-5 py-2 text-base text-white hover:bg-[#4A00BE]"
              }
            >
              {change.type === "upgrade" ? "Upgrading" : "Downgrading"}
            </Badge>
          );
        }
        // If all scheduled changes are canceled or no scheduled changes, show "Canceling" since subscription will end
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 px-5 py-2 text-base font-semibold">Canceling</Badge>;
      }
      return <Badge className="border border-white bg-white rounded-full px-5 py-2 text-base font-semibold text-black hover:bg-white">Active</Badge>;
    }
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 px-5 py-2 text-base font-semibold">{subscription.status}</Badge>
    );
  };
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center py-8">
          {/* <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div> */}
          <PageLoadingSpinner mode="dark"/>
          <h2 className="text-2xl font-bold text-gray-300 mb-2">
            Loading Subscription Details
          </h2>
          <p className="text-gray-300">
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
    <div className="space-y-12">
      {/* Current Subscription Status */}
      {currentSubscription && currentPlan && (
        <div className="flex flex-col items-center justify-center gap-10 py-10 px-4 sm:px-8 bg-black">
          {/* Header Section */}
          <div className="flex flex-col items-center text-center gap-4 max-w-[760px] mx-auto">
            <h1 className="text-[32px] sm:text-[42px] md:text-[52px] font-bold text-white leading-[110%] tracking-tight">
              Manage Subscription
            </h1>
            <p className="text-[15px] sm:text-[18px] md:text-[20px] font-medium text-[#8E8E8E] leading-[150%]">
              Set your campaign, your brief, and your budget. Game of Creators puts it in front of a creator network, and pays out on verified performance
            </p>
          </div>

          {/* Subscription Card */}
          <div className="relative mx-auto w-full max-w-[1020px] overflow-hidden rounded-[36px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] p-7 sm:p-10 md:p-12 text-white shadow-2xl">
            {/* Top Section: Current Subscription + Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[#353535]">
              <div className="flex flex-col gap-3.5 items-start">
                <div className="text-[18px] sm:text-[20px] font-semibold text-[#8E8E8E] leading-[26px]">
                  Current Subscription
                </div>
                <div className="inline-flex items-center justify-center rounded-[103px] border border-black bg-gradient-to-r from-[#212121] to-[#131313] px-5 py-3 shadow-[inset_0px_-4px_8px_rgba(255,255,255,0.08)]">
                  <span className="text-sm font-semibold text-white leading-[18px]">
                    {currentPlan.displayName || currentPlan.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 flex-wrap">
                <div>
                  {getStatusBadge(currentSubscription)}
                </div>

                {currentPlan.price > 0 && (
                  <button
                    onClick={handleCustomerPortal}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center rounded-[14px] border border-white/20 bg-[#1E1E1E] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#2A2A2A] cursor-pointer"
                  >
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-5 w-5" />
                    )}
                    Manage Billing
                  </button>
                )}
              </div>
            </div>

            {/* Billing Period Section */}
            {billingDetails && (
              <div className="mt-8 flex flex-col gap-6">
                <div className="text-[18px] font-medium text-[#8E8E8E] leading-[22px]">
                  Billing Period
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  <div className="flex flex-col justify-start items-start gap-2 rounded-[16px] border border-[#353535] bg-[#191919] p-4 sm:p-5">
                    <span className="text-xs sm:text-sm font-medium text-[#8E8E8E] leading-[18px]">
                      Current Period
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-white leading-[22px]">
                      {formatDateRange(
                        billingDetails.currentPeriodStart,
                        billingDetails.currentPeriodEnd
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col justify-start items-start gap-2 rounded-[16px] border border-[#353535] bg-[#191919] p-4 sm:p-5">
                    <span className="text-xs sm:text-sm font-medium text-[#8E8E8E] leading-[18px]">
                      Next Billing Date
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-white leading-[22px]">
                      {formatDate(billingDetails.nextBillingDate)}
                    </span>
                  </div>

                  <div className="flex flex-col justify-start items-start gap-2 rounded-[16px] border border-[#353535] bg-[#191919] p-4 sm:p-5">
                    <span className="text-xs sm:text-sm font-medium text-[#8E8E8E] leading-[18px]">
                      Days until next billing
                    </span>
                    <span className="text-sm sm:text-base font-semibold text-white leading-[22px]">
                      {billingDetails.daysUntilNextBilling} Days
                    </span>
                  </div>
                </div>

                {/* Plan Status Information */}
                {billingDetails.cancelAtPeriodEnd &&
                  (scheduledChanges.length > 0 &&
                  scheduledChanges.some(
                    (change) => change.status !== "canceled"
                  ) ? (
                    // Show plan change information when there are active scheduled changes
                    <Alert className="border-[#7F39EC] text-white bg-[#D9C0FF26] mt-4">
                      <Info
                        className="h-4 w-4 text-white !text-white"
                        stroke="currentColor"
                      />
                      <AlertDescription>
                        <strong>Plan Change Scheduled:</strong> Your current
                        plan will end on{" "}
                        {formatDate(billingDetails.nextBillingDate)} and you'll
                        be{" "}
                        {scheduledChanges.find(
                          (change) => change.status !== "canceled"
                        )?.type === "upgrade"
                          ? "upgraded to a better plan"
                          : "downgraded to a different plan"}
                        . You'll continue to have access to all current features
                        until then.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    // Show cancellation warning when canceled but no active scheduled changes
                    <Alert className="border border-red-600/40 bg-red-900/30 text-red-100 mt-4">
                      <AlertTriangle className="h-4 w-4 text-red-300" />
                      <AlertDescription className="text-red-100">
                        <strong>Subscription Ending:</strong> Your subscription
                        will be canceled on{" "}
                        {formatDate(billingDetails.nextBillingDate)}. You'll
                        lose access to premium features after this date.
                      </AlertDescription>
                    </Alert>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

            {/* Scheduled Changes - Only show if there are actual changes */}
            {scheduledChanges.length > 0 &&
              scheduledChanges.some(
                (change) => change.status !== "canceled"
              ) && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    {/* <Clock className="h-5 w-5 text-green-600" /> */}
                    <span className="font-semibold text-white text-lg">
                      Upcoming Plan Change
                    </span>
                  </div>

                  <Alert className="border-[#7F39EC] bg-[#D9C0FF26]">
                    <Info
                      className="h-4 w-4 text-white !text-white"
                      stroke="currentColor"
                    />
                    <AlertDescription className="text-white">
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
                            <div className="bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)] p-5 rounded-xl border border-gray-600">
                              <h4 className="font-bold text-white  mb-4 text-lg">
                                Current Plan (Until{" "}
                                {billingDetails
                                  ? formatDate(billingDetails.nextBillingDate)
                                  : "next billing"}
                                )
                              </h4>
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                                      currentPlan?.name || ""
                                    )} text-white`}
                                  >
                                    {getPlanIcon(currentPlan?.name || "")}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-[#B16FF4]">
                                      {currentPlan?.displayName}
                                    </p>
                                    <p className="text-xl text-white  font-semibold">
                                      {formatCurrencyFromCents(
                                        currentPlan?.price || 0
                                      )}
                                      /month
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  {currentPlan &&
                                    getPlanFeatures(currentPlan).map(
                                      (feature, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2"
                                        >
                                          <div
                                            className="rounded-full p-2 flex items-center justify-center"
                                            style={{
                                              backgroundImage:
                                                "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                                            }}
                                          >
                                            <Check
                                              className="h-4 w-4 text-white"
                                              strokeWidth={3}
                                            />
                                          </div>
                                          <span className="text-md text-white ">
                                            {typeof feature === "string" ? feature : feature.title}
                                          </span>
                                        </div>
                                      )
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Upcoming Plan */}
                            <div className="bg-[linear-gradient(180deg,rgba(127,57,236,0.1225)_2%,rgba(127,57,236,0.03)_100%)] p-5 rounded-xl border border-gray-600">
                              <h4 className="font-bold text-white  mb-4 text-lg">
                                Upcoming Plan (From{" "}
                                {formatDate(change.scheduledDate)})
                              </h4>
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                                      change.targetPlan.name
                                    )} text-white`}
                                  >
                                    {getPlanIcon(change.targetPlan.name)}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-[#B16FF4]">
                                      {change.targetPlan.displayName}
                                    </p>
                                    <p className="text-xl text-white font-semibold">
                                      {formatCurrencyFromCents(
                                        change.targetPlan.price
                                      )}
                                      /month
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  {getPlanFeatures(change.targetPlan).map(
                                    (feature, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2"
                                      >
                                        <div
                                          className="rounded-full p-2 flex items-center justify-center"
                                          style={{
                                            backgroundImage:
                                              "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                                          }}
                                        >
                                          <Check
                                            className="h-4 w-4 text-white"
                                            strokeWidth={3}
                                          />
                                        </div>
                                        <span className="text-md text-white ">
                                          {typeof feature === "string" ? feature : feature.title}
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
                            <div className="border border-gray-600 rounded-lg py-5 px-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-start sm:items-center gap-3">
                                  {change.type === "upgrade" ? (
                                    <div className="p-2 rounded-full bg-[#D8C3FF]">
                                      <ArrowUp className="h-5 w-5 text-[#4A00BE]" />
                                    </div>
                                  ) : (
                                    <div className="p-2 rounded-full bg-[#D8C3FF]">
                                      <ArrowDown className="h-5 w-5 text-[#4A00BE]" />
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-bold text-white text-lg">
                                      {change.type === "upgrade"
                                        ? "Upgrade"
                                        : "Downgrade"}{" "}
                                      Summary
                                    </span>
                                    <p className="text-sm text-white">
                                      Effective from{" "}
                                      {formatDate(change.scheduledDate)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-left sm:text-right">
                                  <p className="font-bold text-xl text-white ">
                                    {change.priceDifference > 0 ? "+" : ""}
                                    {formatCurrencyFromCents(
                                      change.priceDifference
                                    )}
                                    /month
                                  </p>
                                  <p className="text-sm text-white">
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
                             
                              onClick={() =>
                                handleCancelScheduledChange(change.id)
                              }
                              disabled={isProcessing}
                              className="rounded-3xl relative text-white font-bold px-4 py-2 text-md overflow-hidden flex items-center justify-center gap-2"
                              style={{
                                background:
                                  "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                              }}
                            >
                               <div className="scan-line"></div>
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

            {/* Next Billing Cycle Info - Only show when plan actually continues (not canceled) */}
            {billingDetails?.cancelAtPeriodEnd &&
              scheduledChanges.length > 0 &&
              scheduledChanges.some(
                (change) => change.status !== "canceled"
              ) && (
                <div className="px-2 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    {/* <Calendar className="h-5 w-5 text-blue-600" /> */}
                    <span className="font-semibold text-lg text-white">
                      Next Billing Cycle
                    </span>
                  </div>
                  <div className="rounded-lg p-4 border border-gray-600">
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
                        <p className="font-semibold text-white">
                          {
                            scheduledChanges.find(
                              (change) => change.status !== "canceled"
                            )?.targetPlan.displayName
                          }
                        </p>
                        <p className="text-xl text-white font-semibold">
                          {formatCurrencyFromCents(
                            scheduledChanges.find(
                              (change) => change.status !== "canceled"
                            )?.targetPlan.price || 0
                          )}
                          /month
                        </p>
                        <p className="text-sm text-white">
                          Starting {formatDate(billingDetails.nextBillingDate)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3">
                      <p className="text-sm text-white">
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
                    <AlertTriangle className="h-5 w-5 text-purple-600" />
                    <span className="font-semibold text-white">
                      Subscription Ending
                    </span>
                  </div>
                  <div className="bg-gradient-to-b rounded-lg from-purple-900/10 to-purple-900/3 border-2 border-gray-700 p-6 ">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-r ${getPlanColor(
                          currentPlan?.name || ""
                        )} text-white`}
                      >
                        {getPlanIcon(currentPlan?.name || "")}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {currentPlan?.displayName}
                        </p>
                        <p className="text-sm text-white">
                          Ends on {formatDate(billingDetails.nextBillingDate)}
                        </p>
                        <p className="text-xs text-red-600">
                          No renewal scheduled
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <p className="text-sm text-white">
                        Your subscription will end and you'll lose access to
                        premium features.
                      </p>
                    </div>
                  </div>
                </div>
              )}

      {/* Available Plans */}
      <div className="space-y-6">
        <div className="max-w-[1200px] pt-12 mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-[45px] font-bold text-white leading-[1.1] transition-all duration-700 mb-3 tracking-tight">
            Available Plans
          </h2>
          <p className="text-center text-[#8E8E8E] text-base md:text-[20px] font-medium leading-[30px] max-w-2xl mx-auto mb-8 leading-relaxed">
            Choose the plan that best fits your needs
          </p>
        </div>

        {/* New User Info */}
        {!currentPlan && !currentSubscription && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 max-w-4xl mx-auto mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-5 w-5 text-purple-400" />
              <span className="font-semibold text-white">
                Getting Started
              </span>
            </div>
            <p className="text-gray-300 text-sm">
              New to our platform? Start with the{" "}
              <strong>Explorer Plan ($0.00/month)</strong> to test our features, or
              choose a paid plan to unlock more contests and lower commission rates.
            </p>
          </div>
        )}

        <div className="max-w-[1320px] w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 justify-items-center items-stretch">
          {subscriptionPlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const isProcessingThisPlan = processingPlanId === plan.id;
            const isFree = plan.price === 0;
            const formattedFeatures = getFormattedFeaturesList(plan);

            if (isCurrentPlan) {
              return (
                <div
                  key={plan.id}
                  className="w-full max-w-[317px] p-[2px] rounded-[26px] bg-[linear-gradient(180deg,#8B5CF6_0%,#8B5CF6_35%,rgba(139,92,246,0.5)_60%,transparent_85%)] transition-all duration-300 flex flex-col"
                >
                  <div className="w-full h-full rounded-[24px] bg-violet-600 flex flex-col overflow-hidden">
                    {/* Top Header Section */}
                    <div className="w-full pt-3 pb-5 bg-violet-600 rounded-t-[24px] flex items-center justify-center shadow-[inset_2px_2px_5px_0px_rgba(255,255,255,0.50)]">
                      <span className="text-white text-base font-semibold font-['Inter'] leading-6">
                        Current Plan
                      </span>
                    </div>

                    {/* Dark Card Body */}
                    <div className="w-full p-[26px_16px] rounded-t-[22px] rounded-b-[24px] -mt-3 bg-[linear-gradient(180deg,#353535_0%,#000000_100%)] flex flex-col justify-between items-center gap-8 flex-1 relative z-10">
                      {/* Top Header Section */}
                      <div className="w-[288px] max-w-full flex flex-col items-center gap-[17px]">
                        {/* Plan Pill Badge */}
                        <div className="px-4 py-2.5 bg-[linear-gradient(90deg,#212121_0%,#131313_100%)] shadow-[inset_0px_-4px_8px_rgba(255,255,255,0.08)] rounded-[103px] border border-black/60 flex items-center justify-center gap-2">
                          <span className="text-white text-xs font-semibold font-sans leading-[16.8px]">
                            {plan.displayName || `${plan.name} Plan`}
                          </span>
                        </div>

                        {/* Price & Description Container */}
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-white text-[30px] font-semibold leading-[42px]">
                              {formatCurrencyFromCents(
                                billingCycle === "monthly"
                                  ? plan.price
                                  : getDiscountedPrice(plan.price)
                              )}
                            </span>
                            <span className="text-white/60 text-base font-medium pb-1">
                              /month
                            </span>
                          </div>
                          <p className="w-[267px] max-w-full text-center text-white/60 text-sm font-normal leading-[19.6px]">
                            {plan.features.description}
                          </p>
                        </div>
                      </div>

                      {getTrialDisplayText(plan) && (
                        <div className="text-center">
                          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium inline-block">
                            {getTrialDisplayText(plan)}
                          </span>
                        </div>
                      )}

                      {/* Divider Line */}
                      <div className="w-full h-px bg-white/10"></div>

                      {/* Features List Section */}
                      <div className="w-full flex flex-col items-start gap-6 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[19px] h-[19px] flex items-center justify-center flex-shrink-0">
                            <Gem className="w-[17px] h-[17px] text-white" />
                          </div>
                          <span className="text-white text-[18px] font-medium leading-[18px]">
                            {plan.features.maxActiveContests} active contests
                          </span>
                        </div>

                        <div className="w-full flex flex-col items-start gap-3">
                          {formattedFeatures.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-left">
                              <div className="w-5 h-5 rounded-full bg-[linear-gradient(180deg,rgba(52,229,0,0.15)_0%,rgba(204,228,8,0.15)_49%,rgba(251,228,2,0.15)_100%)] flex items-center justify-center flex-shrink-0">
                                <div className="w-[14.3px] h-[14.3px] rounded-full bg-[#00FF6C] flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
                                </div>
                              </div>
                              <span className="text-white/70 text-sm font-normal leading-[19.6px]">
                                {feat}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="w-full p-[1px] bg-[linear-gradient(180deg,#434343_0%,#212121_100%)] rounded-[15px] overflow-hidden mt-auto">
                        <Button
                          disabled
                          className="w-full py-[14px] px-4 bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] rounded-[14px] text-white/50 text-base font-semibold border-0 cursor-not-allowed h-auto"
                        >
                          Current Plan
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={plan.id}
                className="w-full max-w-[317px] mt-[50px] p-[26px_16px] rounded-[24px] bg-[linear-gradient(180deg,#353535_0%,#000000_100%)] border border-[#434343] flex flex-col justify-between items-center gap-8 transition-all duration-300"
              >
                {/* Top Header Section */}
                <div className="w-[288px] max-w-full flex flex-col items-center gap-[17px]">
                  {/* Plan Pill Badge */}
                  <div className="px-4 py-2.5 bg-[linear-gradient(90deg,#212121_0%,#131313_100%)] shadow-[inset_0px_-4px_8px_rgba(255,255,255,0.08)] rounded-[103px] border border-black/60 flex items-center justify-center gap-2">
                    <span className="text-white text-xs font-semibold font-sans leading-[16.8px]">
                      {plan.displayName || `${plan.name} Plan`}
                    </span>
                  </div>

                  {/* Price & Description Container */}
                  <div className="w-full flex flex-col items-center gap-3">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-white text-[30px] font-semibold leading-[42px]">
                        {formatCurrencyFromCents(
                          billingCycle === "monthly"
                            ? plan.price
                            : getDiscountedPrice(plan.price)
                        )}
                      </span>
                      <span className="text-white/60 text-base font-medium pb-1">
                        /month
                      </span>
                    </div>
                    <p className="w-[267px] max-w-full text-center text-white/60 text-sm font-normal leading-[19.6px]">
                      {plan.features.description}
                    </p>
                  </div>
                </div>

                {getTrialDisplayText(plan) && (
                  <div className="text-center">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium inline-block">
                      {getTrialDisplayText(plan)}
                    </span>
                  </div>
                )}

                {/* Divider Line */}
                <div className="w-full h-px bg-white/10"></div>

                {/* Features List Section */}
                <div className="w-full flex flex-col items-start gap-6 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-[19px] h-[19px] flex items-center justify-center flex-shrink-0">
                      <Gem className="w-[17px] h-[17px] text-white" />
                    </div>
                    <span className="text-white text-[18px] font-medium leading-[18px]">
                      {plan.features.maxActiveContests} active contests
                    </span>
                  </div>

                  <div className="w-full flex flex-col items-start gap-3">
                    {formattedFeatures.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-left">
                        <div className="w-5 h-5 rounded-full bg-[linear-gradient(180deg,rgba(52,229,0,0.15)_0%,rgba(204,228,8,0.15)_49%,rgba(251,228,2,0.15)_100%)] flex items-center justify-center flex-shrink-0">
                          <div className="w-[14.3px] h-[14.3px] rounded-full bg-[#00FF6C] flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
                          </div>
                        </div>
                        <span className="text-white/70 text-sm font-normal leading-[19.6px]">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="w-full p-[1px] bg-[linear-gradient(180deg,#434343_0%,#212121_100%)] rounded-[15px] overflow-hidden mt-auto">
                  {isCurrentPlan ? (
                    <Button
                      disabled
                      className="w-full py-[14px] px-4 bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] rounded-[14px] text-white/50 text-base font-semibold border-0 cursor-not-allowed h-auto"
                    >
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgradeClick(plan)}
                      disabled={isProcessing}
                      className="w-full py-[14px] px-4 bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] hover:opacity-90 rounded-[14px] flex flex-row items-center justify-center gap-2 text-white text-base font-semibold border-0 shadow-none h-auto whitespace-nowrap"
                    >
                      {isProcessingThisPlan ? (
                        <span className="flex flex-row items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex flex-row items-center justify-center gap-2 whitespace-nowrap">
                          {!currentPlan && !currentSubscription ? (
                            isFree ? (
                              <><span>Start Free</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                            ) : isEligibleForTrial(plan) ? (
                              <><span>Start Free Trial</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                            ) : (
                              <><span>Subscribe</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                            )
                          ) : isOnFreePlan() && isEligibleForTrial(plan) ? (
                            <><span>Start Free Trial</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                          ) : currentPlan && plan.price > currentPlan.price ? (
                            <><span>Upgrade</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                          ) : currentPlan && plan.price < currentPlan.price ? (
                            <><span>Downgrade</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                          ) : (
                            <><span>Subscribe</span> <ArrowRight className="w-4 h-4 shrink-0" /></>
                          )}
                        </span>
                      )}
                    </Button>
                  )}
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
});
