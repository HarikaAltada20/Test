"use client";
import React from "react";
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
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Gift,
  User,
  CreditCard,
  Shield,
  FileText,
  Search,
  ChevronRight,
  Star,
  Zap,
  Crown,
  CalendarDays,
  Info,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { hasSubmitted } from "@/lib/form-submissions";
import { cn } from "@/lib/utils";
import { useClientAuth } from "@/hooks/use-client-auth";
import Link from "next/link";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { getSubscriptionPlanById } from "@/lib/subscription-utils-client";
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
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [connectionError, setConnectionError] = useState<{
    type: "youtube" | "instagram";
    message: string;
    details?: string;
    code?: "no_channel" | "generic";
  } | null>(null);
  const [isSurveyCompleted, setIsSurveyCompleted] = useState(false);
  const [isSurveyLoading, setIsSurveyLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingData, setBillingData] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const { logout } = useClientAuth();

  // Clear password fields when modal closes
  useEffect(() => {
    if (!isPasswordModalOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isPasswordModalOpen]);

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

  const handlePasswordChange = async () => {
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
      return true;
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
      return false;
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

  const isDark = mode === "dark";

  const handleSignOut = async () => {
    try {
      await logout();
      console.log("Sign out successful");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const fetchBillingDetails = async () => {
    if (!user?.id) return;

    setBillingLoading(true);
    try {
      const response = await fetch(
        `/api/subscriptions/billing-details?t=${Date.now()}`,
        {
          cache: "no-store",
        }
      );
      const result = await response.json();

      if (response.ok) {
        setBillingData(result);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load billing details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error fetching billing details:", error);
      toast({
        title: "Error",
        description: "Failed to load billing details",
        variant: "destructive",
      });
    } finally {
      setBillingLoading(false);
    }
  };

  const handleBillingModalOpen = (open: boolean) => {
    setIsBillingModalOpen(open);
    if (open) {
      fetchBillingDetails();
    } else {
      // Delay clearing billing data to prevent flash during modal close animation
      // Dialog animation takes ~200ms, so we wait longer to ensure it's fully closed
      setTimeout(() => {
        setBillingData(null);
      }, 500);
    }
  };

  // Helper functions for plan display
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
        return <Gift className="h-6 w-6" />;
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

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startFormatted = start.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const endFormatted = end.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return `${startFormatted} - ${endFormatted}`;
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd?: boolean) => {
    if (status === "active" && cancelAtPeriodEnd) {
      return (
        <span
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            isDark
              ? "bg-yellow-900/30 text-yellow-300 border border-yellow-600"
              : "bg-yellow-100 text-yellow-800 border border-yellow-300"
          )}
        >
          Canceling
        </span>
      );
    }
    if (status === "active") {
      return (
        <span
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            isDark
              ? "bg-green-900/30 text-green-300 border border-green-600"
              : "bg-green-100 text-green-800 border border-green-300"
          )}
        >
          Active
        </span>
      );
    }
    return (
      <span
        className={cn(
          "px-3 py-1 rounded-full text-sm font-medium",
          isDark
            ? "bg-gray-900/30 text-gray-300 border border-gray-600"
            : "bg-gray-100 text-gray-800 border border-gray-300"
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const settingsItems = [
    {
      id: "profile",
      title: "Profile information",
      icon: User,
      href: "/dashboard/profile",
      isLink: true,
    },
    {
      id: "billing",
      title: "Subscription and Billing",
      icon: CreditCard,
      isLink: false,
      expandable: false,
      isModal: true,
    },
    {
      id: "password",
      title: "Change Password",
      icon: Shield,
      isLink: false,
      expandable: false,
      isModal: true,
    },
    {
      id: "terms",
      title: "Terms of Use",
      icon: FileText,
      href: "/terms-of-service",
      isLink: true,
      external: false,
    },
    {
      id: "privacy",
      title: "Privacy Policy",
      icon: Search,
      href: "/privacy-policy",
      isLink: true,
      external: false,
    },
    {
      id: "referral",
      title: "Share Referral Links",
      icon: Gift,
      isLink: false,
      expandable: false,
      isModal: true,
    },
  ];

  return (
    <div className="space-y-6 bg-background text-foreground transition-colors duration-300 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="space-y-3 text-center">
        <h1
          className={cn(
            "text-4xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Settings
        </h1>
        <p
          className={cn("text-lg", isDark ? "text-gray-400" : "text-gray-600")}
        >
          Manage your account settings and preferences
        </p>
      </div>

      {/* Connection Error Alert */}

      {/* Settings Navigation List */}

      {/* Connection Error Alert */}
      {connectionError && (
        <Alert
          variant="destructive"
          className={cn(
            "border",
            isDark
              ? "border-[#FF5353] bg-red-900/20"
              : "bg-red-50 border-red-500"
          )}
        >
          <AlertDescription
            className={cn(isDark ? "text-[#FF5353]" : "text-red-800")}
          >
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
                    className={cn(
                      "border",
                      isDark
                        ? "text-[#FF5353] border-[#FF5353]"
                        : "text-red-700 border-red-300"
                    )}
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
                            className={cn(
                              "border",
                              isDark
                                ? "text-[#FF5353] border-[#FF5353]"
                                : "text-red-700 border-red-300"
                            )}
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
                            className={cn(
                              "border",
                              isDark
                                ? "text-[#FF5353] border-[#FF5353]"
                                : "text-red-700 border-red-300"
                            )}
                          >
                            Learn How
                          </Button>
                        </div>
                        <p
                          className={cn(
                            "text-xs",
                            isDark ? "text-[#FF5353]" : "text-red-600"
                          )}
                        >
                          💡 Tip: You can also create a channel by uploading
                          your first video to YouTube. After creating your
                          channel, return here to connect it.
                        </p>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-[#FF5353]" : "text-red-600"
                          )}
                        >
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
          <div
            className={cn(
              "rounded-t-2xl border-b px-6 py-4 shadow-md",
              isDark ? "bg-[#180438]" : "bg-white"
            )}
          >
            <CardTitle
              className={cn(
                "text-2xl",
                isDark ? "text-white" : "text-[#7F39EC]"
              )}
            >
              Manage Your Account
            </CardTitle>
          </div>
          <div
            className={cn(
              "rounded-b-2xl pb-4 shadow-md",
              isDark ? "bg-[#180438]" : "bg-white"
            )}
          >
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

      {/* Survey Section - Only for Creators who have completed the survey */}
      {userType === "creator" && isSurveyCompleted && !isSurveyLoading && (
        <div
          className={cn(
            "rounded-xl shadow-lg overflow-hidden w-full p-6 md:p-0 md:pr-4 md:pt-5",
            isDark ? "bg-[#180438]" : "bg-white border border-purple-100"
          )}
        >
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between">
            {/* Content Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start flex-1 w-full">
              {/* Image */}
              <div className="relative flex-shrink-0 flex justify-center sm:justify-start">
                <img
                  src="/images/survey-form.avif"
                  alt="Survey illustration"
                  className="h-[80px] sm:h-[100px] md:h-[110px] lg:h-[130px] object-contain"
                />
              </div>
              {/* Text Content */}
              <div className="flex-1 space-y-4 w-full sm:w-auto text-center pt-7 sm:text-left">
                <div>
                  <h3
                    className={cn(
                      "font-semibold text-base sm:text-lg mb-1",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Survey Completed
                  </h3>
                  <p
                    className={cn(
                      "text-xs sm:text-[12.5px] leading-relaxed",
                      isDark ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    Thank you for completing our survey! Your feedback is
                    valuable to us and helps improve the platform. We appreciate
                    your time and thoughtful responses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {settingsItems
          .filter((item) => {
            // Only show billing for advertisers
            if (item.id === "billing" && userType !== "advertiser") {
              return false;
            }
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            if (item.isLink && item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200 hover:shadow-md",
                    isDark
                      ? "bg-[#180438] hover:border-purple-500"
                      : "bg-white border border-gray-300 hover:border-purple-300"
                  )}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isDark ? "bg-purple-900/30" : "bg-purple-100"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isDark ? "text-purple-400" : "text-purple-600"
                        )}
                      />
                    </div>
                    <div className="flex flex-col flex-1">
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.id === "profile" && (
                        <p
                          className={cn(
                            "text-xs mt-1",
                            isDark ? "text-purple-300" : "text-purple-600"
                          )}
                        >
                          💰 When you fill your complete profile, we give you a
                          $0.50 bonus!
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}
                  />
                </Link>
              );
            } else if (item.expandable) {
              const isExpanded = expandedSection === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleSection(item.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200 hover:shadow-md",
                      isDark
                        ? "bg-[#180438] hover:border-purple-500"
                        : "bg-white border border-gray-300 hover:border-purple-300"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-purple-900/30" : "bg-purple-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-purple-400" : "text-purple-600"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5 transition-transform",
                        isExpanded ? "rotate-90" : "",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    />
                  </button>
                </div>
              );
            } else if (item.isModal) {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => {
                      if (item.id === "password") {
                        setIsPasswordModalOpen(true);
                      } else if (item.id === "referral") {
                        setIsReferralModalOpen(true);
                      } else if (item.id === "billing") {
                        setIsBillingModalOpen(true);
                        fetchBillingDetails();
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200 hover:shadow-md",
                      isDark
                        ? "bg-[#180438] hover:border-purple-500"
                        : "bg-white border border-gray-300 hover:border-purple-300"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-purple-900/30" : "bg-purple-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-purple-400" : "text-purple-600"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5",
                        isDark ? "text-gray-400" : "text-gray-500"
                      )}
                    />
                  </button>
                </div>
              );
            }
            return null;
          })}

        {/* Change Password Modal */}
        <Dialog
          open={isPasswordModalOpen}
          onOpenChange={setIsPasswordModalOpen}
          isdark={isDark}
        >
          <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                Change Password
              </DialogTitle>
              <DialogDescription
                className={cn(isDark ? "text-gray-300" : "text-gray-600")}
              >
                Update your account password
              </DialogDescription>
            </DialogHeader>
            {hasPassword && (
              <Alert className="mb-4 bg-[#D9C0FF26] border-[#7F39EC]">
                <AlertDescription>
                  <strong>Multiple Sign-in Methods:</strong> You can sign in
                  with both Google and email/password.
                </AlertDescription>
              </Alert>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const success = await handlePasswordChange();
                // Only close modal on success; on error, keep it open so user can fix input
                if (success) {
                  setTimeout(() => {
                    setIsPasswordModalOpen(false);
                  }, 1000);
                }
              }}
              className="space-y-4"
            >
              {hasPassword && (
                <div className="space-y-2">
                  <Label
                    htmlFor="modal-current-password"
                    className={cn(isDark ? "text-white" : "text-gray-900")}
                  >
                    Current Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="modal-current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={cn(
                        "pr-10",
                        isDark
                          ? "bg-[#06021d] border border-gray-600 text-white"
                          : "bg-white text-gray-900"
                      )}
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
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="modal-new-password"
                  className={cn(isDark ? "text-white" : "text-gray-900")}
                >
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="modal-new-password"
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className={cn(
                      "pr-10",
                      isDark
                        ? "bg-[#06021d] border border-gray-600 text-white"
                        : "bg-white text-gray-900"
                    )}
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

                <PasswordStrengthMeter
                  password={newPassword}
                  className="mt-3"
                  showRequirements={true}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="modal-confirm-password"
                  className={cn(isDark ? "text-white" : "text-gray-900")}
                >
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="modal-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className={cn(
                      "pr-10",
                      isDark
                        ? "bg-[#06021d] border border-gray-600 text-white"
                        : "bg-white text-gray-900"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className={cn(
                    "flex-1 bg-white border border-red-500 text-red-500",
                    isDark ? "bg-[#06021d]" : "bg-white"
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#6C43D0] text-white"
                  disabled={
                    passwordChangeLoading || !newPassword || !confirmPassword
                  }
                >
                  {passwordChangeLoading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Share Referral Links Modal */}
        <Dialog
          open={isReferralModalOpen}
          onOpenChange={setIsReferralModalOpen}
          isdark={isDark}
        >
          <DialogContent
            className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                Share Your Referral Links
              </DialogTitle>
              <DialogDescription
                className={cn(isDark ? "text-gray-300" : "text-gray-600")}
              >
                Invite others with your referral code embedded. Choose the right
                landing page.
              </DialogDescription>
            </DialogHeader>
            {username ? (
              <div className="space-y-4">
                {(() => {
                  const links = buildReferralLinks();
                  return (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label
                          className={cn(
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          General Link
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={links.general}
                            className={cn(
                              isDark
                                ? "bg-[#06021d] border border-gray-600 text-white"
                                : "bg-white text-gray-900"
                            )}
                            onFocus={(e) =>
                              (e.target as HTMLInputElement).select()
                            }
                            onClick={(e) =>
                              (e.target as HTMLInputElement).select()
                            }
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
                      </div>
                      <div className="space-y-2">
                        <Label
                          className={cn(
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          Creators Link
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={links.creators}
                            className={cn(
                              isDark
                                ? "bg-[#06021d] border border-gray-600 text-white"
                                : "bg-white text-gray-900"
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-[#4A00BE] text-white"
                            onClick={() => copyToClipboard(links.creators)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Creators
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label
                          className={cn(
                            isDark ? "text-white" : "text-gray-900"
                          )}
                        >
                          Brands Link
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={links.brands}
                            className={cn(
                              isDark
                                ? "bg-[#06021d] border border-gray-600 text-white"
                                : "bg-white text-gray-900"
                            )}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-[#4A00BE] text-white"
                            onClick={() => copyToClipboard(links.brands)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Brands
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertDescription className="text-yellow-800">
                  <strong>Note:</strong> You need to set up a username to
                  generate referral links. Please set up your username first.
                </AlertDescription>
              </Alert>
            )}
            {/* <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => setIsReferralModalOpen(false)}
                className="bg-[#6C43D0] text-white"
              >
                Close
              </Button>
            </div> */}
          </DialogContent>
        </Dialog>

        {/* Subscription and Billing Modal */}
        <Dialog
          open={isBillingModalOpen}
          onOpenChange={handleBillingModalOpen}
          isdark={isDark}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                Subscription and Billing
              </DialogTitle>
              <DialogDescription
                className={cn(isDark ? "text-gray-300" : "text-gray-600")}
              >
                View your current subscription plan and billing details
              </DialogDescription>
            </DialogHeader>

            {billingLoading ? (
              <div className="flex items-center justify-center py-12">
                <PageLoadingSpinner mode={isDark ? "dark" : "light"} />
              </div>
            ) : billingData?.billingDetails ? (
              <div className="space-y-6">
                {/* Current Plan Details */}
                {(() => {
                  // Get product_id from profile subscription_info
                  const productId =
                    (profile as AdvertiserProfile)?.subscription_info
                      ?.product_id || "";

                  const plan = productId
                    ? getSubscriptionPlanById(productId)
                    : null;

                  return (
                    <div className="space-y-4">
                      <div
                        className={cn(
                          "border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4",
                          isDark
                            ? "border-gray-700 bg-[#06021d]"
                            : "border-gray-400 bg-white"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-4 rounded-xl bg-gradient-to-r ${getPlanColor(
                              plan?.name || "EXPLORER"
                            )} text-white shadow-lg`}
                          >
                            {getPlanIcon(plan?.name || "EXPLORER")}
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-xl font-bold",
                                isDark ? "text-white" : "text-black"
                              )}
                            >
                              {plan?.displayName || plan?.name || "N/A"}
                            </h3>
                            <p
                              className={cn(
                                "text-lg font-medium",
                                isDark ? "text-purple-400" : "text-purple-600"
                              )}
                            >
                              {formatCurrencyFromCents(plan?.price || 0)}
                              {(plan?.price || 0) > 0 ? "/month" : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          {getStatusBadge(
                            billingData.billingDetails.status,
                            billingData.billingDetails.cancelAtPeriodEnd
                          )}
                          {/* View Invoice Button - Show if user has a subscription and invoice URL exists */}
                          {billingData.billingDetails.latestInvoiceUrl &&
                            plan?.name !== "EXPLORER" && (
                              <Button
                                onClick={() => {
                                  window.open(
                                    billingData.billingDetails.latestInvoiceUrl,
                                    "_blank"
                                  );
                                }}
                                variant="outline"
                                className={cn(
                                  "px-4 py-2",
                                  isDark
                                    ? "border-purple-500 text-purple-400 hover:bg-purple-900/30"
                                    : "border-purple-500 text-purple-600 hover:bg-purple-50"
                                )}
                              >
                                <FileText className="h-4 w-4" />
                                View Invoice
                              </Button>
                            )}
                          {/* Subscribe Button for Explorer Plan */}
                          {plan?.name === "EXPLORER" && (
                            <Button
                              onClick={() => {
                                router.push(
                                  "/dashboard/billing?tab=subscription"
                                );
                                setIsBillingModalOpen(false);
                              }}
                              className="bg-[#6C43D0] text-white hover:bg-[#5A36B8] px-6 py-2"
                            >
                              Subscribe
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Billing Period Information */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            className={cn(
                              "h-5 w-5",
                              isDark ? "text-white" : "text-gray-900"
                            )}
                          />
                          <span
                            className={cn(
                              "font-semibold text-lg",
                              isDark ? "text-white" : "text-black"
                            )}
                          >
                            Billing Period
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div
                            className={cn(
                              "rounded-2xl p-4 shadow-sm border",
                              isDark
                                ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                                : "bg-[#D9C0FF26] border-[#7F39EC] text-black"
                            )}
                          >
                            <p className="text-sm mb-1">Current Period</p>
                            <p className="font-semibold">
                              {formatDateRange(
                                billingData.billingDetails.currentPeriodStart,
                                billingData.billingDetails.currentPeriodEnd
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
                            <p className="text-sm mb-1">Next Billing Date</p>
                            <p className="font-semibold">
                              {formatDate(
                                billingData.billingDetails.nextBillingDate
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
                            <p className="text-sm mb-1">
                              Days Until Next Billing
                            </p>
                            <p className="font-semibold">
                              {billingData.billingDetails.daysUntilNextBilling}{" "}
                              days
                            </p>
                          </div>
                        </div>

                        {/* Plan Status Information */}
                        {billingData.billingDetails.cancelAtPeriodEnd && (
                          <Alert
                            className={cn(
                              "border",
                              isDark
                                ? "border-red-600/40 bg-red-900/30 text-red-100"
                                : "border-red-200 bg-red-50 text-red-900"
                            )}
                          >
                            <AlertTriangle
                              className={cn(
                                "h-4 w-4",
                                isDark ? "text-red-300" : "text-red-600"
                              )}
                            />
                            <AlertDescription
                              className={cn(
                                isDark ? "text-red-100" : "text-red-900"
                              )}
                            >
                              <strong>Subscription Ending:</strong> Your
                              subscription will be canceled on{" "}
                              {formatDate(
                                billingData.billingDetails.nextBillingDate
                              )}
                              . You'll lose access to premium features after
                              this date.
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Plan Features */}
                        <div className="space-y-2">
                          <h4
                            className={cn(
                              "font-semibold text-lg",
                              isDark ? "text-white" : "text-gray-900"
                            )}
                          >
                            Plan Features
                          </h4>
                          <div
                            className={cn(
                              "rounded-xl p-4 border",
                              isDark
                                ? "bg-[#180438] border-gray-700"
                                : "border-gray-300"
                            )}
                          >
                            <ul className="grid grid-cols-2 gap-3 text-md">
                              <li
                                className={cn(
                                  "flex items-center gap-2",
                                  isDark ? "text-gray-300" : "text-gray-800"
                                )}
                              >
                                <span className="text-green-600">✓</span>
                                {plan?.features.maxActiveContests || 0} active
                                contests
                              </li>
                              <li
                                className={cn(
                                  "flex items-center gap-2",
                                  isDark ? "text-gray-300" : "text-gray-800"
                                )}
                              >
                                <span className="text-green-600">✓</span>
                                {plan?.features.commissionPercentage || 0}%
                                commission
                              </li>
                              <li
                                className={cn(
                                  "flex items-center gap-2",
                                  isDark ? "text-gray-300" : "text-gray-800"
                                )}
                              >
                                <span className="text-green-600">✓</span>
                                Up to {plan?.features.maxWinnersPerContest ||
                                  0}{" "}
                                winners per contest
                              </li>
                              <li
                                className={cn(
                                  "flex items-center gap-2",
                                  isDark ? "text-gray-300" : "text-gray-800"
                                )}
                              >
                                <span className="text-green-600">✓</span>
                                {plan?.features.analytics || "N/A"} analytics
                              </li>
                              <li
                                className={cn(
                                  "flex items-center gap-2",
                                  isDark ? "text-gray-300" : "text-gray-800"
                                )}
                              >
                                <span className="text-green-600">✓</span>
                                {plan?.features.support || "N/A"} support
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : billingData?.message ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{billingData.message}</AlertDescription>
              </Alert>
            ) : !billingLoading && !billingData ? (
              <div className="space-y-4">
                {/* Check if user is on Explorer Plan from profile */}
                {(() => {
                  const productId =
                    (profile as AdvertiserProfile)?.subscription_info
                      ?.product_id || "";
                  const plan = productId
                    ? getSubscriptionPlanById(productId)
                    : null;
                  if (plan?.name === "EXPLORER") {
                    return (
                      <div className="flex justify-center pt-2">
                        <Button
                          onClick={() => {
                            router.push("/dashboard/billing");
                            setIsBillingModalOpen(false);
                          }}
                          className="bg-[#6C43D0] text-white hover:bg-[#5A36B8] px-6 py-2"
                        >
                          Subscribe
                        </Button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : null}

            {/* <div className="flex justify-end pt-4">
              <Button
                type="button"
                onClick={() => setIsBillingModalOpen(false)}
                className="bg-[#6C43D0] text-white"
              >
                Close
              </Button>
            </div> */}
          </DialogContent>
        </Dialog>

        {/* Log out button */}
        <div
          className={cn(
            "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200",
            isDark ? "bg-[#180438]" : "bg-white border border-gray-300"
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "p-2 rounded-lg",
                isDark ? "bg-red-900/30" : "bg-red-100"
              )}
            >
              <LogOut
                className={cn(
                  "h-5 w-5",
                  isDark ? "text-red-400" : "text-red-600"
                )}
              />
            </div>
            <span
              className={cn(
                "font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              Log out
            </span>
          </div>
          <Button
            onClick={handleSignOut}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Logout
          </Button>
        </div>
      </div>
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
