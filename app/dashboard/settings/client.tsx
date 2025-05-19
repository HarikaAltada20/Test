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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import { Bell, LogOut, Mail, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { SiInstagram, SiYoutube } from "react-icons/si";
import dayjs from 'dayjs';
import { useRouter } from "next/navigation";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter);

interface SocialAccount {
  id: string;
  provider: string;
  username?: string;
  email?: string;
  profile_picture_url?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: string; // ISO string
  // YouTube specific
  channel_id?: string;
  channel_title?: string;
  subscriber_count?: number;
  video_count?: number;
  // Instagram specific
  instagram_user_id?: string; // Actual global IG User ID
  app_scoped_user_id?: string; // IGBA ID or Professional Account ID for the app
  name_of_account?: string; // User's full name on IG
  account_type?: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
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
  subscription_plan: string;
}

export default function SettingsPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const [profile, setProfile] = useState<
    CreatorProfile | AdvertiserProfile | null
  >(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userType, setUserType] = useState<"creator" | "advertiser" | null>(
    null
  );
  const [pageLoading, setPageLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const [youtubeAccount, setYoutubeAccount] = useState<SocialAccount | null>(null);
  const [instagramAccount, setInstagramAccount] = useState<SocialAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPageLoading(true);
      return;
    }

    async function loadProfile() {
      setPageLoading(true);
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user!.id)
          .single();

        if (userError) throw userError;
        setUserType(userData.user_type);

        if (userData.user_type === "creator") {
          const { data, error } = await supabase
            .from("creator_profiles")
            .select("youtube_account, instagram_account")
            .eq("id", user!.id)
            .single();

          if (error) throw error;
          setProfile(data);

          // Check and refresh Instagram token
          if (data.instagram_account?.access_token && data.instagram_account?.token_expiry) {
            const shouldRefresh = dayjs().isAfter(dayjs(data.instagram_account.token_expiry).subtract(7, 'days')); // Refresh 7 days before expiry
            if (shouldRefresh) {
              console.log('Attempting to refresh Instagram token');
              await refreshInstagramToken(data.instagram_account.access_token, user!.id, data);
            }
          }
        } else if (userData.user_type === "advertiser") {
          const { data, error } = await supabase
            .from("advertiser_profiles")
            .select("company_name, website_url, subscription_plan")
            .eq("id", user!.id)
            .single();

          if (error) throw error;
          setProfile(data);
        } else {
          console.error("Unknown user type:", userData.user_type);
          setError("Unknown user type encountered.");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile information.");
      } finally {
        setPageLoading(false);
      }
    }

    loadProfile();
  }, [user, supabase]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPasswordChangeLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setPasswordChangeLoading(false);
    }
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

  const disconnectAccount = async (platform: "youtube" | "instagram") => {
    try {
      const { error } = await supabase
        .from("creator_profiles")
        .update({
          [`${platform}_account`]: null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      setProfile((prev) =>
        prev
          ? {
            ...prev,
            [`${platform}_account`]: null,
          }
          : null
      );

      setSuccess(
        `${platform.charAt(0).toUpperCase() + platform.slice(1)
        } account disconnected`
      );
    } catch (err: any) {
      setError(err.message || `Failed to disconnect ${platform} account`);
    }
  };

  const updateCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("updateCompanyProfile: Starting");
    setError(null);
    setSuccess(null);
    setPasswordChangeLoading(true);

    // Use the main component's Supabase client again
    const supabaseClient = supabase;

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
        updateResult = await supabaseClient // Use main client
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

      setSuccess("Company profile updated successfully");
      console.log("updateCompanyProfile: Set success message");
    } catch (err: any) {
      console.error("updateCompanyProfile: OUTER CATCH - Error caught:", err);
      setError(err.message || "Failed to update company profile");
    } finally {
      console.log("updateCompanyProfile: Reached finally block");
      setPasswordChangeLoading(false);
    }
  };

  const refreshInstagramToken = async (currentToken: string, userId: string, currentProfile: CreatorProfile) => {
    try {
      const refreshRes = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`);
      const newData = await refreshRes.json();

      if (!refreshRes.ok || newData.error) {
        throw new Error(newData.error?.message || 'Failed to refresh Instagram token');
      }

      const updatedInstagramAccount = {
        ...(currentProfile.instagram_account || {}),
        access_token: newData.access_token,
        token_expiry: dayjs().add(59, 'days').toISOString(), // Refreshed token is also valid for 60 days
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('creator_profiles')
        .update({
          instagram_account: updatedInstagramAccount,
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setProfile(prev => prev ? { ...prev, instagram_account: updatedInstagramAccount as SocialAccount } : null);
      console.log('Instagram token refreshed successfully');
      // Optionally show a success message to the user, though this can be silent

    } catch (err: any) {
      console.error('Error refreshing Instagram token:', err);
      // Handle token refresh error, e.g., notify user, attempt disconnect, or ask to re-authenticate
      // For now, we'll log the error. Depending on the error type (e.g. token revoked), 
      // you might want to nullify the instagram_account or prompt for re-login.
      setError(`Failed to refresh Instagram token: ${err.message}. Please try reconnecting your account.`);
    }
  };

  const handleInstagramConnect = () => {
    const instagramClientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!instagramClientId) {
      setError("Instagram Client ID is not configured. Please contact support.");
      return;
    }
    if (!appBaseUrl) {
      setError("Application Base URL is not configured. Please contact support.");
      return;
    }

    setIsLoading(true);
    try {
      const instagramRedirectUri = `${appBaseUrl}/api/instagram/callback`;
      const scopes = [
        'instagram_business_basic',
        'instagram_business_manage_insights',
        'instagram_business_content_publish',
      ].join(',');

      const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${instagramClientId}&redirect_uri=${encodeURIComponent(instagramRedirectUri)}&scope=${scopes}&response_type=code&enable_fb_login=0&force_authentication=1`;

      // Set a timeout to reset loading state if redirect doesn't happen
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setError("Connection timed out. Please try again.");
      }, 5000);

      window.location.href = authUrl;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "Failed to initiate Instagram connection");
    }
  };

  const handleInstagramDisconnect = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsLoading(false);
        setError("Disconnection timed out. Please try again.");
      }, 5000);

      const { error: updateError } = await supabase
        .from('creator_profiles')
        .update({ instagram_account: null, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      clearTimeout(timeoutId);

      if (updateError) throw updateError;

      setInstagramAccount(null);
      setProfile(prev => prev ? { ...prev, instagram_account: null } : null);
      setSuccess("Instagram account disconnected successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to disconnect Instagram account.");
    } finally {
      setIsLoading(false);
    }
  };

  // Add similar refresh logic for Instagram if token is about to expire
  // This is just a placeholder, actual refresh should happen server-side or via a secure backend call
  const checkAndRefreshInstagramToken = useCallback(async () => {
    if (!instagramAccount || !instagramAccount.access_token || !instagramAccount.token_expiry) {
      return;
    }

    if (dayjs(instagramAccount.token_expiry).isBefore(dayjs().add(7, 'day'))) {
      setSuccess("Instagram token is nearing expiry. Ideally, this would trigger a server-side refresh or prompt for re-authentication.");
      // In a real app, you might call a backend endpoint that securely refreshes the token.
      // e.g., await fetch('/api/instagram/refresh-token', { method: 'POST' });
      // For now, this is a client-side notice. The cron job will handle the actual refresh.
    }
  }, [instagramAccount]);

  useEffect(() => {
    checkAndRefreshInstagramToken();
  }, [checkAndRefreshInstagramToken]);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading settings...</p>
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
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Connected Accounts - Only for Creators */}
      {userType === "creator" && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Manage your connected social media accounts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* YouTube Account */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <SiYoutube className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">YouTube</p>
                  <p className="text-sm text-muted-foreground">
                    {(profile as CreatorProfile)?.youtube_account
                      ? `Connected as ${(profile as CreatorProfile).youtube_account
                        ?.channel_title
                      }`
                      : "Not connected"}
                  </p>
                  {!(profile as CreatorProfile)?.youtube_account && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      Connect to allow Game Of Creators to view basic channel
                      info (name, subscribers) and list your videos for
                      opportunities. We only request{" "}
                      <span className="font-medium">read-only access</span> and{" "}
                      <span className="font-medium">cannot</span> upload,
                      modify, or change settings.
                    </p>
                  )}
                </div>
              </div>
              {(profile as CreatorProfile)?.youtube_account ? (
                <Button
                  variant="outline"
                  onClick={() => disconnectAccount("youtube")}
                >
                  Disconnect
                </Button>
              ) : (
                <Button asChild>
                  <a href="/api/youtube/auth?returnTo=/dashboard/settings">
                    Connect YouTube
                  </a>
                </Button>
              )}
            </div>

            {/* Instagram Account */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-pink-100 rounded-full">
                  <SiInstagram className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-medium">Instagram</p>
                  <p className="text-sm text-muted-foreground">
                    {(profile as CreatorProfile)?.instagram_account
                      ? `Connected as ${(profile as CreatorProfile).instagram_account
                        ?.username
                      }`
                      : "Not connected"}
                  </p>
                </div>
              </div>
              {(profile as CreatorProfile)?.instagram_account ? (
                <Button
                  variant="outline"
                  onClick={handleInstagramDisconnect}
                  disabled={isLoading}
                >
                  {isLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleInstagramConnect}
                  disabled={isLoading}
                >
                  {isLoading && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                  Connect Instagram
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Profile - Only for Advertisers */}
      {userType === "advertiser" && (
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Update your company information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updateCompanyProfile} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

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

              <Button type="submit" disabled={passwordChangeLoading}>
                {passwordChangeLoading ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      <Card>
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
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Update your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={passwordChangeLoading}>
              {passwordChangeLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card>
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
      </Card>
    </div>
  );
}
