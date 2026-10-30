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
  ArrowRight,
  Gem,
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
    const [hasEverHadPaidSubscription, setHasEverHadPaidSubscription] =
      useState(false);
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
          const trialDays = isEligibleForTrial(targetPlan) ? targetPlan.trialDays : undefined;

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
            toast.success(
              result.message || "Subscription created successfully!"
            );
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

    const getPlanIcon = (planName: string, className = "h-6 w-6") => {
      switch (planName) {
        case "EXPLORER":
          return <Gift className={className} />;
        case "STARTER":
          return <Star className={className} />;
        case "BUILDER":
          return <Zap className={className} />;
        case "CHAMPION":
          return <Crown className={className} />;
        default:
          return <Trophy className={className} />;
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

    const getDetailedPlanFeatures = (plan: SubscriptionPlan) => {
      const contestTypes = plan.features.contestTypes || [];
      const contestTypeLabel =
        contestTypes.includes("leaderboard") && contestTypes.includes("cpm")
          ? "Leaderboard & CPM"
          : contestTypes.includes("leaderboard")
            ? "Leaderboard only"
            : contestTypes.join(" & ") || "Contests";

      const supportLabel =
        plan.features.support === "premium"
          ? "Premium support"
          : plan.features.support === "priority"
            ? "Priority support"
            : "Standard support";

      const campaigns =
        plan.features.maxActiveContests === 1
          ? "1 live campaign"
          : `${plan.features.maxActiveContests} live campaigns`;

      const minBudget = `$${Math.round(plan.features.minContestBudget / 100)}`;

      return [
        { label: campaigns, highlight: true },
        { label: `Min. budget ${minBudget}` },
        { label: `Up to ${plan.features.maxWinnersPerContest} winners` },
        { label: `${plan.features.commissionPercentage}% commission` },
        { label: contestTypeLabel },
        { label: supportLabel },
      ];
    };

    const getPlanActionLabel = (
      plan: SubscriptionPlan,
      isCurrentPlan: boolean,
    ) => {
      if (isCurrentPlan) return "Your active plan";
      if (!currentPlan && !currentSubscription) {
        if (plan.price === 0) return "Start Free";
        if (isEligibleForTrial(plan)) return "Start Free Trial";
        return "Subscribe";
      }
      if (isOnFreePlan() && isEligibleForTrial(plan)) return "Start Free Trial";
      if (currentPlan && plan.price > currentPlan.price) return "Upgrade";
      if (currentPlan && plan.price < currentPlan.price) return "Downgrade";
      return "Select Plan";
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

    const statusBadgeClass =
      "rounded-full border-0 px-2.5 py-0.5 text-sm font-medium shadow-none";

    const getStatusBadge = (subscription: UserSubscription) => {
      if (subscription.status === "active") {
        if (subscription.cancel_at_period_end) {
          const activeChanges = scheduledChanges.filter(
            (change) => change.status !== "canceled",
          );
          if (activeChanges.length > 0) {
            const change = activeChanges[0];
            return (
              <Badge
                className={cn(
                  statusBadgeClass,
                  isDark
                    ? "bg-white/10 text-slate-200 hover:bg-white/10"
                    : "bg-[#F7F7F8] text-[#55555F] hover:bg-[#F7F7F8]",
                )}
              >
                {change.type === "upgrade" ? "Upgrading" : "Downgrading"}
              </Badge>
            );
          }
          return (
            <Badge
              className={cn(
                statusBadgeClass,
                isDark
                  ? "bg-red-900/50 text-red-200 hover:bg-red-900/50"
                  : "bg-red-50 text-red-700 hover:bg-red-50",
              )}
            >
              Canceling
            </Badge>
          );
        }
        return (
          <Badge
            className={cn(
              statusBadgeClass,
              isDark
                ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15"
                : "bg-[#57D3034F] text-[#2e7d32] hover:bg-[#57D3034F]",
            )}
          >
            Active
          </Badge>
        );
      }
      return (
        <Badge
          className={cn(
            statusBadgeClass,
            isDark
              ? "bg-red-900 text-red-200 hover:bg-red-900"
              : "bg-red-100 text-red-800 hover:bg-red-100",
          )}
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

    const mutedLabel = isDark ? "text-white/50" : "text-[#66666F]";
    const strongText = isDark ? "text-white" : "text-[#171717]";
    const softCard = cn(
      "rounded-2xl border",
      isDark ? "border-white/10 bg-[#161616]" : "border-neutral-200 bg-white",
    );
    const divider = isDark ? "border-white/10" : "border-neutral-200";

    return (
      <div className="space-y-8">
        {/* Section header */}
        <div>
          <h2
            className={cn(
              "text-[28px] font-semibold tracking-tight",
              strongText,
            )}
          >
            Subscription
          </h2>
          <p className={cn("mt-1.5 text-md", mutedLabel)}>
            Manage your plan, billing cycle, and payment methods.
          </p>
        </div>

        {/* Current Subscription Status */}
        {currentSubscription && currentPlan && (
          <div className="mt-2 space-y-5">
              <div className={cn("overflow-hidden", softCard)}>
                {/* Header row */}
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3
                        className={cn(
                          "text-2xl font-semibold tracking-tight sm:text-3xl",
                          strongText,
                        )}
                      >
                        {currentPlan.displayName || currentPlan.name}
                      </h3>
                      {getStatusBadge(currentSubscription)}
                    </div>
                    <p className={cn("mt-2 text-lg", mutedLabel)}>
                      {formatCurrencyFromCents(currentPlan.price)}
                      {currentPlan.price > 0 ? "/mo" : ""}
                      {billingDetails
                        ? ``
                        : currentPlan.price > 0
                          ? " · billed monthly"
                          : " · free forever"}
                    </p>
                  </div>

                  {currentPlan.price > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCustomerPortal}
                      disabled={isProcessing}
                      className={cn(
                        "h-11 w-full shrink-0 rounded-full px-5 text-base font-medium shadow-none sm:w-auto",
                        isDark
                          ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                          : "border-neutral-300 bg-white text-[#171717] hover:bg-neutral-50",
                      )}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                      )}
                      Manage Billing
                    </Button>
                  )}
                </div>

                {/* Billing meta */}
                {billingDetails && (
                  <div
                    className={cn(
                      "grid grid-cols-1 gap-4 border-t px-5 py-5 sm:grid-cols-3 sm:px-6",
                      divider,
                    )}
                  >
                    <div>
                      <p className={cn("text-sm", mutedLabel)}>Current period</p>
                      <p
                        className={cn(
                          "mt-1.5 text-base font-semibold leading-snug",
                          strongText,
                        )}
                      >
                        {formatDateRange(
                          billingDetails.currentPeriodStart,
                          billingDetails.currentPeriodEnd,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-sm", mutedLabel)}>Next billing</p>
                      <p
                        className={cn("mt-1.5 text-base font-semibold", strongText)}
                      >
                        {formatDate(billingDetails.nextBillingDate)}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-sm", mutedLabel)}>
                        Days remaining
                      </p>
                      <p
                        className={cn(
                          "mt-1.5 text-base font-semibold tabular-nums",
                          strongText,
                        )}
                      >
                        {billingDetails.daysUntilNextBilling} days
                      </p>
                    </div>
                  </div>
                )}

                {/* Features */}
                <div className={cn("border-t px-5 py-5 sm:px-6", divider)}>
                  <p className={cn("mb-3.5 text-sm font-medium", mutedLabel)}>
                    Included features
                  </p>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    {getPlanFeatures(currentPlan).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2.5">
                        <Check
                          className="h-5 w-5 shrink-0 text-[#57D303]"
                          strokeWidth={2.5}
                        />
                        <span className={cn("text-base", strongText)}>
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Plan status alerts */}
              {billingDetails?.cancelAtPeriodEnd &&
                (scheduledChanges.length > 0 &&
                scheduledChanges.some(
                  (change) => change.status !== "canceled",
                ) ? (
                  <Alert
                    className={cn(
                      "rounded-2xl border",
                      isDark
                        ? "border-white/10 bg-[#161616] text-white"
                        : "border-[#ECEDEF] bg-[#F7F7F8] text-[#171717]",
                    )}
                  >
                    <Info
                      className={cn(
                        "h-4 w-4",
                        isDark ? "text-slate-300" : "text-[#55555F]",
                      )}
                    />
                    <AlertDescription>
                      <strong>Plan Change Scheduled:</strong> Your current plan
                      will end on{" "}
                      {formatDate(billingDetails.nextBillingDate)} and you'll
                      be{" "}
                      {scheduledChanges.find(
                        (change) => change.status !== "canceled",
                      )?.type === "upgrade"
                        ? "upgraded to a better plan"
                        : "downgraded to a different plan"}
                      . You'll continue to have access to all current features
                      until then.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert
                    className={cn(
                      "rounded-2xl border",
                      isDark
                        ? "border-red-600/40 bg-red-900/30 text-red-100"
                        : "border-red-200 bg-red-50 text-red-900",
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4",
                        isDark ? "text-red-300" : "text-red-600",
                      )}
                    />
                    <AlertDescription
                      className={cn(isDark ? "text-red-100" : "text-red-900")}
                    >
                      <strong>Subscription Ending:</strong> Your subscription
                      will be canceled on{" "}
                      {formatDate(billingDetails.nextBillingDate)}. You'll lose
                      access to premium features after this date.
                    </AlertDescription>
                  </Alert>
                ))}

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

                    <Alert
                      className={cn(
                        "border",
                        isDark
                          ? "border-[#C9A7FF] bg-[#C9A7FF26] text-white"
                          : "border-[#7F39EC] bg-[#D9C0FF26] text-black"
                      )}
                    >
                      <Info
                        className={cn(
                          "h-4 w-4",
                          isDark ? "text-white" : "text-black"
                        )}
                      />
                      <AlertDescription
                        className={cn(isDark ? "text-white" : "text-black")}
                      >
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
                                  ? "border-white/10 bg-[#161616]"
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
                                  ? "border-white/10 bg-[#161616]"
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
                                  ? "border-white/10"
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
                        ? "border-white/10"
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
                        ? "border-white/10"
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
        )}

        {/* Available Plans */}
        <div
          className={cn(
            "space-y-6",
            currentSubscription && currentPlan ? "mt-10" : "mt-8",
          )}
        >
          <div>
            <h2
              className={cn(
                "mb-1 text-lg font-semibold md:text-xl",
                isDark ? "text-white" : "text-[#171717]",
              )}
            >
              Available plans
            </h2>
            <p
              className={cn(
                "text-md leading-relaxed",
                isDark ? "text-slate-200" : "text-[#66666F]",
              )}
            >
              {!currentPlan && !currentSubscription
                ? "Welcome! Start with our free plan or choose a paid plan that fits your needs"
                : "Choose the plan that best fits your needs"}
            </p>
          </div>

          {!currentPlan && !currentSubscription && (
            <div
              className={cn(
                "rounded-xl border p-4",
                isDark
                  ? "border-white/10 bg-[#0e0e0e]"
                  : "border-neutral-200 bg-[#f8f8f9]",
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Info
                  className={cn(
                    "h-5 w-5",
                    isDark ? "text-slate-200" : "text-[#55555F]",
                  )}
                />
                <span
                  className={cn(
                    "font-semibold",
                    isDark ? "text-white" : "text-[#171717]",
                  )}
                >
                  Getting Started
                </span>
              </div>
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-slate-200" : "text-[#55555F]",
                )}
              >
                New to our platform? Start with the{" "}
                <strong>Explorer Plan ($0.00)</strong> to test our features, or
                choose a paid plan to unlock more contests and better commission
                rates.
              </p>
            </div>
          )}

          <ul className="grid list-none grid-cols-1 gap-4 pt-[26px] sm:grid-cols-2 sm:gap-x-4 sm:gap-y-10 xl:grid-cols-4">
            {subscriptionPlans.map((plan) => {
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isProcessingThisPlan = processingPlanId === plan.id;
              const isMostPopular = plan.name === "BUILDER";
              const actionLabel = getPlanActionLabel(plan, isCurrentPlan);
              const detailedFeatures = getDetailedPlanFeatures(plan);
              const leadFeature = detailedFeatures.find((f) => f.highlight);
              const listFeatures = detailedFeatures.filter((f) => !f.highlight);
              return (
                <li
                  key={plan.id}
                  className={cn(
                    "relative flex w-full flex-col gap-[20px] rounded-[22px] border px-4 pb-4 pt-[22px]",
                    isMostPopular
                      ? "rounded-t-none border-2 border-[#8b5cf6]"
                      : isCurrentPlan
                        ? isDark
                          ? "border-[#22c55e]/50"
                          : "border-[rgb(74_222_128_/_0.35)]"
                        : isDark
                          ? "border-white/[0.08]"
                          : "border-neutral-300",
                    isDark
                      ? isCurrentPlan && !isMostPopular
                        ? "bg-[#141414] shadow-[inset_0_0_28px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "bg-[linear-gradient(0deg,#f3f4f6_0%,#ffffff_100%)] shadow-sm",
                  )}
                >
                  {isMostPopular && (
                    <span
                      className={cn(
                        "absolute -left-0.5 -right-0.5 bottom-full rounded-t-[14px] py-[5px] pb-1.5 text-center text-[11.5px] font-semibold uppercase tracking-[0.04em] text-white",
                        "bg-[#7c3aed] shadow-[inset_2px_2px_5px_rgb(255_255_255_/_0.35),inset_-1px_-1px_1px_rgb(0_0_0_/_0.23)]",
                      )}
                    >
                      Most popular
                    </span>
                  )}

                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <h3
                      className={cn(
                        "mb-1.5 rounded-full border px-3.5 py-[7px] text-[11.5px] font-semibold leading-snug",
                        isDark
                          ? "border-white/10 bg-[linear-gradient(90deg,#212121,#131313)] text-white shadow-[inset_0_-4px_8px_rgba(255,255,255,0.08)]"
                          : "border-neutral-200 bg-[linear-gradient(90deg,#f4f4f5,#ffffff)] text-[#171717] shadow-[inset_0_-4px_8px_rgb(0_0_0_/_0.04)]",
                      )}
                    >
                      {plan.displayName || plan.name}
                    </h3>

                    <p
                      className={cn(
                        "m-0 flex items-baseline justify-center gap-[3px] text-[26px] font-semibold leading-tight tracking-[-0.02em]",
                        isDark ? "text-white" : "text-[#171717]",
                      )}
                    >
                      {formatCurrencyFromCents(plan.price)}
                      <small
                        className={cn(
                          "text-[13px] font-medium tracking-normal",
                          isDark ? "text-white/50" : "text-[#737373]",
                        )}
                      >
                        /month
                      </small>
                    </p>

                    {getTrialDisplayText(plan) && (
                      <p className="m-0 text-[12px] font-medium text-[#16a34a]">
                        {getTrialDisplayText(plan)}
                      </p>
                    )}

                    <p
                      className={cn(
                        "m-0 max-w-[240px] text-[13px] leading-[1.65]",
                        isDark ? "text-white/50" : "text-[#55555F]",
                      )}
                    >
                      {plan.features.description}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "mx-[-16px] h-px",
                      isDark
                        ? "bg-white/10"
                        : "bg-[linear-gradient(90deg,transparent,#d4d4d8_50%,transparent)]",
                    )}
                    aria-hidden="true"
                  />

                  {leadFeature && (
                    <p
                      className={cn(
                        "m-0 inline-flex items-center gap-[9px] text-[16px] font-medium",
                        isDark ? "text-white" : "text-[#171717]",
                      )}
                    >
                      <Gem
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isDark ? "text-white" : "text-[#55555F]",
                        )}
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                      {leadFeature.label}
                    </p>
                  )}

                  <ul
                    className={cn(
                      "m-0 flex flex-1 list-none flex-col gap-5 p-0 text-[14px]",
                      isDark ? "text-white/70" : "text-[#55555F]",
                    )}
                  >
                    {listFeatures.map((feature) => (
                      <li
                        key={feature.label}
                        className="flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full",
                            isDark
                              ? "bg-[#22c55e] text-[#052e16]"
                              : "bg-[rgb(34_197_94_/_0.15)] text-[#16a34a]",
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-[11px] w-[11px]" strokeWidth={3} />
                        </span>
                        {feature.label}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-col gap-2">
                    {isCurrentPlan ? (
                      <span
                        className={cn(
                          "mt-1 inline-flex h-[42px] w-full items-center justify-center rounded-full text-sm font-semibold",
                          isDark
                            ? "bg-[#22c55e] text-[#052e16]"
                            : "border border-[rgb(74_222_128_/_0.3)] bg-[rgb(34_197_94_/_0.12)] text-[#16a34a]",
                        )}
                      >
                        Your active plan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpgradeClick(plan)}
                        disabled={isProcessing}
                        className={cn(
                          "group mt-1 inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-full border text-sm font-semibold transition-[border-color,transform,background] duration-150 disabled:opacity-60 active:scale-[0.98]",
                          isDark
                            ? "border-white/10 bg-[linear-gradient(180deg,#2a2a2a_0%,#121212_100%)] text-white hover:brightness-110"
                            : "border-neutral-300 bg-[linear-gradient(0deg,#f3f4f6,#ffffff)] text-[#171717] hover:bg-[linear-gradient(0deg,#ffffff,#f4f4f5)]",
                        )}
                        aria-label={`${actionLabel} to ${plan.displayName || plan.name}`}
                      >
                        {isProcessingThisPlan ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {actionLabel}
                            <ArrowRight
                              className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

       
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
