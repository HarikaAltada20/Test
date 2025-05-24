"use client";

import { DeleteContestButton } from "@/components/delete-contest-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLocalDateTime, formatMoney } from "@/lib/utils";
import { ArrowLeft, Calendar, ExternalLink, Trophy, Users } from "lucide-react";
import Link from "next/link";

// Define types for props (can be more specific based on your actual data structure)
interface Contest {
    id: string;
    title: string;
    status: "live" | "upcoming" | "completed" | "draft" | string; // Adjusted to include string for flexibility
    thumbnail_url?: string | null;
    brief?: string | null;
    platform: string;
    start_date: string | null; // Pass as ISO string or Date object
    end_date: string | null;   // Pass as ISO string or Date object
    rules?: { list: string[] } | null;
    inspiration_links?: string[] | null;
    resources?: Record<string, string> | null;
    contest_type?: "leaderboard" | "cpm" | null; // Make it optional for safety, though it should always come from DB
    contest_based_details?: any | null; // Use 'any' for now, or define specific types for cpm_contest and leaderboard_contest
    prizes?: Array<{ position: number; amount: number }>;
    total_prize?: number | null;
    winner_count?: number | null;
}

interface SubmissionCreatorProfile {
    username?: string | null;
}

interface Submission {
    id: string;
    creator_profiles?: SubmissionCreatorProfile | null;
    created_at: string; // Pass as ISO string or Date object
    current_views: number;
    status: "approved" | "pending" | "rejected" | string; // Adjusted
    content_link: string;
}

interface ContestDetailClientProps {
    contest: Contest;
    submissions: Submission[] | null;
    isLive: boolean;
    durationDays: number | null;
    contestId: string;
}

