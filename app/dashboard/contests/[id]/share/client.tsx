"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { UserResponse } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Badge,
  Check,
  Copy,
  Facebook,
  Linkedin,
  Share2,
  Twitter,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ContestData = {
  id: string;
  title: string;
  brief: string | null;
  brief_html?: string | null;
  thumbnail_url: string | null;
  moderation_status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected';
  status: "upcoming" | "active" | "ended" | "incomplete" | "unknown";
};

export default function ShareContestPage({
  user,
  contestId,
}: {
  user: UserResponse["data"]["user"] | null;
  contestId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contest, setContest] = useState<ContestData | null>(null);
  const [copied, setCopied] = useState(false);

  // Public contest URL for sharing
  const contestPublicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/contests/${contestId}`
      : `/contests/${contestId}`;

  // Embed code for contest widget
  const embedCode = `<iframe src="${contestPublicUrl}/embed" width="100%" height="400" frameborder="0"></iframe>`;

  // Fetch contest data
  useEffect(() => {
    async function fetchContest() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("contests_with_status")
          .select("id, title, brief, brief_html, thumbnail_url, moderation_status, status")
          .eq("id", contestId)
          .eq("advertiser_id", user.id)
          .single();

        if (error) throw error;

        setContest(data as ContestData);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContest();
  }, [contestId, user, supabase]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareOnTwitter = () => {
    const text = `Check out this creator contest: ${contest?.title}. Submit your content to win prizes!`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(contestPublicUrl)}`;
    window.open(url, "_blank");
  };

  const shareOnFacebook = () => {
    // Facebook doesn't support custom text in the same way Twitter does
    // It will pull title/description from the page's OpenGraph tags
    // We can use the quote parameter to add some text
    const quote = `Check out this creator contest: ${contest?.title}. Submit your content to win prizes!`;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
      contestPublicUrl
    )}&quote=${encodeURIComponent(quote)}`;
    window.open(url, "_blank");
  };

  const shareOnLinkedIn = () => {
    // LinkedIn allows some customization with title, summary and source parameters
    const title = encodeURIComponent(`Creator Contest: ${contest?.title}`);
    const summary = encodeURIComponent(
      `Submit your content to win prizes in this creator contest!`
    );
    const source = encodeURIComponent("Game Of Creators");
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      contestPublicUrl
    )}&title=${title}&summary=${summary}&source=${source}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading contest data...</p>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-red-500 mb-4">
          Contest not found or you don't have permission to share it.
        </p>
        <Button asChild>
          <Link href="/dashboard/contests">Back to Contests</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/contests/${contestId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Share Contest</h1>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Refined contest status alerts */}
      {contest.moderation_status !== 'published' && (
        <Alert className="mb-6 border-amber-500 bg-amber-50">
          <AlertDescription className="text-amber-800">
            This contest is not published yet. Only you can see this preview. Publish the contest first to share it with creators.
          </AlertDescription>
        </Alert>
      )}
      {contest.moderation_status === 'published' && contest.status === "upcoming" && (
        <Alert className="mb-6 border-blue-500 bg-blue-50">
          <AlertDescription className="text-blue-800">
            This contest is not live yet. You can share it, but creators won't be able to participate until the start date.
          </AlertDescription>
        </Alert>
      )}
      {contest.moderation_status === 'published' && contest.status === "ended" && (
        <Alert className="mb-6 border-red-500 bg-red-50">
          <AlertDescription className="text-red-800">
            This contest has ended. Creators can no longer submit entries.
          </AlertDescription>
        </Alert>
      )}
      {/* End refined contest status alerts */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contest Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4">
              {contest.thumbnail_url ? (
                <img
                  src={contest.thumbnail_url}
                  alt={contest.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                  <Share2 className="h-12 w-12 text-gray-400" />
                </div>
              )}
              <h2 className="text-xl font-bold mb-2">{contest.title}</h2>
              {(contest.brief_html || contest.brief) ? (
                <div
                  className="prose prose-sm max-w-none text-gray-600 line-clamp-3"
                  dangerouslySetInnerHTML={{ __html: contest.brief_html || contest.brief || '' }}
                />
              ) : (
                <p className="text-gray-600 line-clamp-3">No brief provided</p>
              )}
              <div className="mt-4 space-x-2">
                {contest.moderation_status !== 'published' && (
                  <Badge className="bg-amber-500">
                    {contest.moderation_status === 'draft' && 'Draft'}
                    {contest.moderation_status === 'pending_approval' && 'Pending Approval'}
                    {contest.moderation_status === 'approved' && 'Approved'}
                    {contest.moderation_status === 'rejected' && 'Rejected'}
                  </Badge>
                )}
                {contest.moderation_status === 'published' && (
                  <Badge
                    className={
                      contest.status === "active"
                        ? "bg-green-500"
                        : contest.status === "upcoming"
                          ? "bg-blue-500"
                          : contest.status === "ended"
                            ? "bg-gray-500"
                            : "bg-red-500"
                    }
                  >
                    {contest.status === "active" && "Live"}
                    {contest.status === "upcoming" && "Upcoming"}
                    {contest.status === "ended" && "Ended"}
                    {contest.status === "incomplete" && "Incomplete"}
                    {contest.status === "unknown" && "Unknown"}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Share Options</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="link">
                <TabsList className="mb-4">
                  <TabsTrigger value="link">Share Link</TabsTrigger>
                  <TabsTrigger value="social">Social Media</TabsTrigger>
                  <TabsTrigger value="embed">Embed</TabsTrigger>
                </TabsList>

                <TabsContent value="link" className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Share this link directly with creators:
                    </p>
                    <div className="flex items-center gap-2">
                      <Input value={contestPublicUrl} readOnly />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(contestPublicUrl)}
                        className={copied ? "bg-green-50 text-green-600" : ""}
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Share your contest on social media:
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={shareOnTwitter}
                      variant="outline"
                      className="flex-1 bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-200"
                    >
                      <Twitter className="h-4 w-4 mr-2" /> Twitter
                    </Button>
                    <Button
                      onClick={shareOnFacebook}
                      variant="outline"
                      className="flex-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
                    >
                      <Facebook className="h-4 w-4 mr-2" /> Facebook
                    </Button>
                    <Button
                      onClick={shareOnLinkedIn}
                      variant="outline"
                      className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                    >
                      <Linkedin className="h-4 w-4 mr-2" /> LinkedIn
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="embed" className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add this contest widget to your website:
                  </p>
                  <div className="space-y-2">
                    <Input value={embedCode} readOnly />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(embedCode)}
                      className="w-full"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied ? "Copied!" : "Copy Embed Code"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sharing Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc ml-4">
                <li>
                  Share your contest on your social media accounts to reach more
                  creators
                </li>
                <li>Include relevant hashtags to increase visibility</li>
                <li>
                  Send the link directly to creators you'd like to participate
                </li>
                <li>
                  Embed the contest on your website to reach your existing
                  audience
                </li>
                <li>
                  Consider partnering with influencers to promote your contest
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => router.push(`/dashboard/contests/${contestId}`)}
                className="w-full"
              >
                Back to Contest
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
