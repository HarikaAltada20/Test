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
  Copy,
  Search,
  RotateCcw,
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
import {
  CONTENT_TYPE_CATEGORIES,
  INTEREST_CATEGORIES,
  INTERESTS,
} from "@/constants/contentCategories";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";
import { EmailChangeModal } from "@/components/EmailChangeModal";
// import PhoneInput from "react-phone-number-input";
// import "react-phone-number-input/style.css";
import { Country, State, City } from "country-state-city";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ISO6391 from "iso-639-1";

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
  phone_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address?: string | null;
  languages?: string[] | null;
  categories?:
    | Array<{ category: string; subcategory: string }>
    | string[]
    | null;
  subcategories?:
    | Record<string, string[]>
    | Array<{ category: string; subcategory: string }>
    | string[]
    | null;
  interests?: string[] | null;
  has_claimed_profile_reward?: boolean;
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

interface EmailChangeLog {
  id: string;
  old_email: string | null;
  new_email: string | null;
  created_at: string;
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
  const [companyProfileLoading, setCompanyProfileLoading] = useState(false);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [hasReceivedProfileBonus, setHasReceivedProfileBonus] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  // Function to notify other components about profile updates
  const notifyProfileUpdate = () => {
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [editedFullName, setEditedFullName] = useState("");
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCompleteProfileModalOpen, setIsCompleteProfileModalOpen] =
    useState(false);
  const [isEditingCompanyName, setIsEditingCompanyName] = useState(false);
  const [editedCompanyName, setEditedCompanyName] = useState("");
  const [isEditingWebsiteUrl, setIsEditingWebsiteUrl] = useState(false);
  const [editedWebsiteUrl, setEditedWebsiteUrl] = useState("");

