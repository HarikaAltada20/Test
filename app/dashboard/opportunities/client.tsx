"use client";
import { useCallback, useEffect, useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  DollarSign,
  Trophy,
  Info,
  Share2,
  Users,
  Clock,
  CheckCheck,
  Gift,
  Tag,
  Star,
  Play,
  GraduationCap,
  RotateCcw,
  LayoutGrid,
  List,
  Eye,
  Search,
  X,
  Film,
  FileType,
} from "lucide-react";
import { UserResponse } from "@supabase/supabase-js";
import { formatLocalDateTime } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { createClient } from "@/utils/supabase/client";
import {
  calculateLeaderboardBudgetSpent,
  calculateTwitterCpmBudgetSpent,
  Submission,
} from "@/lib/contest-utils-client";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import CreatorGuidelinesModal from "@/components/dashboard/CreatorGuidelinesModal";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PaginationControls } from "@/components/ui/pagination-controls";

import {
  isCountryInContestRegions,
  extractCountryFromRegionJsonb,
  getRegionForCountry,
} from "@/lib/region-utils";

// Define types for filters and sorting
type StatusFilterType = "all" | "live" | "upcoming" | "completed";
type PlatformFilterType = "all" | "youtube" | "instagram" | "twitter"; // Scalable: add more platforms as needed
type ContestTypeFilterType = "all" | "leaderboard" | "cpm";
type SortOptionType =
  | "relevance_desc"
  | "start_date_desc"
  | "start_date_asc"
  | "end_date_asc"
  | "end_date_desc"
  | "value_desc"
  | "value_asc"
  | "cpm_rate_desc"
  | "cpm_rate_asc"
  | "submissions_desc"
  | "submissions_asc";

const getBudgetTrackerValues = (
  totalBudget: number,
  budgetSpent?: number | null
) => {
  const spent = Math.max(0, budgetSpent ?? 0);
  const clampedSpent = Math.min(spent, totalBudget);
  const percentage = totalBudget > 0 ? (clampedSpent / totalBudget) * 100 : 0;
  const remaining = Math.max(totalBudget - clampedSpent, 0);

  return { spent: clampedSpent, percentage, remaining };
};

