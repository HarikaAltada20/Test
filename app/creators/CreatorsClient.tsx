"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Target,
  Trophy,
  Camera,
  Eye,
  Wallet,
  DollarSign,
  Share2,
  TrendingUp,
  MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CtcBanner from "@/components/CtcBanner";
import Testimonials from "../../components/Testimonials";
import FAQ from "@/components/FAQ";
import { createClient } from "@/utils/supabase/client";
import { formatLocalDateTime } from "@/lib/utils";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
} from "@/lib/contest-type";
import { getPoolBudgetSpentCentsForDisplay } from "@/lib/contest-budget-tile-metrics";
import { cn } from "@/lib/utils";

// const creatorTestimonials = [
//   {
//     stars: 5,
//     quote:
//       "Finally, a platform that truly understands the creator economy. The opportunities are diverse, and the community is incredibly supportive.",
//     name: "Aisha Khan",
//     title: "Travel Vlogger & Influencer",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "As a new creator, Game Of Creators gave me the exposure I needed. I landed my first paid collaboration within a month of joining!",
//     name: "Chloe Dubois",
//     title: "Lifestyle Content Creator",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "The platform is intuitive, and the support team is always responsive. It made managing multiple brand deals so much simpler.",
//     name: "Kenji Tanaka",
//     title: "Gaming Streamer & YouTuber",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 4,
//     quote:
//       "Game Of Creators helped me turn my passion into a full-time income. The contest format pushes me to create my best work every time.",
//     name: "Marcus Rivera",
//     title: "Fitness Influencer & Coach",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "The quality of brands on this platform is incredible. I've worked with some amazing companies and built lasting relationships.",
//     name: "Sophie Williams",
//     title: "Beauty Content Creator",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "From zero followers to 100K in 8 months thanks to the exposure from brand collaborations. This platform changed my life!",
//     name: "Alex Thompson",
//     title: "Tech Reviewer & YouTuber",
//     avatar: "/images/avatar_placeholder.png",
//   },
// ];
const creatorsteps = [
  {
    number: "1",
    title: "Sign Up & Connect Social Media",
    description:
      "Simply sign up as a creator and connect your social media accounts (Instagram, YouTube, etc.) from which you want to participate in campaigns.",
    icon: <Users className="h-8 w-8" />,
    gradient: "from-violet-600 to-purple-600",
    color: "bg-[#7F39EC87] border-4 border-[#7F39EC]",
  },
  {
    number: "2",
    title: "Browse & Choose Campaigns",
    description:
      "Explore available campaigns from brands looking for creators. Filter opportunities based on prize pool, competition, end date, platform, and campaign type to find the best match for you.",
    icon: <Target className="h-8 w-8" />,
    gradient: "from-blue-600 to-indigo-600",
    color: "bg-[#444DE787] border-4 border-[#454DE5]",
  },
  {
    number: "3",
    title: "Create & Submit Content",
    description:
      "Once you've found the right campaign, create content that aligns with the brand's brief and follows the campaign rules. Post it on your social media, then submit the link through our platform.",
    icon: <Camera className="h-8 w-8" />,
    gradient: "from-amber-600 to-orange-600",
    color: "bg-[#E75D0D8F] border-4 border-[#E65D09]",
  },
  {
    number: "4",
    title: "Get Paid Based on Performance",
    description:
      "Earn money based on how your content performs. For Leaderboard campaigns, you get paid based on your rank (determined by views). For CPM campaigns, you get paid purely based on the views your content generates.",
    icon: <Trophy className="h-8 w-8" />,
    gradient: "from-emerald-600 to-teal-600",
    color: "bg-[#0C94825C] border-4 border-[#08947E]",
  },
];

const creatorEasySteps = [
  {
    title: "Find the right campaign",
    description:
      "Browse campaigns that match your content, interests, and style.",
  },
  {
    title: "Create video & publish",
    description:
      "Film your video, post it on your socials, and submit the link to the campaign.",
  },
  {
    title: "Track your performance",
    description:
      "Watch views, rankings, and earnings update live as your content performs.",
  },
  {
    title: "Get rewarded",
    description:
      "Get paid based on views or ranking — no follower count required.",
  },
] as const;

const easyCollageImages = [
  "/images/Frame 2147243801.png",
  "/images/Frame 2147243800.png",
] as const;

const images: string[] = [
  "/images/ce93873a8bcf3c08e216b5793f968f3722178789.avif",
  "/images/844d84fa7fc8646e15494703ec37e2d880bb59e5.avif",
  "/images/fb3e50b77241ebb8e7cd1813fae1eecbe92b7432.avif",
];

interface CreatorsClientProps {
  totalViews: number;
  totalMoneyCreditedCents: number;
  initialContests?: any[];
}

