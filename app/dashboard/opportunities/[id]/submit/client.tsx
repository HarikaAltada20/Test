"use client";

import type React from "react";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, RefreshCw, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";
import dayjs from 'dayjs';

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
  const [youtubeNextPageToken, setYoutubeNextPageToken] = useState<string | undefined>(undefined);
  const [youtubePrevPageToken, setYoutubePrevPageToken] = useState<string | undefined>(undefined);
  const [youtubeTotalResults, setYoutubeTotalResults] = useState(0);

  const [instagramCurrentPage, setInstagramCurrentPage] = useState(1);
  // Instagram pagination will remain client-side for now, as per current scope
  // If IG also needs server-side, similar token states would be added for instagram

  const [error, setError] = useState<string | null>(null);
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

    try {
      // Reverted: No longer sending pagination query parameters
      const response = await fetch(`/api/youtube/videos`);
      const data = await response.json(); // Expects { videos: [...] }

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

      setUserVideos(data.videos || []);
      setYoutubeCurrentPage(1); // Reset to first page on new data load
      // Removed setting of page tokens and totalResults from API response

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

  // Validate YouTube URL belongs to user using server endpoint
  const validateYoutubeUrl = async (url: string) => {
    try {
      const response = await fetch("/api/youtube/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify video");
      }

      if (data.valid && data.videoInfo) {
        // If valid, update the selected video
        setSelectedVideo(data.videoInfo as YouTubeVideo);
        return true;
      }

      return false;
    } catch (err) {
      console.error("Error validating YouTube URL:", err);
      return false;
    }
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
        .select("platform") // Only select platform, or '*' if other contest details are needed here
        .eq("id", contestId)
        .single();

      if (contestError || !contestData) {
        console.error("Error fetching contest:", contestError);
        setError("Failed to load contest details. The contest might not exist or an error occurred.");
        setContestPlatform(null);
        setIsLoadingContest(false);
        // Optionally redirect, or let the UI handle the error state
        // redirect("/dashboard/opportunities"); 
        return;
      }

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
      setError("Please enter a YouTube URL");
      return;
    }

    setIsFetchingVideo(true);
    setError(null);

    try {
      const videoId = extractYoutubeId(contentLink);
      if (!videoId) {
        setError("Invalid YouTube URL");
        return;
      }

      // Validate and fetch video details
      const response = await fetch("/api/youtube/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrl: contentLink }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify video");
      }

      if (data.valid && data.videoInfo) {
        setVideoPreview(data.videoInfo);
        setSelectedVideo(data.videoInfo);
        setSelectedReel(null);
        setSubmissionType('youtube');
      } else {
        throw new Error("This video does not belong to your YouTube channel");
      }
    } catch (err: any) {
      console.error("Error fetching video:", err);
      setError(err.message || "Failed to fetch video details");
      setVideoPreview(null);
      setSelectedVideo(null);
    } finally {
      setIsFetchingVideo(false);
    }
  };

  const handleFetchInstagramByLink = async () => {
    if (!instagramLink) {
      setError("Please enter an Instagram media URL.");
      return;
    }
    if (!instagramAccount?.access_token || !instagramAccount?.app_scoped_user_id) {
      setError("Instagram account not connected, token missing, or user ID missing.");
      return;
    }

    setIsFetchingInstagramMedia(true);
    setError(null);
    setInstagramMediaPreview(null);
    setSelectedReel(null); // Clear selection from library

    console.log("instagramAccount.access_token", instagramAccount.access_token);
    try {
      const response = await fetch("/api/instagram/verify-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUrl: instagramLink,
          userAccessToken: instagramAccount.access_token,
          userAppScopedId: instagramAccount.app_scoped_user_id
        }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to fetch or verify Instagram media.");

      if (data.valid && data.mediaInfo) {
        const reelData = data.mediaInfo as InstagramReel; // Assuming mediaInfo matches InstagramReel structure
        setInstagramMediaPreview(reelData);
        setSelectedReel(reelData); // Also set the main selectedReel

        // Clear YouTube selections
        setSelectedVideo(null);
        setContentLink("");
        setVideoPreview(null);
        setSubmissionType('instagram');
      } else {
        throw new Error(data.error || "This media does not belong to your connected Instagram account, is not a Reel/Video, or is invalid.");
      }
    } catch (err: any) {
      console.error("Error fetching Instagram media by link:", err);
      setError(err.message);
    } finally {
      setIsFetchingInstagramMedia(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsLoading(true);
    setMessage(null); // Clear previous messages

    if (!user) {
      setError("You must be logged in to submit content");
      setIsLoading(false);
      return;
    }

    try {
      let submissionPayload: any = {
        contest_id: contestId,
        creator_id: user.id,
        status: "pending",
      };

      if (contestPlatform === 'instagram' && selectedReel && instagramAccount?.access_token && currentInstagramBusinessAccountID) {
        setMessage("Fetching Instagram Reel insights...");
        const insightsRes = await fetch(
          `https://graph.instagram.com/${currentInstagramBusinessAccountID}/${selectedReel.id}/insights?metric=reach,likes,comments,shares,saved,video_views,total_interactions&access_token=${instagramAccount.access_token}`
        );
        const insightsData = await insightsRes.json();

        if (!insightsRes.ok || insightsData.error) {
          console.warn("Failed to fetch Instagram insights, submitting with potentially partial/zero stats:", insightsData.error?.message);
        }

        let views = 0;
        const instagramStats: any = {};
        if (insightsData?.data) {
          insightsData.data.forEach((metric: { name: string; values: { value: number }[] }) => {
            const value = metric.values[0]?.value || 0;
            if (metric.name === "reach") {
              views = value;
              instagramStats.reach = views;
            }
            if (metric.name === "likes") instagramStats.likes = value;
            if (metric.name === "comments") instagramStats.comments = value;
            if (metric.name === "shares") instagramStats.shares = value;
            if (metric.name === "saved") instagramStats.saved = value;
            if (metric.name === "video_views" || metric.name === "plays") instagramStats.video_views = value;
            if (metric.name === "total_interactions") instagramStats.total_interactions = value;
          });
        }

        submissionPayload = {
          ...submissionPayload,
          platform: 'instagram',
          views: views,
          content_link: selectedReel.permalink,
          video_id: selectedReel.id,
          video_title: selectedReel.caption || "Instagram Content", // Generic
          video_thumbnail_url: selectedReel.thumbnail_url,
          other_stats: { instagram: instagramStats },
        };

      } else if (contestPlatform === 'youtube' && (selectedVideo || videoPreview)) {
        // YouTube Video Submission
        const videoToSubmit = selectedVideo || videoPreview; // Prioritize actively selected library video

        if (!videoToSubmit) {
          setError("No YouTube video selected or fetched for submission.");
          setIsLoading(false);
          return;
        }

        setMessage("Fetching YouTube video insights...");

        // Fetch YouTube video stats (views, likes, etc.) via API endpoint
        // This part reuses your existing logic for /api/youtube/metrics or similar
        const metricsResponse = await fetch(`/api/youtube/metrics?videoId=${videoToSubmit.id.videoId}`);
        const metricsData = await metricsResponse.json();

        if (!metricsResponse.ok) {
          console.warn("Failed to fetch YouTube metrics, submitting with basic info.", metricsData.error);
          // Proceed with submission using basic info, or handle error more strictly
        }

        const youtubeStats = {
          likes: metricsData?.statistics?.likeCount,
          comments: metricsData?.statistics?.commentCount,
          // Add any other YouTube specific stats you want in other_stats.youtube
        };

        submissionPayload = {
          ...submissionPayload,
          platform: 'youtube',
          views: metricsData?.statistics?.viewCount || 0, // Ensure this is a number
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


      const fetchedReels: InstagramReel[] = [];
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
          fetchedReels.push({
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
      console.log(`[fetchInstagramReels] Filtered down to ${fetchedReels.length} reels.`);

      setUserReels(fetchedReels.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf()));

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
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/dashboard/opportunities/${contestId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Submit Content for {contestPlatform === 'youtube' ? 'YouTube' : 'Instagram'} Contest</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Content Submission</CardTitle>
          <CardDescription>
            Submit your {contestPlatform === 'youtube' ? 'YouTube video/short' : 'Instagram Reel/video'} for this contest.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
          <div className="flex justify-end space-x-2 mb-6">
            <Button variant="outline" onClick={() => router.back()}>
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
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="youtube-library">Your Videos & Shorts</TabsTrigger>
                    <TabsTrigger value="youtube-link">YouTube Link</TabsTrigger>
                  </TabsList>
                  <TabsContent value="youtube-library" className="mt-4">
                    {isLoadingVideos ? (
                      <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading YouTube videos...</div>
                    ) : userVideos.length > 0 ? (
                      <>
                        {/* YouTube Pagination Controls */}
                        {totalYoutubePages > 1 && (
                          <div className="flex justify-between items-center mb-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setYoutubeCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={youtubeCurrentPage === 1 || isLoadingVideos}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {youtubeCurrentPage} of {totalYoutubePages > 0 ? totalYoutubePages : 1}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setYoutubeCurrentPage(prev => Math.min(totalYoutubePages, prev + 1))}
                              disabled={youtubeCurrentPage === totalYoutubePages || totalYoutubePages === 0 || isLoadingVideos}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {paginatedUserVideos.map((video) => (
                            <Card
                              key={video.id.videoId}
                              className={`cursor-pointer ${selectedVideo?.id.videoId === video.id.videoId ? "border-primary ring-2 ring-primary" : ""}`}
                              onClick={() => {
                                setSelectedVideo(video);
                                setSelectedReel(null); setInstagramMediaPreview(null); setInstagramLink("");
                                setSubmissionType('youtube');
                                setContentLink(`https://www.youtube.com/watch?v=${video.id.videoId}`);
                                setVideoPreview(null); // Clear manual link preview
                              }}
                            >
                              <CardContent className="p-3 flex items-start space-x-3">
                                <Image
                                  src={video.snippet.thumbnails.default.url}
                                  alt={video.snippet.title}
                                  width={120} // Adjusted for consistency
                                  height={68}  // Adjusted for consistency
                                  className="rounded-sm object-cover aspect-video"
                                />
                                <div className="flex-1">
                                  <a
                                    href={`https://www.youtube.com/watch?v=${video.id.videoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-sm truncate hover:underline flex items-center"
                                    title={video.snippet.title}
                                    onClick={(e) => e.stopPropagation()} // Prevent card click when link is clicked
                                  >
                                    {video.snippet.title}
                                    <ExternalLink className="h-3 w-3 ml-1.5 flex-shrink-0" />
                                  </a>
                                  <p className="text-xs text-muted-foreground">{new Date(video.snippet.publishedAt).toLocaleDateString()}</p>
                                  {/* Display additional video statistics */}
                                  {video.statistics && (
                                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                                      {video.statistics.viewCount && (
                                        <span>Views: {parseInt(video.statistics.viewCount).toLocaleString()}</span>
                                      )}
                                      {video.statistics.likeCount && (
                                        <span>Likes: {parseInt(video.statistics.likeCount).toLocaleString()}</span>
                                      )}
                                      {video.statistics.commentCount && (
                                        <span>Comments: {parseInt(video.statistics.commentCount).toLocaleString()}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p>No videos found in your YouTube channel.</p>
                        <Button variant="outline" onClick={() => fetchYouTubeVideos()} className="mt-2" disabled={isLoadingVideos}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingVideos ? 'animate-spin' : ''}`} /> Reload Videos
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="youtube-link" className="mt-4">
                    <div className="space-y-3">
                      <Label htmlFor="youtubeLink">YouTube Video URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="youtubeLink"
                          value={contentLink}
                          onChange={(e) => {
                            setContentLink(e.target.value);
                            setSelectedVideo(null); // Clear library selection
                            setVideoPreview(null);  // Clear existing preview
                            setSubmissionType(null);
                          }}
                          placeholder="https://www.youtube.com/watch?v=..."
                          disabled={isFetchingVideo}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleFetchVideo}
                          disabled={isFetchingVideo || !contentLink}
                        >
                          {isFetchingVideo ? <RefreshCw className="animate-spin mr-1 h-4 w-4" /> : null}
                          Fetch Video
                        </Button>
                      </div>
                      {videoPreview && (
                        <Card className="mt-3">
                          <CardHeader><CardTitle className="text-base">Video Preview</CardTitle></CardHeader>
                          <CardContent className="flex gap-3 items-start">
                            <Image src={videoPreview.snippet.thumbnails.default.url} alt={videoPreview.snippet.title} width={120} height={68} className="rounded-sm object-cover aspect-video" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={`https://www.youtube.com/watch?v=${videoPreview.id.videoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-sm truncate hover:underline flex items-center"
                                title={videoPreview.snippet.title}
                              >
                                {videoPreview.snippet.title}
                                <ExternalLink className="h-3 w-3 ml-1.5 flex-shrink-0" />
                              </a>
                              <p className="text-xs text-muted-foreground mt-1">Published: {new Date(videoPreview.snippet.publishedAt).toLocaleDateString()}</p>
                              {/* Display statistics for videoPreview */}
                              {videoPreview.statistics && (
                                <div className="text-xs text-muted-foreground mt-1 space-x-2">
                                  {videoPreview.statistics.viewCount && (
                                    <span>Views: {parseInt(videoPreview.statistics.viewCount).toLocaleString()}</span>
                                  )}
                                  {videoPreview.statistics.likeCount && (
                                    <span>Likes: {parseInt(videoPreview.statistics.likeCount).toLocaleString()}</span>
                                  )}
                                  {videoPreview.statistics.commentCount && (
                                    <span>Comments: {parseInt(videoPreview.statistics.commentCount).toLocaleString()}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
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
                    <Button variant="link" className="text-destructive dark:text-red-400 mt-1">Reconnect Instagram in Settings</Button>
                  </Link>
                </Alert>
              )}
              {!instagramAccount && !isInstagramTokenExpired && (
                <Alert variant="default" className="mb-4 text-center">
                  <AlertDescription>Connect your Instagram Business/Creator account.</AlertDescription>
                  <Link href="/dashboard/settings">
                    <Button variant="link" className="mt-1">Connect Instagram in Settings</Button>
                  </Link>
                </Alert>
              )}
              {instagramAccount && (instagramAccount.account_type !== 'BUSINESS' && instagramAccount.account_type !== 'MEDIA_CREATOR') && !isInstagramTokenExpired && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    Your connected Instagram account is a '{instagramAccount.account_type || 'Personal'}' account.
                    You need a Business or Creator account to submit Reels/Videos for contests.
                    Please update your account type on Instagram or connect a different account in settings.
                  </AlertDescription>
                </Alert>
              )}

              {instagramAccount && (instagramAccount.account_type === 'BUSINESS' || instagramAccount.account_type === 'MEDIA_CREATOR') && !isInstagramTokenExpired && (
                <Tabs defaultValue="instagram-library" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="instagram-library">Your Reels & Videos</TabsTrigger>
                    <TabsTrigger value="instagram-link">Instagram Link</TabsTrigger>
                  </TabsList>
                  <TabsContent value="instagram-library" className="mt-4">
                    {isLoadingReels ? (
                      <div className="text-center py-4"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading Instagram content...</div>
                    ) : userReels.length > 0 ? (
                      <>
                        {/* Instagram Pagination Controls */}
                        {totalInstagramPages > 1 && (
                          <div className="flex justify-between items-center mb-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInstagramCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={instagramCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {instagramCurrentPage} of {totalInstagramPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInstagramCurrentPage(prev => Math.min(totalInstagramPages, prev + 1))}
                              disabled={instagramCurrentPage === totalInstagramPages}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {paginatedUserReels.map((reel) => (
                            <Card
                              key={reel.id}
                              className={`cursor-pointer ${selectedReel?.id === reel.id && !instagramMediaPreview ? "border-primary ring-2 ring-primary" : ""}`}
                              onClick={() => {
                                setSelectedReel(reel);
                                setInstagramMediaPreview(null); // Clear link preview
                                setInstagramLink("");      // Clear link input
                                setSelectedVideo(null); setContentLink(""); setVideoPreview(null); // Clear YT
                                setSubmissionType('instagram');
                              }}
                            >
                              <CardContent className="p-3 flex items-start space-x-3">
                                {reel.thumbnail_url ? (
                                  <Image
                                    src={reel.thumbnail_url}
                                    alt={reel.caption || "Instagram media"}
                                    width={120}
                                    height={120} // Reels are often more square/portrait in previews
                                    className="rounded-sm object-cover aspect-square" // Changed aspect
                                  />
                                ) : (
                                  <div className="w-[120px] h-[120px] bg-muted rounded-sm flex items-center justify-center text-xs text-muted-foreground">No thumbnail</div>
                                )}
                                <div className="flex-1">
                                  <p className="font-medium text-sm truncate" title={reel.caption || "Instagram media"}>{reel.caption || "No caption"}</p>
                                  <p className="text-xs text-muted-foreground">{dayjs(reel.timestamp).format("MMM D, YYYY")}</p>
                                  <a href={reel.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1" onClick={(e) => e.stopPropagation()}>View on Instagram</a>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        {/* Instagram Pagination Controls (Bottom as well, optional) */}
                        {totalInstagramPages > 1 && (
                          <div className="flex justify-between items-center mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInstagramCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={instagramCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {instagramCurrentPage} of {totalInstagramPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInstagramCurrentPage(prev => Math.min(totalInstagramPages, prev + 1))}
                              disabled={instagramCurrentPage === totalInstagramPages}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p>No Reels or Videos found on your Instagram account. Or, try fetching again if you recently posted.</p>
                        <Button variant="outline" onClick={() => fetchInstagramReels(instagramAccount.access_token, currentInstagramBusinessAccountID!)} className="mt-2" disabled={isLoadingReels || !currentInstagramBusinessAccountID}>
                          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingReels ? 'animate-spin' : ''}`} /> Reload Instagram Content
                        </Button>
                        {/* Add a reminder for manual link submission for IG as well if desired */}
                        <p className="text-xs text-muted-foreground mt-2">Alternatively, you can always use the "Instagram Link" tab to submit a specific post by its URL.</p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="instagram-link" className="mt-4">
                    <div className="space-y-3">
                      <Label htmlFor="instagramLink">Instagram Media URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="instagramLink"
                          value={instagramLink}
                          onChange={(e) => {
                            setInstagramLink(e.target.value);
                            setSelectedReel(null); // Clear library selection
                            setInstagramMediaPreview(null); // Clear existing preview
                            setSubmissionType(null);
                          }}
                          placeholder="https://www.instagram.com/p/your_post_id/"
                          disabled={isFetchingInstagramMedia}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleFetchInstagramByLink}
                          disabled={isFetchingInstagramMedia || !instagramLink}
                        >
                          {isFetchingInstagramMedia ? <RefreshCw className="animate-spin mr-1 h-4 w-4" /> : null}
                          Fetch Media
                        </Button>
                      </div>
                      {instagramMediaPreview && (
                        <Card className="mt-3">
                          <CardHeader><CardTitle className="text-base">Media Preview</CardTitle></CardHeader>
                          <CardContent className="flex gap-3 items-start">
                            {instagramMediaPreview.thumbnail_url ? (
                              <Image src={instagramMediaPreview.thumbnail_url} alt={instagramMediaPreview.caption || "Instagram Media"} width={120} height={120} className="rounded-sm object-cover aspect-square" />
                            ) : (
                              <div className="w-[120px] h-[120px] bg-muted rounded-sm flex items-center justify-center text-xs text-muted-foreground">No thumbnail</div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium text-sm truncate" title={instagramMediaPreview.caption || undefined}>{instagramMediaPreview.caption || "No Caption"}</h4>
                              <p className="text-xs text-muted-foreground mt-1">Published: {dayjs(instagramMediaPreview.timestamp).format("MMM D, YYYY")}</p>
                              <a href={instagramMediaPreview.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1">View on Instagram</a>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}

        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          {/* Buttons moved to CardContent above the tabs */}
        </CardFooter>
      </Card>
    </div>
  );
}
