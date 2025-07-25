"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  User,
  UserCheck,
  Pencil,
  Save,
  X,
  Upload,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import { subscriptionPlans } from "@/constants/subscriptionPlans";

interface UserData {
  id: string;
  full_name: string;
  email: string;
  username: string;
  user_type: string;
  referred_by: string | null;
  coins: number;
  advertisers_referred: number;
  creators_referred: number;
  profile_picture_url?: string | null;
  registration_ip?: string | null;
  login_history?: { ip_address: string; timestamp: string }[];
}

interface CreatorProfile {
  total_contests_participated: number;
  total_contests_won: number;
  total_money_won: number;
  withdrawable_balance: number;
}

interface AdvertiserProfile {
  company_name: string | null;
  website_url: string | null;
  total_money_spent: number;
  total_contests_run: number;
  withdrawable_balance: number;
  available_deposit_balance: number;
  subscription_info: {
    product_id: string;
    price_id: string;
    subscription_id: string;
    last_synced: string;
  } | null;
}

export default function ProfilePage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(
    null
  );
  const [advertiserProfile, setAdvertiserProfile] =
    useState<AdvertiserProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referrer, setReferrer] = useState<string | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [editedFullName, setEditedFullName] = useState("");
  const [isEditingCompanyName, setIsEditingCompanyName] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState("");
  const [isEditingWebsiteUrl, setIsEditingWebsiteUrl] = useState(false);
  const [editedWebsiteUrl, setEditedWebsiteUrl] = useState("");

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setUserData(null);
      setAvatarPreview(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*, profile_picture_url, registration_ip, login_history")
        .eq("id", user.id)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
        setIsLoading(false);
        return;
      }

      setUserData(userData as UserData);
      setEditedFullName(userData.full_name);

      setAvatarPreview(userData.profile_picture_url || null);

      if (userData.referred_by) {
        const { data: referrerData } = await supabase
          .from("users")
          .select("username")
          .eq("referral_code", userData.referred_by)
          .single();

        if (referrerData) {
          setReferrer(referrerData.username);
        }
      }

      if (userData.user_type === "creator") {
        const { data: profile, error: profileError } = await supabase
          .from("creator_profiles")
          .select("*")
          .eq("id", userData.id)
          .single();

        if (!profileError && profile) {
          setCreatorProfile(profile as CreatorProfile);
        }
      } else if (userData.user_type === "advertiser") {
        const { data: profile, error: profileError } = await supabase
          .from("advertiser_profiles")
          .select("*")
          .eq("id", userData.id)
          .single();

        if (!profileError && profile) {
          setAdvertiserProfile(profile as AdvertiserProfile);
          setEditedCompanyName(profile.company_name || "");
          setEditedWebsiteUrl(profile.website_url || "");
        }
      }



      setIsLoading(false);
    };

    fetchUserData();
  }, [supabase]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const getPathFromUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
      const urlObject = new URL(url);
      const bucketName = "profile-images";
      const pathParts = urlObject.pathname.split("/");
      const bucketIndex = pathParts.indexOf(bucketName);
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join("/");
      }
    } catch (e) {
      console.error("Error parsing URL:", e);
    }
    return null;
  };

  const handleAvatarUpload = async () => {
    if (!selectedAvatarFile || !userData) return;

    setIsUploadingAvatar(true);
    const currentUrl = userData.profile_picture_url;
    const fileExt = selectedAvatarFile.name.split(".").pop();
    const newPath = `${userData.id}/avatar-${Date.now()}.${fileExt}`;

    try {
      const currentPath = getPathFromUrl(currentUrl);
      if (currentPath) {
        const { error: removeError } = await supabase.storage
          .from("profile-images")
          .remove([currentPath]);
        if (removeError) {
          console.warn(
            `Could not remove old avatar (${currentPath}), proceeding with upload:`,
            removeError.message
          );
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(newPath, selectedAvatarFile, {
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(newPath);

      const newPublicUrl = urlData?.publicUrl;

      if (!newPublicUrl) {
        throw new Error("Could not get public URL for new avatar.");
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ profile_picture_url: newPublicUrl })
        .eq("id", userData.id);

      if (updateError) throw updateError;

      // Update user_metadata in Supabase Auth - No longer primary path for Nav
      // const { error: authUpdateError } = await supabase.auth.updateUser({
      //   data: { profile_picture_url: newPublicUrl },
      // });

      // if (authUpdateError) {
      //   console.warn(
      //     "Error updating auth user metadata (profile_picture_url):",
      //     authUpdateError.message
      //   );
      //   toast({
      //     variant: "destructive",
      //     title: "Metadata Sync Issue",
      //     description: "Profile picture updated, but session data might be stale. Try refreshing.",
      //   });
      // }

      setUserData((prev) =>
        prev ? { ...prev, profile_picture_url: newPublicUrl } : null
      );
      setAvatarPreview(newPublicUrl);
      setSelectedAvatarFile(null);

      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been successfully updated.",
      });
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description:
          error.message || "Could not update your avatar. Please try again.",
      });

      setAvatarPreview(userData.profile_picture_url || null);
      setSelectedAvatarFile(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleEditFullName = () => {
    setEditedFullName(userData?.full_name || "");
    setIsEditingFullName(true);
  };

  const handleCancelFullName = () => setIsEditingFullName(false);

  const handleSaveFullName = async () => {
    if (!userData || editedFullName === userData.full_name) {
      setIsEditingFullName(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ full_name: editedFullName })
        .eq("id", userData.id);
      if (error) throw error;
      // Update user_metadata for full_name - No longer primary path for Nav
      // const { error: authUpdateError } = await supabase.auth.updateUser({
      //   data: { full_name: editedFullName },
      // });

      // if (authUpdateError) {
      //   console.warn(
      //     "Error updating auth user metadata (full_name):",
      //     authUpdateError.message
      //   );
      //   toast({
      //     variant: "destructive",
      //     title: "Metadata Sync Issue",
      //     description: "Full name updated, but session data might be stale. Try refreshing.",
      //   });
      // }

      setUserData((prev) =>
        prev ? { ...prev, full_name: editedFullName } : null
      );
      setIsEditingFullName(false);
      toast({ title: "Full Name Updated" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCompanyName = () => {
    setEditedCompanyName(advertiserProfile?.company_name || "");
    setIsEditingCompanyName(true);
  };

  const handleCancelCompanyName = () => setIsEditingCompanyName(false);

  const handleSaveCompanyName = async () => {
    if (
      !advertiserProfile ||
      !userData ||
      editedCompanyName === advertiserProfile.company_name
    ) {
      setIsEditingCompanyName(false);
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("advertiser_profiles")
        .update({ company_name: editedCompanyName || null })
        .eq("id", userData.id);
      if (error) throw error;
      setAdvertiserProfile((prev) =>
        prev ? { ...prev, company_name: editedCompanyName || null } : null
      );
      setIsEditingCompanyName(false);
      toast({ title: "Company Name Updated" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditWebsiteUrl = () => {
    setEditedWebsiteUrl(advertiserProfile?.website_url || "");
    setIsEditingWebsiteUrl(true);
  };

  const handleCancelWebsiteUrl = () => setIsEditingWebsiteUrl(false);

  const handleSaveWebsiteUrl = async () => {
    if (
      !advertiserProfile ||
      !userData ||
      editedWebsiteUrl === advertiserProfile.website_url
    ) {
      setIsEditingWebsiteUrl(false);
      return;
    }
    setIsSubmitting(true);
    let urlToSave = editedWebsiteUrl.trim();
    if (
      urlToSave &&
      !urlToSave.startsWith("http://") &&
      !urlToSave.startsWith("https://")
    ) {
      urlToSave = "https://" + urlToSave;
    }
    try {
      const { error } = await supabase
        .from("advertiser_profiles")
        .update({ website_url: urlToSave || null })
        .eq("id", userData.id);
      if (error) throw error;
      setAdvertiserProfile((prev) =>
        prev ? { ...prev, website_url: urlToSave || null } : null
      );
      setEditedWebsiteUrl(urlToSave);
      setIsEditingWebsiteUrl(false);
      toast({ title: "Website URL Updated" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">
          User data not available. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16 border">
              <AvatarImage
                src={avatarPreview || undefined}
                alt={userData?.full_name || "User"}
              />
              <AvatarFallback>
                {userData?.full_name?.[0]?.toUpperCase() ||
                  userData?.email?.[0]?.toUpperCase() ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: "none" }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={triggerAvatarUpload}
                disabled={isUploadingAvatar}
              >
                <Upload className="mr-2 h-4 w-4" /> Change Avatar
              </Button>
              {selectedAvatarFile && (
                <Button
                  variant="default"
                  size="sm"
                  className="ml-2"
                  onClick={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isUploadingAvatar ? "Uploading..." : "Save Avatar"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, WEBP up to 5MB.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Account Information</CardTitle>
          </div>
          <CardDescription>
            Your basic account details. Click the pencil to edit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <Label
                htmlFor="fullName"
                className="text-sm font-medium text-muted-foreground"
              >
                Full Name
              </Label>
              {isEditingFullName ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="fullName"
                    value={editedFullName}
                    onChange={(e) => setEditedFullName(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSaveFullName}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancelFullName}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1">
                  <p>{userData.full_name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditFullName}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="mt-1">{userData.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Username / Referral Code
              </p>
              <p className="font-medium mt-1">{userData.username}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Account Type
              </p>
              <p className="capitalize mt-1">{userData.user_type}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            <CardTitle>Referral Information</CardTitle>
          </div>
          <CardDescription>Referral statistics and details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Referred By
              </p>
              <p>{referrer || "Not referred"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Available Coins
              </p>
              <p>{userData.coins.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Creators Referred
              </p>
              <p>{userData.creators_referred}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Advertisers Referred
              </p>
              <p>{userData.advertisers_referred}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {creatorProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Creator Profile</CardTitle>
            <CardDescription>Your creator statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contests Participated
                </p>
                <p>{creatorProfile.total_contests_participated}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contests Won
                </p>
                <p>{creatorProfile.total_contests_won}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Money Won
                </p>
                <p>{formatMoney(creatorProfile.total_money_won)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Withdrawable Balance
                </p>
                <p className="font-medium">
                  {formatMoney(creatorProfile.withdrawable_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {advertiserProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Advertiser Profile</CardTitle>
            <CardDescription>
              Your advertiser statistics and details. Click the pencil to edit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-x-4 gap-y-6">
              <div>
                <Label
                  htmlFor="gameofcreators"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Company Name
                </Label>
                {isEditingCompanyName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="gameofcreators"
                      value={editedCompanyName}
                      onChange={(e) => setEditedCompanyName(e.target.value)}
                      placeholder="Game of Creators"
                      disabled={isSubmitting}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSaveCompanyName}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancelCompanyName}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    <p>
                      {advertiserProfile.company_name || (
                        <span className="text-muted-foreground italic">
                          Not set
                        </span>
                      )}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEditCompanyName}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label
                  htmlFor="websiteUrl"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Website
                </Label>
                {isEditingWebsiteUrl ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="websiteUrl"
                      type="url"
                      value={editedWebsiteUrl}
                      onChange={(e) => setEditedWebsiteUrl(e.target.value)}
                      placeholder="https://www.gameofcreators.com/"
                      disabled={isSubmitting}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSaveWebsiteUrl}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCancelWebsiteUrl}
                      disabled={isSubmitting}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-1">
                    {advertiserProfile.website_url ? (
                      <a
                        href={advertiserProfile.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {advertiserProfile.website_url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">
                        Not set
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleEditWebsiteUrl}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Subscription Plan
                </p>
                <p className="font-medium mt-1">
                  {advertiserProfile?.subscription_info?.product_id
                    ? subscriptionPlans.find(
                      (plan) =>
                        plan.id === advertiserProfile.subscription_info!.product_id
                    )?.displayName ?? "Unknown Plan"
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contests Run
                </p>
                <p className="mt-1">{advertiserProfile.total_contests_run}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Money Spent
                </p>
                <p className="mt-1">
                  {formatMoney(advertiserProfile.total_money_spent)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Withdrawable Balance
                </p>
                <p className="mt-1">
                  {formatMoney(advertiserProfile.withdrawable_balance)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Available Deposit Balance
                </p>
                <p className="font-medium mt-1">
                  {formatMoney(advertiserProfile.available_deposit_balance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