export default function ContestDetailClient({
    contest,
    submissions,
    isLive,
    durationDays,
    contestId,
}: ContestDetailClientProps) {
    if (!contest) {
        // Or a more sophisticated loading/error state
        return <p>Loading contest details or contest not found...</p>;
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-6">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard/contests">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
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
                {contest.contest_type && (
                    <Badge
                        variant={contest.contest_type === 'cpm' ? 'secondary' : 'default'}
                        className="capitalize ml-2"
                    >
                        {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Tabs defaultValue="overview">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="submissions">Submissions</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contest Details</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {contest.thumbnail_url && (
                                        <div>
                                            <h3 className="font-medium mb-2">Thumbnail</h3>
                                            <img
                                                src={contest.thumbnail_url}
                                                alt={`${contest.title} thumbnail`}
                                                className="w-full max-h-64 object-contain border rounded-md"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="font-medium mb-2">Brief</h3>
                                        <p className="text-muted-foreground">
                                            {contest.brief || "No brief provided"}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium mb-2">Platform</h3>
                                            <p className="capitalize">{contest.platform}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium mb-2">Status</h3>
                                            <Badge
                                                className={
                                                    contest.status === "live"
                                                        ? "bg-green-500"
                                                        : contest.status === "upcoming"
                                                            ? "bg-blue-500"
                                                            : "bg-gray-500"
                                                }
                                            >
                                                {contest.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium mb-2">Start Date & Time</h3>
                                            <p>{formatLocalDateTime(contest.start_date)}</p>
                                        </div>
                                        <div>
                                            <h3 className="font-medium mb-2">End Date & Time</h3>
                                            <p>{formatLocalDateTime(contest.end_date)}</p>
                                        </div>
                                    </div>

                                    {/* Conditional Prize Structure / CPM Details */}
                                    {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest && (
                                        <div>
                                            <h3 className="font-medium mb-2">Prize Structure</h3>
                                            <div className="space-y-2 border p-3 rounded-md bg-gray-50">
                                                <div className="flex items-center justify-between">
                                                    <span>Total Prize Pool</span>
                                                    <span className="font-semibold">
                                                        {formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Number of Winners</span>
                                                    <span className="font-semibold">
                                                        {contest.contest_based_details.leaderboard_contest.winner_count}
                                                    </span>
                                                </div>
                                                {Array.isArray(contest.contest_based_details.leaderboard_contest.prizes) &&
                                                    contest.contest_based_details.leaderboard_contest.prizes.map((prize: any, index: number) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between pl-4"
                                                        >
                                                            <span>Position {prize.position}</span>
                                                            <span>{formatMoney(prize.amount)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest && (
                                        <div>
                                            <h3 className="font-medium mb-2">CPM Configuration</h3>
                                            <div className="space-y-3 border p-3 rounded-md bg-gray-50">
                                                <div>
                                                    <span className="text-sm text-muted-foreground">CPM Rate: </span>
                                                    <span className="font-semibold">
                                                        ${parseFloat(contest.contest_based_details.cpm_contest.cpm_rate_usd).toFixed(2)} per 1000 views
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-muted-foreground">Total Budget: </span>
                                                    <span className="font-semibold">
                                                        {formatMoney(contest.contest_based_details.cpm_contest.total_budget * 100)}
                                                        {/* Assuming total_budget is dollars, formatMoney expects cents */}
                                                    </span>
                                                </div>
                                                {contest.contest_based_details.cpm_contest.min_views != null && (
                                                    <div>
                                                        <span className="text-sm text-muted-foreground">Min Views: </span>
                                                        <span className="font-semibold">
                                                            {contest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {contest.contest_based_details.cpm_contest.max_views != null && (
                                                    <div>
                                                        <span className="text-sm text-muted-foreground">Max Views (Cap): </span>
                                                        <span className="font-semibold">
                                                            {contest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <h4 className="text-sm font-medium mt-2 mb-1">Terms & Conditions</h4>
                                                    <div className="prose prose-sm max-w-none p-2 border rounded bg-white text-xs">
                                                        <pre className="whitespace-pre-wrap break-words font-sans">
                                                            {contest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                                                        </pre>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {contest.rules && contest.rules.list && (
                                        <div>
                                            <h3 className="font-medium mb-2">Rules</h3>
                                            <div className="border rounded-md p-4 bg-gray-50">
                                                {Array.isArray(contest.rules.list) ? (
                                                    <ul className="list-disc list-inside space-y-1">
                                                        {contest.rules.list.map(
                                                            (rule: string, idx: number) => (
                                                                <li key={idx} className="text-sm">
                                                                    {rule}
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                ) : (
                                                    <p className="text-muted-foreground">
                                                        No rules specified
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(contest.inspiration_links) &&
                                        contest.inspiration_links.length > 0 && (
                                            <div>
                                                <h3 className="font-medium mb-2">Inspiration Links</h3>
                                                <div className="border rounded-md p-4 bg-gray-50">
                                                    <ul className="space-y-2">
                                                        {contest.inspiration_links.map(
                                                            (link: string, idx: number) => (
                                                                <li key={idx} className="text-sm">
                                                                    <a
                                                                        href={link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:underline flex items-center"
                                                                    >
                                                                        <ExternalLink className="h-3 w-3 mr-1" />
                                                                        {link}
                                                                    </a>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}

                                    {contest.resources &&
                                        Object.keys(contest.resources).length > 0 && (
                                            <div>
                                                <h3 className="font-medium mb-2">Resources</h3>
                                                <div className="border rounded-md p-4 bg-gray-50">
                                                    <ul className="space-y-2">
                                                        {Object.entries(contest.resources).map(
                                                            ([name, url]) => (
                                                                <li key={name} className="text-sm">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-medium">{name}</span>
                                                                        <a
                                                                            href={url as string}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-600 hover:underline flex items-center"
                                                                        >
                                                                            <ExternalLink className="h-3 w-3 mr-1" />
                                                                            View Resource
                                                                        </a>
                                                                    </div>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="submissions" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>All Submissions</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {submissions && submissions.length > 0 ? (
                                        <div className="space-y-4">
                                            {submissions.map((submission) => (
                                                <div
                                                    key={submission.id}
                                                    className="flex items-center justify-between border-b pb-4"
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div className="rounded-full bg-gray-100 p-2">
                                                            <Trophy className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">
                                                                {submission.creator_profiles?.username ||
                                                                    "Creator"}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                Submitted on{" "}
                                                                {formatLocalDateTime(submission.created_at)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        <div className="text-sm text-right">
                                                            <p className="font-medium">
                                                                {submission.current_views.toLocaleString()}{" "}
                                                                views
                                                            </p>
                                                            <Badge
                                                                className={
                                                                    submission.status === "approved"
                                                                        ? "bg-green-500"
                                                                        : submission.status === "pending"
                                                                            ? "bg-yellow-500"
                                                                            : "bg-red-500"
                                                                }
                                                            >
                                                                {submission.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" asChild>
                                                                <Link
                                                                    href={submission.content_link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <ExternalLink className="h-4 w-4 mr-1" /> View
                                                                </Link>
                                                            </Button>
                                                            {submission.status === "pending" && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                                                                    asChild
                                                                >
                                                                    <Link
                                                                        href={`/dashboard/contests/${contestId}/approve/${submission.id}`}
                                                                    >
                                                                        Approve
                                                                    </Link>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground">
                                                No submissions yet
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="analytics" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contest Analytics</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="font-medium">Total Submissions</h3>
                                            </div>
                                            <p className="text-2xl font-bold">
                                                {submissions?.length || 0}
                                            </p>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Trophy className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="font-medium">Approved Content</h3>
                                            </div>
                                            <p className="text-2xl font-bold">
                                                {submissions?.filter((s) => s.status === "approved")
                                                    .length || 0}
                                            </p>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <h3 className="font-medium">Contest Duration</h3>
                                            </div>
                                            <p className="text-2xl font-bold">
                                                {durationDays ? `${durationDays} days` : "N/A"}
                                            </p>
                                        </div>
                                    </div>

                                    <Separator className="my-6" />

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="font-medium mb-4">Views Distribution</h3>
                                            <div className="h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <p className="text-muted-foreground">
                                                    Analytics visualization would appear here
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Contest Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {contest.thumbnail_url && (
                                <div>
                                    <img
                                        src={contest.thumbnail_url}
                                        alt={`${contest.title} thumbnail`}
                                        className="w-full h-32 object-cover rounded-md mb-4"
                                    />
                                </div>
                            )}

                            <div>
                                <h3 className="text-sm font-medium mb-1">Status</h3>
                                <Badge
                                    className={
                                        contest.status === "live"
                                            ? "bg-green-500"
                                            : contest.status === "upcoming"
                                                ? "bg-blue-500"
                                                : "bg-gray-500"
                                    }
                                >
                                    {contest.status}
                                </Badge>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-1">Total Submissions</h3>
                                <p>{submissions?.length || 0}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-1">Platform</h3>
                                <p className="capitalize">{contest.platform}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-1">Date Range</h3>
                                <p>
                                    {formatLocalDateTime(contest.start_date)} -{" "}
                                    {formatLocalDateTime(contest.end_date)}
                                </p>
                            </div>

                            {/* Conditional Prize/Budget Info in Summary */}
                            {contest.contest_type === 'leaderboard' && contest.contest_based_details?.leaderboard_contest && (
                                <>
                                    <div>
                                        <h3 className="text-sm font-medium mb-1">Total Prize Pool</h3>
                                        <p className="font-semibold">
                                            {formatMoney(contest.contest_based_details.leaderboard_contest.total_prize)}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium mb-1">Winner Count</h3>
                                        <p>{contest.contest_based_details.leaderboard_contest.winner_count}</p>
                                    </div>
                                </>
                            )}

                            {contest.contest_type === 'cpm' && contest.contest_based_details?.cpm_contest && (
                                <div>
                                    <h3 className="text-sm font-medium mb-1">Total Budget</h3>
                                    <p className="font-semibold">
                                        {formatMoney(contest.contest_based_details.cpm_contest.total_budget * 100)}
                                        {/* Assuming total_budget is dollars, formatMoney expects cents */}
                                    </p>
                                </div>
                            )}

                            <Separator />

                            <div>
                                <h3 className="text-sm font-medium mb-2">Quick Actions</h3>
                                <div className="space-y-2">
                                    {!isLive && (
                                        <Button className="w-full" variant="outline" asChild>
                                            <Link href={`/dashboard/contests/${contestId}/edit`}>
                                                Edit Contest
                                            </Link>
                                        </Button>
                                    )}
                                    <Button className="w-full" variant="outline" asChild>
                                        <Link href={`/dashboard/contests/${contestId}/share`}>
                                            Share Contest
                                        </Link>
                                    </Button>

                                    {!isLive && (
                                        <DeleteContestButton
                                            contestId={contestId}
                                            contestTitle={contest.title}
                                            isLive={isLive}
                                            variant="outline"
                                            size="default"
                                            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                                        />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
} 