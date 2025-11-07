"use client";
import { useEffect, useState, useLayoutEffect } from "react";
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
  Star, Play, GraduationCap,
} from "lucide-react";
import { User, UserResponse } from "@supabase/supabase-js";
import { formatLocalDateTime } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { createClient } from "@/utils/supabase/client";
import {
  calculateLeaderboardBudgetSpent,
  Submission,
} from "@/lib/contest-utils-client";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreatorGuidelinesModal from "@/components/dashboard/CreatorGuidelinesModal";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import Link from "next/link";

// Define types for filters and sorting
type StatusFilterType = "all" | "live" | "upcoming" | "completed";
type PlatformFilterType = "all" | "youtube" | "instagram"; // Add more as needed
type ContestTypeFilterType = "all" | "leaderboard" | "cpm";
type SortOptionType =
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
  const router = useRouter();
  const supabase = createClient();

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

  const { activeTab, setActiveTab } = useTabState(tabs, { defaultTab: "all" });
  // New state variables for filters and sorting
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("all");
  const [platformFilter, setPlatformFilter] =
    useState<PlatformFilterType>("all");
  const [typeFilter, setTypeFilter] = useState<ContestTypeFilterType>("all");
  const [sortOption, setSortOption] =
    useState<SortOptionType>("start_date_desc");
  const [displayedContests, setDisplayedContests] = useState<any[]>([]);
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

  useEffect(() => {
    if (!user) {
      console.log(
        "OpportunitiesPage: No user found after auth load, redirecting to signin."
      );
      router.push("/");
      return;
    }

    async function fetchData(currentUser: User) {
      setIsFetchingData(true);

      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", currentUser.id)
          .single();

        if (userError) {
          console.error("Error fetching user type:", userError);
          setIsFetchingData(false);
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

        // Smart guidelines check with caching
        const guidelinesCacheKey = `guidelines_${currentUser.id}`;
        const guidelinesTimestampKey = `guidelines_timestamp_${currentUser.id}`;
        const cachedGuidelines = localStorage.getItem(guidelinesCacheKey);
        const cachedTimestamp = localStorage.getItem(guidelinesTimestampKey);

        // Check if cache is still valid (24 hours)
        const isCacheValid =
          cachedTimestamp &&
          Date.now() - parseInt(cachedTimestamp) < 24 * 60 * 60 * 1000;

        if (cachedGuidelines === "true" && isCacheValid) {
          // User has seen guidelines - no need to query database
          setProfile({ has_seen_guidelines: true });
          setHasCheckedGuidelines(true);
        } else if (cachedGuidelines === "false" && isCacheValid) {
          // User hasn't seen guidelines - show modal
          setProfile({ has_seen_guidelines: false });
          setShowGuidelines(true);
          setHasCheckedGuidelines(true);
        } else {
          // No cache - query database once
          const { data: creatorProfile, error: profileError } = await supabase
            .from("creator_profiles")
            .select("has_seen_guidelines")
            .eq("id", currentUser.id)
            .single();

          if (profileError) {
            console.error("Error fetching creator profile:", profileError);
            // Fallback: assume guidelines not seen
            setProfile({ has_seen_guidelines: false });
            setShowGuidelines(true);
          } else {
            setProfile(creatorProfile);
            // Cache the result with timestamp
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

        const { data: contests, error: contestError } = await supabase
          .from("contests_with_status")
          .select(
            `
            *,
            contest_based_details
          `
          )
          .eq("moderation_status", "published") // Only show published contests
          .not("status", "eq", "incomplete") // Exclude incomplete published contests
          .order("created_at", { ascending: false });

        if (contestError) {
          console.error("Error fetching contests:", contestError);
          setAvailableContests([]);
        } else {
          // For leaderboard contests, calculate actual budget spent from submissions (CPM now uses real-time budget_spent field)
          const contestsWithCalculatedBudgets = await Promise.all(
            (contests || []).map(async (contest) => {
              if (
                contest.contest_type === "leaderboard" &&
                contest.contest_based_details?.leaderboard_contest
                  ?.total_budget > 0 &&
                contest.contest_based_details?.leaderboard_contest
                  ?.flat_fee_bonus > 0
              ) {
                // Fetch submissions for this contest
                const { data: submissions } = await supabase
                  .from("submissions")
                  .select(
                    "paid, earnings, bonus_paid, bonus_amount, creator_id, created_at, status, views"
                  )
                  .eq("contest_id", contest.id)
                  .in("status", ["verified", "paid"]);

                // Calculate actual budget spent
                const actualBudgetSpent = calculateLeaderboardBudgetSpent(
                  submissions || [],
                  contest.contest_based_details.leaderboard_contest
                    .flat_fee_bonus
                );

                // Update the contest object with calculated budget spent
                return {
                  ...contest,
                  contest_based_details: {
                    ...contest.contest_based_details,
                    leaderboard_contest: {
                      ...contest.contest_based_details.leaderboard_contest,
                      budget_spent: Math.round(actualBudgetSpent * 100), // Convert to cents
                    },
                  },
                };
              }
              return contest;
            })
          );

          setAvailableContests(contestsWithCalculatedBudgets);
        }
      } catch (error) {
        console.error("Unexpected error in fetchData:", error);
        setAvailableContests([]);
      } finally {
        setIsFetchingData(false);
      }
    }

    fetchData(user);
  }, [user, router, supabase]);

  // useEffect for filtering and sorting
  useEffect(() => {
    let contestsToDisplay = [...availableContests];

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

    // Platform Filter
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

    // Sorting
    contestsToDisplay.sort((a, b) => {
      switch (sortOption) {
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
          return sortOption === "value_desc"
            ? valueB - valueA
            : valueA - valueB;
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
  }, [availableContests, statusFilter, platformFilter, typeFilter, sortOption]);

  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/opportunities/${id}`);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold">Opportunities</h1>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://youtu.be/KrtpC2DB9zk?si=2OOUFF1803HDiC6N"
            target="_blank"
            rel="noopener noreferrer"
          
            className={cn(
              "inline-flex items-center justify-center gap-2 border px-3 py-1.5 rounded-full transition-colors text-sm",
              isDark ? "text-white border-gray-600" : "text-[#7F39EC] border-[#7F39EC] bg-[#D9C0FF26]  hover:bg-[#D9C0FF61]"
            )}
          >
            <Play className="h-3.5 w-3.5" />
            How it works
          </a>
          <Link
            href="/dashboard/getting-started"
            className={cn(
              "inline-flex items-center justify-center gap-2 border px-3 py-1.5 rounded-full transition-colors text-sm",
              isDark ? "text-white border-gray-600" : "text-[#7F39EC] border-[#7F39EC] bg-[#D9C0FF26]  hover:bg-[#D9C0FF61]"
            )}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            Learn how to participate
          </Link>
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
        className="mt-10 mb-8 w-full overflow-x-auto scrollbar-hide"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
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
            <SelectItem value="youtube" isDark={isDark}>
              YouTube
            </SelectItem>
            <SelectItem value="instagram" isDark={isDark}>
              Instagram
            </SelectItem>
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
            <SelectItem value="cpm" isDark={isDark}>
              CPM
            </SelectItem>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedContests && displayedContests.length > 0 ? (
          displayedContests
            .map((contest) => (
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
                        contest.status === "ended" && "bg-[#7F39EC] text-white",
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
                  <CardTitle
                    className="text-lg font-bold mr-2 leading-tight"
                    style={{
                      color: isDark ? "white" : "#1e293b",
                      transition: "none",
                    }}
                  >
                    {contest.title}
                  </CardTitle>
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
                      {contest.multiple_submissions_enabled && (
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
                      )}
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
                              contest.contest_based_details?.leaderboard_contest
                                ?.flat_fee_bonus ||
                              0
                            )}
                            /submission
                          </Badge>
                        )}
                      {contest.content_type && (
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
                      )}
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
                    {contest.live_submission_count !== null &&
                      contest.live_submission_count !== undefined && (
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
                      )}
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
                            CPM Rate:{" "}
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
                              / 1k views
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
                    contest.contest_based_details?.cpm_contest?.total_budget !=
                    null &&
                    contest.contest_based_details.cpm_contest.total_budget >
                    0 &&
                    (() => {
                      const totalBudget =
                        contest.contest_based_details.cpm_contest.total_budget;
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
                            <span className="font-medium">Budget Tracker</span>
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
                      const budgetSpent =
                        contest.contest_based_details.leaderboard_contest
                          .budget_spent || 0;
                      const percentage = (budgetSpent / totalBudget) * 100;
                      const remaining = totalBudget - budgetSpent;

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
                              {formatMoney(budgetSpent)} /{" "}
                              {formatMoney(totalBudget)}
                            </span>
                          </div>
                          <div
                            className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden"
                            title={`Flat Fee Bonus Budget Spent: ${formatMoney(
                              budgetSpent
                            )}`}
                          >
                            <div
                              className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
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
            .slice(0, 50) // Limit to 50 contests for performance
        ) : (
          <div className="col-span-full text-center py-12">
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
              className="mb-4"
              style={{
                color: isDark ? "#94a3b8" : "#64748b",
                transition: "none",
              }}
            >
              Try adjusting your filters or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
