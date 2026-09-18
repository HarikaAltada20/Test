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
  Send,
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
import { useThemeMode } from "@/hooks/use-theme-mode";

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
const brandImages: string[] = [
  "/images/song-gpt.logo.avif",
  "/images/vows-streams-logo.avif",
  "/images/catch-phrase.avif",
  "/images/deepvid.avif",
  "/images/warner-music.avif",
  "/images/sony.avif",
  "/images/10k-projects.avif",
  "/images/ada.avif",
  "/images/artistpg.avif",
  "/images/capital-music.avif",
  "/images/create-music-group.avif",
  "/images/empire-distribution.avif",
];
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
const creators = [
  {
    src: "/images/Ellipse 2355 (1).avif",
    alt: "Creator 1",
  },
  {
    src: "/images/Ellipse 2355 (2).avif",
    alt: "Creator 2",
  },
  {
    src: "/images/Ellipse 2355 (3).avif",
    alt: "Creator 3",
  },
  {
    src: "/images/Ellipse 2355 (4).avif",
    alt: "Creator 4",
  },
  {
    src: "/images/Ellipse 2355 (6).avif",
    alt: "Creator 5",
  },
];

const filters = [
  "Content Type",
  "Platform",
  "Content Type",
  "Category / Niche",
  "Earning Potential",
  "Reward Model",
  "Campaign Status",
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
  const { isLight } = useThemeMode();
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

  // Reset navigating state when route changes
  useEffect(() => {
    setNavigatingContestId(null);
    setIsNavigatingViewMore(false);
    setIsCheckingStartEarning(false);
    setIsSigningOut(false);
    setIsNavigating(false);
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
          setIsCheckingStartEarning(false);
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
      setIsSigningOut(false);
    }
  };

  const handleContinueAsAdvertiser = () => {
    setIsNavigating(true);
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
    <div
      className={cn(
        "min-h-screen overflow-x-hidden border-b transition-colors duration-300",
        isLight
          ? "border-black/5 bg-[#F1F1F1] text-black"
          : "border-white/10 bg-black text-white",
      )}
    >
      <div className="relative z-20">
        <section
          id="home"
          className="relative overflow-hidden pt-8 pb-10 sm:pt-10 sm:pb-12 md:pt-16 md:pb-16"
        >
          <div className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-12">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-8">
              {/* Left: copy + CTAs */}
              <div className="text-left">
                <h1
                  className={cn(
                    "mb-4 text-[2rem] font-semibold leading-[1.1] tracking-tight slide-up sm:mb-5 sm:text-5xl md:text-[3.35rem] lg:text-[4rem]",
                    isLight
                      ? "text-black"
                      : "bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent",
                  )}
                  style={{ animationDelay: "0.15s" }}
                >
                  Big following?
                  <br />
                  Small following?
                  <br />
                  Doesn&apos;t matter here.
                </h1>

                <p
                  className={cn(
                    "mb-6 max-w-xl text-base leading-relaxed slide-left sm:mb-8 sm:text-lg md:text-xl",
                    isLight ? "text-black/50" : "text-zinc-400",
                  )}
                  style={{ animationDelay: "0.35s" }}
                >
                  Anyone can join. What you earn depends on how your content
                  performs — not your follower count.
                </p>

                <div className="mb-6 flex flex-col items-stretch gap-3 sm:mb-8 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleStartEarningClick}
                    disabled={isCheckingStartEarning}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-6 text-base font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70",
                      isLight
                        ? "bg-[#FF6A1A] text-white hover:bg-[#ff7a33] shadow-lg shadow-orange-500/25"
                        : "border border-white/20 bg-[#1a1a1a] text-white hover:border-white/35 hover:bg-[#242424]",
                    )}
                  >
                    {isCheckingStartEarning ? <ButtonLoadingSpinner /> : null}
                    <span>Start Earning →</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleViewMoreClick}
                    disabled={isNavigatingViewMore}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl px-6 py-6 text-base font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70",
                      isLight
                        ? "border border-black/15 bg-white text-black hover:bg-[#f7f7f7]"
                        : "bg-[#e8e8e8] text-black hover:bg-white",
                    )}
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
                        className={cn(
                          "relative h-8 w-8 overflow-hidden rounded-full border-2 bg-zinc-800",
                          isLight ? "border-white" : "border-black",
                        )}
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
                  <p
                    className={cn(
                      "text-sm",
                      isLight ? "text-black/50" : "text-zinc-400",
                    )}
                  >
                    16k+ creators have already Joined
                  </p>
                </div>
              </div>

              {/* Right: layered hero visual */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative h-[380px] w-full max-w-[420px] overflow-hidden sm:h-[480px] sm:max-w-[560px] sm:overflow-visible lg:h-[560px]">
                  {/* Dollar sign — behind girl, shifted left */}
                  <div className="pointer-events-none absolute left-[-8%] right-[10%] top-[-2%] bottom-[6%] z-0 select-none sm:left-[-18%] sm:right-[18%]">
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
                  <div
                    className={cn(
                      "pointer-events-none absolute top-[28%] right-[4%] z-[5] rounded-2xl border px-3 py-2 backdrop-blur-md sm:top-[38%] sm:right-[10%] sm:px-4 sm:py-3 rotate-[6deg]",
                      isLight
                        ? "border-black/[0.06] bg-white shadow-[0_12px_28px_rgba(20,16,40,0.12)]"
                        : "border-white/10 bg-[#1E1E1E] shadow-[inset_0_0_5.26px_0_#FFFFFF40]",
                    )}
                  >
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[9px] font-bold text-black shadow-sm sm:h-[18px] sm:w-[18px] sm:text-[10px]">
                        $
                      </span>
                      <span
                        className={cn(
                          "whitespace-nowrap text-[11px] sm:text-xs",
                          isLight ? "text-black/50" : "text-zinc-300",
                        )}
                      >
                        Last Month Earnings
                      </span>
                    </div>
                    <p
                      className={cn(
                        "pl-0.5 text-xl font-semibold tracking-tight sm:text-2xl",
                        isLight ? "text-black" : "text-white",
                      )}
                    >
                      $4,500
                    </p>
                  </div>

                  {/* Girl — in front of dollar + earnings card */}
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center">
                    <div className="relative -mb-[4%] h-[88%] w-[98%] sm:w-[86%]">
                      <Image
                        src="/images/88ea43859c754cb864b7440ecca779c37d8d6e5d.png"
                        alt="Creator checking earnings on Game of Creators"
                        fill
                        priority
                        className="origin-bottom scale-[1.12] object-contain object-bottom"
                        sizes="(max-width: 1024px) 90vw, 480px"
                      />
                    </div>
                  </div>

                  {/* $600 credited notification — in front of girl */}
                  <div className="pointer-events-none   bg-[#FFFFFFCC]
  border-[0.64px]
  border-[#FFFFFF40]
  backdrop-blur-[19.0909px]
  shadow-[0px_10.18px_20.36px_-2.55px_#00000026] absolute left-[2%] top-[68%] z-20 w-[min(94%,260px)] rounded-2xl px-3 py-2.5 text-black sm:left-[18%] sm:top-[65%] sm:w-[300px] sm:px-3.5 sm:py-3">
                    <div className="flex items-start gap-2.5">
                      <div className="relative mt-0.5 flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white">
                        <Image
                          src="/images/Group.png"
                          alt=""
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px] scale-[1.55] object-contain"
                          sizes="18px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] leading-snug text-zinc-900 sm:text-sm">
                            <span className="font-semibold">GOC</span>{" "}
                            <span className="font-semibold">
                              $600 credited!
                            </span>
                          </p>
                          <span className="shrink-0 pt-0.5 text-[10px] text-zinc-500 sm:text-[11px]">
                            now
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-zinc-600 sm:text-xs">
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

        {/* Brand logos strip — same logos & design as brands page */}
        <section
          className={cn(
            "overflow-hidden pb-14 pt-2 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-black",
          )}
        >
          <p
            className={cn(
              "px-4 text-center text-sm sm:text-base",
              isLight ? "text-black/45" : "text-zinc-500",
            )}
          >
            Work with Top Brands with the network of 16k+ Creators
          </p>
          <div className="relative overflow-hidden scroll-container-testimonials">
            <div className="flex animate-scroll-left items-center justify-center gap-6">
              {[...brandImages, ...brandImages].map((image, index) => {
                const isLarge =
                  image === "/images/vows-streams-logo.avif" ||
                  image === "/images/song-gpt.logo.avif";
                const isCatchPhrase = image === "/images/catch-phrase.avif";
                const allImages = [...brandImages, ...brandImages];
                const nextImage =
                  index < allImages.length - 1 ? allImages[index + 1] : null;
                const isNextToLarge =
                  (isLarge || isCatchPhrase) &&
                  nextImage &&
                  (nextImage === "/images/vows-streams-logo.avif" ||
                    nextImage === "/images/song-gpt.logo.avif" ||
                    nextImage === "/images/catch-phrase.avif");
                return (
                  <div
                    key={`${image}-${index}`}
                    className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                      isCatchPhrase
                        ? "h-[96px] w-[160px] md:h-[120px] md:w-[200px]"
                        : isLarge
                          ? "h-[108px] w-[180px] md:h-[190px] md:w-[240px]"
                          : "h-[72px] w-[120px] md:h-[90px] md:w-[150px]"
                    } ${isNextToLarge ? "-mr-4 md:-mr-8" : ""}`}
                  >
                    <Image
                      src={image}
                      alt={`Brand logo ${index + 1}`}
                      width={isCatchPhrase ? 200 : isLarge ? 235 : 150}
                      height={isCatchPhrase ? 120 : isLarge ? 190 : 90}
                      className={cn(
                        "h-full w-full object-contain",
                        isLight && !isCatchPhrase && "brightness-0 opacity-80",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Contests Section */}
        <section
          className={cn(
            "overflow-visible px-3 py-10 sm:px-4 sm:py-16 transition-colors duration-300",
            isLight ? "text-black" : "text-white",
          )}
        >
          <div className="mx-auto max-w-[1400px] space-y-10 overflow-visible sm:space-y-12">
            {/* Most Popular Contests */}
            {finalMostPopularContests.length > 0 && (
              <div className="overflow-visible">
                <div className="mb-4 flex flex-col items-start justify-between gap-3 px-2 sm:mb-6 sm:flex-row sm:items-center sm:gap-0 sm:px-8 md:px-16">
                  <h2
                    className={cn(
                      "text-xl font-bold sm:text-2xl md:text-3xl",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
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
          className={cn(
            "scroll-mt-24 py-12 sm:py-16 md:py-20 transition-colors duration-300",
            isLight ? "text-black" : "text-white",
          )}
          ref={animationRef}
        >
          <div className="mx-auto max-w-[1200px] px-4 md:px-8 xl:px-4">
            <h2
              className={cn(
                "mb-8 text-center text-[28px] font-semibold tracking-tight sm:mb-10 sm:text-4xl md:mb-14 md:text-5xl",
                isAnimated ? "slide-up" : "hide-before-animate",
                isLight ? "text-black" : "text-white",
              )}
              style={{
                fontFamily: "Montserrat, sans-serif",
                animationDelay: "0.15s",
              }}
            >
              As easy as you think
            </h2>

            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              {/* Left: campaign collage + CTA */}
              <div
                className={cn(
                  "relative rounded-2xl overflow-hidden",
                  isAnimated ? "slide-left" : "hide-before-animate",
                  isLight
                    ? "border border-[#0000000D] bg-[#ECECEC]"
                    : "border border-white/10 bg-[#0a0a0a]",
                )}
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
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6A1A] hover:bg-[#ff7a33] text-white font-semibold px-6 py-6 text-sm sm:text-base shadow-lg shadow-orange-900/40 disabled:opacity-70"
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
                                ? isLight
                                  ? "text-black"
                                  : "text-white"
                                : isLight
                                  ? "text-black/40 group-hover:text-black/60"
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
                              <p
                                className={cn(
                                  "text-sm sm:text-base leading-relaxed max-w-md pb-3",
                                  isLight ? "text-black/50" : "text-zinc-400",
                                )}
                              >
                                {step.description}
                              </p>
                              <div
                                className={cn(
                                  "h-px w-full overflow-hidden rounded-full",
                                  isLight ? "bg-black/10" : "bg-zinc-800",
                                )}
                              >
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
          className={cn(
            "scroll-mt-24 px-4 py-12 sm:py-16 md:py-20 transition-colors duration-300",
            isLight ? "text-black" : "text-white",
          )}
          ref={howItWorksRef}
        >
          <div className="container mx-auto max-w-[1150px]">
            <h2
              className={cn(
                "mb-8 text-center text-[28px] font-semibold tracking-tight sm:mb-10 sm:text-4xl md:mb-14 md:text-5xl",
                howItWorksAnimated ? "slide-up" : "hide-before-animate",
                isLight ? "text-black" : "text-white",
              )}
              style={{
                fontFamily: "Montserrat, sans-serif",
                animationDelay: "0.1s",
              }}
            >
              Why Creators Choose GoC
            </h2>

            <div className="grid gap-4 md:gap-5">
              {/* Top row — 2 wide cards */}
              <div className="grid gap-4 md:grid-cols-2 md:gap-5">
                {/* Get Paid Directly */}
                <div
                  className={cn(
                    "relative w-full overflow-visible rounded-[20px] px-4 pb-5 pt-8 sm:px-6 sm:pb-[22px] sm:pt-[54px]",
                    isLight
                      ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A] text-black"
                      : "border border-[#303030] bg-[#151515] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
                  )}
                >
                  <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Account balance card */}
                    <div className="relative ml-3 w-full max-w-[204px] sm:ml-6 sm:h-[172px] sm:w-[204px]">
                      <div
                        className={cn(
                          "relative h-auto w-full rounded-[17px] px-[15px] pb-4 pt-[17px] sm:h-[172px] sm:pb-0",
                          isLight
                            ? "border border-[#0000000D] bg-[#F1F1F1]"
                            : "border border-[#2c2c2c] bg-[#151515]",
                        )}
                      >
                      <p
                        className={cn(
                          "text-[13px] font-normal uppercase tracking-[-0.1px]",
                          isLight ? "text-black/45" : "text-[#777]",
                        )}
                      >
                        Account Balance
                      </p>

                      <p
                        className={cn(
                          "mt-[5px] text-[30px] font-normal leading-none tracking-[-1px]",
                          isLight ? "text-black" : "text-[#e5e5e5]",
                        )}
                      >
                        $3,400
                      </p>

                      <button
                        className="
            mt-[15px]
            flex h-[34px] items-center gap-2
            rounded-[9px]
            bg-gradient-to-b from-[#ff9700] to-[#ee8500]
            px-[14px]
            text-[13px]
            font-medium
            text-white
            shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]
            transition
            hover:brightness-110
          "
                      >
                        <span className="text-[17px] leading-none">↗</span>
                        Withdraw
                      </button>
                      </div>
                    </div>

                    {/* Dashed connector — desktop only */}
                    <div
                      className={cn(
                        "hidden h-px flex-1 border-t border-dashed sm:block",
                        isLight ? "border-black/20" : "border-[#454545]",
                      )}
                    />

                    {/* Payment icons */}
                    <div className="flex items-center sm:shrink-0">
                      {/* Crypto */}
                      <div className="relative z-10 h-[43px] w-[43px] overflow-hidden rounded-full">
                        <Image
                          src="/images/Frame 2147243912.png"
                          alt="Crypto"
                          fill
                          className="object-cover"
                          sizes="43px"
                        />
                      </div>

                      {/* PhonePe */}
                      <div className="relative -ml-[9px] z-20 h-[43px] w-[43px] overflow-hidden rounded-full">
                        <Image
                          src="/images/Ellipse 41.png"
                          alt="PhonePe"
                          fill
                          className="object-cover"
                          sizes="43px"
                        />
                      </div>

                      {/* GPay */}
                      <div className="relative -ml-[9px] z-30 h-[43px] w-[43px] overflow-hidden rounded-full">
                        <Image
                          src="/images/Ellipse 42.png"
                          alt="GPay"
                          fill
                          className="object-cover"
                          sizes="43px"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom content */}
                  <div className="mt-6 sm:mt-[40px]">
                    <h2
                      className={cn(
                        "text-[18px] font-semibold leading-[26px] tracking-[-0.5px] sm:text-[22px] sm:leading-[28px]",
                        isLight ? "text-black" : "text-[#d0d0d0]",
                      )}
                    >
                      Get Paid Directly
                    </h2>

                    <p
                      className={cn(
                        "mt-[7px] text-[14px] font-normal leading-[22px] tracking-[-0.2px] sm:text-[17px] sm:leading-[24px]",
                        isLight ? "text-black/50" : "text-[#858585]",
                      )}
                    >
                      Withdraw your earnings straight to UPI and Crypto
                    </p>
                  </div>
                </div>

                {/* Create Together */}
                <div
                  className={cn(
                    "relative w-full max-w-[570px] overflow-hidden rounded-[20px] px-8 pb-9 pt-12",
                    isLight
                      ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                      : "border border-white/10 bg-[#171717]",
                  )}
                >
      {/* Dotted Curved Lines */}
      <svg
        className="pointer-events-none absolute left-0 top-8 h-[180px] w-full"
        viewBox="0 0 570 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-left curved lines */}
        <path
          d="M 95 80 Q 150 35 215 45"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        <path
          d="M 165 65 Q 215 20 270 40"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        {/* Top-right curved lines */}
        <path
          d="M 475 80 Q 420 35 355 45"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        <path
          d="M 405 65 Q 355 20 300 40"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        {/* Center-left curved connection */}
        <path
          d="M 270 42 Q 245 75 235 115"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        {/* Center-right curved connection */}
        <path
          d="M 300 42 Q 325 75 335 115"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.55"
        />

        {/* Outer-left arc */}
        <path
          d="M 40 100 Q 110 40 180 35"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.25"
        />

        {/* Outer-right arc */}
        <path
          d="M 530 100 Q 460 40 390 35"
          stroke={isLight ? "#A3A3A3" : "#737373"}
          strokeWidth="1"
          strokeDasharray="20 16"
          opacity="0.25"
        />
      </svg>

      {/* Creator Images */}
      <div className="relative z-10 flex h-[180px] items-start justify-center">

        {/* Top Creator */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-orange-400 bg-[#111] p-[2px]">
            <Image
              src="/images/Ellipse 2355.avif"
              alt="Creator"
              width={48}
              height={48}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>

        {/* Left Creator */}
        <div className="absolute left-[22%] top-[90px]">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/60 bg-[#222] p-[2px]">
            <Image
              src="/images/Ellipse 2355 (1).avif"
              alt="Creator"
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>

        {/* Right Creator */}
        <div className="absolute right-[22%] top-[90px]">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/60 bg-[#222] p-[2px]">
            <Image
              src="/images/Ellipse 2355 (2).avif"
              alt="Creator"
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>

        {/* Bottom-left Creator */}
        <div className="absolute left-[35%] top-[130px]">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/60 bg-[#222] p-[2px]">
            <Image
              src="/images/Ellipse 2355 (3).avif"
              alt="Creator"
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>

        {/* Bottom-right Creator */}
        <div className="absolute right-[35%] top-[130px]">
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/60 bg-[#222] p-[2px]">
            <Image
              src="/images/Ellipse 2355 (4).avif"
              alt="Creator"
              width={40}
              height={40}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="relative z-10 mt-2">
        <h3
          className={cn(
            "text-[22px] font-semibold",
            isLight ? "text-black" : "text-white/80",
          )}
        >
          Create Together
        </h3>

        <p
          className={cn(
            "mt-2 text-[16px]",
            isLight ? "text-black/50" : "text-white/50",
          )}
        >
          Connect with creators and share opportunities.
        </p>
      </div>
    </div>
              </div>

              {/* Bottom row — 3 cards */}
              <div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
                {/* Know Your Numbers */}
                <div
                  className={cn(
                    "relative h-[340px] w-full min-w-0 overflow-hidden rounded-[20px] sm:h-[365px]",
                    isLight
                      ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                      : "border border-white/10 bg-[#171717] shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
                  )}
                >
                  {/* Chart area */}
                  <div className="absolute left-4 right-4 top-4 h-[180px] sm:left-6 sm:right-6 sm:top-6 sm:h-[205px]">
                    {/* Grid */}
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: isLight
                          ? `
              linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)
            `
                          : `
              linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)
            `,
                        backgroundSize: "34px 34px",
                      }}
                    />

                    {/* Chart line */}
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 340 180"
                      fill="none"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M38 142
               C55 153, 67 145, 78 116
               C91 82, 104 91, 117 113
               C132 139, 143 149, 158 133
               C174 115, 168 72, 192 59
               C213 48, 229 82, 244 71
               C256 63, 248 38, 258 28"
                        stroke="#FF8800"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />

                      {/* Highlight point */}
                      <circle
                        cx="192"
                        cy="59"
                        r="4"
                        fill={isLight ? "#111" : "white"}
                      />
                    </svg>

                    {/* Shares badge */}
                    <div
                      className={cn(
                        "absolute left-[8px] top-[8px] flex items-center gap-2 rounded-full px-2 py-1.5 shadow-lg sm:left-[18px]",
                        isLight
                          ? "bg-white shadow-[0_8px_20px_rgba(0,0,0,0.1)]"
                          : "bg-[#171717]/95",
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D8C2FF]">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#7F39EC"
                          strokeWidth="1.8"
                        >
                          <path d="M20 4L10.5 13.5" />
                          <path d="M20 4L14 20L10.5 13.5L4 10L20 4Z" />
                        </svg>
                      </div>

                      <div className="pr-1 leading-none">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isLight ? "text-black" : "text-white",
                          )}
                        >
                          423
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[9px]",
                            isLight ? "text-black/40" : "text-white/40",
                          )}
                        >
                          Shares
                        </p>
                      </div>
                    </div>

                    {/* Earnings icon */}
                    <div className="absolute right-[8px] top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white sm:right-[15px]">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D9FFD9]">
                        <span className="text-xl font-light text-[#36C759]">
                          $
                        </span>
                      </div>
                    </div>

                    {/* Views badge */}
                    <div
                      className={cn(
                        "absolute bottom-[12px] right-[0px] flex items-center gap-2 rounded-full px-2.5 py-1.5 sm:bottom-[18px] sm:right-[3px]",
                        isLight
                          ? "bg-white shadow-[0_8px_20px_rgba(0,0,0,0.1)]"
                          : "bg-[#171717] shadow-[0_8px_20px_rgba(0,0,0,0.4)]",
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFE0C8]">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#FF8800]">
                          <div className="h-2.5 w-2.5 rounded-full bg-[#FF8800]" />
                        </div>
                      </div>

                      <div className="pr-1 leading-none">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isLight ? "text-black" : "text-white",
                          )}
                        >
                          1.2M
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[9px]",
                            isLight ? "text-black/40" : "text-white/40",
                          )}
                        >
                          Views
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Text */}
                  <div className="absolute bottom-5 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
                    <h3
                      className={cn(
                        "text-[18px] font-semibold leading-tight sm:text-[21px]",
                        isLight ? "text-black" : "text-white/80",
                      )}
                    >
                      Know Your Numbers
                    </h3>

                    <p
                      className={cn(
                        "mt-2 text-[14px] leading-5 sm:text-[16px] sm:leading-6",
                        isLight ? "text-black/50" : "text-white/45",
                      )}
                    >
                      Track views, performance, and
                      <br className="hidden sm:block" /> earnings easily.
                    </p>
                  </div>
                </div>

                {/* Pick What Fits */}
                <div
                  className={cn(
                    "relative h-[340px] w-full min-w-0 overflow-hidden rounded-[20px] sm:h-[365px]",
                    isLight
                      ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                      : "border border-white/[0.08] bg-[#171717]",
                  )}
                >
                  {/* Filter chips */}
                  <div className="absolute inset-x-0 top-[72px] px-4 sm:top-[94px] sm:px-0">
                    <div className="mx-auto flex max-w-[540px] flex-wrap justify-center gap-2 sm:absolute sm:-left-[58px] sm:top-0 sm:w-[540px] sm:justify-start sm:gap-[10px]">
                      {filters.map((filter, index) => (
                        <div
                          key={`${filter}-${index}`}
                          className={cn(
                            "flex h-[32px] shrink-0 items-center rounded-full px-3 text-[12px] font-medium leading-none sm:h-[37px] sm:px-4 sm:text-[13px]",
                            isLight
                              ? "border border-[#0000000D] bg-[#DEDEDE] text-black/70 shadow-[0px_11px_21.99px_0px_#FFFFFF5C]"
                              : "bg-[#555] text-[#e5e5e5]",
                          )}
                        >
                          {filter}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Text — aligned with Know Your Numbers */}
                  <div className="absolute bottom-5 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
                    <h3
                      className={cn(
                        "text-[18px] font-semibold leading-tight sm:text-[21px]",
                        isLight ? "text-black" : "text-white/80",
                      )}
                    >
                      Pick What Fits
                    </h3>

                    <p
                      className={cn(
                        "mt-2 text-[14px] leading-5 sm:text-[16px] sm:leading-6",
                        isLight ? "text-black/50" : "text-white/45",
                      )}
                    >
                      Choose campaigns that match your
                      <br className="hidden sm:block" /> content style.
                    </p>
                  </div>
                </div>

                {/* Grow With Every Campaign */}
                <div
                  className={cn(
                    "relative h-[340px] w-full min-w-0 overflow-hidden rounded-[20px] sm:col-span-2 sm:h-[365px] lg:col-span-1",
                    isLight
                      ? "border border-[#0000000D] bg-[#ECECEC] shadow-[inset_0_0_4.43px_0_#0000001A]"
                      : "border border-white/[0.08] bg-[#171717]",
                  )}
                >
                  {/* Dashboard image */}
                  <div className="absolute left-3 right-3 top-3 h-[190px] overflow-hidden sm:left-5 sm:right-5 sm:top-5 sm:h-[210px]">
                    <img
                      src={
                        isLight
                          ? "/images/a8cebf9956a898eff2d6dfe3fe37bced6fe30b81.png"
                          : "/images/b8bc146b928ab4b457b74850bfdaf6ab72f59d8e.png"
                      }
                      alt="Campaign dashboard"
                      className="h-full w-full object-cover object-top"
                    />
                    {/* Soft edge shade — fades image into card */}
                    {isLight ? (
                      <>
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#ECECEC] via-[#ECECEC]/70 to-transparent" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#ECECEC] via-[#ECECEC]/70 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#ECECEC] via-[#ECECEC]/60 to-transparent" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-[#ECECEC] via-[#ECECEC]/85 to-transparent" />
                      </>
                    ) : (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#171717] to-transparent" />
                    )}
                  </div>

                  {/* Card fade into text area */}
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t to-transparent",
                      isLight
                        ? "from-[#ECECEC] via-[#ECECEC]/95"
                        : "from-[#171717] via-[#171717]/90",
                    )}
                  />

                  {/* Text — aligned with Know Your Numbers */}
                  <div className="absolute bottom-5 left-4 right-4 z-10 sm:bottom-6 sm:left-6 sm:right-6">
                    <h3
                      className={cn(
                        "text-[18px] font-semibold leading-tight sm:text-[21px]",
                        isLight ? "text-black" : "text-white/80",
                      )}
                    >
                      Grow With Every Campaign
                    </h3>

                    <p
                      className={cn(
                        "mt-2 text-[14px] leading-5 sm:text-[16px] sm:leading-6",
                        isLight ? "text-black/50" : "text-white/45",
                      )}
                    >
                      Build experience, performance, and
                      <br className="hidden sm:block" /> earning potential.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Testimonials />

        <section
          className={cn(
            "relative flex min-h-[420px] w-full items-center justify-center overflow-hidden px-4 py-16 sm:min-h-[560px] sm:py-20 md:min-h-[700px] transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-black",
          )}
        >
          {/* Orange glow */}
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px] sm:h-[500px] sm:w-[500px]",
              isLight ? "bg-orange-500/20" : "bg-orange-500/10",
            )}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-2 text-center">
            {/* Number */}
            <h1
              className={cn(
                "text-[52px] font-bold leading-none tracking-[-0.04em] sm:text-[100px] md:text-[120px] lg:text-[124px]",
                isLight ? "text-black" : "text-white",
              )}
            >
              16,700+
            </h1>

            {/* Subtitle */}
            <p
              className={cn(
                "mt-4 text-[16px] font-semibold tracking-[-0.02em] sm:mt-5 sm:text-[21px] md:text-[22px]",
                isLight ? "text-black/55" : "text-white/70",
              )}
            >
              creators have already Joined
            </p>

            {/* Button */}
            <button
              type="button"
              className={cn(
                "group mt-6 flex items-center gap-3 rounded-[22px] border border-orange-400 px-5 py-3.5 text-[15px] font-semibold shadow-[0_0_25px_rgba(255,120,0,0.45)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_35px_rgba(255,120,0,0.65)] sm:mt-8 sm:px-6 sm:py-4 sm:text-[17px]",
                isLight
                  ? "bg-[#FF6A1A] text-white"
                  : "bg-white text-orange-500",
              )}
            >
              <span>Make you turn</span>

              <ArrowRight
                size={22}
                strokeWidth={1.8}
                className="
              transition-transform duration-300
              group-hover:translate-x-1
            "
              />
            </button>
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
                className="inline-flex w-full items-center justify-center gap-2 border-slate-600 bg-transparent text-base text-md text-slate-200 hover:bg-slate-800 hover:text-white px-6 py-5 sm:w-auto"
                onClick={handleContinueAsAdvertiser}
                disabled={isSigningOut || isNavigating}
              >
                {isNavigating ? <ButtonLoadingSpinner /> : null}
                <span>Continue as Brand</span>
              </Button>
              <Button
                className="inline-flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#DD7209] to-[#FF652D] text-md text-white hover:from-[#DD7209]/90 hover:to-[#FF652D]/90 px-6 py-5 sm:w-auto"
                onClick={handleSignOutAndContinueCreator}
                disabled={isSigningOut || isNavigating}
              >
                {isSigningOut ? <ButtonLoadingSpinner /> : null}
                <span>Sign out & Continue as Creator</span>
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
