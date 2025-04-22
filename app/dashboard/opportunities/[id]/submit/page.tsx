"use client"

import type React from "react"
import { use } from 'react';

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export default function SubmitContentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contestId = resolvedParams.id;

  const [contentLink, setContentLink] = useState("")
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null)
  const [youtubeAccount, setYoutubeAccount] = useState<any>(null)
  const [userVideos, setUserVideos] = useState<YouTubeVideo[]>([])
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createSupabaseClient()

  // Check if user has connected YouTube account
  useEffect(() => {
    async function checkYouTubeConnection() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("creator_youtube_accounts")
          .select("*")
          .eq("creator_id", user.id)
          .single();

        setYoutubeAccount(data);

        if (data) {
          fetchYouTubeVideos();
        }
      } catch (err) {
        console.error("Error fetching YouTube account:", err);
      }
    }

    checkYouTubeConnection();
  }, [user, supabase]);

  // Fetch videos using the server API endpoint
  const fetchYouTubeVideos = async () => {
    setIsLoadingVideos(true);
    setError(null);

    try {
      const response = await fetch('/api/youtube/videos');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load videos');
      }

      setUserVideos(data.videos || []);
    } catch (err: any) {
      console.error("Error fetching YouTube videos:", err);
      setError(err.message || "Failed to load your YouTube videos. Please try again.");
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Validate YouTube URL belongs to user using server endpoint
  const validateYoutubeUrl = async (url: string) => {
    try {
      const response = await fetch('/api/youtube/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify video');
      }

      if (data.valid && data.videoInfo) {
        // If valid, update the selected video
        setSelectedVideo(data.videoInfo as YouTubeVideo);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error validating YouTube URL:', err);
      return false;
    }
  };

  useEffect(() => {
    // Update all instances of params.id to contestId in the useEffect

    async function fetchData() {
      // ... existing code ...

      // First check if user has already submitted
      if (user) {
        const { data: existingSubmission } = await supabase
          .from("submissions")
          .select("*")
          .eq("contest_id", contestId)
          .eq("creator_id", user.id)
          .single();
      }

      // ... existing code ...

      // Get contest details
      const { data: contestData, error: contestError } = await supabase
        .from("contests")
        .select("*")
        .eq("id", contestId)
        .single();

      // ... rest of existing code ...
    }

    fetchData();
  }, [contestId, user, router, supabase]);

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
          videoThumbnail = (selectedVideo as YouTubeVideo).snippet.thumbnails.default.url;
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
          status: "pending",
        })
        .select();

      if (submitError) throw submitError;

      router.push(`/dashboard/opportunities/${contestId}`);
    } catch (err: any) {
      setError(err.message || "Failed to submit content");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/opportunities/${contestId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Submit Content</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Content Submission</CardTitle>
          <CardDescription>
            Submit your YouTube content for this contest. Make sure your content follows the contest guidelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!youtubeAccount ? (
            <div className="text-center py-8">
              <h3 className="text-lg font-medium mb-4">Connect Your YouTube Account</h3>
              <p className="text-muted-foreground mb-6">
                To submit content, you need to connect your YouTube account first.
              </p>
              <Button asChild>
                <a href="/api/youtube/auth">Connect YouTube Account</a>
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
                    <div className="text-center py-4">Loading your videos...</div>
                  ) : userVideos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {userVideos.map((video) => (
                        <div
                          key={video.id.videoId}
                          className={`border rounded-md p-2 cursor-pointer ${selectedVideo?.id.videoId === video.id.videoId ? 'border-primary ring-2 ring-primary/20' : ''}`}
                          onClick={() => {
                            setSelectedVideo(video);
                            setContentLink(`https://www.youtube.com/watch?v=${video.id.videoId}`);
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
                          <p className="font-medium truncate">{video.snippet.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(video.snippet.publishedAt).toLocaleDateString()}
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
                      <Input
                        id="content-link"
                        value={contentLink}
                        onChange={(e) => {
                          setContentLink(e.target.value);
                          setSelectedVideo(null);
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter the URL of your YouTube video
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Submitting..." : "Submit Content"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

