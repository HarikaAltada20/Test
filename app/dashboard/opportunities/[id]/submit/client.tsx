"use client";

import type React from "react";
import { use } from "react";

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
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { UserResponse } from "@supabase/supabase-js";

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
}

// Helper function to extract YouTube ID (client-side only)
function extractYoutubeId(url: string) {
  const regex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [isFetchingVideo, setIsFetchingVideo] = useState(false);
  const [videoPreview, setVideoPreview] = useState<YouTubeVideo | null>(null);

  // Check if user has connected YouTube account
  useEffect(() => {
    async function checkYouTubeConnection() {
      if (!user) return;

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
  }, [user, supabase]);

  // Fetch videos using the server API endpoint
  const fetchYouTubeVideos = async () => {
    setIsLoadingVideos(true);
    setError(null);

    try {
      const response = await fetch("/api/youtube/videos");
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setIsTokenExpired(true);
          setError(
            "Your YouTube connection has expired. Please re-connect your YouTube account."
          );
        } else {
          throw new Error(data.error || "Failed to load videos");
        }
        return;
      }

      setUserVideos(data.videos || []);
    } catch (err: any) {
      console.error("Error fetching YouTube videos:", err);
      setError(
        err.message || "Failed to load your YouTube videos. Please try again."
      );
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Handle YouTube reconnection
  const handleReconnectYouTube = () => {
    router.push(
      "/api/youtube/auth?returnTo=" +
        encodeURIComponent(`/dashboard/opportunities/${contestId}/submit`)
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
      if (!user) return;

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
        .select("*")
        .eq("id", contestId)
        .single();

      if (contestError || !contestData) {
        console.error("Error fetching contest:", contestError);
        redirect("/dashboard/opportunities");
      }
    }

    fetchData();
  }, [contestId, user, router, supabase]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!user) {
      setError("You must be logged in to submit content");
      setIsLoading(false);
      return;
    }

    if (!youtubeAccount) {
      setError("Please connect your YouTube account first");
      setIsLoading(false);
      return;
    }

    try {
      let videoId: string | null = null;
      let videoTitle: string | undefined = undefined;
      let videoThumbnail: string | undefined = undefined;

      if (selectedVideo) {
        // Using selected video from library
        videoId = selectedVideo.id.videoId;
        videoTitle = selectedVideo.snippet.title;
        videoThumbnail = selectedVideo.snippet.thumbnails.default.url;
      } else if (contentLink) {
        // Using manually entered URL
        videoId = extractYoutubeId(contentLink);
        if (!videoId) {
          setError("Invalid YouTube URL");
          setIsLoading(false);
          return;
        }

        // Validate the URL belongs to the user
        const isValid = await validateYoutubeUrl(contentLink);
        if (!isValid) {
          setError("This video does not belong to your YouTube channel");
          setIsLoading(false);
          return;
        }

        // If we get here and selectedVideo is set by validateYoutubeUrl
        if (selectedVideo) {
          videoTitle = (selectedVideo as YouTubeVideo).snippet.title;
          videoThumbnail = (selectedVideo as YouTubeVideo).snippet.thumbnails
            .default.url;
        }
      } else {
        setError("Please select a video or enter a YouTube URL");
        setIsLoading(false);
        return;
      }

      const { data, error: submitError } = await supabase
        .from("submissions")
        .insert({
          contest_id: contestId,
          creator_id: user.id,
          content_link: `https://www.youtube.com/watch?v=${videoId}`,
          video_id: videoId,
          video_title: videoTitle,
          video_thumbnail_url: videoThumbnail,
          description: selectedVideo?.snippet.description || "",
          views: 0, // Initialize with 0 views
          other_stats: {
            publishedAt: selectedVideo?.snippet.publishedAt,
            thumbnails: selectedVideo?.snippet.thumbnails,
          },
          status: "pending",
          earnings: 0, // Initialize with 0 earnings
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      if (submitError) {
        console.error("Submission error details:", submitError);
        throw new Error(submitError.message || "Failed to submit video");
      }

      if (!data) {
        throw new Error("No data returned from submission");
      }

      router.push(`/dashboard/opportunities/${contestId}`);
    } catch (err: any) {
      setError(err.message || "Failed to submit content");
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-2xl font-bold">Submit Content</h1>
      </div>

      {isTokenExpired ? (
        <Card>
          <CardHeader>
            <CardTitle>YouTube Connection Expired</CardTitle>
            <CardDescription>
              Your YouTube connection has expired. Please re-connect your
              YouTube account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleReconnectYouTube} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-connect YouTube Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Content Submission</CardTitle>
            <CardDescription>
              Submit your YouTube content for this contest. Make sure your
              content follows the contest guidelines.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!youtubeAccount ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium mb-4">
                  Connect Your YouTube Account
                </h3>
                <p className="text-muted-foreground mb-6">
                  To submit content, you need to connect your YouTube account
                  first. This allows us to verify your videos and track their
                  performance.
                </p>
                <Button asChild>
                  <Link
                    href={`/api/youtube/auth?returnTo=${encodeURIComponent(
                      `/dashboard/opportunities/${contestId}/submit`
                    )}`}
                  >
                    Connect YouTube Account
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="browse" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="browse">Browse Your Videos</TabsTrigger>
                    <TabsTrigger value="link">Enter Video URL</TabsTrigger>
                  </TabsList>

                  <TabsContent value="browse">
                    {isLoadingVideos ? (
                      <div className="text-center py-4">
                        Loading your videos...
                      </div>
                    ) : userVideos.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        {userVideos.map((video) => (
                          <div
                            key={video.id.videoId}
                            className={`border rounded-md p-2 cursor-pointer ${
                              selectedVideo?.id.videoId === video.id.videoId
                                ? "border-primary ring-2 ring-primary/20"
                                : ""
                            }`}
                            onClick={() => {
                              setSelectedVideo(video);
                              setContentLink(
                                `https://www.youtube.com/watch?v=${video.id.videoId}`
                              );
                            }}
                          >
                            <div className="aspect-video relative mb-2 bg-gray-100">
                              {video.snippet.thumbnails?.medium && (
                                <Image
                                  src={video.snippet.thumbnails.medium.url}
                                  alt={video.snippet.title}
                                  fill
                                  className="object-cover rounded"
                                />
                              )}
                            </div>
                            <p className="font-medium truncate">
                              {video.snippet.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                video.snippet.publishedAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 mb-6">
                        <p>No videos found in your YouTube channel.</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="link">
                    <div className="space-y-4 mb-6">
                      <div>
                        <Label htmlFor="content-link">YouTube Video URL</Label>
                        <div className="flex gap-2">
                          <Input
                            id="content-link"
                            value={contentLink}
                            onChange={(e) => {
                              setContentLink(e.target.value);
                              setSelectedVideo(null);
                              setVideoPreview(null);
                            }}
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleFetchVideo}
                            disabled={isFetchingVideo || !contentLink}
                          >
                            {isFetchingVideo ? "Fetching..." : "Fetch Video"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the URL of your YouTube video
                        </p>
                      </div>

                      {videoPreview && (
                        <div className="mt-4 border rounded-lg p-4">
                          <h3 className="font-medium mb-2">Video Preview</h3>
                          <div className="flex gap-4">
                            <div className="w-48 aspect-video relative bg-gray-100 rounded-md overflow-hidden">
                              {videoPreview.snippet.thumbnails?.medium && (
                                <Image
                                  src={
                                    videoPreview.snippet.thumbnails.medium.url
                                  }
                                  alt={videoPreview.snippet.title}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">
                                {videoPreview.snippet.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                Published:{" "}
                                {new Date(
                                  videoPreview.snippet.publishedAt
                                ).toLocaleDateString()}
                              </p>
                              <p className="text-sm mt-2 line-clamp-2">
                                {videoPreview.snippet.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isLoading || (!selectedVideo && !videoPreview)}
                  >
                    {isLoading ? "Submitting..." : "Submit Content"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
