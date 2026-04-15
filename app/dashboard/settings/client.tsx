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
  X,
  ArrowRight,
  CheckCircle2,
  Users,
} from "lucide-react";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState, useCallback, useRef } from "react";
import { AccountSwitcher } from "@/components/dashboard/switcher/AccountSwitcher";
import { FaXTwitter } from "react-icons/fa6";
import { FaDiscord, FaWhatsapp, FaLinkedin } from "react-icons/fa";
import { SiInstagram, SiYoutube, SiTiktok } from "react-icons/si";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import dayjs from "dayjs";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  // TikTok specific
  tiktok_user_id?: string; // TikTok Open ID
  union_id?: string; // TikTok Union ID
  likes_count?: number;
  bio?: string;
  refresh_token_expiry?: string; // ISO string - TikTok
  needs_reconnect?: boolean; // Set when token/connection failed; user should reconnect
}

interface CreatorProfile {
  youtube_account: SocialAccount | null;
  instagram_account: SocialAccount | null;
  tiktok_account: SocialAccount | null;
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
  const pathname = usePathname();

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
    null,
  );
  const [username, setUsername] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(true); // Track if user has a password
  const supabase = createClient();
  const [youtubeAccount, setYoutubeAccount] = useState<SocialAccount | null>(
    null,
  );
  const [instagramAccount, setInstagramAccount] =
    useState<SocialAccount | null>(null);
  const [tiktokAccount, setTiktokAccount] = useState<SocialAccount | null>(
    null,
  );
  const [twitterAccount, setTwitterAccount] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
  const [isLoadingYouTubeDisconnect, setIsLoadingYouTubeDisconnect] =
    useState(false);
  const [isLoadingTwitterDisconnect, setIsLoadingTwitterDisconnect] =
    useState(false);
  const [isRefreshingTwitter, setIsRefreshingTwitter] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [isLoadingTiktok, setIsLoadingTiktok] = useState(false);
  const [isLoadingTiktokDisconnect, setIsLoadingTiktokDisconnect] =
    useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [connectionError, setConnectionError] = useState<{
    type: "youtube" | "instagram" | "tiktok";
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
  const [profileCompletionLoading, setProfileCompletionLoading] =
    useState(false);
  const [navigatingProfile, setNavigatingProfile] = useState(false);
  const [navigatingTerms, setNavigatingTerms] = useState(false);
  const [navigatingPrivacy, setNavigatingPrivacy] = useState(false);
  const { logout } = useClientAuth();
  const [showProfileNotification, setShowProfileNotification] = useState(true);
  const [creatorProfileData, setCreatorProfileData] = useState<any>(null);
  const [twitterConnected, setTwitterConnected] = useState(false);
  const highlightUsernameInBio = (bio: string) => {
    if (!username) return bio;

    const lowerBio = bio.toLowerCase();
    const lowerUsername = username.toLowerCase();
    const index = lowerBio.indexOf(lowerUsername);

    if (index === -1) return bio;

    const before = bio.slice(0, index);
    const match = bio.slice(index, index + username.length);
    const after = bio.slice(index + username.length);

    return (
      <>
        {before}
        <span className="text-[#7F39EC] font-semibold">{match}</span>
        {after}
      </>
    );
  };
  const isUsernameInBio = (bio?: string | null) => {
    if (!bio || !username) return false;

    return bio.toLowerCase().includes(username.toLowerCase());
  };

  const copyGocUsernameToClipboard = () => {
    if (!username?.trim()) {
      toast({
        title: "Set a username first",
        description:
          "Add your Game Of Creators username on your Profile page, then try again.",
        variant: "destructive",
      });
      return;
    }
    void navigator.clipboard.writeText(username.trim());
    toast({
      title: "Copied",
      description: "Paste this into your bio on X, then save.",
    });
  };

  const [isTwitterModalOpen, setIsTwitterModalOpen] = useState(false);
  const [twitterUsername, setTwitterUsername] = useState("");
  const [twitterFetchState, setTwitterFetchState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [twitterProfile, setTwitterProfile] = useState<any | null>(null);
  const [isSavingTwitter, setIsSavingTwitter] = useState(false);
  
  // Ref to trigger AccountSwitcher modal
  const accountSwitcherRef = useRef<HTMLDivElement>(null);


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
    } else if (
      error === "tiktok_not_allowed_india" ||
      error === "tiktok_not_allowed_region"
    ) {
      toast({
        title: "TikTok Not Allowed",
        description:
          "TikTok is not allowed in your country. Please use a VPN to connect and participate in TikTok campaigns.",
        variant: "destructive",
        duration: 10000,
      });

      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      router.replace(newUrl.pathname);
    }

    // Handle success parameters
    // Pattern A: success=true&platform=youtube|instagram|tiktok
    if (success === "true" && platform) {
      const platformName =
        platform === "youtube"
          ? "YouTube"
          : platform === "instagram"
            ? "Instagram"
            : platform === "twitter"
              ? "Twitter (X)"
              : "TikTok";

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

    // Pattern B: success=youtube_connected | instagram_connected | tiktok_connected
    if (
      success === "youtube_connected" ||
      success === "instagram_connected" ||
      success === "tiktok_connected"
    ) {
      const platformName =
        success === "youtube_connected"
          ? "YouTube"
          : success === "instagram_connected"
            ? "Instagram"
            : "TikTok";

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

  // Reset navigation states when route changes
  useEffect(() => {
    setNavigatingProfile(false);
    setNavigatingTerms(false);
    setNavigatingPrivacy(false);
  }, [pathname]);

  // Function declarations
  const refreshInstagramToken = async (
    currentToken: string,
    userId: string,
    currentProfile: CreatorProfile,
  ) => {
    try {
      const refreshRes = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`,
      );
      const newData = await refreshRes.json();

      if (!refreshRes.ok || newData.error) {
        throw new Error(
          newData.error?.message || "Failed to refresh Instagram token",
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
          : null,
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

        if (userError) {
          console.error("User table fetch error:", userError.message, userError.details);
          throw userError;
        }
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
            .select(
              "youtube_account, instagram_account, tiktok_account, phone_number, date_of_birth, gender, country, state, city, address, languages, categories, subcategories, interests, has_claimed_profile_reward",
            )
            .eq("id", user!.id)
            .single();

          if (error) {
            console.error("Creator profile fetch error:", error.message, error.details);
            throw error;
          }
          setProfile(data);
          setCreatorProfileData(data);

          // Check and refresh Instagram token
          if (
            data.instagram_account?.access_token &&
            data.instagram_account?.token_expiry
          ) {
            const shouldRefresh = dayjs().isAfter(
              dayjs(data.instagram_account.token_expiry).subtract(7, "days"),
            ); // Refresh 7 days before expiry
            if (shouldRefresh) {
              console.log("Attempting to refresh Instagram token");
              await refreshInstagramToken(
                data.instagram_account.access_token,
                user!.id,
                data,
              );
            }
          }
        } else if (userData.user_type === "advertiser") {
          const { data, error } = await supabase
            .from("advertiser_profiles")
            .select("company_name, website_url, subscription_info")
            .eq("id", user!.id)
            .single();

          if (error) {
            console.error("Advertiser profile fetch error:", error.message, error.details);
            throw error;
          }
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
        console.error("Error loading profile details:", err);
        const errorMessage = typeof err === 'object' && err !== null && 'message' in err 
          ? (err as any).message 
          : "Unknown error";
          
        toast({
          title: "Profile Loading Failed",
          description: `Error: ${errorMessage}. Please try refreshing the page.`,
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

      if (creatorProfile.tiktok_account) {
        setTiktokAccount(creatorProfile.tiktok_account);
        setTiktokConnected(true);
      } else {
        setTiktokAccount(null);
        setTiktokConnected(false);
      }
    } else {
      // Reset if profile is null or user is not a creator, or if profile is for an advertiser
      setYoutubeAccount(null);
      setYoutubeConnected(false);
      setInstagramAccount(null);
      setInstagramConnected(false);
      setTiktokAccount(null);
      setTiktokConnected(false);
    }
  }, [profile, userType]);

  // Load or refresh connected Twitter (X) account details
  const loadTwitterAccount = async () => {
    try {
      const response = await fetch("/api/twitter-apis/get-profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to load Twitter account", response.statusText);
        toast({
          title: "Error",
          description: "Failed to refresh Twitter (X) account details.",
          variant: "destructive",
        });
        return;
      }

      const result = await response.json();
      setTwitterAccount(result.twitterAccount || null);
      setTwitterConnected(!!result.twitterAccount);

      // Only show success toast when user explicitly refreshes
      if (isRefreshingTwitter) {
        toast({
          title: "Twitter (X) updated",
          description: "Latest Twitter (X) profile details have been fetched.",
        });
      }
    } catch (error) {
      console.error("Failed to load Twitter account", error);
      toast({
        title: "Error",
        description: "Failed to refresh Twitter (X) account details.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingTwitter(false);
    }
  };

  useEffect(() => {
    if (userType === "creator") {
      loadTwitterAccount();
    }
  }, [userType]);

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
    value: boolean,
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
    // Strip trailing slash so redirect_uri matches App Dashboard; avoid double slashes
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(
      /\/$/,
      "",
    );

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
      // Must exactly match one of the Valid OAuth Redirect URIs in App Dashboard
      const instagramRedirectUri = `${appBaseUrl}/api/instagram/callback`;

      const scopes = [
        "instagram_business_basic",
        "instagram_business_manage_insights",
      ].join(",");

      // Business login: www.instagram.com/oauth/authorize per official docs; force_reauth=true
      const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${instagramClientId}&redirect_uri=${encodeURIComponent(
        instagramRedirectUri,
      )}&response_type=code&scope=${encodeURIComponent(scopes)}&force_reauth=true`;

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

      const response = await fetch("/api/creator/social-disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "instagram" }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to disconnect Instagram.");
      }

      setInstagramAccount(null);
      setProfile((prev) =>
        prev ? { ...prev, instagram_account: null } : null,
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

  const handleTiktokConnect = () => {
    if (typeof window === "undefined") {
      toast({
        title: "Error",
        description:
          "Window object not available. Please refresh the page and try again.",
        variant: "destructive",
      });
      setIsLoadingTiktok(false);
      return;
    }

    setIsLoadingTiktok(true);

    try {
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Only send timezone, don't send country to avoid regional blocking
      const queryParams = new URLSearchParams({
        tz: userTimeZone,
      });

      const redirectUrl = `/api/auth/tiktok/authorize?${queryParams.toString()}`;

      console.log("[TikTok Connect] Redirecting to:", redirectUrl);
      console.log("[TikTok Connect] Query params:", queryParams.toString());

      // Force redirect to ensure OAuth flow starts
      window.location.assign(redirectUrl);
    } catch (err: any) {
      console.error("[TikTok Connect] Error:", err);
      setIsLoadingTiktok(false);
      toast({
        title: "Error",
        description: err.message || "Failed to initiate TikTok connection",
        variant: "destructive",
      });
    }
  };

  const handleTiktokDisconnect = async () => {
    if (!user) return;
    setIsLoadingTiktokDisconnect(true);
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          tiktok_account: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setTiktokAccount(null);
      setTiktokConnected(false);

      toast({
        title: "Success",
        description: "TikTok account disconnected successfully.",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to disconnect TikTok account.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTiktokDisconnect(false);
    }
  };

  const handleTwitterDisconnect = async () => {
    if (!user) return;
    setIsLoadingTwitterDisconnect(true);
    try {
      const timeoutId = setTimeout(() => {
        setIsLoadingTwitterDisconnect(false);
        toast({
          title: "Error",
          description: "Disconnection timed out. Please try again.",
          variant: "destructive",
        });
      }, API_TIMEOUT_SHORT);

      const response = await fetch("/api/creator/social-disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform: "twitter" }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error || "Failed to disconnect Twitter account.",
        );
      }

      setTwitterAccount(null);
      setTwitterConnected(false);
      toast({
        title: "Success",
        description: "Twitter (X) account disconnected successfully.",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to disconnect Twitter account.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTwitterDisconnect(false);
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

      const response = await fetch("/api/creator/social-disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "youtube" }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to disconnect YouTube.");
      }

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

  const handleNavigation = (item: string, href: string) => {
    switch (item) {
      case "profile":
        setNavigatingProfile(true);
        break;
      case "terms":
        setNavigatingTerms(true);
        break;
      case "privacy":
        setNavigatingPrivacy(true);
        break;
    }
    router.push(href);
  };

  const fetchBillingDetails = async () => {
    if (!user?.id) return;

    setBillingLoading(true);
    try {
      const response = await fetch(
        `/api/subscriptions/billing-details?t=${Date.now()}`,
        {
          cache: "no-store",
        },
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
              : "bg-yellow-100 text-yellow-800 border border-yellow-300",
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
              : "bg-green-100 text-green-800 border border-green-300",
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
            : "bg-gray-100 text-gray-800 border border-gray-300",
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Calculate profile completion percentage
  const getProfileCompletionPercentage = () => {
    if (!creatorProfileData || userType !== "creator") return 0;

    // Check if reward has already been claimed
    if (creatorProfileData.has_claimed_profile_reward) return 100;

    // List of all required fields
    const fields = [
      {
        name: "phone_number",
        check: () =>
          creatorProfileData.phone_number &&
          creatorProfileData.phone_number.trim() !== "",
      },
      {
        name: "date_of_birth",
        check: () =>
          creatorProfileData.date_of_birth &&
          creatorProfileData.date_of_birth.trim() !== "",
      },
      {
        name: "gender",
        check: () =>
          creatorProfileData.gender && creatorProfileData.gender.trim() !== "",
      },
      {
        name: "country",
        check: () =>
          creatorProfileData.country &&
          creatorProfileData.country.trim() !== "",
      },
      {
        name: "state",
        check: () =>
          creatorProfileData.state && creatorProfileData.state.trim() !== "",
      },
      {
        name: "city",
        check: () =>
          creatorProfileData.city && creatorProfileData.city.trim() !== "",
      },
      {
        name: "address",
        check: () =>
          creatorProfileData.address &&
          creatorProfileData.address.trim() !== "",
      },
      {
        name: "languages",
        check: () =>
          creatorProfileData.languages &&
          Array.isArray(creatorProfileData.languages) &&
          creatorProfileData.languages.length > 0,
      },
      {
        name: "categories",
        check: () =>
          creatorProfileData.categories &&
          ((Array.isArray(creatorProfileData.categories) &&
            creatorProfileData.categories.length > 0) ||
            (typeof creatorProfileData.categories === "object" &&
              Object.keys(creatorProfileData.categories).length > 0)),
      },
      {
        name: "subcategories",
        check: () =>
          creatorProfileData.subcategories &&
          ((Array.isArray(creatorProfileData.subcategories) &&
            creatorProfileData.subcategories.length > 0) ||
            (typeof creatorProfileData.subcategories === "object" &&
              Object.keys(creatorProfileData.subcategories).length > 0)),
      },
      {
        name: "interests",
        check: () =>
          creatorProfileData.interests &&
          Array.isArray(creatorProfileData.interests) &&
          creatorProfileData.interests.length > 0,
      },
    ];

    // Count filled fields
    const filledFields = fields.filter((field) => field.check()).length;
    const totalFields = fields.length;

    // Calculate percentage
    return Math.round((filledFields / totalFields) * 100);
  };

  // Check if profile is incomplete
  const isProfileIncomplete = () => {
    if (!creatorProfileData || userType !== "creator") return false;

    // Check if reward has already been claimed
    if (creatorProfileData.has_claimed_profile_reward) return false;

    // Profile is incomplete if percentage is less than 100
    return getProfileCompletionPercentage() < 100;
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
    {
      id: "switch-account",
      title: "Switch Account",
      icon: RefreshCw,
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
            isDark ? "text-white" : "text-gray-900",
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
              : "bg-red-50 border-red-500",
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
                        : "text-red-700 border-red-300",
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
                                "_blank",
                              )
                            }
                            className={cn(
                              "border",
                              isDark
                                ? "text-[#FF5353] border-[#FF5353]"
                                : "text-red-700 border-red-300",
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
                                "_blank",
                              )
                            }
                            className={cn(
                              "border",
                              isDark
                                ? "text-[#FF5353] border-[#FF5353]"
                                : "text-red-700 border-red-300",
                            )}
                          >
                            Learn How
                          </Button>
                        </div>
                        <p
                          className={cn(
                            "text-xs",
                            isDark ? "text-[#FF5353]" : "text-red-600",
                          )}
                        >
                          💡 Tip: You can also create a channel by uploading
                          your first video to YouTube. After creating your
                          channel, return here to connect it.
                        </p>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-[#FF5353]" : "text-red-600",
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
              isDark ? "bg-[#180438]" : "bg-white",
            )}
          >
            <CardTitle
              className={cn(
                "text-2xl",
                isDark ? "text-white" : "text-[#7F39EC]",
              )}
            >
              Manage Your Account
            </CardTitle>
          </div>
          <div
            className={cn(
              "rounded-b-2xl pb-4 shadow-md",
              isDark ? "bg-[#180438]" : "bg-white",
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
                          {youtubeAccount?.needs_reconnect ? (
                            <span className="ml-2 text-amber-600 text-xs">
                              Needs reconnect
                            </span>
                          ) : (
                            <span className="ml-2 text-green-600 text-xs">
                              ✓ Active
                            </span>
                          )}
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
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
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
                      {youtubeAccount?.needs_reconnect && (
                        <Button
                          onClick={handleYouTubeConnect}
                          disabled={isLoadingYouTube}
                          variant="default"
                        >
                          {isLoadingYouTube && (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>
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
              {youtubeConnected && youtubeAccount?.needs_reconnect && (
                <Alert
                  variant="destructive"
                  className="mt-2 border-amber-500/50 bg-amber-500/10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    Your YouTube connection needs to be reconnected. We
                    couldn&apos;t refresh your access (e.g. revoked or expired
                    refresh token). Click <strong>Reconnect</strong> above to
                    sign in with Google again and restore video selection and
                    verification.
                  </AlertDescription>
                </Alert>
              )}
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
                            " ",
                          )}
                          )
                          {instagramAccount?.needs_reconnect ? (
                            <span className="ml-2 text-amber-600 text-xs">
                              Needs reconnect
                            </span>
                          ) : (
                            <span className="ml-2 text-green-600 text-xs">
                              ✓ Active
                            </span>
                          )}
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
                  <>
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
                    {instagramAccount?.needs_reconnect && (
                      <Button
                        onClick={handleInstagramConnect}
                        disabled={isLoading}
                        variant="default"
                        className="ml-2"
                      >
                        {isLoading && (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Reconnect Instagram
                      </Button>
                    )}
                  </>
                ) : (
                  <Button onClick={handleInstagramConnect} disabled={isLoading}>
                    {isLoading && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Connect Instagram
                  </Button>
                )}
              </div>

              {/* Instagram needs reconnect - connected but token/connection failed */}
              {instagramConnected && instagramAccount?.needs_reconnect && (
                <Alert
                  variant="destructive"
                  className="mt-2 border-amber-500/50 bg-amber-500/10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    Your Instagram connection needs to be reconnected. We
                    couldn&apos;t fetch your insights (e.g. expired token or
                    disconnected account). Please click{" "}
                    <strong>Reconnect Instagram</strong> above to reconnect and
                    restore insights for your submissions.
                  </AlertDescription>
                </Alert>
              )}

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

              {/* TikTok Connection */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <SiTiktok className="text-2xl" />
                  <div>
                    <h3 className="font-medium">TikTok</h3>
                    {tiktokConnected ? (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Connected as{" "}
                          <span className="font-medium">
                            {tiktokAccount?.username}
                          </span>
                          {tiktokAccount?.followers_count && (
                            <>
                              {" "}
                              with{" "}
                              {tiktokAccount.followers_count.toLocaleString()}{" "}
                              followers
                            </>
                          )}
                          {tiktokAccount?.needs_reconnect ? (
                            <span className="ml-2 text-amber-600 text-xs">
                              Needs reconnect
                            </span>
                          ) : (
                            <span className="ml-2 text-green-600 text-xs">
                              Connected
                            </span>
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Connect your TikTok account to participate in TikTok
                        campaigns
                      </p>
                    )}
                  </div>
                </div>
                {tiktokConnected ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="bg-[#C90808] text-white"
                      onClick={handleTiktokDisconnect}
                      disabled={isLoadingTiktokDisconnect}
                    >
                      {isLoadingTiktokDisconnect && (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Disconnect
                    </Button>
                    {tiktokAccount?.needs_reconnect && (
                      <Button
                        onClick={handleTiktokConnect}
                        disabled={isLoadingTiktok}
                        variant="default"
                      >
                        {isLoadingTiktok && (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Reconnect
                      </Button>
                    )}
                    </div>
                    

                  </div>
                ) : (
                  <Button
                    onClick={handleTiktokConnect}
                    disabled={isLoadingTiktok}
                  >
                    {isLoadingTiktok && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Connect
                  </Button>
                )}
              </div>

              {/* TikTok needs reconnect - connected but token/connection failed */}
              {tiktokConnected && tiktokAccount?.needs_reconnect && (
                <Alert
                  variant="destructive"
                  className="mt-2 border-amber-500/50 bg-amber-500/10"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    Your TikTok connection needs to be reconnected. We
                    couldn&apos;t fetch your insights (e.g. expired token or
                    disconnected account). Please click{" "}
                    <strong>Reconnect TikTok</strong> above to reconnect and
                    restore insights for your submissions.
                  </AlertDescription>
                </Alert>
              )}

              {/* TikTok Connection Information - Display if not connected */}
              {!tiktokConnected && (
                <Alert
                  variant="default"
                  className="mt-2 border border-[#7F39EC] bg-[#D9C0FF26]"
                >
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    To participate in TikTok campaigns, you need to connect your
                    TikTok account. This allows Game of Creators to securely
                    fetch your video metrics according to campaign rules.
                    <br />
                    <br />
                    <span className="font-semibold text-[#FF5353] dark:text-[#FF8080]">
                      Important⚠️:{" "}
                    </span>
                    TikTok may be unavailable in certain countries. Please use a
                    VPN to connect and participate in TikTok campaigns.
                  </AlertDescription>
                </Alert>
              )}
              {/* Region Warning for India */}
              {creatorProfileData?.country?.toLowerCase() === "india" && (
                <Alert
                  variant="destructive"
                  className="mt-4 border-red-500 bg-red-50 dark:bg-red-950/20"
                >
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-sm text-red-800 dark:text-red-300">
                    <strong>TikTok is currently restricted in India.</strong>{" "}
                    Please use a VPN to connect your account and verify your
                    video submissions. Otherwise, your TikTok account linking
                    may fail or your videos may not be accessible.
                  </AlertDescription>
                </Alert>
              )}

              {/* Twitter Connection */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FaXTwitter
                    className={cn(
                      "text-2xl",
                      isDark ? "text-white" : "text-black",
                    )}
                  />
                  <div>
                    <h3 className="font-medium">Twitter (X)</h3>
                    {twitterConnected && twitterAccount ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">
                          Connected as{" "}
                          {twitterAccount.name ||
                            twitterAccount.username ||
                            "your X account"}
                          <span className="ml-2 text-green-600 text-xs">
                            ✓ Active
                          </span>
                        </p>
                        {/* <button
                          type="button"
                          onClick={async () => {
                            setIsRefreshingTwitter(true);
                            await loadTwitterAccount();
                          }}
                          disabled={isRefreshingTwitter}
                          className="p-1 rounded-full border border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white transition-colors"
                          aria-label="Refresh Twitter (X) profile details"
                        >
                          <RefreshCw
                            className={cn(
                              "h-4 w-4",
                              isRefreshingTwitter && "animate-spin"
                            )}
                          />
                        </button> */}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Not connected
                      </p>
                    )}
                  </div>
                </div>
                {/* onClick={handleTwitterConnect} */}
                {twitterConnected ? (
                  <Button
                    className="bg-[#C90808] text-white"
                    onClick={handleTwitterDisconnect}
                    disabled={isLoadingTwitterDisconnect}
                  >
                    {isLoadingTwitterDisconnect && (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setIsTwitterModalOpen(true);
                      setTwitterFetchState("idle");
                    }}
                  >
                    {/* {isLoading && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )} */}
                    Connect Twitter
                  </Button>
                )}
              </div>
              {/* Twitter Connection Information - Display for guidance */}
              {!twitterConnected && (
                <Alert
                  variant="default"
                  className="mt-2 border border-[#7F39EC] bg-[#D9C0FF26]"
                >
                  <Bell className="h-4 w-4" />
                  <AlertDescription className="text-sm leading-relaxed">
                    Connect X to join Twitter campaigns. We only use your public
                    profile and posts for eligibility and stats. Your X account
                    must be{" "}
                    <strong className="font-semibold">public</strong>. When you
                    click <strong className="font-semibold">Connect Twitter</strong>
                    , follow the short steps in the window (copy your site
                    username into your X bio, then link your handle).
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
            isDark ? "bg-[#180438]" : "bg-white border border-purple-100",
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
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Survey Completed
                  </h3>
                  <p
                    className={cn(
                      "text-xs sm:text-[12.5px] leading-relaxed",
                      isDark ? "text-gray-300" : "text-gray-600",
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
            // Only show switch account for creators
            if (item.id === "switch-account" && userType !== "creator") {
              return false;
            }
            return true;
          })
          .map((item) => {
            const Icon = item.icon ?? FileText;
            if (item.isLink && item.href) {
              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl transition-all duration-200",
                    isDark
                      ? "bg-[#180438] hover:border-purple-500"
                      : "bg-white border border-gray-300 hover:border-purple-300",
                  )}
                >
                  <div
                    onClick={() => handleNavigation(item.id, item.href)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 rounded-t-xl transition-all duration-200 cursor-pointer",
                      item.id === "profile" &&
                        showProfileNotification &&
                        isProfileIncomplete()
                        ? "rounded-b-none"
                        : "rounded-b-xl",
                      (item.id === "profile" && navigatingProfile) ||
                        (item.id === "terms" && navigatingTerms) ||
                        (item.id === "privacy" && navigatingPrivacy)
                        ? "opacity-70"
                        : "",
                    )}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-purple-900/30" : "bg-purple-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-purple-400" : "text-purple-600",
                          )}
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <span
                          className={cn(
                            "font-medium",
                            isDark ? "text-white" : "text-gray-900",
                          )}
                        >
                          {item.title}
                        </span>
                        {/* {item.id === "profile" && (
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isDark ? "text-purple-300" : "text-purple-600"
                            )}
                          >
                            💰 When you fill your complete profile, we give you
                            a $0.50 bonus!
                          </p>
                        )} */}
                      </div>
                    </div>
                    {(item.id === "profile" && navigatingProfile) ||
                    (item.id === "terms" && navigatingTerms) ||
                    (item.id === "privacy" && navigatingPrivacy) ? (
                      <ButtonLoadingSpinner />
                    ) : (
                      <ChevronRight
                        className={cn(
                          "h-5 w-5",
                          isDark ? "text-gray-400" : "text-gray-500",
                        )}
                      />
                    )}
                  </div>
                  {/* Profile Completion Notification */}
                  {item.id === "profile" &&
                    showProfileNotification &&
                    isProfileIncomplete() && (
                      <div
                        className={cn(
                          "relative p-4 border lg:max-w-[1200px] rounded-lg lg:mx-4 mb-4",
                          isDark
                            ? "bg-purple-900/30 border-purple-500"
                            : "bg-purple-50 border-purple-300",
                        )}
                      >
                        {/* <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowProfileNotification(false);
                          }}
                          className={cn(
                            "absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors",
                            isDark
                              ? "text-gray-300 hover:text-white"
                              : "text-gray-700 hover:text-gray-900"
                          )}
                          aria-label="Close notification"
                        >
                          <X className="h-4 w-4" />
                        </button> */}
                        <div className="pr-6">
                          <div className="mb-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span
                                className={cn(
                                  "text-sm font-medium whitespace-nowrap",
                                  isDark ? "text-gray-300" : "text-gray-700",
                                )}
                              >
                                Profile Completion
                              </span>
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "relative h-2 w-32 overflow-hidden rounded-full",
                                    isDark
                                      ? "bg-purple-900/50"
                                      : "bg-purple-100",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-300",
                                      isDark
                                        ? "bg-gradient-to-r from-purple-600 to-purple-500"
                                        : "bg-gradient-to-r from-purple-500 to-purple-400",
                                    )}
                                    style={{
                                      width: `${getProfileCompletionPercentage()}%`,
                                    }}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "text-sm font-bold whitespace-nowrap",
                                    isDark
                                      ? "text-purple-400"
                                      : "text-purple-600",
                                  )}
                                >
                                  {getProfileCompletionPercentage()}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <p
                            className={cn(
                              "text-sm mb-3",
                              isDark ? "text-gray-300" : "text-gray-600",
                            )}
                          >
                            Complete your profile now and claim your $0.50
                            reward!
                          </p>
                          <Link href="/dashboard/profile">
                            <Button
                              className={cn(
                                "w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white font-bold py-2.5 px-6 rounded-full flex items-center justify-center gap-2 transition-colors",
                                isDark && "bg-purple-600 hover:bg-purple-700",
                              )}
                              onClick={() => {
                                setProfileCompletionLoading(true);
                                setTimeout(() => {
                                  window.location.href = "/dashboard/profile";
                                }, 100);
                              }}
                              disabled={profileCompletionLoading}
                            >
                              COMPLETE PROFILE
                              {profileCompletionLoading ? (
                                <ButtonLoadingSpinner />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  {/* Profile Completion Success Notification */}
                  {item.id === "profile" &&
                    showProfileNotification &&
                    creatorProfileData?.has_claimed_profile_reward &&
                    getProfileCompletionPercentage() === 100 && (
                      <div
                        className={cn(
                          "relative p-4 border lg:max-w-[1200px] rounded-lg lg:mx-4 mb-4",
                          isDark
                            ? "bg-green-900/30 border-green-500"
                            : "bg-green-50 border-green-300",
                        )}
                      >
                        <div className="pr-6">
                          <div className="flex items-start gap-3">
                            <CheckCircle2
                              className={cn(
                                "h-5 w-5 flex-shrink-0 mt-0.5",
                                isDark ? "text-green-400" : "text-green-600",
                              )}
                            />
                            <div className="flex-1">
                              <div className="mb-2">
                                <span
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark
                                      ? "text-green-300"
                                      : "text-green-700",
                                  )}
                                >
                                  Profile Completed & Bonus Claimed!
                                </span>
                              </div>
                              <p
                                className={cn(
                                  "text-sm",
                                  isDark ? "text-gray-300" : "text-gray-600",
                                )}
                              >
                                Congratulations! Your profile has been completed
                                and you've successfully claimed your $0.50
                                reward. Your profile is now locked and cannot be
                                edited.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              );
            } else if (item.expandable) {
              const isExpanded = expandedSection === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleSection(item.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200",
                      isDark
                        ? "bg-[#180438] hover:border-purple-500"
                        : "bg-white border border-gray-300 hover:border-purple-300",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-purple-900/30" : "bg-purple-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-purple-400" : "text-purple-600",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5 transition-transform",
                        isExpanded ? "rotate-90" : "",
                        isDark ? "text-gray-400" : "text-gray-500",
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
                      } else if (item.id === "switch-account") {
                        // Trigger the AccountSwitcher modal by programmatically clicking its button
                        const switchButton = accountSwitcherRef.current?.querySelector('button');
                        if (switchButton) {
                          switchButton.click();
                        }
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-4 rounded-xl transition-all duration-200",
                      isDark
                        ? "bg-[#180438] hover:border-purple-500"
                        : "bg-white border border-gray-300 hover:border-purple-300",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-purple-900/30" : "bg-purple-100",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            isDark ? "text-purple-400" : "text-purple-600",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-5 w-5",
                        isDark ? "text-gray-400" : "text-gray-500",
                      )}
                    />
                  </button>
                </div>
              );
            }
            return null;
          })}
      </div>

      {/* Follow Us & Join Communities Section */}
      <div
        className={cn(
          "rounded-xl shadow-lg overflow-hidden",
          isDark ? "bg-[#180438]" : "bg-white border border-gray-300",
        )}
      >
        <div
          className={cn(
            "rounded-t-xl px-6 py-4 border-b",
            isDark
              ? "bg-[#180438] border-gray-700"
              : "bg-white border-gray-200",
          )}
        >
          <CardTitle
            className={cn("text-2xl", isDark ? "text-white" : "text-[#7F39EC]")}
          >
            Follow Us & Join Communities
          </CardTitle>
          <CardDescription className="mt-2">
            Stay connected with us on social media and join our creator
            communities for updates, support, and exclusive opportunities.
          </CardDescription>
        </div>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Social Media Links */}
            <div>
              <h3
                className={cn(
                  "text-lg font-semibold mb-4",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Social Media
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <a
                  href={SOCIAL_LINKS.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#1a0a2e] border-gray-700 hover:border-blue-500 hover:bg-[#1a0a2e]/80"
                      : "bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50",
                  )}
                >
                  <FaXTwitter
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-white" : "text-black",
                    )}
                  />
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Twitter (X)
                  </span>
                  <ExternalLink className="h-4 w-4 ml-auto text-gray-400" />
                </a>
                <a
                  href={SOCIAL_LINKS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#1a0a2e] border-gray-700 hover:border-pink-500 hover:bg-[#1a0a2e]/80"
                      : "bg-white border-gray-300 hover:border-pink-400 hover:bg-pink-50",
                  )}
                >
                  <SiInstagram className="h-5 w-5 text-pink-600" />
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Instagram
                  </span>
                  <ExternalLink className="h-4 w-4 ml-auto text-gray-400" />
                </a>
                <a
                  href={SOCIAL_LINKS.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#1a0a2e] border-gray-700 hover:border-red-500 hover:bg-[#1a0a2e]/80"
                      : "bg-white border-gray-300 hover:border-red-400 hover:bg-red-50",
                  )}
                >
                  <SiYoutube className="h-5 w-5 text-red-600" />
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    YouTube
                  </span>
                  <ExternalLink className="h-4 w-4 ml-auto text-gray-400" />
                </a>
                <a
                  href={SOCIAL_LINKS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#1a0a2e] border-gray-700 hover:border-blue-500 hover:bg-[#1a0a2e]/80"
                      : "bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50",
                  )}
                >
                  <FaLinkedin className="h-5 w-5 text-blue-600" />
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    LinkedIn
                  </span>
                  <ExternalLink className="h-4 w-4 ml-auto text-gray-400" />
                </a>
              </div>
            </div>

            {/* Community Links */}
            <div className="mt-6">
              <h3
                className={cn(
                  "text-lg font-semibold mb-4",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Join Our Communities
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a
                  href={SOCIAL_LINKS.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#5865F2]/10 border-[#5865F2]/30 hover:border-[#5865F2] hover:bg-[#5865F2]/20"
                      : "bg-purple-50 border-purple-200 hover:border-[#5865F2] hover:bg-purple-100",
                  )}
                >
                  <FaDiscord className="h-6 w-6 text-[#5865F2]" />
                  <div className="flex-1">
                    <span
                      className={cn(
                        "font-semibold block",
                        isDark ? "text-white" : "text-gray-900",
                      )}
                    >
                      Discord Community
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        isDark ? "text-gray-400" : "text-gray-600",
                      )}
                    >
                      Get updates, support, and bonus codes
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
                <a
                  href={SOCIAL_LINKS.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border transition-all hover:shadow-md",
                    isDark
                      ? "bg-[#25D366]/10 border-[#25D366]/30 hover:border-[#25D366] hover:bg-[#25D366]/20"
                      : "bg-green-50 border-green-200 hover:border-[#25D366] hover:bg-green-100",
                  )}
                >
                  <FaWhatsapp className="h-6 w-6 text-[#25D366]" />
                  <div className="flex-1">
                    <span
                      className={cn(
                        "font-semibold block",
                        isDark ? "text-white" : "text-gray-900",
                      )}
                    >
                      WhatsApp Community
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        isDark ? "text-gray-400" : "text-gray-600",
                      )}
                    >
                      Connect with creators and get support
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </div>

      {/* Connect Twitter Modal */}
      <Dialog
        open={isTwitterModalOpen}
        onOpenChange={(open) => {
          setIsTwitterModalOpen(open);
          if (!open) {
            setTwitterFetchState("idle");
          }
        }}
        isdark={isDark}
      >
        <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Link your X (Twitter) account
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
              We match your X profile to your Game Of Creators account by
              looking for your site username in your public X bio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <ol
              className={cn(
                "list-none space-y-3 text-sm rounded-lg border p-4",
                isDark
                  ? "border-[#7F39EC]/50 bg-[#D9C0FF]/10"
                  : "border-[#7F39EC]/30 bg-[#D9C0FF26]"
              )}
            >
              <li className="flex gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-[#7F39EC] text-white" : "bg-[#6C43D0] text-white"
                  )}
                >
                  1
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p
                    className={cn(
                      "font-medium leading-snug",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Put your Game Of Creators username in your X bio
                  </p>
                  <p
                    className={cn(
                      "text-xs leading-relaxed",
                      isDark ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    On X: Profile → Edit profile → Bio. Paste the name below,
                    then save.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 items-center rounded-md border px-3 py-2 font-mono text-sm",
                        isDark
                          ? "border-gray-600 bg-[#06021d] text-white"
                          : "border-gray-200 bg-white text-gray-900"
                      )}
                    >
                      <span className="truncate">
                        {username?.trim() ? username.trim() : "—"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={copyGocUsernameToClipboard}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isDark ? "bg-[#7F39EC] text-white" : "bg-[#6C43D0] text-white"
                  )}
                >
                  2
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p
                    className={cn(
                      "font-medium leading-snug",
                      isDark ? "text-white" : "text-gray-900"
                    )}
                  >
                    Tell us your X handle here
                  </p>
                  <p
                    className={cn(
                      "text-xs leading-relaxed",
                      isDark ? "text-gray-300" : "text-gray-600"
                    )}
                  >
                    Type the same handle you use on X (do not include @). Then
                    we load your public profile to confirm the bio.
                  </p>
                </div>
              </li>
            </ol>

            {twitterFetchState !== "success" && (
              <>
                <div className="space-y-2">
                  <Label
                    htmlFor="twitter-username"
                    className={cn(isDark ? "text-white" : "text-gray-900")}
                  >
                    Your X username
                  </Label>
                  <Input
                    id="twitter-username"
                    placeholder="Example: yourhandle"
                    value={twitterUsername}
                    onChange={(e) => setTwitterUsername(e.target.value)}
                    className={cn(
                      isDark
                        ? "bg-[#06021d] border border-gray-600 text-white"
                        : "bg-white text-gray-900",
                    )}
                  />
                </div>

                <div className="flex flex-col items-stretch gap-2 pt-1">
                  <Button
                    type="button"
                    className="w-full bg-[#6C43D0] text-white"
                    disabled={
                      !twitterUsername.trim() || twitterFetchState === "loading"
                    }
                    onClick={async () => {
                      if (!twitterUsername.trim()) return;
                      try {
                        setTwitterFetchState("loading");
                        setTwitterProfile(null);

                        const response = await fetch(
                          "/api/twitter-apis/fetch-profile",
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              screenname: twitterUsername.trim(),
                            }),
                          },
                        );

                        const data = await response.json();

                        if (!response.ok || !data || data.status !== "active") {
                          throw new Error(
                            data?.error || "Unable to fetch active X profile.",
                          );
                        }

                        setTwitterProfile(data);
                        setTwitterFetchState("success");
                        toast({
                          title: "X profile loaded",
                          description:
                            "Check that your bio shows your Game Of Creators username, then save.",
                        });
                      } catch (error: any) {
                        setTwitterFetchState("error");
                        toast({
                          title: "Error",
                          description:
                            error?.message ||
                            "Could not load your X profile. Try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {twitterFetchState === "loading" ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading…</span>
                      </div>
                    ) : (
                      "Load my X profile"
                    )}
                  </Button>
                </div>
              </>
            )}

            {twitterFetchState === "success" && (
              <div className="mt-2 space-y-3">
                <p
                  className={cn(
                    "text-xs text-green-600",
                    isDark && "text-green-400",
                  )}
                >
                  We loaded your public X profile.
                </p>
                {twitterProfile && (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3",
                      isDark
                        ? "border-gray-700 bg-[#06021d]"
                        : "border-gray-200 bg-white",
                    )}
                  >
                    {twitterProfile.avatar && (
                      <img
                        src={twitterProfile.avatar}
                        alt={twitterProfile.name || twitterProfile.profile}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    )}
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold">
                        {twitterProfile.name || "Unnamed"}
                        {twitterProfile.profile && (
                          <span className="ml-1 text-gray-500">
                            @{twitterProfile.profile}
                          </span>
                        )}
                      </div>
                      {twitterProfile.desc && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-300">
                          {highlightUsernameInBio(twitterProfile.desc)}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="text-[11px] text-gray-500">
                          Following:{" "}
                          <strong>{twitterProfile.friends || 0}</strong>
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Followers:{" "}
                          <strong>{twitterProfile.sub_count || 0}</strong>
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Tweets:{" "}
                          <strong>{twitterProfile.statuses_count || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {twitterProfile && (
                  <div className="flex flex-col items-end mt-3 space-y-2">
                    <div className="flex flex-row items-center gap-2">
                      {!isUsernameInBio(twitterProfile.desc) && (
                        <Button
                          type="button"
                          className="bg-[#4A00BE] text-white"
                          onClick={async () => {
                            if (!twitterUsername.trim()) return;
                            try {
                              setTwitterFetchState("loading");
                              setTwitterProfile(null);

                              const response = await fetch(
                                "/api/twitter-apis/fetch-profile",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    screenname: twitterUsername.trim(),
                                  }),
                                },
                              );

                              const data = await response.json();

                              if (
                                !response.ok ||
                                !data ||
                                data.status !== "active"
                              ) {
                                throw new Error(
                                  data?.error ||
                                    "Unable to fetch active X profile.",
                                );
                              }

                              setTwitterProfile(data);
                              setTwitterFetchState("success");
                              toast({
                                title: "X profile loaded",
                                description:
                                  "Check your bio again, then save on X if needed.",
                              });
                            } catch (error: any) {
                              console.error(
                                "Error refreshing X profile",
                                error,
                              );
                              setTwitterFetchState("error");
                              toast({
                                title: "Error",
                                description:
                                  error?.message ||
                                  "Unable to refresh your X profile. Please try again.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Refresh profile
                        </Button>
                      )}
                      <Button
                        type="button"
                        className="bg-[#4A00BE] text-white"
                        disabled={
                          !isUsernameInBio(twitterProfile.desc) ||
                          isSavingTwitter
                        }
                        onClick={async () => {
                          if (!isUsernameInBio(twitterProfile.desc)) return;
                          try {
                            setIsSavingTwitter(true);
                            const response = await fetch(
                              "/api/twitter-apis/save-profile",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  twitterProfile,
                                }),
                              },
                            );

                            const result = await response.json();

                            if (!response.ok || !result?.success) {
                              throw new Error(
                                result?.error ||
                                  "Failed to save Twitter profile. Please try again.",
                              );
                            }

                            toast({
                              title: "Saved & Connected",
                              description:
                                "Twitter (X) profile has been linked. You can now use it for campaigns.",
                            });

                            // Refresh connected state and close dialog so UI updates in real time
                            try {
                              const checkResponse = await fetch(
                                "/api/twitter-apis/get-profile",
                                {
                                  method: "GET",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                },
                              );

                              if (checkResponse.ok) {
                                const checkResult = await checkResponse.json();
                                setTwitterAccount(
                                  checkResult.twitterAccount || null,
                                );
                                setTwitterConnected(
                                  !!checkResult.twitterAccount,
                                );
                              }
                            } catch (e) {
                              console.error(
                                "Failed to refresh Twitter account after save",
                                e,
                              );
                            }

                            setIsTwitterModalOpen(false);
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description:
                                error?.message ||
                                "Failed to save Twitter profile. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSavingTwitter(false);
                          }
                        }}
                      >
                        {isSavingTwitter ? "Saving..." : "Save & Connect"}
                      </Button>
                    </div>
                    {!isUsernameInBio(twitterProfile.desc) && (
                      <p className="text-[11px] text-red-600 text-right dark:text-red-400">
                        {"We still don't see "}
                        <strong className="font-semibold">
                          {username || "your username"}
                        </strong>{" "}
                        in your bio. Add it on X, save, then tap{" "}
                        <strong className="font-semibold">Refresh profile</strong>
                        .
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            {twitterFetchState === "error" && (
              <div className="mt-2 space-y-2">
                <p
                  className={cn(
                    "text-xs",
                    isDark ? "text-red-400" : "text-red-600",
                  )}
                >
                  Something went wrong while fetching your profile. If this
                  continues, please try again after some time.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 px-3 text-[11px]"
                  onClick={async () => {
                    if (!twitterUsername.trim()) return;
                    try {
                      setTwitterFetchState("loading");
                      setTwitterProfile(null);

                      const response = await fetch(
                        "/api/twitter-apis/fetch-profile",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            screenname: twitterUsername.trim(),
                          }),
                        },
                      );

                      const data = await response.json();

                      if (!response.ok || !data || data.status !== "active") {
                        throw new Error(
                          data?.error || "Unable to fetch active X profile.",
                        );
                      }

                      setTwitterProfile(data);
                      setTwitterFetchState("success");
                      toast({
                        title: "X profile loaded",
                        description:
                          "Check that your bio shows your Game Of Creators username, then save.",
                      });
                    } catch (error: any) {
                      setTwitterFetchState("error");
                      toast({
                        title: "Error",
                        description:
                          error?.message ||
                          "Could not load your X profile. Try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
                <strong>Multiple Sign-in Methods:</strong> You can sign in with
                both Google and email/password.
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
                        : "bg-white text-gray-900",
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                      : "bg-white text-gray-900",
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
                      : "bg-white text-gray-900",
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
                  isDark ? "bg-[#06021d]" : "bg-white",
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
                        className={cn(isDark ? "text-white" : "text-gray-900")}
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
                              : "bg-white text-gray-900",
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
                        className={cn(isDark ? "text-white" : "text-gray-900")}
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
                              : "bg-white text-gray-900",
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
                        className={cn(isDark ? "text-white" : "text-gray-900")}
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
                              : "bg-white text-gray-900",
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
                <strong>Note:</strong> You need to set up a username to generate
                referral links. Please set up your username first.
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
                          : "border-gray-400 bg-white",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-4 rounded-xl bg-gradient-to-r ${getPlanColor(
                            plan?.name || "EXPLORER",
                          )} text-white shadow-lg`}
                        >
                          {getPlanIcon(plan?.name || "EXPLORER")}
                        </div>
                        <div>
                          <h3
                            className={cn(
                              "text-xl font-bold",
                              isDark ? "text-white" : "text-black",
                            )}
                          >
                            {plan?.displayName || plan?.name || "N/A"}
                          </h3>
                          <p
                            className={cn(
                              "text-lg font-medium",
                              isDark ? "text-purple-400" : "text-purple-600",
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
                          billingData.billingDetails.cancelAtPeriodEnd,
                        )}
                        {/* View Invoice Button - Show if user has a subscription and invoice URL exists */}
                        {billingData.billingDetails.latestInvoiceUrl &&
                          plan?.name !== "EXPLORER" && (
                            <Button
                              onClick={() => {
                                window.open(
                                  billingData.billingDetails.latestInvoiceUrl,
                                  "_blank",
                                );
                              }}
                              variant="outline"
                              className={cn(
                                "px-4 py-2",
                                isDark
                                  ? "border-purple-500 text-purple-400 hover:bg-purple-900/30"
                                  : "border-purple-500 text-purple-600 hover:bg-purple-50",
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
                                "/dashboard/billing?tab=subscription",
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
                            isDark ? "text-white" : "text-gray-900",
                          )}
                        />
                        <span
                          className={cn(
                            "font-semibold text-lg",
                            isDark ? "text-white" : "text-black",
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
                              : "bg-[#D9C0FF26] border-[#7F39EC] text-black",
                          )}
                        >
                          <p className="text-sm mb-1">Current Period</p>
                          <p className="font-semibold">
                            {formatDateRange(
                              billingData.billingDetails.currentPeriodStart,
                              billingData.billingDetails.currentPeriodEnd,
                            )}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "rounded-2xl p-4 shadow-sm border",
                            isDark
                              ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                              : "bg-[#D9C0FF26] border-[#7F39EC] text-black",
                          )}
                        >
                          <p className="text-sm mb-1">Next Billing Date</p>
                          <p className="font-semibold">
                            {formatDate(
                              billingData.billingDetails.nextBillingDate,
                            )}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "rounded-2xl p-4 shadow-sm border",
                            isDark
                              ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                              : "bg-[#D9C0FF26] border-[#7F39EC] text-black",
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
                            className={cn(
                              isDark ? "text-red-100" : "text-red-900",
                            )}
                          >
                            <strong>Subscription Ending:</strong> Your
                            subscription will be canceled on{" "}
                            {formatDate(
                              billingData.billingDetails.nextBillingDate,
                            )}
                            . You'll lose access to premium features after this
                            date.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Plan Features */}
                      <div className="space-y-2">
                        <h4
                          className={cn(
                            "font-semibold text-lg",
                            isDark ? "text-white" : "text-gray-900",
                          )}
                        >
                          Plan Features
                        </h4>
                        <div
                          className={cn(
                            "rounded-xl p-4 border",
                            isDark
                              ? "bg-[#180438] border-gray-700"
                              : "border-gray-300",
                          )}
                        >
                          <ul className="grid grid-cols-2 gap-3 text-md">
                            <li
                              className={cn(
                                "flex items-center gap-2",
                                isDark ? "text-gray-300" : "text-gray-800",
                              )}
                            >
                              <span className="text-green-600">✓</span>
                              {plan?.features.maxActiveContests || 0} active
                              contests
                            </li>
                            <li
                              className={cn(
                                "flex items-center gap-2",
                                isDark ? "text-gray-300" : "text-gray-800",
                              )}
                            >
                              <span className="text-green-600">✓</span>
                              {plan?.features.commissionPercentage || 0}%
                              commission
                            </li>
                            <li
                              className={cn(
                                "flex items-center gap-2",
                                isDark ? "text-gray-300" : "text-gray-800",
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
                                isDark ? "text-gray-300" : "text-gray-800",
                              )}
                            >
                              <span className="text-green-600">✓</span>
                              {plan?.features.analytics || "N/A"} analytics
                            </li>
                            <li
                              className={cn(
                                "flex items-center gap-2",
                                isDark ? "text-gray-300" : "text-gray-800",
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
          isDark ? "bg-[#180438]" : "bg-white border border-gray-300",
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "p-2 rounded-lg",
              isDark ? "bg-red-900/30" : "bg-red-100",
            )}
          >
            <LogOut
              className={cn(
                "h-5 w-5",
                isDark ? "text-red-400" : "text-red-600",
              )}
            />
          </div>
          <span
            className={cn(
              "font-medium",
              isDark ? "text-white" : "text-gray-900",
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
 
      {/* Account Switcher Component - Hidden but functional - Only for Creators */}
      {userType === "creator" && (
        <div ref={accountSwitcherRef} className="hidden">
          <AccountSwitcher
            currentUserId={user?.id || ""}
            currentUsername={username || user?.user_metadata?.username || user?.email?.split("@")[0] || "User"}
            isDark={isDark}
            userType={userType}
          />
        </div>
      )}
    </div>
  );
}