export default function CreatorsClient({
  totalViews: _totalViews,
  totalMoneyCreditedCents,
  initialContests = [],
}: CreatorsClientProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fade, setFade] = useState<boolean>(true);
  const [windowWidth, setWindowWidth] = useState<number>(0);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const animationRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const [howItWorksAnimated, setHowItWorksAnimated] = useState(false);

  const [contests, setContests] = useState<any[]>(initialContests);
  const [userType, setUserType] = useState<"creator" | "advertiser" | null>(
    null,
  );
  const [showAdvertiserModal, setShowAdvertiserModal] = useState(false);
  const [isCheckingStartEarning, setIsCheckingStartEarning] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingContestId, setNavigatingContestId] = useState<string | null>(
    null,
  );
  const [isNavigatingViewMore, setIsNavigatingViewMore] = useState(false);
  const [easyStep, setEasyStep] = useState(0);
  const [easyStepProgress, setEasyStepProgress] = useState(0);

  const handleNavigation = () => {
    setIsNavigating(true);
  };
  const router = useRouter();

  // Cache management for client-side fetching
  const fetchCacheRef = useRef<{
    lastFetch: number;
    isFetching: boolean;
  }>({
    lastFetch: 0,
    isFetching: false,
  });
  const CACHE_DURATION = 86400000; // 1 day cache on client side

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Section animation
            if (entry.target === sectionRef.current) {
              setAnimate(true);
              observerInstance.unobserve(entry.target);
            }

            // Animation block
            if (entry.target === animationRef.current) {
              setIsAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            // How it works section
            if (entry.target === howItWorksRef.current) {
              setHowItWorksAnimated(true);
              observerInstance.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.3 }, // Use lower threshold to ensure all trigger
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (animationRef.current) observer.observe(animationRef.current);
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
      if (animationRef.current) observer.unobserve(animationRef.current);
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Immediately change image index and set fade true
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setFade(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Auto-advance "As easy as you think" steps while section is in view
  useEffect(() => {
    if (!isAnimated) return;
    setEasyStepProgress(0);
    const tickMs = 50;
    const stepDurationMs = 4000;
    const interval = setInterval(() => {
      setEasyStepProgress((prev) => {
        const next = prev + tickMs / stepDurationMs;
        if (next >= 1) {
          setEasyStep((s) => (s + 1) % creatorEasySteps.length);
          return 0;
        }
        return next;
      });
    }, tickMs);
    return () => clearInterval(interval);
  }, [isAnimated, easyStep]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch contests function (reusable for both initial and polling)
  // Includes caching to prevent duplicate requests
  const fetchContests = useCallback(async () => {
    const now = Date.now();

    // Check if we're already fetching or if cache is still valid
    if (
      fetchCacheRef.current.isFetching ||
      now - fetchCacheRef.current.lastFetch < CACHE_DURATION
    ) {
      return;
    }

    // Mark as fetching
    fetchCacheRef.current.isFetching = true;
    fetchCacheRef.current.lastFetch = now;

    try {
      const supabase = createClient();

      const { data: contestsData, error } = await supabase
        .from("contests_with_status")
        .select(
          `
          *,
          contest_based_details
        `,
        )
        .eq("moderation_status", "published")
        .not("status", "eq", "incomplete")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching contests:", error);
        return;
      }

      if (contestsData) {
        setContests(contestsData);
      }
    } catch (error) {
      console.error("Error fetching contests:", error);
    } finally {
      // Mark as not fetching
      fetchCacheRef.current.isFetching = false;
    }
  }, []);

  // Initial fetch and automatic polling for contests
  useEffect(() => {
    // Initialize with server-fetched data if available
    if (initialContests.length > 0) {
      setContests(initialContests);
      // Set cache timestamp to prevent immediate refetch
      fetchCacheRef.current.lastFetch = Date.now();
    } else {
      // Fallback: fetch immediately if no initial data
      fetchContests();
    }

    // Set up automatic polling every 30 seconds to check for new contests
    // Cache prevents duplicate requests if called multiple times
    const pollInterval = setInterval(() => {
      fetchContests();
    }, 30000); // 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, [initialContests.length, fetchContests]);

  // Fetch user type to determine the "View More" link destination
  useEffect(() => {
    async function fetchUserType() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: userData } = await supabase
            .from("users")
            .select("user_type")
            .eq("id", user.id)
            .single();

          if (userData?.user_type) {
            setUserType(userData.user_type as "creator" | "advertiser");
          }
        }
      } catch (error) {
        console.error("Error fetching user type:", error);
      }
    }

    fetchUserType();
  }, []);

  const handleViewContest = (id: string) => {
    setNavigatingContestId(id);
    router.push(`/dashboard/opportunities/${id}`);
  };

  const handleViewMoreClick = () => {
    setIsNavigatingViewMore(true);
    router.push(getViewMoreLink());
  };

  // Get pathname for route change detection
  const pathname = usePathname();

  // Reset navigating contest ID when route changes
  useEffect(() => {
    setNavigatingContestId(null);
    setIsNavigatingViewMore(false);
  }, [pathname]);

  // Smooth-scroll to hash targets (navbar anchors)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // Get the "View More" link based on user type
  const getViewMoreLink = () => {
    if (userType === "advertiser") {
      return "/dashboard/contests";
    }
    // Default to opportunities for creators or logged out users
    return "/dashboard/opportunities";
  };

  const handleStartEarningClick = async () => {
    setIsCheckingStartEarning(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && user) {
        const { data: userData } = await supabase
          .from("users")
          .select("user_type")
          .eq("id", user.id)
          .single();

        if (userData?.user_type === "advertiser") {
          setShowAdvertiserModal(true);
          return;
        }
      }

      localStorage.setItem("signupRole", "creator");
      router.push("/auth/signup");
    } catch (error) {
      console.error(
        "Failed to verify account type before creator sign-up:",
        error,
      );
      localStorage.setItem("signupRole", "creator");
      router.push("/auth/signup");
    } finally {
      setIsCheckingStartEarning(false);
    }
  };

  const handleSignOutAndContinueCreator = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
      localStorage.setItem("signupRole", "creator");
      setShowAdvertiserModal(false);
      router.push("/auth/signup");
      router.refresh();
    } catch (error) {
      console.error(
        "Failed to sign out advertiser before creator sign-up:",
        error,
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleContinueAsAdvertiser = () => {
    setShowAdvertiserModal(false);
    router.push("/dashboard/contests");
  };

  // Helper function to get contests with live/upcoming priority, filling with ended if needed
  const getContestsWithFallback = (sourceContests: any[], limit: number) => {
    const liveFiltered = sourceContests.filter(
      (c) => c.status === "active" || c.status === "upcoming",
    );
    const endedFiltered = sourceContests.filter((c) => c.status === "ended");

    // If we have enough live/upcoming contests, use only those
    if (liveFiltered.length >= limit) {
      return liveFiltered.slice(0, limit);
    }

    // Otherwise, fill with live/upcoming first, then ended contests
    return [...liveFiltered, ...endedFiltered].slice(0, limit);
  };

  // Helper function to get both live and ended contests if live contests exist
  const getContestsWithLiveAndEnded = (
    sourceContests: any[],
    limit: number,
  ) => {
    const liveFiltered = sourceContests.filter(
      (c) => c.status === "active" || c.status === "upcoming",
    );
    const endedFiltered = sourceContests.filter((c) => c.status === "ended");

    // If there are live contests, include both live and ended
    if (liveFiltered.length > 0) {
      return [...liveFiltered, ...endedFiltered].slice(0, limit);
    }

    // If no live contests, return only ended (up to limit)
    return endedFiltered.slice(0, limit);
  };

  // Budget/prize pool in cents for any contest type (cpm, dual_rewards, milestone, leaderboard)
  const getContestBudgetCents = (contest: any): number => {
    if (contest.contest_type === "leaderboard") {
      return (
        contest.contest_based_details?.leaderboard_contest?.total_prize || 0
      );
    }
    return getPoolBudgetCentsFromDetails(
      contest.contest_type,
      contest.contest_based_details,
    );
  };

  const getContestBudgetSpentCents = (contest: any): number =>
    getPoolBudgetSpentCentsForDisplay({
      contest_type: contest.contest_type,
      post_contest_status: contest.post_contest_status,
      contest_based_details: contest.contest_based_details,
    });

  // STEP 1: Most Popular contests - MUST get 4 live (active only) contests (compulsory)
  // Ensure diversity: different platforms and contest types, prioritizing highest budgets
  const availableForMostPopular = contests.filter((c) => {
    // Only include active (live) contests - exclude upcoming and ended
    if (c.status !== "active") {
      return false;
    }
    // Only include contests with a valid budget/prize
    return getContestBudgetCents(c) > 0;
  });

  const sortedForMostPopular = [...availableForMostPopular].sort((a, b) => {
    const getBudget = getContestBudgetCents;

    // Second: Get CPM rate (only for CPM-style contests, incl. dual rewards)
    const getCpmRate = (contest: any) => {
      if (isCpmContestType(contest.contest_type)) {
        return contest.contest_based_details?.cpm_contest?.cpm_rate_usd || 0;
      }
      return 0;
    };

    const budgetA = getBudget(a);
    const budgetB = getBudget(b);

    // Primary sort: by budget (descending)
    if (budgetB !== budgetA) {
      return budgetB - budgetA;
    }

    // Secondary sort: by CPM rate for CPM contests (descending)
    // Higher CPM rate means more money per view
    const cpmRateA = getCpmRate(a);
    const cpmRateB = getCpmRate(b);
    return cpmRateB - cpmRateA;
  });

  // Get exactly 4 active (live) contests for Most Popular with diversity
  // Prioritize different platforms and contest types
  const mostPopularContests: any[] = [];
  const usedPlatforms = new Set<string>();
  const usedContestTypes = new Set<string>();

  // First pass: Try to get diverse contests (different platforms/types)
  for (const contest of sortedForMostPopular) {
    if (mostPopularContests.length >= 4) break;

    const platform = contest.platform?.toLowerCase() || "unknown";
    const contestType = contest.contest_type || "unknown";

    // Prefer contests with different platforms and types
    const isNewPlatform = !usedPlatforms.has(platform);
    const isNewContestType = !usedContestTypes.has(contestType);

    // If we have less than 4, prioritize diversity
    if (mostPopularContests.length < 4) {
      // If it's a new platform or new contest type, add it
      if (isNewPlatform || isNewContestType) {
        mostPopularContests.push(contest);
        usedPlatforms.add(platform);
        usedContestTypes.add(contestType);
      }
    }
  }

  // Second pass: Fill remaining slots with highest budget contests if we don't have 4 yet
  if (mostPopularContests.length < 4) {
    for (const contest of sortedForMostPopular) {
      if (mostPopularContests.length >= 4) break;
      // Skip if already added
      if (!mostPopularContests.find((c) => c.id === contest.id)) {
        mostPopularContests.push(contest);
        const platform = contest.platform?.toLowerCase() || "unknown";
        const contestType = contest.contest_type || "unknown";
        usedPlatforms.add(platform);
        usedContestTypes.add(contestType);
      }
    }
  }

  // Ensure we have exactly 4 (or as many as available)
  const finalMostPopularContests = mostPopularContests.slice(0, 4);

  // Get IDs of contests used in Most Popular section
  const mostPopularContestIds = new Set(
    finalMostPopularContests.map((c) => c.id),
  );

  // STEP 2: Instagram and YouTube contests - use remaining contests (active, upcoming, and ended)
  // Exclude contests already shown in Most Popular section
  const instagramContests = getContestsWithLiveAndEnded(
    contests.filter(
      (c) =>
        c.platform?.toLowerCase() === "instagram" &&
        !mostPopularContestIds.has(c.id),
    ),
    5,
  );
  const youtubeContests = getContestsWithLiveAndEnded(
    contests.filter(
      (c) =>
        c.platform?.toLowerCase() === "youtube" &&
        !mostPopularContestIds.has(c.id),
    ),
    5,
  );

  // Calculate total budget for all campaigns (live, upcoming, and ended)
  const totalBudget = contests.reduce(
    (sum, contest) => sum + getContestBudgetCents(contest),
    0,
  );

  // Calculate total contests published
  const totalContests = contests.length;

  const renderContestCard = (contest: any) => {
    // Calculate budget used percentage
    let budgetUsedPercent = 0;
    const totalBudget =
      contest.contest_type === "leaderboard"
        ? contest.contest_based_details?.leaderboard_contest?.total_budget || 0
        : getContestBudgetCents(contest);
    const budgetSpent = getContestBudgetSpentCents(contest);
    const cpmRate = isCpmContestType(contest.contest_type)
      ? contest.contest_based_details?.cpm_contest?.cpm_rate_usd
      : null;

    if (totalBudget > 0) {
      budgetUsedPercent = Math.min(
        Math.round((budgetSpent / totalBudget) * 100),
        100,
      );
    }

    // Get budget/prize amount for display
    const budgetAmount = getContestBudgetCents(contest);

    // Show budget-used progress for pool-based contests (CPM, dual rewards, milestone)
    const showBudgetProgress =
      (isCpmContestType(contest.contest_type) ||
        contest.contest_type === "milestone") &&
      totalBudget > 0;

    return (
      <div
        key={contest.id}
        onClick={() => handleViewContest(contest.id)}
        className={cn(
          "relative w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px] flex-shrink-0 overflow-hidden rounded-2xl border border-slate-700 bg-[#06021D] p-1 pb-2 font-medium transition-transform duration-150 ease-in-out hover:scale-105 hover:border-orange-400 cursor-pointer my-2",
          navigatingContestId === contest.id && "opacity-70 cursor-not-allowed",
        )}
      >
        {/* Loading overlay with spinner */}
        {navigatingContestId === contest.id && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-2xl">
            <ButtonLoadingSpinner />
          </div>
        )}
        {/* Image */}
        {contest.thumbnail_url ? (
          <div className="w-full h-[140px] sm:h-[150px] md:h-[170px] lg:h-[190px] rounded-xl flex items-center justify-center overflow-hidden">
            <Image
              src={contest.thumbnail_url}
              alt={contest.title}
              width={240}
              height={190}
              className="pointer-events-none w-full h-full rounded-xl object-contain"
            />
          </div>
        ) : (
          <div className="w-full h-[140px] sm:h-[150px] md:h-[170px] lg:h-[190px] rounded-xl bg-slate-800 flex items-center justify-center">
            <Trophy className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-slate-400" />
          </div>
        )}

        {/* Content */}
        <div className="mt-2 flex flex-col items-start px-2">
          <h3 className="text-xs sm:text-sm md:text-base leading-[1.4] break-words text-white">
            {contest.title}
          </h3>

          {/* Budget + CPM Rate */}
          <div className="mt-3 sm:mt-4 grid min-w-full grid-cols-2 gap-2 text-xs">
            {/* Budget */}
            {budgetAmount && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 text-green-500">
                  <Wallet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="text-xs sm:text-sm font-semibold">
                    {formatMoney(budgetAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* CPM Rate */}
            {cpmRate != null && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center truncate text-white">
                  <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
                  <span className="text-xs sm:text-sm">
                    {formatMoney(cpmRate * 100)}/1k Views
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Budget used text - only show for pool-based contests */}
          {showBudgetProgress && (
            <span className="mt-1 text-[9px] sm:text-[10px] text-slate-400">
              {budgetUsedPercent}% budget used
            </span>
          )}
        </div>

        {/* Progress bar - only show for pool-based contests */}
        {showBudgetProgress && (
          <div className="absolute bottom-0 left-[5px] right-0 h-1">
            <div
              className="h-full rounded-tr-full bg-green-500 transition-all"
              style={{ width: `${budgetUsedPercent}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white border-b border-white/10">
      <div className="relative z-20">
        <section
          id="home"
          className="pt-10 pb-12 md:pt-16 md:pb-16 relative overflow-visible"
        >
          <div className="max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-12 relative z-10">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
              {/* Left: copy + CTAs */}
              <div className="text-left">
                <h1
                  className="text-[2.35rem] leading-[1.1] sm:text-5xl md:text-[3.35rem] lg:text-[3.75rem] font-semibold tracking-tight text-white mb-5 slide-up"
                  style={{
                    fontFamily: "Montserrat, sans-serif",
                    animationDelay: "0.15s",
                  }}
                >
                  Big following?
                  <br />
                  Small following?
                  <br />
                  Doesn&apos;t matter here.
                </h1>

                <p
                  className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-xl mb-8 leading-relaxed slide-left"
                  style={{ animationDelay: "0.35s" }}
                >
                  Anyone can join. What you earn depends on how your content
                  performs — not your follower count.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
                  <Button
                    type="button"
                    onClick={handleStartEarningClick}
                    disabled={isCheckingStartEarning}
                    className="rounded-full bg-[#1a1a1a] border border-white/20 text-white font-medium px-6 py-6 text-base hover:bg-[#242424] hover:border-white/35 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isCheckingStartEarning ? <ButtonLoadingSpinner /> : null}
                    <span>Start Earning →</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleViewMoreClick}
                    disabled={isNavigatingViewMore}
                    className="rounded-full bg-[#e8e8e8] text-black font-medium px-6 py-6 text-base hover:bg-white transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isNavigatingViewMore ? <ButtonLoadingSpinner /> : null}
                    <span>Browse Campaigns →</span>
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {[
                      "/images/Ellipse 2355.avif",
                      "/images/Ellipse 2355 (1).avif",
                      "/images/Ellipse 2355 (2).avif",
                    ].map((src, i) => (
                      <div
                        key={src}
                        className="relative h-8 w-8 rounded-full border-2 border-black overflow-hidden bg-zinc-800"
                        style={{ zIndex: 3 - i }}
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-zinc-400">
                    16k+ creators have already Joined
                  </p>
                </div>
              </div>

              {/* Right: layered hero visual */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative w-full max-w-[500px] sm:max-w-[560px] h-[460px] sm:h-[520px] lg:h-[560px] overflow-visible">
                  {/* Dollar sign — behind girl, shifted left */}
                  <div className="absolute left-[-18%] right-[18%] top-[-2%] bottom-[6%] z-0 pointer-events-none select-none">
                    <Image
                      src="/images/attach-money.png"
                      alt=""
                      fill
                      className="object-contain object-center opacity-90"
                      sizes="(max-width: 1024px) 70vw, 440px"
                      priority
                    />
                  </div>

                  {/* Last Month Earnings — behind girl (tucked under right shoulder) */}
                  <div className="absolute top-[29%] right-[6%] sm:right-[10%] z-[5] rounded-2xl border border-white/10 bg-[#141414]/95 backdrop-blur-md px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xl shadow-black/50 pointer-events-none">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex h-4 w-4 sm:h-[18px] sm:w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[9px] sm:text-[10px] font-bold text-black shadow-sm">
                        $
                      </span>
                      <span className="text-[11px] sm:text-xs text-zinc-300 whitespace-nowrap">
                        Last Month Earnings
                      </span>
                    </div>
                    <p className="text-xl sm:text-2xl font-semibold text-white tracking-tight pl-0.5">
                      $4,500
                    </p>
                  </div>

                  {/* Girl — in front of dollar + earnings card */}
                  <div className="absolute inset-0 z-10 flex items-end justify-center pointer-events-none">
                    <div className="relative h-[88%] w-[98%] sm:w-[86%] -mb-[4%]">
                      <Image
                        src="/images/88ea43859c754cb864b7440ecca779c37d8d6e5d.png"
                        alt="Creator checking earnings on Game of Creators"
                        fill
                        priority
                        className="object-contain object-bottom scale-[1.12] origin-bottom"
                        sizes="(max-width: 1024px) 90vw, 480px"
                      />
                    </div>
                  </div>

                  {/* $600 credited notification — in front of girl */}
                  <div className="absolute left-[2%] sm:left-[12%] top-[65%] z-20 w-[min(94%,280px)] sm:w-[300px] rounded-2xl bg-[#f3f3f4] text-black shadow-[0_12px_40px_rgba(0,0,0,0.55)] px-3 py-2.5 sm:px-3.5 sm:py-3 pointer-events-none">
                    <div className="flex items-start gap-2.5">
                      <div className="relative mt-0.5 h-8 w-8 sm:h-9 sm:w-9 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                        <Image
                          src="/images/goc_square.avif"
                          alt=""
                          fill
                          className="object-contain p-1"
                          sizes="36px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] sm:text-sm leading-snug text-zinc-900">
                            <span className="font-semibold">GOC</span>{" "}
                            <span className="font-semibold">
                              $600 credited!
                            </span>
                          </p>
                          <span className="shrink-0 text-[10px] sm:text-[11px] text-zinc-500 pt-0.5">
                            now
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-zinc-600 mt-0.5 leading-snug">
                          from GlowNaturally Campaign 🪄
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand logos strip */}
        <section className="pb-14 pt-2 overflow-hidden">
          <p className="text-center text-sm sm:text-base text-zinc-500 mb-8 px-4">
            Work with Top Brands with the network of 16k+ Creators
          </p>
          <div className="overflow-hidden relative">
            <div className="flex justify-center items-center gap-8 md:gap-12 animate-scroll-left px-4">
              {[
                "/images/sony.avif",
                "/images/warner-music.avif",
                "/images/universal-music.avif",
                "/images/capital-music.avif",
                "/images/empire-distribution.avif",
                "/images/10k-projects.avif",
                "/images/sony.avif",
                "/images/warner-music.avif",
                "/images/universal-music.avif",
                "/images/capital-music.avif",
                "/images/empire-distribution.avif",
                "/images/10k-projects.avif",
              ].map((image, index) => (
                <div
                  key={`${image}-${index}`}
                  className="flex-shrink-0 w-[110px] h-[56px] md:w-[140px] md:h-[70px] flex items-center justify-center opacity-50 grayscale"
                >
                  <Image
                    src={image}
                    alt=""
                    width={140}
                    height={70}
                    className="w-full h-full object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contests Section */}
        <section className="text-white py-16 px-4 overflow-visible">
          <div className="max-w-[1400px] mx-auto space-y-12 overflow-visible">
            {/* Most Popular Contests */}
            {finalMostPopularContests.length > 0 && (
              <div className="overflow-visible">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 px-2 sm:px-16 gap-3 sm:gap-0">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                    Most Popular Campaigns
                  </h2>
                </div>

                <div className="flex gap-3 sm:gap-4 overflow-x-auto min-[760px]:flex-wrap min-[760px]:overflow-x-visible py-4 px-2 sm:px-4 justify-start md:justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {finalMostPopularContests.map(renderContestCard)}

                  {/* Total Budget Card */}
                  <div
                    onClick={handleViewMoreClick}
                    className={cn(
                      "relative w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px] flex-shrink-0 overflow-hidden rounded-2xl border border-slate-700 bg-[#06021D] p-2 font-medium transition-transform duration-150 ease-in-out hover:scale-105 hover:border-orange-400 cursor-pointer my-2 flex items-center justify-center",
                      isNavigatingViewMore && "opacity-70 cursor-not-allowed",
                    )}
                  >
                    {/* Loading overlay with spinner */}
                    {isNavigatingViewMore && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-2xl">
                        <ButtonLoadingSpinner />
                      </div>
                    )}
                    {/* Icon Area (similar to image area) */}
                    <div className="w-full h-[140px] sm:h-[150px] md:h-[170px] lg:h-[190px] rounded-xl flex flex-col items-center justify-center gap-2">
                      <div className="relative flex items-center justify-center">
                        <Wallet className="h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 text-green-500" />
                      </div>
                      <div className="text-lg sm:text-xl md:text-2xl font-bold text-white text-center w-full">
                        {formatMoney(totalBudget)}
                      </div>
                      <h3 className="text-xs sm:text-sm md:text-base leading-[1.4] break-words text-white text-center w-full">
                        Total Budget
                      </h3>
                      <div className="flex items-center justify-center gap-1 text-slate-300 w-full">
                        <span className="text-xs sm:text-sm text-center">
                          from {totalContests} campaigns
                        </span>
                      </div>
                      <div className="flex justify-center w-full">
                        <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center hover:border-orange-400 transition-colors">
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instagram Contests */}
            {/* {instagramContests.length > 0 && (
              <div className="overflow-visible">
                <div className="flex items-center justify-start mb-6 px-2 sm:px-16">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                    Instagram Campaigns
                  </h2>
                </div>
                <div className="flex gap-3 sm:gap-4 overflow-x-auto min-[1000px]:flex-wrap min-[1000px]:overflow-x-visible py-4 px-2 sm:px-4 justify-start md:justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {instagramContests.map(renderContestCard)}
                </div>
              </div>
            )} */}

            {/* YouTube Contests */}
            {/* {youtubeContests.length > 0 && (
              <div className="overflow-visible">
                <div className="flex items-center justify-between mb-6 px-2 sm:px-16">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                    YouTube Campaigns
                  </h2>
                </div>
                <div className="flex gap-3 sm:gap-4 overflow-x-auto min-[1000px]:flex-wrap min-[1000px]:overflow-x-visible py-4 px-2 sm:px-4 justify-start md:justify-center [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {youtubeContests.map(renderContestCard)}
                </div>
              </div>
            )} */}
          </div>
        </section>

        {/* As easy as you think */}
        <section
          id="why-goc"
          className="text-white py-16 md:py-20 scroll-mt-24"
          ref={animationRef}
        >
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 xl:px-4">
            <h2
              className={`text-center text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-10 md:mb-14 tracking-tight ${
                isAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{
                fontFamily: "Montserrat, sans-serif",
                animationDelay: "0.15s",
              }}
            >
              As easy as you think
            </h2>

            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
              {/* Left: campaign collage + CTA */}
              <div
                className={`relative rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a] ${
                  isAnimated ? "slide-left" : "hide-before-animate"
                }`}
                style={{ animationDelay: "0.3s" }}
              >
                <div className="relative h-[320px] sm:h-[400px] md:h-[460px]">
                  <div className="absolute inset-0 flex flex-col gap-1">
                    {easyCollageImages.map((src) => (
                      <div key={src} className="relative flex-1 min-h-0">
                        <Image
                          src={src}
                          alt=""
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 1024px) 90vw, 560px"
                          priority
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-5 flex justify-center z-10">
                    <Button
                      type="button"
                      onClick={handleViewMoreClick}
                      disabled={isNavigatingViewMore}
                      className="rounded-full bg-[#FF6A1A] hover:bg-[#ff7a33] text-white font-semibold px-6 py-6 text-sm sm:text-base shadow-lg shadow-orange-900/40 disabled:opacity-70"
                    >
                      {isNavigatingViewMore ? <ButtonLoadingSpinner /> : null}
                      <span>Explore Campaigns →</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right: interactive steps */}
              <div
                className={`flex flex-col justify-center ${
                  isAnimated ? "slide-right" : "hide-before-animate"
                }`}
                style={{ animationDelay: "0.45s" }}
              >
                <ul className="space-y-1">
                  {creatorEasySteps.map((step, index) => {
                    const isActive = easyStep === index;
                    return (
                      <li key={step.title}>
                        <button
                          type="button"
                          onClick={() => {
                            setEasyStep(index);
                            setEasyStepProgress(0);
                          }}
                          className="w-full text-left py-4 group"
                        >
                          <h3
                            className={cn(
                              "text-xl sm:text-2xl md:text-[1.65rem] font-semibold transition-colors duration-300",
                              isActive
                                ? "text-white"
                                : "text-zinc-500 group-hover:text-zinc-300",
                            )}
                          >
                            {step.title}
                          </h3>
                          <div
                            className={cn(
                              "grid transition-all duration-300 ease-out",
                              isActive
                                ? "grid-rows-[1fr] opacity-100 mt-2"
                                : "grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <div className="overflow-hidden">
                              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md pb-3">
                                {step.description}
                              </p>
                              <div className="h-px w-full bg-zinc-800 overflow-hidden rounded-full">
                                <div
                                  className="h-full bg-[#FF6A1A] rounded-full transition-none"
                                  style={{
                                    width: `${Math.min(easyStepProgress, 1) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Gaming How It Works */}
        {/* <section
          className="py-16 px-4 md:px-16 xl:px-4 text-white"
          ref={howItWorksRef}
        >
          <div className="container mx-auto max-w-[1250px]">
            <h2
              className={`text-center text-2xl md:text-4xl font-bold mb-[50px] ${
                howItWorksAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{ animationDelay: "0.1s" }}
            >
              How it works
            </h2>

            <div className="grid lg:grid-cols-2 gap-10 items-start">
             
              <div className="space-y-[90px] relative z-10">
                {creatorsteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-6 relative">
                    
                    <div
                      className={`w-16 h-16 md:w-[90px] md:h-[90px] rounded-full flex items-center justify-center text-white font-bold text-lg md:text-2xl ${step.color} flex-shrink-0 relative z-10`}
                    >
                      {step.number}
                    </div>

                    
                    {index < creatorsteps.length - 1 && (
                      <div
                        className="hidden lg:block absolute left-6 md:left-[45px] w-px border-l-2 border-dotted border-gray-500 z-0"
                        style={{
                          top: "90px",
                          height:
                            index === 0
                              ? windowWidth < 1100
                                ? "230px" 
                                : windowWidth < 1250
                                ? "200px" 
                                : "180px" 
                              : index === 1
                              ? windowWidth < 1100
                                ? "200px" 
                                : windowWidth < 1250
                                ? "200px" 
                                : "180px" 
                              : index === 2
                              ? windowWidth < 1100
                                ? "230px"
                                : windowWidth < 1250
                                ? "200px" 
                                : "180px" 
                              : "40px",
                        }}
                      />
                    )}

                    <div>
                      
                      <div className="mb-4 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border border-white rounded-md">
                        <span className="text-white">{step.icon}</span>
                      </div>

                      <h3 className="font-bold text-xl md:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-4 text-base text-md md:text-lg text-gray-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

             
              <div className="relative w-full h-64 md:h-[900px] rounded-xl overflow-hidden">
                <Image
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={`Step Image ${currentIndex + 1}`}
                  fill
                  className={`object-cover rounded-xl transition-opacity duration-500 ${
                    fade ? "opacity-100" : "opacity-0"
                  }`}
                  priority={true}
                />
              </div>
            </div>
          </div>
        </section> */}

        {/* Why Creators Choose GoC */}
        <section
          id="how-it-works"
          className="py-16 md:py-20 px-4 text-white scroll-mt-24"
          ref={howItWorksRef}
        >
          <div className="container mx-auto max-w-[1100px]">
            <h2
              className={`text-center text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-10 md:mb-14 tracking-tight ${
                howItWorksAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{
                fontFamily: "Montserrat, sans-serif",
                animationDelay: "0.1s",
              }}
            >
              Why Creators Choose GoC
            </h2>

            <div className="grid gap-4 md:gap-5">
              {/* Top row — 2 wide cards */}
              <div className="grid md:grid-cols-2 gap-4 md:gap-5">
                {/* Get Paid Directly */}
                <div className="rounded-3xl bg-[#141414] border border-white/5 p-6 sm:p-8 flex flex-col min-h-[280px] sm:min-h-[300px]">
                  <div className="flex-1 flex items-center justify-center mb-6">
                    <div className="relative w-full max-w-[340px] h-[140px] flex items-center">
                      <div className="relative z-10 rounded-2xl border border-white/10 bg-[#1c1c1c] px-4 py-3 shadow-xl w-[170px] sm:w-[190px]">
                        <p className="text-[10px] tracking-wider text-zinc-500 mb-1">
                          ACCOUNT BALANCE
                        </p>
                        <p className="text-2xl sm:text-3xl font-semibold text-white mb-3">
                          $3,400
                        </p>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6A1A] px-3 py-1.5 text-xs font-semibold text-white">
                          Withdraw
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                        <div className="absolute -left-10 top-[18px] w-10 border-t border-dashed border-zinc-600" />
                        <div className="absolute -left-10 top-[54px] w-10 border-t border-dashed border-zinc-600" />
                        <div className="absolute -left-10 top-[90px] w-10 border-t border-dashed border-zinc-600" />
                        {[
                          { bg: "bg-[#5f259f]", label: "P" },
                          { bg: "bg-white text-black", label: "▲" },
                          { bg: "bg-[#4285F4]", label: "G" },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={`relative z-10 h-8 w-8 rounded-full ${item.bg} flex items-center justify-center text-[11px] font-bold shadow-md`}
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-1.5">
                    Get Paid Directly
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Withdraw your earnings straight to UPI and Crypto
                  </p>
                </div>

                {/* Create Together */}
                <div className="rounded-3xl bg-[#141414] border border-white/5 p-6 sm:p-8 flex flex-col min-h-[280px] sm:min-h-[300px]">
                  <div className="flex-1 flex items-center justify-center mb-6">
                    <div className="relative w-full max-w-[280px] h-[150px]">
                      <div className="absolute left-1/2 top-2 -translate-x-1/2 z-20 h-14 w-14 rounded-full overflow-hidden border-2 border-white/20 shadow-lg">
                        <Image
                          src="/images/Ellipse 2355.avif"
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                      <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 280 150"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M140 40 C100 70, 60 90, 40 120"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <path
                          d="M140 40 C120 75, 100 95, 90 125"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <path
                          d="M140 40 C140 80, 140 100, 140 128"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <path
                          d="M140 40 C160 75, 180 95, 190 125"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <path
                          d="M140 40 C180 70, 220 90, 240 120"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                      </svg>
                      {[
                        { src: "/images/Ellipse 2355 (1).avif", left: "8%" },
                        { src: "/images/Ellipse 2355 (2).avif", left: "28%" },
                        { src: "/images/Ellipse 2355 (3).avif", left: "48%" },
                        { src: "/images/Ellipse 2355 (4).avif", left: "68%" },
                        { src: "/images/Ellipse 2355 (6).avif", left: "86%" },
                      ].map((avatar) => (
                        <div
                          key={avatar.src}
                          className="absolute bottom-1 z-10 h-9 w-9 rounded-full overflow-hidden border border-white/20"
                          style={{
                            left: avatar.left,
                            transform: "translateX(-50%)",
                          }}
                        >
                          <Image
                            src={avatar.src}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="36px"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-1.5">
                    Create Together
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Connect with creators and share opportunities.
                  </p>
                </div>
              </div>

              {/* Bottom row — 3 cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {/* Know Your Numbers */}
                <div className="rounded-3xl bg-[#141414] border border-white/5 p-6 flex flex-col min-h-[260px]">
                  <div className="flex-1 relative mb-5 flex items-end justify-center px-2">
                    <div className="absolute top-2 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-[#2a1f4d] border border-violet-500/30 px-2.5 py-1 text-[10px] text-violet-200">
                      <Share2 className="h-3 w-3" />
                      423 Shares
                    </div>
                    <div className="absolute top-8 right-4 z-10 h-8 w-8 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg">
                      <DollarSign className="h-4 w-4 text-white" />
                    </div>
                    <div className="absolute bottom-8 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-[#3d2414] border border-orange-500/30 px-2.5 py-1 text-[10px] text-orange-200">
                      <Eye className="h-3 w-3" />
                      1.2M Views
                    </div>
                    <svg
                      className="w-full h-[100px]"
                      viewBox="0 0 200 100"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M0 80 C30 75, 45 55, 70 50 C95 45, 110 60, 130 40 C150 20, 170 25, 200 10"
                        stroke="#FF6A1A"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 80 C30 75, 45 55, 70 50 C95 45, 110 60, 130 40 C150 20, 170 25, 200 10 L200 100 L0 100 Z"
                        fill="url(#gocChartFade)"
                        opacity="0.35"
                      />
                      <defs>
                        <linearGradient
                          id="gocChartFade"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#FF6A1A" />
                          <stop
                            offset="100%"
                            stopColor="#FF6A1A"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    Know Your Numbers
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Track views, performance, and earnings easily.
                  </p>
                </div>

                {/* Pick What Fits */}
                <div className="rounded-3xl bg-[#141414] border border-white/5 p-6 flex flex-col min-h-[260px]">
                  <div className="flex-1 flex items-center justify-center mb-5">
                    <div className="relative flex flex-wrap gap-2 justify-center max-w-[240px]">
                      {[
                        "Platform",
                        "Content Type",
                        "Category / Niche",
                        "Earning Potential",
                        "Reward Model",
                        "Campaign Status",
                      ].map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[11px] whitespace-nowrap",
                            tag === "Reward Model"
                              ? "border-white/40 bg-white/10 text-white"
                              : "border-white/15 bg-white/[0.03] text-zinc-400",
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                      <MousePointer2 className="absolute right-6 bottom-0 h-5 w-5 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    Pick What Fits
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Choose campaigns that match your content style.
                  </p>
                </div>

                {/* Grow With Every Campaign */}
                <div className="rounded-3xl bg-[#141414] border border-white/5 p-6 flex flex-col min-h-[260px] sm:col-span-2 lg:col-span-1">
                  <div className="flex-1 flex items-center justify-center mb-5">
                    <div className="relative w-full max-w-[220px] space-y-2.5 opacity-90">
                      <div className="absolute -inset-2 rounded-xl bg-gradient-to-b from-transparent via-transparent to-[#141414] z-10 pointer-events-none" />
                      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">
                            12.4M
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Views generated
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-sky-500/20 flex items-center justify-center">
                          <Wallet className="h-3.5 w-3.5 text-sky-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">
                            $3,240
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Money earned
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white leading-tight">
                            75%
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Success Rate
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">
                    Grow With Every Campaign
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Build experience, performance, and earning potential.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* <NumbersSection
          items={[
            {
              numbers: [3000, 4000, 5000, 6000, 7000],
              label: "Creators on Platform",
            },
            {
              numbers: [100, 200, 300, 400, 500, 600],
              label: "Campaigns Delivered",
            },
            {
              numbers: [40, 50, 60, 70, 80],
              label: "Views Generated",
              suffix: "M",
            },
          ]}
        /> */}

        {/* Epic Stats Section */}
        {/* <section className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { number: "3000+", label: "Creators on Platform", icon: <Users className="h-8 w-8" />, gradient: "from-violet-600 to-purple-600" },
                { number: "100+", label: "Campaigns Delivered", icon: <Rocket className="h-8 w-8" />, gradient: "from-blue-600 to-indigo-600" },
                { number: "80M+", label: "Views Generated", icon: <TrendingUp className="h-8 w-8" />, gradient: "from-amber-600 to-orange-600" },
              ].map((stat, index) => (
                <div key={index} className="group text-center">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-3xl blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40`}></div>
                    <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto mb-6`}>
                        {stat.icon}
                      </div>
                      <p className={`text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                        {stat.number}
                      </p>
                      <p className="text-xl text-slate-300 font-semibold">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}
        <Testimonials />
        {/* Gaming Testimonials Section */}
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                What Creators Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {creatorTestimonials.map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < testimonial.stars
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold mr-4">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {testimonial.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {testimonial.title}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Gaming FAQ Section */}
        <FAQ />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                  FAQ
                </h2>
                <p className="text-xl text-slate-300">
                  Here are some frequently asked questions
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqItems.map((item, index) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-0"
                  >
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-amber-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12">
                          {item.answer}
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section> */}

        {/* Epic Final CTA */}
        <CtcBanner />

        <Dialog
          open={showAdvertiserModal}
          onOpenChange={setShowAdvertiserModal}
        >
          <DialogContent className="bg-[#050816] border border-orange-500/30 text-white rounded-2xl shadow-2xl shadow-orange-900/40 sm:max-w-xl p-8">
            <DialogHeader>
              {/* <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500/30 to-amber-500/30 border border-orange-400/30">
                <Sparkles className="h-6 w-6 text-orange-300" />
              </div> */}
              <DialogTitle className="text-xl mb-2 lg:text-2xl leading-tight">
                <span
                  className="font-semibold text-white drop-shadow-2xl"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  You are logged in as{" "}
                </span>
                <span
                  className="font-semibold text-white drop-shadow-2xl"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  <span className="relative">
                    <span
                      className="bg-clip-text text-transparent"
                      style={{
                        backgroundImage:
                          "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
                      }}
                    >
                      a brand
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl "></div>
                  </span>
                </span>
              </DialogTitle>
              {/* <DialogTitle className="text-2xl font-bold text-white">
                You are logged in as a brand
              </DialogTitle> */}
              <DialogDescription className="text-base text-slate-300 leading-relaxed">
                To continue as a creator, please sign out from your brand
                account first, then log in or sign up as a creator account.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5"
                onClick={handleContinueAsAdvertiser}
                disabled={isSigningOut}
              >
                Continue as Brand
              </Button>
              <Button
                className="w-full sm:w-auto bg-gradient-to-r from-[#DD7209] to-[#FF652D] text-md text-white hover:from-[#DD7209]/90 hover:to-[#FF652D]/90 px-6 py-5"
                onClick={handleSignOutAndContinueCreator}
                disabled={isSigningOut}
              >
                Sign out & Continue as Creator
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/30 via-orange-900/30 to-yellow-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Sparkles className="h-16 w-16 text-amber-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Creativity
                </span>
                ?
              </h2>

              <p className="text-xl text-slate-300 mb-12 leading-relaxed">
                Join thousands of creators and brands. Sign up today and unlock
                your potential!
              </p>

              <Button
                size="lg"
                className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:via-orange-500 hover:to-yellow-500 text-white font-bold px-10 py-5 rounded-2xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-110 border border-amber-400/30 text-lg overflow-hidden"
                asChild
              >
                <Link href="/auth/signup">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  <Sparkles className="mr-3 h-5 w-5" />
                  <span className="relative z-10">Join Game Of Creators</span>
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
}
