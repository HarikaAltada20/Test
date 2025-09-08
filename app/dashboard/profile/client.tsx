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
import {
  validateName,
  NAME_CONSTRAINTS,
  sanitizeFullNameInput,
  getCharacterCountDisplay,
  isApproachingLimit,
} from "@/lib/name-utils";
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

  // Function to notify other components about profile updates
  const notifyProfileUpdate = () => {
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [editedFullName, setEditedFullName] = useState("");
  const [fullNameError, setFullNameError] = useState<string | null>(null);
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

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.log("No authenticated user found");
          setIsLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*, profile_picture_url")
          .eq("id", user.id)
          .single();

        if (userError) {
          console.error("Error fetching user data:", userError);
          // Don't return here, continue with what we have
          if (userError.code === "PGRST116") {
            console.log("User not found in database, but authenticated");
            setIsLoading(false);
            return;
          }
        }

        if (!userData) {
          console.log("No user data returned from database");
          setIsLoading(false);
          return;
        }

        setUserData(userData as UserData);
        setEditedFullName(userData.full_name);

        setAvatarPreview(userData.profile_picture_url || null);

        if (userData.referred_by) {
          try {
            const { data: referrerData } = await supabase
              .from("users")
              .select("username")
              .eq("referral_code", userData.referred_by)
              .single();

            if (referrerData) {
              setReferrer(referrerData.username);
            }
          } catch (referrerError) {
            console.warn("Error fetching referrer data:", referrerError);
            // Continue without referrer data
          }
        }

        if (userData.user_type === "creator") {
          try {
            const { data: profile, error: profileError } = await supabase
              .from("creator_profiles")
              .select("*")
              .eq("id", userData.id)
              .single();

            if (!profileError && profile) {
              setCreatorProfile(profile as CreatorProfile);
            }
          } catch (profileError) {
            console.warn("Error fetching creator profile:", profileError);
            // Continue without creator profile
          }
        } else if (userData.user_type === "advertiser") {
          try {
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
          } catch (profileError) {
            console.warn("Error fetching advertiser profile:", profileError);
            // Continue without advertiser profile
          }
        }
      } catch (error) {
        console.error("Unexpected error in fetchUserData:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [supabase]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please select a valid image file (PNG, JPG, or WEBP).",
      });
      // Clear the file input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (5MB = 5 * 1024 * 1024 bytes)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      // Clear the file input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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

    // Double-check file validation before upload
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedAvatarFile.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please select a valid image file (PNG, JPG, or WEBP).",
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (selectedAvatarFile.size > maxSize) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

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

      // Clear the file input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Notify other components about the profile update
      notifyProfileUpdate();

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

      // Clear the file input to allow re-selection of the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleEditFullName = () => {
    setEditedFullName(userData?.full_name || "");
    setFullNameError(null);
    setIsEditingFullName(true);
  };

  const handleFullNameChange = (value: string) => {
    const sanitized = sanitizeFullNameInput(value);
    setEditedFullName(sanitized);

    if (sanitized.length > 0) {
      const validation = validateName(sanitized, "full");
      setFullNameError(validation.isValid ? null : validation.error || null);
    } else {
      setFullNameError(null);
    }
  };

  const handleCancelFullName = () => setIsEditingFullName(false);

  const handleSaveFullName = async () => {
    if (!userData || editedFullName === userData.full_name) {
      setIsEditingFullName(false);
      return;
    }

    // Validate the name before saving
    const validation = validateName(editedFullName.trim(), "full");
    if (!validation.isValid) {
      setFullNameError(validation.error || "Invalid name");
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

      // Notify other components about the profile update
      notifyProfileUpdate();

      toast({
        title: "Profile Updated",
        description: "Your full name has been successfully updated.",
      });
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
    <div className="space-y-10">
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold">Profile</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Manage your Profile Information
        </p>
      </div>
      <div>
        <div className="bg-white rounded-t-2xl border-b px-6 py-4 shadow-lg">
          <CardTitle className="text-2xl text-[#7F39EC]">
            Your Details
          </CardTitle>
        </div>
        <div className="bg-white rounded-b-2xl shadow-lg px-2 pb-4">
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {/* <User className="h-4 w-4" /> */}
              <CardTitle className="text-xl font-semibold">
                Account Information
              </CardTitle>
            </div>
            <CardDescription className="mt-2 text-md">
              Your basic account details. Editable fields show an edit button on
              hover.
            </CardDescription>
          </div>
          <CardHeader>
            <div className="flex items-center gap-6 mb-6">
              <div className="relative group">
                <Avatar className="h-20 w-20 border-2 border-border transition-all duration-200 group-hover:border-primary">
                  <AvatarImage
                    src={avatarPreview || undefined}
                    alt={userData?.full_name || "User"}
                  />
                  <AvatarFallback className="text-xl font-semibold">
                    {userData?.full_name?.[0]?.toUpperCase() ||
                      userData?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div
                  className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                  onClick={triggerAvatarUpload}
                >
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: "none" }}
                />
              </div>
              <div className="flex-1">
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer hover:text-primary transition-colors"
                  onClick={triggerAvatarUpload}
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Change Avatar</span>
                </div>
                {selectedAvatarFile && (
                  <div className="flex gap-2 mb-2">
                    <Button
                      variant="default"
                      size="sm"
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAvatarFile(null);
                        setAvatarPreview(userData?.profile_picture_url || null);
                        // Clear the file input to allow re-selection of the same file
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      disabled={isUploadingAvatar}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WEBP up to 5MB. Hover over avatar to change.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-12">
              <div className="space-y-3">
                {isEditingFullName ? (
                  <div className="space-y-2 mt-1">
                    <div className="flex items-center gap-2 relative w-full">
                      {/* Floating Label Input */}
                      <div className="relative flex-1">
                        <input
                          id="fullName"
                          value={editedFullName}
                          onChange={(e) => handleFullNameChange(e.target.value)}
                          disabled={isSubmitting}
                          maxLength={NAME_CONSTRAINTS.FULL_NAME_MAX}
                          placeholder=" "
                          className={`peer px-2.5 pb-2.5 pt-4 w-full text-[14px] text-gray-900 
                   border border-gray-300 rounded-lg 
                   focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-blue-500
             
                ${
                  fullNameError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                }
                ${
                  isApproachingLimit(
                    editedFullName.length,
                    NAME_CONSTRAINTS.FULL_NAME_MAX
                  )
                    ? "border-yellow-500"
                    : ""
                }`}
                        />
                        <label
                          htmlFor="fullName"
                          className="absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]
                peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400"
                        >
                          Full Name
                        </label>
                      </div>

                      {/* Save + Cancel Buttons */}
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

                    {/* Character count + Error */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {getCharacterCountDisplay(
                          editedFullName.length,
                          NAME_CONSTRAINTS.FULL_NAME_MAX
                        )}
                      </span>
                      {fullNameError && (
                        <span className="text-xs text-red-500">
                          {fullNameError}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full">
                    {/* Display Mode: Read-only Input with Edit Button */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={userData.full_name}
                        readOnly
                        className="peer block w-full rounded-lg border focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-purple-500 px-3 pr-10 pt-5 pb-2 text-md text-[#1A1A1A] bg-gray-50 cursor-default"
                        placeholder=" "
                      />
                      <label
                        htmlFor="fullName"
                        className="absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[13px] text-[#1A1A1A]"
                      >
                        Full Name
                      </label>
                      <button
                        type="button"
                        onClick={handleEditFullName}
                        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className="absolute left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-md text-gray-500 
               peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400"
                >
                  Floating label
                </label>
                <input
                  type="text"
                  id="floating"
                  placeholder=" "
                  className="peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-sm text-gray-900 
               focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div> */}

              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A] 
               "
                >
                  Email
                </label>
                <div className="bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p
                    className="text-base text-[15px]  text-muted-foreground truncate min-w-0"
                    title={userData.email}
                  >
                    {userData.email}
                  </p>
                </div>
              </div>

              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
                >
                  Username / Referral Code
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p
                    className="text-base text-[15px] text-muted-foreground truncate min-w-0"
                    title={userData.username}
                  >
                    {userData.username}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Username / Referral Code
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p
                    className="text-base text-muted-foreground truncate min-w-0"
                    title={userData.username}
                  >
                    {userData.username}
                  </p>
                </div>
              </div> */}

              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[13px] text-[#1A1A1A]"
                >
                  Account Type
                </label>
                <div className="bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-sm text-gray-900">
                  <p
                    className={`inline-flex items-center px-3 py-1 rounded-full font-medium capitalize ${
                      userData.user_type === "creator"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}
                  >
                    {userData.user_type}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Account Type
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${
                      userData.user_type === "creator"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    }`}
                  >
                    {userData.user_type}
                  </span>
                </div>
              </div> */}
            </div>
          </CardContent>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg px-2 pb-5">
        <CardHeader className="pb-8">
          <div className="flex items-center gap-2">
            {/* <UserCheck className="h-4 w-4" /> */}
            <CardTitle className="text-xl font-semibold">
              Referral Information
            </CardTitle>
          </div>
          <CardDescription className="text-md">
            Referral statistics and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-12">
            {/* <div className="space-y-3 min-w-0">
              <Label className="text-sm font-semibold text-foreground">
                Referred By
              </Label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                <p
                  className="text-lg font-medium text-muted-foreground truncate min-w-0"
                  title={referrer || "Not referred"}
                >
                  {referrer || "Not referred"}
                </p>
              </div>
            </div> */}

            <div className="relative w-full">
              <label
                htmlFor="floating"
                className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
              >
                Referred By
              </label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                <p
                  className="text-base text-[15px]  text-muted-foreground truncate min-w-0"
                  title={referrer || "Not referred"}
                >
                  {referrer || "Not referred"}
                </p>
              </div>
            </div>

            <div className="relative w-full">
              <label
                htmlFor="floating"
                className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
              >
                Available Coins
              </label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                <p className="text-base text-[15px]  text-muted-foreground truncate min-w-0">
                  {userData.coins.toLocaleString()}
                </p>
              </div>
            </div>
            {/* <div className="space-y-3 min-w-0">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="text-lg">🪙</span>
                Available Coins
              </Label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                  {userData.coins.toLocaleString()}
                </p>
              </div>
            </div> */}
            <div className="relative w-full">
              <label
                htmlFor="floating"
                className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
              >
                Creators Referred
              </label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                <p className="text-base text-[15px]  text-muted-foreground truncate min-w-0">
                  {userData.creators_referred}
                </p>
              </div>
            </div>
            {/* <div className="space-y-3 min-w-0">
              <Label className="text-sm font-semibold text-foreground">
                Creators Referred
              </Label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {userData.creators_referred}
                </p>
              </div>
            </div> */}

            <div className="relative w-full">
              <label
                htmlFor="floating"
                className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
              >
                Advertisers Referred
              </label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                <p className="text-base text-[15px] text-muted-foreground truncate min-w-0">
                  {userData.advertisers_referred}
                </p>
              </div>
            </div>
            {/* <div className="space-y-3 min-w-0">
              <Label className="text-sm font-semibold text-foreground">
                Advertisers Referred
              </Label>
              <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {userData.advertisers_referred}
                </p>
              </div>
            </div> */}
          </div>
        </CardContent>
      </div>

      {creatorProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Creator Profile
            </CardTitle>
            <CardDescription>Your creator statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Contests Participated
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {creatorProfile.total_contests_participated}
                  </p>
                </div>
              </div>
              <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Contests Won
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {creatorProfile.total_contests_won}
                  </p>
                </div>
              </div>
              <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Total Money Won
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(creatorProfile.total_money_won)}
                  </p>
                </div>
              </div>
              <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Withdrawable Balance
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatMoney(creatorProfile.withdrawable_balance)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {advertiserProfile && (
        <div className="bg-white rounded-2xl shadow-lg px-2 pb-5">
          <CardHeader className="pb-8">
            <CardTitle className="text-xl font-semibold">
              Advertiser Profile
            </CardTitle>
            <CardDescription className="text-md">
              Your advertiser statistics and details. Editable fields show an
              edit button on hover.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-12">
              {/* <div className="min-w-0">
                <Label
                  htmlFor="gameofcreators"
                  className="text-sm font-semibold text-foreground"
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
                  <div className="flex items-center justify-between group hover:bg-muted/30 p-3 rounded-lg transition-colors mt-1 min-w-0">
                    <p
                      className="text-base font-medium truncate flex-1 pr-2 min-w-0"
                      title={advertiserProfile.company_name || "Not set"}
                    >
                      {advertiserProfile.company_name || (
                        <span className="text-muted-foreground italic">
                          Not set
                        </span>
                      )}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEditCompanyName}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </div> */}

              <div className="min-w-0">
                {isEditingCompanyName ? (
                  <div className="flex items-center gap-2 mt-1">
                    {/* Floating Label Input */}
                    <div className="relative flex-1">
                      <input
                        id="gameofcreators"
                        value={editedCompanyName}
                        onChange={(e) => setEditedCompanyName(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Game of Creators"
                        className="peer block w-full rounded-lg border px-3 pt-5 pb-2 text-md text-[#1A1A1A]
                     focus:outline-none focus:ring-1 focus:border-purple-500"
                      />
                      <label
                        htmlFor="gameofcreators"
                        className="absolute left-3 font-medium top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
                      >
                        Company Name
                      </label>
                    </div>

                    {/* Save + Cancel */}
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
                  <div className="relative group mt-1">
                    <input
                      type="text"
                      value={advertiserProfile.company_name || "Not Set"}
                      readOnly
                      placeholder=" "
                      className="peer block w-full rounded-lg border px-3 pt-5 pb-2 text-[14px] text-[#1A1A1A]
                   focus:outline-none focus:ring-1 focus:border-purple-500
                   bg-gray-50 cursor-default"
                    />
                    <label
                      htmlFor="gameofcreators"
                      className="absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
                    >
                      Company Name
                    </label>

                    <button
                      type="button"
                      onClick={handleEditCompanyName}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                {/* <Label
                  htmlFor="websiteUrl"
                  className="text-sm font-semibold text-foreground"
                >
                  Website
                </Label> */}
                {isEditingWebsiteUrl ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        id="websiteUrl"
                        type="url"
                        value={editedWebsiteUrl}
                        onChange={(e) => setEditedWebsiteUrl(e.target.value)}
                        placeholder="https://www.gameofcreators.com/"
                        disabled={isSubmitting}
                        className="peer block w-full rounded-lg border px-3 pt-5 pb-2 text-md text-[#1A1A1A]
                     focus:outline-none focus:ring-1 focus:border-purple-500"
                      />

                      <label
                        htmlFor="websiteUrl"
                        className="absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
                      >
                        Website
                      </label>
                    </div>
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
                  <div className="relative group mt-1">
                    <input
                      type="text"
                      value={advertiserProfile.website_url || "Not Set"}
                      readOnly
                      placeholder=" "
                      className="peer block w-full rounded-lg border px-3 pt-5 pb-2 text-[14px] text-[#1A1A1A]
                   focus:outline-none focus:ring-1 focus:border-purple-500
                   bg-gray-50 cursor-default"
                    />
                    <label
                      htmlFor="gameofcreators"
                      className="absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]"
                    >
                      Website
                    </label>

                    <button
                      type="button"
                      onClick={handleEditWebsiteUrl}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  // <div className="relative group mt-1">
                  //   {advertiserProfile.website_url ? (
                  //     <a
                  //       href={advertiserProfile.website_url}
                  //       target="_blank"
                  //       rel="noopener noreferrer"
                  //       className="text-primary hover:underline text-base font-medium truncate flex-1 pr-2 min-w-0"
                  //       title={advertiserProfile.website_url}
                  //     >
                  //       {advertiserProfile.website_url}
                  //     </a>
                  //   ) : (
                  //     <span className="text-muted-foreground italic text-base font-medium truncate flex-1 pr-2 min-w-0">
                  //       Not set
                  //     </span>
                  //   )}
                  //   <Button
                  //     variant="ghost"
                  //     size="sm"
                  //     onClick={handleEditWebsiteUrl}
                  //     className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  //   >
                  //     <Pencil className="h-4 w-4 mr-1" />
                  //     Edit
                  //   </Button>
                  // </div>
                )}
              </div>

              <div className="relative w-full">
                <label className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]">
                  Subscription Plan
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      advertiserProfile?.subscription_info?.product_id
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    {advertiserProfile?.subscription_info?.product_id
                      ? subscriptionPlans.find(
                          (plan) =>
                            plan.id ===
                            advertiserProfile.subscription_info!.product_id
                        )?.displayName ?? "Unknown Plan"
                      : "N/A"}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Subscription Plan
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      advertiserProfile?.subscription_info?.product_id
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    {advertiserProfile?.subscription_info?.product_id
                      ? subscriptionPlans.find(
                          (plan) =>
                            plan.id ===
                            advertiserProfile.subscription_info!.product_id
                        )?.displayName ?? "Unknown Plan"
                      : "N/A"}
                  </span>
                </div>
              </div> */}
              <div className="relative w-full">
                <label className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]">
                  Contests Run
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p className="text-base text-[15px] text-muted-foreground truncate min-w-0">
                    {advertiserProfile.total_contests_run}
                  </p>
                </div>
              </div>

              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Contests Run
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {advertiserProfile.total_contests_run}
                  </p>
                </div>
              </div> */}

              <div className="relative w-full">
                <label className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]">
                  Total Money Spent
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p className="text-base text-[15px] text-muted-foreground truncate min-w-0">
                    {formatMoney(advertiserProfile.total_money_spent)}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Total Money Spent
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {formatMoney(advertiserProfile.total_money_spent)}
                  </p>
                </div>
              </div> */}

              <div className="relative w-full">
                <label className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]">
                  Withdrawable Balance
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p className="text-base text-[15px] text-muted-foreground truncate min-w-0">
                    {formatMoney(advertiserProfile.withdrawable_balance)}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Withdrawable Balance
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatMoney(advertiserProfile.withdrawable_balance)}
                  </p>
                </div>
              </div> */}

              <div className="relative w-full">
                <label className="absolute font-medium left-2.5 top-0 -translate-y-1/2 bg-white px-1 text-[14px] text-[#1A1A1A]">
                Available Deposit Balance
                </label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0 peer block w-full rounded-lg border border-gray-300 px-3 pt-5 pb-2 text-gray-900">
                  <p className="text-base text-[15px] text-muted-foreground truncate min-w-0">
                  {formatMoney(advertiserProfile.available_deposit_balance)}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Available Deposit Balance
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {formatMoney(advertiserProfile.available_deposit_balance)}
                  </p>
                </div>
              </div> */}
            </div>
          </CardContent>
        </div>
      )}
    </div>
  );
}
