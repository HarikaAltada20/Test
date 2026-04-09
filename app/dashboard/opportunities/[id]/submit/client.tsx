"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Check,
  Eye,
  MessageSquare,
  ThumbsUp,
  Plus,
  Minus,
  AlertTriangle,
  CheckCheck,
  CalendarDays,
  Film,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  EnhancedTabs as Tabs,
  EnhancedTabsContent as TabsContent,
  EnhancedTabsList as TabsList,
  EnhancedTabsTrigger as TabsTrigger,
} from "@/components/ui/enhanced-tabs";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { useToast } from "@/hooks/use-toast";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";

/** Bust server leaderboard cache so rankings update immediately after a new submission */
async function bustLeaderboardCache(contestId: string) {
  try {
    await fetch(`/api/leaderboard/${contestId}/revalidate`, {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {
    console.warn("[submit] leaderboard cache revalidate:", e);
  }
}

// --- Submission Window Constants ---
// CONFIGURATION: Change these values to modify the submission time window
//
// SUBMISSION_WINDOW_VALUE: The numeric value for the time window
// SUBMISSION_WINDOW_UNIT: The time unit (dayjs.ManipulateType)
//   - Valid options: 'year', 'month', 'week', 'day', 'hour', 'minute', 'second'
//   - Examples: 'year', 'month', 'week', 'day', 'hour', 'minute', 'second'
//
// Current setting: 2 years (content must be published within the last 2 years)
// To change to other time periods, modify these examples:
//   - 6 months: SUBMISSION_WINDOW_VALUE = 6, SUBMISSION_WINDOW_UNIT = 'month'
//   - 30 days: SUBMISSION_WINDOW_VALUE = 30, SUBMISSION_WINDOW_UNIT = 'day'
//   - 48 hours: SUBMISSION_WINDOW_VALUE = 48, SUBMISSION_WINDOW_UNIT = 'hour'
//   - 1 week: SUBMISSION_WINDOW_VALUE = 1, SUBMISSION_WINDOW_UNIT = 'week'
// Adjust the submission window value
const SUBMISSION_WINDOW_VALUE: number = 2;
const SUBMISSION_WINDOW_UNIT: dayjs.ManipulateType = "years";

// Auto-generate display text and handle singular/plural forms
const IS_SUBMISSION_WINDOW_SINGULAR: boolean = SUBMISSION_WINDOW_VALUE === 1;
const SUBMISSION_WINDOW_UNIT_DISPLAY = `${SUBMISSION_WINDOW_VALUE} ${SUBMISSION_WINDOW_UNIT}${IS_SUBMISSION_WINDOW_SINGULAR ? "" : "s"
  }`;
// -----------------------------------

interface YouTubeVideo {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      default: {
        url: string;
        width: number;
        height: number;
      };
      medium?: {
        url: string;
        width: number;
        height: number;
      };
      high?: {
        url: string;
        width: number;
        height: number;
      };
      standard?: {
        url: string;
        width: number;
        height: number;
      };
      maxres?: {
        url: string;
        width: number;
        height: number;
      };
    };
  };
  statistics?: {
    // Added for displaying views, likes, comments
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface InstagramReel {
  id: string; // Media ID
  media_type: "REEL" | "VIDEO"; // Should be REEL for our purpose, VIDEO for IGTV, regular videos
  media_url: string;
  thumbnail_url?: string; // Not always present for REELS, might need separate call if required for all
  caption?: string;
  timestamp: string;
  permalink: string;
  // Potentially add insights here if fetched early, or keep them separate until submission
}

// Helper function to extract YouTube ID (client-side only)
function extractYoutubeId(url: string) {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:&\S+)?/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Helper to choose the highest quality available YouTube thumbnail
function getYouTubeThumbnailUrl(
  thumbnails?: YouTubeVideo["snippet"]["thumbnails"],
  videoId?: string,
) {
  if (!thumbnails) {
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
  }

  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null)
  );
}

export default function SubmitContentPage({
  contestId,
  user,
}: {
  contestId: string;
  user: UserResponse["data"]["user"];
}) {
  const [contentLink, setContentLink] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);

  // Multiple submissions state
  const [submissionLinks, setSubmissionLinks] = useState<string[]>([""]);
  const [selectedVideos, setSelectedVideos] = useState<YouTubeVideo[]>([]);
  const [selectedReels, setSelectedReels] = useState<InstagramReel[]>([]);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);

  // Fetched videos for multiple submissions
  const [fetchedVideos, setFetchedVideos] = useState<YouTubeVideo[]>([]);
  const [fetchedReels, setFetchedReels] = useState<InstagramReel[]>([]);
  const [selectedVideoIndices, setSelectedVideoIndices] = useState<number[]>(
    [],
  );
  const [selectedReelIndices, setSelectedReelIndices] = useState<number[]>([]);

  // Track which links have been fetched
  const [fetchedLinkIndices, setFetchedLinkIndices] = useState<Set<number>>(
    new Set(),
  );
  const [linkFetchStatus, setLinkFetchStatus] = useState<{
    [key: number]: "idle" | "fetching" | "success" | "error";
  }>({});

  // Track submitted videos and progress
  const [submittedVideos, setSubmittedVideos] = useState<Set<string>>(
    new Set(),
  );
  const [submissionProgress, setSubmissionProgress] = useState<{
    submitted: number;
    maxAllowed: number;
  }>({ submitted: 0, maxAllowed: 0 });

  // Multiple selection from tabs
  const [selectedVideosFromTabs, setSelectedVideosFromTabs] = useState<
    YouTubeVideo[]
  >([]);
  const [selectedReelsFromTabs, setSelectedReelsFromTabs] = useState<
    InstagramReel[]
  >([]);
  const [youtubeAccount, setYoutubeAccount] = useState<any>(null);
  const [userVideos, setUserVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState(false);
  const [youtubeNextPageToken, setYoutubeNextPageToken] = useState<
    string | null
  >(null);

  // Instagram specific state
  const [instagramAccount, setInstagramAccount] = useState<any>(null); // Holds creator_profiles.instagram_account
  const [userReels, setUserReels] = useState<InstagramReel[]>([]);
  const [selectedReel, setSelectedReel] = useState<InstagramReel | null>(null);
  const [isLoadingReels, setIsLoadingReels] = useState(false);
  const [instagramLink, setInstagramLink] = useState(""); // If we want to allow manual IG link input

  // TikTok specific state
  const [tiktokAccount, setTiktokAccount] = useState<any>(null); // Holds creator_profiles.tiktok_account
  const [tiktokVideoLink, setTiktokVideoLink] = useState("");
  const [tiktokVideoPreview, setTiktokVideoPreview] = useState<any>(null);
  const [isFetchingTiktokVideo, setIsFetchingTiktokVideo] = useState(false);
  const [isTiktokTokenExpired, setIsTiktokTokenExpired] = useState(false);
  const [userTiktokVideos, setUserTiktokVideos] = useState<any[]>([]);
  const [isLoadingTiktokVideos, setIsLoadingTiktokVideos] = useState(false);
  const [isLoadingMoreTiktokVideos, setIsLoadingMoreTiktokVideos] =
    useState(false);
  const [tiktokNextCursor, setTiktokNextCursor] = useState<string | null>(null);
  const [tiktokCurrentPage, setTiktokCurrentPage] = useState(1);
  const [selectedTiktokVideo, setSelectedTiktokVideo] = useState<any>(null);
  const [selectedTiktokVideosFromTabs, setSelectedTiktokVideosFromTabs] =
    useState<any[]>([]);
  const [tiktokLibraryMessage, setTiktokLibraryMessage] = useState<
    string | null
  >(null);

  // TikTok multiple link submissions state
  const [fetchedTiktokVideosFromLinks, setFetchedTiktokVideosFromLinks] =
    useState<any[]>([]);
  const [selectedTiktokVideoIndices, setSelectedTiktokVideoIndices] = useState<
    number[]
  >([]);
  const [selectedTiktokVideosFromLinks, setSelectedTiktokVideosFromLinks] =
    useState<any[]>([]);

  // Pagination state
  const ITEMS_PER_PAGE = 10; // Number of items to display per page
  const [youtubeCurrentPage, setYoutubeCurrentPage] = useState(1);
  const [instagramCurrentPage, setInstagramCurrentPage] = useState(1);
  // Instagram pagination will remain client-side for now, as per current scope
  // If IG also needs server-side, similar token states would be added for instagram

  const [error, setError] = useState<string | null>(null);
  const [submissionTimingError, setSubmissionTimingError] = useState<
    string | null
  >(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null); // Added for library-specific messages
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [isInstagramTokenExpired, setIsInstagramTokenExpired] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isRefreshingInstagramToken, setIsRefreshingInstagramToken] =
    useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const router = useRouter();
  const supabase = createClient();
  const [isFetchingVideo, setIsFetchingVideo] = useState(false);
  const [videoPreview, setVideoPreview] = useState<YouTubeVideo | null>(null);
  const [submissionType, setSubmissionType] = useState<
    "youtube" | "instagram" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [
    currentInstagramBusinessAccountID,
    setCurrentInstagramBusinessAccountID,
  ] = useState<string | null>(null);

  const [contestPlatform, setContestPlatform] = useState<string | null>(null);
  const [isLoadingContest, setIsLoadingContest] = useState(true);
  const [instagramMediaPreview, setInstagramMediaPreview] =
    useState<InstagramReel | null>(null);
  const [isFetchingInstagramMedia, setIsFetchingInstagramMedia] =
    useState(false);
  const [contest, setContest] = useState<any>(null); // Store full contest data including contest_type

  const { toast } = useToast();

  // Derived state for paginated YouTube videos - Reinstated for client-side pagination
  const paginatedUserVideos = userVideos.slice(
    (youtubeCurrentPage - 1) * ITEMS_PER_PAGE,
    youtubeCurrentPage * ITEMS_PER_PAGE,
  );
  const totalYoutubePages = Math.ceil(userVideos.length / ITEMS_PER_PAGE);

  // Derived state for paginated Instagram reels (client-side)
  const paginatedUserReels = userReels.slice(
    (instagramCurrentPage - 1) * ITEMS_PER_PAGE,
    instagramCurrentPage * ITEMS_PER_PAGE,
  );
  const totalInstagramPages = Math.ceil(userReels.length / ITEMS_PER_PAGE);

  // Derived state for paginated TikTok videos (client-side)
  const paginatedTiktokVideos = userTiktokVideos.slice(
    (tiktokCurrentPage - 1) * ITEMS_PER_PAGE,
    tiktokCurrentPage * ITEMS_PER_PAGE,
  );
  const totalTiktokPages = Math.ceil(userTiktokVideos.length / ITEMS_PER_PAGE);

  // Helper function for 2-hour validation
  const isContentTooOld = (publishedAt: string): boolean => {
    const windowAgo = dayjs().subtract(
      SUBMISSION_WINDOW_VALUE,
      SUBMISSION_WINDOW_UNIT,
    );
    return dayjs(publishedAt).isBefore(windowAgo);
  };

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

  useEffect(() => {
    if (selectedVideo) {
      if (selectedVideo.snippet?.publishedAt) {
        if (isContentTooOld(selectedVideo.snippet.publishedAt)) {
          const errorMessage = `You can only submit the content which is posted within ${SUBMISSION_WINDOW_UNIT_DISPLAY}. This video was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Content Too Old",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          setSubmissionTimingError(null);
        }
      } else {
        const errorMessage =
          "The selected video's publication date is missing and cannot be validated.";
        setSubmissionTimingError(errorMessage);
        toast({
          title: "Missing Publication Date",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      if (
        submissionTimingError?.includes("This video was published") ||
        submissionTimingError?.startsWith(
          "The selected video's publication date is missing",
        )
      ) {
        setSubmissionTimingError(null);
      }
    }
  }, [selectedVideo, toast]);

  useEffect(() => {
    if (selectedReel) {
      if (selectedReel.timestamp) {
        if (isContentTooOld(selectedReel.timestamp)) {
          const errorMessage = `You can only submit the content which is posted within ${SUBMISSION_WINDOW_UNIT_DISPLAY}. This Reel was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Content Too Old",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          setSubmissionTimingError(null);
        }
      } else {
        const errorMessage =
          "The selected Reel's publication date is missing and cannot be validated.";
        setSubmissionTimingError(errorMessage);
        toast({
          title: "Missing Publication Date",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      if (
        submissionTimingError?.includes("This Reel was published") ||
        submissionTimingError?.startsWith(
          "The selected Reel's publication date is missing",
        )
      ) {
        setSubmissionTimingError(null);
      }
    }
  }, [selectedReel, toast]);

  // Check if user has connected YouTube account
  useEffect(() => {
    async function checkYouTubeConnection() {
      if (!user || !supabase || contestPlatform !== "youtube") {
        if (contestPlatform === "youtube") setYoutubeAccount(null); // Clear if it was youtube but now no user
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("youtube_account")
          .eq("id", user.id)
          .single();

        setYoutubeAccount(profile?.youtube_account);
      } catch (err) {
        console.error("Error fetching YouTube account:", err);
        setError("Failed to fetch YouTube account information");
      }
    }

    checkYouTubeConnection();
  }, [user, supabase, contestPlatform]);

  // Separate useEffect to handle token expiry and automatic refresh
  useEffect(() => {
    if (youtubeAccount && contestPlatform === "youtube") {
      console.log("YouTube account state changed, checking expiry...");
      console.log("Token expires at:", youtubeAccount.expires_at);
      console.log("Current time:", new Date());
      console.log(
        "Is token expired?",
        new Date(youtubeAccount.expires_at) <= new Date(),
      );

      if (new Date(youtubeAccount.expires_at) <= new Date()) {
        console.log("Token is expired, attempting automatic refresh...");
        // Automatically attempt to refresh the token
        autoRefreshYouTubeTokenAndRetry(fetchYouTubeVideos).then(
          (refreshSuccess) => {
            console.log("Automatic refresh result:", refreshSuccess);
            if (!refreshSuccess) {
              console.log("Automatic refresh failed, setting error state");
              setIsTokenExpired(true);
              setError(
                "Your YouTube connection has expired. Please re-connect your YouTube account.",
              );
            }
          },
        );
      } else {
        console.log("Token is not expired, fetching videos normally");
        fetchYouTubeVideos();
      }
    }
  }, [youtubeAccount, contestPlatform]);

  // Check if user has connected Instagram account
  useEffect(() => {
    async function checkInstagramConnection() {
      if (!user || !supabase || contestPlatform !== "instagram") {
        if (contestPlatform === "instagram") {
          setInstagramAccount(null); // Clear if it was instagram but now no user
          setCurrentInstagramBusinessAccountID(null);
        }
        return;
      }

      try {
        const { data: profileFromDB } = await supabase
          .from("creator_profiles")
          .select("instagram_account")
          .eq("id", user.id)
          .single();

        if (!profileFromDB || !profileFromDB.instagram_account) {
          setInstagramAccount(null);
          setCurrentInstagramBusinessAccountID(null); // Also clear this if no account
          setIsLoadingReels(false);
          return;
        }

        const igAccount = profileFromDB.instagram_account as any;
        setInstagramAccount(igAccount);
        setCurrentInstagramBusinessAccountID(null); // Reset before attempting to set
      } catch (err: any) {
        console.error("Error in checkInstagramConnection:", err);
        setError("Failed to process Instagram account information.");
        setCurrentInstagramBusinessAccountID(null);
        setIsLoadingReels(false);
      }
    }

    checkInstagramConnection();
  }, [user, supabase, contestPlatform]);

  // Separate useEffect to handle Instagram token expiry and automatic refresh
  useEffect(() => {
    if (instagramAccount && contestPlatform === "instagram") {
      console.log("Instagram account state changed, checking expiry...");
      console.log("Token expiry:", instagramAccount.token_expiry);
      console.log("Current time:", dayjs().format());
      console.log(
        "Is token expired?",
        instagramAccount.token_expiry &&
        dayjs().isAfter(dayjs(instagramAccount.token_expiry)),
      );

      if (instagramAccount?.access_token) {
        if (
          instagramAccount.token_expiry &&
          dayjs().isAfter(dayjs(instagramAccount.token_expiry))
        ) {
          console.log(
            "Instagram token is expired, attempting automatic refresh...",
          );
          // Automatically attempt to refresh the token
          autoRefreshInstagramTokenAndRetry(async () => {
            if (instagramAccount.app_scoped_user_id) {
              await fetchInstagramReels(
                instagramAccount.access_token,
                instagramAccount.app_scoped_user_id,
              );
            }
          }).then((refreshSuccess) => {
            console.log("Instagram automatic refresh result:", refreshSuccess);
            if (!refreshSuccess) {
              console.log(
                "Instagram automatic refresh failed, setting error state",
              );
              setIsInstagramTokenExpired(true);
              setError(
                "Your Instagram connection has expired. Please re-connect your Instagram account in settings.",
              );
              setIsLoadingReels(false);
            }
          });
        } else {
          setIsInstagramTokenExpired(false);
          // If it's a Business or Creator account, the app_scoped_user_id IS the IGBA ID needed.
          if (
            (instagramAccount.account_type === "BUSINESS" ||
              instagramAccount.account_type === "MEDIA_CREATOR") &&
            instagramAccount.app_scoped_user_id
          ) {
            setCurrentInstagramBusinessAccountID(
              instagramAccount.app_scoped_user_id,
            );
            // The useEffect listening to currentInstagramBusinessAccountID will now trigger fetchInstagramReels
            setIsLoadingReels(true); // Set loading true, fetchInstagramReels will set it false in its finally block
          } else if (
            !instagramAccount.app_scoped_user_id &&
            (instagramAccount.account_type === "BUSINESS" ||
              instagramAccount.account_type === "MEDIA_CREATOR")
          ) {
            setError(
              "Connected Instagram account is Business/Creator but missing the required ID (app_scoped_user_id). Please try reconnecting the account.",
            );
            setIsLoadingReels(false);
          } else {
            setError(
              "Instagram account must be a Business or Creator account to fetch reels. Current type: " +
              (instagramAccount.account_type || "Unknown"),
            );
            setIsLoadingReels(false);
          }
        }
      } else {
        setInstagramAccount(null);
        setCurrentInstagramBusinessAccountID(null);
        setIsLoadingReels(false);
      }
    }
  }, [instagramAccount, contestPlatform]);

  // New useEffect to fetch reels once currentInstagramBusinessAccountID is set
  useEffect(() => {
    if (
      contestPlatform === "instagram" &&
      currentInstagramBusinessAccountID &&
      instagramAccount?.access_token &&
      !isInstagramTokenExpired
    ) {
      // Ensure it's a business/creator account before fetching reels with IGBA ID
      if (
        instagramAccount.account_type === "BUSINESS" ||
        instagramAccount.account_type === "MEDIA_CREATOR"
      ) {
        fetchInstagramReels(
          instagramAccount.access_token,
          currentInstagramBusinessAccountID,
        );
      }
    }
  }, [
    currentInstagramBusinessAccountID,
    instagramAccount,
    isInstagramTokenExpired,
    contestPlatform,
  ]);

  // Check if user has connected TikTok account
  useEffect(() => {
    async function checkTikTokConnection() {
      if (!user || !supabase || contestPlatform !== "tiktok") {
        if (contestPlatform === "tiktok") setTiktokAccount(null);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("tiktok_account")
          .eq("id", user.id)
          .single();

        if (!profile || !profile.tiktok_account) {
          setTiktokAccount(null);
          return;
        }

        const tkAccount = profile.tiktok_account as any;
        setTiktokAccount(tkAccount);

        // Check token expiry
        if (
          tkAccount.expires_at &&
          new Date(tkAccount.expires_at) <= new Date()
        ) {
          setIsTiktokTokenExpired(true);
          setError(
            "Your TikTok connection has expired. Please re-connect your TikTok account in settings.",
          );
        }
      } catch (err) {
        console.error("Error fetching TikTok account:", err);
        setError("Failed to fetch TikTok account information");
      }
    }

    checkTikTokConnection();
  }, [user, supabase, contestPlatform]);

  // Auto-fetch TikTok videos when account is connected
  useEffect(() => {
    if (
      tiktokAccount &&
      !isTiktokTokenExpired &&
      contestPlatform === "tiktok"
    ) {
      fetchTikTokVideos();
    }
  }, [tiktokAccount, isTiktokTokenExpired, contestPlatform]);

  // Fetch TikTok videos from user's library
  const fetchTikTokVideos = async () => {
    if (contestPlatform !== "tiktok") return;
    setIsLoadingTiktokVideos(true);
    setError(null);
    setTiktokLibraryMessage(null);
    setTiktokNextCursor(null);

    try {
      const response = await fetch("/api/auth/tiktok/videos");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && data.expired) {
          setIsTiktokTokenExpired(true);
          setError(
            "Your TikTok connection has expired. Please reconnect your account.",
          );
          return;
        }
        throw new Error(data.error || "Failed to fetch TikTok videos");
      }

      const allVideos: any[] = data.videos || [];
      // Filter by submission window
      const filteredVideos = allVideos.filter((video: any) => {
        if (!video.create_time) return true; // include if no timestamp
        const publishedAt = new Date(video.create_time * 1000).toISOString();
        return !isContentTooOld(publishedAt);
      });
      setUserTiktokVideos(filteredVideos);
      setTiktokCurrentPage(1);
      setTiktokNextCursor(data.hasMore ? data.nextCursor : null);

      if (allVideos.length > 0 && filteredVideos.length === 0) {
        setTiktokLibraryMessage(
          `All your TikTok videos are older than ${SUBMISSION_WINDOW_UNIT_DISPLAY}. Only recent content is eligible.`,
        );
      }
    } catch (err: any) {
      console.error("Error fetching TikTok videos:", err);
      setError(
        err.message || "Failed to load your TikTok videos. Please try again.",
      );
      setUserTiktokVideos([]);
      setTiktokCurrentPage(1);
    } finally {
      setIsLoadingTiktokVideos(false);
    }
  };

  // Load more TikTok videos
  const loadMoreTiktokVideos = async () => {
    if (!tiktokNextCursor || isLoadingMoreTiktokVideos) return;
    setIsLoadingMoreTiktokVideos(true);

    try {
      const response = await fetch(
        `/api/auth/tiktok/videos?cursor=${encodeURIComponent(tiktokNextCursor)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load more videos");
      }

      const newVideos: any[] = (data.videos || []).filter((video: any) => {
        if (!video.create_time) return true;
        const publishedAt = new Date(video.create_time * 1000).toISOString();
        return !isContentTooOld(publishedAt);
      });

      setUserTiktokVideos((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const unique = newVideos.filter((v) => !existingIds.has(v.id));
        return [...prev, ...unique];
      });
      setTiktokNextCursor(data.hasMore ? data.nextCursor : null);
    } catch (err: any) {
      console.error("Error loading more TikTok videos:", err);
      toast({
        title: "Failed to load more videos",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMoreTiktokVideos(false);
    }
  };

  // Automatic token refresh with retry functionality
  const autoRefreshYouTubeTokenAndRetry = async (
    originalOperation: () => Promise<void>,
  ) => {
    console.log("autoRefreshYouTubeTokenAndRetry called");
    console.log("User:", user?.id);
    console.log("YouTube account:", youtubeAccount);

    if (!user || !youtubeAccount) {
      console.log("Missing user or YouTube account, returning false");
      toast({
        title: "Error",
        description: "User or YouTube account information not available.",
        variant: "destructive",
      });
      return false;
    }

    setIsRefreshingToken(true);
    setError(null);

    try {
      console.log("Starting YouTube token refresh...");
      toast({
        title: "Refreshing Token",
        description:
          "Your YouTube token has expired. Automatically refreshing...",
        variant: "default",
      });

      const response = await fetch("/api/youtube/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await response.json();
      console.log("YouTube refresh response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh YouTube token");
      }

      if (data.success) {
        console.log("YouTube token refresh successful, updating state");
        // Update the local state to reflect the refreshed token
        setYoutubeAccount(data.youtubeAccount);
        setIsTokenExpired(false);
        setError(null);

        toast({
          title: "Token Refreshed",
          description:
            "YouTube token refreshed successfully! Retrying your request...",
          variant: "default",
        });

        // Retry the original operation
        console.log("Retrying original operation...");
        await originalOperation();
        console.log("Original operation completed successfully");
        return true;
      } else {
        throw new Error(data.error || "Token refresh failed");
      }
    } catch (err: any) {
      console.error("Error refreshing YouTube token:", err);
      setError(
        err.message ||
        "Failed to refresh YouTube token. Please try reconnecting your account.",
      );
      setIsTokenExpired(true);
      toast({
        title: "Token Refresh Failed",
        description:
          err.message ||
          "Failed to refresh YouTube token. Please try reconnecting your account.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRefreshingToken(false);
    }
  };

  // Automatic Instagram token refresh with retry functionality
  const autoRefreshInstagramTokenAndRetry = async (
    originalOperation: () => Promise<void>,
  ) => {
    console.log("autoRefreshInstagramTokenAndRetry called");
    console.log("User:", user?.id);
    console.log("Instagram account:", instagramAccount);

    if (!user || !instagramAccount) {
      console.log("Missing user or Instagram account, returning false");
      toast({
        title: "Error",
        description: "User or Instagram account information not available.",
        variant: "destructive",
      });
      return false;
    }

    setIsRefreshingInstagramToken(true);
    setError(null);

    try {
      console.log("Starting Instagram token refresh...");
      toast({
        title: "Refreshing Token",
        description:
          "Your Instagram token has expired. Automatically refreshing...",
        variant: "default",
      });

      const response = await fetch("/api/instagram/refresh-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      const data = await response.json();
      console.log("Instagram refresh response:", response.status, data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh Instagram token");
      }

      if (data.success) {
        console.log("Instagram token refresh successful, updating state");
        // Update the local state to reflect the refreshed token
        setInstagramAccount(data.instagramAccount);
        setIsInstagramTokenExpired(false);
        setError(null);

        toast({
          title: "Token Refreshed",
          description:
            "Instagram token refreshed successfully! Retrying your request...",
          variant: "default",
        });

        // Retry the original operation
        console.log("Retrying original operation...");
        await originalOperation();
        console.log("Original operation completed successfully");
        return true;
      } else {
        throw new Error(data.error || "Token refresh failed");
      }
    } catch (err: any) {
      console.error("Error refreshing Instagram token:", err);
      setError(
        err.message ||
        "Failed to refresh Instagram token. Please try reconnecting your account.",
      );
      setIsInstagramTokenExpired(true);
      toast({
        title: "Token Refresh Failed",
        description:
          err.message ||
          "Failed to refresh Instagram token. Please try reconnecting your account.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRefreshingInstagramToken(false);
    }
  };

  const fetchYouTubeVideos = async () => {
    if (contestPlatform !== "youtube") return;
    setIsLoadingVideos(true);
    setError(null);
    setLibraryMessage(null);
    setYoutubeNextPageToken(null);

    const performFetch = async () => {
      try {
        const response = await fetch(`/api/youtube/videos`);
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            const refreshSuccess =
              await autoRefreshYouTubeTokenAndRetry(performFetch);
            if (!refreshSuccess) {
              setIsTokenExpired(true);
              setError(
                "Your YouTube connection has expired. Please re-connect your YouTube account.",
              );
              setUserVideos([]);
              setYoutubeCurrentPage(1);
            }
            return;
          } else {
            throw new Error(data.error || "Failed to load videos");
          }
        }

        const allFetchedVideos: YouTubeVideo[] = data.videos || [];
        const filteredVideos = allFetchedVideos.filter(
          (video: YouTubeVideo) =>
            video.snippet?.publishedAt &&
            !isContentTooOld(video.snippet.publishedAt),
        );
        setUserVideos(filteredVideos);
        setYoutubeCurrentPage(1);
        setYoutubeNextPageToken(data.nextPageToken || null);

        if (
          data.videos &&
          data.videos.length > 0 &&
          filteredVideos.length === 0
        ) {
          setLibraryMessage(
            `No videos found in your YouTube channel that were published in the last ${SUBMISSION_WINDOW_UNIT_DISPLAY}. You can still fetch an older video by pasting its link directly, but it must have been published within the last ${SUBMISSION_WINDOW_UNIT_DISPLAY} to be eligible for the submission/ contest.`,
          );
        }
      } catch (err: any) {
        console.error("Error fetching YouTube videos:", err);
        setError(
          err.message ||
          "Failed to load your YouTube videos. Please try again.",
        );
        setUserVideos([]);
        setYoutubeCurrentPage(1);
      } finally {
        setIsLoadingVideos(false);
      }
    };

    await performFetch();
  };

  // Load next page of YouTube videos and append to existing list
  const loadMoreYouTubeVideos = async () => {
    if (!youtubeNextPageToken || isLoadingMoreVideos) return;
    setIsLoadingMoreVideos(true);

    try {
      const response = await fetch(
        `/api/youtube/videos?pageToken=${encodeURIComponent(youtubeNextPageToken)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load more videos");
      }

      const newVideos: YouTubeVideo[] = (data.videos || []).filter(
        (video: YouTubeVideo) =>
          video.snippet?.publishedAt &&
          !isContentTooOld(video.snippet.publishedAt),
      );

      setUserVideos((prev) => {
        // Deduplicate by videoId in case of overlap
        const existingIds = new Set(prev.map((v) => v.id.videoId));
        const unique = newVideos.filter((v) => !existingIds.has(v.id.videoId));
        return [...prev, ...unique];
      });
      setYoutubeNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      console.error("Error loading more YouTube videos:", err);
      toast({
        title: "Failed to load more videos",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMoreVideos(false);
    }
  };

  // Handle YouTube reconnection
  const handleReconnectYouTube = () => {
    router.push(
      "/api/youtube/auth?returnTo=" +
      encodeURIComponent(
        `/dashboard/opportunities/${contestId}/submit?platform=${contestPlatform || ""
        }`,
      ), // pass platform back
    );
  };

  // Handle YouTube token refresh (manual trigger)
  const handleRefreshYouTubeToken = async () => {
    await autoRefreshYouTubeTokenAndRetry(fetchYouTubeVideos);
  };

  // Handle Instagram token refresh (manual trigger)
  const handleRefreshInstagramToken = async () => {
    await autoRefreshInstagramTokenAndRetry(async () => {
      if (
        instagramAccount?.access_token &&
        instagramAccount?.app_scoped_user_id
      ) {
        await fetchInstagramReels(
          instagramAccount.access_token,
          instagramAccount.app_scoped_user_id,
        );
      }
    });
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setIsLoadingContest(false);
        return;
      }
      setIsLoadingContest(true);

      // Get contest details first to check multiple submissions setting
      const { data: contestData, error: contestError } = await supabase
        .from("contests")
        .select(
          "id, title, platform, contest_type, multiple_submissions_enabled, max_submissions_per_creator, content_type, bonus_details, contest_based_details",
        ) // Include new feature fields
        .eq("id", contestId)
        .single();

      if (contestError || !contestData) {
        console.error("Error fetching contest:", contestError);
        setError(
          "Failed to load contest details. The contest might not exist or an error occurred.",
        );
        setContestPlatform(null);
        setContest(null);
        setIsLoadingContest(false);
        // Optionally redirect, or let the UI handle the error state
        // redirect("/dashboard/opportunities");
        return;
      }

      // Store full contest data
      setContest(contestData);

      // Fetch existing submissions for progress tracking
      const { data: existingSubmissions } = await supabase
        .from("submissions")
        .select("*")
        .eq("contest_id", contestId)
        .eq("creator_id", user.id);

      if (existingSubmissions && existingSubmissions.length > 0) {
        // Track submitted videos and progress
        const videoIds = existingSubmissions.map(
          (sub: any) => sub.video_id || sub.content_link,
        );
        setSubmittedVideos(new Set(videoIds));
        setSubmissionProgress({
          submitted: existingSubmissions.length,
          maxAllowed: contestData.max_submissions_per_creator || 1,
        });

        // Check if user has reached max submissions
        const maxSubmissions = contestData.max_submissions_per_creator || 1;

        // Only redirect if max submissions reached
        if (existingSubmissions.length >= maxSubmissions) {
          redirect(
            `/dashboard/opportunities/${contestId}?error=already_submitted`,
          );
          return;
        }
      }

      if (contestData.platform) {
        setContestPlatform(contestData.platform.toLowerCase());
      } else {
        setError(
          "This contest does not have a specified platform (e.g., YouTube or Instagram).",
        );
        setContestPlatform(null);
      }
      // Reset page to 1 when contest platform changes or loads
      setYoutubeCurrentPage(1);
      setInstagramCurrentPage(1);
      setIsLoadingContest(false);
    }

    fetchData();
  }, [contestId, user, router, supabase]); // Removed redirect from dependencies as it's called within

  const handleFetchVideo = async () => {
    if (!contentLink) {
      const errorMessage = "Please enter a YouTube video link.";
      setError(errorMessage);
      toast({
        title: "Missing Video Link",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    const videoId = extractYoutubeId(contentLink);
    if (!videoId) {
      const errorMessage = "Invalid YouTube URL";
      setError(errorMessage);
      toast({
        title: "Invalid YouTube URL",
        description: errorMessage,
        variant: "destructive",
      });
      setIsFetchingVideo(false);
      return;
    }

    setIsFetchingVideo(true);
    setError(null);
    setSubmissionTimingError(null);
    setVideoPreview(null);
    setSelectedVideo(null);

    try {
      const response = await fetch("/api/youtube/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: contentLink }),
      });

      const responseData = await response.json(); // Call .json() ONCE

      if (!response.ok) {
        let errorMessage = "Failed to verify YouTube video"; // Default message
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      // response.ok is true here
      if (responseData && responseData.valid && responseData.videoInfo) {
        const videoData: YouTubeVideo = responseData.videoInfo;
        if (videoData?.snippet?.publishedAt) {
          if (isContentTooOld(videoData.snippet.publishedAt)) {
            const errorMessage = `You can only submit the content which is posted within ${SUBMISSION_WINDOW_VALUE} ${SUBMISSION_WINDOW_UNIT}. This video was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
            setSubmissionTimingError(errorMessage);
            setVideoPreview(videoData);
            toast({
              title: "Content Too Old",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            setSubmissionTimingError(null);
            setVideoPreview(videoData);
            setSelectedVideo(videoData);
            setSubmissionType("youtube");
            setError(null);
          }
        } else {
          setVideoPreview(videoData || null);
          setSelectedVideo(null);
          const errorMessage = videoData
            ? "Could not determine the video's publication date."
            : "Video not found or invalid link.";
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Missing Publication Date",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        // Response was OK, but data structure is not as expected for a valid video
        let errorMessage =
          "YouTube video verification failed or video information not found.";
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      // This will catch errors from fetch itself (network error) or SyntaxError from response.json() if body is not valid JSON, or errors thrown above.
      setError(
        err.message ||
        "An unexpected error occurred while fetching YouTube video.",
      );
      setVideoPreview(null);
      setSelectedVideo(null);
    } finally {
      setIsFetchingVideo(false);
    }
  };

  const handleFetchInstagramByLink = async () => {
    if (!instagramLink) {
      const errorMessage = "Please enter an Instagram media URL.";
      setError(errorMessage);
      toast({
        title: "Missing Instagram Link",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    if (
      !instagramAccount?.access_token ||
      !instagramAccount?.app_scoped_user_id
    ) {
      const errorMessage =
        "Instagram account not connected, token missing, or user ID missing.";
      setError(errorMessage);
      toast({
        title: "Instagram Connection Required",
        description: errorMessage,
        variant: "destructive",
      });
      setIsFetchingInstagramMedia(false);
      return;
    }
    if (!user) {
      const errorMessage =
        "User not available. Please ensure you are logged in.";
      setError(errorMessage);
      toast({
        title: "Authentication Required",
        description: errorMessage,
        variant: "destructive",
      });
      setIsFetchingInstagramMedia(false);
      return;
    }

    setIsFetchingInstagramMedia(true);
    setError(null);
    setSubmissionTimingError(null);
    setInstagramMediaPreview(null);
    setSelectedReel(null);

    try {
      const response = await fetch("/api/instagram/verify-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: instagramLink,
          userAccessToken: instagramAccount.access_token,
          userAppScopedId: instagramAccount.app_scoped_user_id,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = "Failed to verify Instagram media";
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      if (responseData && responseData.valid && responseData.mediaInfo) {
        const mediaDetails: InstagramReel = responseData.mediaInfo;
        if (mediaDetails?.timestamp) {
          if (isContentTooOld(mediaDetails.timestamp)) {
            const errorMessage = `You can only submit the content which is posted within ${SUBMISSION_WINDOW_UNIT_DISPLAY}. This Reel was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
            setSubmissionTimingError(errorMessage);
            setInstagramMediaPreview(mediaDetails);
            toast({
              title: "Content Too Old",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            setSubmissionTimingError(null);
            setInstagramMediaPreview(mediaDetails);
            setSelectedReel(mediaDetails);
            setSubmissionType("instagram");
            setError(null);
          }
        } else {
          setInstagramMediaPreview(mediaDetails || null);
          setSelectedReel(null);
          const errorMessage = mediaDetails
            ? "Could not determine the Reel's publication date."
            : "Reel not found or invalid link.";
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Missing Publication Date",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        let errorMessage =
          "Instagram media verification failed or media info not found.";
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      console.error("Error in handleFetchInstagramByLink:", err);
      setError(
        err.message ||
        "An unexpected error occurred while fetching Instagram media.",
      );
      setInstagramMediaPreview(null);
      setSelectedReel(null);
    } finally {
      setIsFetchingInstagramMedia(false);
    }
  };

  // Multiple submission handlers
  const handleFetchVideoMultiple = async (link: string, index: number) => {
    if (!link.trim()) {
      setError("Please enter a YouTube video URL");
      return;
    }

    setIsFetchingVideo(true);
    setError(null);

    try {
      const response = await fetch("/api/youtube/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: link }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = "Failed to verify YouTube video";
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      if (responseData && responseData.valid && responseData.videoInfo) {
        const videoData: YouTubeVideo = responseData.videoInfo;
        if (videoData?.snippet?.publishedAt) {
          if (isContentTooOld(videoData.snippet.publishedAt)) {
            const errorMessage = `Video ${index + 1
              } was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
            setError(errorMessage);
            toast({
              title: "Content Too Old",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            const newFetchedVideos = [...fetchedVideos];
            newFetchedVideos[index] = videoData;
            setFetchedVideos(newFetchedVideos);
            setError(null);
          }
        } else {
          const errorMessage = `Could not determine publication date for video ${index + 1
            }.`;
          setError(errorMessage);
          toast({
            title: "Missing Publication Date",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        let errorMessage = `YouTube video verification failed for video ${index + 1
          }.`;
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      setError(
        err.message ||
        "An unexpected error occurred while fetching YouTube video.",
      );
    } finally {
      setIsFetchingVideo(false);
    }
  };

  const handleFetchInstagramVideoMultiple = async (
    link: string,
    index: number,
  ) => {
    if (!link.trim()) {
      setError("Please enter an Instagram video URL");
      return;
    }

    if (
      !instagramAccount?.access_token ||
      !instagramAccount?.app_scoped_user_id
    ) {
      setError("Instagram account not connected properly.");
      return;
    }

    setIsFetchingVideo(true);
    setError(null);

    try {
      const response = await fetch("/api/instagram/verify-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: link,
          userAccessToken: instagramAccount.access_token,
          userAppScopedId: instagramAccount.app_scoped_user_id,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = "Failed to verify Instagram video";
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      if (responseData && responseData.valid && responseData.mediaInfo) {
        const mediaDetails: InstagramReel = responseData.mediaInfo;
        if (mediaDetails?.timestamp) {
          if (isContentTooOld(mediaDetails.timestamp)) {
            const errorMessage = `Video ${index + 1
              } was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
            setError(errorMessage);
            toast({
              title: "Content Too Old",
              description: errorMessage,
              variant: "destructive",
            });
          } else {
            const newFetchedReels = [...fetchedReels];
            newFetchedReels[index] = mediaDetails;
            setFetchedReels(newFetchedReels);
            setError(null);
          }
        } else {
          const errorMessage = `Could not determine publication date for video ${index + 1
            }.`;
          setError(errorMessage);
          toast({
            title: "Missing Publication Date",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        let errorMessage = `Instagram video verification failed for video ${index + 1
          }.`;
        if (responseData && typeof responseData.error === "string") {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === "string") {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      setError(
        err.message ||
        "An unexpected error occurred while fetching Instagram video.",
      );
    } finally {
      setIsFetchingVideo(false);
    }
  };

  const handleFetchTiktokVideoMultiple = async (
    link: string,
    index: number,
  ) => {
    if (!link.trim()) {
      setError("Please enter a TikTok video URL");
      return;
    }

    setIsFetchingVideo(true);
    setError(null);

    try {
      // Extract video ID from TikTok URL
      const tiktokUrlPattern = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
      const match = link.match(tiktokUrlPattern);
      const videoId = match ? match[1] : null;

      if (!videoId) {
        throw new Error(
          `Could not extract video ID from TikTok URL for link ${index + 1}. Please use a direct TikTok video link (e.g., https://www.tiktok.com/@username/video/1234567890).`,
        );
      }

      // Validate ownership: extract @username from URL and compare with connected account
      const usernameMatch = link.match(/tiktok\.com\/@([\w.-]+)\//i);
      const urlUsername = usernameMatch ? usernameMatch[1].toLowerCase() : null;
      const connectedUsername = tiktokAccount?.username?.toLowerCase();

      if (
        urlUsername &&
        connectedUsername &&
        urlUsername !== connectedUsername
      ) {
        const errorMessage = `Link ${index + 1}: This video belongs to @${usernameMatch![1]}, not your connected TikTok account (@${tiktokAccount.username}). You can only submit your own content.`;
        setError(errorMessage);
        toast({
          title: "Not Your Content",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `/api/auth/tiktok/video-info?video_id=${videoId}`,
        {
          headers: { "Content-Type": "application/json" },
        },
      );

      let videoData: any;
      if (response.ok) {
        const data = await response.json();
        videoData = data.video || {
          id: videoId,
          share_url: link,
          title: "TikTok Video",
          view_count: 0,
          like_count: 0,
          comment_count: 0,
          share_count: 0,
        };
      } else {
        // API returned an error – likely the video doesn't belong to this user
        const errorData = await response.json().catch(() => ({}));
        const is404 = response.status === 404;
        if (is404) {
          const errorMessage = `Link ${index + 1}: This video was not found in your connected TikTok account. You can only submit your own TikTok videos.`;
          setError(errorMessage);
          toast({
            title: "Not Your Content",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
        // For other errors (token expired, etc.), show the API error
        throw new Error(
          errorData?.error ||
          `Failed to verify TikTok video for link ${index + 1}.`,
        );
      }

      // Check content age if create_time is available
      if (videoData.create_time) {
        const videoDate = new Date(videoData.create_time * 1000).toISOString();
        if (isContentTooOld(videoDate)) {
          const errorMessage = `Video ${index + 1} was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
          setError(errorMessage);
          toast({
            title: "Content Too Old",
            description: errorMessage,
            variant: "destructive",
          });
          return;
        }
      }

      const newFetchedTiktokVideos = [...fetchedTiktokVideosFromLinks];
      newFetchedTiktokVideos[index] = videoData;
      setFetchedTiktokVideosFromLinks(newFetchedTiktokVideos);
      setError(null);
    } catch (err: any) {
      setError(
        err.message ||
        "An unexpected error occurred while fetching TikTok video.",
      );
    } finally {
      setIsFetchingVideo(false);
    }
  };

  const handleFetchAllVideos = async () => {
    const unfetchedLinks = submissionLinks
      .map((link, index) => ({ link, index }))
      .filter(
        ({ link, index }) => link.trim() && !fetchedLinkIndices.has(index),
      );

    if (unfetchedLinks.length === 0) {
      toast({
        title: "All Links Fetched",
        description: "All links have already been fetched",
        variant: "default",
      });
      return;
    }

    setIsFetchingVideo(true);
    setError(null);

    try {
      const promises = unfetchedLinks.map(({ link, index }) => {
        if (contestPlatform?.toLowerCase() === "youtube") {
          return handleFetchVideoMultiple(link, index);
        } else if (contestPlatform?.toLowerCase() === "tiktok") {
          return handleFetchTiktokVideoMultiple(link, index);
        } else {
          return handleFetchInstagramVideoMultiple(link, index);
        }
      });

      await Promise.all(promises);

      // Mark all as fetched
      setFetchedLinkIndices((prev) => {
        const newSet = new Set(prev);
        unfetchedLinks.forEach(({ index }) => newSet.add(index));
        return newSet;
      });

      toast({
        title: "Fetch Complete",
        description: `Successfully fetched ${unfetchedLinks.length} new videos`,
        variant: "default",
      });
    } catch (error) {
      console.error("Error fetching all videos:", error);
      toast({
        title: "Fetch Failed",
        description: "Failed to fetch some videos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingVideo(false);
    }
  };

  // Fetch existing submissions to track progress and prevent duplicates
  const fetchExistingSubmissions = async () => {
    if (!user || !contestId) return;

    try {
      const response = await fetch(
        `/api/leaderboard/${contestId}/my-submission`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.submissions) {
          const videoIds = data.submissions.map(
            (sub: any) => sub.video_id || sub.content_link,
          );
          setSubmittedVideos(new Set(videoIds));
          setSubmissionProgress({
            submitted: data.submissions.length,
            maxAllowed: contest?.max_submissions_per_creator || 1,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching existing submissions:", error);
    }
  };

  // Helper function to check if a video is already selected
  const isVideoAlreadySelected = (
    videoId: string,
    platform: "youtube" | "instagram" | "tiktok",
  ) => {
    if (platform === "youtube") {
      return (
        selectedVideosFromTabs.some((v) => v.id.videoId === videoId) ||
        selectedVideos.some((v) => v.id.videoId === videoId)
      );
    } else if (platform === "tiktok") {
      return (
        selectedTiktokVideosFromTabs.some((v: any) => v.id === videoId) ||
        selectedTiktokVideosFromLinks.some((v: any) => v.id === videoId)
      );
    } else {
      return (
        selectedReelsFromTabs.some((r) => r.id === videoId) ||
        selectedReels.some((r) => r.id === videoId)
      );
    }
  };

  // Helper function to check if a video has already been submitted
  const isVideoAlreadySubmitted = (videoId: string, contentUrl: string) => {
    return submittedVideos.has(videoId) || submittedVideos.has(contentUrl);
  };

  // Individual fetch function for a single link
  const handleIndividualFetch = async (link: string, index: number) => {
    if (!link.trim()) {
      toast({
        title: "Empty Link",
        description: "Please enter a video URL before fetching",
        variant: "destructive",
      });
      return;
    }

    setLinkFetchStatus((prev) => ({ ...prev, [index]: "fetching" }));

    try {
      if (contestPlatform?.toLowerCase() === "youtube") {
        await handleFetchVideoMultiple(link, index);
      } else if (contestPlatform?.toLowerCase() === "tiktok") {
        await handleFetchTiktokVideoMultiple(link, index);
      } else {
        await handleFetchInstagramVideoMultiple(link, index);
      }

      setFetchedLinkIndices((prev) => new Set([...prev, index]));
      setLinkFetchStatus((prev) => ({ ...prev, [index]: "success" }));
    } catch (error) {
      setLinkFetchStatus((prev) => ({ ...prev, [index]: "error" }));
      toast({
        title: "Fetch Failed",
        description: `Failed to fetch video from link ${index + 1}`,
        variant: "destructive",
      });
    }
  };

  // Individual remove function for a single link
  const handleIndividualRemove = (index: number) => {
    const newLinks = [...submissionLinks];
    newLinks.splice(index, 1);
    setSubmissionLinks(newLinks);

    // Remove from fetched indices if it was fetched
    setFetchedLinkIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    // Remove from fetched videos/reels if it was fetched
    if (contestPlatform?.toLowerCase() === "youtube") {
      setFetchedVideos((prev) => prev.filter((_, i) => i !== index));
    } else if (contestPlatform?.toLowerCase() === "tiktok") {
      setFetchedTiktokVideosFromLinks((prev) =>
        prev.filter((_, i) => i !== index),
      );
    } else {
      setFetchedReels((prev) => prev.filter((_, i) => i !== index));
    }

    // Clear fetch status
    setLinkFetchStatus((prev) => {
      const newStatus = { ...prev };
      delete newStatus[index];
      return newStatus;
    });
  };

  // Handle video selection for multiple submissions
  const handleVideoSelection = (index: number, isSelected: boolean) => {
    if (contestPlatform?.toLowerCase() === "youtube") {
      if (isSelected) {
        const video = fetchedVideos[index];
        if (video) {
          // Check if video is already submitted
          if (
            isVideoAlreadySubmitted(
              video.id.videoId,
              `https://www.youtube.com/watch?v=${video.id.videoId}`,
            )
          ) {
            toast({
              title: "Video Already Submitted",
              description: `"${video.snippet.title}" has already been submitted to this contest`,
              variant: "destructive",
            });
            return;
          }

          // Check if video is already selected elsewhere
          if (isVideoAlreadySelected(video.id.videoId, "youtube")) {
            toast({
              title: "Video Already Selected",
              description: "This video is already selected from another source",
              variant: "destructive",
            });
            return;
          }

          // Check limit
          const maxSubmissions = contest?.max_submissions_per_creator || 1;
          const totalSelected =
            selectedVideosFromTabs.length +
            selectedReelsFromTabs.length +
            selectedVideos.length +
            selectedReels.length;
          if (totalSelected >= maxSubmissions) {
            toast({
              title: "Selection Limit Reached",
              description: `You can only select up to ${maxSubmissions} videos for this contest`,
              variant: "destructive",
            });
            return;
          }

          setSelectedVideoIndices([...selectedVideoIndices, index]);
          setSelectedVideos([...selectedVideos, video]);
        }
      } else {
        setSelectedVideoIndices(
          selectedVideoIndices.filter((i) => i !== index),
        );
        setSelectedVideos(
          selectedVideos.filter((_, i) => selectedVideoIndices[i] !== index),
        );
      }
    } else {
      if (isSelected) {
        const reel = fetchedReels[index];
        if (reel) {
          // Check if reel is already submitted
          if (isVideoAlreadySubmitted(reel.id, reel.permalink)) {
            toast({
              title: "Video Already Submitted",
              description: `"${reel.caption || "Instagram Reel"
                }" has already been submitted to this contest`,
              variant: "destructive",
            });
            return;
          }

          // Check if reel is already selected elsewhere
          if (isVideoAlreadySelected(reel.id, "instagram")) {
            toast({
              title: "Video Already Selected",
              description: "This video is already selected from another source",
              variant: "destructive",
            });
            return;
          }

          // Check limit
          const maxSubmissions = contest?.max_submissions_per_creator || 1;
          const totalSelected =
            selectedVideosFromTabs.length +
            selectedReelsFromTabs.length +
            selectedVideos.length +
            selectedReels.length;
          if (totalSelected >= maxSubmissions) {
            toast({
              title: "Selection Limit Reached",
              description: `You can only select up to ${maxSubmissions} videos for this contest`,
              variant: "destructive",
            });
            return;
          }

          setSelectedReelIndices([...selectedReelIndices, index]);
          setSelectedReels([...selectedReels, reel]);
        }
      } else {
        setSelectedReelIndices(selectedReelIndices.filter((i) => i !== index));
        setSelectedReels(
          selectedReels.filter((_, i) => selectedReelIndices[i] !== index),
        );
      }
    }
  };

  // Handle TikTok video selection for multiple submissions (from link inputs)
  const handleTiktokVideoSelection = (index: number, isSelected: boolean) => {
    if (isSelected) {
      const video = fetchedTiktokVideosFromLinks[index];
      if (video) {
        // Check if video is already submitted
        if (isVideoAlreadySubmitted(video.id, video.share_url || "")) {
          toast({
            title: "Video Already Submitted",
            description: `This TikTok video has already been submitted to this contest`,
            variant: "destructive",
          });
          return;
        }

        // Check if video is already selected elsewhere
        if (isVideoAlreadySelected(video.id, "tiktok")) {
          toast({
            title: "Video Already Selected",
            description: "This video is already selected from another source",
            variant: "destructive",
          });
          return;
        }

        // Check limit
        const maxSubmissions = contest?.max_submissions_per_creator || 1;
        const remainingSubmissions =
          maxSubmissions - submissionProgress.submitted;
        const totalSelected =
          selectedTiktokVideosFromTabs.length +
          selectedTiktokVideosFromLinks.length;
        if (totalSelected >= remainingSubmissions) {
          toast({
            title: "Selection Limit Reached",
            description: `You can only select up to ${remainingSubmissions} more videos for this contest (${submissionProgress.submitted} already submitted)`,
            variant: "destructive",
          });
          return;
        }

        setSelectedTiktokVideoIndices([...selectedTiktokVideoIndices, index]);
        setSelectedTiktokVideosFromLinks([
          ...selectedTiktokVideosFromLinks,
          video,
        ]);
      }
    } else {
      setSelectedTiktokVideoIndices(
        selectedTiktokVideoIndices.filter((i) => i !== index),
      );
      setSelectedTiktokVideosFromLinks(
        selectedTiktokVideosFromLinks.filter(
          (_, i) => selectedTiktokVideoIndices[i] !== index,
        ),
      );
    }
  };

  // ============================================================================
  // SUBMISSION HANDLERS - Clean separation of concerns
  // ============================================================================

  /**
   * Handle single YouTube video submission
   */
  const handleSingleYoutubeSubmission = async () => {
    if (!youtubeAccount) {
      throw new Error(
        "YouTube account not connected. Please connect your YouTube account in settings.",
      );
    }

    const videoToSubmit = selectedVideo || videoPreview;
    if (!videoToSubmit) {
      throw new Error("No YouTube video selected or fetched for submission.");
    }

    setMessage("Preparing YouTube video submission...");

    const youtubeStats = {
      likes: videoToSubmit?.statistics?.likeCount
        ? parseInt(videoToSubmit.statistics.likeCount)
        : 0,
      comments: videoToSubmit?.statistics?.commentCount
        ? parseInt(videoToSubmit.statistics.commentCount)
        : 0,
    };

    const youtubeThumbnailUrl =
      getYouTubeThumbnailUrl(
        videoToSubmit.snippet.thumbnails,
        videoToSubmit.id.videoId,
      ) || `https://i.ytimg.com/vi/${videoToSubmit.id.videoId}/hqdefault.jpg`;

    const submissionPayload = {
      contest_id: contestId,
      creator_id: user!.id,
      status: "pending",
      platform: "youtube",
      views: videoToSubmit?.statistics?.viewCount
        ? parseInt(videoToSubmit.statistics.viewCount)
        : 0,
      content_link: `https://www.youtube.com/watch?v=${videoToSubmit.id.videoId}`,
      video_id: videoToSubmit.id.videoId,
      video_title: videoToSubmit.snippet.title,
      video_thumbnail_url: youtubeThumbnailUrl,
      other_stats: { youtube: youtubeStats },
    };

    const { error: submissionError } = await supabase
      .from("submissions")
      .insert([submissionPayload])
      .select();

    if (submissionError) {
      throw submissionError;
    }
    await bustLeaderboardCache(contestId);
  };

  /**
   * Handle single Instagram reel submission
   */
  const handleSingleInstagramSubmission = async () => {
    if (!instagramAccount?.access_token) {
      throw new Error(
        "Instagram account not connected. Please connect your Instagram account in settings.",
      );
    }

    if (!selectedReel) {
      throw new Error("No Instagram reel selected for submission.");
    }

    setMessage("Fetching Instagram Reel insights...");

    const insightsRes = await fetch(
      `https://graph.instagram.com/${selectedReel.id}/insights?metric=reach,likes,comments,shares,saved,total_interactions,views&access_token=${instagramAccount.access_token}`,
    );
    const insightsData = await insightsRes.json();

    if (!insightsRes.ok || insightsData.error) {
      if (insightsData.error?.error_subcode === 2108006) {
        throw new Error(
          "This Reel was posted before your Instagram account was converted to a Business/Creator account, so its metrics cannot be fetched. Please select a different Reel.",
        );
      }
      throw new Error(
        insightsData.error?.message ||
        "Failed to fetch Instagram Reel insights.",
      );
    }

    let primaryViews = 0;
    const instagramApiMetrics: any = {};

    if (insightsData?.data && Array.isArray(insightsData.data)) {
      insightsData.data.forEach(
        (metric: { name: string; values: { value: number }[] }) => {
          const value = metric.values[0]?.value || 0;
          instagramApiMetrics[metric.name] = value;
          if (metric.name === "views") {
            primaryViews = value;
          }
        },
      );
    }

    // Fallback to reach if views is 0
    if (primaryViews === 0 && instagramApiMetrics.reach > 0) {
      primaryViews = instagramApiMetrics.reach;
    }

    const defaultStats = {
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saved: 0,
      total_interactions: 0,
      views: 0,
    };
    const finalInstagramStats = { ...defaultStats, ...instagramApiMetrics };

    const submissionPayload = {
      contest_id: contestId,
      creator_id: user!.id,
      status: "pending",
      platform: "instagram",
      views: primaryViews,
      content_link: selectedReel.permalink,
      video_id: selectedReel.id,
      video_title: selectedReel.caption || "Instagram Content",
      video_thumbnail_url: selectedReel.thumbnail_url,
      other_stats: { instagram: finalInstagramStats },
    };

    const { error: submissionError } = await supabase
      .from("submissions")
      .insert([submissionPayload])
      .select();

    if (submissionError) {
      throw submissionError;
    }
    await bustLeaderboardCache(contestId);
  };

  /**
   * Handle multiple YouTube videos submission
   */
  const handleMultipleYoutubeSubmission = async (videos: YouTubeVideo[]) => {
    if (!youtubeAccount) {
      throw new Error(
        "YouTube account not connected. Please connect your YouTube account in settings.",
      );
    }

    const submissionPromises = videos.map(async (video) => {
      try {
        const youtubeStats = {
          likes: video?.statistics?.likeCount
            ? parseInt(video.statistics.likeCount)
            : 0,
          comments: video?.statistics?.commentCount
            ? parseInt(video.statistics.commentCount)
            : 0,
        };

        const youtubeThumbnailUrl =
          getYouTubeThumbnailUrl(video.snippet.thumbnails, video.id.videoId) ||
          `https://i.ytimg.com/vi/${video.id.videoId}/hqdefault.jpg`;

        const submissionPayload = {
          contest_id: contestId,
          creator_id: user!.id,
          status: "pending",
          platform: "youtube",
          content_link: `https://www.youtube.com/watch?v=${video.id.videoId}`,
          video_id: video.id.videoId,
          video_title: video.snippet.title,
          video_thumbnail_url: youtubeThumbnailUrl,
          views: video?.statistics?.viewCount
            ? parseInt(video.statistics.viewCount)
            : 0,
          other_stats: { youtube: youtubeStats },
        };

        return await supabase
          .from("submissions")
          .insert([submissionPayload])
          .select();
      } catch (error) {
        console.error(
          `Error submitting YouTube video ${video.id.videoId}:`,
          error,
        );
        // Re-throw the error so it can be properly handled by the calling function
        throw error;
      }
    });

    const batch = await Promise.all(submissionPromises);
    await bustLeaderboardCache(contestId);
    return batch;
  };

  /**
   * Handle multiple Instagram reels submission
   */
  const handleMultipleInstagramSubmission = async (reels: InstagramReel[]) => {
    if (!instagramAccount?.access_token) {
      throw new Error(
        "Instagram account not connected. Please connect your Instagram account in settings.",
      );
    }

    const submissionPromises = reels.map(async (reel) => {
      try {
        // Fetch insights for each reel
        const insightsRes = await fetch(
          `https://graph.instagram.com/${reel.id}/insights?metric=reach,likes,comments,shares,saved,total_interactions,views&access_token=${instagramAccount.access_token}`,
        );
        const insightsData = await insightsRes.json();

        // Check for specific Instagram account conversion error
        if (!insightsRes.ok || insightsData.error) {
          if (insightsData.error?.error_subcode === 2108006) {
            throw new Error(
              `"${reel.caption || "Instagram Reel"
              }" was posted before your Instagram account was converted to a Business/Creator account, so its metrics cannot be fetched. Please select a different Reel.`,
            );
          }
          throw new Error(
            insightsData.error?.message ||
            "Failed to fetch Instagram Reel insights.",
          );
        }

        let primaryViews = 0;
        const instagramApiMetrics: any = {};

        if (insightsData?.data && Array.isArray(insightsData.data)) {
          insightsData.data.forEach(
            (metric: { name: string; values: { value: number }[] }) => {
              const value = metric.values[0]?.value || 0;
              instagramApiMetrics[metric.name] = value;
              if (metric.name === "views") {
                primaryViews = value;
              }
            },
          );

          if (primaryViews === 0 && instagramApiMetrics.reach > 0) {
            primaryViews = instagramApiMetrics.reach;
          }
        }

        const defaultStats = {
          reach: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saved: 0,
          total_interactions: 0,
          views: 0,
        };
        const finalInstagramStats = { ...defaultStats, ...instagramApiMetrics };

        return await supabase
          .from("submissions")
          .insert([
            {
              contest_id: contestId,
              creator_id: user!.id,
              status: "pending",
              platform: "instagram",
              content_link: reel.permalink,
              video_id: reel.id,
              video_title: reel.caption || "Instagram Reel",
              video_thumbnail_url: reel.thumbnail_url,
              views: primaryViews,
              other_stats: { instagram: finalInstagramStats },
            },
          ])
          .select();
      } catch (error) {
        console.error(`Error fetching insights for reel ${reel.id}:`, error);
        // Re-throw the error so it can be properly handled by the calling function
        throw error;
      }
    });

    const batch = await Promise.all(submissionPromises);
    await bustLeaderboardCache(contestId);
    return batch;
  };

  /**
   * Handle single TikTok video submission via link
   */
  const handleSingleTiktokSubmission = async () => {
    if (!tiktokAccount) {
      throw new Error(
        "TikTok account not connected. Please connect your TikTok account in settings.",
      );
    }

    // Use tiktokVideoPreview or fall back to selectedTiktokVideo (from library)
    const videoToSubmit = tiktokVideoPreview || selectedTiktokVideo;

    if (!videoToSubmit) {
      throw new Error("No TikTok video selected for submission.");
    }

    setMessage("Preparing TikTok video submission...");

    const tiktokStats = {
      views: videoToSubmit.view_count || 0,
      likes: videoToSubmit.like_count || 0,
      comments: videoToSubmit.comment_count || 0,
      shares: videoToSubmit.share_count || 0,
    };

    const submissionPayload = {
      contest_id: contestId,
      creator_id: user!.id,
      status: "pending",
      platform: "tiktok",
      views: videoToSubmit.view_count || 0,
      content_link: videoToSubmit.share_url || tiktokVideoLink,
      video_id: videoToSubmit.id,
      video_title: videoToSubmit.title || "TikTok Video",
      video_thumbnail_url: videoToSubmit.cover_image_url || null,
      other_stats: { tiktok: tiktokStats },
    };

    const { error: submissionError } = await supabase
      .from("submissions")
      .insert([submissionPayload])
      .select();

    if (submissionError) {
      throw submissionError;
    }
    await bustLeaderboardCache(contestId);
  };

  /**
   * Handle multiple TikTok video submissions
   */
  const handleMultipleTiktokSubmission = async (tiktokVideos: any[]) => {
    if (!tiktokAccount) {
      throw new Error(
        "TikTok account not connected. Please connect your TikTok account in settings.",
      );
    }

    const totalSubmissions = tiktokVideos.length;
    const maxSubmissions = contest?.max_submissions_per_creator || 1;
    const currentSubmitted = submissionProgress.submitted;

    if (totalSubmissions === 0) {
      throw new Error("Please select at least one video to submit");
    }

    if (currentSubmitted + totalSubmissions > maxSubmissions) {
      throw new Error(
        `You have already submitted ${currentSubmitted} videos. You can only submit ${maxSubmissions - currentSubmitted
        } more.`,
      );
    }

    // Check for duplicates
    const duplicates: string[] = [];
    tiktokVideos.forEach((video) => {
      if (isVideoAlreadySubmitted(video.id, video.share_url || "")) {
        duplicates.push(video.title || "TikTok Video");
      }
    });

    if (duplicates.length > 0) {
      throw new Error(
        `The following videos have already been submitted: ${duplicates
          .slice(0, 3)
          .join(", ")}${duplicates.length > 3 ? "..." : ""}`,
      );
    }

    setMessage(`Submitting ${totalSubmissions} TikTok videos...`);

    const submissionPromises = tiktokVideos.map(async (video) => {
      try {
        const tiktokStats = {
          views: video.view_count || 0,
          likes: video.like_count || 0,
          comments: video.comment_count || 0,
          shares: video.share_count || 0,
        };

        return await supabase
          .from("submissions")
          .insert([
            {
              contest_id: contestId,
              creator_id: user!.id,
              status: "pending",
              platform: "tiktok",
              views: video.view_count || 0,
              content_link: video.share_url || "",
              video_id: video.id,
              video_title: video.title || "TikTok Video",
              video_thumbnail_url: video.cover_image_url || null,
              other_stats: { tiktok: tiktokStats },
            },
          ])
          .select();
      } catch (error) {
        console.error(`Error submitting TikTok video ${video.id}:`, error);
        throw error;
      }
    });

    const results = await Promise.all(submissionPromises);

    // Check for errors
    const errors = results.filter((result) => result?.error);
    if (errors.length > 0) {
      throw new Error(
        `Failed to submit ${errors.length} videos. Please try again.`,
      );
    }

    await bustLeaderboardCache(contestId);

    // Update state
    const newSubmittedCount = currentSubmitted + totalSubmissions;
    setSubmissionProgress((prev) => ({
      ...prev,
      submitted: newSubmittedCount,
    }));

    const newSubmittedVideos = new Set(submittedVideos);
    tiktokVideos.forEach((video) => {
      newSubmittedVideos.add(video.id);
      if (video.share_url) newSubmittedVideos.add(video.share_url);
    });
    setSubmittedVideos(newSubmittedVideos);

    // Clear selections
    setSelectedTiktokVideosFromTabs([]);
    setSelectedTiktokVideo(null);
    setTiktokVideoPreview(null);
    setTiktokVideoLink("");

    const remainingSubmissions = maxSubmissions - newSubmittedCount;

    if (newSubmittedCount >= maxSubmissions) {
      toast({
        title: "🎉 All Submissions Complete!",
        description: `You have successfully submitted all ${maxSubmissions} videos for this contest.`,
        duration: 4000,
      });
    } else {
      toast({
        title: "🎉 Videos Submitted Successfully!",
        description: `Submitted ${totalSubmissions} videos. You have ${remainingSubmissions} submissions remaining.`,
        duration: 4000,
      });
    }
  };

  /**
   * Main submission handler - routes to appropriate function
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (submissionTimingError) {
      toast({
        title: "Content Too Old",
        description: submissionTimingError,
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to submit content",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const isMultipleMode = contest?.multiple_submissions_enabled;
      const allYoutubeVideos = [...selectedVideosFromTabs, ...selectedVideos];
      const allInstagramReels = [...selectedReelsFromTabs, ...selectedReels];
      const allTiktokVideos = [
        ...selectedTiktokVideosFromTabs,
        ...selectedTiktokVideosFromLinks,
      ];

      // Determine which handler to call
      if (
        isMultipleMode &&
        (allYoutubeVideos.length > 0 || allInstagramReels.length > 0)
      ) {
        await handleMultipleSubmissions(allYoutubeVideos, allInstagramReels);
      } else if (isMultipleMode && allTiktokVideos.length > 0) {
        await handleMultipleTiktokSubmission(allTiktokVideos);
      } else if (
        contestPlatform === "youtube" &&
        (selectedVideo || videoPreview)
      ) {
        await handleSingleYoutubeSubmission();
      } else if (contestPlatform === "instagram" && selectedReel) {
        await handleSingleInstagramSubmission();
      } else if (
        contestPlatform === "tiktok" &&
        (tiktokVideoPreview || selectedTiktokVideo)
      ) {
        await handleSingleTiktokSubmission();
      } else {
        throw new Error("Please select content to submit.");
      }

      // Increment participation
      try {
        await fetch("/api/metrics/participation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contestId }),
        });
      } catch { }

      // Success - This toast will be overridden by the specific messages in handleMultipleSubmissions
      // For single submissions, show this message
      if (
        !isMultipleMode ||
        (allYoutubeVideos.length === 0 &&
          allInstagramReels.length === 0 &&
          allTiktokVideos.length === 0)
      ) {
        toast({
          title: "🎉 Content Submitted!",
          description:
            "Your submission has been received and is pending review",
          duration: 4000,
        });
      }

      router.push(
        `/dashboard/opportunities/${contestId}?success=content_submitted`,
      );
    } catch (err: any) {
      console.error("Error during submission:", err);
      toast({
        title: "❌ Submission Failed",
        description:
          err.message || "Failed to submit content. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
      setError(err.message || "Failed to submit content. Please try again.");
    } finally {
      setIsLoading(false);
      setMessage(null);
    }
  };

  /**
   * Handle multiple video submissions (both YouTube and Instagram)
   */
  const handleMultipleSubmissions = async (
    youtubeVideos: YouTubeVideo[],
    instagramReels: InstagramReel[],
  ) => {
    const totalSubmissions = youtubeVideos.length + instagramReels.length;
    const maxSubmissions = contest?.max_submissions_per_creator || 1;
    const currentSubmitted = submissionProgress.submitted;

    if (totalSubmissions === 0) {
      throw new Error("Please select at least one video to submit");
    }

    if (currentSubmitted + totalSubmissions > maxSubmissions) {
      throw new Error(
        `You have already submitted ${currentSubmitted} videos. You can only submit ${maxSubmissions - currentSubmitted
        } more.`,
      );
    }

    // Check for duplicates
    const duplicates: string[] = [];
    youtubeVideos.forEach((video) => {
      if (
        isVideoAlreadySubmitted(
          video.id.videoId,
          `https://www.youtube.com/watch?v=${video.id.videoId}`,
        )
      ) {
        duplicates.push(video.snippet.title);
      }
    });
    instagramReels.forEach((reel) => {
      if (isVideoAlreadySubmitted(reel.id, reel.permalink)) {
        duplicates.push(reel.caption || "Instagram Reel");
      }
    });

    if (duplicates.length > 0) {
      throw new Error(
        `The following videos have already been submitted: ${duplicates
          .slice(0, 3)
          .join(", ")}${duplicates.length > 3 ? "..." : ""}`,
      );
    }

    setMessage(`Submitting ${totalSubmissions} videos...`);

    const results = [];

    // Submit YouTube videos
    if (youtubeVideos.length > 0) {
      try {
        const youtubeResults =
          await handleMultipleYoutubeSubmission(youtubeVideos);
        results.push(...youtubeResults);
      } catch (youtubeError: any) {
        // Handle YouTube-specific errors
        throw new Error(
          youtubeError.message ||
          "Failed to submit YouTube content. Please try again.",
        );
      }
    }

    // Submit Instagram reels
    if (instagramReels.length > 0) {
      try {
        const instagramResults =
          await handleMultipleInstagramSubmission(instagramReels);
        results.push(...instagramResults);
      } catch (instagramError: any) {
        // Handle Instagram-specific errors (like account conversion errors)
        throw new Error(
          instagramError.message ||
          "Failed to submit Instagram content. Please try again.",
        );
      }
    }

    // Check for errors
    const errors = results.filter((result) => result?.error);
    if (errors.length > 0) {
      throw new Error(
        `Failed to submit ${errors.length} videos. Please try again.`,
      );
    }

    // Update state
    const newSubmittedCount = currentSubmitted + totalSubmissions;
    setSubmissionProgress((prev) => ({
      ...prev,
      submitted: newSubmittedCount,
    }));

    const newSubmittedVideos = new Set(submittedVideos);
    youtubeVideos.forEach((video) => {
      newSubmittedVideos.add(video.id.videoId);
      newSubmittedVideos.add(
        `https://www.youtube.com/watch?v=${video.id.videoId}`,
      );
    });
    instagramReels.forEach((reel) => {
      newSubmittedVideos.add(reel.id);
      newSubmittedVideos.add(reel.permalink);
    });
    setSubmittedVideos(newSubmittedVideos);

    // Clear selections
    setSelectedVideosFromTabs([]);
    setSelectedReelsFromTabs([]);
    setSelectedVideos([]);
    setSelectedReels([]);
    setSelectedVideoIndices([]);
    setSelectedReelIndices([]);

    const remainingSubmissions = maxSubmissions - newSubmittedCount;

    // Always show success message and redirect after submission
    if (newSubmittedCount >= maxSubmissions) {
      toast({
        title: "🎉 All Submissions Complete!",
        description: `You have successfully submitted all ${maxSubmissions} videos for this contest.`,
        duration: 4000,
      });
    } else {
      toast({
        title: "🎉 Videos Submitted Successfully!",
        description: `Submitted ${totalSubmissions} videos. You have ${remainingSubmissions} submissions remaining.`,
        duration: 4000,
      });
    }
  };

  const fetchInstagramReels = async (
    accessToken: string,
    igBusinessAccountID: string,
  ) => {
    if (
      contestPlatform !== "instagram" ||
      !accessToken ||
      !igBusinessAccountID
    ) {
      setError(
        "Instagram access token or Business Account ID not found for fetching reels.",
      );
      setIsLoadingReels(false); // Ensure loading is stopped
      return;
    }
    // setIsLoadingReels(true) should have been set by the calling context (e.g., fetchAndSetInstagramBusinessAccountID)
    // or if this function can be called independently, set it here.
    // For now, assume it's true from fetchAndSetInstagramBusinessAccountID.
    // If fetchAndSet... fails, it sets isLoadingReels to false.
    // If it succeeds, this function is called, and this function's finally block will set it to false.

    setError(null); // Clear previous errors specific to reel fetching
    setLibraryMessage(null); // Clear previous library message
    setUserReels([]);

    const performFetch = async () => {
      try {
        // Instagram /media returns ~25 items per page; paginate to fetch ALL reels (no archiving workaround needed)
        const fields =
          "id,media_type,media_product_type,video_title,caption,permalink,thumbnail_url,timestamp";
        let nextUrl: string | null =
          `https://graph.instagram.com/${igBusinessAccountID}/media?fields=${fields}&access_token=${accessToken}&limit=50`;
        const allMediaItems: any[] = [];

        while (nextUrl) {
          const mediaRes = await fetch(nextUrl);
          const mediaData: any = await mediaRes.json();

          if (!mediaRes.ok || mediaData.error) {
            console.error(
              "[fetchInstagramReels] API Error response:",
              mediaData.error,
            );

            if (
              mediaData.error?.type === "OAuthException" ||
              mediaData.error?.message?.includes("token") ||
              mediaData.error?.message?.includes("expired") ||
              mediaRes.status === 401
            ) {
              const refreshSuccess = await autoRefreshInstagramTokenAndRetry(
                async () => {
                  if (
                    instagramAccount?.access_token &&
                    instagramAccount?.app_scoped_user_id
                  ) {
                    await fetchInstagramReels(
                      instagramAccount.access_token,
                      instagramAccount.app_scoped_user_id,
                    );
                  }
                },
              );
              if (!refreshSuccess) {
                setIsInstagramTokenExpired(true);
                setError(
                  "Your Instagram connection has expired. Please re-connect your Instagram account.",
                );
              }
              return;
            }

            throw new Error(
              mediaData.error?.message ||
              "Failed to fetch Instagram media IDs using Business Account ID",
            );
          }

          const pageData = mediaData.data;
          if (pageData && pageData.length > 0) {
            allMediaItems.push(...pageData);
          }
          nextUrl = mediaData.paging?.next || null;
        }

        const potentialContent = allMediaItems;
        if (potentialContent.length === 0) {
          setUserReels([]);
          return;
        }

        const allFetchedReels: InstagramReel[] = [];
        for (const item of potentialContent) {
          // Prioritize media_product_type if available, otherwise check media_type.
          // Instagram API can be a bit varied here. If it's a VIDEO, we should include it.
          if (
            item.media_product_type === "REELS" ||
            item.media_type === "VIDEO"
          ) {
            // Create a reel object matching our InstagramReel interface
            allFetchedReels.push({
              id: item.id,
              media_type:
                item.media_product_type === "REELS" ? "REEL" : "VIDEO", // Be more specific based on product type if REELS
              media_url: item.permalink, // permalink is better for media_url in this context
              thumbnail_url: item.thumbnail_url,
              caption: item.caption || item.video_title, // Use caption, fallback to video_title if available
              timestamp: item.timestamp,
              permalink: item.permalink,
            });
          } else {
          }
        }

        // Client-side filter based on submission window
        const filteredReels = allFetchedReels.filter(
          (reel) => reel.timestamp && !isContentTooOld(reel.timestamp),
        );
        setUserReels(
          filteredReels.sort(
            (a, b) =>
              dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf(),
          ),
        );

        if (allFetchedReels.length > 0 && filteredReels.length === 0) {
          setLibraryMessage(
            `No Reels or Videos found on your Instagram account that were posted in the last ${SUBMISSION_WINDOW_UNIT_DISPLAY}. You can still fetch older content by pasting its link directly, but it must have been posted within the last ${SUBMISSION_WINDOW_UNIT_DISPLAY} to be eligible.`,
          );
        }
      } catch (err: any) {
        console.error("Error fetching Instagram Reels:", err);
        setError(err.message || "Failed to load your Instagram Reels.");
        if (
          err.message?.includes("token") ||
          err.message?.includes("OAuthException")
        ) {
          setIsInstagramTokenExpired(true);
        }
      } finally {
        setIsLoadingReels(false);
      }
    };

    await performFetch();
  };

  if (isLoadingContest) {
    return (
      <div className="flex flex-col items-center justify-center h-[76vh]">
        {/* <RefreshCw className="w-12 h-12 animate-spin text-primary mb-4" /> */}

        {/* <p className="text-lg text-muted-foreground">
          Loading contest details...
        </p>  */}
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }

  // Handle Twitter contests - they use join-campaign flow, not submission
  if (
    contestPlatform === "twitter" ||
    (contest?.contest_format === "text_image" &&
      contest?.platform === "twitter")
  ) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/dashboard/opportunities/${contestId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold ml-2">Twitter Campaign</h1>
        </div>
        <Alert className="mb-4">
          <AlertDescription>
            Twitter (X) campaigns work differently from video contests. Instead
            of submitting content manually, you need to join the campaign and
            your tweets will be automatically tracked.
          </AlertDescription>
        </Alert>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>How Twitter Campaigns Work</CardTitle>
            <CardDescription>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>Connect your Twitter (X) account in Settings</li>
                <li>Join the campaign from the opportunity page</li>
                <li>
                  Post tweets that match the campaign keywords and mentions or
                  campaign requirements
                </li>
                <li>Your tweets will be automatically tracked and scored</li>
              </ol>
            </CardDescription>
          </CardHeader>
        </Card>
        <Button
          onClick={() => router.push(`/dashboard/opportunities/${contestId}`)}
          className="w-full sm:w-auto"
        >
          Go to Campaign Page
        </Button>
      </div>
    );
  }

  if (!contestPlatform) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6 gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold ml-2">Submit Content</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            {error ||
              "This contest does not specify a platform (e.g., YouTube, Instagram, or TikTok) or the contest details could not be loaded. Please check the contest setup or go back."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 md:px-4 max-w-[1200px]">
      <div className="flex items-baseline gap-2 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/dashboard/opportunities/${contestId}`)}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold leading-none">
          Submit Content from{" "}
          {contestPlatform === "youtube"
            ? "YouTube"
            : contestPlatform === "instagram"
              ? "Instagram"
              : contestPlatform === "tiktok"
                ? "TikTok"
                : contestPlatform === "twitter"
                  ? "Twitter"
                  : contestPlatform}
        </h1>
      </div>

      <div
        className={cn(
          "max-w-[1200px] rounded-xl shadow-lg mx-auto p-2 md:p-4 overflow-hidden",
          isDark ? "bg-[#180438]" : "bg-white",
        )}
      >
        <CardContent className="overflow-x-hidden">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert variant="default" className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {/* Submit and Cancel Buttons - Moved to top */}
          <div className="flex flex-col gap-4 sm:flex-row items-center justify-between py-6 mb-6">
            <div>
              <CardTitle>Content Submission</CardTitle>
              <CardDescription>
                Submit your{" "}
                {contestPlatform === "youtube"
                  ? "YouTube video/short"
                  : contestPlatform === "instagram"
                    ? "Instagram Reel/video"
                    : contestPlatform === "tiktok"
                      ? "TikTok video"
                      : "content"}{" "}
                for this contest.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-row">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="w-full bg-[#C90808] text-white sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isLoading ||
                  isFetchingVideo ||
                  isFetchingInstagramMedia ||
                  isFetchingTiktokVideo ||
                  (contest?.multiple_submissions_enabled
                    ? selectedVideosFromTabs.length === 0 &&
                    selectedReelsFromTabs.length === 0 &&
                    selectedVideos.length === 0 &&
                    selectedReels.length === 0 &&
                    selectedTiktokVideosFromTabs.length === 0 &&
                    selectedTiktokVideosFromLinks.length === 0
                    : (contestPlatform === "youtube" &&
                      !selectedVideo &&
                      !videoPreview) ||
                    (contestPlatform === "instagram" &&
                      !selectedReel &&
                      !instagramMediaPreview) ||
                    (contestPlatform === "tiktok" &&
                      !tiktokVideoPreview &&
                      !selectedTiktokVideo))
                }
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                ) : null}
                Submit Content
              </Button>
            </div>
          </div>

          {/* YOUTUBE UI BLOCK */}
          {contestPlatform === "youtube" && (
            <>
              {isTokenExpired && (
                <Alert variant="destructive" className="mb-4 text-center">
                  <AlertDescription>
                    Your YouTube connection has expired.
                  </AlertDescription>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
                    <Button
                      onClick={handleRefreshYouTubeToken}
                      disabled={isRefreshingToken}
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      {isRefreshingToken ? (
                        <>
                          <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Token
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleReconnectYouTube}
                      variant="link"
                      className="text-destructive dark:text-red-400"
                    >
                      Reconnect Account
                    </Button>
                  </div>
                </Alert>
              )}
              {!youtubeAccount && !isTokenExpired && (
                <Alert
                  variant="default"
                  className="mb-4 text-center border border-[#7F39EC] bg-[#D9C0FF26]"
                >
                  <AlertDescription className="text-md">
                    Connect your YouTube account to submit content.
                  </AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1 text-[#7F39EC]">
                      Connect YouTube in Settings
                    </Button>
                  </Link>
                </Alert>
              )}

              {youtubeAccount && !isTokenExpired && (
                // <Tabs defaultValue="youtube-library" className="w-full">
                // <TabsList className="flex w-full p-1.5 bg-[#E4E4E4] rounded-full shadow-sm gap-2">
                //   <TabsTrigger
                //     value="youtube-library"
                //     className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm font-medium
                //       rounded-full transition-all duration-200
                //       data-[state=active]:bg-[#662EBD] data-[state=active]:text-white
                //       data-[state=active]:shadow-sm text-gray-700 hover:text-gray-800 hover:bg-gray-200"
                //   >
                //     <span className="hidden sm:inline">Your Videos & Shorts</span>
                //     <span className="sm:hidden">Library</span>
                //   </TabsTrigger>

                //   <TabsTrigger
                //     value="youtube-link"
                //     className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 text-sm font-medium
                //       rounded-full transition-all duration-200
                //       data-[state=active]:bg-[#662EBD] data-[state=active]:text-white
                //       data-[state=active]:shadow-sm text-gray-700 hover:text-gray-800 hover:bg-gray-200"
                //   >
                //     <span className="hidden sm:inline">Link</span>
                //     <span className="sm:hidden">Link</span>
                //   </TabsTrigger>
                // </TabsList>

                <Tabs defaultValue="youtube-library" className="w-full">
                  <TabsList
                    className={`flex w-full p-1.5 rounded-full shadow-sm ${isDark ? "bg-gray-700" : "bg-[#E4E4E4]"
                      }`}
                  >
                    {["youtube-library", "youtube-link"].map(
                      (tab, index, arr) => {
                        const isFirst = index === 0;
                        const isLast = index === arr.length - 1;

                        return (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className={`
                          flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-md font-medium 
                          transition-all duration-200
                          data-[state=active]:bg-[#662EBD] data-[state=active]:text-white 
                          data-[state=active]:shadow-sm
                          ${isDark
                                ? "text-gray-300 hover:text-white hover:bg-gray-600"
                                : "text-gray-700 hover:text-gray-800 hover:bg-gray-200"
                              }
                          ${isFirst ? "data-[state=active]:rounded-l-full" : ""}
                          ${isLast ? "data-[state=active]:rounded-r-full" : ""}
                          ${arr.length === 1
                                ? "data-[state=active]:rounded-full"
                                : ""
                              }
                        `}
                          >
                            {tab === "youtube-library" ? (
                              <>
                                <span className="hidden sm:inline">
                                  Your Videos & Shorts
                                </span>
                                <span className="sm:hidden">Library</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">Link</span>
                                <span className="sm:hidden">Link</span>
                              </>
                            )}
                          </TabsTrigger>
                        );
                      },
                    )}
                  </TabsList>

                  {/* Informational text for creators */}
                  <div className="mt-8 p-3 bg-[#D9C0FF26] border border-[#7F39EC] rounded-lg">
                    <p
                      className={cn(
                        "text-md text-center",
                        isDark ? "text-white" : "text-[#7F39EC]",
                      )}
                    >
                      💡 <strong>Tip for creators:</strong> You can fetch videos
                      from your YouTube account by entering their URL in the
                      "Link" tab.
                    </p>
                  </div>

                  <TabsContent value="youtube-library" className="mt-8">
                    {isLoadingVideos ? (
                      <div className="text-center py-4">
                        <PageLoadingSpinner mode="light" />
                        Loading YouTube videos...
                      </div>
                    ) : userVideos.length === 0 ? (
                      libraryMessage ? (
                        <Alert
                          variant="default"
                          className={cn(
                            "text-center border border-[#7F39EC] bg-[#D9C0FF26]",
                            isDark
                              ? "bg-[#C9A7FF26] border-[#C9A7FF] text-white"
                              : "bg-[#D9C0FF26] border-[#7F39EC] texxt-black",
                          )}
                        >
                          <AlertDescription>{libraryMessage}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="text-center py-4">
                          <p
                            className={cn(
                              "text-md",
                              isDark ? "text-white" : "text-black",
                            )}
                          >
                            No videos found in your YouTube channel.
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => fetchYouTubeVideos()}
                            className="mt-2 bg-[#4A00BE] text-white"
                            disabled={isLoadingVideos}
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${isLoadingVideos ? "animate-spin" : ""
                                }`}
                            />{" "}
                            Reload Videos
                          </Button>
                        </div>
                      )
                    ) : (
                      <>
                        {/* YouTube Pagination Controls */}
                        {totalYoutubePages > 1 && (
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg border space-y-2 sm:space-y-0">
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setYoutubeCurrentPage((prev) =>
                                  Math.max(1, prev - 1),
                                )
                              }
                              disabled={
                                youtubeCurrentPage === 1 || isLoadingVideos
                              }
                            >
                              ← Previous
                            </Button>
                            <span className="text-sm sm:text-base font-medium text-foreground bg-background px-3 sm:px-4 py-2 rounded-md border shadow-sm">
                              Page {youtubeCurrentPage} of{" "}
                              {totalYoutubePages > 0 ? totalYoutubePages : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setYoutubeCurrentPage((prev) =>
                                  Math.min(totalYoutubePages, prev + 1),
                                )
                              }
                              disabled={
                                youtubeCurrentPage === totalYoutubePages ||
                                totalYoutubePages === 0 ||
                                isLoadingVideos
                              }
                            >
                              Next →
                            </Button>
                          </div>
                        )}

                        {/* Multiple Submissions Counter - YouTube */}
                        {contest?.multiple_submissions_enabled &&
                          contestPlatform === "youtube" && (
                            <div
                              className={cn(
                                "mt-4 p-3 border rounded-lg",
                                isDark
                                  ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                                  : "bg-purple-50 border-purple-200",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCheck
                                    className={cn(
                                      "h-4 w-4",
                                      isDark
                                        ? "text-purple-400"
                                        : "text-purple-600",
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-purple-800",
                                    )}
                                  >
                                    Multiple Submissions Enabled
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark
                                      ? "text-gray-300"
                                      : "text-purple-800",
                                  )}
                                >
                                  Selected:{" "}
                                  {selectedVideosFromTabs.length +
                                    selectedReelsFromTabs.length +
                                    selectedVideos.length +
                                    selectedReels.length}{" "}
                                  /{" "}
                                  {Math.max(
                                    0,
                                    (contest.max_submissions_per_creator || 1) -
                                    submissionProgress.submitted,
                                  )}{" "}
                                  remaining videos
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-xs mt-1",
                                  isDark ? "text-gray-300" : "text-purple-600",
                                )}
                              >
                                Click on videos below to select them. You can
                                mix videos from your channel and custom links.
                              </p>
                            </div>
                          )}

                        <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 px-2 pb-4">
                          {paginatedUserVideos.map((video, index) => {
                            const isMultiSelect =
                              contest?.multiple_submissions_enabled;
                            const isSelected = isMultiSelect
                              ? selectedVideosFromTabs.some(
                                (v) => v.id.videoId === video.id.videoId,
                              )
                              : selectedVideo?.id.videoId === video.id.videoId;

                            const handleSelectionChange = (
                              shouldSelect: boolean,
                            ) => {
                              if (isMultiSelect) {
                                const isAlreadySelected =
                                  selectedVideosFromTabs.some(
                                    (v) => v.id.videoId === video.id.videoId,
                                  );

                                if (shouldSelect) {
                                  if (isAlreadySelected) {
                                    return;
                                  }

                                  if (
                                    isVideoAlreadySelected(
                                      video.id.videoId,
                                      "youtube",
                                    )
                                  ) {
                                    toast({
                                      title: "Video Already Selected",
                                      description:
                                        "This video is already selected from another source",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  if (
                                    isVideoAlreadySubmitted(
                                      video.id.videoId,
                                      `https://www.youtube.com/watch?v=${video.id.videoId}`,
                                    )
                                  ) {
                                    toast({
                                      title: "Video Already Submitted",
                                      description:
                                        "This video has already been submitted for this contest",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  const maxSubmissions =
                                    contest?.max_submissions_per_creator || 1;
                                  const remainingSubmissions =
                                    maxSubmissions -
                                    submissionProgress.submitted;
                                  const totalSelected =
                                    selectedVideosFromTabs.length +
                                    selectedReelsFromTabs.length +
                                    selectedVideos.length +
                                    selectedReels.length;

                                  if (totalSelected < remainingSubmissions) {
                                    setSelectedVideosFromTabs((prev) => [
                                      ...prev,
                                      video,
                                    ]);
                                  } else {
                                    toast({
                                      title: "Selection Limit Reached",
                                      description: `You can only select up to ${remainingSubmissions} more videos for this contest (${submissionProgress.submitted} already submitted)`,
                                      variant: "destructive",
                                    });
                                  }
                                } else if (isAlreadySelected) {
                                  setSelectedVideosFromTabs((prev) =>
                                    prev.filter(
                                      (v) => v.id.videoId !== video.id.videoId,
                                    ),
                                  );
                                }
                              } else {
                                if (shouldSelect) {
                                  setSelectedVideo(video);
                                  setSelectedReel(null);
                                  setInstagramMediaPreview(null);
                                  setInstagramLink("");
                                  setSubmissionType("youtube");
                                  setContentLink(
                                    `https://www.youtube.com/watch?v=${video.id.videoId}`,
                                  );
                                  setVideoPreview(null);
                                } else {
                                  setSelectedVideo(null);
                                  setContentLink("");
                                  setSubmissionType(null);
                                }
                              }
                            };

                            const thumbnailUrl =
                              getYouTubeThumbnailUrl(
                                video.snippet.thumbnails,
                                video.id.videoId,
                              ) ||
                              `https://i.ytimg.com/vi/${video.id.videoId}/hqdefault.jpg`;

                            return (
                              <div
                                key={video.id.videoId}
                                className={`cursor-pointer max-w-[1200px] mx-auto ${index === 0 ? "mt-4" : ""
                                  } ${index === paginatedUserVideos.length - 1
                                    ? "mb-4"
                                    : ""
                                  } ${isSelected
                                    ? "border-2 border-[#7F39EC] rounded-lg bg-purple-700/20"
                                    : "border-2 border-[#7F39EC] rounded-lg"
                                  }`}
                                onClick={() =>
                                  handleSelectionChange(!isSelected)
                                }
                              >
                                <CardContent className="p-4 sm:p-6 relative">
                                  <Checkbox
                                    aria-label="Select YouTube video"
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      handleSelectionChange(Boolean(checked))
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                      isDark
                                        ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                        : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                    )}
                                  />
                                  <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                    {/* Thumbnail */}
                                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                                      <Image
                                        src={thumbnailUrl}
                                        alt={video.snippet.title}
                                        width={160}
                                        height={90}
                                        className="rounded-lg object-cover aspect-video shadow-sm w-full max-w-[160px]"
                                      />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                                      {/* Title */}
                                      <div className="space-y-2">
                                        <h3
                                          className={cn(
                                            "font-medium text-lg leading-5 text-center sm:text-left line-clamp-2",
                                            isDark
                                              ? "text-white"
                                              : "text-gray-900",
                                          )}
                                          title={video.snippet.title}
                                        >
                                          {video.snippet.title}
                                        </h3>
                                        <div className="flex justify-center sm:justify-start">
                                          <a
                                            href={`https://www.youtube.com/watch?v=${video.id.videoId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                              "inline-flex items-center text-sm hover:underline",
                                              isDark
                                                ? "text-purple-400"
                                                : "text-[#4A00BE]",
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Open on YouTube
                                          </a>
                                        </div>
                                      </div>

                                      {/* Date */}
                                      <p
                                        className={cn(
                                          "text-md text-center sm:text-left",
                                          isDark
                                            ? "text-white"
                                            : "text-gray-600",
                                        )}
                                      >
                                        Published:{" "}
                                        {dayjs(
                                          video.snippet.publishedAt,
                                        ).format("MMM D, YYYY [at] h:mm A")}
                                      </p>

                                      {/* Statistics */}
                                      {video.statistics && (
                                        <div
                                          className={cn(
                                            "flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 text-md",
                                            isDark
                                              ? "text-white"
                                              : "text-gray-600",
                                          )}
                                        >
                                          {video.statistics.viewCount && (
                                            <div className="flex items-center gap-1">
                                              <Eye className="h-4 w-4" />
                                              <span className="font-medium">
                                                {parseInt(
                                                  video.statistics.viewCount.toString(),
                                                ).toLocaleString()}
                                              </span>
                                              <span>views</span>
                                            </div>
                                          )}
                                          {video.statistics.likeCount && (
                                            <div className="flex items-center gap-1">
                                              <ThumbsUp className="h-4 w-4" />
                                              <span className="font-medium">
                                                {parseInt(
                                                  video.statistics.likeCount.toString(),
                                                ).toLocaleString()}
                                              </span>
                                              <span>likes</span>
                                            </div>
                                          )}
                                          {video.statistics.commentCount && (
                                            <div className="flex items-center gap-1">
                                              <MessageSquare className="h-4 w-4" />
                                              <span className="font-medium">
                                                {" "}
                                                {parseInt(
                                                  video.statistics.commentCount.toString(),
                                                ).toLocaleString()}
                                              </span>
                                              <span className="ml-1">
                                                comments
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More button — only on last page, fetches next 50 from YouTube API */}
                        {youtubeNextPageToken &&
                          youtubeCurrentPage === totalYoutubePages && (
                            <div className="flex justify-center mt-4 pb-2">
                              <Button
                                variant="outline"
                                onClick={loadMoreYouTubeVideos}
                                disabled={isLoadingMoreVideos}
                                className={cn(
                                  "px-6 py-2 font-medium border-2",
                                  isDark
                                    ? "border-[#C9A7FF] text-[#C9A7FF] hover:bg-[#C9A7FF] hover:text-black"
                                    : "border-[#7F39EC] text-[#7F39EC] hover:bg-[#7F39EC] hover:text-white",
                                )}
                              >
                                {isLoadingMoreVideos ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Load More Videos
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="youtube-link" className="mt-6">
                    {!contest?.multiple_submissions_enabled && (
                      <div className="flex flex-col items-center sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 py-4 ">
                        <Input
                          type="text"
                          placeholder="Enter YouTube video URL"
                          value={contentLink}
                          onChange={(e) => setContentLink(e.target.value)}
                          className={cn(
                            "flex-1 text-base font-medium border",
                            isDark
                              ? "bg-[#180438] border border-gray-600"
                              : "bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200",
                          )}
                        />
                        <Button
                          onClick={handleFetchVideo}
                          disabled={isFetchingVideo || isLoadingVideos}
                          size="default"
                          className="px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
                        >
                          {isFetchingVideo ? (
                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                          ) : null}
                          Fetch Video
                        </Button>
                      </div>
                    )}
                    {videoPreview &&
                      (() => {
                        const isSelected =
                          selectedVideo?.id.videoId === videoPreview.id.videoId;

                        const handleSelectionChange = (
                          shouldSelect: boolean,
                        ) => {
                          if (shouldSelect) {
                            setSelectedVideo(videoPreview);
                            setSelectedReel(null);
                            setInstagramMediaPreview(null);
                            setInstagramLink("");
                            setSubmissionType("youtube");
                            setContentLink(
                              `https://www.youtube.com/watch?v=${videoPreview.id.videoId}`,
                            );
                          } else {
                            setSelectedVideo(null);
                            setContentLink("");
                            setSubmissionType(null);
                          }
                        };

                        const previewThumbnailUrl =
                          getYouTubeThumbnailUrl(
                            videoPreview.snippet.thumbnails,
                            videoPreview.id.videoId,
                          ) ||
                          `https://i.ytimg.com/vi/${videoPreview.id.videoId}/hqdefault.jpg`;

                        return (
                          <Card
                            className={`mt-6 cursor-pointer max-w-[1200px] mx-auto ${isSelected
                                ? "border-2 border-[#7F39EC] rounded-lg bg-[#D8C3FF75]"
                                : "border-2 border-[#7F39EC] rounded-lg "
                              }`}
                            onClick={() => handleSelectionChange(!isSelected)}
                          >
                            <div className="p-3 md:p-4">
                              <CardTitle className="text-base">
                                Video Preview
                              </CardTitle>
                            </div>
                            <CardContent className="p-3 sm:p-4 relative">
                              <Checkbox
                                aria-label="Select YouTube preview video"
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectionChange(Boolean(checked))
                                }
                                onClick={(event) => event.stopPropagation()}
                                className={cn(
                                  "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                  isDark
                                    ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                    : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                )}
                              />
                              <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0 mx-auto sm:mx-0">
                                  <Image
                                    src={previewThumbnailUrl}
                                    alt={videoPreview.snippet.title}
                                    width={160}
                                    height={90}
                                    className="rounded-lg object-cover aspect-video shadow-sm w-full max-w-[160px]"
                                  />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                                  {/* Title */}
                                  <div className="space-y-1">
                                    <h3
                                      className={cn(
                                        "font-medium text-lg leading-5 text-center sm:text-left line-clamp-2",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                      title={videoPreview.snippet.title}
                                    >
                                      {videoPreview.snippet.title}
                                    </h3>
                                    <div className="flex justify-center sm:justify-start">
                                      <a
                                        href={`https://www.youtube.com/watch?v=${videoPreview.id.videoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "inline-flex items-center text-sm hover:underline",
                                          isDark
                                            ? "text-purple-400"
                                            : "text-purple-600",
                                        )}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open on YouTube
                                      </a>
                                    </div>
                                  </div>

                                  {/* Date */}
                                  <p className="text-md text-muted-foreground text-center sm:text-left">
                                    Published:{" "}
                                    {dayjs(
                                      videoPreview.snippet.publishedAt,
                                    ).format("MMM D, YYYY [at] h:mm A")}
                                  </p>

                                  {/* Statistics */}
                                  {videoPreview.statistics && (
                                    <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 text-md text-muted-foreground">
                                      {videoPreview.statistics.viewCount && (
                                        <div className="flex items-center gap-1">
                                          <Eye className="h-4 w-4" />
                                          <span className="font-medium">
                                            {" "}
                                            {parseInt(
                                              videoPreview.statistics.viewCount.toString(),
                                            ).toLocaleString()}
                                          </span>
                                          <span>views</span>
                                        </div>
                                      )}
                                      {videoPreview.statistics.likeCount && (
                                        <div className="flex items-center gap-1">
                                          <ThumbsUp className="h-4 w-4" />
                                          <span className="font-medium">
                                            {parseInt(
                                              videoPreview.statistics.likeCount.toString(),
                                            ).toLocaleString()}
                                          </span>
                                          <span>likes</span>
                                        </div>
                                      )}
                                      {videoPreview.statistics.commentCount && (
                                        <div className="flex items-center gap-1">
                                          <MessageSquare className="h-4 w-4" />
                                          <span className="font-medium">
                                            {parseInt(
                                              videoPreview.statistics.commentCount.toString(),
                                            ).toLocaleString()}
                                          </span>
                                          <span>comments</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

          {/* INSTAGRAM UI BLOCK */}
          {contestPlatform === "instagram" && (
            <>
              {isInstagramTokenExpired && (
                <Alert variant="destructive" className="mb-4 text-center">
                  <AlertDescription>
                    Your Instagram connection has expired.
                  </AlertDescription>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
                    <Button
                      onClick={handleRefreshInstagramToken}
                      disabled={isRefreshingInstagramToken}
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      {isRefreshingInstagramToken ? (
                        <>
                          <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Token
                        </>
                      )}
                    </Button>
                    <Link href="/dashboard/settings">
                      <Button
                        variant="link"
                        className="text-destructive dark:text-red-400"
                      >
                        Reconnect Account
                      </Button>
                    </Link>
                  </div>
                </Alert>
              )}
              {!instagramAccount && !isInstagramTokenExpired && (
                <Alert
                  variant="default"
                  className="mb-4 border border-[#7F39EC] bg-[#D9C0FF26] text-center"
                >
                  <AlertDescription className="text-md">
                    Connect your Instagram account to submit content.
                  </AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1 text-[#7F39EC]">
                      Connect Instagram in Settings
                    </Button>
                  </Link>
                </Alert>
              )}

              {instagramAccount && !isInstagramTokenExpired && (
                // <Tabs defaultValue="instagram-library" className="w-full">
                //   <TabsList className="grid w-full grid-cols-2 h-12 sm:h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm">
                //     <TabsTrigger
                //       value="instagram-library"
                //       className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                //     >
                //       <span className="hidden sm:inline">Your Reels & Videos</span>
                //       <span className="sm:hidden">Library</span>
                //     </TabsTrigger>
                //     <TabsTrigger
                //       value="instagram-link"
                //       className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                //     >
                //       <span className="hidden sm:inline">Link</span>
                //       <span className="sm:hidden">Link</span>
                //     </TabsTrigger>
                //   </TabsList>
                <Tabs defaultValue="instagram-library" className="w-full">
                  <TabsList
                    className={`flex w-full p-1.5 rounded-full shadow-sm ${isDark ? "bg-black" : "bg-[#E4E4E4]"
                      }`}
                  >
                    {["instagram-library", "instagram-link"].map(
                      (tab, index, arr) => {
                        const isFirst = index === 0;
                        const isLast = index === arr.length - 1;

                        return (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className={`
                         flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-md font-medium transition-all duration-200 
                            data-[state=active]:bg-[#662EBD] data-[state=active]:text-white 
                            data-[state=active]:shadow-sm ${isDark
                                ? "text-gray-300 hover:text-white"
                                : "text-gray-700 hover:text-gray-800 hover:bg-gray-200"
                              }
                              ${isFirst
                                ? "data-[state=active]:rounded-l-full"
                                : ""
                              }
                               ${isLast
                                ? "data-[state=active]:rounded-r-full"
                                : ""
                              }
                             ${arr.length === 1
                                ? "data-[state=active]:rounded-full"
                                : ""
                              }
                             `}
                          >
                            {tab === "instagram-library" ? (
                              <>
                                <span className="hidden sm:inline">
                                  Your Reels & Videos
                                </span>
                                <span className="sm:hidden">Library</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">Link</span>
                                <span className="sm:hidden">Link</span>
                              </>
                            )}
                          </TabsTrigger>
                        );
                      },
                    )}
                  </TabsList>

                  {/* Informational text for creators */}
                  <div className="mt-6 p-3 bg-[#D9C0FF26] border border-[#7F39EC] rounded-lg">
                    <p
                      className={cn(
                        "text-md text-center",
                        isDark ? "text-white" : "text-[#7F39EC]",
                      )}
                    >
                      💡 <strong>Tip for creators:</strong> You can fetch reels
                      and videos from your Instagram account by entering their
                      URL in the "Link" tab.
                    </p>
                  </div>

                  <TabsContent value="instagram-library" className="mt-4">
                    {isLoadingReels ? (
                      <div className="text-center py-4">
                        <PageLoadingSpinner mode="light" />
                        Loading Instagram Reels...
                      </div>
                    ) : userReels.length === 0 ? (
                      libraryMessage ? (
                        <Alert variant="default" className="text-center">
                          <AlertDescription>{libraryMessage}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="text-center py-4">
                          <p>
                            No Reels or Videos found on your Instagram account.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-3 bg-[#4A00BE] text-white"
                            onClick={() =>
                              fetchInstagramReels(
                                instagramAccount.access_token,
                                currentInstagramBusinessAccountID || "",
                              )
                            }
                            disabled={isLoadingReels}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-2 ${isLoadingReels ? "animate-spin" : ""
                                }`}
                            />{" "}
                            Reload Reels
                          </Button>
                        </div>
                      )
                    ) : (
                      <>
                        {/* Instagram Pagination Controls */}
                        {totalInstagramPages > 1 && (
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg border space-y-2 sm:space-y-0">
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setInstagramCurrentPage((prev) =>
                                  Math.max(1, prev - 1),
                                )
                              }
                              disabled={
                                instagramCurrentPage === 1 || isLoadingReels
                              }
                            >
                              ← Previous
                            </Button>
                            <span className="text-sm sm:text-base font-medium text-foreground bg-background px-3 sm:px-4 py-2 rounded-md border shadow-sm">
                              Page {instagramCurrentPage} of{" "}
                              {totalInstagramPages > 0
                                ? totalInstagramPages
                                : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setInstagramCurrentPage((prev) =>
                                  Math.min(totalInstagramPages, prev + 1),
                                )
                              }
                              disabled={
                                instagramCurrentPage === totalInstagramPages ||
                                totalInstagramPages === 0 ||
                                isLoadingReels
                              }
                            >
                              Next →
                            </Button>
                          </div>
                        )}

                        {/* Multiple Submissions Counter - Instagram */}
                        {contest?.multiple_submissions_enabled &&
                          contestPlatform === "instagram" && (
                            <div
                              className={cn(
                                "mt-4 p-3 border rounded-lg",
                                isDark
                                  ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                                  : "bg-purple-50 border-purple-200",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCheck className="h-4 w-4 text-purple-600" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-purple-800",
                                    )}
                                  >
                                    Multiple Submissions Enabled
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark ? "text-white" : "text-purple-800",
                                  )}
                                >
                                  Selected:{" "}
                                  {selectedVideosFromTabs.length +
                                    selectedReelsFromTabs.length +
                                    selectedVideos.length +
                                    selectedReels.length}{" "}
                                  /{" "}
                                  {Math.max(
                                    0,
                                    (contest.max_submissions_per_creator || 1) -
                                    submissionProgress.submitted,
                                  )}{" "}
                                  remaining videos
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-xs mt-1",
                                  isDark ? "text-gray-300" : "text-purple-600",
                                )}
                              >
                                Click on videos below to select them. You can
                                mix videos from your channel and custom links.
                              </p>
                            </div>
                          )}

                        <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 px-2 pb-4">
                          {paginatedUserReels.map((reel, index) => {
                            const isMultiSelect =
                              contest?.multiple_submissions_enabled;
                            const isSelected = isMultiSelect
                              ? selectedReelsFromTabs.some(
                                (r) => r.id === reel.id,
                              )
                              : selectedReel?.id === reel.id;

                            const handleSelectionChange = (
                              shouldSelect: boolean,
                            ) => {
                              if (isMultiSelect) {
                                const isAlreadySelected =
                                  selectedReelsFromTabs.some(
                                    (r) => r.id === reel.id,
                                  );

                                if (shouldSelect) {
                                  if (isAlreadySelected) {
                                    return;
                                  }

                                  if (
                                    isVideoAlreadySelected(reel.id, "instagram")
                                  ) {
                                    toast({
                                      title: "Video Already Selected",
                                      description:
                                        "This video is already selected from another source",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  if (
                                    isVideoAlreadySubmitted(
                                      reel.id,
                                      reel.permalink,
                                    )
                                  ) {
                                    toast({
                                      title: "Reel Already Submitted",
                                      description:
                                        "This reel has already been submitted for this contest",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  const maxSubmissions =
                                    contest?.max_submissions_per_creator || 1;
                                  const remainingSubmissions =
                                    maxSubmissions -
                                    submissionProgress.submitted;
                                  const totalSelected =
                                    selectedVideosFromTabs.length +
                                    selectedReelsFromTabs.length +
                                    selectedVideos.length +
                                    selectedReels.length;

                                  if (totalSelected < remainingSubmissions) {
                                    setSelectedReelsFromTabs((prev) => [
                                      ...prev,
                                      reel,
                                    ]);
                                  } else {
                                    toast({
                                      title: "Selection Limit Reached",
                                      description: `You can only select up to ${remainingSubmissions} more videos for this contest (${submissionProgress.submitted} already submitted)`,
                                      variant: "destructive",
                                    });
                                  }
                                } else if (isAlreadySelected) {
                                  setSelectedReelsFromTabs((prev) =>
                                    prev.filter((r) => r.id !== reel.id),
                                  );
                                }
                              } else {
                                if (shouldSelect) {
                                  setSelectedReel(reel);
                                  setSelectedVideo(null);
                                  setVideoPreview(null);
                                  setContentLink("");
                                  setSubmissionType("instagram");
                                  setInstagramLink(reel.permalink);
                                  setInstagramMediaPreview(null);
                                } else {
                                  setSelectedReel(null);
                                  setContentLink("");
                                  setSubmissionType(null);
                                }
                              }
                            };

                            return (
                              <div
                                key={reel.id}
                                className={`cursor-pointer max-w-[1200px] mt-6 mx-auto ${index === 0 ? "mt-4" : ""
                                  } ${index === paginatedUserReels.length - 1
                                    ? "mb-4"
                                    : ""
                                  } ${isSelected
                                    ? "border-2 border-[#7F39EC] rounded-lg bg-[#D8C3FF75]"
                                    : "border-2 border-[#7F39EC] rounded-lg "
                                  }`}
                                onClick={() =>
                                  handleSelectionChange(!isSelected)
                                }
                              >
                                <CardContent className="p-4 sm:p-6 relative">
                                  <Checkbox
                                    aria-label="Select Instagram reel"
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      handleSelectionChange(Boolean(checked))
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                      isDark
                                        ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                        : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                    )}
                                  />
                                  <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                    {/* Thumbnail */}
                                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                                      {reel.thumbnail_url ? (
                                        <Image
                                          src={reel.thumbnail_url}
                                          alt={
                                            reel.caption || "Instagram media"
                                          }
                                          width={120}
                                          height={120}
                                          className="rounded-lg object-cover aspect-square shadow-sm w-full max-w-[120px]"
                                        />
                                      ) : (
                                        <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground border">
                                          📷 No thumbnail
                                        </div>
                                      )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-4">
                                      {/* Caption/Title */}
                                      <div className="space-y-1">
                                        <h3
                                          className="font-medium text-md leading-5 text-center sm:text-left line-clamp-3"
                                          title={
                                            reel.caption || "Instagram media"
                                          }
                                        >
                                          {reel.caption ||
                                            "No caption available"}
                                        </h3>
                                        <div className="flex justify-center sm:justify-start">
                                          <a
                                            href={reel.permalink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Open on Instagram
                                          </a>
                                        </div>
                                      </div>

                                      {/* Date and Type */}
                                      <div className="space-y-3">
                                        <p className="text-sm text-muted-foreground text-center sm:text-left">
                                          Posted:{" "}
                                          {dayjs(reel.timestamp).format(
                                            "MMM D, YYYY [at] h:mm A",
                                          )}
                                        </p>
                                        <div className="flex justify-center sm:justify-start">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium border border-gray-500">
                                            🎬{" "}
                                            {reel.media_type === "REEL"
                                              ? "Instagram Reel"
                                              : "Video"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="instagram-link" className="mt-4">
                    {!contest?.multiple_submissions_enabled && (
                      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 p-4">
                        <Input
                          type="text"
                          placeholder="Enter Instagram media URL"
                          value={instagramLink}
                          onChange={(e) => setInstagramLink(e.target.value)}
                          className={cn(
                            "flex-1 text-base font-medium border",
                            isDark
                              ? "bg-[#180438] border border-gray-600"
                              : "bg-white",
                          )}
                        />
                        <Button
                          onClick={handleFetchInstagramByLink}
                          disabled={isFetchingInstagramMedia || isLoadingReels}
                          size="default"
                          className="px-4 sm:px-6 py-2 font-medium text-sm sm:text-base shadow-sm w-full sm:w-auto"
                        >
                          {isFetchingInstagramMedia ? (
                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                          ) : null}
                          Fetch Media
                        </Button>
                      </div>
                    )}
                    {instagramMediaPreview &&
                      (() => {
                        const isSelected =
                          selectedReel?.id === instagramMediaPreview.id;

                        const handleSelectionChange = (
                          shouldSelect: boolean,
                        ) => {
                          if (shouldSelect) {
                            setSelectedReel(instagramMediaPreview);
                            setSelectedVideo(null);
                            setVideoPreview(null);
                            setContentLink("");
                            setSubmissionType("instagram");
                            setInstagramLink(instagramMediaPreview.permalink);
                          } else {
                            setSelectedReel(null);
                            setContentLink("");
                            setSubmissionType(null);
                          }
                        };

                        return (
                          <div
                            className={`mt-6 cursor-pointer max-w-[1200px] mx-auto ${isSelected
                                ? "border-2 border-[#7F39EC] rounded-lg bg-[#D8C3FF75]"
                                : "border-2 border-[#7F39EC] rounded-lg "
                              }`}
                            onClick={() => handleSelectionChange(!isSelected)}
                          >
                            <CardHeader>
                              <CardTitle className="text-base">
                                Media Preview
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="relative">
                              <Checkbox
                                aria-label="Select Instagram preview media"
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectionChange(Boolean(checked))
                                }
                                onClick={(event) => event.stopPropagation()}
                                className={cn(
                                  "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                  isDark
                                    ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                    : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                )}
                              />
                              <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0 mx-auto sm:mx-0">
                                  {instagramMediaPreview.thumbnail_url ? (
                                    <Image
                                      src={instagramMediaPreview.thumbnail_url}
                                      alt={
                                        instagramMediaPreview.caption ||
                                        "Instagram media"
                                      }
                                      width={120}
                                      height={120}
                                      className="rounded-lg object-cover aspect-square shadow-sm w-full max-w-[120px]"
                                    />
                                  ) : (
                                    <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground border">
                                      📷 No thumbnail
                                    </div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-2 sm:space-y-4">
                                  {/* Caption/Title */}
                                  <div className="space-y-1">
                                    <h3
                                      className="font-medium text-md leading-5 text-center sm:text-left line-clamp-3"
                                      title={
                                        instagramMediaPreview.caption ||
                                        "Instagram media"
                                      }
                                    >
                                      {instagramMediaPreview.caption ||
                                        "No caption available"}
                                    </h3>
                                    <div className="flex justify-center sm:justify-start">
                                      <a
                                        href={instagramMediaPreview.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open on Instagram
                                      </a>
                                    </div>
                                  </div>

                                  {/* Date and Type */}
                                  <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                                      Posted:{" "}
                                      {dayjs(
                                        instagramMediaPreview.timestamp,
                                      ).format("MMM D, YYYY [at] h:mm A")}
                                    </p>
                                    <div className="flex justify-center sm:justify-start">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium border border-gray-500">
                                        🎬{" "}
                                        {instagramMediaPreview.media_type ===
                                          "REEL"
                                          ? "Instagram Reel"
                                          : "Video"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </div>
                        );
                      })()}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

          {/* TIKTOK UI BLOCK */}
          {contestPlatform === "tiktok" && (
            <>
              {isTiktokTokenExpired && (
                <Alert variant="destructive" className="mb-4 text-center">
                  <AlertDescription>
                    Your TikTok connection has expired.
                  </AlertDescription>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
                    <Link href="/dashboard/settings">
                      <Button
                        variant="link"
                        className="text-destructive dark:text-red-400"
                      >
                        Reconnect Account
                      </Button>
                    </Link>
                  </div>
                </Alert>
              )}
              {!tiktokAccount && !isTiktokTokenExpired && (
                <Alert
                  variant="default"
                  className="mb-4 border border-[#7F39EC] bg-[#D9C0FF26] text-center"
                >
                  <AlertDescription className="text-md">
                    Connect your TikTok account to submit content.
                  </AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1 text-[#7F39EC]">
                      Connect TikTok in Settings
                    </Button>
                  </Link>
                </Alert>
              )}

              {tiktokAccount && !isTiktokTokenExpired && (
                <Tabs defaultValue="tiktok-library" className="w-full">
                  <TabsList
                    className={`flex w-full p-1.5 rounded-full shadow-sm ${isDark ? "bg-black" : "bg-[#E4E4E4]"
                      }`}
                  >
                    {["tiktok-library", "tiktok-link"].map(
                      (tab, index, arr) => {
                        const isFirst = index === 0;
                        const isLast = index === arr.length - 1;

                        return (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className={`
                         flex items-center justify-center px-4 sm:px-6 py-2 sm:py-3 text-md font-medium transition-all duration-200 
                            data-[state=active]:bg-[#662EBD] data-[state=active]:text-white 
                            data-[state=active]:shadow-sm ${isDark
                                ? "text-gray-300 hover:text-white"
                                : "text-gray-700 hover:text-gray-800 hover:bg-gray-200"
                              }
                              ${isFirst
                                ? "data-[state=active]:rounded-l-full"
                                : ""
                              }
                               ${isLast
                                ? "data-[state=active]:rounded-r-full"
                                : ""
                              }
                             ${arr.length === 1
                                ? "data-[state=active]:rounded-full"
                                : ""
                              }
                             `}
                          >
                            {tab === "tiktok-library" ? (
                              <>
                                <span className="hidden sm:inline">
                                  Your Videos
                                </span>
                                <span className="sm:hidden">Library</span>
                              </>
                            ) : (
                              <>
                                <span className="hidden sm:inline">Link</span>
                                <span className="sm:hidden">Link</span>
                              </>
                            )}
                          </TabsTrigger>
                        );
                      },
                    )}
                  </TabsList>

                  {/* Informational text for creators */}
                  <div className="mt-6 p-3 bg-[#D9C0FF26] border border-[#7F39EC] rounded-lg">
                    <p
                      className={cn(
                        "text-md text-center",
                        isDark ? "text-white" : "text-[#7F39EC]",
                      )}
                    >
                      💡 <strong>Tip for creators:</strong> You can fetch videos
                      from your TikTok account by entering their URL in the
                      &quot;Link&quot; tab.
                    </p>
                  </div>

                  <TabsContent value="tiktok-library" className="mt-4">
                    {isLoadingTiktokVideos ? (
                      <div className="text-center py-4">
                        <PageLoadingSpinner mode="light" />
                        Loading TikTok videos...
                      </div>
                    ) : userTiktokVideos.length === 0 ? (
                      tiktokLibraryMessage ? (
                        <Alert variant="default" className="text-center">
                          <AlertDescription>
                            {tiktokLibraryMessage}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="text-center py-4">
                          <p
                            className={cn(
                              "text-md",
                              isDark ? "text-white" : "text-black",
                            )}
                          >
                            No videos found on your TikTok account.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-3 bg-[#4A00BE] text-white"
                            onClick={() => fetchTikTokVideos()}
                            disabled={isLoadingTiktokVideos}
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-2 ${isLoadingTiktokVideos ? "animate-spin" : ""
                                }`}
                            />{" "}
                            Reload Videos
                          </Button>
                        </div>
                      )
                    ) : (
                      <>
                        {/* TikTok Pagination Controls */}
                        {totalTiktokPages > 1 && (
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-3 sm:p-4 bg-muted/30 rounded-lg border space-y-2 sm:space-y-0">
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setTiktokCurrentPage((prev) =>
                                  Math.max(1, prev - 1),
                                )
                              }
                              disabled={
                                tiktokCurrentPage === 1 || isLoadingTiktokVideos
                              }
                            >
                              ← Previous
                            </Button>
                            <span className="text-sm sm:text-base font-medium text-foreground bg-background px-3 sm:px-4 py-2 rounded-md border shadow-sm">
                              Page {tiktokCurrentPage} of{" "}
                              {totalTiktokPages > 0 ? totalTiktokPages : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() =>
                                setTiktokCurrentPage((prev) =>
                                  Math.min(totalTiktokPages, prev + 1),
                                )
                              }
                              disabled={
                                tiktokCurrentPage === totalTiktokPages ||
                                totalTiktokPages === 0 ||
                                isLoadingTiktokVideos
                              }
                            >
                              Next →
                            </Button>
                          </div>
                        )}

                        {/* Multiple Submissions Counter - TikTok */}
                        {contest?.multiple_submissions_enabled &&
                          contestPlatform === "tiktok" && (
                            <div
                              className={cn(
                                "mt-4 p-3 border rounded-lg",
                                isDark
                                  ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                                  : "bg-purple-50 border-purple-200",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCheck className="h-4 w-4 text-purple-600" />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      isDark ? "text-white" : "text-purple-800",
                                    )}
                                  >
                                    Multiple Submissions Enabled
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-sm font-semibold",
                                    isDark ? "text-white" : "text-purple-800",
                                  )}
                                >
                                  Selected:{" "}
                                  {selectedTiktokVideosFromTabs.length} /{" "}
                                  {Math.max(
                                    0,
                                    (contest.max_submissions_per_creator || 1) -
                                    submissionProgress.submitted,
                                  )}{" "}
                                  remaining videos
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-xs mt-1",
                                  isDark ? "text-gray-300" : "text-purple-600",
                                )}
                              >
                                Click on videos below to select them. You can
                                mix videos from your library and custom links.
                              </p>
                            </div>
                          )}

                        <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 px-2 pb-4">
                          {paginatedTiktokVideos.map((video, index) => {
                            const isMultiSelect =
                              contest?.multiple_submissions_enabled;
                            const isSelected = isMultiSelect
                              ? selectedTiktokVideosFromTabs.some(
                                (v: any) => v.id === video.id,
                              )
                              : selectedTiktokVideo?.id === video.id;

                            const handleTiktokSelectionChange = (
                              shouldSelect: boolean,
                            ) => {
                              if (isMultiSelect) {
                                const isAlreadySelected =
                                  selectedTiktokVideosFromTabs.some(
                                    (v: any) => v.id === video.id,
                                  );

                                if (shouldSelect) {
                                  if (isAlreadySelected) return;

                                  if (
                                    isVideoAlreadySubmitted(
                                      video.id,
                                      video.share_url || "",
                                    )
                                  ) {
                                    toast({
                                      title: "Video Already Submitted",
                                      description:
                                        "This video has already been submitted for this contest",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  const maxSubmissions =
                                    contest?.max_submissions_per_creator || 1;
                                  const remainingSubmissions =
                                    maxSubmissions -
                                    submissionProgress.submitted;
                                  const totalSelected =
                                    selectedTiktokVideosFromTabs.length;

                                  if (totalSelected < remainingSubmissions) {
                                    setSelectedTiktokVideosFromTabs((prev) => [
                                      ...prev,
                                      video,
                                    ]);
                                  } else {
                                    toast({
                                      title: "Selection Limit Reached",
                                      description: `You can only select up to ${remainingSubmissions} more videos for this contest (${submissionProgress.submitted} already submitted)`,
                                      variant: "destructive",
                                    });
                                  }
                                } else if (isAlreadySelected) {
                                  setSelectedTiktokVideosFromTabs((prev) =>
                                    prev.filter((v: any) => v.id !== video.id),
                                  );
                                }
                              } else {
                                if (shouldSelect) {
                                  setSelectedTiktokVideo(video);
                                  setTiktokVideoPreview(video);
                                  setTiktokVideoLink(video.share_url || "");
                                } else {
                                  setSelectedTiktokVideo(null);
                                  setTiktokVideoPreview(null);
                                  setTiktokVideoLink("");
                                }
                              }
                            };

                            const publishedDate = video.create_time
                              ? dayjs(
                                new Date(video.create_time * 1000),
                              ).format("MMM D, YYYY [at] h:mm A")
                              : null;

                            return (
                              <div
                                key={video.id}
                                className={`cursor-pointer max-w-[1200px] mt-6 mx-auto ${index === 0 ? "mt-4" : ""
                                  } ${index === paginatedTiktokVideos.length - 1
                                    ? "mb-4"
                                    : ""
                                  } ${isSelected
                                    ? "border-2 border-[#7F39EC] rounded-lg bg-[#D8C3FF75]"
                                    : "border-2 border-[#7F39EC] rounded-lg "
                                  }`}
                                onClick={() =>
                                  handleTiktokSelectionChange(!isSelected)
                                }
                              >
                                <CardContent className="p-4 sm:p-6 relative">
                                  <Checkbox
                                    aria-label="Select TikTok video"
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                      handleTiktokSelectionChange(
                                        Boolean(checked),
                                      )
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                      isDark
                                        ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                        : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                    )}
                                  />
                                  <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                    {/* Thumbnail */}
                                    <div className="flex-shrink-0 mx-auto sm:mx-0">
                                      {video.cover_image_url ? (
                                        <img
                                          src={video.cover_image_url}
                                          alt={video.title || "TikTok video"}
                                          width={120}
                                          height={120}
                                          className="rounded-lg object-cover aspect-square shadow-sm w-full max-w-[120px]"
                                        />
                                      ) : (
                                        <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground border">
                                          🎬 No thumbnail
                                        </div>
                                      )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-4">
                                      {/* Title */}
                                      <div className="space-y-1">
                                        <h3
                                          className="font-medium text-md leading-5 text-center sm:text-left line-clamp-3"
                                          title={video.title || "TikTok video"}
                                        >
                                          {video.title ||
                                            video.video_description ||
                                            "No title available"}
                                        </h3>
                                        <div className="flex justify-center sm:justify-start">
                                          <a
                                            href={video.share_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Open on TikTok
                                          </a>
                                        </div>
                                      </div>

                                      {/* Date, Type, and Metrics */}
                                      <div className="space-y-3">
                                        {publishedDate && (
                                          <p className="text-sm text-muted-foreground text-center sm:text-left">
                                            Posted: {publishedDate}
                                          </p>
                                        )}
                                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                          <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium border border-gray-500">
                                            🎬 TikTok Video
                                          </span>
                                          <div
                                            className={cn(
                                              "flex items-center gap-3 text-xs",
                                              isDark
                                                ? "text-gray-300"
                                                : "text-gray-600",
                                            )}
                                          >
                                            <div className="flex items-center gap-1">
                                              <Eye className="h-3 w-3" />
                                              <span>
                                                {(
                                                  video.view_count || 0
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <ThumbsUp className="h-3 w-3" />
                                              <span>
                                                {(
                                                  video.like_count || 0
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <MessageSquare className="h-3 w-3" />
                                              <span>
                                                {(
                                                  video.comment_count || 0
                                                ).toLocaleString()}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </div>
                            );
                          })}
                        </div>

                        {/* Load More button */}
                        {tiktokNextCursor &&
                          tiktokCurrentPage === totalTiktokPages && (
                            <div className="flex justify-center mt-4 pb-2">
                              <Button
                                variant="outline"
                                onClick={loadMoreTiktokVideos}
                                disabled={isLoadingMoreTiktokVideos}
                                className={cn(
                                  "px-6 py-2 font-medium border-2",
                                  isDark
                                    ? "border-[#C9A7FF] text-[#C9A7FF] hover:bg-[#C9A7FF] hover:text-black"
                                    : "border-[#7F39EC] text-[#7F39EC] hover:bg-[#7F39EC] hover:text-white",
                                )}
                              >
                                {isLoadingMoreTiktokVideos ? (
                                  <>
                                    <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                                    Loading...
                                  </>
                                ) : (
                                  "Load More Videos"
                                )}
                              </Button>
                            </div>
                          )}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="tiktok-link" className="mt-4">
                    {!contest?.multiple_submissions_enabled && (
                      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 p-4">
                        <Input
                          type="text"
                          placeholder="Enter TikTok video URL (e.g., https://www.tiktok.com/@username/video/1234567890)"
                          value={tiktokVideoLink}
                          onChange={(e) => setTiktokVideoLink(e.target.value)}
                          className={cn(
                            "flex-1 text-base font-medium border",
                            isDark
                              ? "bg-[#180438] border border-gray-600"
                              : "bg-white",
                          )}
                        />
                        <Button
                          onClick={async () => {
                            if (!tiktokVideoLink.trim()) {
                              toast({
                                title: "Error",
                                description:
                                  "Please paste a TikTok video link.",
                                variant: "destructive",
                              });
                              return;
                            }

                            // Basic TikTok URL validation
                            const tiktokUrlPattern =
                              /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
                            const vmPattern = /vm\.tiktok\.com\/[\w]+/i;
                            if (
                              !tiktokUrlPattern.test(tiktokVideoLink) &&
                              !vmPattern.test(tiktokVideoLink)
                            ) {
                              toast({
                                title: "Invalid URL",
                                description:
                                  "Please enter a valid TikTok video URL (e.g., https://www.tiktok.com/@username/video/1234567890)",
                                variant: "destructive",
                              });
                              return;
                            }

                            setIsFetchingTiktokVideo(true);
                            setError(null);

                            try {
                              const match =
                                tiktokVideoLink.match(/video\/(\d+)/);
                              const videoId = match ? match[1] : null;

                              if (!videoId) {
                                throw new Error(
                                  "Could not extract video ID from the URL. Please ensure it's a direct TikTok video link.",
                                );
                              }

                              if (submittedVideos.has(videoId)) {
                                toast({
                                  title: "Already Submitted",
                                  description:
                                    "This TikTok video has already been submitted to this contest.",
                                  variant: "destructive",
                                });
                                setIsFetchingTiktokVideo(false);
                                return;
                              }

                              // Validate ownership: extract @username from URL and compare with connected account
                              const usernameMatch = tiktokVideoLink.match(
                                /tiktok\.com\/@([\w.-]+)\//i,
                              );
                              const urlUsername = usernameMatch
                                ? usernameMatch[1].toLowerCase()
                                : null;
                              const connectedUsername =
                                tiktokAccount?.username?.toLowerCase();

                              if (
                                urlUsername &&
                                connectedUsername &&
                                urlUsername !== connectedUsername
                              ) {
                                toast({
                                  title: "Not Your Content",
                                  description: `This video belongs to @${usernameMatch![1]}, not your connected TikTok account (@${tiktokAccount.username}). You can only submit your own content.`,
                                  variant: "destructive",
                                });
                                setError(
                                  `This video belongs to @${usernameMatch![1]}, not your connected TikTok account (@${tiktokAccount.username}). You can only submit your own content.`,
                                );
                                setIsFetchingTiktokVideo(false);
                                return;
                              }

                              const response = await fetch(
                                `/api/auth/tiktok/video-info?video_id=${videoId}`,
                                {
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                },
                              );

                              if (response.ok) {
                                const data = await response.json();
                                setTiktokVideoPreview(
                                  data.video || {
                                    id: videoId,
                                    share_url: tiktokVideoLink,
                                    title: "TikTok Video",
                                    view_count: 0,
                                    like_count: 0,
                                    comment_count: 0,
                                    share_count: 0,
                                  },
                                );
                              } else {
                                // API failed – video likely doesn't belong to user
                                const errorData = await response
                                  .json()
                                  .catch(() => ({}));
                                if (response.status === 404) {
                                  toast({
                                    title: "Not Your Content",
                                    description:
                                      "This video was not found in your connected TikTok account. You can only submit your own TikTok videos.",
                                    variant: "destructive",
                                  });
                                  setError(
                                    "This video was not found in your connected TikTok account. You can only submit your own TikTok videos.",
                                  );
                                  setIsFetchingTiktokVideo(false);
                                  return;
                                }
                                throw new Error(
                                  errorData?.error ||
                                  "Failed to verify TikTok video.",
                                );
                              }

                              toast({
                                title: "Video Loaded",
                                description:
                                  "TikTok video is ready for submission.",
                                variant: "default",
                              });
                            } catch (err: any) {
                              console.error(
                                "Error fetching TikTok video:",
                                err,
                              );
                              setError(
                                err.message || "Failed to load TikTok video.",
                              );
                            } finally {
                              setIsFetchingTiktokVideo(false);
                            }
                          }}
                          disabled={
                            isFetchingTiktokVideo || !tiktokVideoLink.trim()
                          }
                          size="default"
                          className="px-4 sm:px-6 py-2 font-medium text-sm sm:text-base shadow-sm w-full sm:w-auto"
                        >
                          {isFetchingTiktokVideo ? (
                            <RefreshCw className="animate-spin mr-2 h-4 w-4" />
                          ) : null}
                          Fetch Video
                        </Button>
                      </div>
                    )}
                    {tiktokVideoPreview &&
                      (() => {
                        const isSelected =
                          selectedTiktokVideo?.id === tiktokVideoPreview.id ||
                          tiktokVideoPreview !== null;

                        const handleSelectionChange = (
                          shouldSelect: boolean,
                        ) => {
                          if (shouldSelect) {
                            setSelectedTiktokVideo(tiktokVideoPreview);
                          } else {
                            setSelectedTiktokVideo(null);
                            setTiktokVideoPreview(null);
                            setTiktokVideoLink("");
                          }
                        };

                        return (
                          <div
                            className={`mt-6 cursor-pointer max-w-[1200px] mx-auto ${isSelected
                                ? "border-2 border-[#7F39EC] rounded-lg bg-[#D8C3FF75]"
                                : "border-2 border-[#7F39EC] rounded-lg "
                              }`}
                            onClick={() => handleSelectionChange(!isSelected)}
                          >
                            <CardHeader>
                              <CardTitle className="text-base">
                                Video Preview
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="relative">
                              <Checkbox
                                aria-label="Select TikTok preview video"
                                checked={isSelected}
                                onCheckedChange={(checked) =>
                                  handleSelectionChange(Boolean(checked))
                                }
                                onClick={(event) => event.stopPropagation()}
                                className={cn(
                                  "absolute top-3 right-3 h-5 w-5 border-2 shadow-sm",
                                  isDark
                                    ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                    : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                )}
                              />
                              <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                {/* Thumbnail */}
                                <div className="flex-shrink-0 mx-auto sm:mx-0">
                                  {tiktokVideoPreview.cover_image_url ? (
                                    <img
                                      src={tiktokVideoPreview.cover_image_url}
                                      alt={
                                        tiktokVideoPreview.title ||
                                        "TikTok video"
                                      }
                                      width={120}
                                      height={120}
                                      className="rounded-lg object-cover aspect-square shadow-sm w-full max-w-[120px]"
                                    />
                                  ) : (
                                    <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground border">
                                      🎬 No thumbnail
                                    </div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 space-y-2 sm:space-y-4">
                                  {/* Title */}
                                  <div className="space-y-1">
                                    <h3
                                      className="font-medium text-md leading-5 text-center sm:text-left line-clamp-3"
                                      title={
                                        tiktokVideoPreview.title ||
                                        "TikTok video"
                                      }
                                    >
                                      {tiktokVideoPreview.title ||
                                        tiktokVideoPreview.video_description ||
                                        "No title available"}
                                    </h3>
                                    <div className="flex justify-center sm:justify-start">
                                      <a
                                        href={
                                          tiktokVideoPreview.share_url ||
                                          tiktokVideoLink
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center text-sm text-purple-600 hover:text-purple-800 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open on TikTok
                                      </a>
                                    </div>
                                  </div>

                                  {/* Metrics */}
                                  <div className="space-y-2">
                                    {tiktokVideoPreview.create_time && (
                                      <p className="text-sm text-muted-foreground text-center sm:text-left">
                                        Posted:{" "}
                                        {dayjs(
                                          new Date(
                                            tiktokVideoPreview.create_time *
                                            1000,
                                          ),
                                        ).format("MMM D, YYYY [at] h:mm A")}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium border border-gray-500">
                                        🎬 TikTok Video
                                      </span>
                                      <div
                                        className={cn(
                                          "flex items-center gap-3 text-xs",
                                          isDark
                                            ? "text-gray-300"
                                            : "text-gray-600",
                                        )}
                                      >
                                        <div className="flex items-center gap-1">
                                          <Eye className="h-3 w-3" />
                                          <span>
                                            {(
                                              tiktokVideoPreview.view_count || 0
                                            ).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <ThumbsUp className="h-3 w-3" />
                                          <span>
                                            {(
                                              tiktokVideoPreview.like_count || 0
                                            ).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <MessageSquare className="h-3 w-3" />
                                          <span>
                                            {(
                                              tiktokVideoPreview.comment_count ||
                                              0
                                            ).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </div>
                        );
                      })()}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

          {/* Multiple Submissions UI - Only show if contest allows multiple submissions and account is connected */}
          {contest?.multiple_submissions_enabled &&
            (contestPlatform === "youtube"
              ? youtubeAccount
              : contestPlatform === "tiktok"
                ? tiktokAccount
                : instagramAccount?.access_token) && (
              <div className="mt-8">
                <Card
                  className={cn(
                    "border",
                    isDark
                      ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                      : "border-purple-200 bg-purple-50/50",
                  )}
                >
                  <CardHeader>
                    <CardTitle
                      className={cn(
                        "flex items-center gap-2",
                        isDark ? "text-white" : "text-purple-800",
                      )}
                    >
                      <CheckCheck className="h-5 w-5" />
                      Multiple Submissions Allowed
                    </CardTitle>
                    <CardDescription
                      className={cn(
                        "text-purple-700",
                        isDark ? "text-gray-300" : "text-purple-700",
                      )}
                    >
                      You can submit up to{" "}
                      {contest.max_submissions_per_creator || 1} videos for this
                      contest. Choose from your recent videos above or add
                      custom links below.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Submission Counter */}
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg",
                          isDark ? "bg-[#C9A7FF26]" : "bg-purple-100",
                        )}
                      >
                        <div>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isDark ? "text-white" : "text-purple-800",
                            )}
                          >
                            Selected:{" "}
                            {selectedVideosFromTabs.length +
                              selectedReelsFromTabs.length +
                              selectedVideos.length +
                              selectedReels.length +
                              selectedTiktokVideosFromTabs.length +
                              selectedTiktokVideosFromLinks.length}{" "}
                            /{" "}
                            {Math.max(
                              0,
                              (contest.max_submissions_per_creator || 1) -
                              submissionProgress.submitted,
                            )}{" "}
                            remaining submissions
                          </span>
                          {submissionProgress.submitted > 0 && (
                            <div
                              className={cn(
                                "text-xs",
                                isDark ? "text-gray-300" : "text-purple-600",
                              )}
                            >
                              Already submitted: {submissionProgress.submitted}{" "}
                              / {submissionProgress.maxAllowed} videos
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (
                                submissionLinks.length <
                                (contest.max_submissions_per_creator || 1)
                              ) {
                                setSubmissionLinks([...submissionLinks, ""]);
                              }
                            }}
                            disabled={
                              submissionLinks.length >=
                              (contest.max_submissions_per_creator || 1)
                            }
                            className={cn(
                              isDark
                                ? "bg-[#7F39EC] border-[#7F39EC] text-white"
                                : "border text-purple-700 border-purple-300 hover:bg-purple-100",
                            )}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Link
                          </Button>
                          {submissionLinks.length > 1 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const newLinks = [...submissionLinks];
                                newLinks.pop();
                                setSubmissionLinks(newLinks);
                              }}
                              className={cn(
                                isDark
                                  ? "bg-[#7F39EC] border-[#7F39EC] text-white"
                                  : "border text-purple-700 border-purple-300 hover:bg-purple-100",
                              )}
                            >
                              <Minus className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Multiple Link Inputs */}
                      <div className="space-y-3">
                        {submissionLinks.map((link, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <Input
                              type="text"
                              className={cn(
                                "flex-1",
                                isDark
                                  ? "bg-[#180438] border border-gray-700 text-white"
                                  : "bg-white text-black",
                              )}
                              placeholder={`Enter ${contestPlatform?.toLowerCase() === "youtube"
                                  ? "YouTube"
                                  : contestPlatform?.toLowerCase() === "tiktok"
                                    ? "TikTok"
                                    : "Instagram"
                                } video URL ${index + 1}`}
                              value={link}
                              onChange={(e) => {
                                const newLinks = [...submissionLinks];
                                newLinks[index] = e.target.value;
                                setSubmissionLinks(newLinks);

                                // Mark as not fetched if link is changed
                                if (fetchedLinkIndices.has(index)) {
                                  setFetchedLinkIndices((prev) => {
                                    const newSet = new Set(prev);
                                    newSet.delete(index);
                                    return newSet;
                                  });
                                  setLinkFetchStatus((prev) => ({
                                    ...prev,
                                    [index]: "idle",
                                  }));
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleIndividualFetch(link, index)}
                              disabled={
                                !link.trim() ||
                                linkFetchStatus[index] === "fetching"
                              }
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              {linkFetchStatus[index] === "fetching" ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : fetchedLinkIndices.has(index) ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                "Fetch"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIndividualRemove(index)}
                              className={cn(
                                isDark
                                  ? "text-red-400 border-red-500 hover:bg-red-900"
                                  : "text-red-600 border-red-300 hover:bg-red-50",
                              )}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Fetch All Button */}
                      {submissionLinks.some((link) => link.trim()) && (
                        <div className="flex justify-center">
                          <Button
                            onClick={handleFetchAllVideos}
                            disabled={
                              isFetchingVideo ||
                              submissionLinks.every((link) => !link.trim())
                            }
                            className="bg-purple-600 hover:bg-purple-700 text-white px-8"
                          >
                            {isFetchingVideo ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Fetching New Videos...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Fetch New Videos (
                                {
                                  submissionLinks.filter(
                                    (link, index) =>
                                      link.trim() &&
                                      !fetchedLinkIndices.has(index),
                                  ).length
                                }
                                )
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      {/* Fetched Videos Display */}
                      {(fetchedVideos.length > 0 ||
                        fetchedReels.length > 0 ||
                        fetchedTiktokVideosFromLinks.length > 0) && (
                          <div className="mt-6">
                            <h4
                              className={cn(
                                "text-lg font-semibold",
                                isDark ? "text-white" : "text-purple-800",
                              )}
                            >
                              Fetched Videos - Select the ones you want to submit:
                            </h4>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                              {/* YouTube Videos */}
                              {fetchedVideos.map((video, index) => {
                                if (!video) return null;

                                const thumbnailUrl =
                                  getYouTubeThumbnailUrl(
                                    video.snippet.thumbnails,
                                    video.id.videoId,
                                  ) ||
                                  `https://i.ytimg.com/vi/${video.id.videoId}/hqdefault.jpg`;

                                return (
                                  <Card
                                    key={`youtube-${index}`}
                                    className={cn(
                                      "cursor-pointer transition-all duration-200",
                                      isVideoAlreadySubmitted(
                                        video.id.videoId,
                                        `https://www.youtube.com/watch?v=${video.id.videoId}`,
                                      )
                                        ? isDark
                                          ? "border-2 border-red-500 bg-red-900/40 opacity-90"
                                          : "border-2 border-red-300 bg-red-50 opacity-75"
                                        : selectedVideoIndices.includes(index)
                                          ? isDark
                                            ? "border-2 border-purple-400 bg-[#2B184A]"
                                            : "border-2 border-purple-500 bg-purple-50"
                                          : isDark
                                            ? "border border-gray-600 hover:border-purple-400 bg-[#180438]"
                                            : "border border-gray-200 hover:border-purple-300 bg-white",
                                    )}
                                    onClick={() =>
                                      handleVideoSelection(
                                        index,
                                        !selectedVideoIndices.includes(index),
                                      )
                                    }
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex flex-col sm:flex-row items-start gap-4">
                                        {/* Checkbox - First on mobile, right side on desktop */}
                                        <div className="flex-shrink-0 sm:order-3 sm:ml-2 self-start">
                                          <Checkbox
                                            aria-label="Select video"
                                            checked={selectedVideoIndices.includes(
                                              index,
                                            )}
                                            onCheckedChange={(checked) =>
                                              handleVideoSelection(
                                                index,
                                                Boolean(checked),
                                              )
                                            }
                                            onClick={(event) =>
                                              event.stopPropagation()
                                            }
                                            className={cn(
                                              "h-5 w-5 border-2",
                                              isDark
                                                ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                                : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                            )}
                                          />
                                        </div>
                                        {/* Image - Second on mobile, first on desktop */}
                                        <div className="flex-shrink-0 w-full sm:w-auto sm:order-1">
                                          <Image
                                            src={thumbnailUrl}
                                            alt={video.snippet.title}
                                            width={120}
                                            height={68}
                                            className="rounded-lg object-cover aspect-video w-full sm:w-auto"
                                          />
                                        </div>
                                        {/* Content - Third on mobile, second on desktop */}
                                        <div className="flex-1 min-w-0 w-full sm:w-auto sm:order-2">
                                          <div className="flex flex-col items-start gap-2">
                                            <div className="flex-1 min-w-0 w-full">
                                              <div className="flex flex-col sm:flex-row items-start gap-2 mb-2">
                                                <h5 className="font-medium text-sm line-clamp-2 flex-1 min-w-0">
                                                  {video.snippet.title}
                                                </h5>
                                                {isVideoAlreadySubmitted(
                                                  video.id.videoId,
                                                  `https://www.youtube.com/watch?v=${video.id.videoId}`,
                                                ) && (
                                                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">
                                                      <AlertTriangle className="h-3 w-3" />
                                                      Already Submitted
                                                    </div>
                                                  )}
                                              </div>
                                              <div
                                                className={cn(
                                                  "flex flex-wrap items-center gap-2 sm:gap-4 text-xs",
                                                  isDark
                                                    ? "text-gray-300"
                                                    : "text-gray-600",
                                                )}
                                              >
                                                <div className="flex items-center gap-1">
                                                  <Eye
                                                    className={cn(
                                                      "h-4 w-4",
                                                      isDark
                                                        ? "text-gray-300"
                                                        : "text-gray-600",
                                                    )}
                                                  />
                                                  <span className="font-medium">
                                                    {video.statistics
                                                      ?.viewCount || 0}{" "}
                                                  </span>
                                                  <span>views</span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                  <ThumbsUp
                                                    className={cn(
                                                      "h-4 w-4",
                                                      isDark
                                                        ? "text-gray-300"
                                                        : "text-gray-600",
                                                    )}
                                                  />
                                                  <span>
                                                    {video.statistics
                                                      ?.likeCount || 0}{" "}
                                                  </span>
                                                  <span>likes</span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                  <MessageSquare
                                                    className={cn(
                                                      "h-4 w-4",
                                                      isDark
                                                        ? "text-gray-300"
                                                        : "text-gray-600",
                                                    )}
                                                  />
                                                  <span className="font-medium">
                                                    {video.statistics
                                                      ?.commentCount || 0}{" "}
                                                  </span>
                                                  <span>comments</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}

                              {/* Instagram Reels */}
                              {fetchedReels.map(
                                (reel, index) =>
                                  reel && (
                                    <Card
                                      key={`instagram-${index}`}
                                      className={cn(
                                        "cursor-pointer transition-all duration-200",
                                        isVideoAlreadySubmitted(
                                          reel.id,
                                          reel.permalink,
                                        )
                                          ? isDark
                                            ? "border-2 border-red-500 bg-red-900/40 opacity-90"
                                            : "border-2 border-red-300 bg-red-50 opacity-75"
                                          : selectedReelIndices.includes(index)
                                            ? isDark
                                              ? "border-2 border-purple-400 bg-[#2B184A]"
                                              : "border-2 border-purple-500 bg-purple-50"
                                            : isDark
                                              ? "border border-gray-600 hover:border-purple-400 bg-[#180438]"
                                              : "border border-gray-200 hover:border-purple-300 bg-white",
                                      )}
                                      onClick={() =>
                                        handleVideoSelection(
                                          index,
                                          !selectedReelIndices.includes(index),
                                        )
                                      }
                                    >
                                      <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                          <div className="flex-shrink-0">
                                            <Image
                                              src={
                                                reel.thumbnail_url ||
                                                "/placeholder-reel.jpg"
                                              }
                                              alt={
                                                reel.caption || "Instagram Reel"
                                              }
                                              width={120}
                                              height={120}
                                              className="rounded-lg object-cover aspect-square"
                                            />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-start gap-2 mb-2">
                                                  <h5
                                                    className={cn(
                                                      "font-medium text-sm line-clamp-2 flex-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-gray-900",
                                                    )}
                                                  >
                                                    {reel.caption ||
                                                      "Instagram Reel"}
                                                  </h5>
                                                  {isVideoAlreadySubmitted(
                                                    reel.id,
                                                    reel.permalink,
                                                  ) && (
                                                      <div
                                                        className={cn(
                                                          "flex items-center gap-1 text-xs px-2 py-1 rounded-full flex-shrink-0",
                                                          isDark
                                                            ? "text-red-300 bg-red-900/60 border border-red-500/40"
                                                            : "text-red-600 bg-red-100",
                                                        )}
                                                      >
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Already Submitted
                                                      </div>
                                                    )}
                                                </div>
                                                <div
                                                  className={cn(
                                                    "flex items-center gap-4 text-xs",
                                                    isDark
                                                      ? "text-gray-300"
                                                      : "text-gray-600",
                                                  )}
                                                >
                                                  <div className="flex items-center gap-1">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>
                                                      {dayjs(
                                                        reel.timestamp,
                                                      ).format("MMM D, YYYY")}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <Film className="h-4 w-4" />
                                                    <span>{reel.media_type}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex-shrink-0 ml-2">
                                                <Checkbox
                                                  aria-label="Select reel"
                                                  checked={selectedReelIndices.includes(
                                                    index,
                                                  )}
                                                  onCheckedChange={(checked) =>
                                                    handleVideoSelection(
                                                      index,
                                                      Boolean(checked),
                                                    )
                                                  }
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                  className={cn(
                                                    "h-5 w-5 border-2",
                                                    isDark
                                                      ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                                      : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                                  )}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ),
                              )}

                              {/* TikTok Videos from Links */}
                              {fetchedTiktokVideosFromLinks.map(
                                (video, index) =>
                                  video && (
                                    <Card
                                      key={`tiktok-link-${index}`}
                                      className={cn(
                                        "cursor-pointer transition-all duration-200",
                                        isVideoAlreadySubmitted(
                                          video.id,
                                          video.share_url || "",
                                        )
                                          ? isDark
                                            ? "border-2 border-red-500 bg-red-900/40 opacity-90"
                                            : "border-2 border-red-300 bg-red-50 opacity-75"
                                          : selectedTiktokVideoIndices.includes(
                                            index,
                                          )
                                            ? isDark
                                              ? "border-2 border-purple-400 bg-[#2B184A]"
                                              : "border-2 border-purple-500 bg-purple-50"
                                            : isDark
                                              ? "border border-gray-600 hover:border-purple-400 bg-[#180438]"
                                              : "border border-gray-200 hover:border-purple-300 bg-white",
                                      )}
                                      onClick={() =>
                                        handleTiktokVideoSelection(
                                          index,
                                          !selectedTiktokVideoIndices.includes(
                                            index,
                                          ),
                                        )
                                      }
                                    >
                                      <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                          <div className="flex-shrink-0">
                                            {video.cover_image_url ? (
                                              <img
                                                src={video.cover_image_url}
                                                alt={
                                                  video.title || "TikTok Video"
                                                }
                                                width={120}
                                                height={120}
                                                className="rounded-lg object-cover aspect-square"
                                              />
                                            ) : (
                                              <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground border">
                                                🎬 No thumbnail
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <div className="flex items-start gap-2 mb-2">
                                                  <h5
                                                    className={cn(
                                                      "font-medium text-sm line-clamp-2 flex-1",
                                                      isDark
                                                        ? "text-white"
                                                        : "text-gray-900",
                                                    )}
                                                  >
                                                    {video.title ||
                                                      video.video_description ||
                                                      "TikTok Video"}
                                                  </h5>
                                                  {isVideoAlreadySubmitted(
                                                    video.id,
                                                    video.share_url || "",
                                                  ) && (
                                                      <div
                                                        className={cn(
                                                          "flex items-center gap-1 text-xs px-2 py-1 rounded-full flex-shrink-0",
                                                          isDark
                                                            ? "text-red-300 bg-red-900/60 border border-red-500/40"
                                                            : "text-red-600 bg-red-100",
                                                        )}
                                                      >
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Already Submitted
                                                      </div>
                                                    )}
                                                </div>
                                                <div
                                                  className={cn(
                                                    "flex flex-wrap items-center gap-4 text-xs",
                                                    isDark
                                                      ? "text-gray-300"
                                                      : "text-gray-600",
                                                  )}
                                                >
                                                  {video.create_time && (
                                                    <div className="flex items-center gap-1">
                                                      <CalendarDays className="h-4 w-4" />
                                                      <span>
                                                        {dayjs(
                                                          new Date(
                                                            video.create_time *
                                                            1000,
                                                          ),
                                                        ).format("MMM D, YYYY")}
                                                      </span>
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1">
                                                    <Eye className="h-4 w-4" />
                                                    <span>
                                                      {(
                                                        video.view_count || 0
                                                      ).toLocaleString()}{" "}
                                                      views
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <ThumbsUp className="h-4 w-4" />
                                                    <span>
                                                      {(
                                                        video.like_count || 0
                                                      ).toLocaleString()}{" "}
                                                      likes
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <MessageSquare className="h-4 w-4" />
                                                    <span>
                                                      {(
                                                        video.comment_count || 0
                                                      ).toLocaleString()}{" "}
                                                      comments
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="flex-shrink-0 ml-2">
                                                <Checkbox
                                                  aria-label="Select TikTok video"
                                                  checked={selectedTiktokVideoIndices.includes(
                                                    index,
                                                  )}
                                                  onCheckedChange={(checked) =>
                                                    handleTiktokVideoSelection(
                                                      index,
                                                      Boolean(checked),
                                                    )
                                                  }
                                                  onClick={(event) =>
                                                    event.stopPropagation()
                                                  }
                                                  className={cn(
                                                    "h-5 w-5 border-2",
                                                    isDark
                                                      ? "border-gray-500 data-[state=checked]:border-purple-400 data-[state=checked]:bg-purple-500"
                                                      : "border-gray-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600",
                                                  )}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Earnings Cap Warning */}
                      {contest.contest_based_details?.cpm_contest
                        ?.max_earnings_per_creator && (
                          <Alert
                            className={cn(
                              isDark
                                ? "border-[#C9A7FF] bg-[#C9A7FF26]"
                                : "border-amber-200 bg-amber-50",
                            )}
                          >
                            <AlertTriangle
                              className={cn(
                                isDark ? "text-purple-400" : "text-amber-600",
                              )}
                            />
                            <AlertDescription
                              className={cn(
                                isDark ? "text-white" : "text-amber-800",
                              )}
                            >
                              <strong>Earnings Cap:</strong> You can earn up to $
                              {(
                                contest.contest_based_details.cpm_contest
                                  .max_earnings_per_creator / 100
                              ).toFixed(2)}{" "}
                              total from this contest.
                            </AlertDescription>
                          </Alert>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
        </CardContent>
      </div>
    </div>
  );
}
