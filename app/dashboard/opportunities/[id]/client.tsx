"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, ExternalLink, Info, Trophy, User, ListOrdered, ScrollText, Link2, Lightbulb, PlayCircle, CheckCircle } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { formatLocalDateTime, formatMoney } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Define type for prize objects globally within the file
type PrizeInfo = {
    position: number;
    amount: number;
};

// LeaderboardEntry type reflects combined data from API
type LeaderboardEntry = {
    // Submission fields
    id: string;
    creator_id: string;
    video_title: string;
    views: number;
    earnings: number;
    status: string;
    created_at: string;
    content_link: string;
    // Added 'users' field containing data from the joined users table
    users: {
        id: string;
        username: string;
        profile_picture_url: string | null; // It can be null
        full_name: string | null; // It can be null
    } | null;
    // Added creator_profile data
    creator_profile: {
        id: string;
        youtube_account: {
            channel_thumbnail?: string; // Added optional youtube thumbnail
            // Add other fields from youtube_account if needed
        } | null;
        // Add other creator_profile fields if needed
    } | null;
};

// Client component that receives contestId as a prop
export function ContestClientPage({ contestId }: { contestId: string }) {
    const [contest, setContest] = useState<any>(null)
    const [existingSubmission, setExistingSubmission] = useState<any>(null)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const { user } = useAuth()
    const supabase = createSupabaseClient()
    const [hasSubmitted, setHasSubmitted] = useState(false)

    // Function to fetch leaderboard data
    const fetchLeaderboard = async () => {
        if (!isMounted) return;
        setLoadingLeaderboard(true);
        let leaderboardFetchError = null;
        try {
            const response = await fetch(`/api/leaderboard/${contestId}`);
            const data = await response.json();
            if (!response.ok) {
                leaderboardFetchError = data.error || 'Failed to fetch leaderboard';
                throw new Error(leaderboardFetchError);
            }
            if (isMounted) {
                setLeaderboard(data.leaderboard || []);
                setLastUpdated(data.lastUpdated);
            }
        } catch (err: any) {
            console.error("Error fetching leaderboard:", err);
            if (isMounted && !error) setError(leaderboardFetchError || err.message);
        } finally {
            if (isMounted) setLoadingLeaderboard(false);
        }
    };

    let isMounted = true; // Flag to track component mount status

    useEffect(() => {
        isMounted = true;

        // Only run fetch logic if the user object is available
        if (!user) {
            // Keep showing the initial loading state
            setLoading(true);
            return;
        }

        // User object exists, proceed to fetch data
        async function fetchData() {
            if (!isMounted) return;
            setLoading(true);
            setError(null);

            try {
                // Explicit check inside try block, though outer check should suffice
                if (!user) {
                    throw new Error("User not available for fetching data.");
                }

                // Get user role from the database
                const { data: userData } = await supabase.from("users").select("user_type").eq("id", user.id).single(); // Can remove assertion now

                if (userData?.user_type !== "creator") {
                    // Keep redirect for wrong user type
                    router.push("/dashboard");
                    return;
                }

                // Fetch contest details using maybeSingle()
                const { data: contestData, error: contestError } = await supabase
                    .from("contests_with_status") // Use the view
                    .select(`
                        *,
                        advertiser_profiles ( company_name )
                    `)
                    .eq("id", contestId)
                    .maybeSingle(); // Handles not found gracefully

                // Handle potential errors during fetch
                if (contestError) {
                    console.error("Error fetching contest details:", contestError);
                    if (isMounted) {
                        setError(`Contest fetch error: ${contestError.message}`);
                        setLoading(false);
                    }
                    return; // Stop execution if there was a DB error
                }

                // Handle case where contest is not found (maybeSingle returns null data)
                if (!contestData) {
                    if (isMounted) {
                        setError("Contest not found.");
                        setLoading(false);
                    }
                    return; // Stop execution if contest not found
                }

                // Check contest status
                if (['draft', 'incomplete'].includes(contestData.status) || contestData.is_draft) {
                    if (isMounted) {
                        setError("This contest is not available.");
                        setLoading(false);
                    }
                    return;
                }

                // Fetch existing submission (only if contest data is valid)
                let submissionResult = null;
                // Ensure user.id is accessed safely (already handled by initial !user check)
                const { data: submissionData, error: submissionError } = await supabase
                    .from("submissions")
                    .select("id, created_at")
                    .eq("contest_id", contestId)
                    .eq("creator_id", user.id) // user is guaranteed non-null here
                    .limit(1);
                submissionResult = submissionData && submissionData.length > 0 ? submissionData[0] : null;

                if (submissionError) {
                    console.error("Error checking existing submission:", submissionError);
                    // Handle error appropriately, maybe show a toast
                } else if (submissionResult) {
                    setHasSubmitted(true);
                    // Store the timestamp as well if needed, e.g., for display
                    // setSubmissionTime(submissionResult.created_at);
                }

                // Update state if component is still mounted
                if (isMounted) {
                    setContest(contestData);
                    setExistingSubmission(submissionResult);
                    setLoading(false);
                    fetchLeaderboard(); // Fetch leaderboard after contest details are confirmed
                }

            } catch (err: any) {
                console.error("Error fetching contest data:", err);
                if (isMounted) {
                    setError(err.message || "An unexpected error occurred during contest fetch");
                    setLoading(false);
                }
            }
        }

        fetchData();

        // Set up auto-refresh for leaderboard every 5 minutes
        const intervalId = setInterval(() => {
            if (isMounted && lastUpdated && !loadingLeaderboard) {
                const lastUpdateTime = new Date(lastUpdated).getTime();
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                if (lastUpdateTime < fiveMinutesAgo) {
                    fetchLeaderboard();
                }
            }
        }, 60 * 1000); // Check every minute if refresh is needed

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [contestId, user, router, supabase]);

    const handleSubmitContent = () => {
        router.push(`/dashboard/opportunities/${contestId}/submit`)
    }

    const handleViewSubmission = (submissionId: string) => {
        router.push(`/dashboard/content/${submissionId}`)
    }

    // Helper to format time ago
    const formatTimeAgo = (timestamp: string | null): string => {
        if (!timestamp) return 'never';
        const now = new Date();
        const past = new Date(timestamp);
        const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);

        if (diffInMinutes < 1) return 'just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return past.toLocaleDateString();
    };

    // Show loading state ONLY when fetching data (loading state)
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p>Loading contest details...</p>
                </div>
            </div>
        )
    }

    // Error UI handling (check error or missing contest AFTER loading is false)
    if (!loading && (error || !contest)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-red-500">{error || "Failed to load contest details"}</p>
                    <Button className="mt-4" onClick={() => router.push("/dashboard/opportunities")}>
                        Back to Opportunities
                    </Button>
                </div>
            </div>
        )
    }

    // Render main content
    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/opportunities")}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">{contest.title}</h1>
                <Badge
                    className={
                        contest.status === "live"
                            ? "bg-green-500 ml-2"
                            : contest.status === "upcoming"
                                ? "bg-blue-500 ml-2"
                                : "bg-gray-500 ml-2"
                    }
                >
                    {contest.status}
                </Badge>
            </div>

            {contest.thumbnail_url && (
                <div className="mb-6 aspect-video w-full max-w-4xl mx-auto relative overflow-hidden rounded-lg bg-gray-100">
                    <Image
                        src={contest.thumbnail_url}
                        alt={`${contest.title} thumbnail`}
                        fill
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
            )}

            <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="details">Contest Details</TabsTrigger>
                    <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                </TabsList>

                <TabsContent value="details">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contest Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <h3 className="font-semibold mb-2">Brief</h3>
                                        <p className="text-muted-foreground text-sm">{contest.brief || "No brief provided"}</p>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-semibold mb-1">Start Date & Time</h3>
                                            <p className="text-sm text-muted-foreground">{contest.start_date ? formatLocalDateTime(contest.start_date) : "Not specified"}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold mb-1">End Date & Time</h3>
                                            <p className="text-sm text-muted-foreground">{contest.end_date ? formatLocalDateTime(contest.end_date) : "Not specified"}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold mb-1">Platform</h3>
                                            <p className="text-sm text-muted-foreground">{contest.platform || "Not specified"}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold mb-1">Category</h3>
                                            <p className="text-sm text-muted-foreground">{contest.category || "Not specified"}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold mb-1">Sponsor</h3>
                                            <p className="text-sm text-muted-foreground">{contest.advertiser_profiles?.company_name || "Not specified"}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <h3 className="font-semibold mb-2">Prize Structure</h3>
                                        {Array.isArray(contest?.prizes) && contest.prizes.length > 0 ? (
                                            <ul className="space-y-1 list-disc list-inside text-sm text-muted-foreground">
                                                {[...(contest.prizes as PrizeInfo[])]
                                                    .sort((a, b) => a.position - b.position)
                                                    .map((prize) => (
                                                        <li key={prize.position}>Position {prize.position}: {formatMoney(prize.amount)}</li>
                                                    ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No prize structure defined.</p>
                                        )}
                                    </div>
                                    {/* Rules Section */}
                                    {(contest.rules || contest.rules_description) && <Separator />}
                                    {(contest.rules || contest.rules_description) && (
                                        <div>
                                            <h3 className="font-semibold mb-2 flex items-center gap-2"><ScrollText className="h-4 w-4" /> Rules & Guidelines</h3>
                                            <div className="prose prose-sm text-muted-foreground max-w-none">
                                                {contest.rules_description ? (
                                                    <p>{contest.rules_description}</p>
                                                ) : contest.rules && typeof contest.rules === 'object' && contest.rules.list && Array.isArray(contest.rules.list) ? (
                                                    <ul className="list-disc pl-5 space-y-1">
                                                        {contest.rules.list.map((rule: string, index: number) => (
                                                            <li key={index}>{rule}</li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p>No specific rules provided.</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Resources Section */}
                                    {contest.resources && typeof contest.resources === 'object' && Object.keys(contest.resources).length > 0 && <Separator />}
                                    {contest.resources && typeof contest.resources === 'object' && Object.keys(contest.resources).length > 0 && (
                                        <div>
                                            <h3 className="font-semibold mb-2 flex items-center gap-2"><Link2 className="h-4 w-4" /> Resources</h3>
                                            <div className="space-y-2">
                                                {Object.entries(contest.resources).map(([key, value]) => (
                                                    <Button key={key} variant="outline" size="sm" asChild>
                                                        <Link href={value as string} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-4 w-4 mr-2" />
                                                            {key}
                                                        </Link>
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Inspiration Links Section */}
                                    {(() => {
                                        let links = [];
                                        try {
                                            links = typeof contest.inspiration_links === 'string'
                                                ? JSON.parse(contest.inspiration_links)
                                                : Array.isArray(contest.inspiration_links) ? contest.inspiration_links : [];
                                        } catch (e) {
                                            console.error('Error parsing inspiration_links:', e);
                                        }
                                        return links.length > 0 ? (
                                            <>
                                                <Separator />
                                                <div>
                                                    <h3 className="font-semibold mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Inspiration Links</h3>
                                                    <div className="space-y-2">
                                                        {links.map((link: string, index: number) => (
                                                            <Button key={index} variant="ghost" size="sm" asChild className="text-primary hover:underline p-0 h-auto justify-start">
                                                                <Link href={link} target="_blank" rel="noopener noreferrer">
                                                                    <ExternalLink className="h-3 w-3 mr-1.5" />
                                                                    Inspiration Example {index + 1}
                                                                </Link>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        ) : null;
                                    })()}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-1 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contest Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Calendar className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Timeframe</p>
                                            <p className="text-xs text-muted-foreground">
                                                {contest.start_date ? formatLocalDateTime(contest.start_date, { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'} - {contest.end_date ? formatLocalDateTime(contest.end_date, { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Trophy className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Total Prize Pool</p>
                                            <p className="text-xs text-muted-foreground">{formatMoney(contest.total_prize || 0)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">Sponsor</p>
                                            <p className="text-xs text-muted-foreground">{contest.advertiser_profiles?.company_name || "Not specified"}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-secondary/30 border-secondary">
                                <CardContent className="pt-6">
                                    {hasSubmitted ? (
                                        <div className="text-center">
                                            <CheckCircle className="inline mr-2 h-4 w-4 text-green-500" />
                                            <p>
                                                You have already submitted for this opportunity. Submitted {formatTimeAgo(existingSubmission.created_at)}</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-sm font-medium mb-4">Ready to submit your content?</p>
                                            <Button size="sm" onClick={handleSubmitContent} disabled={contest.status !== 'live'}>
                                                {contest.status === 'upcoming' ? 'Contest Not Started' : contest.status === 'ended' || contest.status === 'completed' ? 'Contest Ended' : 'Submit Content'}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="leaderboard">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Leaderboard</CardTitle>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">Last updated: {formatTimeAgo(lastUpdated)}</p>
                                {loadingLeaderboard && <p className="text-xs text-blue-500 animate-pulse">Updating...</p>}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Handle overall fetch error affecting leaderboard */}
                            {error && !loadingLeaderboard && leaderboard.length === 0 && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertDescription>Error loading leaderboard: {error}</AlertDescription>
                                </Alert>
                            )}
                            {loadingLeaderboard && leaderboard.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">Loading leaderboard...</div>
                            ) : !error && leaderboard.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No submissions yet. Be the first!</div>
                            ) : leaderboard.length > 0 ? (
                                <div className="space-y-3">
                                    {leaderboard.map((entry, index) => {
                                        const rank = index + 1;
                                        // Use contest.prizes for prize lookup
                                        const prizeInfo = Array.isArray(contest?.prizes)
                                            ? (contest.prizes as PrizeInfo[]).find(p => p.position === rank)
                                            : null;
                                        const prizeAmount = prizeInfo ? prizeInfo.amount : null;
                                        const userData = entry.users; // Use entry.users
                                        const creatorProfileData = entry.creator_profile;
                                        const videoUrl = entry.content_link || '#';
                                        const displayName = userData?.full_name || userData?.username || 'Unknown Creator';
                                        // Prioritize profile_picture_url, then youtube thumbnail
                                        const profilePicUrl = userData?.profile_picture_url;
                                        const youtubeThumbnail = creatorProfileData?.youtube_account?.channel_thumbnail;

                                        return (
                                            <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-md bg-background hover:bg-muted/50 transition-colors">
                                                {/* Rank */}
                                                <span className={`font-bold text-lg w-8 text-center flex-shrink-0 ${prizeAmount ? 'text-primary' : 'text-muted-foreground'}`}>{rank}</span>

                                                {/* --- Use Avatar Component --- */}
                                                <Avatar className="h-10 w-10 rounded-full flex-shrink-0 border">
                                                    <AvatarImage src={profilePicUrl || youtubeThumbnail || undefined} alt={displayName} />
                                                    <AvatarFallback>{
                                                        displayName?.[0]?.toUpperCase() || 'U'
                                                    }</AvatarFallback>
                                                </Avatar>
                                                {/* --- End Avatar Component --- */}

                                                {/* Info using full_name / username */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate" title={displayName}>{displayName}</p>
                                                    {userData?.full_name && userData?.username && userData.full_name !== userData.username && (
                                                        <p className="text-xs text-muted-foreground truncate">@{userData.username}</p>
                                                    )}
                                                </div>
                                                {/* Right Aligned Section */}
                                                <div className="flex items-center gap-3 ml-auto pl-2 flex-shrink-0">
                                                    {/* Play Button */}
                                                    <Link href={videoUrl} target="_blank" rel="noopener noreferrer" title="Watch Video">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                            <PlayCircle className="h-5 w-5" />
                                                        </Button>
                                                    </Link>

                                                    {/* Views & Prize */}
                                                    <div className="text-right w-24 space-y-0.5">
                                                        <p className="font-semibold text-sm truncate">{entry.views?.toLocaleString() || 0} views</p>
                                                        {prizeAmount && (
                                                            <Badge variant="secondary" className="text-xs font-medium bg-green-100 text-green-700 border-green-200 px-1.5 py-0.5 whitespace-nowrap">
                                                                Winning Zone: {formatMoney(prizeAmount)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null /* Should be covered by loading/error/empty states */}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
} 