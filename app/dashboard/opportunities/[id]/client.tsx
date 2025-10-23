"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Eye,
  Info,
  AlertCircle,
  Trophy,
  Youtube,
  Instagram,
  User,
  Users,
  Share2,
  ListOrdered,
  ScrollText,
  Link2,
  Lightbulb,
  PlayCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Monitor,
  Play,
  FileText,
  DollarSign,
  CheckCheck,
  Gift,
  Tag,
  Star,
  Copy,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn, formatLocalDateTime, formatTimeAgo } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import { renderStatusBadge } from "@/lib/status-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import {
  getMetricsRefreshCooldownInfoOpportunities,
  formatRemainingTime,
} from "@/lib/constants";
import type { UserResponse } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { TabContent, TabPanel } from "@/components/ui/tab-content";
import { useTabState } from "@/components/ui/tab-utils";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
// --- START DUMMY DATA CONFIGURATION ---
const USE_DUMMY_DATA_FOR_LEADERBOARD = false; // SWITCHED OFF FOR PRODUCTION
const DUMMY_ENTRIES_COUNT = 250; // Total number of dummy entries to generate
const MY_DUMMY_SUBMISSION_USER_ID = "user_dummy_me_special_id_123"; // A consistent ID for 'my' dummy submission
// --- END DUMMY DATA CONFIGURATION ---

// Define type for prize objects globally within the file
type PrizeInfo = {
  position: number;
  amount: number;
};
const tabs = [
  { id: "details", label: "Contest Details" },
  { id: "leaderboard", label: "Leaderboard" },
];

// Section navigation configuration
const sections = [
  { id: "earning-opportunities", label: "Earning Opportunities" },
  {
    id: "prize-structure",
    label: "Prize Structure",
    conditional: "leaderboard",
  }, // Only for leaderboard contests
  { id: "contest-details", label: "Contest Details" },
  { id: "content-requirements", label: "Content Requirements" },
  { id: "participation-guidelines", label: "Participation Guidelines" },
  { id: "resources-tools", label: "Resources & Tools" },
];
// LeaderboardEntry type reflects combined data from API
type LeaderboardEntry = {
  id: string;
  creator_id: string;
  video_title: string;
  video_thumbnail_url: string | null;
  views: number;
  earnings: number;
  status: string;
  created_at: string;
  content_link: string;
  platform: string;
  user_platform_username: string;
  user_full_name: string;
  creator_pfp_url: string | null;
  user_platform_pfp_url: string | null;
};

// Store for generated dummy data to avoid re-computation if count doesn't change
let generatedDummyDataCache: {
  entries: LeaderboardEntry[];
  myRank: number | null;
  count: number;
} | null = null;

const generateAllDummyLeaderboardData = (
  count: number
): { entries: LeaderboardEntry[]; myRank: number | null } => {
  if (generatedDummyDataCache && generatedDummyDataCache.count === count) {
    return {
      entries: generatedDummyDataCache.entries,
      myRank: generatedDummyDataCache.myRank,
    };
  }

  const entries: LeaderboardEntry[] = [];
  const platforms = ["youtube", "instagram"];
  let tempMyRank: number | null = null;

  for (let i = 0; i < count; i++) {
    const isMyEntry = i === Math.floor(count / 4); // Place 'my' entry deterministically
    const creatorId = isMyEntry
      ? MY_DUMMY_SUBMISSION_USER_ID
      : `user_dummy_${i}`;
    const username = isMyEntry ? "MyAwesomeSelf" : `Creator${i}`;
    const views = Math.floor(Math.random() * 750000) + 500; // Random views, wider range

    entries.push({
      id: `submission_dummy_${i}_${Math.random().toString(36).substring(7)}`,
      creator_id: creatorId,
      video_title: `Epic Content Vol. ${i + 1} - ${username}`,
      video_thumbnail_url: `https://picsum.photos/seed/${username}${i}/200/120`,
      views: views,
      earnings: Math.random() > 0.65 ? Math.floor(Math.random() * 150) + 10 : 0,
      status: "approved",
      created_at: new Date(
        Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000
      ).toISOString(), // random date in last 45 days
      content_link: "https://www.example.com/watch?v=dQw4w9WgXcQ", // A familiar link for all :)
      platform: platforms[i % platforms.length],
      user_platform_username: username,
      user_full_name: `${
        isMyEntry ? "The One And Only" : "Talented"
      } ${username.replace(/\d+/g, "")}`,
      creator_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}`,
      user_platform_pfp_url: `https://i.pravatar.cc/150?u=${creatorId}_platform`,
    });
  }

  entries.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const myEntryIndex = entries.findIndex(
    (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID
  );
  if (myEntryIndex !== -1) {
    tempMyRank = myEntryIndex + 1;
  }

  generatedDummyDataCache = { entries, myRank: tempMyRank, count };
  return { entries, myRank: tempMyRank };
};

