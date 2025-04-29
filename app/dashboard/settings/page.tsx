"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Youtube, Instagram, Bell, Mail, Lock, LogOut, Building2, Globe } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"

interface SocialAccount {
  channel_id?: string;
  channel_title?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
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

export default function SettingsPage() {
  const [profile, setProfile] = useState<CreatorProfile | AdvertiserProfile | null>(null)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [userType, setUserType] = useState<"creator" | "advertiser" | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createSupabaseClient()

  useEffect(() => {
    if (!user) {
      setPageLoading(true)
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
        password: newPassword
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

  const handleNotificationChange = async (type: 'email' | 'push', value: boolean) => {
    try {
      if (type === 'email') {
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

  const disconnectAccount = async (platform: 'youtube' | 'instagram') => {
    try {
      const { error } = await supabase
        .from('creator_profiles')
        .update({
          [`${platform}_account`]: null
        })
        .eq('id', user?.id);

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        [`${platform}_account`]: null
      } : null);

      setSuccess(`${platform.charAt(0).toUpperCase() + platform.slice(1)} account disconnected`);
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
      console.log(`updateCompanyProfile: Values - Name: ${companyName}, URL: ${websiteUrl}, UserID: ${currentUserId}`);

      if (!currentUserId) {
        throw new Error("User ID is not available for update.");
      }

      // Nested try/catch specifically for the Supabase call
      let updateResult = null;
      try {
        console.log("updateCompanyProfile: INNER TRY - Attempting Supabase update");
        updateResult = await supabaseClient // Use main client
          .from('advertiser_profiles')
          .update({
            company_name: companyName,
            website_url: websiteUrl,
          })
          .eq('id', currentUserId) // Use logged user ID
          .select();
        console.log("updateCompanyProfile: INNER TRY - Supabase update finished.");
      } catch (innerError: any) {
        console.error("updateCompanyProfile: INNER CATCH - Error during Supabase call:", innerError);
        throw innerError; // Re-throw to be caught by outer catch
      }

      // Process the result from the inner try
      const { data, error } = updateResult || { data: null, error: new Error("Update call failed silently") }; // Handle null result just in case
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

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p>Loading settings...</p>
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
                  <Youtube className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium">YouTube</p>
                  <p className="text-sm text-muted-foreground">
                    {(profile as CreatorProfile)?.youtube_account
                      ? `Connected as ${(profile as CreatorProfile).youtube_account?.channel_title}`
                      : "Not connected"}
                  </p>
                </div>
              </div>
              {(profile as CreatorProfile)?.youtube_account ? (
                <Button
                  variant="outline"
                  onClick={() => disconnectAccount('youtube')}
                >
                  Disconnect
                </Button>
              ) : (
                <Button asChild>
                  <a href="/api/youtube/auth?returnTo=/dashboard/settings">Connect YouTube</a>
                </Button>
              )}
            </div>

            {/* Instagram Account */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-pink-100 rounded-full">
                  <Instagram className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="font-medium">Instagram</p>
                  <p className="text-sm text-muted-foreground">
                    {(profile as CreatorProfile)?.instagram_account
                      ? `Connected as ${(profile as CreatorProfile).instagram_account?.channel_title}`
                      : "Not connected"}
                  </p>
                </div>
              </div>
              {(profile as CreatorProfile)?.instagram_account ? (
                <Button
                  variant="outline"
                  onClick={() => disconnectAccount('instagram')}
                >
                  Disconnect
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Coming Soon
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
            <CardDescription>
              Update your company information
            </CardDescription>
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
              onCheckedChange={(checked) => handleNotificationChange('email', checked)}
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
              onCheckedChange={(checked) => handleNotificationChange('push', checked)}
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

