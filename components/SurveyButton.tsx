"use client";

import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useClientAuth } from "@/hooks/use-client-auth";

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
  const { user, isAuthenticated } = useClientAuth();
  const supabase = createClient();

  // Google Form URL - Note: Removed ?usp=pp_url to prevent "Continue current draft" popup
  const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfQ8vf1rLEYhIb_PAgujJHjL2t_nHNaSn9CXHvLdbvIJzECKA/viewform";

  // "https://docs.google.com/forms/d/e/1FAIpQLSfQ8vf1rLEYhIb_PAgujJHjL2t_nHNaSn9CXHvLdbvIJzECKA/viewform";

  // Fetch user data from Supabase
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

  const handleSurveyClick = () => {
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

  return (
    <Button
      onClick={handleSurveyClick}
      variant={variant}
      size={size}
      className={`bg-[#6C43D0] text-white hover:bg-[#5A3BC0] transition-colors ${className}`}
    >
      <MessageSquare className="h-4 w-4 mr-2" />
      Take Survey
    </Button>
  );
}
