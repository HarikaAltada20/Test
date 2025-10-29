"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import {
  Bell,
  LogOut,
  Mail,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Gift,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { SiInstagram, SiYoutube } from "react-icons/si";
import dayjs from "dayjs";
import { useRouter, useSearchParams } from "next/navigation";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { useToast } from "@/hooks/use-toast";
import {
  validatePassword,
  getPasswordErrorMessage,
} from "@/lib/password-utils";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import {
  API_TIMEOUT_MEDIUM,
  API_TIMEOUT_LONG,
  API_TIMEOUT_SHORT,
} from "@/constants/subscriptionPlans";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { SurveyButton } from "@/components/SurveyButton";
import { hasSubmitted } from "@/lib/form-submissions";
dayjs.extend(isSameOrAfter);

interface SocialAccount {
  id: string;
  provider: string;
  username?: string;
  email?: string;
  profile_picture_url?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string; // ISO string - YouTube
  // YouTube specific
  channel_id?: string;
  channel_title?: string;
  subscriber_count?: number;
  video_count?: number;
  // Instagram specific
  token_expiry?: string; // ISO string - Instagram
  instagram_user_id?: string; // Actual global IG User ID
  app_scoped_user_id?: string; // IGBA ID or Professional Account ID for the app
  name_of_account?: string; // User's full name on IG
  account_type?: "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL";
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

interface CreatorProfile {
  youtube_account: SocialAccount | null;
  instagram_account: SocialAccount | null;
}

interface AdvertiserProfile {
  company_name: string;
  website_url: string;
  subscription_info: any;
}

export default function SettingsPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State declarations
  const [profile, setProfile] = useState<
    CreatorProfile | AdvertiserProfile | null
  >(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [companyProfileLoading, setCompanyProfileLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userType, setUserType] = useState<"creator" | "advertiser" | null>(
    null
  );
  const [username, setUsername] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(true); // Track if user has a password
  const supabase = createClient();
  const [youtubeAccount, setYoutubeAccount] = useState<SocialAccount | null>(
    null
  );
  const [instagramAccount, setInstagramAccount] =
    useState<SocialAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
  const [isLoadingYouTubeDisconnect, setIsLoadingYouTubeDisconnect] =
    useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<{
    type: "youtube" | "instagram";
    message: string;
    details?: string;
    code?: "no_channel" | "generic";
  } | null>(null);
  const [isSurveyCompleted, setIsSurveyCompleted] = useState(false);
  const [isSurveyLoading, setIsSurveyLoading] = useState(true);

  // Handle URL error parameters
  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    const success = searchParams.get("success");
    const platform = searchParams.get("platform");

    if (error === "youtube_connection_failed") {
      if (message === "No+channel+found") {
        setConnectionError({
          type: "youtube",
          message: "YouTube Connection Failed",
          details:
            "No channel found. Create your YouTube channel first, then try connecting your YouTube account again.",
          code: "no_channel",
        });
      } else {
        // Handle other YouTube connection errors
        setConnectionError({
          type: "youtube",
          message: "YouTube Connection Failed",
          details: message
            ? decodeURIComponent(message)
            : "An error occurred while connecting your YouTube account. Please try again.",
        });
      }

      toast({
        title: "YouTube Connection Failed",
        description: message
          ? decodeURIComponent(message)
          : "An error occurred while connecting your YouTube account.",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds to ensure user sees it
      });

      // Clear the error from URL to prevent showing it again on refresh
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      newUrl.searchParams.delete("message");
      router.replace(newUrl.pathname);
    }

    // Handle success parameters
    // Pattern A: success=true&platform=youtube|instagram
    if (success === "true" && platform) {
      const platformName = platform === "youtube" ? "YouTube" : "Instagram";

      toast({
        title: `${platformName} Connected Successfully`,
        description: `Your ${platformName} account has been connected successfully.`,
        variant: "default",
        duration: 5000,
      });

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("success");
      newUrl.searchParams.delete("platform");
      router.replace(newUrl.pathname);
    }

    // Pattern B: success=youtube_connected | instagram_connected
    if (success === "youtube_connected" || success === "instagram_connected") {
      const platformName =
        success === "youtube_connected" ? "YouTube" : "Instagram";

      toast({
        title: `${platformName} Connected Successfully`,
        description: `Your ${platformName} account has been connected successfully.`,
        variant: "default",
        duration: 5000,
      });

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("success");
      router.replace(newUrl.pathname);
    }
  }, [searchParams, toast, router]);

  // Function declarations
  const refreshInstagramToken = async (
    currentToken: string,
    userId: string,
    currentProfile: CreatorProfile
  ) => {
    try {
      const refreshRes = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
      );
      const newData = await refreshRes.json();

      if (!refreshRes.ok || newData.error) {
        throw new Error(
          newData.error?.message || "Failed to refresh Instagram token"
        );
      }

      const updatedInstagramAccount = {
        ...(currentProfile.instagram_account || {}),
        access_token: newData.access_token,
        token_expiry: dayjs().add(59, "days").toISOString(), // Refreshed token is also valid for 60 days
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({
          instagram_account: updatedInstagramAccount,
        })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              instagram_account: updatedInstagramAccount as SocialAccount,
            }
          : null
      );
      console.log("Instagram token refreshed successfully");
      // Optionally show a success message to the user, though this can be silent
    } catch (err: any) {
      console.error("Error refreshing Instagram token:", err);
      // Handle token refresh error, e.g., notify user, attempt disconnect, or ask to re-authenticate
      // For now, we'll log the error. Depending on the error type (e.g. token revoked),
      // you might want to nullify the instagram_account or prompt for re-login.
      toast({
        title: "Error",
        description: `Failed to refresh Instagram token: ${err.message}. Please try reconnecting your account.`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!user) {
      setPageLoading(true);
      return;
    }

    async function loadProfile() {
      setPageLoading(true);
      try {
        // Get user data from our users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user!.id)
          .single();

        if (userError) throw userError;
        setUserType(userData.user_type);

        // Simple check: if user has email provider, they can manage passwords
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          const providers = authUser.app_metadata?.providers || [];
          const hasEmailProvider = providers.includes("email");
          setHasPassword(hasEmailProvider);
        }

        if (userData.user_type === "creator") {
          const { data, error } = await supabase
            .from("creator_profiles")
            .select("youtube_account, instagram_account")
            .eq("id", user!.id)
            .single();

          if (error) throw error;
          setProfile(data);

          // Check and refresh Instagram token
          if (
            data.instagram_account?.access_token &&
            data.instagram_account?.token_expiry
          ) {
            const shouldRefresh = dayjs().isAfter(
              dayjs(data.instagram_account.token_expiry).subtract(7, "days")
            ); // Refresh 7 days before expiry
            if (shouldRefresh) {
              console.log("Attempting to refresh Instagram token");
              await refreshInstagramToken(
                data.instagram_account.access_token,
                user!.id,
                data
              );
            }
          }
        } else if (userData.user_type === "advertiser") {
          const { data, error } = await supabase
            .from("advertiser_profiles")
            .select("company_name, website_url, subscription_info")
            .eq("id", user!.id)
            .single();

          if (error) throw error;
          setProfile(data);
        } else {
          console.error("Unknown user type:", userData.user_type);
          toast({
            title: "Error",
            description: "Unknown user type encountered.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        toast({
          title: "Error",
          description: "Failed to load profile information.",
          variant: "destructive",
        });
      } finally {
        setPageLoading(false);
      }
    }

    loadProfile();
  }, [user, supabase]);

  useEffect(() => {
    if (profile && userType === "creator") {
      const creatorProfile = profile as CreatorProfile;
      if (creatorProfile.youtube_account) {
        setYoutubeAccount(creatorProfile.youtube_account);
        setYoutubeConnected(true);
      } else {
        setYoutubeAccount(null);
        setYoutubeConnected(false);
      }

      if (creatorProfile.instagram_account) {
        setInstagramAccount(creatorProfile.instagram_account);
        setInstagramConnected(true);
      } else {
        setInstagramAccount(null);
        setInstagramConnected(false);
      }
    } else {
      // Reset if profile is null or user is not a creator, or if profile is for an advertiser
      setYoutubeAccount(null);
      setYoutubeConnected(false);
      setInstagramAccount(null);
      setInstagramConnected(false);
    }
  }, [profile, userType]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("users")
        .select("username, user_type")
        .eq("id", user.id)
        .maybeSingle();
      if (!error && data) {
        setUsername(data.username || null);
        setUserType((data.user_type as any) || null);
      }
    };
    load();
  }, [user, supabase]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeLoading(true);

    try {
      // For users with existing passwords, validate current password first
      if (hasPassword && currentPassword) {
        // Validate current password by attempting to sign in with it
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user!.email!,
          password: currentPassword,
        });

        if (signInError) {
          throw new Error("Current password is incorrect");
        }
      } else if (hasPassword && !currentPassword) {
        throw new Error("Current password is required");
      }

      // Validate new password using comprehensive validation
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(getPasswordErrorMessage(passwordValidation));
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirm password do not match");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Update hasPassword state since user now has a password
      setHasPassword(true);

      toast({
        title: "Success",
        description: hasPassword
          ? "Password updated successfully"
          : "Password set successfully! You can now sign in with email and password.",
        variant: "default",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Error",
        description:
          err.message ||
          (hasPassword
            ? "Failed to update password"
            : "Failed to set password"),
        variant: "destructive",
      });
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const buildReferralLinks = () => {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.gameofcreators.com";
    const code = username || "";
    return {
      general: `${base}/?ref=${code}`,
      creators: `${base}/creators?ref=${code}`,
      brands: `${base}/brands?ref=${code}`,
    };
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Referral link copied to clipboard.",
      });
    } catch (e) {
      toast({
        title: "Copy failed",
        description: "Please copy manually.",
        variant: "destructive",
      });
    }
  };

  const clearConnectionError = () => {
    setConnectionError(null);

    // Show a success message when error is dismissed
    toast({
      title: "Error Dismissed",
      description:
        "You can try connecting your account again when you're ready.",
      variant: "default",
      duration: 3000,
    });
  };

  const handleNotificationChange = async (
    type: "email" | "push",
    value: boolean
  ) => {
    try {
      if (type === "email") {
        setEmailNotifications(value);
        // Update in database
      } else {
        setPushNotifications(value);
        // Update in database
      }
    } catch (err) {
      console.error(`Error updating ${type} notifications:`, err);
    }
  };

  const updateCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("updateCompanyProfile: Starting");
    setCompanyProfileLoading(true);

    try {
      // Log values right before the update attempt
      const companyName = (e.target as any).company_name.value;
      const websiteUrl = (e.target as any).website_url.value;
      const currentUserId = user?.id;
      console.log(
        `updateCompanyProfile: Values - Name: ${companyName}, URL: ${websiteUrl}, UserID: ${currentUserId}`
      );

      if (!currentUserId) {
        throw new Error("User ID is not available for update.");
      }

      // Nested try/catch specifically for the Supabase call
      let updateResult = null;
      try {
        console.log(
          "updateCompanyProfile: INNER TRY - Attempting Supabase update"
        );
        updateResult = await supabase // Use main client
          .from("advertiser_profiles")
          .update({
            company_name: companyName,
            website_url: websiteUrl,
          })
          .eq("id", currentUserId) // Use logged user ID
          .select();
        console.log(
          "updateCompanyProfile: INNER TRY - Supabase update finished."
        );
      } catch (innerError: any) {
        console.error(
          "updateCompanyProfile: INNER CATCH - Error during Supabase call:",
          innerError
        );
        throw innerError; // Re-throw to be caught by outer catch
      }

      // Process the result from the inner try
      const { data, error } = updateResult || {
        data: null,
        error: new Error("Update call failed silently"),
      }; // Handle null result just in case
      console.log("updateCompanyProfile: Result data:", data);
      console.log("updateCompanyProfile: Result error:", error);

      if (error) {
        console.error("updateCompanyProfile: Error object exists:", error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Company profile updated successfully",
        variant: "default",
      });
      console.log("updateCompanyProfile: Set success message");
    } catch (err: any) {
      console.error("updateCompanyProfile: OUTER CATCH - Error caught:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update company profile",
        variant: "destructive",
      });
    } finally {
      console.log("updateCompanyProfile: Reached finally block");
      setCompanyProfileLoading(false);
    }
  };

  const handleYouTubeConnect = () => {
    setIsLoadingYouTube(true);
    try {
      // Set a timeout to reset loading state if redirect doesn't happen
      const timeoutId = setTimeout(() => {
        setIsLoadingYouTube(false);
        toast({
          title: "Error",
          description: "Connection timed out. Please try again.",
          variant: "destructive",
        });
      }, API_TIMEOUT_LONG);

      window.location.href = "/api/youtube/auth";
    } catch (err: any) {
      setIsLoadingYouTube(false);
      toast({
        title: "Error",
        description: err.message || "Failed to initiate YouTube connection",
        variant: "destructive",
      });
    }
  };

  const handleInstagramConnect = () => {
    const instagramClientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!instagramClientId) {
      toast({
        title: "Error",
        description:
          "Instagram Client ID is not configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }
    if (!appBaseUrl) {
      toast({
        title: "Error",
        description:
          "Application Base URL is not configured. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const instagramRedirectUri = `${appBaseUrl}/api/instagram/callback`;
      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_insights",
      ].join(",");

      const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${instagramClientId}&redirect_uri=${encodeURIComponent(
        instagramRedirectUri
      )}&scope=${scopes}&response_type=code&enable_fb_login=0&force_authentication=1`;

      // Set a timeout to reset loading state if redirect doesn't happen
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Connection timed out. Please try again.",
          variant: "destructive",
        });
      }, API_TIMEOUT_LONG);

      window.location.href = authUrl;
    } catch (err: any) {
      setIsLoading(false);
      toast({
        title: "Error",
        description: err.message || "Failed to initiate Instagram connection",
        variant: "destructive",
      });
    }
  };

  const handleInstagramDisconnect = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Disconnection timed out. Please try again.",
          variant: "destructive",
        });
      }, API_TIMEOUT_SHORT);

      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({
          instagram_account: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      clearTimeout(timeoutId);

      if (updateError) throw updateError;

      setInstagramAccount(null);
      setProfile((prev) =>
        prev ? { ...prev, instagram_account: null } : null
      );
      toast({
        title: "Success",
        description: "Instagram account disconnected successfully.",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to disconnect Instagram account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleYouTubeDisconnect = async () => {
    if (!user) return;
    setIsLoadingYouTubeDisconnect(true);
    try {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsLoadingYouTubeDisconnect(false);
        toast({
          title: "Error",
          description: "Disconnection timed out. Please try again.",
          variant: "destructive",
        });
      }, 5000);

      const { error: updateError } = await supabase
        .from("creator_profiles")
        .update({ youtube_account: null, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      clearTimeout(timeoutId);

      if (updateError) throw updateError;

      setYoutubeAccount(null);
      setProfile((prev) => (prev ? { ...prev, youtube_account: null } : null));
      toast({
        title: "Success",
        description: "YouTube account disconnected successfully.",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to disconnect YouTube account.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingYouTubeDisconnect(false);
    }
  };

  // Auto-refresh Instagram token if nearing expiry
  const checkAndRefreshInstagramToken = useCallback(async () => {
    if (
      !instagramAccount ||
      !instagramAccount.access_token ||
      !instagramAccount.token_expiry
    ) {
      return;
    }

    // Check if token expires within 7 days
    if (dayjs(instagramAccount.token_expiry).isBefore(dayjs().add(7, "day"))) {
      try {
        const response = await fetch("/api/instagram/refresh-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to refresh Instagram token");
        }

        // Show success message
        toast({
          title: "Success",
          description: "Instagram token has been automatically refreshed.",
          variant: "default",
        });

        // Refresh the page data to show updated token expiry
        window.location.reload();
      } catch (error: any) {
        console.error("Error refreshing Instagram token:", error);

        // Handle different error scenarios
        if (
          error.message?.includes("re-authenticate") ||
          error.message?.includes("revoked")
        ) {
          toast({
            title: "Authentication Required",
            description:
              "Your Instagram token has expired. Please reconnect your Instagram account.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Warning",
            description: `Instagram token refresh failed: ${error.message}. It will be refreshed automatically by our system.`,
            variant: "default",
          });
        }
      }
    }
  }, [instagramAccount, toast]);

  // Auto-refresh YouTube token if nearing expiry
  const checkAndRefreshYouTubeToken = useCallback(async () => {
    if (
      !youtubeAccount ||
      !youtubeAccount.access_token ||
      !youtubeAccount.expires_at
    ) {
      return;
    }

    // Check if token expires within 5 minutes (YouTube tokens have shorter expiry)
    if (dayjs(youtubeAccount.expires_at).isBefore(dayjs().add(5, "minute"))) {
      try {
        const response = await fetch("/api/youtube/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to refresh YouTube token");
        }

        // Show success message
        toast({
          title: "Success",
          description: "YouTube token has been automatically refreshed.",
          variant: "default",
        });

        // Refresh the page data to show updated token expiry
        window.location.reload();
      } catch (error: any) {
        console.error("Error refreshing YouTube token:", error);

        // Handle different error scenarios
        if (
          error.message?.includes("re-authenticate") ||
          error.message?.includes("revoked")
        ) {
          toast({
            title: "Authentication Required",
            description:
              "Your YouTube token has expired. Please reconnect your YouTube account.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Warning",
            description: `YouTube token refresh failed: ${error.message}. It will be refreshed automatically by our system.`,
            variant: "default",
          });
        }
      }
    }
  }, [youtubeAccount, toast]);

  useEffect(() => {
    checkAndRefreshInstagramToken();
    checkAndRefreshYouTubeToken();
  }, [checkAndRefreshInstagramToken, checkAndRefreshYouTubeToken]);

  // Check survey completion status
  useEffect(() => {
    const checkSurveyCompletion = async () => {
      if (!user?.email) {
        setIsSurveyLoading(false);
        return;
      }

      try {
        const completed = await hasSubmitted(user.email);
        setIsSurveyCompleted(completed);
      } catch (error) {
        console.error("Error checking survey completion:", error);
        setIsSurveyCompleted(false);
      } finally {
        setIsSurveyLoading(false);
      }
    };

    checkSurveyCompletion();
  }, [user?.email]);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Not logged in</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Connection Error Alert */}
      {connectionError && (
        <Alert variant="destructive" className="border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {connectionError.type === "youtube" ? (
                  <SiYoutube className="h-5 w-5 text-red-600" />
                ) : (
                  <SiInstagram className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="font-semibold mb-2">{connectionError.message}</p>
                <p className="text-sm mb-3">{connectionError.details}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearConnectionError}
                    className="text-red-700 border-red-300 hover:bg-red-100"
                  >
                    Dismiss
                  </Button>
                  {connectionError.type === "youtube" &&
                    (connectionError.code === "no_channel" ||
                      (connectionError.details
                        ?.toLowerCase()
                        .includes("no channel") ??
                        false)) && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://www.youtube.com/channel_switcher",
                                "_blank"
                              )
                            }
                            className="text-red-700 border-red-300 hover:bg-red-100"
                          >
                            Create YouTube Channel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                "https://support.google.com/youtube/answer/1646861?hl=en",
                                "_blank"
                              )
                            }
                            className="text-red-700 border-red-300 hover:bg-red-100"
                          >
                            Learn How
                          </Button>
                        </div>
                        <p className="text-xs text-red-600 mt-2">
                          💡 Tip: You can also create a channel by uploading
                          your first video to YouTube. After creating your
                          channel, return here to connect it.
                        </p>
                        <div className="text-xs text-red-600">
                          <p className="mb-1">Additional Resources:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>
                              Make sure you're signed into the correct Google
                              account
                            </li>
                            <li>
                              Ensure your YouTube account has a channel (not
                              just a personal account)
                            </li>
                            <li>
                              Try refreshing the page after creating your
                              channel
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Connected Accounts - Only for Creators */}
      {userType === "creator" && (
        <div>
          <div className="bg-white rounded-t-2xl border-b px-6 py-4 shadow-lg">
            <CardTitle className="text-2xl text-[#7F39EC]">
              Manage Your Account
            </CardTitle>
          </div>
          <div className="bg-white rounded-b-2xl border-b pb-4 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Social Accounts</CardTitle>
              <CardDescription>
                Connect your social media accounts to participate in campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* YouTube Connection */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <SiYoutube className="text-2xl text-red-600" />
                  <div>
                    <h3 className="font-medium">YouTube</h3>
                    {youtubeConnected ? (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Connected as{" "}
                          {youtubeAccount?.channel_title ||
                            "your YouTube account"}
                          <span className="ml-2 text-green-600 text-xs">
                            ✓ Active
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not connected
                      </p>
                    )}
                  </div>
                </div>
                {youtubeConnected ? (
                  <Button
                    className="bg-[#C90808] text-white"
                    onClick={handleYouTubeDisconnect}
                    disabled={isLoadingYouTubeDisconnect}
                  >
                    {isLoadingYouTubeDisconnect && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={handleYouTubeConnect}
                    disabled={isLoadingYouTube}
                  >
                    {isLoadingYouTube && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Connect YouTube
                  </Button>
                )}
              </div>
              {/* YouTube Connection Information - Display if not connected */}
              {!youtubeConnected && (
                <Alert
                  variant="default"
                  className="mt-2 border border-[#7F39EC] bg-[#D9C0FF26]"
                >
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    Connect your YouTube account to allow Game Of Creators to
                    view basic channel information (e.g., name, subscriber
                    count, username). This also enables us to display your
                    videos on the campaign submission page, allowing you to
                    easily select them for opportunities. Please note that we
                    will only have{" "}
                    <span className="font-medium">read-only access</span> and{" "}
                    <span className="font-medium">will not</span> be able to
                    upload videos, modify content, or change any of your channel
                    settings.
                  </AlertDescription>
                </Alert>
              )}

              {/* Instagram Connection */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <SiInstagram className="text-2xl text-pink-600" />
                  <div>
                    <h3 className="font-medium">Instagram</h3>
                    {instagramConnected ? (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Connected as{" "}
                          {instagramAccount?.name_of_account ||
                            instagramAccount?.username ||
                            "your Instagram account"}{" "}
                          (
                          {(instagramAccount?.account_type || "N/A").replace(
                            "_",
                            " "
                          )}
                          )
                          <span className="ml-2 text-green-600 text-xs">
                            ✓ Active
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not connected
                      </p>
                    )}
                  </div>
                </div>
                {instagramConnected ? (
                  <Button
                    variant="outline"
                    className="bg-[#C90808] text-white"
                    onClick={handleInstagramDisconnect}
                    disabled={isLoading}
                  >
                    {isLoading && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button onClick={handleInstagramConnect} disabled={isLoading}>
                    {isLoading && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Connect Instagram
                  </Button>
                )}
              </div>
              {/* Instagram Connection Information - Display if not connected */}
              {!instagramConnected && (
                <Alert
                  variant="default"
                  className="mt-2 border border-[#7F39EC] bg-[#D9C0FF26]"
                >
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    To participate in Instagram campaigns, you need to connect
                    an Instagram{" "}
                    <strong className="font-semibold">
                      Business or Creator account
                    </strong>
                    . This is required by Instagram for us to fetch your
                    Reels/Videos and their performance insights. We request
                    permissions for basic profile data and to read your media
                    and insights.
                    <br />
                    <br />
                    <strong className="font-semibold">
                      Important Steps Before Connecting:
                    </strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>
                        Ensure your Instagram profile is a{" "}
                        <strong className="font-semibold">
                          Business or Creator
                        </strong>{" "}
                        account. (To check your Instagram account type, open the
                        Instagram app, go to your profile, tap the menu icon
                        (three horizontal lines), select "Settings and Privacy,"
                        then "Account type and tools," and finally, "Switch to
                        professional account". If you see the "Switch to
                        professional account" option, you have a Personal
                        account. If you see "Switch to personal account" or
                        "Switch to creator account," you have a Business or
                        Creator account. )
                      </li>
                      <li>
                        If your account is not a Business or Creator account,
                        please convert it by going to your profile and clicking
                        on the three dots in the top right corner,then navigate
                        to Settings - Account - Switch to Businees/Creator
                        account.
                      </li>
                      <li>
                        Please be aware: For contest eligibility and data
                        fetching, only content created{" "}
                        <strong className="font-semibold">after</strong> your
                        account has been converted to a Business or Creator
                        account will be valid.
                      </li>
                    </ul>
                    {/* Replace # with your actual FAQ/help page URL */}
                    <a
                      href="/instagram-connection-faq"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block font-semibold underline hover:text-primary"
                    >
                      Learn more about these requirements{" "}
                      <ExternalLink className="inline h-3 w-3 ml-0.5" />
                    </a>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </div>
        </div>
      )}

      {/* Company Profile - Only for Advertisers */}
      {userType === "advertiser" && (
        <div>
          <div className="bg-white rounded-t-2xl border-b px-6 py-4 shadow-lg">
            <CardTitle className="text-2xl text-[#7F39EC]">Profile</CardTitle>
          </div>
          <div className="bg-white rounded-b-2xl shadow-lg px-2 pb-3">
            <div className="px-6 py-4">
              <h1 className="mb-2 text-2xl font-semibold">Company Profile</h1>
              <CardDescription>Update your company information</CardDescription>
            </div>
            <CardContent>
              <form onSubmit={updateCompanyProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    defaultValue={(profile as AdvertiserProfile)?.company_name}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    name="website_url"
                    type="url"
                    defaultValue={(profile as AdvertiserProfile)?.website_url}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#6C43D0] text-md"
                  disabled={companyProfileLoading}
                >
                  {companyProfileLoading ? "Updating..." : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </div>
        </div>
      )}

      {/* Notifications */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gray-100 rounded-full">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Get notified about new opportunities and updates
                </p>
              </div>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={(checked) =>
                handleNotificationChange("email", checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gray-100 rounded-full">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications in your browser
                </p>
              </div>
            </div>
            <Switch
              checked={pushNotifications}
              onCheckedChange={(checked) =>
                handleNotificationChange("push", checked)
              }
            />
          </div>
        </CardContent>
      </Card> */}

      {/* Security - Only show for users with email authentication */}
      {hasPassword && (
        <div>
          <div className="bg-white rounded-t-2xl border-b px-6 py-4 shadow-lg">
            <CardTitle className="text-2xl text-[#7F39EC]">Security</CardTitle>
          </div>
          <div className="bg-white rounded-b-2xl shadow-lg px-2 py-5">
            {/* <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Update your password and security settings
            </CardDescription>
          </CardHeader> */}
            <CardContent>
              <Alert className="mb-4 bg-[#D9C0FF26] border-[#7F39EC]">
                <AlertDescription>
                  <strong>Multiple Sign-in Methods:</strong> You can sign in
                  with both Google and email/password.
                </AlertDescription>
              </Alert>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(!showCurrentPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Real-time Password Strength Meter */}
                  <PasswordStrengthMeter
                    password={newPassword}
                    className="mt-3"
                    showRequirements={true}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  className="w-full bg-[#6C43D0] text-md"
                  type="submit"
                  disabled={
                    passwordChangeLoading || !newPassword || !confirmPassword
                  }
                >
                  {passwordChangeLoading
                    ? "Updating Password..."
                    : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </div>
        </div>
      )}

      {/* Survey Section - Only for Creators who have completed the survey */}
      {userType === "creator" && isSurveyCompleted && !isSurveyLoading && (
        <div className="bg-white rounded-xl shadow-lg border border-purple-100 overflow-hidden w-full p-6 md:p-0 md:pr-4 md:pt-5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between">
            {/* Content Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start flex-1 w-full">
              {/* Image */}
              <div className="relative flex-shrink-0 flex justify-center sm:justify-start">
                <img
                  src="/images/360_F_1018050560_kQHuMNjN5tHrhUKxnT9dBbOoxjCEe9cu-removebg-preview.avif"
                  alt="Survey illustration"
                  className="h-[80px] sm:h-[100px] md:h-[110px] lg:h-[130px] object-contain"
                />
              </div>
              {/* Text Content */}
              <div className="flex-1 space-y-4 w-full sm:w-auto text-center pt-7 sm:text-left">
                <div>
                  <h3 className="font-semibold text-base sm:text-lg mb-1 text-gray-900">
                    Survey Completed
                  </h3>
                  <p className="text-xs sm:text-[12.5px] text-gray-600 leading-relaxed">
                    Thank you for completing our survey! Your feedback is
                    valuable to us and helps improve the platform. We appreciate
                    your time and thoughtful responses.
                  </p>
                </div>
                {/* Reward Badge */}
                {/* <div className="flex items-center justify-center sm:justify-start gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-purple-200 w-full sm:w-fit shadow-sm">
                  <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 animate-pulse flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-purple-700 whitespace-nowrap">
                    Survey completed - Thank you!
                  </span>
                </div> */}
              </div>
            </div>
            {/* Button Section */}
            {/* <div className="w-full sm:w-auto lg:pr-2 lg:flex-shrink-0 mt-3 md:mt-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 bg-green-100 px-4 py-2 rounded-lg border border-green-200">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-700">
                  Completed
                </span>
              </div>
            </div> */}
          </div>
        </div>
      )}

      {/* Referral Links */}
      {username && (
        <div className="bg-white rounded-xl shadow-xl">
          <CardHeader>
            <CardTitle>Share Your Referral Links</CardTitle>
            <CardDescription>
              Invite others with your referral code embedded. Choose the right
              landing page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const links = buildReferralLinks();
              return (
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <Input
                      readOnly
                      value={links.general}
                      className="border-gray-400 w-full"
                    />
                    <Button
                      type="button"
                      className="bg-[#4A00BE] text-white"
                      variant="outline"
                      onClick={() => copyToClipboard(links.general)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy General
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      readOnly
                      value={links.creators}
                      className="border-gray-400"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-[#4A00BE] text-white"
                      onClick={() => copyToClipboard(links.creators)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy Creators
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      readOnly
                      value={links.brands}
                      className="border-gray-400"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-[#4A00BE] text-white"
                      onClick={() => copyToClipboard(links.brands)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Brands
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </div>
      )}

      {/* Danger Zone */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </CardContent>
      </Card> */}
    </div>
  );
}
