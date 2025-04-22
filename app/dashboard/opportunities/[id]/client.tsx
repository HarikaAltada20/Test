"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, ExternalLink, Info, Trophy, User } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { formatLocalDateTime, formatMoney } from "@/lib/utils"

// Client component that receives contestId as a prop
export function ContestClientPage({ contestId }: { contestId: string }) {
    const [contest, setContest] = useState<any>(null)
    const [existingSubmission, setExistingSubmission] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const { user, isLoading: authLoading } = useAuth()
    const supabase = createSupabaseClient()

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            if (!isMounted) return;

            // Don't show loading if we already have contest data
            if (!contest) {
                setLoading(true);
            }

            try {
                // Check if auth is still loading or no user
                if (authLoading || !user) {
                    return;
                }

                // Get user role from the database
                const { data: userData } = await supabase.from("users").select("user_type").eq("id", user.id).single();

                if (userData?.user_type !== "creator") {
                    router.push("/dashboard");
                    return;
                }

                // First try to get contest details
                let { data: contestData, error: contestError } = await supabase
                    .from("contests_with_status")
                    .select("*")
                    .eq("id", contestId)
                    .single();

                // If there's an error with the view, try the base contests table
                if (contestError) {
                    console.error("Error fetching from contests_with_status:", contestError);

                    // Try to get data from the base contests table instead
                    const { data: fallbackData, error: fallbackError } = await supabase
                        .from("contests")
                        .select("*")
                        .eq("id", contestId)
                        .single();

                    if (fallbackError) {
                        console.error("Fallback error:", fallbackError);
                        if (isMounted) {
                            setError(`Contest error: ${contestError.message || contestError.code || "Unknown database error"}. 
                      Fallback also failed: ${fallbackError.message || "Unknown error"}`);
                            setLoading(false);
                        }
                        return;
                    }

                    if (fallbackData) {
                        console.log("Using fallback data instead of view");
                        contestData = fallbackData;
                        contestError = null;
                    }
                }

                if (contestError) {
                    console.error("All attempts to fetch contest failed:", contestError);
                    if (isMounted) {
                        setError(`Contest error: ${contestError.message || contestError.code || "Unknown database error"}`);
                        setLoading(false);
                    }
                    return;
                }

                if (!contestData) {
                    if (isMounted) {
                        setError("Contest not found - No data returned from database");
                        setLoading(false);
                    }
                    return;
                }

                // Don't show draft contests to creators
                if (contestData.status === 'draft' || contestData.is_draft) {
                    if (isMounted) {
                        setError("This contest is not available yet");
                        setLoading(false);
                    }
                    return;
                }

                // If we have contest data and it has an advertiser_id, fetch the advertiser details
                if (contestData.advertiser_id) {
                    const { data: advertiserData } = await supabase
                        .from("advertiser_profiles")
                        .select("company_name")
                        .eq("id", contestData.advertiser_id);

                    if (advertiserData && advertiserData.length > 0) {
                        contestData.advertiser_profiles = advertiserData[0];
                    } else {
                        contestData.advertiser_profiles = { company_name: "Unknown Company" };
                    }
                }

                if (isMounted) {
                    setContest(contestData);

                    // Check if user has already submitted to this contest
                    const { data: submissionData } = await supabase
                        .from("submissions")
                        .select("*")
                        .eq("contest_id", contestId)
                        .eq("creator_id", user.id);

                    // Only set existing submission if data exists and is not empty
                    if (submissionData && submissionData.length > 0) {
                        setExistingSubmission(submissionData[0]);
                    }

                    setLoading(false);
                    setError(null); // Clear any previous errors
                }
            } catch (err) {
                console.error("Error in component:", err);
                if (isMounted) {
                    setError("An unexpected error occurred");
                    setLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [contestId, user, authLoading, router, supabase]);

    const handleSubmitContent = () => {
        router.push(`/dashboard/opportunities/${contestId}/submit`)
    }

    const handleViewSubmission = (submissionId: string) => {
        router.push(`/dashboard/content/${submissionId}`)
    }

    // Show loading state when auth is loading or data is loading
    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p>Loading contest details...</p>
                </div>
            </div>
        )
    }

    // Only show error UI after loading is complete AND there's an error or no contest
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

    // Only render the main content if we have both the contest data and we're not loading
    if (!contest || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p>Loading contest details...</p>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-6">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contest Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">Brief</h3>
                                <p className="text-muted-foreground">{contest.brief || "No brief provided"}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-medium mb-2">Start Date & Time</h3>
                                    <p>
                                        {contest.start_date
                                            ? formatLocalDateTime(contest.start_date)
                                            : "Not specified"}
                                    </p>
                                </div>
                                <div>
                                    <h3 className="font-medium mb-2">End Date & Time</h3>
                                    <p>
                                        {contest.end_date
                                            ? formatLocalDateTime(contest.end_date)
                                            : "Not specified"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-medium mb-2">Platform</h3>
                                    <p className="capitalize">{contest.platform}</p>
                                </div>
                                <div>
                                    <h3 className="font-medium mb-2">Category</h3>
                                    <p className="capitalize">{contest.category || "General"}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-medium mb-2">Sponsor</h3>
                                <p>{contest.advertiser_profiles?.company_name || "N/A"}</p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-2">Prize Structure</h3>
                                <div className="space-y-2">
                                    {Array.isArray(contest.prizes) && contest.prizes.length > 0 ? (
                                        contest.prizes.map((prize: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between">
                                                <span>Position {prize.position || index + 1}</span>
                                                <span>{formatMoney(prize.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">Prize structure not available</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-medium mb-2">Rules & Guidelines</h3>
                                <div className="bg-muted p-4 rounded-lg">
                                    {contest.rules && contest.rules.list && Array.isArray(contest.rules.list) ? (
                                        <ul className="list-disc pl-5 space-y-2">
                                            {contest.rules.list.map((rule: string, index: number) => (
                                                <li key={index}>{rule}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <ul className="list-disc pl-5 space-y-2">
                                            <li>Content must be original and created specifically for this contest.</li>
                                            <li>Content must comply with {contest.platform} community guidelines.</li>
                                            <li>All submissions must include the hashtags provided in the brief (if specified).</li>
                                            <li>
                                                By submitting content, you grant the sponsor the right to use your content for promotional
                                                purposes.
                                            </li>
                                            <li>Winners will be selected based on engagement metrics and quality of content.</li>
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {contest.resources && Object.keys(contest.resources).length > 0 && (
                                <div>
                                    <h3 className="font-medium mb-2">Resources</h3>
                                    <div className="bg-muted p-4 rounded-lg">
                                        <p>The sponsor has provided these resources to help with your submission:</p>
                                        <div className="mt-2 space-y-2">
                                            {Object.entries(contest.resources).map(([key, value]) => (
                                                <div key={key} className="flex items-center">
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    <Link href={value as string} className="text-primary hover:underline">
                                                        {key}
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(() => {
                                // Parse inspiration_links if it's a string
                                let links = [];
                                try {
                                    links = typeof contest.inspiration_links === 'string'
                                        ? JSON.parse(contest.inspiration_links)
                                        : contest.inspiration_links || [];
                                } catch (e) {
                                    console.error('Error parsing inspiration_links:', e);
                                }

                                return Array.isArray(links) && links.length > 0 && (
                                    <div>
                                        <h3 className="font-medium mb-2">Inspiration Links</h3>
                                        <div className="bg-muted p-4 rounded-lg">
                                            <p>Check out these examples for inspiration:</p>
                                            <div className="mt-2 space-y-2">
                                                {links.map((link: string, index: number) => (
                                                    <div key={index} className="flex items-center">
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        <Link href={link} className="text-primary hover:underline" target="_blank">
                                                            Inspiration Example {index + 1}
                                                        </Link>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contest Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <h3 className="text-sm font-medium">Timeframe</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {contest.start_date
                                            ? `${formatLocalDateTime(contest.start_date)}`
                                            : "Not set"} - {" "}
                                        {contest.end_date
                                            ? `${formatLocalDateTime(contest.end_date)}`
                                            : "Not set"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <h3 className="text-sm font-medium">Total Prize Pool</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {formatMoney(contest.total_prize)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <h3 className="text-sm font-medium">Sponsor</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {contest.advertiser_profiles?.company_name || "Unknown"}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            {existingSubmission ? (
                                <div>
                                    <div className="bg-muted p-4 rounded-lg text-center mb-4">
                                        <Info className="h-5 w-5 mx-auto mb-2" />
                                        <p className="text-sm font-medium">You've already submitted to this contest</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            You submitted on {formatLocalDateTime(existingSubmission.submitted_at)}
                                        </p>
                                    </div>
                                    <Button
                                        className="w-full"
                                        onClick={() => handleViewSubmission(existingSubmission.id)}
                                    >
                                        View My Submission
                                    </Button>
                                </div>
                            ) : contest.status === "live" ? (
                                <Button
                                    className="w-full"
                                    onClick={handleSubmitContent}
                                >
                                    Submit Content
                                </Button>
                            ) : contest.status === "upcoming" ? (
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <p className="text-sm font-medium">This contest is not yet active</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Come back on{" "}
                                        {contest.start_date
                                            ? `${formatLocalDateTime(contest.start_date)}`
                                            : "the start date"}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-muted p-4 rounded-lg text-center">
                                    <p className="text-sm font-medium">This contest has ended</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Ended on {contest.end_date
                                            ? `${formatLocalDateTime(contest.end_date)}`
                                            : "the end date"}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
} 