  // New profile fields state - directly editable
  // const [editedPhone, setEditedPhone] = useState("");
  const [editedDateOfBirth, setEditedDateOfBirth] = useState("");
  const [editedGender, setEditedGender] = useState("");
  const [editedCountry, setEditedCountry] = useState("");
  const [editedState, setEditedState] = useState("");
  const [editedCity, setEditedCity] = useState("");
  const [editedAddress, setEditedAddress] = useState("");
  const [editedLanguages, setEditedLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState("");
  // Type of content I create: stores category IDs (max 3)
  const [editedContentTypesCreated, setEditedContentTypesCreated] = useState<
    string[]
  >([]);
  // Other type of content: stores {category, subcategory} pairs for selected categories
  const [editedInterestedContentTypes, setEditedInterestedContentTypes] =
    useState<Array<{ category: string; subcategory: string }>>([]);
  // Interests: stores array of interest strings
  const [editedInterests, setEditedInterests] = useState<string[]>([]);

  // Country, state, city codes for cascading dropdowns
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("");
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");

  // Search terms for dropdowns
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [stateSearch, setStateSearch] = useState<string>("");
  const [citySearch, setCitySearch] = useState<string>("");

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [emailChangeLogs, setEmailChangeLogs] = useState<EmailChangeLog[]>([]);

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

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true);
      setUserData(null);
      setAvatarPreview(null);
      setHasNetworkError(false);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        // Handle authentication errors
        if (authError) {
          console.error("Auth error fetching user:", authError);

          // Check if it's a network/fetch error
          if (
            authError.name === "AuthRetryableFetchError" ||
            authError.message?.includes("Failed to fetch") ||
            authError.message?.includes("fetch")
          ) {
            setHasNetworkError(true);
            toast({
              variant: "destructive",
              title: "Connection Error",
              description:
                "Unable to connect to the server. Please check your internet connection and try again.",
            });
            setIsLoading(false);
            return;
          }

          // For other auth errors, show appropriate message
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: authError.message || "Please sign in again.",
          });
          setIsLoading(false);
          return;
        }

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

          // Check if it's a network/fetch error
          if (
            userError.message?.includes("Failed to fetch") ||
            userError.message?.includes("fetch") ||
            userError.message?.includes("network")
          ) {
            setHasNetworkError(true);
            toast({
              variant: "destructive",
              title: "Connection Error",
              description:
                "Unable to fetch your profile data. Please check your internet connection and try again.",
            });
            setIsLoading(false);
            return;
          }

          // Don't return here for other errors, continue with what we have
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

        // Load recent email change logs for this user (best-effort)
        try {
          const { data: logs, error: logsError } = await supabase
            .from("email_change_logs")
            .select("id, old_email, new_email, created_at")
            .eq("user_id", userData.id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (!logsError && logs) {
            setEmailChangeLogs(logs as EmailChangeLog[]);
          }
        } catch (logsErr) {
          console.warn("Error fetching email change logs:", logsErr);
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
              // Initialize the new profile fields
              // setEditedPhone(profile.phone_number || "");
              setEditedDateOfBirth(profile.date_of_birth || "");
              setEditedGender(profile.gender || "");
              setEditedCountry(profile.country || "");
              setEditedState(profile.state || "");
              setEditedCity(profile.city || "");
              setEditedAddress(profile.address || "");
              setEditedLanguages(profile.languages || []);
              // Handle JSONB fields
              // categories: stores category IDs (string[])
              // subcategories: stores {category, subcategory} pairs
              const typeOfContent = profile.categories as
                | Array<{ category: string; subcategory: string }>
                | string[]
                | null;
              const otherTypeOfContent = profile.subcategories as
                | Array<{ category: string; subcategory: string }>
                | string[]
                | null;

              // Convert categories to category IDs
              const convertToCategoryIds = (data: any): string[] => {
                if (!data || !Array.isArray(data)) return [];
                // If it's already string array (category IDs), return as is
                if (data.length > 0 && typeof data[0] === "string") {
                  // Check if they're category IDs or old format strings
                  const categoryIds: string[] = [];
                  (data as string[]).forEach((value) => {
                    // Check if it's a valid category ID
                    const isCategoryId = CONTENT_TYPE_CATEGORIES.some(
                      (cat) => cat.id === value
                    );
                    if (isCategoryId) {
                      categoryIds.push(value);
                    } else {
                      // Old format - try to find matching category
                      const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
                        cat.subcategories.some(
                          (sub) =>
                            sub.toLowerCase().includes(value.toLowerCase()) ||
                            value.toLowerCase().includes(cat.id.toLowerCase())
                        )
                      );
                      if (category && !categoryIds.includes(category.id)) {
                        categoryIds.push(category.id);
                      }
                    }
                  });
                  return categoryIds;
                }
                // If it's objects with category+subcategory, extract unique category IDs
                if (
                  data.length > 0 &&
                  typeof data[0] === "object" &&
                  "category" in data[0]
                ) {
                  const categoryIds = new Set<string>();
                  (
                    data as Array<{ category: string; subcategory?: string }>
                  ).forEach((item) => {
                    categoryIds.add(item.category);
                  });
                  return Array.from(categoryIds);
                }
                return [];
              };

              // Convert subcategories to {category, subcategory} format for internal use
              const convertToSubcategoryFormat = (
                data: any
              ): Array<{ category: string; subcategory: string }> => {
                if (!data) return [];

                // New object format: {category: [subcategories]}
                if (typeof data === "object" && !Array.isArray(data)) {
                  const result: Array<{
                    category: string;
                    subcategory: string;
                  }> = [];
                  Object.entries(data).forEach(([category, subcategories]) => {
                    if (Array.isArray(subcategories)) {
                      (subcategories as string[]).forEach((subcategory) => {
                        result.push({ category, subcategory });
                      });
                    }
                  });
                  return result;
                }

                // Old array format with objects
                if (Array.isArray(data) && data.length > 0) {
                  // Check if already in {category, subcategory} format
                  if (
                    typeof data[0] === "object" &&
                    "category" in data[0] &&
                    "subcategory" in data[0]
                  ) {
                    return data as Array<{
                      category: string;
                      subcategory: string;
                    }>;
                  }
                  // Old format - convert string array to objects
                  const result: Array<{
                    category: string;
                    subcategory: string;
                  }> = [];
                  (data as string[]).forEach((oldValue) => {
                    const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
                      cat.subcategories.some(
                        (sub) =>
                          sub.toLowerCase().includes(oldValue.toLowerCase()) ||
                          oldValue.toLowerCase().includes(cat.id.toLowerCase())
                      )
                    );
                    if (category) {
                      const subcategory =
                        category.subcategories.find((sub) =>
                          sub.toLowerCase().includes(oldValue.toLowerCase())
                        ) || category.subcategories[0];
                      result.push({
                        category: category.id,
                        subcategory: subcategory,
                      });
                    }
                  });
                  return result;
                }
                return [];
              };

              setEditedContentTypesCreated(convertToCategoryIds(typeOfContent));
              setEditedInterestedContentTypes(
                convertToSubcategoryFormat(otherTypeOfContent)
              );
              setEditedInterests((profile.interests as string[]) || []);

              // Find country code from country name
              if (profile.country) {
                const country = Country.getAllCountries().find(
                  (c) => c.name === profile.country
                );
                if (country) {
                  setSelectedCountryCode(country.isoCode);
                  // Find state code from state name
                  if (profile.state) {
                    const state = State.getStatesOfCountry(
                      country.isoCode
                    ).find((s) => s.name === profile.state);
                    if (state) {
                      setSelectedStateCode(state.isoCode);
                    }
                  }
                }
              }

              // Check if user has already claimed profile update bonus
              if (profile.has_claimed_profile_reward) {
                setHasReceivedProfileBonus(true);
              }
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
      } catch (error: any) {
        console.error("Unexpected error in fetchUserData:", error);

        // Check if it's a network/fetch error
        if (
          error?.name === "AuthRetryableFetchError" ||
          error?.message?.includes("Failed to fetch") ||
          error?.message?.includes("fetch") ||
          error?.message?.includes("network")
        ) {
          setHasNetworkError(true);
          toast({
            variant: "destructive",
            title: "Connection Error",
            description:
              "Unable to connect to the server. Please check your internet connection and try again.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Error Loading Profile",
            description:
              error?.message ||
              "An unexpected error occurred. Please try refreshing the page.",
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [supabase, toast]);

  // Retry function for network errors
  const handleRetry = () => {
    setHasNetworkError(false);
    // Trigger a re-fetch by reloading the page
    window.location.reload();
  };

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

  const handleEditEmail = async () => {
    try {
      // Check if user has changed email in the last month
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to verify email change eligibility",
        });
        return;
      }

      // Check last email change date from user metadata
      const lastEmailChangeAt = authUser.user_metadata?.last_email_change_at;
      if (lastEmailChangeAt) {
        const lastChangeDate = new Date(lastEmailChangeAt);
        const now = new Date();

        // Check if the last change was in the same calendar month and year
        const lastMonth = lastChangeDate.getMonth();
        const lastYear = lastChangeDate.getFullYear();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // If same month and year, user cannot change email yet
        if (lastMonth === currentMonth && lastYear === currentYear) {
          // Calculate days until next month
          const nextMonth = new Date(currentYear, currentMonth + 1, 1);
          const daysUntilNextMonth = Math.ceil(
            (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          const nextMonthName = nextMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          });

          toast({
            variant: "destructive",
            title: "Email Change Limit",
            description: `You can only change your email once per month.`,
          });
          return;
        }
      }

      // If eligible, open the modal
      setIsEmailModalOpen(true);
    } catch (error: any) {
      console.error("Error checking email change eligibility:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          "Failed to verify email change eligibility. Please try again.",
      });
    }
  };

  const handleEmailUpdated = () => {
    // Refresh user data after email update
    notifyProfileUpdate();
    // The EmailOtpVerificationForm already handles the page reload
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

  const updateCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyProfileLoading(true);

    try {
      const companyName = (e.target as any).company_name.value;
      const websiteUrl = (e.target as any).website_url.value;
      const currentUserId = userData?.id;

      if (!currentUserId) {
        throw new Error("User ID is not available for update.");
      }

      const { data, error } = await supabase
        .from("advertiser_profiles")
        .update({
          company_name: companyName,
          website_url: websiteUrl,
        })
        .eq("id", currentUserId)
        .select();

      if (error) throw error;

      // Update local state
      setAdvertiserProfile((prev) =>
        prev
          ? {
              ...prev,
              company_name: companyName,
              website_url: websiteUrl,
            }
          : null
      );
      setEditedCompanyName(companyName);
      setEditedWebsiteUrl(websiteUrl);

      toast({
        title: "Success",
        description: "Company profile updated successfully",
        variant: "default",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update company profile",
        variant: "destructive",
      });
    } finally {
      setCompanyProfileLoading(false);
    }
  };

  const handleCopyUsername = async () => {
    if (!userData?.username) return;
    try {
      await navigator.clipboard.writeText(userData.username);
      toast({
        title: "Copied!",
        description: "Username/referral code copied to clipboard.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Failed to copy to clipboard. Please try again.",
      });
    }
  };

  // Get all languages from ISO6391
  const allLanguages = ISO6391.getAllNames().sort();

  // Helper functions for languages
  const handleAddLanguage = (languageName?: string) => {
    const languageToAdd = languageName || languageInput.trim();
    if (
      languageToAdd &&
      !editedLanguages.includes(languageToAdd) &&
      editedLanguages.length < 5
    ) {
      setEditedLanguages([...editedLanguages, languageToAdd]);
      setLanguageInput("");
    }
  };

  const handleRemoveLanguage = (language: string) => {
    setEditedLanguages(editedLanguages.filter((lang) => lang !== language));
  };

  // Helper to normalize subcategory arrays for comparison
  const normalizeSubcategories = (
    arr: Array<{ category: string; subcategory: string }>
  ) => {
    return arr
      .map((item) => `${item.category}:${item.subcategory}`)
      .sort()
      .join(",");
  };

  // Check if all required profile fields are filled
  const isProfileComplete = () => {
    if (!creatorProfile) return false;

    // Check basic required fields
    const hasBasicFields =
      editedDateOfBirth.trim() !== "" &&
      editedGender.trim() !== "" &&
      editedAddress.trim() !== "" &&
      editedLanguages.length > 0 &&
      editedContentTypesCreated.length > 0 &&
      editedInterestedContentTypes.length > 0 &&
      editedInterests.length > 0;

    if (!hasBasicFields) return false;

    // Check country is selected
    if (!editedCountry.trim() || !selectedCountryCode) return false;

    // Check state and city based on availability
    const states = State.getStatesOfCountry(selectedCountryCode);
    const hasStates = states.length > 0;

    if (hasStates) {
      // States exist, state must be filled
      if (!editedState.trim() || !selectedStateCode) return false;

      // Check if cities are available for the selected state
      const cities = City.getCitiesOfState(
        selectedCountryCode,
        selectedStateCode
      );
      const hasCities = !!(cities && cities.length > 0);

      // Only require city if cities are available for this state
      if (hasCities && !editedCity.trim()) return false;
      // If no cities available for the state, don't require city field
    } else {
      // No states, check if country has cities
      const cities = City.getCitiesOfCountry(selectedCountryCode);
      const hasCities = !!(cities && cities.length > 0);

      if (hasCities) {
        // Cities exist at country level, city must be filled
        if (!editedCity.trim()) return false;
      }
      // If no states and no cities, we don't require state/city fields
    }

    return true;
  };

  // Check if profile has changes
  const hasProfileChanges = () => {
    if (!creatorProfile) return false;

    const currentTypeOfContent = creatorProfile.categories as
      | Array<{ category: string; subcategory: string }>
      | string[]
      | null;
    const currentOtherTypeOfContent = creatorProfile.subcategories as
      | Array<{ category: string; subcategory: string }>
      | string[]
      | null;

    // Convert current categories to category IDs for comparison
    const convertToCategoryIds = (data: any): string => {
      if (!data || !Array.isArray(data)) return "";
      // If it's already string array (category IDs), return sorted
      if (data.length > 0 && typeof data[0] === "string") {
        const categoryIds: string[] = [];
        (data as string[]).forEach((value) => {
          const isCategoryId = CONTENT_TYPE_CATEGORIES.some(
            (cat) => cat.id === value
          );
          if (isCategoryId) {
            categoryIds.push(value);
          } else {
            // Old format - find matching category
            const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
              cat.subcategories.some(
                (sub) =>
                  sub.toLowerCase().includes(value.toLowerCase()) ||
                  value.toLowerCase().includes(cat.id.toLowerCase())
              )
            );
            if (category && !categoryIds.includes(category.id)) {
              categoryIds.push(category.id);
            }
          }
        });
        return categoryIds.sort().join(",");
      }
      // If it's objects, extract unique category IDs
      if (
        data.length > 0 &&
        typeof data[0] === "object" &&
        "category" in data[0]
      ) {
        const categoryIds = new Set<string>();
        (data as Array<{ category: string; subcategory?: string }>).forEach(
          (item) => {
            categoryIds.add(item.category);
          }
        );
        return Array.from(categoryIds).sort().join(",");
      }
      return "";
    };

    // Convert current subcategories to normalized format
    const convertSubcategories = (data: any): string => {
      if (!data) return "";

      // New object format: {category: [subcategories]}
      if (typeof data === "object" && !Array.isArray(data)) {
        const converted: Array<{ category: string; subcategory: string }> = [];
        Object.entries(data).forEach(([category, subcategories]) => {
          if (Array.isArray(subcategories)) {
            (subcategories as string[]).forEach((subcategory) => {
              converted.push({ category, subcategory });
            });
          }
        });
        return normalizeSubcategories(converted);
      }

      // Old array format
      if (Array.isArray(data) && data.length > 0) {
        // Check if already in {category, subcategory} format
        if (
          typeof data[0] === "object" &&
          "category" in data[0] &&
          "subcategory" in data[0]
        ) {
          return normalizeSubcategories(
            data as Array<{ category: string; subcategory: string }>
          );
        }
        // Old string array format - convert
        const converted: Array<{ category: string; subcategory: string }> = [];
        (data as string[]).forEach((oldValue) => {
          const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
            cat.subcategories.some(
              (sub) =>
                sub.toLowerCase().includes(oldValue.toLowerCase()) ||
                oldValue.toLowerCase().includes(cat.id.toLowerCase())
            )
          );
          if (category) {
            const subcategory =
              category.subcategories.find((sub) =>
                sub.toLowerCase().includes(oldValue.toLowerCase())
              ) || category.subcategories[0];
            converted.push({ category: category.id, subcategory: subcategory });
          }
        });
        return normalizeSubcategories(converted);
      }
      return "";
    };

    return (
      // editedPhone !== (creatorProfile.phone_number || "") ||
      editedDateOfBirth !== (creatorProfile.date_of_birth || "") ||
      editedGender !== (creatorProfile.gender || "") ||
      editedCountry !== (creatorProfile.country || "") ||
      editedState !== (creatorProfile.state || "") ||
      editedCity !== (creatorProfile.city || "") ||
      editedAddress !== (creatorProfile.address || "") ||
      JSON.stringify(editedLanguages.sort()) !==
        JSON.stringify((creatorProfile.languages || []).sort()) ||
      JSON.stringify(editedContentTypesCreated.sort()) !==
        convertToCategoryIds(currentTypeOfContent) ||
      normalizeSubcategories(editedInterestedContentTypes) !==
        convertSubcategories(currentOtherTypeOfContent) ||
      JSON.stringify(editedInterests.sort()) !==
        JSON.stringify((creatorProfile.interests || []).sort())
    );
  };

  // Check if changes are only to interests, categories, or subcategories
  const hasOnlyEditableFieldChanges = () => {
    if (!creatorProfile) return false;

    const currentTypeOfContent = creatorProfile.categories as
      | Array<{ category: string; subcategory: string }>
      | string[]
      | null;
    const currentOtherTypeOfContent = creatorProfile.subcategories as
      | Array<{ category: string; subcategory: string }>
      | string[]
      | null;

    // Convert current categories to category IDs for comparison
    const convertToCategoryIds = (data: any): string => {
      if (!data || !Array.isArray(data)) return "";
      if (data.length > 0 && typeof data[0] === "string") {
        const categoryIds: string[] = [];
        (data as string[]).forEach((value) => {
          const isCategoryId = CONTENT_TYPE_CATEGORIES.some(
            (cat) => cat.id === value
          );
          if (isCategoryId) {
            categoryIds.push(value);
          } else {
            const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
              cat.subcategories.some(
                (sub) =>
                  sub.toLowerCase().includes(value.toLowerCase()) ||
                  value.toLowerCase().includes(cat.id.toLowerCase())
              )
            );
            if (category && !categoryIds.includes(category.id)) {
              categoryIds.push(category.id);
            }
          }
        });
        return categoryIds.sort().join(",");
      }
      if (
        data.length > 0 &&
        typeof data[0] === "object" &&
        "category" in data[0]
      ) {
        const categoryIds = new Set<string>();
        (data as Array<{ category: string; subcategory?: string }>).forEach(
          (item) => {
            categoryIds.add(item.category);
          }
        );
        return Array.from(categoryIds).sort().join(",");
      }
      return "";
    };

    // Convert current subcategories to normalized format
    const convertSubcategories = (data: any): string => {
      if (!data) return "";

      // New object format: {category: [subcategories]}
      if (typeof data === "object" && !Array.isArray(data)) {
        const converted: Array<{ category: string; subcategory: string }> = [];
        Object.entries(data).forEach(([category, subcategories]) => {
          if (Array.isArray(subcategories)) {
            (subcategories as string[]).forEach((subcategory) => {
              converted.push({ category, subcategory });
            });
          }
        });
        return normalizeSubcategories(converted);
      }

      // Old array format
      if (Array.isArray(data) && data.length > 0) {
        // Check if already in {category, subcategory} format
        if (
          typeof data[0] === "object" &&
          "category" in data[0] &&
          "subcategory" in data[0]
        ) {
          return normalizeSubcategories(
            data as Array<{ category: string; subcategory: string }>
          );
        }
        // Old string array format - convert
        const converted: Array<{ category: string; subcategory: string }> = [];
        (data as string[]).forEach((oldValue) => {
          const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
            cat.subcategories.some(
              (sub) =>
                sub.toLowerCase().includes(oldValue.toLowerCase()) ||
                oldValue.toLowerCase().includes(cat.id.toLowerCase())
            )
          );
          if (category) {
            const subcategory =
              category.subcategories.find((sub) =>
                sub.toLowerCase().includes(oldValue.toLowerCase())
              ) || category.subcategories[0];
            converted.push({
              category: category.id,
              subcategory: subcategory,
            });
          }
        });
        return normalizeSubcategories(converted);
      }
      return "";
    };

    const hasCategoryChange =
      JSON.stringify(editedContentTypesCreated.sort()) !==
      convertToCategoryIds(currentTypeOfContent);
    const hasSubcategoryChange =
      normalizeSubcategories(editedInterestedContentTypes) !==
      convertSubcategories(currentOtherTypeOfContent);
    const hasInterestChange =
      JSON.stringify(editedInterests.sort()) !==
      JSON.stringify((creatorProfile.interests || []).sort());

    const hasOtherChanges =
      // editedPhone !== (creatorProfile.phone_number || "") ||
      editedDateOfBirth !== (creatorProfile.date_of_birth || "") ||
      editedGender !== (creatorProfile.gender || "") ||
      editedCountry !== (creatorProfile.country || "") ||
      editedState !== (creatorProfile.state || "") ||
      editedCity !== (creatorProfile.city || "") ||
      editedAddress !== (creatorProfile.address || "") ||
      JSON.stringify(editedLanguages.sort()) !==
        JSON.stringify((creatorProfile.languages || []).sort());

    // Return true if only interests, categories, or subcategories have changed
    return (
      (hasCategoryChange || hasSubcategoryChange || hasInterestChange) &&
      !hasOtherChanges
    );
  };

  // Save profile changes without claiming bonus
  const handleSaveProfileChanges = async (claimBonus: boolean = false) => {
    if (!userData || !creatorProfile || !hasProfileChanges()) {
      return;
    }

    // Check if user has already received the bonus
    // If so, only allow editing interests, categories, and subcategories
    if (hasReceivedProfileBonus) {
      // Check if changes are only to editable fields (interests, categories, subcategories)
      if (!hasOnlyEditableFieldChanges()) {
        toast({
          variant: "destructive",
          title: "Editing Disabled",
          description:
            "You have already received the profile update bonus. You can only edit interests, categories, and subcategories.",
        });
        return;
      }
      // If only editable fields changed, allow saving but don't claim bonus
      claimBonus = false;
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {};

      // Use edited phone number
      // const phoneToSave = editedPhone;
      // if (phoneToSave !== (creatorProfile.phone_number || "")) {
      //   updateData.phone_number = phoneToSave.trim() || null;
      // }
      if (editedDateOfBirth !== (creatorProfile.date_of_birth || "")) {
        // Validate date of birth: cannot be in future or of same year
        if (editedDateOfBirth.trim()) {
          const selectedDate = new Date(editedDateOfBirth.trim());
          selectedDate.setHours(0, 0, 0, 0); // Normalize to midnight
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Normalize to midnight
          const currentYear = today.getFullYear();
          const selectedYear = selectedDate.getFullYear();

          // Check if date is in the future
          if (selectedDate > today) {
            toast({
              variant: "destructive",
              title: "Invalid Date",
              description: "Date of birth cannot be in the future.",
            });
            setIsSubmitting(false);
            return;
          }

          // Check if date is in the current year
          if (selectedYear === currentYear) {
            toast({
              variant: "destructive",
              title: "Invalid Date",
              description: "Date of birth cannot be in the current year.",
            });
            setIsSubmitting(false);
            return;
          }
        }
        updateData.date_of_birth = editedDateOfBirth.trim() || null;
      }
      if (editedGender !== (creatorProfile.gender || "")) {
        updateData.gender = editedGender.trim() || null;
      }
      if (editedCountry !== (creatorProfile.country || "")) {
        updateData.country = editedCountry.trim() || null;
      }
      if (editedState !== (creatorProfile.state || "")) {
        updateData.state = editedState.trim() || null;
      }
      if (editedCity !== (creatorProfile.city || "")) {
        updateData.city = editedCity.trim() || null;
      }
      if (editedAddress !== (creatorProfile.address || "")) {
        updateData.address = editedAddress.trim() || null;
      }
      if (
        JSON.stringify(editedLanguages.sort()) !==
        JSON.stringify((creatorProfile.languages || []).sort())
      ) {
        updateData.languages =
          editedLanguages.length > 0 ? editedLanguages : null;
      }
      // Compare content types
      const currentTypeOfContent = creatorProfile.categories as
        | Array<{ category: string; subcategory: string }>
        | string[]
        | null;
      const currentOtherTypeOfContent = creatorProfile.subcategories as
        | Array<{ category: string; subcategory: string }>
        | string[]
        | null;

      // Convert current categories to category IDs for comparison
      const convertToCategoryIds = (data: any): string => {
        if (!data || !Array.isArray(data)) return "";
        if (data.length > 0 && typeof data[0] === "string") {
          const categoryIds: string[] = [];
          (data as string[]).forEach((value) => {
            const isCategoryId = CONTENT_TYPE_CATEGORIES.some(
              (cat) => cat.id === value
            );
            if (isCategoryId) {
              categoryIds.push(value);
            } else {
              const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
                cat.subcategories.some(
                  (sub) =>
                    sub.toLowerCase().includes(value.toLowerCase()) ||
                    value.toLowerCase().includes(cat.id.toLowerCase())
                )
              );
              if (category && !categoryIds.includes(category.id)) {
                categoryIds.push(category.id);
              }
            }
          });
          return categoryIds.sort().join(",");
        }
        if (
          data.length > 0 &&
          typeof data[0] === "object" &&
          "category" in data[0]
        ) {
          const categoryIds = new Set<string>();
          (data as Array<{ category: string; subcategory?: string }>).forEach(
            (item) => {
              categoryIds.add(item.category);
            }
          );
          return Array.from(categoryIds).sort().join(",");
        }
        return "";
      };

      // Convert current subcategories to normalized format
      const convertSubcategories = (data: any): string => {
        if (!data) return "";

        // New object format: {category: [subcategories]}
        if (typeof data === "object" && !Array.isArray(data)) {
          const converted: Array<{ category: string; subcategory: string }> =
            [];
          Object.entries(data).forEach(([category, subcategories]) => {
            if (Array.isArray(subcategories)) {
              (subcategories as string[]).forEach((subcategory) => {
                converted.push({ category, subcategory });
              });
            }
          });
          return normalizeSubcategories(converted);
        }

        // Old array format
        if (Array.isArray(data) && data.length > 0) {
          // Check if already in {category, subcategory} format
          if (
            typeof data[0] === "object" &&
            "category" in data[0] &&
            "subcategory" in data[0]
          ) {
            return normalizeSubcategories(
              data as Array<{ category: string; subcategory: string }>
            );
          }
          // Old string array format - convert
          const converted: Array<{ category: string; subcategory: string }> =
            [];
          (data as string[]).forEach((oldValue) => {
            const category = CONTENT_TYPE_CATEGORIES.find((cat) =>
              cat.subcategories.some(
                (sub) =>
                  sub.toLowerCase().includes(oldValue.toLowerCase()) ||
                  oldValue.toLowerCase().includes(cat.id.toLowerCase())
              )
            );
            if (category) {
              const subcategory =
                category.subcategories.find((sub) =>
                  sub.toLowerCase().includes(oldValue.toLowerCase())
                ) || category.subcategories[0];
              converted.push({
                category: category.id,
                subcategory: subcategory,
              });
            }
          });
          return normalizeSubcategories(converted);
        }
        return "";
      };

      if (
        JSON.stringify(editedContentTypesCreated.sort()) !==
        convertToCategoryIds(currentTypeOfContent)
      ) {
        updateData.categories =
          editedContentTypesCreated.length > 0
            ? editedContentTypesCreated
            : null;
      }
      if (
        normalizeSubcategories(editedInterestedContentTypes) !==
        convertSubcategories(currentOtherTypeOfContent)
      ) {
        // Convert array format to object format: {category: [subcategories]}
        const subcategoriesObject: Record<string, string[]> = {};
        editedInterestedContentTypes.forEach(({ category, subcategory }) => {
          if (!subcategoriesObject[category]) {
            subcategoriesObject[category] = [];
          }
          if (!subcategoriesObject[category].includes(subcategory)) {
            subcategoriesObject[category].push(subcategory);
          }
        });
        updateData.subcategories =
          Object.keys(subcategoriesObject).length > 0
            ? subcategoriesObject
            : null;
      }
      if (
        JSON.stringify(editedInterests.sort()) !==
        JSON.stringify((creatorProfile.interests || []).sort())
      ) {
        updateData.interests =
          editedInterests.length > 0 ? editedInterests : null;
      }

      if (Object.keys(updateData).length === 0) {
        setIsSubmitting(false);
        return;
      }

      // Check if user has already claimed the bonus before giving it
      // Only prevent claiming bonus again, but allow saving if only editable fields changed
      if (creatorProfile.has_claimed_profile_reward && claimBonus) {
        // Should not reach here due to early return check, but just in case
        setIsSubmitting(false);
        return;
      }

      // Update the profile first
      const { error } = await supabase
        .from("creator_profiles")
        .update(updateData)
        .eq("id", userData.id);

      if (error) throw error;

      // Only claim bonus if requested and not already claimed
      if (claimBonus && !creatorProfile.has_claimed_profile_reward) {
        // Claim the bonus via API route
        const bonusResponse = await fetch("/api/profile/claim-bonus", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const bonusData = await bonusResponse.json();

        if (bonusResponse.ok && bonusData.success) {
          setHasReceivedProfileBonus(true);
          toast({
            title: "Profile Completed & Bonus Received!",
            description:
              "Your profile has been completed and you've received a $0.50 bonus! You can still edit your interests, categories, and subcategories.",
          });

          // Update local state with bonus claimed
          setCreatorProfile((prev) =>
            prev
              ? { ...prev, ...updateData, has_claimed_profile_reward: true }
              : null
          );
        } else {
          console.error("Failed to credit bonus:", bonusData.error);
          toast({
            title: "Profile Updated",
            description:
              "Your profile has been updated, but there was an issue crediting the bonus.",
          });

          // Update local state without bonus claimed
          setCreatorProfile((prev) =>
            prev ? { ...prev, ...updateData } : null
          );
        }
      } else {
        // Just update without claiming bonus
        const isComplete = isProfileComplete();
        if (hasReceivedProfileBonus) {
          // User has already claimed bonus, just updating interests/categories/subcategories
          toast({
            title: "Profile Updated",
            description:
              "Your interests, categories, and subcategories have been updated successfully.",
          });
        } else {
          toast({
            title: "Profile Updated",
            description: isComplete
              ? "Your profile has been updated successfully. Complete your profile to claim the $0.50 bonus!"
              : "Your profile has been updated successfully. Fill all details to get the $0.50 bonus reward!",
          });
        }

        // Update local state
        setCreatorProfile((prev) => (prev ? { ...prev, ...updateData } : null));
      }

      notifyProfileUpdate();
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

  // Handle save button click - check if profile is complete and show modal
  const handleSaveClick = () => {
    if (!hasProfileChanges()) {
      return;
    }

    // Check if all required profile fields are filled
    // Required fields: date of birth, gender, flat number (address), language,
    // categories, subcategories (interests)
    const isComplete = isProfileComplete();

    // If profile is not complete, just save without showing modal
    if (!isComplete) {
      handleSaveProfileChanges(false);
      return;
    }

    // If all required fields are filled and bonus hasn't been received, show modal
    // Show modal regardless of whether states/cities are available for the country
    if (isComplete && !hasReceivedProfileBonus) {
      // Show confirmation modal
      setIsCompleteProfileModalOpen(true);
    } else {
      // Save without claiming bonus (toast message will be shown in handleSaveProfileChanges)
      handleSaveProfileChanges(false);
    }
  };

  // Handle confirmed save with bonus claim
  const handleConfirmCompleteProfile = async () => {
    setIsCompleteProfileModalOpen(false);
    await handleSaveProfileChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[76vh]">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (hasNetworkError || !userData) {
    return (
      <div className="flex flex-col items-center justify-center h-[76vh] space-y-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold">Connection Error</h2>
          <p className="text-muted-foreground max-w-md">
            {hasNetworkError
              ? "Unable to connect to the server. Please check your internet connection and try again."
              : "User data not available. Please try again."}
          </p>
          <Button onClick={handleRetry} variant="default">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isDark = mode === "dark";

  return (
    <div className="space-y-10 bg-background text-foreground transition-colors duration-300">
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold">Profile</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Manage your Profile Information
        </p>
      </div>
      <div>
        <div
          className={cn(
            "rounded-t-2xl border-b px-6 py-4 shadow-lg",
            isDark ? "bg-[#180438]" : "bg-white "
          )}
        >
          <CardTitle
            className={cn("text-xl", isDark ? "text-white" : "text-[#7F39EC]")}
          >
            Your Details
          </CardTitle>
        </div>
        <div
          className={cn(
            "rounded-b-2xl shadow-lg px-2 pb-4",
            isDark ? "bg-[#180438]" : "bg-white "
          )}
        >
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
                          className={`peer px-2.5 pb-2.5 pt-4 w-full text-[14px] rounded-lg 
                   focus:outline-none focus:ring-1 transition-colors duration-300
                   ${
                     isDark
                       ? "bg-[#180438] text-white border border-gray-300"
                       : "bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                   }
                ${
                  fullNameError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                    : ""
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
                          className={cn(
                            "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 bg-white px-1 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400",
                            isDark
                              ? "bg-[#180438] text-white"
                              : "bg-white text-[#1A1A1A]"
                          )}
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
                        className={cn(
                          "peer block w-full rounded-lg border focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-purple-500 px-3 pr-10 pt-5 pb-2 text-md cursor-default",
                          isDark
                            ? "bg-[#180438] border border-gray-400"
                            : "text-[#1A1A1A] bg-gray-50 "
                        )}
                        placeholder=" "
                      />
                      <label
                        htmlFor="fullName"
                        className={cn(
                          "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                          isDark
                            ? "bg-[#180438] text-white"
                            : "bg-white text-[#1A1A1A]"
                        )}
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
                {/* Display Mode: Read-only Input with Edit Button */}
                <div className="relative flex-1">
                  <input
                    type="email"
                    value={userData.email}
                    readOnly
                    className={cn(
                      "peer block w-full rounded-lg border focus:outline-none focus:ring-1 focus:ring-gray-500 focus:border-purple-500 px-3 pr-10 pt-5 pb-2 text-md cursor-default",
                      isDark
                        ? "bg-[#180438] border border-gray-400"
                        : "text-[#1A1A1A] bg-gray-50 "
                    )}
                    placeholder=" "
                  />
                  <label
                    htmlFor="email"
                    className={cn(
                      "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                      isDark
                        ? "bg-[#180438] text-white"
                        : "bg-white text-[#1A1A1A]"
                    )}
                  >
                    Email
                  </label>
                  {userData.user_type === "creator" && (
                    <button
                      type="button"
                      onClick={handleEditEmail}
                      className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Username / Referral Code
                </label>
                <div
                  className={cn(
                    "min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] truncate min-w-0 pr-8",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                    title={userData.username}
                  >
                    {userData.username}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyUsername}
                    className={cn(
                      "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                      isDark
                        ? "hover:bg-[#2a0a5a] text-[#8A8A8A] hover:text-white"
                        : "hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    )}
                    title="Copy username/referral code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
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
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Account Type
                </label>
                <div
                  className={cn(
                    "min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] capitalize truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
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

              {/* Profile fields moved to separate card below */}
            </div>
          </CardContent>
          {/* <div className="px-6 pb-4">
            <div
              className={cn(
                "rounded-lg border p-4",
                isDark
                  ? "bg-[#2a0a5a] border-purple-500/30"
                  : "bg-purple-50 border-purple-200"
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-purple-200" : "text-purple-700"
                )}
              >
                💰 When you fill your complete profile, we give you a $0.50
                bonus!
              </p>
            </div>
          </div> */}
        </div>
      </div>

      {/* Creator Profile Details - Only for Creators */}
      {userData.user_type === "creator" && creatorProfile && (
        <div>
          <div
            className={cn(
              "rounded-t-2xl border-b px-6 py-4 shadow-lg",
              isDark ? "bg-[#180438]" : "bg-white "
            )}
          >
            <CardTitle
              className={cn(
                "text-xl",
                isDark ? "text-white" : "text-[#7F39EC]"
              )}
            >
              Profile Details
            </CardTitle>
          </div>
          <div
            className={cn(
              "rounded-b-2xl shadow-lg px-2 pb-4",
              isDark ? "bg-[#180438]" : "bg-white "
            )}
          >
            <div className="px-6 pt-4 pb-8">
              <CardTitle className="text-xl font-semibold">
                Personal Information
              </CardTitle>
              <CardDescription className="mt-2 text-md">
                Complete your profile to get contests matched to your country,
                categories, subcategories, and interests. Click "Save Changes"
                to save all updates and receive a $0.50 bonus.
              </CardDescription>
            </div>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-10">
                {/* Phone Number */}
                {/* <div className="relative w-full">
                  <div className="relative flex-1">
                    <label
                      htmlFor="phone"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 z-10 px-1 pointer-events-none",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      Phone Number
                    </label>
                    <PhoneInput
                      key={`phone-input-${isDark ? "dark" : "light"}`}
                      id="phone"
                      international
                      defaultCountry="IN"
                      value={editedPhone}
                      onChange={(value: string | undefined) =>
                        setEditedPhone(value || "")
                      }
                      disabled={hasReceivedProfileBonus || isSubmitting}
                      className={cn(
                        "custom-phone-input",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400 border-gray-400"
                            : "bg-white text-gray-400 border-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white border-gray-300"
                          : "bg-white text-gray-900 border-gray-300"
                      )}
                      style={
                        {
                          "--PhoneInputCountryFlag-height": "1.2em",
                          "--PhoneInputCountryFlag-borderWidth": "0",
                          backgroundColor: isDark ? "#180438" : "white",
                          color:
                            hasReceivedProfileBonus || isSubmitting
                              ? "#9ca3af"
                              : isDark
                              ? "white"
                              : "#1a1a1a",
                          borderColor:
                            hasReceivedProfileBonus || isSubmitting
                              ? "#9ca3af"
                              : "#d1d5db",
                        } as React.CSSProperties
                      }
                      numberInputProps={{
                        className: "peer",
                        placeholder: " ",
                        style: {
                          color:
                            hasReceivedProfileBonus || isSubmitting
                              ? "#9ca3af"
                              : isDark
                              ? "white"
                              : "#1a1a1a",
                          backgroundColor: "transparent",
                        },
                      }}
                    />
                  </div>
                </div> */}

                {/* Date of Birth */}
                <div className="relative w-full">
                  <div className="relative flex-1">
                    <input
                      id="dateOfBirth"
                      type="date"
                      value={editedDateOfBirth}
                      onChange={(e) => setEditedDateOfBirth(e.target.value)}
                      max={(() => {
                        const today = new Date();
                        const lastYear = today.getFullYear() - 1;
                        return `${lastYear}-12-31`;
                      })()}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                      className={cn(
                        "peer px-2.5 pb-2.5 pt-4 w-full text-[14px] rounded-lg focus:outline-none focus:ring-1 transition-colors duration-300",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                            : "bg-white text-gray-400 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                      style={
                        {
                          colorScheme: isDark ? "dark" : "light",
                        } as React.CSSProperties
                      }
                    />
                    <label
                      htmlFor="dateOfBirth"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      Date of Birth
                    </label>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}
                  >
                    This can be set only once and cannot be changed later
                  </p>
                </div>

                {/* Gender */}
                <div className="relative w-full">
                  <div className="relative flex-1">
                    <select
                      id="gender"
                      value={editedGender}
                      onChange={(e) => setEditedGender(e.target.value)}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                      className={cn(
                        "peer px-2.5 pb-2.5 pt-4 w-full text-[14px] rounded-lg focus:outline-none focus:ring-1 transition-colors duration-300",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                            : "bg-white text-gray-600 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      {/* <option value="Other">Other</option>
                      <option value="Prefer not to say">
                        Prefer not to say
                      </option> */}
                    </select>
                    <label
                      htmlFor="gender"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      Gender
                    </label>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      isDark ? "text-gray-400" : "text-gray-500"
                    )}
                  >
                    This can be set only once and cannot be changed later
                  </p>
                </div>

                {/* Country */}
                <div className="relative w-full">
                  <div className="relative flex-1">
                    <label
                      htmlFor="country"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1 z-10",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      Country
                    </label>
                    <Select
                      value={selectedCountryCode}
                      onValueChange={(value) => {
                        if (value === "__clear__") {
                          setSelectedCountryCode("");
                          setEditedCountry("");
                          setSelectedStateCode("");
                          setEditedState("");
                          setEditedCity("");
                          setCountrySearch("");
                          setStateSearch("");
                          setCitySearch("");
                        } else {
                          setSelectedCountryCode(value);
                          const country = Country.getCountryByCode(value);
                          setEditedCountry(country?.name || "");
                          // Reset state and city when country changes
                          setSelectedStateCode("");
                          setEditedState("");
                          setEditedCity("");
                          setCountrySearch("");
                          setStateSearch("");
                          setCitySearch("");
                        }
                      }}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                    >
                      <SelectTrigger
                        id="country"
                        isDark={isDark}
                        className={cn(
                          "h-12 w-full text-[14px] transition-colors duration-200",
                          hasReceivedProfileBonus || isSubmitting
                            ? isDark
                              ? "bg-transparent border-gray-400 text-gray-400 hover:bg-[#180438]/50 hover:border-gray-400"
                              : "border-gray-400 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                            : isDark
                            ? "bg-[#180438] text-white border-gray-300 hover:bg-[#180438]/50 hover:border-gray-500"
                            : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                        )}
                      >
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="Search country..."
                              value={countrySearch}
                              onChange={(e) => setCountrySearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className={cn(
                                "pl-8 h-9 text-sm",
                                isDark
                                  ? "bg-[#180438] text-white border-gray-600"
                                  : "bg-white text-gray-900 border-gray-300"
                              )}
                            />
                          </div>
                        </div>
                        {selectedCountryCode && (
                          <SelectItem
                            value="__clear__"
                            isDark={isDark}
                            className="text-red-500 hover:text-red-600 focus:text-red-600"
                          >
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4" />
                              <span>Clear Selection</span>
                            </div>
                          </SelectItem>
                        )}
                        {Country.getAllCountries()
                          .filter((country) =>
                            country.name
                              .toLowerCase()
                              .includes(countrySearch.toLowerCase())
                          )
                          .map((country) => (
                            <SelectItem
                              key={country.isoCode}
                              value={country.isoCode}
                              isDark={isDark}
                            >
                              {country.name}
                            </SelectItem>
                          ))}
                        {Country.getAllCountries().filter((country) =>
                          country.name
                            .toLowerCase()
                            .includes(countrySearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            No countries found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* State */}
                <div className="relative w-full">
                  <div className="relative flex-1">
                    <label
                      htmlFor="state"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1 z-10",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      State
                    </label>
                    <Select
                      value={selectedStateCode}
                      onValueChange={(value) => {
                        if (value === "__clear__") {
                          setSelectedStateCode("");
                          setEditedState("");
                          setEditedCity("");
                          setStateSearch("");
                          setCitySearch("");
                        } else {
                          setSelectedStateCode(value);
                          const state = State.getStateByCodeAndCountry(
                            value,
                            selectedCountryCode
                          );
                          setEditedState(state?.name || "");
                          // Reset city when state changes
                          setEditedCity("");
                          setStateSearch("");
                          setCitySearch("");
                        }
                      }}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                    >
                      <SelectTrigger
                        id="state"
                        isDark={isDark}
                        className={cn(
                          "h-12 w-full text-[14px] transition-colors duration-200",
                          hasReceivedProfileBonus || isSubmitting
                            ? isDark
                              ? "bg-transparent border-gray-400 text-gray-400 hover:bg-[#180438]/50 hover:border-gray-400"
                              : "border-gray-400 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                            : isDark
                            ? "bg-[#180438] text-white border-gray-300 hover:bg-[#180438]/50 hover:border-gray-500"
                            : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                        )}
                      >
                        <SelectValue
                          placeholder={
                            selectedCountryCode
                              ? State.getStatesOfCountry(selectedCountryCode)
                                  .length === 0
                                ? "No States Available"
                                : "Select State"
                              : "Select Country First"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        {selectedCountryCode && (
                          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                type="text"
                                placeholder="Search state..."
                                value={stateSearch}
                                onChange={(e) => setStateSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className={cn(
                                  "pl-8 h-9 text-sm",
                                  isDark
                                    ? "bg-[#180438] text-white border-gray-600"
                                    : "bg-white text-gray-900 border-gray-300"
                                )}
                              />
                            </div>
                          </div>
                        )}
                        {selectedStateCode && (
                          <SelectItem
                            value="__clear__"
                            isDark={isDark}
                            className="text-red-500 hover:text-red-600 focus:text-red-600"
                          >
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4" />
                              <span>Clear Selection</span>
                            </div>
                          </SelectItem>
                        )}
                        {selectedCountryCode &&
                        State.getStatesOfCountry(selectedCountryCode).length >
                          0 ? (
                          State.getStatesOfCountry(selectedCountryCode)
                            .filter((state) =>
                              state.name
                                .toLowerCase()
                                .includes(stateSearch.toLowerCase())
                            )
                            .map((state) => (
                              <SelectItem
                                key={state.isoCode}
                                value={state.isoCode}
                                isDark={isDark}
                              >
                                {state.name}
                              </SelectItem>
                            ))
                        ) : selectedCountryCode ? (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            No states available for this country
                          </div>
                        ) : null}
                        {selectedCountryCode &&
                          State.getStatesOfCountry(selectedCountryCode).length >
                            0 &&
                          State.getStatesOfCountry(selectedCountryCode).filter(
                            (state) =>
                              state.name
                                .toLowerCase()
                                .includes(stateSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-gray-500">
                              No states found
                            </div>
                          )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* City */}
                <div className="relative w-full">
                  <div className="relative flex-1">
                    <label
                      htmlFor="city"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1 z-10",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      City
                    </label>
                    <Select
                      value={editedCity}
                      onValueChange={(value) => {
                        if (value === "__clear__") {
                          setEditedCity("");
                          setCitySearch("");
                        } else {
                          setEditedCity(value);
                          setCitySearch("");
                        }
                      }}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                    >
                      <SelectTrigger
                        id="city"
                        isDark={isDark}
                        className={cn(
                          "h-12 w-full text-[14px] transition-colors duration-200",
                          hasReceivedProfileBonus || isSubmitting
                            ? isDark
                              ? "bg-transparent border-gray-400 text-gray-400 hover:bg-[#180438]/50 hover:border-gray-400"
                              : "border-gray-400 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                            : isDark
                            ? "bg-[#180438] text-white border-gray-300 hover:bg-[#180438]/50  hover:border-gray-500"
                            : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                        )}
                      >
                        <SelectValue
                          placeholder={
                            !selectedCountryCode
                              ? "Select Country First"
                              : selectedStateCode
                              ? "Select City"
                              : State.getStatesOfCountry(selectedCountryCode)
                                  .length === 0
                              ? "Select City"
                              : "Select State First"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent isDark={isDark}>
                        {selectedCountryCode &&
                          (selectedStateCode ||
                            State.getStatesOfCountry(selectedCountryCode)
                              .length === 0) && (
                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  type="text"
                                  placeholder="Search city..."
                                  value={citySearch}
                                  onChange={(e) =>
                                    setCitySearch(e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className={cn(
                                    "pl-8 h-9 text-sm",
                                    isDark
                                      ? "bg-[#180438] text-white border-gray-600"
                                      : "bg-white text-gray-900 border-gray-300"
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        {editedCity && (
                          <SelectItem
                            value="__clear__"
                            isDark={isDark}
                            className="text-red-500 hover:text-red-600 focus:text-red-600"
                          >
                            <div className="flex items-center gap-2">
                              <X className="h-4 w-4" />
                              <span>Clear Selection</span>
                            </div>
                          </SelectItem>
                        )}
                        {selectedCountryCode &&
                        (selectedStateCode ||
                          State.getStatesOfCountry(selectedCountryCode)
                            .length === 0)
                          ? (() => {
                              const cities = selectedStateCode
                                ? City.getCitiesOfState(
                                    selectedCountryCode,
                                    selectedStateCode
                                  )
                                : City.getCitiesOfCountry(selectedCountryCode);
                              const filteredCities = cities
                                ? cities.filter((city) =>
                                    city.name
                                      .toLowerCase()
                                      .includes(citySearch.toLowerCase())
                                  )
                                : [];
                              return filteredCities.length > 0 ? (
                                filteredCities.map((city) => (
                                  <SelectItem
                                    key={`${city.name}-${city.stateCode || ""}`}
                                    value={city.name}
                                    isDark={isDark}
                                  >
                                    {city.name}
                                  </SelectItem>
                                ))
                              ) : cities && cities.length > 0 ? (
                                <div className="px-2 py-1.5 text-sm text-gray-500">
                                  No cities found
                                </div>
                              ) : (
                                <div className="px-2 py-1.5 text-sm text-gray-500">
                                  No cities available
                                </div>
                              );
                            })()
                          : null}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Address */}
                <div className="relative w-full col-span-1 sm:col-span-2">
                  <div className="relative flex-1">
                    <textarea
                      id="address"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      disabled={hasReceivedProfileBonus || isSubmitting}
                      placeholder=" "
                      rows={3}
                      className={cn(
                        "peer px-2.5 pb-2.5 pt-4 w-full text-[14px] rounded-lg focus:outline-none focus:ring-1 transition-colors duration-300 resize-none",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                            : "bg-white text-gray-400 border border-gray-400 focus:border-gray-400 focus:ring-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          : "bg-white text-gray-900 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      )}
                    />
                    <label
                      htmlFor="address"
                      className={cn(
                        "absolute font-medium text-[14px] left-3 top-0 -translate-y-1/2 px-1",
                        hasReceivedProfileBonus || isSubmitting
                          ? isDark
                            ? "bg-[#180438] text-gray-400"
                            : "bg-white text-gray-400"
                          : isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
                    >
                      House/Flat Address
                    </label>
                  </div>
                </div>

                {/* Languages */}
                <div className="relative w-full col-span-1 sm:col-span-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex-1">
                        <Label
                          htmlFor="languageSelect"
                          className={cn(
                            "block mb-2 text-[14px] font-medium",
                            isDark ? "text-white" : "text-[#1A1A1A]"
                          )}
                        >
                          My Languages{" "}
                          <span className="text-xs font-normal opacity-70">
                            ({editedLanguages.length}/5)
                          </span>
                        </Label>
                        <Select
                          value={languageInput || undefined}
                          onValueChange={(value) => {
                            handleAddLanguage(value);
                          }}
                          disabled={
                            hasReceivedProfileBonus ||
                            isSubmitting ||
                            editedLanguages.length >= 5
                          }
                        >
                          <SelectTrigger
                            id="languageSelect"
                            
                            className={cn(
                              "w-full text-[14px]",
                              isDark
                                ? "bg-[#180438] text-white border-gray-300"
                                : "bg-white text-gray-900 border-gray-300"
                            )}
                          >
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                          <SelectContent
                            isDark={isDark}
                          >
                            {allLanguages.map((language) => (
                              <SelectItem
                                key={language}
                                value={language}
                                isDark={isDark}
                                disabled={editedLanguages.includes(language)}
                                className={cn(
                                  isDark
                                    ? "hover:bg-purple-900/30"
                                    : "hover:bg-purple-50"
                                )}
                              >
                                {language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editedLanguages.length >= 5 && (
                          <p
                            className={cn(
                              "mt-1 text-xs",
                              isDark ? "text-yellow-400" : "text-yellow-600"
                            )}
                          >
                            Maximum of 5 languages reached. Remove a language to
                            add another.
                          </p>
                        )}
                      </div>
                    </div>
                    {editedLanguages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {editedLanguages.map((lang, index) => (
                          <span
                            key={index}
                            className={cn(
                              "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm",
                              isDark
                                ? "bg-purple-900/30 text-purple-200 border border-purple-700"
                                : "bg-purple-100 text-purple-800 border border-purple-300"
                            )}
                          >
                            {lang}
                            <button
                              type="button"
                              onClick={() => handleRemoveLanguage(lang)}
                              className="ml-1 hover:text-red-500"
                              disabled={hasReceivedProfileBonus || isSubmitting}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Type of content I create - Max 3 category selections */}
                <div className="relative w-full col-span-1 sm:col-span-2">
                  <div className="space-y-3">
                    <label
                      className={cn(
                        "text-sm text-[14px] font-medium block",
                        isDark ? "text-white" : "text-[#1A1A1A]"
                      )}
                    >
                      Categories{" "}
                      <span className="text-xs text-gray-500">
                        (Select up to 3)
                      </span>
                    </label>
                    <div
                      className={cn(
                        "rounded-lg border p-4 space-y-3",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300"
                      )}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {CONTENT_TYPE_CATEGORIES.map((category) => {
                          const isChecked = editedContentTypesCreated.includes(
                            category.id
                          );
                          const isDisabled =
                            !isChecked && editedContentTypesCreated.length >= 3;
                          return (
                            <div
                              key={category.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`content-created-${category.id}`}
                                checked={isChecked}
                                disabled={isDisabled || isSubmitting}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    if (editedContentTypesCreated.length < 3) {
                                      setEditedContentTypesCreated([
                                        ...editedContentTypesCreated,
                                        category.id,
                                      ]);
                                      // Automatically check all subcategories when category is selected
                                      const newSubcategories =
                                        category.subcategories.map(
                                          (subcategory) => ({
                                            category: category.id,
                                            subcategory: subcategory,
                                          })
                                        );
                                      // Add subcategories that aren't already in the list
                                      setEditedInterestedContentTypes(
                                        (prev) => {
                                          const existing = new Set(
                                            prev.map(
                                              (item) =>
                                                `${item.category}:${item.subcategory}`
                                            )
                                          );
                                          const toAdd = newSubcategories.filter(
                                            (item) =>
                                              !existing.has(
                                                `${item.category}:${item.subcategory}`
                                              )
                                          );
                                          return [...prev, ...toAdd];
                                        }
                                      );
                                    }
                                  } else {
                                    // Remove category and all its subcategories from interested list
                                    setEditedContentTypesCreated(
                                      editedContentTypesCreated.filter(
                                        (id) => id !== category.id
                                      )
                                    );
                                    setEditedInterestedContentTypes(
                                      editedInterestedContentTypes.filter(
                                        (item) => item.category !== category.id
                                      )
                                    );
                                  }
                                }}
                                className={cn(
                                  isDark
                                    ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                    : "border-gray-400 data-[state=checked]:bg-purple-600"
                                )}
                              />
                              <label
                                htmlFor={`content-created-${category.id}`}
                                className={cn(
                                  "text-sm font-normal",
                                  isDisabled
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer",
                                  isDark ? "text-gray-300" : "text-gray-700"
                                )}
                              >
                                {category.name}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {editedContentTypesCreated.length > 0 && (
                        <div className="flex items-center justify-between mt-2">
                          <p
                            className={cn(
                              "text-xs",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}
                          >
                            {editedContentTypesCreated.length} of 3 selected
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditedContentTypesCreated([]);
                              setEditedInterestedContentTypes([]);
                            }}
                            disabled={isSubmitting}
                            className={cn(
                              "h-7 px-2 text-xs",
                              isDark
                                ? "border-gray-400 text-gray-300"
                                : "border-gray-400 text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Other type of content I am interested in - Subcategories of selected categories */}
                <div className="relative w-full col-span-1 sm:col-span-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label
                        className={cn(
                          "text-[14px] font-medium block",
                          isDark ? "text-white" : "text-[#1A1A1A]"
                        )}
                      >
                        Subcategories
                      </label>
                      {editedInterestedContentTypes.length > 0 && (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            isDark
                              ? "bg-purple-900/30 text-purple-200 border border-purple-700"
                              : "bg-purple-100 text-purple-800 border border-purple-300"
                          )}
                        >
                          {editedInterestedContentTypes.length}
                          selected
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-lg border p-4 space-y-3",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300"
                      )}
                    >
                      <Accordion type="multiple" className="w-full">
                        {CONTENT_TYPE_CATEGORIES.map((category) => {
                          // Get selected subcategories for this category
                          const selectedSubcategoriesForCategory =
                            editedInterestedContentTypes.filter(
                              (item) => item.category === category.id
                            );
                          const selectedCount =
                            selectedSubcategoriesForCategory.length;

                          return (
                            <AccordionItem
                              key={category.id}
                              value={category.id}
                              className="border-b border-gray-200 dark:border-gray-700"
                            >
                              <AccordionTrigger
                                className={cn(
                                  "text-sm font-medium hover:no-underline py-3",
                                  isDark ? "text-gray-300" : "text-gray-700"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{category.name}</span>
                                  {selectedCount > 0 && (
                                    <span
                                      className={cn(
                                        "text-xs px-2 py-0.5 rounded-full",
                                        isDark
                                          ? "bg-purple-600 text-white"
                                          : "bg-purple-100 text-purple-700"
                                      )}
                                    >
                                      {selectedCount} selected
                                    </span>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="pt-2 pb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {category.subcategories.map((subcategory) => {
                                    const isChecked =
                                      editedInterestedContentTypes.some(
                                        (item) =>
                                          item.category === category.id &&
                                          item.subcategory === subcategory
                                      );
                                    return (
                                      <div
                                        key={`${category.id}-${subcategory}`}
                                        className="flex items-center space-x-2"
                                      >
                                        <Checkbox
                                          id={`content-interested-${category.id}-${subcategory}`}
                                          checked={isChecked}
                                          disabled={isSubmitting}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setEditedInterestedContentTypes([
                                                ...editedInterestedContentTypes,
                                                {
                                                  category: category.id,
                                                  subcategory: subcategory,
                                                },
                                              ]);
                                            } else {
                                              setEditedInterestedContentTypes(
                                                editedInterestedContentTypes.filter(
                                                  (item) =>
                                                    !(
                                                      item.category ===
                                                        category.id &&
                                                      item.subcategory ===
                                                        subcategory
                                                    )
                                                )
                                              );
                                            }
                                          }}
                                          className={cn(
                                            isDark
                                              ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                              : "border-gray-400 data-[state=checked]:bg-purple-600"
                                          )}
                                        />
                                        <label
                                          htmlFor={`content-interested-${category.id}-${subcategory}`}
                                          className={cn(
                                            "text-sm font-normal cursor-pointer",
                                            isDark
                                              ? "text-gray-300"
                                              : "text-gray-700"
                                          )}
                                        >
                                          {subcategory}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                      {editedInterestedContentTypes.length > 0 && (
                        <div className="flex items-center justify-end mt-2">
                          {/* <p
                            className={cn(
                              "text-xs",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}
                          >
                            {editedInterestedContentTypes.length} subcategories
                            selected
                          </p> */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditedInterestedContentTypes([])}
                            disabled={isSubmitting}
                            className={cn(
                              "h-7 px-2 text-xs",
                              isDark
                                ? "border-gray-400 text-gray-300"
                                : "border-gray-400 text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interests */}
                <div className="relative w-full col-span-1 sm:col-span-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label
                        className={cn(
                          "text-[14px] font-medium",
                          isDark ? "text-white" : "text-[#1A1A1A]"
                        )}
                      >
                        Interests
                      </label>
                      {editedInterests.length > 0 && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            isDark
                              ? "bg-purple-600 text-white"
                              : "bg-purple-100 text-purple-700"
                          )}
                        >
                          {editedInterests.length} selected
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "rounded-lg border p-4 space-y-3",
                        isDark
                          ? "bg-[#180438] border-gray-300"
                          : "bg-white border-gray-300"
                      )}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {INTERESTS.map((interest) => {
                          const isChecked = editedInterests.includes(interest);
                          return (
                            <div
                              key={interest}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`interest-${interest}`}
                                checked={isChecked}
                                disabled={isSubmitting}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setEditedInterests([
                                      ...editedInterests,
                                      interest,
                                    ]);
                                  } else {
                                    setEditedInterests(
                                      editedInterests.filter(
                                        (item) => item !== interest
                                      )
                                    );
                                  }
                                }}
                                className={cn(
                                  isDark
                                    ? "border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                    : "border-gray-400 data-[state=checked]:bg-purple-600"
                                )}
                              />
                              <label
                                htmlFor={`interest-${interest}`}
                                className={cn(
                                  "text-sm font-normal cursor-pointer",
                                  isDark ? "text-gray-300" : "text-gray-700"
                                )}
                              >
                                {interest}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                      {editedInterests.length > 0 && (
                        <div className="flex items-center justify-end mt-2">
                          {/* <p
                            className={cn(
                              "text-xs",
                              isDark ? "text-gray-400" : "text-gray-500"
                            )}
                          >
                            {editedInterests.length} interests selected
                          </p> */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditedInterests([])}
                            disabled={isSubmitting}
                            className={cn(
                              "h-7 px-2 text-xs",
                              isDark
                                ? "border-gray-400 text-gray-300"
                                : "border-gray-400 text-gray-700 hover:bg-gray-100"
                            )}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Changes Button */}
              <div className="flex justify-end pt-4">
                {hasReceivedProfileBonus ? (
                  hasOnlyEditableFieldChanges() ? (
                    <Button
                      onClick={() => handleSaveProfileChanges(false)}
                      disabled={!hasProfileChanges() || isSubmitting}
                      className={cn(
                        "px-6 py-2",
                        isDark
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-[#7F39EC] hover:bg-[#6C43D0]"
                      )}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">
                      You can only edit interests, categories, and subcategories
                      after receiving the bonus.
                    </div>
                  )
                ) : (
                  <Button
                    onClick={handleSaveClick}
                    disabled={!hasProfileChanges() || isSubmitting}
                    className={cn(
                      "px-6 py-2",
                      isDark
                        ? "bg-purple-600 hover:bg-purple-700"
                        : "bg-[#7F39EC] hover:bg-[#6C43D0]"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </div>
        </div>
      )}

      {/* Company Profile - Only for Advertisers */}
      {/* {userData?.user_type === "advertiser" && (
        <div>
          <div
            className={cn(
              "rounded-t-2xl border-b px-6 py-4 shadow-lg",
              isDark ? "bg-[#180438]" : "bg-white "
            )}
          >
            <CardTitle
              className={cn(
                "text-xl",
                isDark ? "text-white" : "text-[#7F39EC]"
              )}
            >
              Company Profile
            </CardTitle>
          </div>
          <div
            className={cn(
              "rounded-b-2xl shadow-lg px-2 pb-3",
              isDark ? "bg-[#180438]" : "bg-white "
            )}
          >
            <div className="px-6 py-4">
              <CardTitle className="text-xl font-semibold">
                Company Information
              </CardTitle>
              <CardDescription className="mt-2 text-md">
                Update your company information
              </CardDescription>
            </div>
            <CardContent>
              <form onSubmit={updateCompanyProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    className={cn(
                      isDark
                        ? "bg-[#180438] border border-gray-600 text-white"
                        : "bg-white border border-gray-300"
                    )}
                    defaultValue={advertiserProfile?.company_name || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    name="website_url"
                    type="url"
                    className={cn(
                      isDark
                        ? "bg-[#180438] border border-gray-600 text-white"
                        : "bg-white border border-gray-300"
                    )}
                    defaultValue={advertiserProfile?.website_url || ""}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl py-2.5 bg-[#6C43D0] text-white text-md hover:bg-[#5A36B8] transition-colors"
                  disabled={companyProfileLoading}
                >
                  {companyProfileLoading ? "Updating..." : "Update Profile"}
                </button>
              </form>
            </CardContent>
          </div>
        </div>
      )} */}

      <div
        className={cn(
          "rounded-2xl shadow-lg px-2 pb-5",
          isDark ? "bg-[#180438]" : "bg-white "
        )}
      >
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
                className={cn(
                  "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                  isDark
                    ? "bg-[#180438] text-[#8A8A8A]"
                    : "bg-white text-gray-500"
                )}
              >
                Referred By
              </label>
              <div
                className={cn(
                  "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                  isDark
                    ? "text-[#8A8A8A] border-[#8A8A8A]"
                    : "border border-gray-300 text-gray-500"
                )}
              >
                <p
                  className={cn(
                    "text-base text-[15px] truncate min-w-0",
                    isDark ? "text-[#8A8A8A]" : "text-gray-500"
                  )}
                  title={referrer || "Not referred"}
                >
                  {referrer || "Not referred"}
                </p>
              </div>
            </div>

            <div className="relative w-full">
              <label
                htmlFor="floating"
                className={cn(
                  "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                  isDark
                    ? "bg-[#180438] text-[#8A8A8A]"
                    : "bg-white text-gray-500"
                )}
              >
                Available Coins
              </label>
              <div
                className={cn(
                  "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                  isDark
                    ? "text-[#8A8A8A] border-[#8A8A8A]"
                    : "border border-gray-300 text-gray-500"
                )}
              >
                <p
                  className={cn(
                    "text-base text-[15px] truncate min-w-0",
                    isDark ? "text-[#8A8A8A]" : "text-gray-500"
                  )}
                >
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
                className={cn(
                  "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                  isDark
                    ? "bg-[#180438] text-[#8A8A8A]"
                    : "bg-white text-gray-500"
                )}
              >
                Creators Referred
              </label>
              <div
                className={cn(
                  "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                  isDark
                    ? "text-[#8A8A8A] border-[#8A8A8A]"
                    : "border border-gray-300 text-gray-500"
                )}
              >
                <p
                  className={cn(
                    "text-base text-[15px]  text-muted-foreground truncate min-w-0",
                    isDark ? "text-[#8A8A8A]" : "text-gray-500"
                  )}
                >
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
                className={cn(
                  "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                  isDark
                    ? "bg-[#180438] text-[#8A8A8A]"
                    : "bg-white text-gray-500"
                )}
              >
                Advertisers Referred
              </label>
              <div
                className={cn(
                  "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                  isDark
                    ? "text-[#8A8A8A] border-[#8A8A8A]"
                    : "border border-gray-300 text-gray-500"
                )}
              >
                <p
                  className={cn(
                    "text-base text-[15px] text-muted-foreground truncate min-w-0",
                    isDark ? "text-[#8A8A8A]" : "text-gray-500"
                  )}
                >
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
        <div
          className={cn(
            "rounded-2xl shadow-lg px-2 pb-5",
            isDark ? "bg-[#180438]" : "bg-white"
          )}
        >
          <CardHeader className="mb-3">
            <CardTitle
              className={cn(
                "text-xl font-semibold",
                isDark ? "text-white" : "text-[#7F39EC]"
              )}
            >
              Creator Profile
            </CardTitle>
            <CardDescription className="text-md">
              Your creator statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-8 gap-y-12">
              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Contests Participated
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
                    {creatorProfile.total_contests_participated}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Contests Participated
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {creatorProfile.total_contests_participated}
                  </p>
                </div>
              </div> */}
              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Contests Won
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
                    {creatorProfile.total_contests_won}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Contests Won
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {creatorProfile.total_contests_won}
                  </p>
                </div>
              </div> */}
              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Total Money Won
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
                    {formatMoney(creatorProfile.total_money_won)}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Total Money Won
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(creatorProfile.total_money_won)}
                  </p>
                </div>
              </div> */}
              <div className="relative w-full">
                <label
                  htmlFor="floating"
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Withdrawable Balance
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
                    {formatMoney(creatorProfile.withdrawable_balance)}
                  </p>
                </div>
              </div>
              {/* <div className="space-y-3 min-w-0">
                <Label className="text-sm font-semibold text-foreground">
                  Withdrawable Balance
                </Label>
                <div className="p-4 bg-background border border-border rounded-lg min-w-0">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    {formatMoney(creatorProfile.withdrawable_balance)}
                  </p>
                </div>
              </div> */}
            </div>
          </CardContent>
        </div>
      )}

      {advertiserProfile && (
        <div
          className={cn(
            "rounded-2xl shadow-lg px-2 pb-5",
            isDark ? "bg-[#180438]" : "bg-white "
          )}
        >
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
                        className={cn(
                          "peer block w-full rounded-lg border px-3 pt-5 pb-2 text-md  borderfocus:outline-none focus:ring-1 focus:border-purple-500",
                          isDark
                            ? "bg-[#180438] text-white border-gray-300"
                            : "bg-white text-gray-500"
                        )}
                      />
                      <label
                        htmlFor="gameofcreators"
                        className={cn(
                          "absolute left-3 font-medium top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                          isDark
                            ? "bg-[#180438] text-white"
                            : "bg-white text-[#1A1A1A]"
                        )}
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
                      className={cn(
                        "peer block w-full rounded-lg border px-3 pt-5 pb-2 text-[14px] focus:outline-none focus:ring-1 focus:border-purple-500 cursor-default",
                        isDark
                          ? "bg-[#180438] text-white border-gray-400"
                          : "text-gray-500 bg-gray-50"
                      )}
                    />
                    <label
                      htmlFor="gameofcreators"
                      className={cn(
                        "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                        isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
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
                        className={cn(
                          "peer block w-full rounded-lg border px-3 pt-5 pb-2 text-md focus:outline-none focus:ring-1 focus:border-purple-500",
                          isDark
                            ? "bg-[#180438] text-white border-gray-300"
                            : "bg-white text-[#1A1A1A] border-gray-300"
                        )}
                      />

                      <label
                        htmlFor="websiteUrl"
                        className={cn(
                          "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                          isDark
                            ? "bg-[#180438] text-white"
                            : "bg-white text-[#1A1A1A]"
                        )}
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
                      className={cn(
                        "peer block w-full rounded-lg border px-3 pt-5 pb-2 text-[14px] focus:outline-none focus:ring-1 focus:border-purple-500 cursor-default",
                        isDark
                          ? "bg-[#180438] text-white border-gray-300"
                          : "bg-gray-50 text-[#1A1A1A]"
                      )}
                    />
                    <label
                      htmlFor="gameofcreators"
                      className={cn(
                        "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                        isDark
                          ? "bg-[#180438] text-white"
                          : "bg-white text-[#1A1A1A]"
                      )}
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
                <label
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Subscription Plan
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
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
                <label
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Contests Run
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
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
                <label
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Total Money Spent
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
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
                <label
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Withdrawable Balance
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
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
                <label
                  className={cn(
                    "absolute font-medium left-3 top-0 -translate-y-1/2 bg-white px-1 text-[14px]",
                    isDark
                      ? "bg-[#180438] text-[#8A8A8A]"
                      : "bg-white text-gray-500"
                  )}
                >
                  Available Deposit Balance
                </label>
                <div
                  className={cn(
                    "p-4 min-w-0 peer block w-full rounded-lg border px-3 pt-5 pb-2",
                    isDark
                      ? "text-[#8A8A8A] border-[#8A8A8A]"
                      : "border border-gray-300 text-gray-500"
                  )}
                >
                  <p
                    className={cn(
                      "text-base text-[15px] text-muted-foreground truncate min-w-0",
                      isDark ? "text-[#8A8A8A]" : "text-gray-500"
                    )}
                  >
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

      {/* Complete Profile Confirmation Modal */}
      <Dialog
        open={isCompleteProfileModalOpen}
        onOpenChange={setIsCompleteProfileModalOpen}
        isdark={isDark}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Complete Your Profile?
            </DialogTitle>
            {/* <DialogDescription
              className={cn(isDark ? "text-gray-300" : "text-gray-600")}
            >
              By completing your profile, you'll receive a $0.50 bonus.
            </DialogDescription> */}
            <p
              className={cn(
                "py-3 text-md font-medium",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              ⚠️ Once the $0.50 bonus is claimed, all details become disabled,
              except your interests, categories, and subcategories, which you
              can still edit.
            </p>
          </DialogHeader>
          {/* <div
            className={cn(
              "py-4 space-y-2",
              isDark ? "text-gray-300" : "text-gray-700"
            )}
          >
            <p className="text-sm font-medium">Are you sure you want to:</p>
            <ul className="text-sm list-disc list-inside space-y-1 ml-2">
              <li>Complete your profile and claim the $0.50 bonus?</li>
              <li>Lock your profile from further editing?</li>
            </ul>
          </div> */}
          <DialogFooter className="flex flex-col sm:flex-row justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCompleteProfileModalOpen(false);
                // Save without claiming bonus
                handleSaveProfileChanges(false);
              }}
              disabled={isSubmitting}
              className={cn(
                "w-full sm:w-auto",
                isDark
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-900"
              )}
            >
              Save
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              {/* <Button
                variant="outline"
                onClick={() => setIsCompleteProfileModalOpen(false)}
                disabled={isSubmitting}
                className={cn(
                  isDark
                    ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                    : "border-gray-300"
                )}
              >
                Cancel
              </Button> */}
              <Button
                onClick={handleConfirmCompleteProfile}
                disabled={isSubmitting}
                className={cn(
                  "px-6",
                  isDark
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-[#7F39EC] hover:bg-[#6C43D0]"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  "Complete & Claim Bonus"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Email Modal */}
      <EmailChangeModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        isDark={isDark}
        currentEmail={userData?.email || ""}
        onEmailUpdated={handleEmailUpdated}
      />
    </div>
  );
}
