"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, RefreshCw, ExternalLink, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EnhancedTabs as Tabs, EnhancedTabsContent as TabsContent, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger } from "@/components/ui/enhanced-tabs";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import dayjs from 'dayjs';
import { useToast } from "@/hooks/use-toast";

// --- Submission Window Constants ---
const SUBMISSION_WINDOW_VALUE: number = 2;
const SUBMISSION_WINDOW_UNIT: dayjs.ManipulateType = 'hour';
const IS_SUBMISSION_WINDOW_SINGULAR: boolean = SUBMISSION_WINDOW_VALUE === 1;
const SUBMISSION_WINDOW_UNIT_DISPLAY = `${SUBMISSION_WINDOW_VALUE} ${SUBMISSION_WINDOW_UNIT}${IS_SUBMISSION_WINDOW_SINGULAR ? '' : 's'}`;
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
    };
  };
  statistics?: { // Added for displaying views, likes, comments
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface InstagramReel {
  id: string; // Media ID
  media_type: 'REEL' | 'VIDEO'; // Should be REEL for our purpose, VIDEO for IGTV, regular videos
  media_url: string;
  thumbnail_url?: string; // Not always present for REELS, might need separate call if required for all
  caption?: string;
  timestamp: string;
  permalink: string;
  // Potentially add insights here if fetched early, or keep them separate until submission
}

// Helper function to extract YouTube ID (client-side only)
function extractYoutubeId(url: string) {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:&\S+)?/i;
  const match = url.match(regex);
  return match ? match[1] : null;
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
  const [youtubeAccount, setYoutubeAccount] = useState<any>(null);
  const [userVideos, setUserVideos] = useState<YouTubeVideo[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  // Instagram specific state
  const [instagramAccount, setInstagramAccount] = useState<any>(null); // Holds creator_profiles.instagram_account
  const [userReels, setUserReels] = useState<InstagramReel[]>([]);
  const [selectedReel, setSelectedReel] = useState<InstagramReel | null>(null);
  const [isLoadingReels, setIsLoadingReels] = useState(false);
  const [instagramLink, setInstagramLink] = useState(""); // If we want to allow manual IG link input

  // Pagination state
  const ITEMS_PER_PAGE = 10; // Number of items to display per page
  const [youtubeCurrentPage, setYoutubeCurrentPage] = useState(1);
  const [instagramCurrentPage, setInstagramCurrentPage] = useState(1);
  // Instagram pagination will remain client-side for now, as per current scope
  // If IG also needs server-side, similar token states would be added for instagram

  const [error, setError] = useState<string | null>(null);
  const [submissionTimingError, setSubmissionTimingError] = useState<string | null>(null);
  const [libraryMessage, setLibraryMessage] = useState<string | null>(null); // Added for library-specific messages
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [isInstagramTokenExpired, setIsInstagramTokenExpired] = useState(false);

  const router = useRouter();
  const supabase = createClient();
  const [isFetchingVideo, setIsFetchingVideo] = useState(false);
  const [videoPreview, setVideoPreview] = useState<YouTubeVideo | null>(null);
  const [submissionType, setSubmissionType] = useState<'youtube' | 'instagram' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentInstagramBusinessAccountID, setCurrentInstagramBusinessAccountID] = useState<string | null>(null);

  const [contestPlatform, setContestPlatform] = useState<string | null>(null);
  const [isLoadingContest, setIsLoadingContest] = useState(true);
  const [instagramMediaPreview, setInstagramMediaPreview] = useState<InstagramReel | null>(null);
  const [isFetchingInstagramMedia, setIsFetchingInstagramMedia] = useState(false);
  const [contest, setContest] = useState<any>(null); // Store full contest data including contest_type

  const { toast } = useToast();

  // Derived state for paginated YouTube videos - Reinstated for client-side pagination
  const paginatedUserVideos = userVideos.slice(
    (youtubeCurrentPage - 1) * ITEMS_PER_PAGE,
    youtubeCurrentPage * ITEMS_PER_PAGE
  );
  const totalYoutubePages = Math.ceil(userVideos.length / ITEMS_PER_PAGE);

  // Derived state for paginated Instagram reels (client-side)
  const paginatedUserReels = userReels.slice(
    (instagramCurrentPage - 1) * ITEMS_PER_PAGE,
    instagramCurrentPage * ITEMS_PER_PAGE
  );
  const totalInstagramPages = Math.ceil(userReels.length / ITEMS_PER_PAGE);

  // Helper function for 2-hour validation
  const isContentTooOld = (publishedAt: string): boolean => {
    const windowAgo = dayjs().subtract(SUBMISSION_WINDOW_VALUE, SUBMISSION_WINDOW_UNIT);
    return dayjs(publishedAt).isBefore(windowAgo);
  };

  useEffect(() => {
    if (selectedVideo) {
      if (selectedVideo.snippet?.publishedAt) {
        if (isContentTooOld(selectedVideo.snippet.publishedAt)) {
          const errorMessage = `You can only submit the content which is posted within 2 hours. This video was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
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
        const errorMessage = "The selected video's publication date is missing and cannot be validated.";
        setSubmissionTimingError(errorMessage);
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      if (submissionTimingError?.includes("This video was published") || submissionTimingError?.startsWith("The selected video's publication date is missing")) {
        setSubmissionTimingError(null);
      }
    }
  }, [selectedVideo, toast]);

  useEffect(() => {
    if (selectedReel) {
      if (selectedReel.timestamp) {
        if (isContentTooOld(selectedReel.timestamp)) {
          const errorMessage = `You can only submit the content which is posted within 2 hours. This Reel was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
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
        const errorMessage = "The selected Reel's publication date is missing and cannot be validated.";
        setSubmissionTimingError(errorMessage);
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } else {
      if (submissionTimingError?.includes("This Reel was published") || submissionTimingError?.startsWith("The selected Reel's publication date is missing")) {
        setSubmissionTimingError(null);
      }
    }
  }, [selectedReel, toast]);

  // Check if user has connected YouTube account
  useEffect(() => {
    async function checkYouTubeConnection() {
      if (!user || !supabase || contestPlatform !== 'youtube') {
        if (contestPlatform === 'youtube') setYoutubeAccount(null); // Clear if it was youtube but now no user
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("creator_profiles")
          .select("youtube_account")
          .eq("id", user.id)
          .single();

        setYoutubeAccount(profile?.youtube_account);

        if (profile?.youtube_account) {
          // Check if token is expired
          if (new Date(profile.youtube_account.expires_at) <= new Date()) {
            setIsTokenExpired(true);
            setError(
              "Your YouTube connection has expired. Please re-connect your YouTube account."
            );
          } else {
            fetchYouTubeVideos();
          }
        }
      } catch (err) {
        console.error("Error fetching YouTube account:", err);
        setError("Failed to fetch YouTube account information");
      }
    }

    checkYouTubeConnection();
  }, [user, supabase, contestPlatform]);

  // Check if user has connected Instagram account
  useEffect(() => {
    async function checkInstagramConnection() {
      if (!user || !supabase || contestPlatform !== 'instagram') {
        if (contestPlatform === 'instagram') {
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

        if (igAccount?.access_token) {
          if (igAccount.token_expiry && dayjs().isAfter(dayjs(igAccount.token_expiry))) {
            setIsInstagramTokenExpired(true);
            setError(
              "Your Instagram connection has expired. Please re-connect your Instagram account in settings."
            );
            setIsLoadingReels(false);
          } else {
            setIsInstagramTokenExpired(false);
            // If it's a Business or Creator account, the app_scoped_user_id IS the IGBA ID needed.
            if ((igAccount.account_type === 'BUSINESS' || igAccount.account_type === 'MEDIA_CREATOR') && igAccount.app_scoped_user_id) {
              setCurrentInstagramBusinessAccountID(igAccount.app_scoped_user_id);
              // The useEffect listening to currentInstagramBusinessAccountID will now trigger fetchInstagramReels
              setIsLoadingReels(true); // Set loading true, fetchInstagramReels will set it false in its finally block
            } else if (!igAccount.app_scoped_user_id && (igAccount.account_type === 'BUSINESS' || igAccount.account_type === 'MEDIA_CREATOR')) {
              setError("Connected Instagram account is Business/Creator but missing the required ID (app_scoped_user_id). Please try reconnecting the account.");
              setIsLoadingReels(false);
            } else {
              setError("Instagram account must be a Business or Creator account to fetch reels. Current type: " + (igAccount.account_type || 'Unknown'));
              setIsLoadingReels(false);
            }
          }
        } else {
          setInstagramAccount(null);
          setCurrentInstagramBusinessAccountID(null);
          setIsLoadingReels(false);
        }
      } catch (err: any) {
        console.error("Error in checkInstagramConnection:", err);
        setError("Failed to process Instagram account information.");
        setCurrentInstagramBusinessAccountID(null);
        setIsLoadingReels(false);
      }
    }

    checkInstagramConnection();
  }, [user, supabase, contestPlatform]);

  // New useEffect to fetch reels once currentInstagramBusinessAccountID is set
  useEffect(() => {
    if (contestPlatform === 'instagram' && currentInstagramBusinessAccountID && instagramAccount?.access_token && !isInstagramTokenExpired) {
      // Ensure it's a business/creator account before fetching reels with IGBA ID
      if (instagramAccount.account_type === 'BUSINESS' || instagramAccount.account_type === 'MEDIA_CREATOR') {
        fetchInstagramReels(instagramAccount.access_token, currentInstagramBusinessAccountID);
      }
    }
  }, [currentInstagramBusinessAccountID, instagramAccount, isInstagramTokenExpired, contestPlatform]);

  // Fetch videos using the server API endpoint
  const fetchYouTubeVideos = async () => { // Removed pageToken parameter
    if (contestPlatform !== 'youtube') return;
    setIsLoadingVideos(true);
    setError(null);
    setLibraryMessage(null); // Clear previous library message

    try {
      // Reverted: No longer sending pagination query parameters
      const response = await fetch(`/api/youtube/videos`);
      const data = await response.json(); // Expects { videos: [...], nextPageToken?: string, prevPageToken?: string, totalResults?: number }

      if (!response.ok) {
        if (response.status === 401) {
          setIsTokenExpired(true);
          setError(
            "Your YouTube connection has expired. Please re-connect your YouTube account."
          );
        } else {
          // Use error from response if available, otherwise a default
          throw new Error(data.error || "Failed to load videos");
        }
        setUserVideos([]); // Clear videos on error
        setYoutubeCurrentPage(1); // Reset page
        return;
      }

      const allFetchedVideos: YouTubeVideo[] = data.videos || []; // Ensure type
      const filteredVideos = allFetchedVideos.filter((video: YouTubeVideo) => video.snippet?.publishedAt && !isContentTooOld(video.snippet.publishedAt));
      setUserVideos(filteredVideos); // Set userVideos with the filtered list
      setYoutubeCurrentPage(1); // Reset to first page on new data load

      if ((data.videos && data.videos.length > 0) && filteredVideos.length === 0) {
        setLibraryMessage(`No videos found in your YouTube channel that were published in the last ${SUBMISSION_WINDOW_UNIT_DISPLAY}. You can still fetch an older video by pasting its link directly, but it must have been published within the last ${SUBMISSION_WINDOW_UNIT_DISPLAY} to be eligible for the submission/ contest.`);
      }

    } catch (err: any) {
      console.error("Error fetching YouTube videos:", err);
      setError(
        err.message || "Failed to load your YouTube videos. Please try again."
      );
      setUserVideos([]);
      setYoutubeCurrentPage(1);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Handle YouTube reconnection
  const handleReconnectYouTube = () => {
    router.push(
      "/api/youtube/auth?returnTo=" +
      encodeURIComponent(`/dashboard/opportunities/${contestId}/submit?platform=${contestPlatform || ''}`) // pass platform back
    );
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setIsLoadingContest(false);
        return;
      }
      setIsLoadingContest(true);

      // First check if user has already submitted
      const { data: existingSubmission } = await supabase
        .from("submissions")
        .select("*")
        .eq("contest_id", contestId)
        .eq("creator_id", user.id);

      if (existingSubmission && existingSubmission.length > 0) {
        // User has already submitted
        redirect(
          `/dashboard/opportunities/${contestId}?error=already_submitted`
        );
      }

      // Get contest details
      const { data: contestData, error: contestError } = await supabase
        .from("contests")
        .select("platform, contest_type") // Include contest_type for verification logic
        .eq("id", contestId)
        .single();

      if (contestError || !contestData) {
        console.error("Error fetching contest:", contestError);
        setError("Failed to load contest details. The contest might not exist or an error occurred.");
        setContestPlatform(null);
        setContest(null);
        setIsLoadingContest(false);
        // Optionally redirect, or let the UI handle the error state
        // redirect("/dashboard/opportunities"); 
        return;
      }

      // Store full contest data
      setContest(contestData);

      if (contestData.platform) {
        setContestPlatform(contestData.platform.toLowerCase());
      } else {
        setError("This contest does not have a specified platform (e.g., YouTube or Instagram).");
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
        title: "Validation Error",
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
        title: "Validation Error",
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
        if (responseData && typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      // response.ok is true here
      if (responseData && responseData.valid && responseData.videoInfo) {
        const videoData: YouTubeVideo = responseData.videoInfo;
        if (videoData?.snippet?.publishedAt) {
          if (isContentTooOld(videoData.snippet.publishedAt)) {
            const errorMessage = `You can only submit the content which is posted within 2 hours. This video was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
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
            setSubmissionType('youtube');
            setError(null);
          }
        } else {
          setVideoPreview(videoData || null);
          setSelectedVideo(null);
          const errorMessage = videoData ? "Could not determine the video's publication date." : "Video not found or invalid link.";
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Validation Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        // Response was OK, but data structure is not as expected for a valid video
        let errorMessage = "YouTube video verification failed or video information not found.";
        if (responseData && typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      // This will catch errors from fetch itself (network error) or SyntaxError from response.json() if body is not valid JSON, or errors thrown above.
      setError(err.message || "An unexpected error occurred while fetching YouTube video.");
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
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }
    if (!instagramAccount?.access_token || !instagramAccount?.app_scoped_user_id) {
      const errorMessage = "Instagram account not connected, token missing, or user ID missing.";
      setError(errorMessage);
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsFetchingInstagramMedia(false);
      return;
    }
    if (!user) {
      const errorMessage = "User not available. Please ensure you are logged in.";
      setError(errorMessage);
      toast({
        title: "Validation Error",
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

      const responseData = await response.json(); // Call .json() ONCE

      if (!response.ok) {
        let errorMessage = "Failed to verify Instagram media"; // Default message
        if (responseData && typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }

      // response.ok is true here
      if (responseData && responseData.valid && responseData.mediaInfo) {
        const mediaDetails: InstagramReel = responseData.mediaInfo;
        if (mediaDetails?.timestamp) {
          if (isContentTooOld(mediaDetails.timestamp)) {
            const errorMessage = `You can only submit the content which is posted within 2 hours. This Reel was published more than ${SUBMISSION_WINDOW_UNIT_DISPLAY} ago and cannot be submitted.`;
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
            setSubmissionType('instagram');
            setError(null);
          }
        } else {
          setInstagramMediaPreview(mediaDetails || null);
          setSelectedReel(null);
          const errorMessage = mediaDetails ? "Could not determine the Reel's publication date." : "Reel not found or invalid link.";
          setSubmissionTimingError(errorMessage);
          toast({
            title: "Validation Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        // Response was OK, but data structure is not as expected for valid media
        let errorMessage = "Instagram media verification failed or media info not found.";
        if (responseData && typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData && typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      // This will catch errors from fetch itself, SyntaxError from response.json(), or errors thrown above.
      console.error("Error in handleFetchInstagramByLink:", err); // Keep user's console.error for this one
      setError(err.message || "An unexpected error occurred while fetching Instagram media.");
      setInstagramMediaPreview(null);
      setSelectedReel(null);
    } finally {
      setIsFetchingInstagramMedia(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (submissionTimingError) {
      toast({
        title: "Content Too Old",
        description: submissionTimingError,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null); // Clear previous messages

    if (!user) {
      const errorMessage = "You must be logged in to submit content";
      setError(errorMessage);
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // All submissions start as pending for manual verification regardless of contest type
      const initialStatus = 'pending';

      let submissionPayload: any = {
        contest_id: contestId,
        creator_id: user.id,
        status: initialStatus,
      };

      if (contestPlatform === 'instagram' && selectedReel && instagramAccount?.access_token && currentInstagramBusinessAccountID) {
        setMessage("Fetching Instagram Reel insights...");
        // console.log("This is the selectedReel from the instagram submit route", selectedReel);
        // console.log("This is the currentInstagramBusinessAccountID from the instagram submit route", currentInstagramBusinessAccountID);
        // console.log("This is the instagramAccount.access_token from the instagram submit route", instagramAccount.access_token);

        const insightsRes = await fetch(
          `https://graph.instagram.com/${selectedReel.id}/insights?metric=reach,likes,comments,shares,saved,total_interactions,views&access_token=${instagramAccount.access_token}`
        );

        const insightsData = await insightsRes.json();
        // console.log("This is the data from the instagram insights route", insightsData);

        if (!insightsRes.ok || insightsData.error) {
          const specificConversionErrorMessage = "This Reel was posted before your Instagram account was converted to a Business/Creator account, so its metrics cannot be fetched. Please select and submit a different Reel.";
          const genericInsightErrorMessage = "Failed to fetch Instagram Reel insights. Submission cannot proceed without metrics.";

          if (insightsData.error) {
            console.error("Error fetching Instagram insights:", insightsData.error);
            if (insightsData.error.error_subcode === 2108006 ||
              (insightsData.error.message && insightsData.error.message.includes("The media was posted before the most recent time that the user's account was converted"))) {
              setError(specificConversionErrorMessage);
              toast({
                title: "Instagram Insights Error",
                description: specificConversionErrorMessage,
                variant: "destructive",
              });
            } else {
              const errorMessage = insightsData.error.message || genericInsightErrorMessage;
              setError(errorMessage);
              toast({
                title: "Instagram Insights Error",
                description: errorMessage,
                variant: "destructive",
              });
            }
          } else { // !insightsRes.ok but no insightsData.error
            const errorMessage = genericInsightErrorMessage + ` (Status: ${insightsRes.status})`;
            setError(errorMessage);
            toast({
              title: "Instagram Insights Error",
              description: errorMessage,
              variant: "destructive",
            });
          }
          setIsLoading(false);
          setMessage(null);
          return; // Prevent submission
        }

        let primaryViews = 0;
        const instagramApiMetrics: any = {}; // To store all metrics from the API response

        if (insightsData?.data && Array.isArray(insightsData.data)) {
          insightsData.data.forEach((metric: { name: string; values: { value: number }[] }) => {
            const value = metric.values[0]?.value || 0;
            instagramApiMetrics[metric.name] = value; // Store each metric by its name

            if (metric.name === "views") { // Primary source for views count
              primaryViews = value;
            }
          });
        } else {
          console.warn("Instagram insights data field is missing, not an array, or empty. Instagram stats will be empty or defaults.");
        }

        // Fallback logic: If 'views' metric was 0 or not found, and 'reach' is available and greater than 0, use 'reach'.
        if (primaryViews === 0 && instagramApiMetrics.reach !== undefined && instagramApiMetrics.reach > 0) {
          console.log("Primary 'views' metric from Instagram API was 0 or not found. Falling back to 'reach' metric value:", instagramApiMetrics.reach);
          primaryViews = instagramApiMetrics.reach;
        } else if (primaryViews === 0) {
          console.log("Primary 'views' metric from Instagram API is 0 or not found, and 'reach' is also 0 or not available. Submission views will be 0.");
        }

        // Ensure all expected other_stats fields are at least defaulted if not present in API response
        const defaultStats = { reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, total_interactions: 0, views: 0 };
        const finalInstagramStats = { ...defaultStats, ...instagramApiMetrics };

        submissionPayload = {
          ...submissionPayload,
          platform: 'instagram',
          views: primaryViews, // Use the determined primary views count
          content_link: selectedReel.permalink,
          video_id: selectedReel.id,
          video_title: selectedReel.caption || "Instagram Content",
          video_thumbnail_url: selectedReel.thumbnail_url,
          other_stats: { instagram: finalInstagramStats }, // Store all fetched/defaulted metrics
        };
        console.log("This is the submissionPayload from the instagram submit route", submissionPayload);

      } else if (contestPlatform === 'youtube' && (selectedVideo || videoPreview)) {
        // YouTube Video Submission
        const videoToSubmit = selectedVideo || videoPreview; // Prioritize actively selected library video

        if (!videoToSubmit) {
          setError("No YouTube video selected or fetched for submission.");
          setIsLoading(false);
          return;
        }

        setMessage("Fetching YouTube video insights...");
        console.log("videoToSubmit", videoToSubmit);


        const youtubeStats = {
          likes: videoToSubmit?.statistics?.likeCount ? parseInt(videoToSubmit.statistics.likeCount) : 0,
          comments: videoToSubmit?.statistics?.commentCount ? parseInt(videoToSubmit.statistics.commentCount) : 0,
          // Add any other YouTube specific stats you want in other_stats.youtube
        };

        submissionPayload = {
          ...submissionPayload,
          platform: 'youtube',
          views: videoToSubmit?.statistics?.viewCount ? parseInt(videoToSubmit.statistics.viewCount) : 0,
          content_link: `https://www.youtube.com/watch?v=${videoToSubmit.id.videoId}`,
          video_id: videoToSubmit.id.videoId,
          video_title: videoToSubmit.snippet.title,
          video_thumbnail_url: videoToSubmit.snippet.thumbnails.default.url,
          other_stats: { youtube: youtubeStats },
        };

      } else if (contestPlatform === 'youtube' && contentLink && !selectedVideo && !videoPreview) {
        setError("For YouTube, please fetch and verify the link first, or select a video from your library.");
        setIsLoading(false);
        return;
      } else if (contestPlatform === 'instagram' && instagramLink && !selectedReel && !instagramMediaPreview) {
        setError("For Instagram, please fetch and verify the link first, or select an item from your library.");
        setIsLoading(false);
        return;
      } else {
        setError("Please select a video or Reel to submit, or ensure your linked content is fetched and verified.");
        setIsLoading(false);
        return;
      }

      setMessage("Submitting your content...");
      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .insert([submissionPayload])
        .select();

      if (submissionError) {
        throw submissionError;
      }

      console.log("Submission successful:", submissionData);
      setMessage("Content submitted successfully! Redirecting...");
      router.push(`/dashboard/opportunities/${contestId}?success=content_submitted`);

    } catch (err: any) {
      console.error("Error during submission:", err);
      setError(err.message || "Failed to submit content. Please try again.");
    } finally {
      setIsLoading(false);
      setMessage(null);
    }
  };

  const fetchInstagramReels = async (accessToken: string, igBusinessAccountID: string) => {
    if (contestPlatform !== 'instagram' || !accessToken || !igBusinessAccountID) {
      setError("Instagram access token or Business Account ID not found for fetching reels.");
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
    console.log("[fetchInstagramReels] Starting fetch for IGBA ID:", igBusinessAccountID);

    try {
      const mediaRes = await fetch(`https://graph.instagram.com/${igBusinessAccountID}/media?fields=id,media_type,media_product_type,video_title,caption,permalink,thumbnail_url,timestamp&access_token=${accessToken}`);
      // Added media_product_type, video_title to fields if available, to better identify reels.

      const mediaData = await mediaRes.json();
      console.log("[fetchInstagramReels] Raw mediaData from API:", JSON.stringify(mediaData, null, 2));


      if (!mediaRes.ok || mediaData.error) {
        console.error("[fetchInstagramReels] API Error response:", mediaData.error);
        throw new Error(mediaData.error?.message || "Failed to fetch Instagram media IDs using Business Account ID");
      }

      const potentialContent = mediaData.data;
      if (!potentialContent || potentialContent.length === 0) {
        console.log("[fetchInstagramReels] No potential content found in API response data.");
        setUserReels([]);
        // setIsLoadingReels(false); // Done in finally
        return;
      }

      console.log(`[fetchInstagramReels] Received ${potentialContent.length} items from /media endpoint. Full list:`, JSON.stringify(potentialContent, null, 2));


      const allFetchedReels: InstagramReel[] = [];
      // The /media endpoint returns a mix. We need to filter for Reels.
      // Reels often have media_product_type === 'REELS' or media_type === 'VIDEO'
      // The structure from /media might be slightly different than direct /media_id calls.
      // We may need to iterate and fetch full details for each *potential* reel if thumbnail_url or other specific fields are missing here.
      // For now, let's assume the direct /media call with expanded fields gives enough info.

      console.log("[fetchInstagramReels] Starting to filter items for Reels...");
      for (const item of potentialContent) {
        console.log(`[fetchInstagramReels] Processing item: id=${item.id}, media_type=${item.media_type}, media_product_type=${item.media_product_type}`);
        // Prioritize media_product_type if available, otherwise check media_type.
        // Instagram API can be a bit varied here. If it's a VIDEO, we should include it.
        if (item.media_product_type === 'REELS' || item.media_type === 'VIDEO') {
          console.log(`[fetchInstagramReels] ✅ Including item id=${item.id} as a Reel/Video.`);
          // Create a reel object matching our InstagramReel interface
          allFetchedReels.push({
            id: item.id,
            media_type: (item.media_product_type === 'REELS') ? 'REEL' : 'VIDEO', // Be more specific based on product type if REELS
            media_url: item.permalink, // permalink is better for media_url in this context
            thumbnail_url: item.thumbnail_url,
            caption: item.caption || item.video_title, // Use caption, fallback to video_title if available
            timestamp: item.timestamp,
            permalink: item.permalink,
          });
        } else {
          console.log(`[fetchInstagramReels] ❌ Skipping item id=${item.id} - media_type: ${item.media_type}, media_product_type: ${item.media_product_type}`);
        }
      }
      console.log(`[fetchInstagramReels] Filtered down to ${allFetchedReels.length} reels.`);

      // Client-side filter based on submission window
      const filteredReels = allFetchedReels.filter(reel => reel.timestamp && !isContentTooOld(reel.timestamp));
      setUserReels(filteredReels.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()));

      if (allFetchedReels.length > 0 && filteredReels.length === 0) {
        setLibraryMessage(`No Reels or Videos found on your Instagram account that were posted in the last ${SUBMISSION_WINDOW_UNIT_DISPLAY}. You can still fetch older content by pasting its link directly, but it must have been posted within the last ${SUBMISSION_WINDOW_UNIT_DISPLAY} to be eligible.`);
      }

    } catch (err: any) {
      console.error("Error fetching Instagram Reels:", err);
      setError(err.message || "Failed to load your Instagram Reels.");
      if (err.message?.includes("token") || err.message?.includes("OAuthException")) {
        setIsInstagramTokenExpired(true);
      }
    } finally {
      console.log("[fetchInstagramReels] Fetch operation complete.");
      setIsLoadingReels(false);
    }
  };

  if (isLoadingContest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <RefreshCw className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading contest details...</p>
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
            {error || "This contest does not specify a platform (e.g., YouTube or Instagram) or the contest details could not be loaded. Please check the contest setup or go back."}
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
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
          Submit Content from {contestPlatform === 'youtube' ? 'YouTube' : 'Instagram'}
        </h1>
      </div>

      <Card className="max-w-6xl mx-auto p-4 sm:p-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Content Submission</CardTitle>
          <CardDescription>
            Submit your {contestPlatform === 'youtube' ? 'YouTube video/short' : 'Instagram Reel/video'} for this contest.
          </CardDescription>
        </CardHeader>
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
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mb-6">
            <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                isLoading ||
                (contestPlatform === 'youtube' && !selectedVideo && !videoPreview) ||
                (contestPlatform === 'instagram' && !selectedReel && !instagramMediaPreview) ||
                isFetchingVideo || isFetchingInstagramMedia
              }
              className="w-full sm:w-auto"
            >
              {isLoading ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
              Submit Content
            </Button>
          </div>

          {/* YOUTUBE UI BLOCK */}
          {contestPlatform === 'youtube' && (
            <>
              {isTokenExpired && (
                <Alert variant="destructive" className="mb-4 text-center">
                  <AlertDescription>Your YouTube connection has expired.</AlertDescription>
                  <Button onClick={handleReconnectYouTube} variant="link" className="text-destructive dark:text-red-400 mt-1">
                    Reconnect YouTube Account
                  </Button>
                </Alert>
              )}
              {!youtubeAccount && !isTokenExpired && (
                <Alert variant="default" className="mb-4 text-center">
                  <AlertDescription>Connect your YouTube account to submit content.</AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1">Connect YouTube in Settings</Button>
                  </Link>
                </Alert>
              )}

              {youtubeAccount && !isTokenExpired && (
                <Tabs defaultValue="youtube-library" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-12 sm:h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm">
                    <TabsTrigger
                      value="youtube-library"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Your Videos & Shorts</span>
                      <span className="sm:hidden">Library</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="youtube-link"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">YouTube Link</span>
                      <span className="sm:hidden">Link</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="youtube-library" className="mt-4">
                    {isLoadingVideos ? (
                      <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading YouTube videos...</div>
                    ) : userVideos.length === 0 ? (
                      libraryMessage ? (
                        <Alert variant="default" className="text-center">
                          <AlertDescription>{libraryMessage}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="text-center py-4">
                          <p>No videos found in your YouTube channel.</p>
                          <Button variant="outline" onClick={() => fetchYouTubeVideos()} className="mt-2" disabled={isLoadingVideos}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingVideos ? 'animate-spin' : ''}`} /> Reload Videos
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
                              onClick={() => setYoutubeCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={youtubeCurrentPage === 1 || isLoadingVideos}
                            >
                              ← Previous
                            </Button>
                            <span className="text-sm sm:text-base font-medium text-foreground bg-background px-3 sm:px-4 py-2 rounded-md border shadow-sm">
                              Page {youtubeCurrentPage} of {totalYoutubePages > 0 ? totalYoutubePages : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() => setYoutubeCurrentPage(prev => Math.min(totalYoutubePages, prev + 1))}
                              disabled={youtubeCurrentPage === totalYoutubePages || totalYoutubePages === 0 || isLoadingVideos}
                            >
                              Next →
                            </Button>
                          </div>
                        )}
                        <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 px-2 pb-4">
                          {paginatedUserVideos.map((video, index) => (
                            <Card
                              key={video.id.videoId}
                              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] max-w-4xl mx-auto ${index === 0 ? 'mt-4' : ''} ${index === paginatedUserVideos.length - 1 ? 'mb-4' : ''} ${selectedVideo?.id.videoId === video.id.videoId
                                ? "border-4 border-blue-600 ring-8 ring-blue-600/40 bg-blue-600/10 shadow-2xl shadow-blue-600/40 scale-[1.02] transform dark:border-blue-400 dark:ring-blue-400/40 dark:bg-blue-400/10 dark:shadow-blue-400/40"
                                : "border-2 border-border hover:border-primary/60 hover:shadow-md"
                                }`}
                              onClick={() => {
                                setSelectedVideo(video);
                                setSelectedReel(null); setInstagramMediaPreview(null); setInstagramLink("");
                                setSubmissionType('youtube');
                                setContentLink(`https://www.youtube.com/watch?v=${video.id.videoId}`);
                                setVideoPreview(null); // Clear manual link preview
                              }}
                            >
                              <CardContent className="p-4 sm:p-6 relative">
                                {selectedVideo?.id.videoId === video.id.videoId && (
                                  <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-in zoom-in-95 duration-200">
                                    <Check className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                  {/* Thumbnail */}
                                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                                    <Image
                                      src={video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url}
                                      alt={video.snippet.title}
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
                                        className="font-medium text-sm leading-5 text-center sm:text-left line-clamp-2"
                                        title={video.snippet.title}
                                      >
                                        {video.snippet.title}
                                      </h3>
                                      <a
                                        href={`https://www.youtube.com/watch?v=${video.id.videoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start text-xs text-red-600 hover:text-red-800 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open on YouTube
                                      </a>
                                    </div>

                                    {/* Date */}
                                    <p className="text-xs text-muted-foreground text-center sm:text-left">
                                      Published: {dayjs(video.snippet.publishedAt).format('MMM D, YYYY [at] h:mm A')}
                                    </p>

                                    {/* Statistics */}
                                    {video.statistics && (
                                      <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        {video.statistics.viewCount && (
                                          <div className="flex items-center">
                                            <span className="font-medium">👁️ {parseInt(video.statistics.viewCount.toString()).toLocaleString()}</span>
                                            <span className="ml-1">views</span>
                                          </div>
                                        )}
                                        {video.statistics.likeCount && (
                                          <div className="flex items-center">
                                            <span className="font-medium">👍 {parseInt(video.statistics.likeCount.toString()).toLocaleString()}</span>
                                            <span className="ml-1">likes</span>
                                          </div>
                                        )}
                                        {video.statistics.commentCount && (
                                          <div className="flex items-center">
                                            <span className="font-medium">💬 {parseInt(video.statistics.commentCount.toString()).toLocaleString()}</span>
                                            <span className="ml-1">comments</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="youtube-link" className="mt-4">
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 p-4 bg-muted/30 rounded-lg border">
                      <Input
                        type="text"
                        placeholder="Enter YouTube video URL"
                        value={contentLink}
                        onChange={(e) => setContentLink(e.target.value)}
                        className="flex-1 text-base font-medium border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                      <Button
                        onClick={handleFetchVideo}
                        disabled={isFetchingVideo || isLoadingVideos}
                        size="default"
                        className="px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
                      >
                        {isFetchingVideo ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                        Fetch Video
                      </Button>
                    </div>
                    {videoPreview && (
                      <Card
                        className={`mt-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] max-w-4xl mx-auto ${selectedVideo?.id.videoId === videoPreview.id.videoId
                          ? "border-4 border-blue-600 ring-8 ring-blue-600/40 bg-blue-600/10 shadow-2xl shadow-blue-600/40 scale-[1.02] transform dark:border-blue-400 dark:ring-blue-400/40 dark:bg-blue-400/10 dark:shadow-blue-400/40"
                          : "border-2 border-border hover:border-primary/60 hover:shadow-md"
                          }`}
                        onClick={() => {
                          setSelectedVideo(videoPreview);
                          setSelectedReel(null); setInstagramMediaPreview(null); setInstagramLink("");
                          setSubmissionType('youtube');
                          setContentLink(`https://www.youtube.com/watch?v=${videoPreview.id.videoId}`);
                          // Keep videoPreview to show the card remains visible when selected
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="text-base">Video Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 relative">
                          {selectedVideo?.id.videoId === videoPreview.id.videoId && (
                            <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-in zoom-in-95 duration-200">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 mx-auto sm:mx-0">
                              <Image
                                src={videoPreview.snippet.thumbnails.medium?.url || videoPreview.snippet.thumbnails.default.url}
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
                                  className="font-medium text-sm leading-5 text-center sm:text-left line-clamp-2"
                                  title={videoPreview.snippet.title}
                                >
                                  {videoPreview.snippet.title}
                                </h3>
                                <a
                                  href={`https://www.youtube.com/watch?v=${videoPreview.id.videoId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center sm:justify-start text-xs text-red-600 hover:text-red-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Open on YouTube
                                </a>
                              </div>

                              {/* Date */}
                              <p className="text-xs text-muted-foreground text-center sm:text-left">
                                Published: {dayjs(videoPreview.snippet.publishedAt).format('MMM D, YYYY [at] h:mm A')}
                              </p>

                              {/* Statistics */}
                              {videoPreview.statistics && (
                                <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {videoPreview.statistics.viewCount && (
                                    <div className="flex items-center">
                                      <span className="font-medium">👁️ {parseInt(videoPreview.statistics.viewCount.toString()).toLocaleString()}</span>
                                      <span className="ml-1">views</span>
                                    </div>
                                  )}
                                  {videoPreview.statistics.likeCount && (
                                    <div className="flex items-center">
                                      <span className="font-medium">👍 {parseInt(videoPreview.statistics.likeCount.toString()).toLocaleString()}</span>
                                      <span className="ml-1">likes</span>
                                    </div>
                                  )}
                                  {videoPreview.statistics.commentCount && (
                                    <div className="flex items-center">
                                      <span className="font-medium">💬 {parseInt(videoPreview.statistics.commentCount.toString()).toLocaleString()}</span>
                                      <span className="ml-1">comments</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

          {/* INSTAGRAM UI BLOCK */}
          {contestPlatform === 'instagram' && (
            <>
              {isInstagramTokenExpired && (
                <Alert variant="destructive" className="mb-4 text-center">
                  <AlertDescription>Your Instagram connection has expired.</AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="text-destructive dark:text-red-400 mt-1">
                      Reconnect Instagram Account
                    </Button>
                  </Link>
                </Alert>
              )}
              {!instagramAccount && !isInstagramTokenExpired && (
                <Alert variant="default" className="mb-4 text-center">
                  <AlertDescription>Connect your Instagram account to submit content.</AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1">Connect Instagram in Settings</Button>
                  </Link>
                </Alert>
              )}

              {instagramAccount && !isInstagramTokenExpired && (
                <Tabs defaultValue="instagram-library" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-12 sm:h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm">
                    <TabsTrigger
                      value="instagram-library"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Your Reels & Videos</span>
                      <span className="sm:hidden">Library</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="instagram-link"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300 text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">Instagram Link</span>
                      <span className="sm:hidden">Link</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="instagram-library" className="mt-4">
                    {isLoadingReels ? (
                      <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading Instagram Reels...</div>
                    ) : userReels.length === 0 ? (
                      libraryMessage ? (
                        <Alert variant="default" className="text-center">
                          <AlertDescription>{libraryMessage}</AlertDescription>
                        </Alert>
                      ) : (
                        <div className="text-center py-4">
                          <p>No Reels or Videos found on your Instagram account.</p>
                          <Button variant="outline" onClick={() => fetchInstagramReels(instagramAccount.access_token, currentInstagramBusinessAccountID || "")} className="mt-2" disabled={isLoadingReels}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingReels ? 'animate-spin' : ''}`} /> Reload Reels
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
                              onClick={() => setInstagramCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={instagramCurrentPage === 1 || isLoadingReels}
                            >
                              ← Previous
                            </Button>
                            <span className="text-sm sm:text-base font-medium text-foreground bg-background px-3 sm:px-4 py-2 rounded-md border shadow-sm">
                              Page {instagramCurrentPage} of {totalInstagramPages > 0 ? totalInstagramPages : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="default"
                              className="w-full sm:w-auto px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                              onClick={() => setInstagramCurrentPage(prev => Math.min(totalInstagramPages, prev + 1))}
                              disabled={instagramCurrentPage === totalInstagramPages || totalInstagramPages === 0 || isLoadingReels}
                            >
                              Next →
                            </Button>
                          </div>
                        )}
                        <div className="space-y-4 max-h-96 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 px-2 pb-4">
                          {paginatedUserReels.map((reel, index) => (
                            <Card
                              key={reel.id}
                              className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] max-w-4xl mx-auto ${index === 0 ? 'mt-4' : ''} ${index === paginatedUserReels.length - 1 ? 'mb-4' : ''} ${selectedReel?.id === reel.id
                                ? "border-4 border-blue-600 ring-8 ring-blue-600/40 bg-blue-600/10 shadow-2xl shadow-blue-600/40 scale-[1.02] transform dark:border-blue-400 dark:ring-blue-400/40 dark:bg-blue-400/10 dark:shadow-blue-400/40"
                                : "border-2 border-border hover:border-primary/60 hover:shadow-md"
                                }`}
                              onClick={() => {
                                setSelectedReel(reel);
                                setSelectedVideo(null); setVideoPreview(null); setContentLink("");
                                setSubmissionType('instagram');
                                setInstagramLink(reel.permalink);
                                setInstagramMediaPreview(null); // Clear manual link preview
                              }}
                            >
                              <CardContent className="p-4 sm:p-6 relative">
                                {selectedReel?.id === reel.id && (
                                  <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-in zoom-in-95 duration-200">
                                    <Check className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                                  {/* Thumbnail */}
                                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                                    {reel.thumbnail_url ? (
                                      <Image
                                        src={reel.thumbnail_url}
                                        alt={reel.caption || "Instagram media"}
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
                                  <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                                    {/* Caption/Title */}
                                    <div className="space-y-1">
                                      <h3
                                        className="font-medium text-sm leading-5 text-center sm:text-left line-clamp-3"
                                        title={reel.caption || "Instagram media"}
                                      >
                                        {reel.caption || "No caption available"}
                                      </h3>
                                      <a
                                        href={reel.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center sm:justify-start text-xs text-pink-600 hover:text-pink-800 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Open on Instagram
                                      </a>
                                    </div>

                                    {/* Date and Type */}
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground text-center sm:text-left">
                                        Posted: {dayjs(reel.timestamp).format('MMM D, YYYY [at] h:mm A')}
                                      </p>
                                      <div className="flex justify-center sm:justify-start">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                                          🎬 {reel.media_type === 'REEL' ? 'Instagram Reel' : 'Video'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>
                  <TabsContent value="instagram-link" className="mt-4">
                    <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 p-4 bg-muted/30 rounded-lg border">
                      <Input
                        type="text"
                        placeholder="Enter Instagram media URL"
                        value={instagramLink}
                        onChange={(e) => setInstagramLink(e.target.value)}
                        className="flex-1 text-base font-medium border-2 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                      <Button
                        onClick={handleFetchInstagramByLink}
                        disabled={isFetchingInstagramMedia || isLoadingReels}
                        size="default"
                        className="px-4 sm:px-6 py-2 font-medium text-sm sm:text-base hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-sm hover:shadow-md w-full sm:w-auto"
                      >
                        {isFetchingInstagramMedia ? <RefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                        Fetch Media
                      </Button>
                    </div>
                    {instagramMediaPreview && (
                      <Card
                        className={`mt-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] max-w-4xl mx-auto ${selectedReel?.id === instagramMediaPreview.id
                          ? "border-4 border-blue-600 ring-8 ring-blue-600/40 bg-blue-600/10 shadow-2xl shadow-blue-600/40 scale-[1.02] transform dark:border-blue-400 dark:ring-blue-400/40 dark:bg-blue-400/10 dark:shadow-blue-400/40"
                          : "border-2 border-border hover:border-primary/60 hover:shadow-md"
                          }`}
                        onClick={() => {
                          setSelectedReel(instagramMediaPreview);
                          setSelectedVideo(null); setVideoPreview(null); setContentLink("");
                          setSubmissionType('instagram');
                          setInstagramLink(instagramMediaPreview.permalink);
                          // Keep instagramMediaPreview to show the card remains visible when selected
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="text-base">Media Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 relative">
                          {selectedReel?.id === instagramMediaPreview.id && (
                            <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-lg animate-in zoom-in-95 duration-200">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 lg:space-x-6">
                            {/* Thumbnail */}
                            <div className="flex-shrink-0 mx-auto sm:mx-0">
                              {instagramMediaPreview.thumbnail_url ? (
                                <Image
                                  src={instagramMediaPreview.thumbnail_url}
                                  alt={instagramMediaPreview.caption || "Instagram media"}
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
                            <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                              {/* Caption/Title */}
                              <div className="space-y-1">
                                <h3
                                  className="font-medium text-sm leading-5 text-center sm:text-left line-clamp-3"
                                  title={instagramMediaPreview.caption || "Instagram media"}
                                >
                                  {instagramMediaPreview.caption || "No caption available"}
                                </h3>
                                <a
                                  href={instagramMediaPreview.permalink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center sm:justify-start text-xs text-pink-600 hover:text-pink-800 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Open on Instagram
                                </a>
                              </div>

                              {/* Date and Type */}
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground text-center sm:text-left">
                                  Posted: {dayjs(instagramMediaPreview.timestamp).format('MMM D, YYYY [at] h:mm A')}
                                </p>
                                <div className="flex justify-center sm:justify-start">
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200">
                                    🎬 {instagramMediaPreview.media_type === 'REEL' ? 'Instagram Reel' : 'Video'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