export default function OpportunitiesPage({
  user,
}: {
  user: UserResponse["data"]["user"];
}) {
  const [availableContests, setAvailableContests] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [hasCheckedGuidelines, setHasCheckedGuidelines] = useState(false);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<string | null>(null);
  const [creatorCategories, setCreatorCategories] = useState<string[]>([]);
  const [creatorSubcategories, setCreatorSubcategories] = useState<
    Record<string, string[]>
  >({});
  const [creatorInterests, setCreatorInterests] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const fetchTwitterLeaderboardManualAdjustments = async (
    contestId: string
  ): Promise<Record<string, number>> => {
    const { data: adjustments } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("creator_id, manual_points_adjustment")
      .eq("contest_id", contestId);

    const adjustmentMap: Record<string, number> = {};
    (adjustments || []).forEach((entry: any) => {
      if (
        entry &&
        entry.creator_id &&
        typeof entry.manual_points_adjustment === "number"
      ) {
        adjustmentMap[entry.creator_id] = entry.manual_points_adjustment;
      }
    });

    return adjustmentMap;
  };

  const tabs = [
    {
      id: "all",
      label: "All",
      count: availableContests.filter(
        (c) => c.moderation_status === "published" && c.status
      ).length,
    },
    {
      id: "live",
      label: "Live",
      count: availableContests.filter(
        (c) => c.moderation_status === "published" && c.status === "active"
      ).length,
    },
    {
      id: "upcoming",
      label: "Upcoming",
      count: availableContests.filter(
        (c) => c.moderation_status === "published" && c.status === "upcoming"
      ).length,
    },
    {
      id: "completed",
      label: "Completed",
      count: availableContests.filter(
        (c) =>
          c.moderation_status === "published" &&
          c.post_contest_status === "payouts_processed"
      ).length,
    },
  ];
  const [mediaType, setMediaType] = useState("media");
  const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: "all" });
  // New state variables for filters and sorting
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [platformFilter, setPlatformFilter] =
    useState<PlatformFilterType>("all");
  const [typeFilter, setTypeFilter] = useState<ContestTypeFilterType>("all");
  const [sortOption, setSortOption] =
    useState<SortOptionType>("relevance_desc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [displayedContests, setDisplayedContests] = useState<any[]>([]);
  const [page, setPage] = useState<number>(1);
  // Default to 9 campaigns per page with options: 9, 15, 21, 30
  const [limit, setLimit] = useState<number>(9);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        return currentMode;
      }
      // Fallback to Tailwind's html.dark class if present
      const isHtmlDark = document.documentElement.classList.contains("dark");
      return isHtmlDark ? "dark" : "light";
    }
    return "light";
  });

  // Read and react to mode changes from data attribute with immediate updates
  useLayoutEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = (modeElement?.getAttribute("data-mode") || "") as
        | "light"
        | "dark"
        | "";
      if (currentMode === "light" || currentMode === "dark") {
        if (currentMode !== mode) {
          setMode(currentMode);
        }
        return;
      }
      // Fallback to html.dark if attribute missing
      const isHtmlDark = document.documentElement.classList.contains("dark");
      const fallbackMode = isHtmlDark ? "dark" : "light";
      if (fallbackMode !== mode) {
        setMode(fallbackMode);
      }
    };

    // Check immediately
    checkMode();

    // Watch for changes in the data attributes with immediate callback
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "data-mode"
        ) {
          checkMode();
        }
      });
    });

    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    // Also listen for storage events to catch theme changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "dashboard-mode" && e.newValue) {
        const newMode = e.newValue as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [mode]);

  // Additional effect to catch theme changes more immediately
  useEffect(() => {
    // Listen for custom theme change events that might be dispatched by the theme system
    const handleThemeChange = (event: CustomEvent) => {
      if (event.detail && event.detail.mode) {
        const newMode = event.detail.mode as "light" | "dark";
        if (newMode !== mode) {
          setMode(newMode);
        }
      }
    };

    // Listen for the custom event
    window.addEventListener("theme-change", handleThemeChange as EventListener);

    // Also check for changes on a more frequent interval as a fallback
    const intervalId = setInterval(() => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode && currentMode !== mode) {
          setMode(currentMode);
        }
      }
    }, 50); // Check every 50ms for faster response

    return () => {
      window.removeEventListener(
        "theme-change",
        handleThemeChange as EventListener
      );
      clearInterval(intervalId);
    };
  }, [mode]);

  // Responsive view mode: switch to grid view on smaller screens if in list view
  useEffect(() => {
    const checkScreenSize = () => {
      // Use 768px as the breakpoint (matches md:flex used for view toggle buttons)
      if (window.innerWidth < 768 && viewMode === "list") {
        setViewMode("grid");
      }
    };

    // Check on mount
    checkScreenSize();

    // Check on resize
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, [viewMode]);

  // Cache invalidation on user change
  useEffect(() => {
    if (user) {
      const guidelinesCacheKey = `guidelines_${user.id}`;
      const guidelinesTimestampKey = `guidelines_timestamp_${user.id}`;
      // Clear any existing cache when user changes
      localStorage.removeItem(guidelinesCacheKey);
      localStorage.removeItem(guidelinesTimestampKey);
    }
  }, [user?.id]);

  const fetchOpportunities = useCallback(async () => {
    if (!user) {
      console.log(
        "OpportunitiesPage: No user found after auth load, redirecting to signin."
      );
      router.push("/");
      return;
    }

    setIsFetchingData(true);

    try {
      const locationCacheKey = "user_location";
      const locationTimestampKey = "user_location_timestamp";
      const cachedLocation = localStorage.getItem(locationCacheKey);
      const cachedLocationTimestamp =
        localStorage.getItem(locationTimestampKey);

      const isLocationCacheValid =
        cachedLocationTimestamp &&
        Date.now() - parseInt(cachedLocationTimestamp) < 24 * 60 * 60 * 1000;

      let userCountries: string[] = [];
      let currentUserCountry: string | null = null;
      let currentUserRegion: string | null = null;

      try {
        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("registration_info")
          .eq("id", user.id)
          .single();

        if (!profileError && userProfile) {
          let extractedCountry = null;
          if (userProfile.registration_info) {
            const registrationInfo = userProfile.registration_info as Record<
              string,
              any
            >;
            extractedCountry = registrationInfo.country || null;
          }

          if (extractedCountry) {
            userCountries.push(extractedCountry);
            if (!currentUserCountry) {
              currentUserCountry = extractedCountry;
              currentUserRegion = getRegionForCountry(extractedCountry);
            }
          }
        } else if (profileError) {
          console.error("Error fetching location from database:", profileError);
        }
      } catch (dbError) {
        console.error("Error fetching location from database:", dbError);
      }

      try {
        const { data: creatorProfileData, error: creatorProfileError } =
          await supabase
            .from("creator_profiles")
            .select("country")
            .eq("id", user.id)
            .single();

        if (!creatorProfileError && creatorProfileData?.country) {
          if (!userCountries.includes(creatorProfileData.country)) {
            userCountries.push(creatorProfileData.country);
          }
          if (!currentUserCountry) {
            currentUserCountry = creatorProfileData.country;
            currentUserRegion = getRegionForCountry(creatorProfileData.country);
          }
        }
      } catch (creatorProfileError) {
        console.error(
          "Error fetching creator profile country:",
          creatorProfileError
        );
      }

      if (currentUserCountry) {
        setUserCountry(currentUserCountry);
        setUserRegion(currentUserRegion);
        const locationData = {
          country: currentUserCountry,
          region: currentUserRegion,
          countries: userCountries,
        };
        localStorage.setItem(locationCacheKey, JSON.stringify(locationData));
        localStorage.setItem(locationTimestampKey, Date.now().toString());
      }

      if (
        userCountries.length === 0 &&
        cachedLocation &&
        isLocationCacheValid
      ) {
        try {
          const locationData = JSON.parse(cachedLocation);
          if (locationData.country) {
            userCountries.push(locationData.country);
            currentUserCountry = locationData.country;
            currentUserRegion = locationData.region;
            setUserCountry(locationData.country);
            setUserRegion(locationData.region);
          }
        } catch (e) {
          console.error("Error parsing cached location:", e);
        }
      }

      try {
        const locationResponse = await fetch("/api/get-location");
        if (locationResponse.ok) {
          const locationData = await locationResponse.json();
          if (locationData.country) {
            if (!userCountries.includes(locationData.country)) {
              userCountries.push(locationData.country);
            }
            if (
              !currentUserCountry ||
              currentUserCountry !== locationData.country
            ) {
              currentUserCountry = locationData.country;
              currentUserRegion = locationData.region;
              setUserCountry(locationData.country);
              setUserRegion(locationData.region);
            }
            const locationCacheData = {
              country: locationData.country,
              region: locationData.region,
              countries: userCountries,
            };
            localStorage.setItem(
              locationCacheKey,
              JSON.stringify(locationCacheData)
            );
            localStorage.setItem(locationTimestampKey, Date.now().toString());
          }
        }
      } catch (locationError) {
        console.error("Error fetching user location:", locationError);
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();

      if (userError) {
        console.error("Error fetching user type:", userError);
        setAvailableContests([]);
        return;
      }

      if (userData?.user_type === "advertiser") {
        console.log(
          "OpportunitiesPage: Advertiser detected, redirecting to contests."
        );
        router.push("/dashboard/contests");
        return;
      }

      const guidelinesCacheKey = `guidelines_${user.id}`;
      const guidelinesTimestampKey = `guidelines_timestamp_${user.id}`;
      const cachedGuidelines = localStorage.getItem(guidelinesCacheKey);
      const cachedTimestamp = localStorage.getItem(guidelinesTimestampKey);

      const isCacheValid =
        cachedTimestamp &&
        Date.now() - parseInt(cachedTimestamp) < 24 * 60 * 60 * 1000;

      if (cachedGuidelines === "true" && isCacheValid) {
        setProfile({ has_seen_guidelines: true });
        setHasCheckedGuidelines(true);
      } else if (cachedGuidelines === "false" && isCacheValid) {
        setProfile({ has_seen_guidelines: false });
        setShowGuidelines(true);
        setHasCheckedGuidelines(true);
      } else {
        const { data: creatorProfile, error: profileError } = await supabase
          .from("creator_profiles")
          .select(
            "has_seen_guidelines, country, categories, subcategories, interests"
          )
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching creator profile:", profileError);
          setProfile({ has_seen_guidelines: false });
          setShowGuidelines(true);
        } else {
          setProfile(creatorProfile);
          localStorage.setItem(
            guidelinesCacheKey,
            creatorProfile.has_seen_guidelines.toString()
          );
          localStorage.setItem(guidelinesTimestampKey, Date.now().toString());
          if (creatorProfile.has_seen_guidelines === false) {
            setShowGuidelines(true);
          }
        }
        setHasCheckedGuidelines(true);
      }

      let localCreatorCategories: string[] = [];
      let localCreatorSubcategories: Record<string, string[]> = {};
      let localCreatorInterests: string[] = [];

      const { data: creatorProfileData } = await supabase
        .from("creator_profiles")
        .select("categories, subcategories, interests")
        .eq("id", user.id)
        .single();

      if (creatorProfileData) {
        if (creatorProfileData.categories) {
          localCreatorCategories = Array.isArray(creatorProfileData.categories)
            ? creatorProfileData.categories
            : [];
        }

        if (creatorProfileData.subcategories) {
          if (Array.isArray(creatorProfileData.subcategories)) {
            (creatorProfileData.subcategories as any[]).forEach((item: any) => {
              if (item.category && item.subcategory) {
                if (!localCreatorSubcategories[item.category]) {
                  localCreatorSubcategories[item.category] = [];
                }
                if (
                  !localCreatorSubcategories[item.category].includes(
                    item.subcategory
                  )
                ) {
                  localCreatorSubcategories[item.category].push(
                    item.subcategory
                  );
                }
              }
            });
          } else if (typeof creatorProfileData.subcategories === "object") {
            localCreatorSubcategories =
              creatorProfileData.subcategories as Record<string, string[]>;
          }
        }

        if (creatorProfileData.interests) {
          localCreatorInterests = Array.isArray(creatorProfileData.interests)
            ? creatorProfileData.interests
            : [];
        }
      }

      setCreatorCategories(localCreatorCategories);
      setCreatorSubcategories(localCreatorSubcategories);
      setCreatorInterests(localCreatorInterests);

      const { data: contests, error: contestError } = await supabase
        .from("contests_with_status")
        .select(
          `
            *,
            contest_based_details
          `
        )
        .eq("moderation_status", "published")
        .not("status", "eq", "incomplete")
        .order("created_at", { ascending: false });

      if (contestError) {
        console.error("Error fetching contests:", contestError);
        setAvailableContests([]);
      } else {
        const contestsWithCalculatedBudgets = await Promise.all(
          (contests || []).map(async (contest) => {
            let updatedContest = { ...contest };

            const isTwitterTextImage =
              (contest.platform?.toLowerCase() === "twitter" ||
                contest.platform?.toLowerCase() === "x") &&
              contest.contest_format === "text_image";

            const manualAdjustmentMap =
              contest.contest_type === "cpm"
                ? await fetchTwitterLeaderboardManualAdjustments(contest.id)
                : {};

            if (isTwitterTextImage) {
              const { data: metrics } = await supabase
                .from("twitter_campaign_metrics")
                .select("total_participants, max_participants")
                .eq("contest_id", contest.id)
                .maybeSingle();

              if (metrics) {
                updatedContest.twitter_participants_count =
                  metrics.total_participants || 0;
                updatedContest.twitter_max_participants =
                  metrics.max_participants;
              } else {
                updatedContest.twitter_participants_count = 0;
                updatedContest.twitter_max_participants = null;
              }
            }

            if (
              contest.contest_type === "leaderboard" &&
              contest.contest_based_details?.leaderboard_contest?.total_budget >
                0 &&
              contest.contest_based_details?.leaderboard_contest
                ?.flat_fee_bonus > 0
            ) {
              let leaderboardSubmissions: Submission[] = [];

              if (isTwitterTextImage) {
                const { data: twitterTweets } = await supabase
                  .from("twitter_campaign_tweets")
                  .select("id, creator_id, tweet_created_at, moderation_status")
                  .eq("contest_id", contest.id)
                  .eq("is_eligible", true)
                  .in("moderation_status", ["verified", "paid"]);

                leaderboardSubmissions = (twitterTweets || [])
                  .filter((tweet) => tweet.creator_id)
                  .map((tweet) => ({
                    id: tweet.id,
                    creator_id: tweet.creator_id,
                    created_at:
                      tweet.tweet_created_at || new Date().toISOString(),
                    status: tweet.moderation_status,
                    paid: tweet.moderation_status === "paid",
                    earnings: null,
                    bonus_paid: false,
                    platform: "twitter",
                  }));
              } else {
                const { data: submissions } = await supabase
                  .from("submissions")
                  .select(
                    "paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views"
                  )
                  .eq("contest_id", contest.id)
                  .in("status", ["verified", "paid"]);

                leaderboardSubmissions = (submissions || []) as Submission[];
              }

              const actualBudgetSpent = calculateLeaderboardBudgetSpent(
                leaderboardSubmissions,
                contest.contest_based_details.leaderboard_contest.flat_fee_bonus
              );

              updatedContest = {
                ...updatedContest,
                contest_based_details: {
                  ...updatedContest.contest_based_details,
                  leaderboard_contest: {
                    ...updatedContest.contest_based_details.leaderboard_contest,
                    budget_spent: Math.round(actualBudgetSpent * 100),
                  },
                },
              };
            } else if (
              contest.contest_type === "cpm" &&
              contest.platform === "twitter" &&
              contest.contest_based_details?.cpm_contest?.cpm_rate_usd > 0
            ) {
              const { data: twitterTweets } = await supabase
                .from("twitter_campaign_tweets")
                .select(
                  "id, creator_id, tweet_created_at, points, moderation_status, manual_points_adjustment"
                )
                .eq("contest_id", contest.id)
                .in("moderation_status", ["verified", "paid"]);

              const submissions =
                twitterTweets?.map((tweet) => ({
                  id: tweet.id,
                  creator_id: tweet.creator_id,
                  created_at: tweet.tweet_created_at,
                  platform: "twitter",
                  status: tweet.moderation_status,
                  paid: tweet.moderation_status === "paid",
                  earnings: null,
                  bonus_paid: false,
                  bonus_amount: 0,
                  other_stats: {
                    base_points: tweet.points || 0,
                    manual_points_adjustment:
                      tweet.manual_points_adjustment || 0,
                  },
                  manual_points_adjustment: tweet.manual_points_adjustment || 0,
                  views: 0,
                })) || [];

              const cpmDetails = contest.contest_based_details.cpm_contest;

              const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
                submissions,
                cpmDetails.cpm_rate_usd,
                cpmDetails.max_earnings_per_creator,
                cpmDetails.min_views,
                cpmDetails.max_views,
                cpmDetails.flat_fee_bonus || 0,
                cpmDetails.flat_fee_bonus_cap || null,
                manualAdjustmentMap
              );

              updatedContest = {
                ...updatedContest,
                contest_based_details: {
                  ...updatedContest.contest_based_details,
                  cpm_contest: {
                    ...updatedContest.contest_based_details.cpm_contest,
                    budget_spent: Math.round(actualBudgetSpent * 100),
                  },
                },
              };
            } else if (
              contest.contest_type === "cpm" &&
              contest.contest_based_details?.cpm_contest?.cpm_rate_usd > 0 &&
              !["twitter", "x"].includes((contest.platform || "").toLowerCase())
            ) {
              const { data: submissions } = await supabase
                .from("submissions")
                .select(
                  "id, creator_id, created_at, status, paid, earnings, views, platform, other_stats"
                )
                .eq("contest_id", contest.id)
                .in("status", ["verified", "paid"])
                .order("created_at", { ascending: true });

              const submissionRecords = (submissions || []).map(
                (submission) => ({
                  id: submission.id,
                  creator_id: submission.creator_id,
                  created_at: submission.created_at,
                  status: submission.status,
                  paid: submission.paid,
                  earnings: submission.earnings,
                  views: submission.views,
                  platform: submission.platform,
                  other_stats: submission.other_stats,
                  manual_points_adjustment: 0,
                  bonus_paid: submission.paid ?? false,
                  bonus_amount: submission.earnings ?? 0,
                })
              );

              const cpmDetails = contest.contest_based_details.cpm_contest;

              const actualBudgetSpent = calculateTwitterCpmBudgetSpent(
                submissionRecords,
                cpmDetails.cpm_rate_usd,
                contest.max_earnings_per_creator ||
                  cpmDetails.max_earnings_per_creator,
                cpmDetails.min_views,
                cpmDetails.max_views,
                cpmDetails.flat_fee_bonus || 0,
                cpmDetails.flat_fee_bonus_cap || null,
                manualAdjustmentMap
              );

              updatedContest = {
                ...updatedContest,
                contest_based_details: {
                  ...updatedContest.contest_based_details,
                  cpm_contest: {
                    ...updatedContest.contest_based_details.cpm_contest,
                    budget_spent: Math.round(actualBudgetSpent * 100),
                  },
                },
              };
            }

            return updatedContest;
          })
        );

        const regionFilteredContests = contestsWithCalculatedBudgets.filter(
          (contest) => {
            if (userCountries.length === 0) {
              return true;
            }
            if (!contest.region || Object.keys(contest.region).length === 0) {
              return true;
            }
            return userCountries.some((country: string) =>
              isCountryInContestRegions(country, contest.region)
            );
          }
        );

        const demoTwitterContest = {
          id: "demo-twitter-campaign",
          title: "Demo Twitter Campaign",
          platform: "twitter",
          status: "active",
          thumbnail_url: null,
          contest_type: "cpm",
          contest_based_details: {
            cpm_contest: {
              cpm_rate_usd: 5,
              total_budget: 50000,
              budget_spent: 0,
              flat_fee_bonus: 0,
            },
            leaderboard_contest: null,
          },
          live_submission_count: 0,
          categories: [],
          subcategories: {},
          interests: [],
          bonus_details: null,
          region: {},
          multiple_submissions_enabled: false,
          max_submissions_per_creator: 1,
          start_date: "2025-01-01T09:00:00.000Z",
          end_date: "2025-01-31T23:59:59.000Z",
          post_contest_status: null,
          is_demo: true,
        } as any;

        const contestsWithDemo = [
          demoTwitterContest,
          ...regionFilteredContests,
        ];
        setAvailableContests(contestsWithDemo);
      }
    } catch (error) {
      console.error("Unexpected error in fetchData:", error);
      setAvailableContests([]);
    } finally {
      setIsFetchingData(false);
    }
  }, [user, router, supabase]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchOpportunities();
    };

    window.addEventListener("contests:refresh", handleRefresh);
    return () => {
      window.removeEventListener("contests:refresh", handleRefresh);
    };
  }, [fetchOpportunities]);

  // Calculate relevance score for a contest
  const calculateRelevanceScore = (contest: any): number => {
    let score = 0;

    const contestCategories = Array.isArray(contest.categories)
      ? contest.categories
      : [];
    const contestSubcategories =
      typeof contest.subcategories === "object" &&
      contest.subcategories !== null
        ? (contest.subcategories as Record<string, string[]>)
        : {};
    const contestInterests = Array.isArray(contest.interests)
      ? contest.interests
      : [];

    // Check if contest has preferences set
    const contestHasPreferences =
      contestCategories.length > 0 ||
      Object.keys(contestSubcategories).length > 0 ||
      contestInterests.length > 0;

    // Check if creator has preferences set
    const creatorHasPreferences =
      creatorCategories.length > 0 ||
      Object.keys(creatorSubcategories).length > 0 ||
      creatorInterests.length > 0;

    // If creator has no preferences set, show all contests with score 0
    // (they will be sorted by other criteria, not relevance)
    if (!creatorHasPreferences) {
      return 0;
    }

    // Creator has preferences - only calculate score based on actual matches
    // If contest has no preferences, return 0 (no match possible)
    if (!contestHasPreferences) {
      return 0;
    }

    // Calculate match score based on actual matches
    if (creatorCategories.length > 0 && contestCategories.length > 0) {
      const matchingCategories = creatorCategories.filter((cat) =>
        contestCategories.includes(cat)
      );
      const M = matchingCategories.length;
      const N = contestCategories.length; // Use contest categories as denominator
      if (M > 0 && N > 0) {
        // Calculate proportional score: (M / N) * 60, rounded
        // If all contest categories match, get full 60 points
        const categoryScore = Math.round((M / N) * 60);
        score += categoryScore;
      }
    }

    // Sub-category match: proportional points based on contest requirements (M/contestSubcategories * 30, rounded)
    if (Object.keys(contestSubcategories).length > 0) {
      let totalContestSubcategories = 0;
      let matchingSubcategories = 0;

      // Calculate based on contest's subcategories, not user's
      for (const [category, contestSubcats] of Object.entries(
        contestSubcategories
      )) {
        totalContestSubcategories += contestSubcats.length;
        const creatorSubcats = creatorSubcategories[category] || [];
        const matchingSubcats = contestSubcats.filter((subcat) =>
          creatorSubcats.includes(subcat)
        );
        matchingSubcategories += matchingSubcats.length;
      }

      if (matchingSubcategories > 0 && totalContestSubcategories > 0) {
        // Calculate proportional score: (M / N) * 30, rounded
        // If all contest subcategories match, get full 30 points
        const subcategoryScore = Math.round(
          (matchingSubcategories / totalContestSubcategories) * 30
        );
        score += subcategoryScore;
      }
    }

    // Interest match: proportional points based on contest requirements (M/contestInterests * 10, rounded)
    if (creatorInterests.length > 0 && contestInterests.length > 0) {
      const matchingInterests = creatorInterests.filter((interest) =>
        contestInterests.includes(interest)
      );
      const M = matchingInterests.length;
      const N = contestInterests.length; // Use contest interests as denominator
      if (M > 0 && N > 0) {
        // Calculate proportional score: (M / N) * 10, rounded
        // If all contest interests match, get full 10 points
        const interestScore = Math.round((M / N) * 10);
        score += interestScore;
      }
    }

    // Return score (will be 0 if no matches found)
    return score;
  };

  // Get match details for display
  const getMatchDetails = (contest: any) => {
    const score = calculateRelevanceScore(contest);
    const maxPossibleScore = 100; // Category (60) + Subcategory (30) + Interests (10 max)
    const percentage = Math.min((score / maxPossibleScore) * 100, 100);

    let matchLabel = "";
    let matchColor = "gray";

    const creatorHasPreferences =
      creatorCategories.length > 0 ||
      Object.keys(creatorSubcategories).length > 0 ||
      creatorInterests.length > 0;

    if (!creatorHasPreferences) {
      // Creator has no preferences - show as general
      matchLabel = "General";
      matchColor = "gray";
    } else {
      // Creator has preferences - show match quality based on score
      if (score >= 70) {
        matchLabel = "Perfect Match";
        matchColor = "green";
      } else if (score >= 50) {
        matchLabel = "Great Match";
        matchColor = "emerald";
      } else if (score >= 30) {
        matchLabel = "Good Match";
        matchColor = "yellow";
      } else if (score > 0) {
        matchLabel = "Partial Match";
        matchColor = "orange";
      } else {
        // Score is 0 - no matches found
        matchLabel = "";
        matchColor = "gray";
      }
    }

    return { score, percentage, matchLabel, matchColor };
  };

  // useEffect for filtering and sorting
  useEffect(() => {
    let contestsToDisplay = [...availableContests];

    // Search Filter - filter by title (case-insensitive)
    if (searchQuery.trim() !== "") {
      const searchTerm = searchQuery.trim().toLowerCase();
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        const title = contest.title?.toLowerCase() || "";
        return title.includes(searchTerm);
      });
    }

    // Status Filter - only for published contests with valid lifecycle status
    if (statusFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter((contest) => {
        // Only published contests should be visible, and they should have a valid status
        if (contest.moderation_status !== "published" || !contest.status)
          return false;
        if (statusFilter === "live") return contest.status === "active";
        if (statusFilter === "upcoming") return contest.status === "upcoming";
        if (statusFilter === "completed")
          return contest.post_contest_status === "payouts_processed";
        return true; // Should not happen if logic is correct
      });
    }

    // Media type based on contest content format
    // mediaType === "media" => show only contests with content_format === "video"
    // mediaType === "text"  => show only contests with content_format === "text_image"
    contestsToDisplay = contestsToDisplay.filter((contest) => {
      const format = contest.contest_format;

      if (mediaType === "media") {
        if (format !== "video") return false;
      } else if (mediaType === "text") {
        if (format !== "text_image") return false;
      }

      return true;
    });

    // Platform Filter (applied on top of mediaType grouping)
    if (platformFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.platform?.toLowerCase() === platformFilter
      );
    }

    // Contest Type Filter
    if (typeFilter !== "all") {
      contestsToDisplay = contestsToDisplay.filter(
        (contest) => contest.contest_type === typeFilter
      );
    }

    // Filter out contests based on preferences matching
    const creatorHasPreferences =
      creatorCategories.length > 0 ||
      Object.keys(creatorSubcategories).length > 0 ||
      creatorInterests.length > 0;

    contestsToDisplay = contestsToDisplay.filter((contest) => {
      const contestCategories = Array.isArray(contest.categories)
        ? contest.categories
        : [];
      const contestSubcategories =
        typeof contest.subcategories === "object" &&
        contest.subcategories !== null
          ? (contest.subcategories as Record<string, string[]>)
          : {};
      const contestInterests = Array.isArray(contest.interests)
        ? contest.interests
        : [];

      // Check if contest has preferences set (categories, subcategories, or interests)
      const contestHasPreferences =
        contestCategories.length > 0 ||
        Object.keys(contestSubcategories).length > 0 ||
        contestInterests.length > 0;

      // If country is chosen and contest has preferences, check relevance score
      // If score is 0, exclude the contest
      if (userCountry && contestHasPreferences) {
        const relevanceScore = calculateRelevanceScore(contest);
        if (relevanceScore === 0) {
          return false; // Don't show contests with 0 relevance score when country is chosen
        }
      }

      // If creator has no preferences and contest has preferences, filter out
      if (!creatorHasPreferences && contestHasPreferences) {
        return false; // Don't show contests with preferences if creator hasn't set preferences
      }

      // If creator has preferences and contest has preferences, only show if score > 0
      if (creatorHasPreferences && contestHasPreferences) {
        const relevanceScore = calculateRelevanceScore(contest);
        // Don't show contests with 0 points if they have preferences set
        return relevanceScore > 0;
      }

      // If contest has no preferences, show it (normal behavior)
      // This covers: creator has preferences + contest has no preferences
      // and: creator has no preferences + contest has no preferences
      return true;
    });

    // Sorting
    contestsToDisplay.sort((a, b) => {
      switch (sortOption) {
        case "relevance_desc":
          const scoreA = calculateRelevanceScore(a);
          const scoreB = calculateRelevanceScore(b);
          // Sort by score descending (highest first)
          return scoreB - scoreA;
        case "start_date_desc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
        case "start_date_asc":
          if (!a.start_date) return 1; // push contests without start_date to the bottom
          if (!b.start_date) return -1;
          return (
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          );
        case "end_date_asc":
          if (!a.end_date) return 1; // push contests without end_date to the bottom
          if (!b.end_date) return -1;
          return (
            new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
          );
        case "end_date_desc":
          if (!a.end_date) return 1;
          if (!b.end_date) return -1;
          return (
            new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
          );
        case "value_desc":
        case "value_asc":
          let valueA = 0;
          let valueB = 0;
          if (
            a.contest_type === "leaderboard" &&
            a.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueA = a.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueA = a.contest_based_details.cpm_contest.total_budget; // Assuming budget is in cents
          }
          if (
            b.contest_type === "leaderboard" &&
            b.contest_based_details?.leaderboard_contest?.total_prize
          ) {
            valueB = b.contest_based_details.leaderboard_contest.total_prize;
          } else if (
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.total_budget
          ) {
            valueB = b.contest_based_details.cpm_contest.total_budget; // Assuming budget is in cents
          }
          if (sortOption === "value_desc") {
            return valueB - valueA;
          } else {
            return valueA - valueB;
          }
        case "cpm_rate_desc":
        case "cpm_rate_asc":
          const rateA =
            a.contest_type === "cpm" &&
            a.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? a.contest_based_details.cpm_contest.cpm_rate_usd
              : -1; // Use -1 to sort contests without CPM rate last
          const rateB =
            b.contest_type === "cpm" &&
            b.contest_based_details?.cpm_contest?.cpm_rate_usd
              ? b.contest_based_details.cpm_contest.cpm_rate_usd
              : -1;
          if (rateA === -1 && rateB === -1) return 0;
          if (rateA === -1) return 1; // a (no rate) comes after b (has rate)
          if (rateB === -1) return -1; // b (no rate) comes after a (has rate)
          return sortOption === "cpm_rate_desc" ? rateB - rateA : rateA - rateB;
        case "submissions_desc":
        case "submissions_asc":
          const countA = a.live_submission_count ?? -1; // Treat null/undefined as -1 to sort them last/first depending on order
          const countB = b.live_submission_count ?? -1;
          if (countA === -1 && countB === -1) return 0; // Both unknown, treat as equal
          if (countA === -1) return 1; // a (unknown) comes after b (known)
          if (countB === -1) return -1; // b (unknown) comes after a (known)
          return sortOption === "submissions_desc"
            ? countB - countA
            : countA - countB;
        default:
          return 0;
      }
    });

    setDisplayedContests(contestsToDisplay);
  }, [
    availableContests,
    statusFilter,
    platformFilter,
    typeFilter,
    sortOption,
    searchQuery,
    creatorCategories,
    creatorSubcategories,
    creatorInterests,
    userCountry,
    mediaType,
  ]);

  // Reset to first page whenever filters or sort change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, platformFilter, typeFilter, sortOption, searchQuery]);

  const total = displayedContests.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const paginatedContests = displayedContests.slice(
    (page - 1) * limit,
    page * limit
  );

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/opportunities/${id}`);
  };
  const resetFilters = () => {
    setPlatformFilter("all");
    setTypeFilter("all");
    setSortOption("relevance_desc");
    setSearchQuery("");
  };

  // Render list view item for opportunities
  const renderOpportunityListItem = (contest: any) => {
    return (
      <Card
        key={contest.id}
        className={cn(
          "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col sm:flex-row group w-full cursor-pointer relative",
          isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200"
        )}
        onClick={() => handleViewDetails(contest.id)}
      >
        {/* Status Badge - Top Right Corner */}
        {(contest.status === "active" ||
          contest.status === "upcoming" ||
          contest.status === "ended") && (
          <div className="absolute top-3 right-3 z-10 flex flex-row gap-2">
            <Badge
              className={cn(
                "capitalize text-sm px-3 py-1 font-medium border",
                contest.status === "active" && "bg-[#7F39EC] text-white",
                contest.status === "upcoming" && "bg-[#7F39EC] text-white",
                contest.status === "ended" && "bg-[#7F39EC] text-white"
              )}
            >
              {contest.status === "active"
                ? "Live"
                : contest.status === "upcoming"
                ? "Upcoming"
                : contest.status === "ended"
                ? "Ended"
                : contest.status || "Unknown"}
            </Badge>
            {contest.post_contest_status === "payouts_processed" && (
              <Badge className="font-medium capitalize text-sm px-3 py-1 border bg-[#7F39EC] text-white">
                Completed
              </Badge>
            )}
          </div>
        )}
        {/* Thumbnail */}
        <div className="w-full sm:w-64 md:w-80 lg:w-72 xl:w-96 sm:h-[200px] md:h-[220px] lg:h-[250px] min-h-[12rem] flex-shrink-0 flex items-center justify-center overflow-hidden relative">
          {contest.thumbnail_url ? (
            <img
              src={contest.thumbnail_url || "/placeholder.svg"}
              alt={contest.title || "Contest thumbnail"}
              className="w-full h-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-105"
            />
          ) : (
            <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-3 sm:p-4">
          <CardHeader className="p-0 pb-2">
            <CardTitle
              className="text-base sm:text-lg font-bold leading-tight mb-2"
              style={{
                color: isDark ? "white" : "#1e293b",
                transition: "none",
              }}
            >
              {contest.title || "Untitled Contest"}
            </CardTitle>
            {/* Badges */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Show campaign type badge (RAID/AWARENESS) for Twitter text_image contests */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  const campaignType =
                    contest.contest_based_details?.twitter_campaign
                      ?.campaign_type;
                  if (campaignType === "raid" || campaignType === "awareness") {
                    return (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-sm px-3 py-1 font-medium",
                          isDark
                            ? campaignType === "raid"
                              ? "bg-red-900/30 text-red-300 border-red-700/50"
                              : "bg-cyan-900/30 text-cyan-300 border-cyan-700/50"
                            : campaignType === "raid"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-cyan-50 text-cyan-700 border-cyan-200"
                        )}
                      >
                        {campaignType.toUpperCase()}
                      </Badge>
                    );
                  }
                  return null;
                }

                if (contest.multiple_submissions_enabled) {
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm px-3 py-1 font-medium",
                        isDark
                          ? "bg-purple-900/30 text-purple-300 border-purple-700/50"
                          : "bg-purple-50 text-purple-700 border-purple-200"
                      )}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      {(contest.max_submissions_per_creator ?? 1) > 1
                        ? `${contest.max_submissions_per_creator} Submissions`
                        : "Multiple Entries"}
                    </Badge>
                  );
                }
                return null;
              })()}
              {/* Content Type Badge - Don't show for Twitter text_image contests (we show campaign_type badge instead) */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  return null;
                }

                if (contest.content_type) {
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm px-3 py-1 font-medium",
                        isDark
                          ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {contest.content_type.toUpperCase()}
                    </Badge>
                  );
                }
                return null;
              })()}
              {(contest.contest_based_details?.cpm_contest?.flat_fee_bonus ||
                contest.contest_based_details?.leaderboard_contest
                  ?.flat_fee_bonus) && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm px-3 py-1 font-medium",
                    isDark
                      ? "bg-green-900/30 text-green-300 border-green-700/50"
                      : "bg-green-50 text-green-700 border-green-200"
                  )}
                >
                  <Gift className="h-3 w-3 mr-1" />
                  {formatMoney(
                    contest.contest_based_details?.cpm_contest
                      ?.flat_fee_bonus ||
                      contest.contest_based_details?.leaderboard_contest
                        ?.flat_fee_bonus ||
                      0
                  )}
                  /submission
                </Badge>
              )}
              {contest.bonus_details?.description_html && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-sm px-3 py-1 font-medium",
                    isDark
                      ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Bonus Available
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-2 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-2 text-resp">
              <div className="flex items-center">
                <div className="mr-2 flex-shrink-0">
                  {getPlatformIconWithFallback(contest.platform, "sm")}
                </div>
                <span
                  style={{
                    color: isDark ? "white" : "#475569",
                    transition: "none",
                  }}
                >
                  Platform:{" "}
                  <span className="font-medium">
                    {contest.platform || "N/A"}
                  </span>
                </span>
              </div>
              {contest.start_date && (
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span
                    style={{
                      color: isDark ? "white" : "#475569",
                      transition: "none",
                    }}
                  >
                    Starts:{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(contest.start_date, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {contest.end_date && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span
                    style={{
                      color: isDark ? "white" : "#475569",
                      transition: "none",
                    }}
                  >
                    Ends:{" "}
                    <span className="font-medium">
                      {formatLocalDateTime(contest.end_date, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              )}
              {/* For Twitter text_image contests, show participants instead of submissions */}
              {(() => {
                const isTwitterTextImage =
                  (contest.platform?.toLowerCase() === "twitter" ||
                    contest.platform?.toLowerCase() === "x") &&
                  contest.contest_format === "text_image";

                if (isTwitterTextImage) {
                  // For Twitter contests, show participants count if available
                  const participantsCount =
                    contest.twitter_participants_count ?? 0;
                  const maxParticipants = contest.twitter_max_participants;
                  const displayValue = maxParticipants
                    ? `${participantsCount} / ${maxParticipants}`
                    : participantsCount;

                  return (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Participants:{" "}
                        <span className="font-medium">{displayValue}</span>
                      </span>
                    </div>
                  );
                }

                // For non-Twitter contests, show submissions count
                if (
                  contest.live_submission_count !== null &&
                  contest.live_submission_count !== undefined
                ) {
                  return (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span
                        style={{
                          color: isDark ? "white" : "#475569",
                          transition: "none",
                        }}
                      >
                        Submissions:{" "}
                        <span className="font-medium">
                          {contest.live_submission_count}
                        </span>
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                const contestCategories = Array.isArray(contest.categories)
                  ? contest.categories
                  : [];
                const contestSubcategories =
                  typeof contest.subcategories === "object" &&
                  contest.subcategories !== null
                    ? (contest.subcategories as Record<string, string[]>)
                    : {};
                const contestInterests = Array.isArray(contest.interests)
                  ? contest.interests
                  : [];
                const contestHasPreferences =
                  contestCategories.length > 0 ||
                  Object.keys(contestSubcategories).length > 0 ||
                  contestInterests.length > 0;

                return contestHasPreferences ? (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      Relevance Score:{" "}
                      <span className="font-medium">
                        {calculateRelevanceScore(contest)}
                      </span>
                      {(() => {
                        const matchDetails = getMatchDetails(contest);
                        return matchDetails.matchLabel ? (
                          <span className="ml-1">
                            ({matchDetails.matchLabel})
                          </span>
                        ) : null;
                      })()}
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center">
                <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                <span
                  style={{
                    color: isDark ? "white" : "#475569",
                    transition: "none",
                  }}
                >
                  Contest Type:{" "}
                  <span className="font-medium">
                    {contest.contest_type === "cpm"
                      ? "CPM Based"
                      : contest.contest_type === "leaderboard"
                      ? "Leaderboard"
                      : contest.contest_type
                      ? contest.contest_type.charAt(0).toUpperCase() +
                        contest.contest_type.slice(1)
                      : "N/A"}
                  </span>
                </span>
              </div>
              {contest.contest_type === "cpm" &&
                contest.contest_based_details?.cpm_contest?.cpm_rate_usd !=
                  null && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      {contest.platform?.toLowerCase() === "twitter" ||
                      contest.platform?.toLowerCase() === "x"
                        ? "Points Rate: "
                        : "CPM Rate: "}
                      <span className="font-medium">
                        {formatMoney(
                          contest.contest_based_details.cpm_contest
                            .cpm_rate_usd * 100
                        )}{" "}
                        {contest.platform?.toLowerCase() === "twitter" ||
                        contest.platform?.toLowerCase() === "x"
                          ? "/ 1k points"
                          : "/ 1k views"}
                      </span>
                    </span>
                  </div>
                )}
              {contest.contest_type === "cpm" &&
                contest.contest_based_details?.cpm_contest?.total_budget !=
                  null &&
                contest.contest_based_details.cpm_contest.total_budget > 0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      Total Budget:{" "}
                      <span className="font-medium">
                        {formatMoney(
                          contest.contest_based_details.cpm_contest.total_budget
                        )}
                      </span>
                    </span>
                  </div>
                )}
              {contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest
                  ?.total_prize != null &&
                contest.contest_based_details.leaderboard_contest.total_prize >
                  0 && (
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      Total Prize Pool:{" "}
                      <span className="font-medium">
                        {formatMoney(
                          contest.contest_based_details.leaderboard_contest
                            .total_prize
                        )}
                      </span>
                    </span>
                  </div>
                )}
            </div>

            {/* Budget Spent Progress Bar for CPM contests */}
            {contest.contest_type === "cpm" &&
              contest.contest_based_details?.cpm_contest?.total_budget !=
                null &&
              contest.contest_based_details.cpm_contest.total_budget > 0 &&
              (() => {
                const totalBudget =
                  contest.contest_based_details.cpm_contest.total_budget;
                const budgetSpent =
                  contest.contest_based_details.cpm_contest.budget_spent || 0;
                const percentage = (budgetSpent / totalBudget) * 100;
                const remaining = totalBudget - budgetSpent;

                return (
                  <div className="mt-3">
                    <div
                      className="flex justify-between text-sm mb-2"
                      style={{
                        color: isDark ? "#d1d5db" : "#374151",
                        transition: "none",
                      }}
                    >
                      <span className="font-medium">Budget Tracker</span>
                      <span className="font-semibold">
                        {formatMoney(budgetSpent)} / {formatMoney(totalBudget)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden",
                        isDark ? "bg-[#FFFFFF42]" : "bg-slate-200"
                      )}
                    >
                      <div
                        className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                    <div
                      className="flex justify-between text-xs mt-1.5"
                      style={{
                        color: isDark ? "#d1d5db" : "#64748b",
                        transition: "none",
                      }}
                    >
                      <span>{percentage.toFixed(1)}% used</span>
                      <span>{formatMoney(remaining)} remaining</span>
                    </div>
                  </div>
                );
              })()}
          </CardContent>
        </div>

        {/* Third Column - View Details Button */}
        <div className="flex flex-col items-center justify-center gap-3 p-4 w-32 sm:w-40 flex-shrink-0">
          <button
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-3 rounded-full whitespace-nowrap",
              isDark
                ? "bg-[#7F39EC] text-white"
                : "bg-[#D9C0FF61] text-[#7F39EC]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleViewDetails(contest.id);
            }}
          >
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">View Details</span>
          </button>
        </div>
      </Card>
    );
  };

  if (isFetchingData) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        {/* <div className="text-center">
          <p>Loading opportunities...</p>
        </div> */}
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          You need to be logged in to view opportunities.
        </p>
      </div>
    );
  }

  // Block opportunities if guidelines not seen
  if (profile && profile.has_seen_guidelines === false) {
    return (
      <>
        <CreatorGuidelinesModal
          open={showGuidelines}
          onComplete={async () => {
            setShowGuidelines(false);
            // Update in DB
            await supabase
              .from("creator_profiles")
              .update({ has_seen_guidelines: true })
              .eq("id", user.id);
            setProfile({ ...profile, has_seen_guidelines: true });

            // Update cache
            const guidelinesCacheKey = `guidelines_${user.id}`;
            const guidelinesTimestampKey = `guidelines_timestamp_${user.id}`;
            localStorage.setItem(guidelinesCacheKey, "true");
            localStorage.setItem(guidelinesTimestampKey, Date.now().toString());
          }}
        />
        {/* Optionally, a blur or overlay can be added here to block interaction */}
      </>
    );
  }
  const isDark = mode === "dark";
  return (
    <div className="w-full no-theme-transition">
      <div className="mb-6">
        {/* Heading Row - Heading on left, buttons on right */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">Opportunities</h1>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://youtu.be/KrtpC2DB9zk?si=2OOUFF1803HDiC6N"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-3 py-1.5 rounded-full transition-colors text-sm",
                isDark
                  ? "text-white border-gray-600"
                  : "text-[#7F39EC] border-[#7F39EC] bg-[#D9C0FF26]  hover:bg-[#D9C0FF61]"
              )}
            >
              <Play className="h-3.5 w-3.5" />
              How it works
            </a>
            <Link
              href="/dashboard/getting-started"
              className={cn(
                "inline-flex items-center justify-center gap-2 border px-3 py-1.5 rounded-full transition-colors text-sm",
                isDark
                  ? "text-white border-gray-600"
                  : "text-[#7F39EC] border-[#7F39EC] bg-[#D9C0FF26]  hover:bg-[#D9C0FF61]"
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Learn how to participate
            </Link>
          </div>
        </div>
        {/* Search and View Toggle Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Search Input - Left Side */}
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Input
              type="text"
              placeholder="Search opportunities by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-10 border w-full",
                searchQuery && "pr-10",
                isDark
                  ? "border-gray-500 bg-[#020817] text-white"
                  : "border-gray-400 text-black"
              )}
            />
          </div>
          {/* View Toggle Buttons - Right Side */}
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 border border-gray-400 rounded-md p-1">
              <button
                onClick={() => setMediaType("text")}
                className={cn(
                  "flex items-center px-3 py-2 rounded transition-colors text-sm font-medium",
                  mediaType === "text"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Text/Image Opportunities"
              >
                <FileType className="h-4 w-4 mr-2" />
                <span>Text/Image</span>
                <span className="flex sm:hidden lg:flex ml-1">
                  Opportunities
                </span>
              </button>
              <button
                onClick={() => setMediaType("media")}
                className={cn(
                  "flex items-center px-3 py-2 rounded transition-colors text-sm font-medium",
                  mediaType === "media"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Video Opportunities"
              >
                <Film className="h-4 w-4 mr-2" />
                <span>Video</span>
                <span className="flex sm:hidden lg:flex ml-1">
                  Opportunities
                </span>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-1 border border-gray-400 rounded-md p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center px-3 py-2 rounded transition-colors text-sm font-medium",
                  viewMode === "grid"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                <span>Grid</span>
                <span className="flex sm:hidden lg:flex ml-1">View</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center px-3 py-2 rounded transition-colors text-sm font-medium",
                  viewMode === "list"
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#7F39EC] text-white"
                    : isDark
                    ? "text-gray-300 hover:text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
                title="List View"
              >
                <List className="h-4 w-4 mr-2" />
                <span>List</span>
                <span className="flex sm:hidden lg:flex ml-1">View</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <EnhancedTabs
        tabs={tabs.map((tab) => ({
          ...tab,
          label: (
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-1 sm:gap-2 text-center">
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 sm:ml-2 px-2 py-0.5 text-xs sm:text-sm text-gray-700 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground",
                    isDark ? "text-gray-300" : "text-gray-600 bg-gray-200"
                  )}
                >
                  {tab.count}
                </Badge>
              )}
            </div>
          ),
        }))}
        activeTab={statusFilter}
        isDark={isDark}
        light={!isDark}
        onTabChange={(value) => setStatusFilter(value as StatusFilterType)}
        className="mt-6 mb-8 w-full overflow-x-auto scrollbar-hide"
      />

      {/* Enhanced Status Filter Tabs with better visual distinction */}
      {/* <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterType)} className="mb-8">
        <TabsList>
          <TabsTrigger value="all">
            All <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">{availableContests.filter(c => c.moderation_status === 'published' && c.status).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="live">
            Live <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">{availableContests.filter(c => c.moderation_status === 'published' && c.status === 'active').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">{availableContests.filter(c => c.moderation_status === 'published' && c.status === 'upcoming').length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">{availableContests.filter(c => c.moderation_status === 'published' && c.post_contest_status === 'payouts_processed').length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs> */}

      {/* Enhanced Filter and Sort Select Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Platform Filter */}
        <Select
          value={platformFilter}
          onValueChange={(value) =>
            setPlatformFilter(value as PlatformFilterType)
          }
        >
          <SelectTrigger
            className={cn(
              "border font-medium",
              isDark ? "border-gray-600" : "border-gray-400"
            )}
          >
            <SelectValue placeholder="Filter by Platform" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem value="all" isDark={isDark}>
              All Platforms
            </SelectItem>

            {mediaType == "media" && (
              <SelectItem value="youtube" isDark={isDark}>
                YouTube
              </SelectItem>
            )}
            {mediaType == "media" && (
              <SelectItem value="instagram" isDark={isDark}>
                Instagram
              </SelectItem>
            )}
            {mediaType == "text" && (
              <SelectItem value="twitter" isDark={isDark}>
                Twitter
              </SelectItem>
            )}

            {/* Add more platforms as needed */}
          </SelectContent>
        </Select>

        {/* Contest Type Filter */}
        <Select
          value={typeFilter}
          onValueChange={(value) =>
            setTypeFilter(value as ContestTypeFilterType)
          }
        >
          <SelectTrigger
            className={cn(
              "border font-medium",
              isDark ? "border-gray-600" : "border-gray-400"
            )}
          >
            <SelectValue placeholder="Filter by Type" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem value="all" isDark={isDark}>
              All Contest Types
            </SelectItem>
            <SelectItem value="leaderboard" isDark={isDark}>
              Leaderboard
            </SelectItem>
            {mediaType == "media" && (
              <SelectItem value="cpm" isDark={isDark}>
                CPM
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Sort By */}
        <Select
          value={sortOption}
          onValueChange={(value) => setSortOption(value as SortOptionType)}
        >
          <SelectTrigger
            className={cn(
              "border font-medium",
              isDark ? "border-gray-600" : "border-gray-400"
            )}
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem value="relevance_desc" isDark={isDark}>
              Relevance: Highest to Lowest
            </SelectItem>
            <SelectItem value="start_date_asc" isDark={isDark}>
              Start Date: Soonest First
            </SelectItem>
            <SelectItem value="start_date_desc" isDark={isDark}>
              Start Date: Furthest First
            </SelectItem>
            <SelectItem value="end_date_asc" isDark={isDark}>
              End Date: Soonest First
            </SelectItem>
            <SelectItem value="end_date_desc" isDark={isDark}>
              End Date: Furthest First
            </SelectItem>
            <SelectItem value="value_desc" isDark={isDark}>
              Prize/Budget: High to Low
            </SelectItem>
            <SelectItem value="value_asc" isDark={isDark}>
              Prize/Budget: Low to High
            </SelectItem>
            <SelectItem value="cpm_rate_desc" isDark={isDark}>
              CPM Rate: High to Low
            </SelectItem>
            <SelectItem value="cpm_rate_asc" isDark={isDark}>
              CPM Rate: Low to High
            </SelectItem>
            <SelectItem value="submissions_desc" isDark={isDark}>
              Submissions: High to Low
            </SelectItem>
            <SelectItem value="submissions_asc" isDark={isDark}>
              Submissions: Low to High
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedContests && paginatedContests.length > 0 ? (
              paginatedContests.map((contest) => (
                <Card
                  key={contest.id}
                  onClick={() => handleViewDetails(contest.id)}
                  className={cn(
                    "overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out border flex flex-col group w-full cursor-pointer",
                    isDark
                      ? "bg-[#06021D] border-slate-700"
                      : "bg-white border-slate-200"
                  )}
                >
                  <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                    {contest.thumbnail_url ? (
                      <img
                        src={contest.thumbnail_url || "/placeholder.svg"}
                        alt={contest.title}
                        className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      />
                    ) : (
                      <Trophy className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                    )}
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Badge
                        className={cn(
                          "capitalize text-sm px-3 py-1 font-medium border",
                          contest.status === "active" &&
                            "bg-[#7F39EC] text-white",
                          contest.status === "upcoming" &&
                            "bg-[#7F39EC] text-white",
                          contest.status === "ended" &&
                            "bg-[#7F39EC] text-white",
                          !["active", "upcoming", "ended"].includes(
                            contest.status
                          ) && "bg-[#7F39EC] text-white"
                        )}
                      >
                        {contest.status === "active" ? "Live" : contest.status}
                      </Badge>
                      {contest.post_contest_status === "payouts_processed" && (
                        <Badge className="font-medium capitalize text-sm px-3 py-1 border bg-[#7F39EC] text-white">
                          Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle
                        className="text-lg font-bold leading-tight flex-1"
                        style={{
                          color: isDark ? "white" : "#1e293b",
                          transition: "none",
                        }}
                      >
                        {contest.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between">
                    <div
                      className="space-y-2.5 text-md mb-3"
                      style={{
                        color: isDark ? "white" : "#475569",
                        transition: "none",
                      }}
                    >
                      {/* New Features Indicators */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {/* Show campaign type badge (RAID/AWARENESS) for Twitter text_image contests */}
                        {(() => {
                          const isTwitterTextImage =
                            (contest.platform?.toLowerCase() === "twitter" ||
                              contest.platform?.toLowerCase() === "x") &&
                            contest.contest_format === "text_image";

                          if (isTwitterTextImage) {
                            const campaignType =
                              contest.contest_based_details?.twitter_campaign
                                ?.campaign_type;
                            if (
                              campaignType === "raid" ||
                              campaignType === "awareness"
                            ) {
                              return (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[12px]",
                                    isDark
                                      ? campaignType === "raid"
                                        ? "bg-red-900/30 text-red-300 border-red-700/50"
                                        : "bg-cyan-900/30 text-cyan-300 border-cyan-700/50"
                                      : campaignType === "raid"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-cyan-50 text-cyan-700 border-cyan-200"
                                  )}
                                >
                                  {campaignType.toUpperCase()}
                                </Badge>
                              );
                            }
                            return null;
                          }

                          if (contest.multiple_submissions_enabled) {
                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[12px]",
                                  isDark
                                    ? "bg-purple-900/30 text-purple-300 border-purple-700/50"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                )}
                              >
                                <CheckCheck className="h-3 w-3 mr-1" />
                                {contest.max_submissions_per_creator > 1
                                  ? `${contest.max_submissions_per_creator} Submissions`
                                  : "Multiple Entries"}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        {(contest.contest_based_details?.cpm_contest
                          ?.flat_fee_bonus ||
                          contest.contest_based_details?.leaderboard_contest
                            ?.flat_fee_bonus) && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[12px]",
                              isDark
                                ? "bg-green-900/30 text-green-300 border-green-700/50"
                                : "bg-green-50 text-green-700 border-green-200"
                            )}
                          >
                            <Gift className="h-3 w-3 mr-1" />
                            {formatMoney(
                              contest.contest_based_details?.cpm_contest
                                ?.flat_fee_bonus ||
                                contest.contest_based_details
                                  ?.leaderboard_contest?.flat_fee_bonus ||
                                0
                            )}
                            /submission
                          </Badge>
                        )}
                        {/* Content Type Badge - Don't show for Twitter text_image contests (we show campaign_type badge instead) */}
                        {(() => {
                          const isTwitterTextImage =
                            (contest.platform?.toLowerCase() === "twitter" ||
                              contest.platform?.toLowerCase() === "x") &&
                            contest.contest_format === "text_image";

                          if (isTwitterTextImage) {
                            return null;
                          }

                          if (contest.content_type) {
                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[12px]",
                                  isDark
                                    ? "bg-blue-900/30 text-blue-300 border-blue-700/50"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                <Tag className="h-3 w-3 mr-1" />
                                {contest.content_type.toUpperCase()}
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                        {contest.bonus_details?.description_html && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[12px]",
                              isDark
                                ? "bg-amber-900/30 text-amber-300 border-amber-700/50"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            Bonus Available
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center">
                        <div className="mr-2 flex-shrink-0">
                          {getPlatformIconWithFallback(contest.platform, "sm")}
                        </div>
                        <span>
                          Platform:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              isDark ? "text-white" : "text-slate-700"
                            )}
                          >
                            {contest.platform || "N/A"}
                          </span>
                        </span>
                      </div>
                      {contest.start_date && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>
                            Starts:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                isDark ? "text-white" : "text-slate-700"
                              )}
                            >
                              {formatLocalDateTime(contest.start_date, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </div>
                      )}
                      {contest.end_date && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>
                            Ends:{" "}
                            <span
                              className={cn(
                                "font-medium",
                                isDark ? "text-white" : "text-slate-700"
                              )}
                            >
                              {formatLocalDateTime(contest.end_date, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </div>
                      )}
                      {/* For Twitter text_image contests, show participants instead of submissions */}
                      {(() => {
                        const isTwitterTextImage =
                          (contest.platform?.toLowerCase() === "twitter" ||
                            contest.platform?.toLowerCase() === "x") &&
                          contest.contest_format === "text_image";

                        if (isTwitterTextImage) {
                          // For Twitter contests, show participants count if available
                          const participantsCount =
                            contest.twitter_participants_count ?? 0;
                          const maxParticipants =
                            contest.twitter_max_participants;
                          const displayValue = maxParticipants
                            ? `${participantsCount} / ${maxParticipants}`
                            : participantsCount;

                          return (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>
                                Participants:{" "}
                                <span
                                  className={cn(
                                    "font-medium",
                                    isDark ? "text-white" : "text-slate-700"
                                  )}
                                >
                                  {displayValue}
                                </span>
                              </span>
                            </div>
                          );
                        }

                        // For non-Twitter contests, show submissions count
                        if (
                          contest.live_submission_count !== null &&
                          contest.live_submission_count !== undefined
                        ) {
                          return (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>
                                Submissions:{" "}
                                <span
                                  className={cn(
                                    "font-medium",
                                    isDark ? "text-white" : "text-slate-700"
                                  )}
                                >
                                  {contest.live_submission_count}
                                </span>
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {(() => {
                        const contestCategories = Array.isArray(
                          contest.categories
                        )
                          ? contest.categories
                          : [];
                        const contestSubcategories =
                          typeof contest.subcategories === "object" &&
                          contest.subcategories !== null
                            ? (contest.subcategories as Record<
                                string,
                                string[]
                              >)
                            : {};
                        const contestInterests = Array.isArray(
                          contest.interests
                        )
                          ? contest.interests
                          : [];
                        const contestHasPreferences =
                          contestCategories.length > 0 ||
                          Object.keys(contestSubcategories).length > 0 ||
                          contestInterests.length > 0;

                        return contestHasPreferences ? (
                          <div className="flex items-center">
                            <Star className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                              Relevance Score:{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isDark ? "text-white" : "text-slate-700"
                                )}
                              >
                                {calculateRelevanceScore(contest)}
                              </span>
                              {(() => {
                                const matchDetails = getMatchDetails(contest);
                                return matchDetails.matchLabel ? (
                                  <span className="ml-1">
                                    ({matchDetails.matchLabel})
                                  </span>
                                ) : null;
                              })()}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      <div className="flex items-center">
                        <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>
                          Contest Type:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              isDark ? "text-white" : "text-slate-700"
                            )}
                          >
                            {contest.contest_type === "cpm"
                              ? "CPM Based"
                              : contest.contest_type === "leaderboard"
                              ? "Leaderboard"
                              : contest.contest_type
                              ? contest.contest_type.charAt(0).toUpperCase() +
                                contest.contest_type.slice(1)
                              : "N/A"}
                          </span>
                        </span>
                      </div>
                      {contest.contest_type === "cpm" &&
                        contest.contest_based_details?.cpm_contest
                          ?.cpm_rate_usd != null && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                              {contest.platform?.toLowerCase() === "twitter" ||
                              contest.platform?.toLowerCase() === "x"
                                ? "Points Rate: "
                                : "CPM Rate: "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isDark ? "text-white" : "text-slate-700"
                                )}
                              >
                                {formatMoney(
                                  contest.contest_based_details.cpm_contest
                                    .cpm_rate_usd * 100
                                )}{" "}
                                {contest.platform?.toLowerCase() ===
                                  "twitter" ||
                                contest.platform?.toLowerCase() === "x"
                                  ? "/ 1k points"
                                  : "/ 1k views"}
                              </span>
                            </span>
                          </div>
                        )}
                      {contest.contest_type === "cpm" &&
                        contest.contest_based_details?.cpm_contest
                          ?.total_budget != null &&
                        contest.contest_based_details.cpm_contest.total_budget >
                          0 && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                              Total Budget:{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isDark ? "text-white" : "text-slate-700"
                                )}
                              >
                                {formatMoney(
                                  contest.contest_based_details.cpm_contest
                                    .total_budget
                                )}
                              </span>
                            </span>
                          </div>
                        )}
                      {contest.contest_type === "leaderboard" &&
                        contest.contest_based_details?.leaderboard_contest
                          ?.total_prize != null &&
                        contest.contest_based_details.leaderboard_contest
                          .total_prize > 0 && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                              Total Prize Pool:{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isDark ? "text-white" : "text-slate-700"
                                )}
                              >
                                {formatMoney(
                                  contest.contest_based_details
                                    .leaderboard_contest.total_prize
                                )}
                              </span>
                            </span>
                          </div>
                        )}
                      {contest.contest_type === "leaderboard" &&
                        contest.contest_based_details?.leaderboard_contest
                          ?.total_budget != null &&
                        contest.contest_based_details.leaderboard_contest
                          .total_budget > 0 && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 flex-shrink-0 text-green-600" />
                            <span>
                              Total Bonus Budget:{" "}
                              <span
                                className={cn(
                                  "font-medium",
                                  isDark ? "text-white" : "text-green-600"
                                )}
                              >
                                {formatMoney(
                                  contest.contest_based_details
                                    .leaderboard_contest.total_budget
                                )}
                              </span>
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Budget Spent Progress Bar for CPM contests */}
                    {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ?.total_budget != null &&
                      contest.contest_based_details.cpm_contest.total_budget >
                        0 &&
                      (() => {
                        const totalBudget =
                          contest.contest_based_details.cpm_contest
                            .total_budget;
                        // Use real-time updated budget_spent field
                        const budgetSpent =
                          contest.contest_based_details.cpm_contest
                            .budget_spent || 0;
                        const percentage = (budgetSpent / totalBudget) * 100;
                        const remaining = totalBudget - budgetSpent;

                        return (
                          <div className="mt-3 mb-3">
                            <div
                              className="flex justify-between text-sm mb-2"
                              style={{
                                color: isDark ? "#d1d5db" : "#374151",
                                transition: "none",
                              }}
                            >
                              <span className="font-medium">
                                Budget Tracker
                              </span>
                              <span className="font-semibold">
                                {formatMoney(budgetSpent)} /{" "}
                                {formatMoney(totalBudget)}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden",
                                isDark ? "bg-[#FFFFFF42]" : "bg-slate-200"
                              )}
                              title={`Total Budget Spent: ${formatMoney(
                                budgetSpent
                              )}`}
                            >
                              <div
                                className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                }}
                              ></div>
                            </div>
                            <div
                              className="flex justify-between text-xs mt-1.5"
                              style={{
                                color: isDark ? "#d1d5db" : "#64748b",
                                transition: "none",
                              }}
                            >
                              <span>{percentage.toFixed(1)}% used</span>
                              <span>{formatMoney(remaining)} remaining</span>
                            </div>
                          </div>
                        );
                      })()}

                    {/* Bonus Budget Tracker for Leaderboard contests */}
                    {contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                        ?.total_budget != null &&
                      contest.contest_based_details.leaderboard_contest
                        .total_budget > 0 &&
                      (() => {
                        const totalBudget =
                          contest.contest_based_details.leaderboard_contest
                            .total_budget;
                        const leaderboardBudgetSpent =
                          contest.contest_based_details.leaderboard_contest
                            .budget_spent || 0;
                        const tracker = getBudgetTrackerValues(
                          totalBudget,
                          leaderboardBudgetSpent
                        );
                        const percentage = tracker.percentage;
                        const remaining = tracker.remaining;

                        return (
                          <div className="mt-3 mb-3">
                            <div
                              className="flex justify-between text-sm mb-2"
                              style={{
                                color: isDark ? "#cbd5e1" : "#475569",
                                transition: "none",
                              }}
                            >
                              <span className="font-medium">
                                Flat Fee Bonus Budget Tracker
                              </span>
                              <span className="font-semibold">
                                {formatMoney(tracker.spent)} /{" "}
                                {formatMoney(totalBudget)}
                              </span>
                            </div>
                            <div
                              className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                              title={`Flat Fee Bonus Budget Spent: ${formatMoney(
                                tracker.spent
                              )}`}
                            >
                              <div
                                className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                                style={{
                                  width: `${Math.min(percentage, 100)}%`,
                                }}
                              ></div>
                            </div>
                            <div
                              className="flex justify-between text-xs mt-1.5"
                              style={{
                                color: isDark ? "#94a3b8" : "#64748b",
                                transition: "none",
                              }}
                            >
                              <span>{percentage.toFixed(1)}% used</span>
                              <span>{formatMoney(remaining)} remaining</span>
                            </div>
                          </div>
                        );
                      })()}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(contest.id);
                      }}
                      // size="sm"
                      // variant="white"

                      className="flex w-full items-center justify-center gap-2 px-3 py-3 rounded-full"
                      style={{
                        backgroundColor: isDark ? "#7F39EC" : "#D9C0FF61",
                        color: isDark ? "white" : "#7F39EC",
                        transition: "none",
                      }}
                    >
                      View Details
                    </button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py=-12">
                <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2
                  className="text-xl font-medium mb-2"
                  style={{
                    color: isDark ? "white" : "black",
                    transition: "none",
                  }}
                >
                  No contests match your criteria
                </h2>
                <p
                  className="mb-3"
                  style={{
                    color: isDark ? "#94a3b8" : "#64748b",
                    transition: "none",
                  }}
                >
                  Try adjusting your filters or check back later.
                </p>
                <Button
                  onClick={resetFilters}
                  className="mt-4 text-md"
                  style={{
                    backgroundColor: isDark ? "#7F39EC" : "#7F39EC",
                    color: "white",
                    transition: "none",
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {paginatedContests && paginatedContests.length > 0 ? (
              paginatedContests.map((contest) =>
                renderOpportunityListItem(contest)
              )
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h2
                  className="text-xl font-medium mb-2"
                  style={{
                    color: isDark ? "white" : "black",
                    transition: "none",
                  }}
                >
                  No contests match your criteria
                </h2>
                <p
                  className="mb-3"
                  style={{
                    color: isDark ? "#94a3b8" : "#64748b",
                    transition: "none",
                  }}
                >
                  Try adjusting your filters or check back later.
                </p>
                <Button
                  onClick={resetFilters}
                  className="mt-4 text-md"
                  style={{
                    backgroundColor: isDark ? "#7F39EC" : "#7F39EC",
                    color: "white",
                    transition: "none",
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}

        {total > 0 && (
          <div className="mt-2 flex flex-col gap-2 items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div
                className="text-sm"
                style={{
                  color: isDark ? "#cbd5e1" : "#4b5563",
                  transition: "none",
                }}
              >
                {(() => {
                  const startItem = (page - 1) * limit + 1;
                  const endItem = Math.min(page * limit, total);
                  return `Showing ${startItem}-${endItem} of ${total} opportunities`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-sm"
                  style={{
                    color: isDark ? "#cbd5e1" : "#4b5563",
                    transition: "none",
                  }}
                >
                  Show:
                </span>
                <Select
                  value={limit.toString()}
                  onValueChange={(value) => {
                    const newLimit = parseInt(value, 10);
                    setLimit(newLimit);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn("w-20", isDark && "border border-gray-600")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    isDark={isDark}
                    className={cn(
                      isDark && "border-gray-600 bg-[#07031D] text-white"
                    )}
                  >
                    {[9, 15, 21, 30].map((size) => (
                      <SelectItem
                        isDark={isDark}
                        key={size}
                        value={size.toString()}
                        className={cn(
                          isDark &&
                            "bg-[#07031D] text-white focus:bg-slate-800 data-[state=checked]:bg-slate-700"
                        )}
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span
                  className="text-sm"
                  style={{
                    color: isDark ? "#cbd5e1" : "#4b5563",
                    transition: "none",
                  }}
                >
                  per page
                </span>
              </div>
            </div>
            {totalPages > 1 && (
              <PaginationControls
                page={page}
                limit={limit}
                total={total}
                totalPages={totalPages}
                hasNextPage={hasNextPage}
                hasPreviousPage={hasPreviousPage}
                onPageChange={setPage}
                onLimitChange={setLimit}
                loading={false}
                isDark={isDark}
                showResultInfo={false}
                showPageSizeSelector={false}
                showEdgeButtons={false}
                showPrevNextButtons={true}
                pageSizeOptions={[9, 15, 21, 30]}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
