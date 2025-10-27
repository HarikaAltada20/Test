"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useClientAuth } from "@/hooks/use-client-auth";
import { useRouter } from "next/navigation";

interface SurveyButtonProps {
  className?: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  // Optional props for manual override (will be used if provided)
  userName?: string;
  userEmail?: string;
  userId?: string;
  userFullName?: string;
  userUsername?: string;
}

interface UserData {
  email: string;
  fullName: string;
  username: string;
}

export function SurveyButton({
  className = "",
  variant = "default",
  size = "default",
  userName = "",
  userEmail = "",
  userId = "",
  userFullName = "",
  userUsername = "",
}: SurveyButtonProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSurveyTaken, setIsSurveyTaken] = useState(false);
  const [isRewardClaimed, setIsRewardClaimed] = useState(false);
  const { user, isAuthenticated } = useClientAuth();
  const router = useRouter();
  const supabase = createClient();

  // Google Form URL - Note: Removed ?usp=pp_url to prevent "Continue current draft" popup
  const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfQ8vf1rLEYhIb_PAgujJHjL2t_nHNaSn9CXHvLdbvIJzECKA/viewform";

  // "https://docs.google.com/forms/d/e/1FAIpQLSfQ8vf1rLEYhIb_PAgujJHjL2t_nHNaSn9CXHvLdbvIJzECKA/viewform";

  // Fetch user data from Supabase and check survey status
  useEffect(() => {
    const fetchUserData = async () => {
      if (!isAuthenticated || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user profile data from users table
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("full_name, username, email")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching user profile:", profileError);
          console.log("Profile error details:", {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
          });
        } else {
          console.log("Successfully fetched profile:", profile);
        }

        // Use the fetched data or fallback to props
        const email = userEmail || profile?.email || user?.email || "";
        const fullName = userFullName || profile?.full_name || "";
        const username = userUsername || profile?.username || "";

        // Debug: Log the email sources for troubleshooting
        console.log("Email sources:", {
          userEmail,
          profileEmail: profile?.email,
          userAuthEmail: user?.email,
          finalEmail: email,
        });

        setUserData({
          email,
          fullName,
          username,
        });

        // Check if user has already taken the survey and if reward is claimed
        const { data: redemption, error: redemptionError } = await supabase
          .from("survey_redemptions")
          .select("survey_button_clicked, survey_reward_claimed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          !redemptionError &&
          redemption &&
          redemption.survey_button_clicked
        ) {
          console.log("Survey already taken");
          setIsSurveyTaken(true);

          if (redemption.survey_reward_claimed) {
            console.log("Reward already claimed");
            setIsRewardClaimed(true);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        // Fallback to props if available
        const fallbackEmail = userEmail || user?.email || "";
        console.log("Using fallback email:", fallbackEmail);
        setUserData({
          email: fallbackEmail,
          fullName: userFullName || "",
          username: userUsername || "",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isAuthenticated, user, userEmail, userFullName, userUsername, supabase]);

  const handleSurveyClick = async () => {
    if (!isAuthenticated || !user?.id) {
      console.error("User not authenticated");
      return;
    }

    // If reward is already claimed, prevent any action
    if (isSurveyTaken && isRewardClaimed) {
      console.log("Survey complete, reward already claimed");
      return;
    }

    // If survey already taken but reward not claimed, redirect to claim page
    if (isSurveyTaken && !isRewardClaimed) {
      console.log(
        "Survey taken but reward not claimed, redirecting to claim page"
      );
      router.push("/survey-claim");
      return;
    }

    let trackingSuccess = false;

    try {
      // Track button click in database
      const now = new Date().toISOString();

      // Check if survey_redemptions record exists
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
        // Update existing record
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
          console.log("✅ Survey button click tracked");
          trackingSuccess = true;
        }
      } else {
        // Create new record
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
          console.log("✅ Survey button click tracked");
          trackingSuccess = true;
        }
      }
    } catch (error) {
      console.error("Error tracking survey button click:", error);
      alert(
        "Failed to track survey access. Please try again or contact support."
      );
      return;
    }

    // Only open the form and update state if tracking was successful
    if (!trackingSuccess) {
      return;
    }

    setIsSurveyTaken(true);

    // Build URL with pre-filled data
    let url = GOOGLE_FORM_URL;
    const params = new URLSearchParams();

    // Use fetched data or fallback to props
    const email = userData?.email || userEmail || user?.email || "";
    const fullName = userData?.fullName || userFullName || "";
    const username = userData?.username || userUsername || "";

    // Define form fields mapping - Update these entry IDs to match your Google Form
    // To get correct entry IDs: Go to your Google Form → Responses → View in Sheets → Check column headers
    const formFields = [
      { value: fullName, entryId: "entry.1512173724" }, // Full Name field
      { value: username, entryId: "entry.1649192329" }, // Username field
      { value: email, entryId: "entry.1986787580" }, // Email field
    ];

    // Debug: Log each field value
    console.log(
      "Form fields debug:",
      formFields.map((field) => ({
        entryId: field.entryId,
        value: field.value,
        isEmpty: !field.value || field.value.trim() === "",
        trimmedValue: field.value?.trim(),
      }))
    );

    // Add non-empty fields to parameters
    const validFields = formFields.filter(
      (field) => field.value && field.value.trim() !== ""
    );
    console.log("Valid fields count:", validFields.length);

    validFields.forEach((field) => {
      console.log(`Adding field: ${field.entryId} = ${field.value}`);
      params.append(field.entryId, field.value);
    });

    // Debug: Log URL parameters
    console.log("URL Parameters:", params.toString());
    console.log("Parameters count:", params.toString().split("&").length);

    if (params.toString()) {
      // Always add parameters with ? since we removed the existing ?usp=pp_url
      url += `?${params.toString()}`;
    }

    // Add timestamp to prevent caching and ensure fresh form load
    const timestamp = Date.now();
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}_t=${timestamp}`;

    // Debug: Log the final URL
    console.log("Final survey URL:", url);
    console.log("URL length:", url.length);

    // Debug: Test if URL is valid
    try {
      new URL(url);
      console.log("URL is valid");
    } catch (error) {
      console.error("Invalid URL:", error);
    }

    // Open Google form in a new tab with pre-filled data
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={`${className}`}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Determine button text and state
  let buttonText = "Take Survey";
  let buttonDisabled = false;
  let buttonClassName = "bg-[#4A00BE] text-white";

  if (isSurveyTaken) {
    if (isRewardClaimed) {
      buttonText = "Survey Complete";
      buttonDisabled = true;
      buttonClassName = "border border-gray-900 bg-white text-gray-900 font-semibold cursor-not-allowed";
    } else {
      buttonText = "Claim Your Reward";
      buttonDisabled = false;
      buttonClassName =
        "border border-purple-500 bg-white text-purple-500 font-semibold";
    }
  }

  return (
    <Button
      onClick={handleSurveyClick}
      variant={variant}
      size={size}
      disabled={buttonDisabled}
      className={`${buttonClassName} ${className}`}
    >
      <MessageSquare className="h-4 w-4" />
      {buttonText}
    </Button>
  );
}
