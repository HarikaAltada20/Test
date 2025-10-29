"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Gift, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { hasSubmitted } from "@/lib/form-submissions";
import { useClientAuth } from "@/hooks/use-client-auth";

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserData {
  email: string;
  fullName: string;
  username: string;
}

export function SurveyModal({ isOpen, onClose }: SurveyModalProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSurveyTaken, setIsSurveyTaken] = useState(false);
  const [isRewardClaimed, setIsRewardClaimed] = useState(false);
  const { user, isAuthenticated } = useClientAuth();
  const supabase = createClient();

  // Google Form URL
  const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfQ8vf1rLEYhIb_PAgujJHjL2t_nHNaSn9CXHvLdbvIJzECKA/viewform";

  // Fetch user data from Supabase and check survey status
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // If authenticated, enrich with profile; otherwise rely on provided props
        if (isAuthenticated && user?.id) {
          const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("full_name, username, email")
            .eq("id", user.id)
            .single();

          if (profileError) {
            console.error("Error fetching user profile:", profileError);
          }

          const email = profile?.email || user?.email || "";
          const fullName = profile?.full_name || "";
          const username = profile?.username || "";

          setUserData({ email, fullName, username });

          // Check global form_submissions table to prevent extra attempts
          if (email) {
            const submitted = await hasSubmitted(email);
            if (submitted) {
              setIsSurveyTaken(true);
              setIsRewardClaimed(true); // Reflect completion based on form_submissions
            } else {
              setIsSurveyTaken(false);
              setIsRewardClaimed(false);
            }
          } else {
            setIsSurveyTaken(false);
            setIsRewardClaimed(false);
          }
        } else {
          // Anonymous user path
          setUserData({ email: "", fullName: "", username: "" });
          setIsSurveyTaken(false);
          setIsRewardClaimed(false);
        }
      } catch (error) {
        console.error("Error initializing survey state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, user, supabase]);

  const handleSurveyClick = async () => {
    // Re-check form submission status just-in-time to prevent multiple submissions
    try {
      const emailToCheck =
        (isAuthenticated ? user?.email : undefined) || userData?.email || "";
      if (emailToCheck) {
        const alreadySubmitted = await hasSubmitted(emailToCheck);
        if (alreadySubmitted) {
          setIsSurveyTaken(true);
          setIsRewardClaimed(true); // Reflect completion based on form_submissions
          return; // Block opening the Google Form again
        }
      }
    } catch (e) {
      console.error("Error re-checking submission status:", e);
      // Fail-open: allow flow to continue; server-side will still prevent duplicate rewards
    }

    // If reward is already claimed, prevent any action
    if (isSurveyTaken && isRewardClaimed) {
      console.log("Survey complete, reward already claimed");
      return;
    }

    // If survey already taken but reward not claimed, do nothing (kept for safety)
    if (isSurveyTaken && !isRewardClaimed) {
      console.log("Survey taken, waiting for processing");
      return;
    }

    let trackingSuccess = false;

    try {
      // Only track redemption for signed-in users
      if (isAuthenticated && user?.id) {
        const now = new Date().toISOString();
        const { data: existingRecord, error: checkError } = await supabase
          .from("survey_redemptions")
          .select("id, survey_button_clicked")
          .eq("user_id", user.id)
          .maybeSingle();

        if (checkError && checkError.code !== "PGRST116") {
          console.error("Error checking survey redemption:", checkError);
          throw new Error("Failed to check survey redemption status");
        }

        if (existingRecord) {
          const { error: updateError } = await supabase
            .from("survey_redemptions")
            .update({
              survey_button_clicked: true,
              survey_button_clicked_at: now,
            })
            .eq("user_id", user.id);

          if (updateError) {
            console.error("Error updating survey redemption:", updateError);
            throw new Error("Failed to update survey redemption");
          } else {
            trackingSuccess = true;
          }
        } else {
          const { error: insertError } = await supabase
            .from("survey_redemptions")
            .insert({
              user_id: user.id,
              survey_button_clicked: true,
              survey_button_clicked_at: now,
              survey_reward_claimed: false,
            });

          if (insertError) {
            console.error("Error creating survey redemption:", insertError);
            throw new Error("Failed to create survey redemption");
          } else {
            trackingSuccess = true;
          }
        }
      } else {
        // Anonymous users: don't block opening if tracking fails; just proceed
        trackingSuccess = true;
      }
    } catch (error) {
      console.error("Error tracking survey button click:", error);
      // For anonymous users, allow proceeding; for authed users, block on tracking failure
      if (isAuthenticated && user?.id) {
        alert(
          "Failed to track survey access. Please try again or contact support."
        );
        return;
      }
    }

    // Only open the form and update state if tracking was successful
    if (!trackingSuccess) {
      return;
    }

    // Build URL with pre-filled data
    let url = GOOGLE_FORM_URL;
    const params = new URLSearchParams();

    // Use fetched data
    const email = userData?.email || user?.email || "";
    const fullName = userData?.fullName || "";
    const username = userData?.username || "";

    // Define form fields mapping - Update these entry IDs to match your Google Form
    const formFields = [
      { value: fullName, entryId: "entry.1512173724" }, // Full Name field
      { value: username, entryId: "entry.1649192329" }, // Username field
      { value: email, entryId: "entry.1986787580" }, // Email field
    ];

    // Add non-empty fields to parameters
    const validFields = formFields.filter(
      (field) => field.value && field.value.trim() !== ""
    );

    validFields.forEach((field) => {
      params.append(field.entryId, field.value);
    });

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Add timestamp to prevent caching and ensure fresh form load
    const timestamp = Date.now();
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}_t=${timestamp}`;

    // Redirect to Google Form in the same tab
    window.location.assign(url);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Survey
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Determine button text and state
  let buttonText = "Take Survey";
  let buttonDisabled = false;
  let buttonClassName = "bg-[#4A00BE] text-white";

  if (isSurveyTaken) {
    buttonText = isRewardClaimed ? "Survey Complete" : "Survey Received";
    buttonDisabled = true;
    buttonClassName =
      "border border-gray-900 bg-white text-gray-900 font-semibold cursor-not-allowed";
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            Take Our Survey
          </DialogTitle>
          <DialogDescription>
            Share your valuable feedback and help us improve the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Survey Content - Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6 items-center">
            {/* Left Column - Image */}
            <div className="flex justify-center">
              <img
                src="/images/360_F_1018050560_kQHuMNjN5tHrhUKxnT9dBbOoxjCEe9cu-removebg-preview.avif"
                alt="Survey illustration"
                className="h-[200px] w-auto object-contain"
              />
            </div>

            {/* Right Column - Description */}
            <div className="space-y-4">
              {/* <h3 className="font-semibold text-lg text-gray-900">
                Take Our Survey
              </h3> */}
              <p className="text-md text-gray-900 leading-relaxed">
                We really value honest and thoughtful feedback. By filling out
                this survey form, you get a guaranteed $0.40 reward.
                Additionally, we will give an extra $5 bonus to the most genuine
                and well-thought-out survey responses. Take your time, read each
                question carefully, and answer with full honesty — we'll pick
                the best responses based on clarity, effort, and real insights.
              </p>

              {/* Reward Badge */}
              {/* <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-3 rounded-lg border border-purple-200 shadow-sm">
                <Gift className="h-5 w-5 text-purple-600 animate-pulse flex-shrink-0" />
                <span className="text-sm font-semibold text-purple-700">
                  Earn $0.40 reward upon completion!
                </span>
              </div> */}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={buttonDisabled}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSurveyClick}
              disabled={buttonDisabled}
              className={`${buttonClassName} flex-1`}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {buttonText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
