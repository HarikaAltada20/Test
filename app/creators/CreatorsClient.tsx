"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

import NumbersSection from "@/components/NumberSection";
import {
  ArrowRight,
  Star,
  Users,
  Crown,
  Target,
  Trophy,
  Palette,
  Camera,
  Heart,
  Gift,
  Sparkles,
  Clock,
  Calendar,
  DollarSign,
  Eye,
  ShoppingBag,
  Wallet,
  Coins,
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
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { FaDiscord } from "react-icons/fa";
import { createClient } from "@/utils/supabase/client";
import { formatLocalDateTime } from "@/lib/utils";
import { getPlatformIconWithFallback } from "@/lib/platform-icons";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
// Placeholder for social icons image - replace with actual path if different
import socialPair from "@/public/images/social_pair.avif";

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
      "Simply sign up as a creator and connect your social media accounts (Instagram, YouTube, etc.) from which you want to participate in contests.",
    icon: <Users className="h-8 w-8" />,
    gradient: "from-violet-600 to-purple-600",
    color: "bg-[#7F39EC87] border-4 border-[#7F39EC]",
  },
  {
    number: "2",
    title: "Browse & Choose Contests",
    description:
      "Explore available contests from brands looking for creators. Filter opportunities based on prize pool, competition, end date, platform, and contest type to find the best match for you.",
    icon: <Target className="h-8 w-8" />,
    gradient: "from-blue-600 to-indigo-600",
    color: "bg-[#444DE787] border-4 border-[#454DE5]",
  },
  {
    number: "3",
    title: "Create & Submit Content",
    description:
      "Once you've found the right contest, create content that aligns with the brand's brief and follows the contest rules. Post it on your social media, then submit the link through our platform.",
    icon: <Camera className="h-8 w-8" />,
    gradient: "from-amber-600 to-orange-600",
    color: "bg-[#E75D0D8F] border-4 border-[#E65D09]",
  },
  {
    number: "4",
    title: "Get Paid Based on Performance",
    description:
      "Earn money based on how your content performs. For Leaderboard contests, you get paid based on your rank (determined by views). For CPM contests, you get paid purely based on the views your content generates.",
    icon: <Trophy className="h-8 w-8" />,
    gradient: "from-emerald-600 to-teal-600",
    color: "bg-[#0C94825C] border-4 border-[#08947E]",
  },
];

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
  totalViews,
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
    null
  );
  const [showAdvertiserModal, setShowAdvertiserModal] = useState(false);
  const [isCheckingStartEarning, setIsCheckingStartEarning] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingContestId, setNavigatingContestId] = useState<string | null>(null);
  const [isNavigatingViewMore, setIsNavigatingViewMore] = useState(false);

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
      { threshold: 0.3 } // Use lower threshold to ensure all trigger
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
        `
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
      console.error("Failed to verify account type before creator sign-up:", error);
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
      console.error("Failed to sign out advertiser before creator sign-up:", error);
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
      (c) => c.status === "active" || c.status === "upcoming"
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
    limit: number
  ) => {
    const liveFiltered = sourceContests.filter(
      (c) => c.status === "active" || c.status === "upcoming"
    );
    const endedFiltered = sourceContests.filter((c) => c.status === "ended");

    // If there are live contests, include both live and ended
    if (liveFiltered.length > 0) {
      return [...liveFiltered, ...endedFiltered].slice(0, limit);
    }

    // If no live contests, return only ended (up to limit)
    return endedFiltered.slice(0, limit);
  };

  // STEP 1: Most Popular contests - MUST get 4 live (active only) contests (compulsory)
  // Ensure diversity: different platforms and contest types, prioritizing highest budgets
  const availableForMostPopular = contests.filter((c) => {
    // Only include active (live) contests - exclude upcoming and ended
    if (c.status !== "active") {
      return false;
    }
    // Only include contests with a valid budget/prize
    const value =
      c.contest_type === "cpm"
        ? c.contest_based_details?.cpm_contest?.total_budget
        : c.contest_based_details?.leaderboard_contest?.total_prize;
    return value && value > 0;
  });

  const sortedForMostPopular = [...availableForMostPopular].sort((a, b) => {
    // First: Get budget/prize value
    const getBudget = (contest: any) => {
      if (contest.contest_type === "cpm") {
        return contest.contest_based_details?.cpm_contest?.total_budget || 0;
      } else if (contest.contest_type === "leaderboard") {
        return (
          contest.contest_based_details?.leaderboard_contest?.total_prize || 0
        );
      }
      return 0;
    };

    // Second: Get CPM rate (only for CPM contests)
    const getCpmRate = (contest: any) => {
      if (contest.contest_type === "cpm") {
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
    finalMostPopularContests.map((c) => c.id)
  );

  // STEP 2: Instagram and YouTube contests - use remaining contests (active, upcoming, and ended)
  // Exclude contests already shown in Most Popular section
  const instagramContests = getContestsWithLiveAndEnded(
    contests.filter(
      (c) =>
        c.platform?.toLowerCase() === "instagram" &&
        !mostPopularContestIds.has(c.id)
    ),
    5
  );
  const youtubeContests = getContestsWithLiveAndEnded(
    contests.filter(
      (c) =>
        c.platform?.toLowerCase() === "youtube" &&
        !mostPopularContestIds.has(c.id)
    ),
    5
  );

  // Calculate total budget for all campaigns (live, upcoming, and ended)
  const totalBudget = contests.reduce((sum, contest) => {
    if (contest.contest_type === "cpm") {
      return (
        sum + (contest.contest_based_details?.cpm_contest?.total_budget || 0)
      );
    } else if (contest.contest_type === "leaderboard") {
      return (
        sum +
        (contest.contest_based_details?.leaderboard_contest?.total_prize || 0)
      );
    }
    return sum;
  }, 0);

  // Calculate total contests published
  const totalContests = contests.length;

  const renderContestCard = (contest: any) => {
    // Calculate budget used percentage
    let budgetUsedPercent = 0;
    let totalBudget = 0;
    let budgetSpent = 0;
    let cpmRate = null;

    if (contest.contest_type === "cpm") {
      totalBudget =
        contest.contest_based_details?.cpm_contest?.total_budget || 0;
      budgetSpent =
        contest.contest_based_details?.cpm_contest?.budget_spent || 0;
      cpmRate = contest.contest_based_details?.cpm_contest?.cpm_rate_usd;
      if (totalBudget > 0) {
        budgetUsedPercent = Math.min(
          Math.round((budgetSpent / totalBudget) * 100),
          100
        );
      }
    } else if (contest.contest_type === "leaderboard") {
      totalBudget =
        contest.contest_based_details?.leaderboard_contest?.total_budget || 0;
      budgetSpent =
        contest.contest_based_details?.leaderboard_contest?.budget_spent || 0;
      if (totalBudget > 0) {
        budgetUsedPercent = Math.min(
          Math.round((budgetSpent / totalBudget) * 100),
          100
        );
      }
    }

    // Get budget/prize amount for display
    const budgetAmount =
      contest.contest_type === "cpm"
        ? contest.contest_based_details?.cpm_contest?.total_budget
        : contest.contest_based_details?.leaderboard_contest?.total_prize;

    return (
      <div
        key={contest.id}
        onClick={() => handleViewContest(contest.id)}
        className={cn(
          "relative w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px] flex-shrink-0 overflow-hidden rounded-2xl border border-slate-700 bg-[#06021D] p-1 pb-2 font-medium transition-transform duration-150 ease-in-out hover:scale-105 hover:border-orange-400 cursor-pointer my-2",
          navigatingContestId === contest.id && "opacity-70 cursor-not-allowed"
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

          {/* Budget used text - only show for CPM contests */}
          {contest.contest_type === "cpm" && totalBudget > 0 && (
            <span className="mt-1 text-[9px] sm:text-[10px] text-slate-400">
              {budgetUsedPercent}% budget used
            </span>
          )}
        </div>

        {/* Progress bar - only show for CPM contests */}
        {contest.contest_type === "cpm" && totalBudget > 0 && (
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
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
      <div className="relative z-20">
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
          {/* Strategic Background Elements */}

          {/* Floating Creative Elements */}
          <div className="inset-0 z-10 pointer-events-none">
            <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
            <Sparkles
              className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
              style={{ animationDelay: "1s" }}
            />
            <Star
              className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
              style={{ animationDelay: "2s" }}
            />
            <Heart
              className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
              style={{ animationDelay: "0.5s" }}
            />
            <Palette
              className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
              style={{ animationDelay: "1.5s" }}
            />
            <Trophy
              className="absolute bottom-32 right-12 h-9 w-9 text-amber-400/40 animate-bounce"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          {/* Orange Ellipse Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1250px] h-[600px] rounded-full blur-3xl opacity-50 pointer-events-none bg-orange-ellipse"></div>

          <div className="container mx-auto px-6 sm:px-10 lg:px-16 text-center relative z-10">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2.5 bg-[#FFFFFF0F] border border-[#FFFFFF1A] rounded-full px-4 py-2 sm:px-5 sm:py-2.5 mb-8 mx-auto backdrop-blur-sm">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-400"></span>
              </span>
              <span className="text-xs sm:text-base font-semibold text-white leading-tight">
                <span className="text-orange-400">
                  {totalViews.toLocaleString("en-US")}+
                </span>{" "}
                views generated so far!
              </span>
            </div>

            {/* Enhanced Social Icons */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <Image
                    src={socialPair}
                    alt="Social Media Icons"
                    width={200}
                    height={55}
                    className="relative z-10"
                  />
                </div>
              </div>
            </div>

            {/* Massive Gaming Title */}
            <h1
              className="text-4xl md:text-6xl lg:text-7xl mb-6 leading-tight slide-up"
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold  text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Turn Your Creativity Into
              </span>
              <span
                className="block font-semibold text-white drop-shadow-2xl"
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
                    Income
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl "></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              Join{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">
                Game of Creators
              </span>{" "}
              and get paid based on{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                views or ranking
              </span>{" "}
              — even if you have 0 followers
            </p>

            {/* Call-to-Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
              <Button
                type="button"
                onClick={handleStartEarningClick}
                disabled={isCheckingStartEarning}
                className="rounded-3xl relative bg-gradient-to-r from-[#FF512F] to-[#F09819] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#FF512F]/90 hover:to-[#F09819]/90 transition-all duration-300 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCheckingStartEarning ? <ButtonLoadingSpinner /> : <Sparkles className="h-4 w-4" />}
                <span>Start Earning →</span>
              </Button>

              <Button
                variant="outline"
                className="rounded-3xl border-2 border-slate-400/40 text-slate-300 font-semibold px-8 py-6 text-lg hover:border-orange-400/50 hover:text-orange-400 transition-all duration-300 bg-transparent hover:bg-slate-800/20 hover:shadow-lg"
                asChild
              >
                <a
                  href="https://youtu.be/KrtpC2DB9zk?si=2OOUFF1803HDiC6N"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch Demo
                </a>
              </Button>
            </div>

            {/* Creator Discord link (replaces social proof line) */}
            <div className="flex justify-center items-center mb-8">
              <a
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#5865F2]/30 bg-[#5865F2]/10 px-4 py-2 text-sm text-[#C7CEFF] hover:bg-[#5865F2]/20 hover:shadow-[0_0_18px_rgba(88,101,242,0.35)] hover:ring-1 hover:ring-[#5865F2]/40 transition-all"
              >
                <FaDiscord className="h-4 w-4 text-[#5865F2]" />
                Join Creator Community
              </a>
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
                      isNavigatingViewMore && "opacity-70 cursor-not-allowed"
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

        {/* Why Join as Creator - Gaming Style */}
        <section className="text-white py-16" ref={animationRef}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-12 xl:px-4 text-center">
            {/* Heading */}
            <h2
              className={`text-3xl md:text-5xl text-slate-300 max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{ animationDelay: "0.2s" }}
            >
              Why Join as a{" "}
              <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                Creator
              </span>
            </h2>
            <p
              className={`text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-left" : "hide-before-animate"
              }`}
              style={{ animationDelay: "1s" }}
            >
              Unlock your creative potential and monetise your passion
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Earn Money",
                  description:
                    "Get paid for creating content for brands you love through contests and collaborations.",
                  number: "1",
                  image:
                    "/images/c89a26089c94c4806f6c5d35d5a13d7b9b4abe4d.avif", // first card image
                },
                {
                  title: "Build Your Portfolio",
                  description:
                    "Create professional content for recognized brands to showcase in your portfolio.",
                  number: "2",
                  image:
                    "/images/6260ed20a17f3e1217628986a9525a3a5987b46f.avif", // second card image
                },
                {
                  title: "Grow Your Audience",
                  description:
                    "Gain exposure when brands share and promote your content to their followers.",
                  number: "3",
                  image:
                    "/images/e8e9c22eb82571682f04cec79d2d2cb1276138fc.avif", // third card image
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="cursor-pointer relative border border-gray-500 rounded-xl p-[50px] flex flex-col items-center text-center hover:shadow-lg transition overflow-hidden group"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      backgroundImage: `url(${item.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  ></div>

                  {/* Shade Overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-[#00000066] to-[#00000099]"></div>

                  <div
                    className="relative z-10 w-[50px] h-[50px] text-3xl flex items-center justify-center rounded-full text-white font-bold mb-4"
                    style={{
                      background:
                        "linear-gradient(180deg, #DC7308 0%, #FF652D 100%)",
                    }}
                  >
                    {item.number}
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 text-2xl md:text-3xl mt-5 font-semibold mb-2">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-gray-300 mt-5 text-lg lg:text-xl">
                    {item.description}
                  </p>
                </div>
              ))}
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

        {/* How it Works - New Design */}
        <section
          className="py-16 px-4 md:px-16 xl:px-4 text-white"
          ref={howItWorksRef}
        >
          <div className="container mx-auto max-w-[1250px]">
            <div className="text-center mb-12">
              <h2
                className={`text-3xl md:text-5xl text-slate-300 font-bold max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg ${
                  howItWorksAnimated ? "slide-up" : "hide-before-animate"
                }`}
                style={{ animationDelay: "0.1s" }}
              >
                How it{" "}
                <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                  works
                </span>
              </h2>
              <p
                className={`text-lg md:text-xl text-gray-300 ${
                  howItWorksAnimated ? "slide-left" : "hide-before-animate"
                }`}
                style={{ animationDelay: "0.5s" }}
              >
                The easiest way to get paid for your content.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {/* Link Account Card */}
              <div className="group relative rounded-2xl border border-[#FFB366]/70 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_26px_70px_rgba(255,179,102,0.6)] hover:border-[#FF8C42] hover:ring-2 hover:ring-[#FFB366]/60">
                <div className="relative w-full h-80 md:h-96 bg-slate-900/10 overflow-hidden">
                  {/* light gradient only at bottom for text readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  <Image
                    src="/images/link---account.avif"
                    alt="Link account"
                    fill
                    className="object-contain group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                  />
                </div>

                <div className="relative p-7 flex flex-col gap-4 flex-1">
                  {/* accent bar */}
                  <div className="h-0.5 w-10 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB366] to-[#FF8C42] mb-1 group-hover:w-16 transition-all duration-500" />

                  <h3 className="font-semibold text-lg lg:text-xl text-slate-50 group-hover:text-[#FFB366] transition-colors duration-300">
                    Link account
                  </h3>
                  <p className="text-sm lg:text-[15px] text-slate-300/90 leading-relaxed group-hover:text-slate-100 transition-colors">
                    Connect your social profiles to Game of Creators to verify
                    ownership.
                  </p>
                </div>
              </div>

              {/* Submit Content Card */}
              <div className="group relative rounded-2xl border border-[#FFB366]/70 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_26px_70px_rgba(255,179,102,0.6)] hover:border-[#FF8C42] hover:ring-2 hover:ring-[#FFB366]/60">
                <div className="relative w-full h-80 md:h-96 bg-slate-900/10 overflow-hidden">
                  {/* light gradient only at bottom for text readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  <Image
                    src="/images/content.avif"
                    alt="Submit content"
                    fill
                    className="object-contain group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                  />
                </div>

                <div className="relative p-7 flex flex-col gap-4 flex-1">
                  {/* accent bar */}
                  <div className="h-0.5 w-10 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB366] to-[#FF8C42] mb-1 group-hover:w-16 transition-all duration-500" />

                  <h3 className="font-semibold text-lg lg:text-xl text-slate-50 group-hover:text-[#FFB366] transition-colors duration-300">
                    Submit content
                  </h3>
                  <p className="text-sm lg:text-[15px] text-slate-300/90 leading-relaxed group-hover:text-slate-100 transition-colors">
                    Create and post content, then submit your link to start
                    tracking views.
                  </p>
                </div>
              </div>

              {/* Get Paid Card */}
              <div className="group relative rounded-2xl border border-[#FFB366]/70 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_26px_70px_rgba(255,179,102,0.6)] hover:border-[#FF8C42] hover:ring-2 hover:ring-[#FFB366]/60">
                <div className="relative w-full h-80 md:h-96 bg-slate-900/10 overflow-hidden">
                  {/* light gradient only at bottom for text readability */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  <Image
                    src="/images/balance.avif"
                    alt="Get paid"
                    fill
                    className="object-contain group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                  />
                </div>

                <div className="relative p-7 flex flex-col gap-4 flex-1">
                  {/* accent bar */}
                  <div className="h-0.5 w-10 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB366] to-[#FF8C42] mb-1 group-hover:w-16 transition-all duration-500" />

                  <h3 className="font-semibold text-lg lg:text-xl text-slate-50 group-hover:text-[#FFB366] transition-colors duration-300">
                    Get paid
                  </h3>
                  <p className="text-sm lg:text-[15px] text-slate-300/90 leading-relaxed group-hover:text-slate-100 transition-colors">
                    Earn automatically for every verified view your content
                    generates.
                  </p>
                </div>
              </div>
            </div>

            {/* Start Earning Button */}
            <div className="text-center">
              <Button
                type="button"
                onClick={handleStartEarningClick}
                disabled={isCheckingStartEarning}
                className="rounded-3xl relative bg-gradient-to-r from-[#FF512F] to-[#F09819] text-white font-bold px-8 py-6 text-lg overflow-hidden hover:from-[#FF512F]/90 hover:to-[#F09819]/90 transition-all duration-300 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCheckingStartEarning ? <ButtonLoadingSpinner /> : null}
                Start earning
              </Button>
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

        <Dialog open={showAdvertiserModal} onOpenChange={setShowAdvertiserModal}>
          <DialogContent className="bg-[#050816] border border-orange-500/30 text-white rounded-2xl shadow-2xl shadow-orange-900/40 sm:max-w-xl p-8">
            <DialogHeader>
              {/* <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500/30 to-amber-500/30 border border-orange-400/30">
                <Sparkles className="h-6 w-6 text-orange-300" />
              </div> */}
                <DialogTitle
              className="text-xl mb-2 lg:text-2xl leading-tight"

            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                 You are logged in as {" "}
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
                To continue as a creator, please sign out from your brand account first, then log in or sign up as a creator account.
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