// Client component that receives contestId as a prop
export function ContestClientPage({
  contestId,
  user,
}: {
  contestId: string;
  user: UserResponse["data"]["user"] | null;
}) {
  const [contest, setContest] = useState<any>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [maxSubmissions, setMaxSubmissions] = useState(1);
  const [showAllSubmissionsModal, setShowAllSubmissionsModal] = useState(false);
  const [modalViewMode, setModalViewMode] = useState<"simple" | "detailed">(
    "simple"
  );
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalItemsPerPage] = useState(10); // Show 10 submissions per page
  const { activeTab, setActiveTab } = useTabState(tabs, {
    defaultTab: "details",
  });

  // Pagination state for leaderboard
  const [leaderboardCurrentPage, setLeaderboardCurrentPage] = useState(1);
  const [leaderboardItemsPerPage, setLeaderboardItemsPerPage] = useState(25); // Or your preferred default
  const [totalLeaderboardEntries, setTotalLeaderboardEntries] = useState(0);
  const [totalLeaderboardPages, setTotalLeaderboardPages] = useState(0);

  // State for logged-in user's submission and rank
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<
    (LeaderboardEntry & { rank: number }) | null
  >(null);
  const [loadingMySubmission, setLoadingMySubmission] = useState(false);
  const [contestType, setContestType] = useState<string | null>(null); // Track contest type for verification badges

  // Leaderboard view mode state
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<
    "simple" | "detailed"
  >("simple");

  // Refresh metrics state for opportunities
  const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

  // Post-contest status state for creator transparency
  const [postContestStatus, setPostContestStatus] = useState<string | null>(
    null
  );

  // User profile data for link processing
  const [userProfile, setUserProfile] = useState<{
    full_name: string;
    username: string;
  } | null>(null);

  const { toast } = useToast();

  // Scroll spy state and functionality
  const [activeSection, setActiveSection] = useState("earning-opportunities");
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

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

  const isDark = mode === "dark";
  // Smooth scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      // Get the sticky navigation height + page header to calculate proper offset
      const navHeight = 180; // Page header (64px) + sticky nav (~60px) + padding
      const elementPosition =
        element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      // Immediately set the active section when clicking
      setActiveSection(sectionId);
    }
  }, []);

  // Utility function to extract firstName from full_name
  const getFirstName = (fullName: string): string => {
    if (!fullName) return "";
    return fullName.trim().split(" ")[0];
  };

  // Utility function to replace [creator] placeholder with username
  const processUrlWithCreator = (url: string, username: string): string => {
    if (!url || !username) return url;
    return url.replace(/\[creator\]/gi, username);
  };

  // Memoized user submissions for performance with large datasets
  const userSubmissions = useMemo(() => {
    if (!user?.id || !leaderboard.length) return [];

    // Filter leaderboard entries for current user and sort by views (highest first)
    return leaderboard
      .filter((entry) => entry.creator_id === user.id)
      .sort((a, b) => b.views - a.views);
  }, [user?.id, leaderboard]);

  // Memoized best submission (highest views)
  const bestSubmission = useMemo(() => {
    return userSubmissions.length > 0 ? userSubmissions[0] : null;
  }, [userSubmissions]);

  // Memoized rank lookup map for O(1) rank access
  const rankLookupMap = useMemo(() => {
    const map = new Map();
    leaderboard.forEach((entry, index) => {
      map.set(entry.id, index + 1);
    });
    return map;
  }, [leaderboard]);

  // Get user's submissions (now memoized)
  const getUserSubmissions = () => userSubmissions;

  // Get best submission (now memoized)
  const getBestSubmission = () => bestSubmission;

  const handleRefreshMetrics = async () => {
    if (!contest?.id) return;

    setIsRefreshingMetrics(true);

    try {
      const response = await fetch(
        `/api/contests/${contest.id}/refresh-metrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-refresh-source": "opportunities", // Identify this as opportunities refresh
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to refresh metrics");
      }

      // Update contest with new last_metrics_updated timestamp
      const newTimestamp =
        result.lastMetricsUpdated || new Date().toISOString();
      setContest((prev: any) => ({
        ...prev,
        last_metrics_updated: newTimestamp,
      }));

      // Refresh BOTH the leaderboard AND the user's own submission data
      await Promise.all([
        fetchLeaderboard(leaderboardCurrentPage),
        fetchMySubmissionData(),
      ]);
    } catch (error: any) {
      console.error("Failed to refresh metrics:", error);
      // In opportunities page, we'll silently handle errors or show a subtle notification
    } finally {
      setIsRefreshingMetrics(false);
    }
  };

  const fetchLeaderboard = async (pageToFetch: number = 1) => {
    if (!isMounted) return;
    setLoadingLeaderboard(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const totalEntries = allEntries.length;
      const totalPages = Math.ceil(totalEntries / leaderboardItemsPerPage);
      const startIndex = (pageToFetch - 1) * leaderboardItemsPerPage;
      const endIndex = startIndex + leaderboardItemsPerPage;
      const paginatedEntries = allEntries.slice(startIndex, endIndex);

      setTimeout(() => {
        if (isMounted) {
          setLeaderboard(paginatedEntries);
          setLastUpdated(new Date().toISOString());
          setLeaderboardCurrentPage(pageToFetch);
          setTotalLeaderboardPages(totalPages);
          setTotalLeaderboardEntries(totalEntries);
          setContestType("leaderboard"); // Set dummy contest type
          setLoadingLeaderboard(false);
        }
      }, 300);
      return;
    }

    // Real API Call
    let leaderboardFetchError = null;
    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}?page=${pageToFetch}&limit=${leaderboardItemsPerPage}`
      );
      const data = await response.json();
      if (!response.ok) {
        leaderboardFetchError = data.error || "Failed to fetch leaderboard";
        throw new Error(leaderboardFetchError);
      }
      if (isMounted) {
        setLeaderboard(data.leaderboard || []);
        setLastUpdated(data.lastUpdated);
        setLeaderboardCurrentPage(data.currentPage);
        setTotalLeaderboardPages(data.totalPages);
        setTotalLeaderboardEntries(data.totalEntries);
        setContestType(data.contestType || null); // Set contest type from API
      }
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      if (isMounted && !error) setError(leaderboardFetchError || err.message);
    } finally {
      if (isMounted) setLoadingLeaderboard(false);
    }
  };

  let isMounted = true; // Flag to track component mount status

  // Helper function to render verification badges
  const renderVerificationBadges = (status: string) => {
    return renderStatusBadge(status as any, contestType);
  };

  const renderPostContestStatusBadge = (status: string | null) => {
    if (!status) return null;

    let badgeColor = "bg-gray-500";
    let textColor = "text-white";
    let text = "Unknown";
    let icon = null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        badgeColor = "bg-blue-500";
        text = "Under Review";
        icon = <Clock className="h-3 w-3 mr-1" />;
        break;
      case "in_review":
        badgeColor = "bg-purple-500";
        text = "In Review";
        icon = <RefreshCw className="h-3 w-3 mr-1" />;
        break;
      case "verification_complete":
        badgeColor = "bg-green-500";
        text = "Verification Complete";
        icon = <CheckCircle className="h-3 w-3 mr-1" />;
        break;
      case "payouts_processed":
        badgeColor = "bg-emerald-600";
        text = "Payouts Processed";
        icon = <DollarSign className="h-3 w-3 mr-1" />;
        break;
      default:
        badgeColor = "bg-gray-500";
        text = "Unknown Status";
        break;
    }

    return (
      <Badge
        variant="secondary"
        className={`${badgeColor} ${textColor} text-sm px-3 py-1.5 rounded-full font-medium flex items-center`}
      >
        {icon}
        {text}
      </Badge>
    );
  };

  const getPostContestStatusDescription = (status: string | null) => {
    if (!status) return null;

    switch (status?.toLowerCase()) {
      case "pending_review":
        return "The contest has ended and submissions are being prepared for review.";
      case "in_review":
        return "Contest submissions are currently being reviewed and verified by our team.";
      case "verification_complete":
        return "All submissions have been verified. Winners and payouts are being finalized.";
      case "payouts_processed":
        return "Verification is complete and payouts have been processed to winners.";
      default:
        return "Contest status is being updated.";
    }
  };

  const fetchMySubmissionData = async () => {
    if (!isMounted) return;

    setLoadingMySubmission(true);

    if (USE_DUMMY_DATA_FOR_LEADERBOARD) {
      const { entries: allEntries, myRank } =
        generateAllDummyLeaderboardData(DUMMY_ENTRIES_COUNT);
      const myEntryData = allEntries.find(
        (e) => e.creator_id === MY_DUMMY_SUBMISSION_USER_ID
      );

      setTimeout(() => {
        if (isMounted) {
          if (myEntryData && myRank !== null) {
            // Add dummy verified status for testing
            setMyLeaderboardEntry({
              ...myEntryData,
              rank: myRank,
              status: "verified",
            });
          } else {
            setMyLeaderboardEntry(null);
          }
          setLoadingMySubmission(false);
        }
      }, 150);
      return;
    }

    // Real API Call
    if (!user || !contestId) {
      if (isMounted) setLoadingMySubmission(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}/my-submission`
      );
      const data = await response.json();
      if (!response.ok) {
        console.warn(
          "Failed to fetch user submission data:",
          data.error || "Unknown error"
        );
        if (isMounted) setMyLeaderboardEntry(null);
        return;
      }
      if (isMounted) {
        if (data.mySubmission && data.rank) {
          setMyLeaderboardEntry({ ...data.mySubmission, rank: data.rank });
        } else {
          setMyLeaderboardEntry(null);
        }
      }
    } catch (err: any) {
      console.error("Error fetching user's submission data:", err);
      if (isMounted) setMyLeaderboardEntry(null);
    } finally {
      if (isMounted) setLoadingMySubmission(false);
    }
  };

  const fetchPostContestStatus = async () => {
    if (!isMounted || !contestId) return;

    try {
      const { data: contestData, error } = await supabase
        .from("contests")
        .select("post_contest_status")
        .eq("id", contestId)
        .single();

      if (error) {
        console.error("Error fetching post-contest status:", error);
        return;
      }

      if (isMounted) {
        setPostContestStatus(contestData?.post_contest_status || null);
      }
    } catch (error) {
      console.error("Error fetching post-contest status:", error);
    }
  };

  // Clean up URL parameters on component mount
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "already_submitted") {
      // Clear the error parameter from URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, router]);

  // Scroll spy effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is most visible
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio to find the most visible section
          const mostVisible = visibleEntries.sort(
            (a, b) => b.intersectionRatio - a.intersectionRatio
          )[0];
          setActiveSection(mostVisible.target.id);
        }
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5],
        rootMargin: "-180px 0px -40% 0px", // Adjusted to account for page header + sticky nav height
      }
    );

    sections.forEach((section) => {
      const element = sectionRefs.current[section.id];
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      sections.forEach((section) => {
        const element = sectionRefs.current[section.id];
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, []);

  useEffect(() => {
    isMounted = true;

    // If NOT using dummy data for leaderboard, and user is not available, show loading.
    if (!USE_DUMMY_DATA_FOR_LEADERBOARD && !user) {
      setLoading(true);
      return;
    }

    async function fetchData() {
      if (!isMounted) return;
      setLoading(true); // Start with loading true for both paths initially
      setError(null);

      // Fetch contest details - this is usually needed for prize info, title, etc.
      // regardless of where leaderboard data comes from.
      try {
        const { data: contestData, error: contestError } = await supabase
          .from("contests_with_status")
          .select(`*, advertiser_profiles ( company_name )`)
          .eq("id", contestId)
          .maybeSingle();

        if (contestError) throw contestError;
        if (!contestData) throw new Error("Contest not found.");

        // Only published contests should be available to creators
        if (contestData.moderation_status !== "published") {
          throw new Error("This contest is not available.");
        }

        // Check if published contest has valid dates
        if (contestData.status === "incomplete") {
          throw new Error("This contest has incomplete information.");
        }
        if (isMounted) {
          setContest(contestData);

          // No need to set separate lastMetricsUpdate state - it's part of contest state
        }

        // Fetch existing submission status for the current user (if logged in)
        // This is separate from the main leaderboard logic.
        if (user) {
          try {
            const response = await fetch(
              `/api/leaderboard/${contestId}/my-submission`
            );
            if (response.ok) {
              const data = await response.json();
              if (
                data &&
                data.submissions &&
                data.submissions.length > 0 &&
                isMounted
              ) {
                const maxSubmissions =
                  contestData.max_submissions_per_creator || 1;
                setSubmissionCount(data.submissions.length);
                setMaxSubmissions(maxSubmissions);

                // For multiple submissions, only show "Submission Complete" if max reached
                if (contestData.multiple_submissions_enabled) {
                  if (data.submissions.length >= maxSubmissions) {
                    setHasSubmitted(true);
                    setExistingSubmission(data.submissions[0]);
                  }
                } else {
                  // For single submission contests, show complete if any submission exists
                  setHasSubmitted(true);
                  setExistingSubmission(data.submissions[0]);
                }
              }
            }
          } catch (error) {
            console.error("Error fetching user submissions:", error);
          }
        }
      } catch (err: any) {
        console.error("Error fetching initial page data:", err);
        if (isMounted) setError(err.message || "Failed to load page data");
      } finally {
        // Call leaderboard fetches after initial contest/user data attempt
        if (isMounted) {
          fetchLeaderboard(1);
          fetchMySubmissionData(); // This will use dummy data if flag is true
          fetchPostContestStatus(); // Fetch post-contest status for transparency
          setLoading(false); // Done with initial loading phase
        }
      }
    }

    fetchData();

    // Auto-refresh for leaderboard (only if NOT using dummy data)
    const intervalId = setInterval(() => {
      if (
        isMounted &&
        lastUpdated &&
        !loadingLeaderboard &&
        !USE_DUMMY_DATA_FOR_LEADERBOARD
      ) {
        const lastUpdateTime = new Date(lastUpdated).getTime();
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastUpdateTime < fiveMinutesAgo) {
          fetchLeaderboard(leaderboardCurrentPage);
        }
      }
    }, 60 * 1000);

    // Check for URL hash to set active tab
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash === "#leaderboard") {
        if (isMounted) setActiveTab("leaderboard");
      }
    }

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
    // Added leaderboardItemsPerPage to dependencies as it affects dummy data pagination
  }, [contestId, user, router, supabase, leaderboardItemsPerPage]);

  // Fetch user profile data for link processing
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;

      try {
        const { data: userData, error } = await supabase
          .from("users")
          .select("full_name, username")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (userData) {
          setUserProfile(userData);
        }
      } catch (error) {
        console.error("Error in fetchUserProfile:", error);
      }
    };

    fetchUserProfile();
  }, [user?.id, supabase]);

  // Reset modal page when modal opens
  useEffect(() => {
    if (showAllSubmissionsModal) {
      setModalCurrentPage(1);
    }
  }, [showAllSubmissionsModal]);

  const handleSubmitContent = () => {
    router.push(`/dashboard/opportunities/${contestId}/submit`);
  };

  const handleViewSubmission = (submissionId: string) => {
    router.push(`/dashboard/submissions`);
  };

  // Helper to format time ago

  // Show loading state ONLY when fetching data (loading state)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        {/* <div className="text-center">
          <p>Loading contest details...</p>
        </div> */}

        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  // Error UI handling (check error or missing contest AFTER loading is false)
  if (!loading && (error || !contest)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500">
            {error || "Failed to load contest details"}
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push("/dashboard/opportunities")}
          >
            Back to Opportunities
          </Button>
        </div>
      </div>
    );
  }

  const handleShare = async () => {
    if (contest.status === "ended") {
      toast({
        title: "Opportunity Completed",
        description:
          "This opportunity has ended. You can still share it to showcase the results and winners.",
        variant: "default",
      });
      // Allow sharing to proceed for completed opportunities
    }
    if (contest.status === "upcoming") {
      toast({
        title: "Not Live Yet",
        description:
          "This opportunity is not live yet. You can share it, but creators won't be able to participate until the start date.",
        variant: "default",
      });
      // Allow sharing to proceed
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: contest.title,
          text: `Check out this opportunity: ${contest.title}`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Opportunity link copied to clipboard!",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast({
        title: "Share Failed",
        description: "There was an error trying to share this opportunity.",
        variant: "destructive",
      });
    }
  };

  // Render main content
  return (
    <div className={cn("min-h-screen", isDark ? "bg-black" : "bg-slate-50")}>
      <div className="container mx-auto py-8 px-2 lg:px-4">
        {/* Improved Header Navigation */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex items-center gap-2 transition-all duration-200 hover:scale-105",
                isDark
                  ? "border-gray-500"
                  : "hover:bg-slate-100 border-slate-300 "
              )}
              onClick={() => router.push("/dashboard/opportunities")}
            >
              <ArrowLeft
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-slate-300" : "text-slate-600"
                )}
              />
              <span
                className={cn(
                  "hidden sm:inline font-medium",
                  isDark ? "text-slate-300" : "text-slate-600"
                )}
              >
                Back to Opportunities
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-[#4A00BE] text-md text-white"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Share</span>
            </Button>
          </div>

          {/* Modern Hero Section with Enhanced Design */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7F39EC] via-[#6C43D0] to-[#5A2D91] shadow-2xl">
            {/* Animated background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full transform translate-x-32 -translate-y-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full transform -translate-x-40 translate-y-40 animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full transform -translate-x-16 -translate-y-16 animate-pulse delay-500"></div>

            <div className="relative p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                <div className="flex-1 min-w-0">
                  {/* Contest Title with enhanced typography */}
                  <h1 className="text-3xl lg:text-5xl font-black tracking-tight mb-6 text-white drop-shadow-2xl leading-tight bg-gradient-to-r from-white to-white/90 bg-clip-text">
                    {contest.title}
                  </h1>

                  {/* Enhanced Status and Type Badges */}
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <Badge
                      className={`text-sm px-6 py-3 font-bold rounded-full shadow-xl border-2 border-white/40 backdrop-blur-md transition-all duration-300 hover:scale-105 ${
                        contest.status === "active"
                          ? "bg-gradient-to-r from-green-400 to-emerald-500 text-green-900 shadow-green-500/25"
                          : contest.status === "upcoming"
                          ? "bg-gradient-to-r from-blue-400 to-cyan-500 text-blue-900 shadow-blue-500/25"
                          : "bg-gradient-to-r from-slate-400 to-gray-500 text-slate-900 shadow-slate-500/25"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {contest.status === "active" ? (
                          <div className="w-3 h-3 bg-green-600 rounded-full animate-pulse shadow-lg"></div>
                        ) : contest.status === "upcoming" ? (
                          <Clock className="w-4 h-4" />
                        ) : (
                          <Calendar className="w-4 h-4" />
                        )}
                        {contest.status === "active"
                          ? "LIVE NOW"
                          : contest.status.toUpperCase()}
                      </span>
                    </Badge>
                    {contest.contest_type && (
                      <Badge className="capitalize text-sm px-6 py-3 font-bold rounded-full shadow-xl bg-white/25 backdrop-blur-md border-2 border-white/40 text-white hover:scale-105 transition-all duration-300">
                        {contest.contest_type === "cpm"
                          ? "Performance Based"
                          : "Competition Based"}
                      </Badge>
                    )}
                    {/* Post-contest status badge for ended contests */}
                    {contest.status === "ended" &&
                      postContestStatus &&
                      renderPostContestStatusBadge(postContestStatus)}
                  </div>

                  {/* Enhanced Contest Duration */}
                  {contest.start_date && contest.end_date && (
                    <div className="bg-white/20 backdrop-blur-md rounded-xl px-6 py-4 inline-block border border-white/30 shadow-lg">
                      <p className="text-white/95 text-base font-semibold flex items-center gap-3">
                        <Calendar className="w-5 h-5" />
                        <span>
                          {formatLocalDateTime(contest.start_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          -{" "}
                          {formatLocalDateTime(contest.end_date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Enhanced Prize Pool Card */}
                <div className="flex-shrink-0 lg:text-right">
                  <div className="bg-white/20 backdrop-blur-xl rounded-3xl p-8 border border-white/30 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105">
                    <div className="text-white/90 text-sm font-bold mb-3 uppercase tracking-wider">
                      {contest.contest_type === "cpm"
                        ? "Total Budget"
                        : "Prize Pool"}
                    </div>
                    <div className="text-4xl lg:text-6xl font-black text-white mb-2 drop-shadow-lg">
                      {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ? formatMoney(
                            contest.contest_based_details.cpm_contest
                              .total_budget
                          )
                        : contest.contest_type === "leaderboard" &&
                          contest.contest_based_details?.leaderboard_contest
                        ? formatMoney(
                            contest.contest_based_details.leaderboard_contest
                              .total_prize
                          )
                        : contest.total_prize
                        ? formatMoney(contest.total_prize || 0)
                        : "$0.00"}
                    </div>
                    {contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                        ?.winner_count && (
                        <div className="text-white/80 text-sm font-semibold">
                          {
                            contest.contest_based_details.leaderboard_contest
                              .winner_count
                          }{" "}
                          winner
                          {contest.contest_based_details.leaderboard_contest
                            .winner_count !== 1
                            ? "s"
                            : ""}
                        </div>
                      )}
                    {contest.contest_type === "cpm" &&
                      contest.contest_based_details?.cpm_contest
                        ?.cpm_rate_usd && (
                        <div className="text-white/80 text-sm font-semibold">
                          {formatMoney(
                            contest.contest_based_details.cpm_contest
                              .cpm_rate_usd * 100
                          )}{" "}
                          per 1000 views
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {contest.thumbnail_url && (
          <div className="mb-8 aspect-video w-full mx-auto relative overflow-hidden rounded-xl shadow-lg">
            <Image
              src={contest.thumbnail_url}
              alt={`${contest.title} thumbnail`}
              fill
              style={{ objectFit: "cover" }} // cover makes sure it fills width
              priority
              className="bg-slate-100 dark:bg-slate-800"
            />
          </div>
        )}

        {/* Enhanced Action Card: Submit or Status */}
        <Card
          className={cn(
            "mb-8 border overflow-hidden",
            isDark
              ? "border-purple-700/60 bg-purple-700/30"
              : "border-[#7F39EC] bg-[#D9C0FF26]"
          )}
        >
          <CardContent className="p-8 text-center relative">
            {/* Decorative background elements */}
            {/* <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-rose-200/30 to-purple-200/30 dark:from-rose-500/10 dark:to-purple-500/10 rounded-full blur-xl transform -translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-blue-200/30 to-cyan-200/30 dark:from-blue-500/10 dark:to-cyan-500/10 rounded-full blur-xl transform translate-x-20 translate-y-20"></div> */}

            <div className="relative z-10">
              {hasSubmitted ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold mb-2",
                      isDark ? "text-slate-200" : "text-slate-700"
                    )}
                  >
                    Submission Complete!
                  </p>
                  <p
                    className={cn(
                      "text-base mb-1",
                      isDark ? "text-slate-300" : "text-slate-600"
                    )}
                  >
                    You have successfully submitted for this opportunity
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      isDark ? "text-slate-300" : "text-slate-500"
                    )}
                  >
                    Submitted {formatTimeAgo(existingSubmission.created_at)}
                  </p>
                </div>
              ) : submissionCount > 0 &&
                contest?.multiple_submissions_enabled ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {submissionCount}
                      </span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-2xl font-bold mb-2",
                      isDark ? "text-slate-200" : "text-slate-700"
                    )}
                  >
                    Submissions in Progress
                  </p>
                  <p
                    className={cn(
                      "text-base mb-1",
                      isDark ? "text-slate-300" : "text-slate-600"
                    )}
                  >
                    You have submitted {submissionCount} out of {maxSubmissions}{" "}
                    videos
                  </p>
                  <p
                    className={cn(
                      "text-sm mb-6",
                      isDark ? "text-slate-300" : "text-slate-500"
                    )}
                  >
                    You can still submit {maxSubmissions - submissionCount} more
                    videos
                  </p>

                  {/* Submit Button for Partial Submissions */}
                  <Button
                    size="lg"
                    onClick={handleSubmitContent}
                    disabled={contest.status?.toLowerCase() !== "active"}
                    className={`relative overflow-hidden text-lg font-bold py-4 px-8 h-auto rounded-2xl shadow-xl transition-all duration-500 ease-out transform ${
                      contest.status?.toLowerCase() === "active"
                        ? "bg-[#4A00BE] text-white border-0 hover:shadow-2xl hover:scale-105"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <span className="relative z-10">
                      {contest.status?.toLowerCase() === "active"
                        ? `Submit More Videos (${
                            maxSubmissions - submissionCount
                          } remaining)`
                        : "Contest Not Active"}
                    </span>
                    {contest.status?.toLowerCase() === "active" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
                    )}
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="mb-6">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-rose-600 via-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
                      Ready to Showcase Your Talent?
                    </h2>
                    <p
                      className={cn(
                        "text-lg max-w-md mx-auto leading-relaxed",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {contest.status === "active"
                        ? "The stage is yours! Submit your content and let your creativity shine."
                        : contest.status === "upcoming"
                        ? "Get ready! This opportunity hasn't started yet, but you can prepare."
                        : "This opportunity has ended or is no longer active."}
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleSubmitContent}
                    disabled={contest.status?.toLowerCase() !== "active"}
                    className={`relative overflow-hidden text-lg font-bold py-4  px-8 h-auto rounded-2xl shadow-xl transition-all duration-500 ease-out transform ${
                      contest.status?.toLowerCase() === "active"
                        ? "bg-[#4A00BE] text-white border-0 hover:shadow-2xl"
                        : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {/* Animated shine effect for active button */}
                    {contest.status?.toLowerCase() === "active" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    )}

                    <span className="relative flex items-center gap-3">
                      {contest.status?.toLowerCase() === "upcoming" ? (
                        <>
                          <Clock className="h-6 w-6" />
                          <span>Contest Not Started</span>
                        </>
                      ) : contest.status?.toLowerCase() === "ended" ||
                        contest.status?.toLowerCase() === "completed" ? (
                        <>
                          <Calendar className="h-6 w-6" />
                          <span>Contest Ended</span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <PlayCircle className="h-6 w-6" />
                            <span>Submit Your Entry!</span>
                          </div>
                          {contest.status?.toLowerCase() === "active" && (
                            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse ml-1"></div>
                          )}
                        </>
                      )}
                    </span>
                  </Button>

                  {contest.status?.toLowerCase() === "active" && (
                    <div
                      className={cn(
                        "text-sm mt-4 flex items-center justify-center gap-2",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Contest is live! Join now to compete
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Colorful Contest Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Platform Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 "
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div
                className={cn(
                  "flex-1 space-y-2",
                  isDark ? "text-white" : "text-slate-800"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  Platform
                </p>
                <p
                  className={cn(
                    "text-2xl font-black capitalize",
                    isDark ? "text-white" : "text-slate-800"
                  )}
                >
                  {contest.platform || "Not specified"}
                </p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                {contest.platform?.toLowerCase() === "youtube" ? (
                  <Youtube className="h-7 w-7" />
                ) : contest.platform?.toLowerCase() === "instagram" ? (
                  <Instagram className="h-7 w-7" />
                ) : (
                  <Share2 className="h-7 w-7" />
                )}
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        {contest.platform?.toLowerCase() === "youtube" ? (
          <Youtube className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : contest.platform?.toLowerCase() === "instagram" ? (
          <Instagram className="h-5 w-5 text-pink-600 dark:text-pink-400" />
        ) : (
          <Share2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">
          Platform
        </p>
        <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">
          {contest.platform || "Not specified"}
        </p>
      </div>
    </div>
  </CardContent>
</Card> */}
          {/* Duration Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 "
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div className="flex-1 text-slate-800 dark:text-slate-100 space-y-2">
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  Duration
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",

                    isDark ? "text-white" : "text-slate-800"
                  )}
                >
                  {(() => {
                    if (!contest.start_date || !contest.end_date)
                      return "Not specified";
                    const start = new Date(contest.start_date);
                    const end = new Date(contest.end_date);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24)
                    );
                    return `${diffDays} day${diffDays !== 1 ? "s" : ""}`;
                  })()}
                </p>
                <p
                  className={cn(
                    "text-sm",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  {contest.start_date && contest.end_date
                    ? `${formatLocalDateTime(contest.start_date, {
                        month: "short",
                        day: "numeric",
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: "short",
                        day: "numeric",
                      })}`
                    : "Dates TBD"}
                </p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Calendar className="h-7 w-7" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                  <p className="text-lg font-bold text-green-900 dark:text-green-100">
                    {(() => {
                      if (!contest.start_date || !contest.end_date) return "Not specified";
                      const start = new Date(contest.start_date);
                      const end = new Date(contest.end_date);
                      const diffTime = Math.abs(end.getTime() - start.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                    })()}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {contest.start_date && contest.end_date ? (
                      `${formatLocalDateTime(contest.start_date, {
                        month: 'short',
                        day: 'numeric',
                      })} - ${formatLocalDateTime(contest.end_date, {
                        month: 'short',
                        day: 'numeric',
                      })}`
                    ) : "Dates TBD"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Prize Pool Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 "
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div
                className={cn(
                  "flex-1 space-y-2",
                  isDark ? "text-white" : "text-slate-800"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  {contest.contest_type === "cpm"
                    ? "Total Budget"
                    : "Prize Pool"}
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",

                    isDark ? "text-white" : "text-slate-800"
                  )}
                >
                  {contest.contest_type === "cpm" &&
                  contest.contest_based_details?.cpm_contest
                    ? formatMoney(
                        contest.contest_based_details.cpm_contest.total_budget
                      )
                    : contest.contest_type === "leaderboard" &&
                      contest.contest_based_details?.leaderboard_contest
                    ? formatMoney(
                        contest.contest_based_details.leaderboard_contest
                          .total_prize
                      )
                    : contest.total_prize // Fallback to old field if necessary for older data
                    ? formatMoney(contest.total_prize || 0)
                    : "$0.00"}
                </p>
                <p
                  className={cn(
                    "text-sm",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.winner_count
                    ? `${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count
                      } winner${
                        contest.contest_based_details.leaderboard_contest
                          .winner_count !== 1
                          ? "s"
                          : ""
                      }`
                    : contest.contest_type === "cpm"
                    ? "CPM based"
                    : "Total prize"}
                </p>
              </div>
              <div
                className={cn(
                  "w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300",

                  isDark
                    ? "bg-[#170337]"
                    : "bg-gradient-to-br from-yellow-500 to-orange-600"
                )}
              >
                <Trophy className="h-7 w-7" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Prize Pool</p>
                  <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                    {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest
                      ? formatMoney(contest.contest_based_details.cpm_contest.total_budget)
                      : contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest
                        ? formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)
                        : contest.total_prize // Fallback to old field if necessary for older data
                          ? formatMoney(contest.total_prize || 0)
                          : "$0.00"}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                    {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest?.winner_count
                      ? `${contest.contest_based_details.leaderboard_contest.winner_count} winner${contest.contest_based_details.leaderboard_contest.winner_count !== 1 ? 's' : ''}`
                      : contest.contest_type === 'cpm'
                        ? 'CPM based'
                        : 'Total prize'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card> */}

          {/* Submissions Card */}
          <div
            className={cn(
              "group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden",

              isDark ? "bg-[#170337]" : "bg-white border border-slate-200 "
            )}
          >
            <CardContent className="p-6 flex justify-between items-center">
              <div
                className={cn(
                  "flex-1 space-y-2",
                  isDark ? "text-white" : "text-slate-800"
                )}
              >
                <p
                  className={cn(
                    "text-sm font-semibold uppercase tracking-wide",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  Submissions
                </p>
                <p
                  className={cn(
                    "text-2xl font-black",

                    isDark ? "text-white" : "text-slate-800"
                  )}
                >
                  {contest.live_submission_count !== null &&
                  contest.live_submission_count >= 0
                    ? contest.live_submission_count
                    : 0}
                </p>
                <p
                  className={cn(
                    "text-sm",

                    isDark ? "text-slate-200" : "text-slate-600"
                  )}
                >
                  Total entries
                </p>
              </div>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Users className="h-7 w-7" />
              </div>
            </CardContent>
          </div>
          {/* <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Submissions</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {contest.live_submission_count !== null && contest.live_submission_count >= 0
                      ? contest.live_submission_count
                      : 0}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Total entries</p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Post-Contest Status Section for Ended Contests */}
        {contest.status === "ended" && postContestStatus && (
          <Card
            className={cn(
              "mb-8 shadow-xl border-2 transition-all duration-300 hover:shadow-2xl overflow-hidden",
              isDark
                ? "border-slate-700/60 bg-gradient-to-br from-slate-800/90 via-slate-900/80 to-slate-800/90 backdrop-blur-sm"
                : "border-blue-200/80 bg-gradient-to-br from-blue-50/90 via-indigo-50/80 to-purple-50/90 backdrop-blur-sm"
            )}
          >
            <CardHeader
              className={cn(
                "border-b transition-all duration-300",
                isDark
                  ? "bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-purple-600/20 border-blue-800/40"
                  : "bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-purple-500/15 border-blue-200/60"
              )}
            >
              <CardTitle
                className={cn(
                  "flex items-center gap-3 transition-colors duration-300",
                  isDark ? "text-blue-100" : "text-blue-900"
                )}
              >
                <div
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    isDark
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-blue-100/80 text-blue-600"
                  )}
                >
                  <FileText className="h-6 w-6" />
                </div>
                <span className="font-bold">Contest Status Update</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h3
                      className={cn(
                        "text-lg font-semibold transition-colors duration-300",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}
                    >
                      Current Status:
                    </h3>
                    <div className="flex-shrink-0">
                      {renderPostContestStatusBadge(postContestStatus)}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "leading-relaxed transition-colors duration-300",
                      isDark ? "text-slate-300" : "text-slate-700"
                    )}
                  >
                    {getPostContestStatusDescription(postContestStatus)}
                  </p>
                  {postContestStatus === "payouts_processed" && (
                    <div
                      className={cn(
                        "mt-4 p-4 rounded-xl border-2 transition-all duration-300",
                        isDark
                          ? "bg-gradient-to-r from-green-900/30 to-emerald-900/20 border-green-700/50"
                          : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/80"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 transition-colors duration-300",
                          isDark ? "text-green-200" : "text-green-800"
                        )}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-full transition-all duration-300",
                            isDark ? "bg-green-500/20" : "bg-green-100/80"
                          )}
                        >
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="font-semibold">Contest Complete!</span>
                      </div>
                      <p
                        className={cn(
                          "text-sm mt-2 transition-colors duration-300",
                          isDark ? "text-green-300/90" : "text-green-700/90"
                        )}
                      >
                        All verification and payout processes have been
                        completed for this contest.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div
                    className={cn(
                      "rounded-2xl p-6 border-2 shadow-lg transition-all duration-300 hover:scale-105",
                      isDark
                        ? "bg-gradient-to-br from-slate-800/80 to-slate-900/60 border-slate-600/40 backdrop-blur-sm"
                        : "bg-gradient-to-br from-white/90 to-blue-50/50 border-blue-200/60 backdrop-blur-sm"
                    )}
                  >
                    <div className="text-center space-y-2">
                      <div
                        className={cn(
                          "text-xs font-semibold uppercase tracking-wider transition-colors duration-300",
                          isDark ? "text-slate-400" : "text-slate-600"
                        )}
                      >
                        Contest Ended
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold transition-colors duration-300",
                          isDark ? "text-slate-100" : "text-slate-900"
                        )}
                      >
                        {contest.end_date
                          ? formatLocalDateTime(contest.end_date, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Date not specified"}
                      </div>
                      {contest.end_date && (
                        <div
                          className={cn(
                            "text-xs transition-colors duration-300",
                            isDark ? "text-slate-500" : "text-slate-500"
                          )}
                        >
                          {formatLocalDateTime(contest.end_date, {
                            weekday: "long",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <EnhancedTabs
          tabs={tabs.map((tab) => ({
            ...tab,
            label: (
              <div className="flex text-center items-center">
                {tab.label}
                {tab.id === "leaderboard" &&
                  contest?.contest_type === "leaderboard" &&
                  totalLeaderboardEntries > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 sm:ml-2 px-2 py-0.5 text-xs sm:text-sm text-gray-700 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground",
                        isDark ? "text-gray-300" : "text-gray-600 bg-gray-200"
                      )}
                    >
                      {totalLeaderboardEntries}
                    </Badge>
                  )}
              </div>
            ),
          }))}
          activeTab={activeTab}
          isDark={isDark}
          light={!isDark}
          onTabChange={setActiveTab}
          className="mt-12 mb-6"
        />

        {/* <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="details">Contest Details</TabsTrigger>
            <TabsTrigger value="leaderboard">
              Leaderboard{" "}
              {contest?.contest_type === "leaderboard" &&
                totalLeaderboardEntries > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 px-1.5 py-0.5 text-xs data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground"
                  >
                    {totalLeaderboardEntries}
                  </Badge>
                )}
            </TabsTrigger>
          </TabsList> */}

        <TabContent activeTab={activeTab}>
          <TabPanel value="details" activeTab={activeTab}>
            {/* Sticky Section Navigation */}
            {activeTab === "details" && contest && (
              <div
                className={cn(
                  "sticky top-16 z-40 rounded-xl shadow-md mb-8 -mx-2 lg:-mx-4",
                  isDark
                    ? "bg-[#170337] border-b"
                    : "border-b bg-white border border-slate-200"
                )}
              >
                <div className="container mx-auto px-4 py-3">
                  <div
                    className="flex space-x-4 overflow-x-auto"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    <style jsx>{`
                      div::-webkit-scrollbar {
                        display: none;
                      }
                    `}</style>
                    {sections
                      .filter(
                        (section: any) =>
                          !section.conditional ||
                          section.conditional === contest.contest_type
                      )
                      .map((section) => (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`px-4 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                            activeSection === section.id
                              ? isDark
                                ? "bg-blue-900/30 text-blue-300 border-b-2 border-blue-500"
                                : "bg-blue-100 text-blue-700 border-b-2 border-blue-500"
                              : isDark
                              ? "text-slate-200 hover:text-slate-200"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                        >
                          {section.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}
            <div
              className={cn(
                "bg-white rounded-xl shadow-xl",
                isDark ? "bg-[#170337]" : "bg-white"
              )}
            >
              <CardHeader className="border-b">
                <CardTitle
                  className={cn(
                    "text-gray-800 flex items-center gap-2",
                    isDark ? "text-white" : "text-gray-800"
                  )}
                >
                  {/* <ScrollText className="h-5 w-5 text-blue-500" /> */}
                  Contest Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 1. EARNINGS OVERVIEW - Clean Card Design */}
                <div
                  id="earning-opportunities"
                  ref={(el) => {
                    sectionRefs.current["earning-opportunities"] = el;
                  }}
                  className={cn(
                    "mt-6 dark:bg-slate-800 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200",
                    isDark
                      ? "bg-[#170337] border-gray-600"
                      : "bg-white border-slate-200"
                  )}
                >
                  <div className="p-6">
                    {/* Header with Icon and Title */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                        <DollarSign className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3
                          className={cn(
                            "text-xl font-bold text-slate-900 dark:text-slate-100 mb-1",
                            isDark ? "text-white" : "text-slate-900"
                          )}
                        >
                          Earning Opportunities
                        </h3>
                        <p
                          className={cn(
                            "text-sm",
                            isDark ? "text-gray-300" : "text-slate-600"
                          )}
                        >
                          {contest.contest_type === "cpm"
                            ? "Performance-based earnings"
                            : "Competition-based prizes"}
                        </p>
                      </div>
                      {/* Platform Badge */}
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg",
                          isDark
                            ? "bg-[#C9A7FF26] border border-[#C9A7FF]"
                            : "bg-slate-100"
                        )}
                      >
                        {contest.platform?.toLowerCase() === "youtube" ? (
                          <Youtube className="h-5 w-5 text-red-600" />
                        ) : contest.platform?.toLowerCase() === "instagram" ? (
                          <Instagram className="h-5 w-5 text-pink-600" />
                        ) : (
                          <Share2 className="h-5 w-5 text-slate-600" />
                        )}
                        <span
                          className={cn(
                            "text-sm font-medium capitalize",
                            isDark ? "text-white" : "text-slate-700"
                          )}
                        >
                          {contest.platform || "Multi-platform"}
                        </span>
                      </div>
                    </div>

                    {/* Main Earning Information */}
                    <div
                      className={`grid grid-cols-1 gap-4 mb-6 ${
                        // Dynamic grid based on contest type and available data
                        contest.contest_type === "cpm"
                          ? contest.contest_based_details?.cpm_contest
                              ?.min_views != null &&
                            contest.contest_based_details?.cpm_contest
                              ?.max_views != null
                            ? "md:grid-cols-2 lg:grid-cols-4" // 4 cards: Pay Rate, Total Budget, Min Views, Max Views
                            : "md:grid-cols-2 lg:grid-cols-3" // 3 cards: Pay Rate, Total Budget, + one view requirement
                          : "md:grid-cols-2 lg:grid-cols-2" // 2 cards: Prize Pool, Winners
                      }`}
                    >
                      {/* Pay Rate / Prize Pool */}
                      <div
                        className={cn(
                          "rounded-lg p-4",
                          isDark ? "border border-[#D1B7F9]" : "bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isDark ? "text-white" : "text-slate-600"
                            )}
                          >
                            {contest.contest_type === "cpm"
                              ? "Pay Rate"
                              : "Prize Pool"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-2xl font-bold",
                            isDark ? "text-white" : "text-slate-900"
                          )}
                        >
                          {contest.contest_type === "cpm" &&
                          contest.contest_based_details?.cpm_contest
                            ? formatMoney(
                                contest.contest_based_details.cpm_contest
                                  .cpm_rate_usd * 100
                              )
                            : contest.contest_type === "leaderboard" &&
                              contest.contest_based_details?.leaderboard_contest
                            ? formatMoney(
                                contest.contest_based_details
                                  .leaderboard_contest.total_prize
                              )
                            : contest.total_prize
                            ? formatMoney(contest.total_prize || 0)
                            : "$0.00"}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-300" : "text-slate-500"
                          )}
                        >
                          {contest.contest_type === "cpm"
                            ? "per 1000 views"
                            : "total prize"}
                        </div>
                      </div>

                      {/* Total Budget / Winners */}
                      <div
                        className={cn(
                          "rounded-lg p-4",
                          isDark ? "border border-[#D1B7F9]" : "bg-slate-50"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isDark ? "text-white" : "text-slate-600"
                            )}
                          >
                            {contest.contest_type === "cpm"
                              ? "Total Budget"
                              : "Winners"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-2xl font-bold",
                            isDark ? "text-white" : "text-slate-900"
                          )}
                        >
                          {contest.contest_type === "cpm" &&
                          contest.contest_based_details?.cpm_contest
                            ? formatMoney(
                                contest.contest_based_details.cpm_contest
                                  .total_budget
                              )
                            : contest.contest_type === "leaderboard" &&
                              contest.contest_based_details?.leaderboard_contest
                            ? contest.contest_based_details.leaderboard_contest
                                .winner_count
                            : "N/A"}
                        </div>
                        <div
                          className={cn(
                            "text-xs",
                            isDark ? "text-gray-300" : "text-slate-500"
                          )}
                        >
                          {contest.contest_type === "cpm"
                            ? "in total"
                            : "winners"}
                        </div>
                      </div>

                      {/* View Requirements for CPM */}
                      {contest.contest_type === "cpm" &&
                        contest.contest_based_details?.cpm_contest && (
                          <>
                            {contest.contest_based_details.cpm_contest
                              .min_views != null && (
                              <div
                                className={cn(
                                  "rounded-lg p-4",
                                  isDark
                                    ? "border border-[#D1B7F9]"
                                    : "bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-slate-600"
                                    )}
                                  >
                                    Min Views
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-slate-900"
                                  )}
                                >
                                  {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-300" : "text-slate-500"
                                  )}
                                >
                                  required
                                </div>
                              </div>
                            )}
                            {contest.contest_based_details.cpm_contest
                              .max_views != null && (
                              <div
                                className={cn(
                                  "rounded-lg p-4",
                                  isDark
                                    ? "border border-[#D1B7F9]"
                                    : "bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-slate-600"
                                    )}
                                  >
                                    Max Views
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-white" : "text-slate-900"
                                  )}
                                >
                                  {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                </div>
                                <div
                                  className={cn(
                                    "text-xs",
                                    isDark ? "text-gray-300" : "text-slate-500"
                                  )}
                                >
                                  counted
                                </div>
                              </div>
                            )}
                          </>
                        )}
                    </div>

                    {/* Bonus Information */}
                    <div className="space-y-3">
                      {/* Bonus Budget Tracker for Leaderboard with flat_fee_bonus */}
                      {contest.contest_type === "leaderboard" &&
                        contest.contest_based_details?.leaderboard_contest
                          ?.flat_fee_bonus && (
                          <div
                            className={cn(
                              "bg-gradient-to-r rounded-lg border p-4",
                              isDark
                                ? "from-green-900/20 to-emerald-900/20 border-green-700/50"
                                : "from-green-50 to-emerald-50 border-green-200"
                            )}
                          >
                            <div className="flex items-center gap-3 mb-3">
                              <Gift
                                className={cn(
                                  "h-5 w-5",
                                  isDark ? "text-green-400" : "text-green-600"
                                )}
                              />
                              <span
                                className={cn(
                                  "font-semibold",
                                  isDark ? "text-green-100" : "text-green-900"
                                )}
                              >
                                Bonus Budget
                              </span>
                              <div className="group relative">
                                <Info
                                  className={cn(
                                    "h-4 w-4 cursor-help",
                                    isDark ? "text-green-400" : "text-green-600"
                                  )}
                                />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center">
                                  Additional bonus on top of prize pool. Every
                                  verified submission receives the
                                  per-submission bonus until the total budget is
                                  exhausted.
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div
                                className={cn(
                                  "rounded-lg p-3 border",
                                  isDark
                                    ? "bg-slate-800 border-green-700/30"
                                    : "bg-white border-green-200"
                                )}
                              >
                                <div
                                  className={cn(
                                    "text-xs mb-1",
                                    isDark ? "text-green-300" : "text-green-700"
                                  )}
                                >
                                  Per Submission
                                </div>
                                <div
                                  className={cn(
                                    "text-lg font-bold",
                                    isDark ? "text-green-100" : "text-green-900"
                                  )}
                                >
                                  {formatMoney(
                                    contest.contest_based_details
                                      .leaderboard_contest.flat_fee_bonus
                                  )}
                                </div>
                              </div>
                              {contest.contest_based_details.leaderboard_contest
                                .total_budget && (
                                <div
                                  className={cn(
                                    "rounded-lg p-3 border",
                                    isDark
                                      ? "bg-slate-800 border-green-700/30"
                                      : "bg-white border-green-200"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "text-xs mb-1",
                                      isDark
                                        ? "text-green-300"
                                        : "text-green-700"
                                    )}
                                  >
                                    Total Budget
                                  </div>
                                  <div
                                    className={cn(
                                      "text-lg font-bold",
                                      isDark
                                        ? "text-green-100"
                                        : "text-green-900"
                                    )}
                                  >
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.total_budget
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Flat Fee Bonus for CPM contests */}
                      {contest.contest_type === "cpm" &&
                        contest.contest_based_details?.cpm_contest
                          ?.flat_fee_bonus && (
                          <div className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all duration-300",
                            isDark
                              ? "bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-400/40"
                              : "bg-gradient-to-r from-green-50 to-green-50 border-green-200"
                          )}>
                            <div className="flex items-center gap-3">
                              <Gift className={cn(
                                "h-5 w-5",
                                isDark ? "text-green-400" : "text-green-600"
                              )} />
                              <span className={cn(
                                "font-medium",
                                isDark ? "text-slate-100" : "text-slate-900"
                              )}>
                                Guaranteed Bonus
                              </span>
                              <div className="group relative">
                                <Info className={cn(
                                  "h-4 w-4 cursor-help",
                                  isDark ? "text-green-400" : "text-green-600"
                                )} />
                                <div
                                  className={cn(
                                    "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center",
                                    isDark
                                      ? "bg-slate-800 text-slate-100"
                                      : "bg-slate-900 text-white"
                                  )}
                                >
                                  Every submission that gets verified will
                                  receive this guaranteed bonus amount. Your
                                  submission will only get verified if you
                                  follow the brief and rules & guidelines.
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={cn(
                                "text-lg font-bold",
                                isDark ? "text-green-100" : "text-green-900"
                              )}>
                                {formatMoney(
                                  contest.contest_based_details.cpm_contest
                                    .flat_fee_bonus
                                )} 
                              </div>
                              <div className={cn(
                                "text-xs",
                                isDark ? "text-green-300" : "text-green-700"
                              )}>
                                per verified submission
                              </div>
                            </div>
                          </div>
                         )} 

                      {/* Multiple Submissions */}
                      {(contest as any).multiple_submissions_enabled && (
                        <div
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-all duration-300",
                            isDark
                              ? "bg-gradient-to-r from-purple-500/20 to-violet-500/20 border-purple-400/50"
                              : "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <CheckCheck
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-purple-400" : "text-purple-600"
                              )}
                            />
                            <span
                              className={cn(
                                "font-medium",
                                isDark ? "text-slate-100" : "text-slate-900"
                              )}
                            >
                              Multiple Submissions
                            </span>
                            <div className="group relative">
                              <Info
                                className={cn(
                                  "h-4 w-4 cursor-help",
                                  isDark ? "text-purple-400" : "text-purple-600"
                                )}
                              />
                              <div
                                className={cn(
                                  "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center",
                                  isDark
                                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                                    : "bg-slate-900 text-white"
                                )}
                              >
                                You can submit multiple pieces of content to
                                maximize your chances of winning and earning.
                                Each submission must follow the brief and rules
                                & guidelines.
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={cn(
                                "text-lg font-bold",
                                isDark ? "text-purple-100" : "text-purple-900"
                              )}
                            >
                              Up to{" "}
                              {(contest as any).max_submissions_per_creator}{" "}
                              entries
                            </div>
                            {(contest as any).max_earnings_per_creator && (
                              <div
                                className={cn(
                                  "text-xs",
                                  isDark ? "text-purple-300" : "text-purple-700"
                                )}
                              >
                                Cap:{" "}
                                {formatMoney(
                                  (contest as any).max_earnings_per_creator
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Additional Bonuses */}
                      {(contest as any).bonus_details?.description_html && (
                        <div
                          className={cn(
                            "p-3 rounded-lg border transition-all duration-300",
                            isDark
                              ? "bg-gradient-to-r from-yellow-900/40 to-amber-900/40 border-yellow-400/40"
                              : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                          )}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <Star
                              className={cn(
                                "h-5 w-5",
                                isDark ? "text-amber-400" : "text-amber-600"
                              )}
                            />
                            <span
                              className={cn(
                                "font-medium",
                                isDark ? "text-slate-100" : "text-slate-900"
                              )}
                            >
                              Extra Bonuses
                            </span>
                            <div className="group relative">
                              <Info
                                className={cn(
                                  "h-4 w-4 cursor-help",
                                  isDark ? "text-amber-400" : "text-amber-600"
                                )}
                              />
                              <div
                                className={cn(
                                  "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20 min-w-64 max-w-80 text-center",
                                  isDark
                                    ? "bg-slate-800 text-slate-100 border border-slate-700"
                                    : "bg-slate-900 text-white"
                                )}
                              >
                                These are additional earning opportunities. The
                                amount is handled and credited by the brand
                                separately from the main contest prizes.
                              </div>
                            </div>
                          </div>
                          <div className="max-h-40 overflow-y-auto pr-2">
                            <div
                              className={cn(
                                "prose prose-sm max-w-none",
                                isDark
                                  ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_li]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white [&_a]:!text-white"
                                  : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700"
                              )}
                              dangerouslySetInnerHTML={{
                                __html: (contest as any).bonus_details
                                  .description_html,
                              }}
                            />
                          </div>
                          <div
                            className={cn(
                              "mt-2 pt-2 border-t",
                              isDark
                                ? "border-amber-400/50"
                                : "border-amber-200"
                            )}
                          >
                            <p
                              className={cn(
                                "text-xs flex items-center gap-1",
                                isDark ? "text-amber-300" : "text-amber-700"
                              )}
                            >
                              <Info className="h-3 w-3" />
                              These bonuses are handled manually by the brand.
                              Read carefully and reach out if you have
                              questions!
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comprehensive Prize Distribution Section for Leaderboard Contests */}
                {contest.contest_type === "leaderboard" &&
                  contest.contest_based_details?.leaderboard_contest
                    ?.prizes && (
                    <div
                      id="prize-structure"
                      ref={(el) => {
                        sectionRefs.current["prize-structure"] = el;
                      }}
                      className={cn(
                        "rounded-xl border shadow-sm",
                        isDark ? "border-gray-600" : "bg-white border-slate-200"
                      )}
                    >
                      <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Trophy className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3
                              className={cn(
                                "text-xl font-bold",
                                isDark ? "text-white" : "text-slate-900"
                              )}
                            >
                              Prize Structure
                            </h3>
                            <p
                              className={cn(
                                "text-sm",
                                isDark ? "text-gray-300" : "text-slate-600"
                              )}
                            >
                              Complete prize breakdown for all positions
                            </p>
                          </div>
                        </div>

                        {/* Prize Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                          <div
                            className={cn(
                              "bg-gradient-to-r rounded-lg p-4 border",
                              isDark
                                ? "from-purple-900/20 to-violet-900/20 border-purple-700/50"
                                : "from-purple-50 to-violet-50 border-purple-200"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Trophy
                                className={cn(
                                  "h-6 w-6",
                                  isDark ? "text-purple-400" : "text-purple-600"
                                )}
                              />
                              <div>
                                <div
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark
                                      ? "text-purple-200"
                                      : "text-purple-800"
                                  )}
                                >
                                  Total Prize Pool
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark
                                      ? "text-purple-100"
                                      : "text-purple-900"
                                  )}
                                >
                                  {formatMoney(
                                    contest.contest_based_details
                                      .leaderboard_contest.total_prize
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "rounded-lg p-4 border border-blue-200 dark:border-blue-700/50",
                              isDark
                                ? "border-blue-700/50 bg-blue-900/30"
                                : "border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Users
                                className={cn(
                                  "h-6 w-6",
                                  isDark ? "text-blue-400" : "text-blue-600"
                                )}
                              />
                              <div>
                                <div
                                  className={cn(
                                    "text-sm font-medium",
                                    isDark ? "text-blue-300" : "text-blue-800"
                                  )}
                                >
                                  Total Winners
                                </div>
                                <div
                                  className={cn(
                                    "text-2xl font-bold",
                                    isDark ? "text-blue-200" : "text-blue-900"
                                  )}
                                >
                                  {
                                    contest.contest_based_details
                                      .leaderboard_contest.winner_count
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                          {contest.contest_based_details.leaderboard_contest
                            .flat_fee_bonus && (
                            <div
                              className={cn(
                                "bg-gradient-to-r rounded-lg p-4 border",
                                isDark
                                  ? "from-green-900/20 to-emerald-900/20 border-green-700/50"
                                  : "from-green-50 to-emerald-50 border-green-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Gift
                                  className={cn(
                                    "h-6 w-6",
                                    isDark ? "text-green-400" : "text-green-600"
                                  )}
                                />
                                <div>
                                  <div
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark
                                        ? "text-green-200"
                                        : "text-green-800"
                                    )}
                                  >
                                    Bonus Budget
                                  </div>
                                  <div
                                    className={cn(
                                      "text-2xl font-bold",
                                      isDark
                                        ? "text-green-100"
                                        : "text-green-900"
                                    )}
                                  >
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.flat_fee_bonus
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-xs mt-0.5",
                                      isDark
                                        ? "text-green-300"
                                        : "text-green-700"
                                    )}
                                  >
                                    per verified submission
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bonus Budget Note */}
                        {contest.contest_based_details.leaderboard_contest
                          .flat_fee_bonus && (
                          <div
                            className={cn(
                              "mb-6 p-4 border rounded-lg",
                              isDark
                                ? "bg-green-900/10 border-green-700/50"
                                : "bg-green-50 border-green-200"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Gift
                                className={cn(
                                  "h-5 w-5 mt-0.5 flex-shrink-0",
                                  isDark ? "text-green-400" : "text-green-600"
                                )}
                              />
                              <div>
                                <p
                                  className={cn(
                                    "text-sm font-semibold mb-1",
                                    isDark ? "text-green-200" : "text-green-900"
                                  )}
                                >
                                  Additional Bonus Earnings
                                </p>
                                <p
                                  className={cn(
                                    "text-sm",
                                    isDark ? "text-green-300" : "text-green-800"
                                  )}
                                >
                                  Every verified submission receives{" "}
                                  <span className="font-bold">
                                    {formatMoney(
                                      contest.contest_based_details
                                        .leaderboard_contest.flat_fee_bonus
                                    )}
                                  </span>{" "}
                                  as a guaranteed bonus, on top of any prizes
                                  won from the leaderboard positions above
                                  {contest.contest_based_details
                                    .leaderboard_contest.total_budget && (
                                    <>
                                      , until the bonus budget of{" "}
                                      <span className="font-bold">
                                        {formatMoney(
                                          contest.contest_based_details
                                            .leaderboard_contest.total_budget
                                        )}
                                      </span>{" "}
                                      is reached
                                    </>
                                  )}
                                  .
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Prize Distribution List */}
                        <div>
                          <h4
                            className={cn(
                              "text-lg font-semibold mb-4",
                              isDark ? "text-white" : "text-slate-900"
                            )}
                          >
                            Prize Distribution
                          </h4>
                          <div
                            className={cn(
                              "rounded-lg border border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto",
                              isDark
                                ? "border-slate-700"
                                : "bg-slate-50 border-slate-200"
                            )}
                          >
                            <div
                              className={cn(
                                "divide-y",
                                isDark ? "divide-slate-700" : "divide-slate-200"
                              )}
                            >
                              {contest.contest_based_details.leaderboard_contest.prizes
                                .sort(
                                  (a: any, b: any) => a.position - b.position
                                )
                                .map((prize: any, index: number) => (
                                  <div
                                    key={index}
                                    className={cn(
                                      "p-4 transition-colors",
                                      isDark
                                        ? "hover:bg-purple-900/30"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800 "
                                    )}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                                          {prize.position}
                                        </div>
                                        <div>
                                          <div
                                            className={cn(
                                              "font-medium",
                                              isDark
                                                ? "text-slate-100"
                                                : "text-slate-900"
                                            )}
                                          >
                                            Position {prize.position}
                                            {prize.position === 1 && " 🥇"}
                                            {prize.position === 2 && " 🥈"}
                                            {prize.position === 3 && " 🥉"}
                                          </div>
                                          <div
                                            className={cn(
                                              "text-sm",
                                              isDark
                                                ? "text-slate-400"
                                                : "text-slate-600"
                                            )}
                                          >
                                            {prize.position === 1
                                              ? "1st Place"
                                              : prize.position === 2
                                              ? "2nd Place"
                                              : prize.position === 3
                                              ? "3rd Place"
                                              : `${prize.position}th Place`}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div
                                          className={cn(
                                            "text-xl font-bold",
                                            isDark
                                              ? "text-white"
                                              : "text-slate-900"
                                          )}
                                        >
                                          {formatMoney(prize.amount)}
                                        </div>
                                        <div
                                          className={cn(
                                            "text-sm",
                                            isDark
                                              ? "text-slate-400"
                                              : "text-slate-600"
                                          )}
                                        >
                                          {(
                                            (prize.amount /
                                              contest.contest_based_details
                                                .leaderboard_contest
                                                .total_prize) *
                                            100
                                          ).toFixed(1)}
                                          % of total
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* 2. CONTEST DETAILS - Essential Information */}
                <div
                  id="contest-details"
                  ref={(el) => {
                    sectionRefs.current["contest-details"] = el;
                  }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    Contest Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Start Date Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                          )}
                        >
                          <Play className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600"
                            )}
                          >
                            Start Date & Time
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            {contest.start_date
                              ? formatLocalDateTime(contest.start_date)
                              : "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* End Date Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                          )}
                        >
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600"
                            )}
                          >
                            End Date & Time
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            {contest.end_date
                              ? formatLocalDateTime(contest.end_date)
                              : "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Platform Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                          )}
                        >
                          <Monitor className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600"
                            )}
                          >
                            Platform
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            {contest.platform || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Card */}
                    <div
                      className={cn(
                        "rounded-xl p-4 border shadow-sm",
                        isDark
                          ? "border-blue-400/50"
                          : "bg-white border-blue-200 dark:border-blue-700/30"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-3 rounded-full",
                            isDark
                              ? "bg-blue-500/30 text-blue-400"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                          )}
                        >
                          <Info className="h-5 w-5 " />
                        </div>
                        <div className="flex-1">
                          <p
                            className={cn(
                              "text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide",
                              isDark ? "text-slate-300" : "text-slate-600"
                            )}
                          >
                            Status
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            {contest.status || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. CONTENT REQUIREMENTS - Brief and Content Type */}
                <div
                  id="content-requirements"
                  ref={(el) => {
                    sectionRefs.current["content-requirements"] = el;
                  }}
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    Content Requirements
                  </h3>

                  {/* Brief Section */}
                  <div
                    className={cn(
                      "rounded-xl p-6 border",
                      isDark
                        ? "bg-purple-500/10 border-purple-400/50"
                        : "bg-purple-50 border-purple-200"
                    )}
                  >
                    <h4
                      className={cn(
                        "font-semibold text-lg mb-4",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}
                    >
                      📝 Brief
                    </h4>
                    {contest.brief_html ? (
                      <div
                        className={cn(
                          "prose prose-sm max-w-none",
                          isDark
                            ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-blue-400 [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                            : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700"
                        )}
                        dangerouslySetInnerHTML={{ __html: contest.brief_html }}
                      />
                    ) : (
                      <p
                        className={cn(
                          "text-slate-600 dark:text-slate-400 text-sm",
                          isDark ? "text-slate-300" : "text-slate-700"
                        )}
                      >
                        No brief provided
                      </p>
                    )}
                  </div>

                  {/* Content Type Info Tag */}
                  {(contest as any).content_type && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-2",
                        isDark
                          ? "bg-blue-900/30 border border-blue-700/50"
                          : "bg-blue-50 border border-blue-200"
                      )}
                    >
                      <Tag
                        className={cn(
                          "h-4 w-4",
                          isDark ? "text-blue-400" : "text-blue-600"
                        )}
                      />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isDark ? "text-blue-100" : "text-blue-900"
                        )}
                      >
                        {(contest as any).content_type.toUpperCase()} -{" "}
                        {(contest as any).content_type === "ugc"
                          ? "Create Face videos"
                          : (contest as any).content_type === "clipping"
                          ? "Video editing and clipping"
                          : "Check rules to find out what kind of content you need to create"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. PARTICIPATION GUIDELINES - Rules and Terms */}
                <div
                  id="participation-guidelines"
                  ref={(el) => {
                    sectionRefs.current["participation-guidelines"] = el;
                  }}
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <ScrollText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    Participation Guidelines
                  </h3>
                  {/* Rules & Guidelines Section */}
                  <div
                    className={cn(
                      "rounded-xl p-6 border",
                      isDark ? "border-gray-600" : "bg-white border-orange-200"
                    )}
                  >
                    <h4
                      className={cn(
                        "font-semibold text-lg mb-4 flex items-center gap-2",
                        isDark ? "text-slate-100" : "text-slate-900"
                      )}
                    >
                      <ScrollText
                        className={cn(
                          "h-5 w-5",
                          isDark ? "text-orange-400" : "text-orange-600"
                        )}
                      />
                      Rules & Guidelines
                    </h4>
                    {/* Check multiple possible rule fields */}
                    {(contest as any).rules_html ? (
                      <div
                        className={cn(
                          "prose prose-sm max-w-none",
                          isDark
                            ? "prose-invert text-white [&_*]:!text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_strong]:!text-white [&_b]:!text-white [&_em]:!text-white [&_i]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white [&_ul]:!text-white [&_ol]:!text-white [&_li]:!text-white [&_a]:!text-blue-400 [&_blockquote]:!text-white [&_code]:!text-white [&_pre]:!text-white"
                            : "text-slate-700 [&_*]:text-slate-700 [&_p]:text-slate-700 [&_span]:text-slate-700 [&_div]:text-slate-700"
                        )}
                        dangerouslySetInnerHTML={{
                          __html: (contest as any).rules_html,
                        }}
                      />
                    ) : contest.rules ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700"
                        )}
                      >
                        {contest.rules}
                      </div>
                    ) : contest.rules_description ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700"
                        )}
                      >
                        {contest.rules_description}
                      </div>
                    ) : (contest as any).rules_text ? (
                      <div
                        className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap",
                          isDark ? "text-slate-300" : "text-slate-700"
                        )}
                      >
                        {(contest as any).rules_text}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div
                          className={cn(
                            "text-sm leading-relaxed",
                            isDark ? "text-slate-300" : "text-slate-700"
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold mb-2",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            General Rules:
                          </h4>
                          <ul
                            className={cn(
                              "space-y-2 ml-4 list-disc",
                              isDark ? "text-slate-400" : "text-slate-600"
                            )}
                          >
                            <li>
                              <strong>Eligibility:</strong> Only registered
                              creators are eligible to participate in contests.
                            </li>
                            <li>
                              <strong>Age Requirement:</strong> Contestants must
                              be at least 18 years old.
                            </li>
                            <li>
                              <strong>Content Standards:</strong> Content must
                              adhere to the platform's content guidelines and
                              community standards.
                            </li>
                            <li>
                              <strong>Original Work:</strong> All submissions
                              must be original content created by the
                              participant.
                            </li>
                            <li>
                              <strong>Submission Deadline:</strong> Entries must
                              be submitted before the contest end date and time.
                            </li>
                            <li>
                              <strong>Platform Compliance:</strong> Content must
                              comply with the rules and policies of the
                              specified platform (YouTube, Instagram, etc.).
                            </li>
                          </ul>
                        </div>

                        <div
                          className={cn(
                            "border-t pt-3",
                            isDark ? "border-slate-600" : "border-slate-200"
                          )}
                        >
                          <h4
                            className={cn(
                              "font-semibold mb-2",
                              isDark ? "text-slate-100" : "text-slate-900"
                            )}
                          >
                            ⚠️ Important Notes:
                          </h4>
                          <ul
                            className={cn(
                              "space-y-1 ml-4 list-disc text-sm",
                              isDark ? "text-slate-400" : "text-slate-600"
                            )}
                          >
                            <li>
                              Violation of rules may result in disqualification
                            </li>
                            <li>
                              Contest organizers reserve the right to verify
                              submissions
                            </li>
                            <li>
                              Winners will be contacted through their registered
                              email
                            </li>
                            <li>
                              Prize distribution is subject to verification and
                              approval
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terms & Conditions for CPM contests */}
                  {contest.contest_type === "cpm" &&
                    contest.contest_based_details?.cpm_contest
                      ?.terms_conditions && (
                      <div
                        className={cn(
                          "rounded-xl p-6 border mt-6",
                          isDark
                            ? "border-slate-600"
                            : "bg-white border-orange-200"
                        )}
                      >
                        <h4
                          className={cn(
                            "font-semibold text-lg mb-4",
                            isDark ? "text-slate-100" : "text-slate-900"
                          )}
                        >
                          📋 Terms & Conditions
                        </h4>
                        <div
                          className={cn(
                            "rounded-lg p-4 border",
                            isDark
                              ? "border-gray-700"
                              : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <pre
                            className={cn(
                              "whitespace-pre-wrap break-words font-sans text-sm",
                              isDark ? "text-white" : "text-slate-700"
                            )}
                          >
                            {
                              contest.contest_based_details.cpm_contest
                                .terms_conditions
                            }
                          </pre>
                        </div>
                      </div>
                    )}
                </div>

                {/* 5. RESOURCES & TOOLS - Essential for Participation */}
                <div
                  id="resources-tools"
                  ref={(el) => {
                    sectionRefs.current["resources-tools"] = el;
                  }}
                  className="space-y-6"
                >
                  <h3 className="font-semibold text-xl text-foreground flex items-center gap-2">
                    <Lightbulb className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    Resources & Tools
                  </h3>

                  {contest.resources &&
                  ((Array.isArray(contest.resources) &&
                    contest.resources.length > 0) ||
                    (typeof contest.resources === "object" &&
                      Object.keys(contest.resources).length > 0)) ? (
                    <div className="grid gap-4">
                      {(Array.isArray(contest.resources)
                        ? contest.resources
                        : Object.entries(contest.resources).map(
                            ([description, url]) => ({
                              url,
                              description,
                              type: "external",
                            })
                          )
                      ).map((resource: any, idx: number) => {
                        const isImage =
                          resource.url &&
                          (resource.url.startsWith("data:image") ||
                            /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(
                              resource.url
                            ));
                        const isPdf =
                          resource.url && /\.pdf$/i.test(resource.url);
                        const isVideo =
                          resource.url &&
                          /\.(mp4|mov|avi|webm)$/i.test(resource.url);
                        const isInternal = resource.type === "internal";
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "border rounded-xl p-5",
                              isDark ? "border-gray-600" : "border-gray-300"
                            )}
                          >
                            <div className="flex flex-col md:flex-row justify-between">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {isInternal && isImage && !isPdf ? (
                                  <img
                                    src={resource.url}
                                    alt={resource.description}
                                    className="w-12 h-12 object-cover rounded-lg dark:border-gray-600"
                                  />
                                ) : isInternal && isPdf ? (
                                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center border border-red-200 dark:border-red-700">
                                    <svg
                                      className="w-6 h-6 text-red-600 dark:text-red-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                ) : isInternal && isVideo ? (
                                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-700">
                                    <svg
                                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                    </svg>
                                  </div>
                                ) : isInternal &&
                                  !isImage &&
                                  !isPdf &&
                                  !isVideo ? (
                                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center border border-green-200 dark:border-green-700">
                                    <svg
                                      className="w-6 h-6 text-green-600 dark:text-green-400"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      "p-3 rounded-full flex-shrink-0",
                                      isDark
                                        ? "bg-[#FFFFFF42] text-white"
                                        : "bg-purple-100 text-purple-600"
                                    )}
                                  >
                                    <ExternalLink className="h-5 w-5" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h4
                                    className={cn(
                                      "text-base font-semibold text-gray-900 dark:text-gray-100 mb-1",
                                      isDark ? "text-white" : "text-slate-700"
                                    )}
                                  >
                                    {resource.description}
                                  </h4>
                                  <p
                                    className={cn(
                                      "text-sm text-gray-600 dark:text-gray-400",
                                      isDark
                                        ? "text-gray-300"
                                        : "text-slate-700"
                                    )}
                                  >
                                    {resource.type === "external"
                                      ? "External Link"
                                      : "Uploaded File"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                asChild
                                className="bg-[#6C43D0] hover:bg-[#6C43D0] mt-3 md:mt-0 rounded-xl text-white px-4 py-2 text-md"
                              >
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center"
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  {isPdf
                                    ? "Open PDF"
                                    : isVideo
                                    ? "Play Video"
                                    : isImage
                                    ? "View Image"
                                    : "View Resource"}
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "text-center py-12 rounded-xl border border-gray-300",
                        isDark ? "text-gray-300" : "bg-gray-50 text-slate-700"
                      )}
                    >
                      <div
                        className={cn(
                          "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
                          isDark ? "bg-blue-500/30" : "bg-blue-100"
                        )}
                      >
                        <Lightbulb className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4
                        className={cn(
                          "text-lg font-medium text-gray-900 dark:text-gray-100 mb-2",
                          isDark ? "text-white" : "text-slate-700"
                        )}
                      >
                        No additional resources provided
                      </h4>
                      <p
                        className={cn(
                          "text-gray-600 dark:text-gray-400",
                          isDark ? "text-gray-300" : "text-slate-700"
                        )}
                      >
                        Check the brief and rules above for all contest
                        requirements.
                      </p>
                    </div>
                  )}
                </div>

                {/* Inspiration Links Section */}
                {(() => {
                  let links = Array.isArray(contest.inspiration_links)
                    ? contest.inspiration_links
                    : [];
                  return links.length > 0 ? (
                    <>
                      <Separator className="my-8" />
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          {/* <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div> */}
                          <h3
                            className={cn(
                              "text-xl font-semibold",
                              isDark ? "text-white" : "text-slate-900"
                            )}
                          >
                            Inspiration Links
                          </h3>
                        </div>

                        <div className="grid gap-4">
                          {links.map(
                            (
                              item: { url: string; description: string },
                              index: number
                            ) => {
                              // Process URL to replace [creator] with username
                              const username = userProfile?.username || "";
                              const processedUrl = processUrlWithCreator(
                                item.url,
                                username
                              );

                              return (
                                <div
                                  key={index}
                                  className={cn(
                                    "border rounded-xl p-5",
                                    isDark
                                      ? "border-gray-600"
                                      : "bg-white border-gray-300"
                                  )}
                                >
                                  <div className="flex items-start gap-4">
                                    <div
                                      className={cn(
                                        "p-3 rounded-full flex-shrink-0",
                                        isDark
                                          ? "bg-[#FFFFFF42] text-white"
                                          : "bg-purple-100 text-purple-600"
                                      )}
                                    >
                                      <ExternalLink className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <a
                                        href={processedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "block text-base font-medium text-blue-600 hover:underline mb-2 break-all",
                                          isDark
                                            ? "text-purple-300"
                                            : "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                        )}
                                      >
                                        {processedUrl}
                                      </a>
                                      {item.description && (
                                        <p
                                          className={cn(
                                            "text-sm leading-relaxed",
                                            isDark
                                              ? "text-gray-300"
                                              : "text-gray-700"
                                          )}
                                        >
                                          {item.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </>
                  ) : null;
                })()}

                {/* Tracking Links Section */}
                {(() => {
                  let trackingLinks = Array.isArray(contest.tracking_links)
                    ? contest.tracking_links
                    : [];
                  return trackingLinks.length > 0 ? (
                    <div className="space-y-4">
                      <h4
                        className={cn(
                          "text-xl font-semibold flex items-center gap-2",
                          isDark ? "text-white" : "text-slate-900"
                        )}
                      >
                        <Copy className="h-5 w-5 text-green-600 dark:text-green-400" />
                        Tracking Links
                      </h4>
                      {contest.multiple_submissions_enabled && (
                        <div
                          className={cn(
                            "rounded-lg border p-4",
                            isDark
                              ? "border-[#C9A7FF] bg-[#C9A7FF26]"
                              : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                          )}
                        >
                          <p
                            className={cn(
                              "text-sm flex items-start gap-2",
                              isDark ? "text-white" : "text-yellow-800"
                            )}
                          >
                            <span className="text-base flex-shrink-0">📝</span>
                            <span>
                              <span className="font-semibold">Note:</span>{" "}
                              Change the sub1 and sub2 parameters according to
                              your submission number if you are doing multiple
                              submissions.
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4">
                        {trackingLinks.map(
                          (
                            item: { url: string; description: string },
                            index: number
                          ) => {
                            // Process URL to replace [creator] with username
                            const username = userProfile?.username || "";
                            const processedUrl = processUrlWithCreator(
                              item.url,
                              username
                            );

                            const handleCopyLink = async () => {
                              try {
                                await navigator.clipboard.writeText(
                                  processedUrl
                                );
                                toast({
                                  title: "Link Copied!",
                                  description:
                                    "Tracking link has been copied to clipboard.",
                                  variant: "default",
                                });
                              } catch (error) {
                                console.error("Failed to copy link:", error);
                                toast({
                                  title: "Copy Failed",
                                  description:
                                    "Failed to copy link to clipboard.",
                                  variant: "destructive",
                                });
                              }
                            };

                            return (
                              <div
                                key={index}
                                className={cn(
                                  "border rounded-lg p-4 hover:shadow-md transition-shadow duration-200",
                                  isDark
                                    ? "border-gray-600"
                                    : "bg-white border-slate-200"
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      "mt-0.5 p-3 rounded-full flex-shrink-0",
                                      isDark
                                        ? "bg-green-900/40 text-green-400"
                                        : "bg-green-100 text-green-600"
                                    )}
                                  >
                                    <Link2 className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <p
                                        className={cn(
                                          "text-md font-medium break-all transition-colors",
                                          isDark
                                            ? "text-purple-300"
                                            : "text-black"
                                        )}
                                      >
                                        {processedUrl}
                                      </p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCopyLink}
                                        className={cn(
                                          "p-2 h-auto rounded-md transition-colors duration-200 flex-shrink-0",
                                          isDark
                                            ? "text-white"
                                            : "hover:bg-slate-100 text-slate-600"
                                        )}
                                        title="Copy link"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    {item.description && (
                                      <p
                                        className={cn(
                                          "text-sm leading-relaxed",
                                          isDark
                                            ? "text-white"
                                            : "text-slate-600"
                                        )}
                                      >
                                        {item.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </div>
          </TabPanel>

          <TabPanel value="leaderboard" activeTab={activeTab}>
            {loadingLeaderboard ? (
              // <p className="text-center py-4">Loading leaderboard...</p>
              <div className="flex items-center justify-center h-[60vh]">
                <PageLoadingSpinner mode="light" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : leaderboard.length === 0 && totalLeaderboardEntries === 0 ? (
              <div className="text-center py-8">
                <Trophy className="mx-auto h-12 w-12 text-slate-400" />
                <p 
                  className={cn(
                    "mb-2",
                    isDark ? "text-slate-300" : "text-slate-600"
                  )}>
                  No submissions yet. Be the first!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Earnings View Mode Toggle - Show for both CPM and leaderboard contests with bonus */}
                {(contest?.contest_type === "leaderboard" ||
                  contest?.contest_type === "cpm") &&
                  (contest.contest_based_details?.leaderboard_contest
                    ?.flat_fee_bonus ||
                    contest.contest_based_details?.cpm_contest
                      ?.flat_fee_bonus ||
                    (contest as any).bonus_details?.description_html) && (
                    <div
                      className={cn(
                        "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 p-4 rounded-xl border shadow-sm",
                        isDark
                          ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                          : "bg-[#D9C0FF26] border-[#D9C0FF]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            isDark
                              ? "bg-[#FFFFFF42] text-white"
                              : "bg-[#D8C3FF] text-[#4A00BE]"
                          )}
                        >
                          <Eye className="h-4 w-4" />
                        </div>
                        <div>
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              isDark ? "text-white" : "text-slate-800"
                            )}
                          >
                            Earnings Display
                          </span>
                          <p
                            className={cn(
                              "text-xs mt-0.5",
                              isDark ? "text-white" : "text-slate-700"
                            )}
                          >
                            Choose how to view your earnings breakdown
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex rounded-lg p-1 w-full sm:w-auto",
                          isDark
                            ? "bg-[#C9A7FF26]  border-[#C9A7FF]"
                            : "bg-[#D9C0FF26] border-[#D9C0FF]"
                        )}
                      >
                        <Button
                          variant={
                            leaderboardViewMode === "simple"
                              ? "default"
                              : "ghost"
                          }
                          size="sm"
                          onClick={() => setLeaderboardViewMode("simple")}
                          className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                            leaderboardViewMode === "simple"
                              ? isDark
                                ? "bg-purple-600 text-white"
                                : "bg-purple-500 text-white"
                              : isDark
                              ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                              : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                            Simple
                          </span>
                        </Button>
                        <Button
                          variant={
                            leaderboardViewMode === "detailed"
                              ? "default"
                              : "ghost"
                          }
                          size="sm"
                          onClick={() => setLeaderboardViewMode("detailed")}
                          className={`text-xs px-3 py-1.5 transition-all duration-200 flex-1 sm:flex-none ${
                            leaderboardViewMode === "detailed"
                              ? isDark
                                ? "bg-purple-600 text-white"
                                : "bg-purple-500 text-white"
                              : isDark
                              ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                              : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                            Detailed
                          </span>
                        </Button>
                      </div>
                    </div>
                  )}

                {/* Logged-in User's Rank Card */}
                {loadingMySubmission && (
                  <div className="text-center py-3">
                    <p>Loading your rank...</p>
                  </div>
                )}
                {(() => {
                  // Show best submission if user has multiple, otherwise show current leaderboard entry
                  const bestSubmission = getBestSubmission();
                  const displayEntry = bestSubmission || myLeaderboardEntry;

                  return (
                    displayEntry && (
                      <Card
                        key={`my-rank-${displayEntry.id}`}
                        className="shadow-lg border-2 border-primary/50 bg-primary/5 dark:bg-primary/10 overflow-hidden mb-6"
                      >
                        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="text-lg sm:text-xl font-bold text-primary w-10 sm:w-12 text-center flex-shrink-0">
                              #
                              {bestSubmission
                                ? rankLookupMap.get(bestSubmission.id)
                                : myLeaderboardEntry?.rank || "?"}
                              {bestSubmission &&
                                myLeaderboardEntry &&
                                bestSubmission.id !== myLeaderboardEntry.id && (
                                  <div className="text-xs text-primary/70 mt-1">
                                    Best
                                  </div>
                                )}
                            </div>
                            <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30 flex-shrink-0">
                              <AvatarImage
                                src={
                                  displayEntry.creator_pfp_url ??
                                  displayEntry.user_platform_pfp_url ??
                                  undefined
                                }
                                alt={displayEntry.user_platform_username}
                              />
                              <AvatarFallback className="bg-primary/20 text-primary">
                                {displayEntry.user_platform_username?.[0]?.toUpperCase() ||
                                  "U"}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className="text-sm sm:text-base font-semibold text-primary dark:text-primary-foreground truncate"
                                title={displayEntry.user_platform_username}
                              >
                                {displayEntry.user_platform_username} (You)
                                {bestSubmission &&
                                  myLeaderboardEntry &&
                                  bestSubmission.id !==
                                    myLeaderboardEntry.id && (
                                    <span className="text-xs text-primary/70 ml-2">
                                      • Best Performance
                                    </span>
                                  )}
                              </p>
                              {renderVerificationBadges(displayEntry.status)}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Submitted:{" "}
                              {formatTimeAgo(displayEntry.created_at)}
                            </p>
                          </div>

                          <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                            <div className="flex items-center space-x-2">
                              <p className="text-base sm:text-lg font-bold text-primary dark:text-primary-foreground">
                                {displayEntry.views
                                  ? displayEntry.views.toLocaleString()
                                  : "0"}{" "}
                                views
                              </p>
                              {displayEntry.content_link && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 sm:h-8 sm:w-8 text-primary/80 hover:text-primary dark:text-primary-foreground/80 dark:hover:text-primary-foreground"
                                  asChild
                                >
                                  <Link
                                    href={displayEntry.content_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="View Your Content"
                                  >
                                    <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                            {(() => {
                              let prizeDisplay = null;
                              if (displayEntry.earnings > 0) {
                                // Show actual earnings for verified or paid submissions; otherwise show expected
                                const isEarned =
                                  displayEntry.status === "verified" ||
                                  displayEntry.status === "paid";
                                const earningsLabel = isEarned
                                  ? "Earned"
                                  : "Expected";

                                // Check for flat fee bonus in detailed mode
                                if (leaderboardViewMode === "detailed") {
                                  const flatFeeBonus =
                                    contestType === "cpm"
                                      ? (contest.contest_based_details as any)
                                          ?.cpm_contest?.flat_fee_bonus || 0
                                      : (contest.contest_based_details as any)
                                          ?.leaderboard_contest
                                          ?.flat_fee_bonus || 0;

                                  if (flatFeeBonus > 0) {
                                    const totalEarnings =
                                      displayEntry.earnings + flatFeeBonus;
                                    prizeDisplay = (
                                      <div className="space-y-1">
                                        <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                          {earningsLabel}:{" "}
                                          {formatMoney(totalEarnings)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                          <span className="whitespace-nowrap">
                                            {formatMoney(displayEntry.earnings)}{" "}
                                            {contestType === "cpm"
                                              ? "CPM"
                                              : "Prize"}
                                          </span>
                                          <span className="text-green-600 dark:text-green-400">
                                            +
                                          </span>
                                          <span className="whitespace-nowrap">
                                            {formatMoney(flatFeeBonus)} Bonus
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    prizeDisplay = (
                                      <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                        {earningsLabel}:{" "}
                                        {formatMoney(displayEntry.earnings)}
                                      </div>
                                    );
                                  }
                                } else {
                                  // Simple view - show total earnings if bonus exists
                                  const flatFeeBonus =
                                    contestType === "cpm"
                                      ? (contest.contest_based_details as any)
                                          ?.cpm_contest?.flat_fee_bonus || 0
                                      : (contest.contest_based_details as any)
                                          ?.leaderboard_contest
                                          ?.flat_fee_bonus || 0;

                                  const totalEarnings =
                                    displayEntry.earnings + flatFeeBonus;
                                  prizeDisplay = (
                                    <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                                      {earningsLabel}:{" "}
                                      {formatMoney(totalEarnings)}
                                    </div>
                                  );
                                }
                              } else if (
                                contest.contest_type === "leaderboard" &&
                                Array.isArray(
                                  contest.contest_based_details
                                    ?.leaderboard_contest?.prizes
                                ) &&
                                myLeaderboardEntry?.rank
                              ) {
                                const prizeInfo = (
                                  contest.contest_based_details
                                    .leaderboard_contest.prizes as PrizeInfo[]
                                ).find(
                                  (p) => p.position === myLeaderboardEntry?.rank
                                );
                                if (prizeInfo) {
                                  const prizeText =
                                    contest.status === "active"
                                      ? "Winning Zone"
                                      : "Prize";

                                  // Check for flat fee bonus in detailed mode
                                  if (leaderboardViewMode === "detailed") {
                                    const flatFeeBonus =
                                      (contest.contest_based_details as any)
                                        ?.leaderboard_contest?.flat_fee_bonus ||
                                      0;

                                    if (flatFeeBonus > 0) {
                                      const totalEarnings =
                                        prizeInfo.amount + flatFeeBonus;
                                      prizeDisplay = (
                                        <div className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                          <div>
                                            <div>
                                              {prizeText}:{" "}
                                              {formatMoney(totalEarnings)}
                                            </div>
                                            <div className="text-xs text-amber-600 dark:text-amber-500">
                                              ({formatMoney(prizeInfo.amount)}{" "}
                                              Prize +{" "}
                                              {formatMoney(flatFeeBonus)} Bonus)
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      prizeDisplay = (
                                        <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                                          <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                          {prizeText}:{" "}
                                          {formatMoney(prizeInfo.amount)}
                                        </span>
                                      );
                                    }
                                  } else {
                                    // Simple view - show total if bonus exists
                                    const flatFeeBonus =
                                      (contest.contest_based_details as any)
                                        ?.leaderboard_contest?.flat_fee_bonus ||
                                      0;
                                    const totalEarnings =
                                      prizeInfo.amount + flatFeeBonus;

                                    prizeDisplay = (
                                      <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                                        <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                                        {prizeText}:{" "}
                                        {formatMoney(totalEarnings)}
                                      </span>
                                    );
                                  }
                                }
                              }
                              return prizeDisplay ? (
                                <div className="text-xs sm:text-sm">
                                  {prizeDisplay}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </CardContent>

                        {/* View All Submissions Button - Only show if user has multiple submissions */}
                        {getUserSubmissions().length > 1 && (
                          <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                            <Dialog
                              open={showAllSubmissionsModal}
                              onOpenChange={setShowAllSubmissionsModal}
                              isdark={isDark}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex w-full items-center justify-center gap-2 px-3 py-3 rounded-full"
                                  style={{
                                    backgroundColor: isDark
                                      ? "#7F39EC"
                                      : "#D9C0FF61",
                                    color: isDark ? "white" : "#7F39EC",
                                    transition: "none",
                                  }}
                                >
                                  <ListOrdered className="h-3 w-3 mr-2" />
                                  View All Your Submissions (
                                  {getUserSubmissions().length})
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                                <DialogHeader className="flex-shrink-0">
                                  <DialogTitle className="flex items-center gap-2">
                                    <ListOrdered className="h-5 w-5" />
                                    All Your Submissions (
                                    {getUserSubmissions().length})
                                  </DialogTitle>

                                  {/* View Mode Toggle for Modal */}
                                  {(contest?.contest_type === "leaderboard" ||
                                    contest?.contest_type === "cpm") &&
                                    (contest.contest_based_details
                                      ?.leaderboard_contest?.flat_fee_bonus ||
                                      contest.contest_based_details?.cpm_contest
                                        ?.flat_fee_bonus ||
                                      (contest as any).bonus_details
                                        ?.description_html) && (
                                      <div className="flex justify-center mt-4">
                                        <div
                                          className={cn(
                                            "flex rounded-lg p-1",
                                            isDark
                                              ? "bg-[#170337]"
                                              : "bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600"
                                          )}
                                        >
                                          <Button
                                            variant={
                                              modalViewMode === "simple"
                                                ? "default"
                                                : "ghost"
                                            }
                                            size="sm"
                                            onClick={() =>
                                              setModalViewMode("simple")
                                            }
                                            className={`text-xs px-3 py-1.5 transition-all duration-200 ${
                                              modalViewMode === "simple"
                                                ? isDark
                                                  ? "bg-purple-600 text-white"
                                                  : "bg-purple-500 text-white"
                                                : isDark
                                                ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                                            }`}
                                          >
                                            Simple
                                          </Button>
                                          <Button
                                            variant={
                                              modalViewMode === "detailed"
                                                ? "default"
                                                : "ghost"
                                            }
                                            size="sm"
                                            onClick={() =>
                                              setModalViewMode("detailed")
                                            }
                                            className={`text-xs px-3 py-1.5 transition-all duration-200 ${
                                              modalViewMode === "detailed"
                                                ? isDark
                                                  ? "bg-purple-600 text-white"
                                                  : "bg-purple-500 text-white"
                                                : isDark
                                                ? "text-slate-300 hover:text-purple-400 hover:bg-purple-900/20"
                                                : "text-slate-600 hover:text-purple-600 hover:bg-purple-50"
                                            }`}
                                          >
                                            Detailed
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                </DialogHeader>

                                {/* Scrollable Content Area */}
                                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                                  {getUserSubmissions().length === 0 ? (
                                    <div className="text-center py-8">
                                      <p
                                        className={cn(
                                          "text-sm",
                                          isDark
                                            ? "text-gray-400"
                                            : "text-gray-600"
                                        )}
                                      >
                                        No submissions found
                                      </p>
                                    </div>
                                  ) : (
                                    (() => {
                                      const userSubmissions =
                                        getUserSubmissions();
                                      const totalPages = Math.ceil(
                                        userSubmissions.length /
                                          modalItemsPerPage
                                      );
                                      const startIndex =
                                        (modalCurrentPage - 1) *
                                        modalItemsPerPage;
                                      const endIndex =
                                        startIndex + modalItemsPerPage;
                                      const currentSubmissions =
                                        userSubmissions.slice(
                                          startIndex,
                                          endIndex
                                        );

                                      return (
                                        <>
                                          {currentSubmissions.map(
                                            (submission, index) => {
                                              // Get actual rank from leaderboard using O(1) lookup
                                              const actualRank =
                                                rankLookupMap.get(
                                                  submission.id
                                                ) || "?";

                                              // Earnings display based on modal view mode
                                              let prizeDisplay = null;
                                              if (submission.earnings > 0) {
                                                const isEarned =
                                                  submission.status ===
                                                    "verified" ||
                                                  submission.status === "paid";
                                                const earningsLabel = isEarned
                                                  ? "Earned"
                                                  : "Expected";

                                                const flatFeeBonus =
                                                  contestType === "cpm"
                                                    ? (
                                                        contest.contest_based_details as any
                                                      )?.cpm_contest
                                                        ?.flat_fee_bonus || 0
                                                    : (
                                                        contest.contest_based_details as any
                                                      )?.leaderboard_contest
                                                        ?.flat_fee_bonus || 0;
                                                const totalEarnings =
                                                  submission.earnings +
                                                  flatFeeBonus;

                                                if (
                                                  modalViewMode ===
                                                    "detailed" &&
                                                  flatFeeBonus > 0
                                                ) {
                                                  prizeDisplay = (
                                                    <div className="space-y-1">
                                                      <div
                                                        className={cn(
                                                          "font-semibold text-green-600 dark:text-green-400 text-sm",
                                                          isDark
                                                            ? "text-green-400"
                                                            : "text-green-600"
                                                        )}
                                                      >
                                                        {earningsLabel}:{" "}
                                                        {formatMoney(
                                                          totalEarnings
                                                        )}
                                                      </div>
                                                      <div
                                                        className={cn(
                                                          "flex flex-wrap items-center gap-1.5 text-xs",
                                                          isDark
                                                            ? "text-green-400 bg-green-900/20 border border-green-800"
                                                            : "text-green-600 bg-green-50 border border-green-200"
                                                        )}
                                                      >
                                                        <div
                                                          className={cn(
                                                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                                            isDark
                                                              ? "bg-green-400"
                                                              : "bg-green-500"
                                                          )}
                                                        ></div>
                                                        <span className="whitespace-nowrap">
                                                          {formatMoney(
                                                            submission.earnings
                                                          )}{" "}
                                                          {contestType === "cpm"
                                                            ? "CPM"
                                                            : "Prize"}
                                                        </span>
                                                        <span
                                                          className={cn(
                                                            "text-green-600 dark:text-green-400",
                                                            isDark
                                                              ? "text-green-400"
                                                              : "text-green-600"
                                                          )}
                                                        >
                                                          +
                                                        </span>
                                                        <span className="whitespace-nowrap">
                                                          {formatMoney(
                                                            flatFeeBonus
                                                          )}{" "}
                                                          Bonus
                                                        </span>
                                                      </div>
                                                    </div>
                                                  );
                                                } else {
                                                  prizeDisplay = (
                                                    <span
                                                      className={cn(
                                                        "font-semibold text-green-600 dark:text-green-400",
                                                        isDark
                                                          ? "text-green-400"
                                                          : "text-green-600"
                                                      )}
                                                    >
                                                      {earningsLabel}:{" "}
                                                      {formatMoney(
                                                        totalEarnings
                                                      )}
                                                    </span>
                                                  );
                                                }
                                              }

                                              // No safety check needed - data comes from existing leaderboard

                                              return (
                                                <Card
                                                  key={submission.id}
                                                  className="border border-slate-200 dark:border-slate-700"
                                                >
                                                  <CardContent className="p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4">
                                                    <div className="text-lg sm:text-xl font-bold text-primary w-10 sm:w-12 text-center flex-shrink-0">
                                                      #{actualRank}
                                                    </div>
                                                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-primary/30 flex-shrink-0">
                                                      <AvatarImage
                                                        src={
                                                          submission.creator_pfp_url ??
                                                          submission.user_platform_pfp_url ??
                                                          undefined
                                                        }
                                                        alt={
                                                          submission.user_platform_username
                                                        }
                                                      />
                                                      <AvatarFallback
                                                        className={cn(
                                                          "bg-primary/20 text-primary",
                                                          isDark
                                                            ? "text-primary-foreground"
                                                            : "text-primary"
                                                        )}
                                                      >
                                                        {submission.user_platform_username?.[0]?.toUpperCase() ||
                                                          "U"}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-grow min-w-0">
                                                      <div className="flex items-center gap-2 mb-1">
                                                        <p
                                                          className={cn(
                                                            "text-sm sm:text-base font-semibold truncate",
                                                            isDark
                                                              ? "text-primary-foreground"
                                                              : "text-primary"
                                                          )}
                                                        >
                                                          {
                                                            submission.user_platform_username
                                                          }{" "}
                                                          {actualRank ===
                                                            myLeaderboardEntry?.rank &&
                                                            "(You)"}
                                                        </p>
                                                        {renderVerificationBadges(
                                                          submission.status
                                                        )}
                                                      </div>
                                                      <p
                                                        className={cn(
                                                          "text-xs text-slate-600 dark:text-slate-400 mb-2",
                                                          isDark
                                                            ? "text-gray-400"
                                                            : "text-gray-600"
                                                        )}
                                                      >
                                                        Submitted:{" "}
                                                        {formatTimeAgo(
                                                          submission.created_at
                                                        )}
                                                      </p>
                                                      <div
                                                        className={cn(
                                                          "flex items-center gap-4 text-xs",
                                                          isDark
                                                            ? "text-gray-400"
                                                            : "text-gray-600"
                                                        )}
                                                      >
                                                        <div className="flex items-center gap-1">
                                                          <Eye className="h-3 w-3" />
                                                          {submission.views.toLocaleString()}{" "}
                                                          views
                                                        </div>
                                                        {prizeDisplay}
                                                      </div>
                                                    </div>
                                                    {submission.content_link && (
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        asChild
                                                        className="h-8 w-8 p-0"
                                                      >
                                                        <Link
                                                          href={
                                                            submission.content_link
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          title="View Content"
                                                        >
                                                          <PlayCircle className="h-4 w-4" />
                                                        </Link>
                                                      </Button>
                                                    )}
                                                  </CardContent>
                                                </Card>
                                              );
                                            }
                                          )}

                                          {/* Pagination Controls */}
                                          {(() => {
                                            const userSubmissions =
                                              getUserSubmissions();
                                            const totalPages = Math.ceil(
                                              userSubmissions.length /
                                                modalItemsPerPage
                                            );

                                            if (totalPages <= 1) return null;

                                            return (
                                              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    setModalCurrentPage(
                                                      (prev) =>
                                                        Math.max(1, prev - 1)
                                                    )
                                                  }
                                                  disabled={
                                                    modalCurrentPage === 1
                                                  }
                                                  className="flex items-center gap-1"
                                                >
                                                  <ChevronLeft className="h-4 w-4" />
                                                  Previous
                                                </Button>

                                                <div className="flex items-center gap-1">
                                                  {Array.from(
                                                    {
                                                      length: Math.min(
                                                        5,
                                                        totalPages
                                                      ),
                                                    },
                                                    (_, i) => {
                                                      let pageNum;
                                                      if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                      } else if (
                                                        modalCurrentPage <= 3
                                                      ) {
                                                        pageNum = i + 1;
                                                      } else if (
                                                        modalCurrentPage >=
                                                        totalPages - 2
                                                      ) {
                                                        pageNum =
                                                          totalPages - 4 + i;
                                                      } else {
                                                        pageNum =
                                                          modalCurrentPage -
                                                          2 +
                                                          i;
                                                      }

                                                      return (
                                                        <Button
                                                          key={pageNum}
                                                          variant={
                                                            modalCurrentPage ===
                                                            pageNum
                                                              ? "default"
                                                              : "outline"
                                                          }
                                                          size="sm"
                                                          onClick={() =>
                                                            setModalCurrentPage(
                                                              pageNum
                                                            )
                                                          }
                                                          className="w-8 h-8 p-0"
                                                        >
                                                          {pageNum}
                                                        </Button>
                                                      );
                                                    }
                                                  )}
                                                </div>

                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    setModalCurrentPage(
                                                      (prev) =>
                                                        Math.min(
                                                          totalPages,
                                                          prev + 1
                                                        )
                                                    )
                                                  }
                                                  disabled={
                                                    modalCurrentPage ===
                                                    totalPages
                                                  }
                                                  className="flex items-center gap-1"
                                                >
                                                  Next
                                                  <ChevronRight className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            );
                                          })()}
                                        </>
                                      );
                                    })()
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </Card>
                    )
                  );
                })()}

                {/* Leaderboard Header */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "text-md",
                      isDark ? "text-white" : "text-black"
                    )}
                  >
                    Last updated:{" "}
                    {contest?.last_metrics_updated
                      ? formatTimeAgo(contest.last_metrics_updated)
                      : lastUpdated
                      ? formatTimeAgo(lastUpdated)
                      : "Never"}
                  </div>

                  {/* Refresh Metrics Button - Only show for active contests with submissions and not finalized */}
                  {contest?.status === "active" &&
                    totalLeaderboardEntries > 0 &&
                    contest?.post_contest_status !== "in_review" &&
                    contest?.post_contest_status !== "verification_complete" &&
                    contest?.post_contest_status !== "payouts_processed" &&
                    (() => {
                      const cooldownInfo =
                        getMetricsRefreshCooldownInfoOpportunities(
                          contest?.last_metrics_updated
                        );

                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRefreshMetrics}
                          disabled={
                            isRefreshingMetrics || !cooldownInfo.canRefresh
                          }
                          className="py-2 rounded-lg text-md bg-[#4A00BE] text-white"
                          title={
                            !cooldownInfo.canRefresh
                              ? `Available in ${formatRemainingTime(
                                  cooldownInfo.remainingMs
                                )}`
                              : "Refresh metrics now"
                          }
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              isRefreshingMetrics ? "animate-spin" : ""
                            }`}
                          />
                          {isRefreshingMetrics
                            ? "Updating..."
                            : !cooldownInfo.canRefresh
                            ? `Wait ${formatRemainingTime(
                                cooldownInfo.remainingMs
                              )}`
                            : "Refresh Metrics"}
                        </Button>
                      );
                    })()}
                </div>

                {/* Submission Stats and Info */}
                <div
                  className={cn(
                    "border rounded-lg p-3 mb-4",
                    isDark
                      ? "bg-blue-700/30 border-blue-700/50"
                      : "bg-blue-50 border-blue-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                        isDark
                          ? "bg-blue-500/30 text-white"
                          : "bg-blue-100 text-blue-600"
                      )}
                    >
                      <Info className="w-3 h-3" />
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-md font-medium",
                          isDark ? "text-white" : "text-blue-900"
                        )}
                      >
                        Leaderboard Display
                      </p>
                      <div
                        className={cn(
                          "text-sm mt-1 space-y-1",
                          isDark ? "text-gray-300" : "text-blue-700"
                        )}
                      >
                        <p>
                          Only non-rejected submissions are shown in the
                          leaderboard.
                        </p>
                        {contest?.live_submission_count !== null &&
                          contest?.live_submission_count !== undefined && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="font-medium">Submissions:</span>
                              <span className="text-green-700 font-semibold">
                                {totalLeaderboardEntries} active
                              </span>
                              {contest.live_submission_count !==
                                totalLeaderboardEntries && (
                                <>
                                  <span
                                    className={cn(
                                      "text-blue-600",
                                      isDark ? "text-gray-400" : "text-blue-700"
                                    )}
                                  >
                                    |
                                  </span>
                                  <span className="text-red-700 font-semibold">
                                    {contest.live_submission_count -
                                      totalLeaderboardEntries}{" "}
                                    rejected
                                  </span>
                                  <span
                                    className={cn(
                                      "text-blue-600",
                                      isDark ? "text-gray-400" : "text-blue-700"
                                    )}
                                  >
                                    |
                                  </span>
                                  <span
                                    className={cn(
                                      "text-blue-700",
                                      isDark ? "text-gray-400" : "text-blue-700"
                                    )}
                                  >
                                    {contest.live_submission_count} total
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
                {leaderboard.map((entry, index) => {
                  const rank =
                    (leaderboardCurrentPage - 1) * leaderboardItemsPerPage +
                    index +
                    1;
                  let prizeDisplay = null;

                  if (entry.earnings > 0) {
                    // For CPM contests, show Expected vs Earned based on verification/paid status
                    if (contestType === "cpm") {
                      const isEarned =
                        entry.status === "verified" || entry.status === "paid";
                      const earningsLabel = isEarned ? "Earned" : "Expected";

                      // Check if there's a flat fee bonus
                      const flatFeeBonus =
                        (contest.contest_based_details as any)?.cpm_contest
                          ?.flat_fee_bonus || 0;

                      // Calculate total earnings (CPM + Bonus if applicable)
                      const totalEarnings = entry.earnings + flatFeeBonus;

                      // Show detailed breakdown if in detailed mode and bonus exists
                      if (
                        leaderboardViewMode === "detailed" &&
                        flatFeeBonus > 0
                      ) {
                        prizeDisplay = (
                          <div className="space-y-1">
                            <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                              {earningsLabel}: {formatMoney(totalEarnings)}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                              <span className="whitespace-nowrap">
                                {formatMoney(entry.earnings)} CPM
                              </span>
                              <span className="text-green-600 dark:text-green-400">
                                +
                              </span>
                              <span className="whitespace-nowrap">
                                {formatMoney(flatFeeBonus)} Bonus
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        prizeDisplay = (
                          <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                            {earningsLabel}: {formatMoney(totalEarnings)}
                          </div>
                        );
                      }
                    } else {
                      // For leaderboard contests with earnings
                      if (
                        contestType === "leaderboard" &&
                        leaderboardViewMode === "detailed"
                      ) {
                        // Check for flat fee bonus in leaderboard contests
                        const flatFeeBonus =
                          (contest.contest_based_details as any)
                            ?.leaderboard_contest?.flat_fee_bonus || 0;

                        if (flatFeeBonus > 0) {
                          const totalEarnings = entry.earnings + flatFeeBonus;
                          prizeDisplay = (
                            <div className="space-y-1">
                              <div
                                className={cn(
                                  "font-semibold text-base",
                                  isDark ? "text-green-300" : "text-green-600"
                                )}
                              >
                                Earned: {formatMoney(totalEarnings)}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded-md border border-green-200 dark:border-green-800">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {formatMoney(entry.earnings)} Prize
                                </span>
                                <span className="text-green-600 dark:text-green-400">
                                  +
                                </span>
                                <span className="whitespace-nowrap">
                                  {formatMoney(flatFeeBonus)} Bonus
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          prizeDisplay = (
                            <div className="font-semibold text-green-600 dark:text-green-400 text-base">
                              Earned: {formatMoney(entry.earnings)}
                            </div>
                          );
                        }
                      } else {
                        // Simple view for leaderboard or non-CPM contests
                        prizeDisplay = (
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            Earned: {formatMoney(entry.earnings)}
                          </span>
                        );
                      }
                    }
                  } else if (
                    contest.contest_type === "leaderboard" &&
                    Array.isArray(
                      contest.contest_based_details?.leaderboard_contest?.prizes
                    )
                  ) {
                    const prizeInfo = (
                      contest.contest_based_details.leaderboard_contest
                        .prizes as PrizeInfo[]
                    ).find((p) => p.position === rank);
                    if (prizeInfo) {
                      const prizeText =
                        contest.status === "active" ? "Winning Zone" : "Prize";

                      // In detailed mode, show bonus information if available
                      if (leaderboardViewMode === "detailed") {
                        const flatFeeBonus =
                          (contest.contest_based_details as any)
                            ?.leaderboard_contest?.flat_fee_bonus || 0;

                        if (flatFeeBonus > 0) {
                          const totalEarnings = prizeInfo.amount + flatFeeBonus;
                          prizeDisplay = (
                            <div className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                              <div>
                                <div>
                                  {prizeText}: {formatMoney(totalEarnings)}
                                </div>
                                <div className="text-xs text-amber-600 dark:text-amber-500">
                                  ({formatMoney(prizeInfo.amount)} Prize +{" "}
                                  {formatMoney(flatFeeBonus)} Bonus)
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          prizeDisplay = (
                            <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                              <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                              {prizeText}: {formatMoney(prizeInfo.amount)}
                            </span>
                          );
                        }
                      } else {
                        // Simple view
                        prizeDisplay = (
                          <span className="font-semibold text-amber-500 dark:text-amber-400 flex items-center">
                            <Trophy className="h-4 w-4 mr-1.5 flex-shrink-0" />
                            {prizeText}: {formatMoney(prizeInfo.amount)}
                          </span>
                        );
                      }
                    }
                  }

                  return (
                    <div
                      key={entry.id}
                      className="border border-[#D1B7F9] rounded-xl overflow-hidden"
                    >
                      <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0 justify-between">
                        <div className="flex items-center space-x-3 md:space-x-4">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-400 dark:text-slate-500 w-6 sm:w-8 text-center flex-shrink-0">
                            {rank}
                          </h2>
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border flex-shrink-0">
                            <AvatarImage
                              src={
                                entry.creator_pfp_url ??
                                entry.user_platform_pfp_url ??
                                undefined
                              }
                              alt={entry.user_platform_username}
                            />
                            <AvatarFallback>
                              {entry.user_platform_username?.[0]?.toUpperCase() ||
                                "U"}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className={cn(
                                  "text-sm sm:text-base font-semibold truncate",
                                  isDark ? "text-white" : "text-gray-700"
                                )}
                              >
                                {entry.user_platform_username}
                              </p>
                              {renderVerificationBadges(entry.status)}
                            </div>
                            <p
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-300" : "text-slate-500"
                              )}
                            >
                              Submitted: {formatTimeAgo(entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-0.5 sm:space-y-1 flex-shrink-0 ml-auto pl-2">
                          <div className="flex items-center space-x-2">
                            <p
                              className={cn(
                                "text-base sm:text-lg font-bold",
                                isDark ? "text-white" : "text-gray-700"
                              )}
                            >
                              {entry.views ? entry.views.toLocaleString() : "0"}{" "}
                              views
                            </p>
                            {entry.content_link && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-7 w-7 sm:h-8 sm:w-8",
                                  isDark ? "text-gray-300" : "text-slate-500"
                                )}
                                asChild
                              >
                                <Link
                                  href={entry.content_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Content"
                                >
                                  <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                          {prizeDisplay && (
                            <div className="text-xs sm:text-sm">
                              {prizeDisplay}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  );
                })}

                {/* Pagination Controls */}
                {totalLeaderboardPages > 1 && (
                  <div className="flex items-center justify-center space-x-4 py-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchLeaderboard(leaderboardCurrentPage - 1)
                      }
                      disabled={leaderboardCurrentPage <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Page {leaderboardCurrentPage} of {totalLeaderboardPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        fetchLeaderboard(leaderboardCurrentPage + 1)
                      }
                      disabled={leaderboardCurrentPage >= totalLeaderboardPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabPanel>
        </TabContent>
      </div>
    </div>
  );
}
