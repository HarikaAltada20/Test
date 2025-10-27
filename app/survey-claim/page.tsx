"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientAuth } from "@/hooks/use-client-auth";
import { createClient } from "@/utils/supabase/client";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Gift,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SurveyClaimPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redemptionStatus, setRedemptionStatus] = useState<{
    clicked: boolean;
    claimed: boolean;
  } | null>(null);
  const { user, isAuthenticated, isLoading: authLoading } = useClientAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Wait for auth check to complete before making any decisions
    if (authLoading) {
      return;
    }

    // Only redirect if auth check is complete and user is not authenticated
    if (!isAuthenticated) {
      router.push("/auth/signin");
      return;
    }

    // If authenticated but no user yet, wait
    if (!user?.id) {
      return;
    }

    const checkRedemptionStatus = async () => {
      try {
        const { data: redemption, error: redemptionError } = await supabase
          .from("survey_redemptions")
          .select("survey_button_clicked, survey_reward_claimed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (redemptionError && redemptionError.code !== "PGRST116") {
          console.error("Error checking redemption status:", redemptionError);
          setError("Failed to check redemption status");
          return;
        }

        setRedemptionStatus({
          clicked: redemption?.survey_button_clicked || false,
          claimed: redemption?.survey_reward_claimed || false,
        });
      } catch (error: any) {
        console.error("Error checking redemption status:", error);
        setError("Failed to check redemption status");
      } finally {
        setIsLoading(false);
      }
    };

    checkRedemptionStatus();
  }, [authLoading, isAuthenticated, user, router, supabase]);

  const handleClaimReward = async () => {
    try {
      setIsRedeeming(true);
      setError(null);

      // Redeem the survey bonus
      const response = await fetch("/api/coupons/survey-bonus", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to redeem bonus");
      }

      // Successfully redeemed, redirect to earnings page
      router.push("/dashboard/earnings");
    } catch (error: any) {
      console.error("Error redeeming bonus:", error);
      setError(error.message || "Failed to redeem bonus. Please try again.");
    } finally {
      setIsRedeeming(false);
    }
  };

  // Show loading while checking auth or redemption status
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000825] via-[#1a0b3d] to-[#000825] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="relative">
            {/* <div className="absolute inset-0 bg-gradient-to-r from-[#6C43D0] to-[#A87313] rounded-full blur-lg opacity-30 animate-pulse"></div> */}
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-6 relative z-10 text-[#6C43D0]" />
          </div>
          <div className="space-y-2">
            <p className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Loading Your Reward
            </p>
            <p className="text-gray-400 animate-pulse">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!redemptionStatus) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000825] via-[#1a0b3d] to-[#000825] flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-yellow-50/10 to-orange-50/10 backdrop-blur-sm border border-yellow-500/30 rounded-2xl p-8 shadow-2xl">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-lg opacity-20"></div>
                <XCircle className="h-16 w-16 text-yellow-400 mx-auto mb-6 relative z-10" />
              </div>
              <h2 className="text-2xl font-bold text-yellow-300 mb-3">
                Survey Not Started
              </h2>
              <p className="text-yellow-200/80 text-lg leading-relaxed">
                Please click the survey button from the app first to access the
                survey and unlock your reward.
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-8 bg-gradient-to-r from-[#6C43D0] to-[#A87313] hover:from-[#5A3BC0] hover:to-[#966B1A] text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (redemptionStatus.claimed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#000825] via-[#1a0b3d] to-[#000825] flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-green-50/10 to-emerald-50/10 backdrop-blur-sm border border-green-500/30 rounded-2xl p-8 shadow-2xl">
              <div className="relative">
                {/* <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full blur-lg opacity-20 animate-pulse"></div> */}
                <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-6 relative z-10" />
              </div>
              <h2 className="text-3xl font-bold text-green-300 mb-4">
                Reward Already Claimed!
              </h2>
              <div className="space-y-3">
                <p className="text-green-200/90 text-lg">
                  You have successfully claimed your
                </p>
                <div className="inline-flex items-center bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full px-6 py-3 border border-green-400/30">
                  <Gift className="h-6 w-6 text-green-400 mr-2" />
                  <span className="text-2xl font-bold text-green-300">
                    $0.40
                  </span>
                  <span className="text-green-200/80 ml-2">Survey Bonus</span>
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push("/dashboard/earnings")}
            className="mt-8 bg-gradient-to-r from-[#6C43D0] to-[#A87313] hover:from-[#5A3BC0] hover:to-[#966B1A] text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            View Earnings
          </Button>
        </div>
      </div>
    );
  }

  // if (!redemptionStatus.clicked) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <div className="text-center max-w-md mx-auto p-6">
  //         <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
  //           <MessageSquare className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
  //           <p className="text-yellow-700 font-medium">Survey Not Started</p>
  //           <p className="text-yellow-600 text-sm mt-2">
  //             Please click the survey button from the app first to access the
  //             survey.
  //           </p>
  //         </div>
  //         <Button onClick={() => router.push("/dashboard")} className="mt-4">
  //           Go to Dashboard
  //         </Button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000825] via-[#1a0b3d] to-[#000825] flex items-center justify-center p-4">
      <div className="text-center max-w-lg mx-auto">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-[#6C43D0]/10 to-[#A87313]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-to-r from-[#A87313]/10 to-[#6C43D0]/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative">
          {/* Main card with enhanced styling */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#6C43D0]/20 to-[#A87313]/20 rounded-3xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-10 shadow-2xl">
              {/* Header section */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-[#6C43D0] to-[#A87313] rounded-full blur-lg opacity-30"></div>
                <div className="relative flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6C43D0] to-[#A87313] rounded-full blur-md opacity-50"></div>
                    <MessageSquare className="h-20 w-20 text-white mx-auto mb-4 relative z-10" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-6 w-6 text-[#A87313]" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                      Claim Your Reward
                    </h1>
                    <Sparkles className="h-6 w-6 text-[#A87313]" />
                  </div>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-md">
                    Thank you for completing the survey! You've earned a special
                    bonus for your participation.
                  </p>
                </div>
              </div>

              {/* Reward amount display */}
              <div className="mb-8">
                <div className="inline-flex items-center bg-gradient-to-r from-[#6C43D0]/20 to-[#A87313]/20 rounded-2xl px-8 py-4 border border-[#6C43D0]/30">
                  <Gift className="h-8 w-8 text-[#A87313] mr-3" />
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-1">
                      $0.40
                    </div>
                    <div className="text-sm text-gray-300">Survey Bonus</div>
                  </div>
                </div>
              </div>

              {/* Error display */}
              {error && (
                <div className="mb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-xl blur-sm"></div>
                  <div className="relative bg-gradient-to-br from-red-50/10 to-pink-50/10 backdrop-blur-sm border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-400" />
                      <p className="text-red-300 font-medium text-sm">Error</p>
                    </div>
                    <p className="text-red-200/80 text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-4">
                <Button
                  onClick={handleClaimReward}
                  disabled={isRedeeming}
                  className="w-full bg-gradient-to-r from-[#6C43D0] to-[#A87313] hover:from-[#5A3BC0] hover:to-[#966B1A] text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  size="lg"
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                      Claiming Your Reward...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 mr-3" />
                      Claim $0.40 Reward
                    </>
                  )}
                </Button>

                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full border border-gray-400/30 py-3 rounded-xl text-gray-300 hover:text-white hover:border-gray-300 transition-all duration-300 hover:bg-white/5"
                >
                  <ArrowLeft className="h-4 w-4 mr-2 inline" />
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
