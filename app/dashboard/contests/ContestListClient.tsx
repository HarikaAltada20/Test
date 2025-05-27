'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteContestButton } from "@/components/delete-contest-button";
import { formatLocalDateTime } from "@/lib/utils";

// Define the type for a contest based on its usage in the original page.tsx
// This should ideally match the structure of data from 'contests_with_status' view
type Contest = {
    id: string;
    title: string | null;
    platform: string | null;
    contest_type: string | null;
    created_at: string;
    is_draft: boolean;
    status: string;
    // Add any other fields from contests_with_status that are used
};

interface ContestListClientProps {
    publishedContests: Contest[];
    draftContests: Contest[];
}

export function ContestListClient({ publishedContests, draftContests }: ContestListClientProps) {
    return (
        <Tabs defaultValue="published" className="mb-6">
            <TabsList>
                <TabsTrigger value="published">Published Contests</TabsTrigger>
                <TabsTrigger value="drafts">
                    Drafts ({draftContests.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="published">
                <Card>
                    <CardHeader>
                        <CardTitle>Published Contests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {publishedContests.length > 0 ? (
                            <div className="space-y-4">
                                {publishedContests.map((contest) => (
                                    <div
                                        key={contest.id}
                                        className="flex items-center justify-between border-b pb-4"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="rounded-full bg-gray-100 p-2">
                                                <Trophy className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{contest.title}</p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <Badge variant="outline" className="capitalize">
                                                        {contest.platform}
                                                    </Badge>
                                                    <Badge
                                                        variant={contest.contest_type === 'cpm' ? 'secondary' : 'default'}
                                                        className="capitalize"
                                                    >
                                                        {contest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Created: {formatLocalDateTime(contest.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
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
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/dashboard/contests/${contest.id}`}>
                                                    View
                                                </Link>
                                            </Button>
                                            <DeleteContestButton
                                                contestId={contest.id}
                                                contestTitle={contest.title || 'Untitled Contest'}
                                                isLive={contest.status === "live"}
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">
                                    No published contests yet
                                </p>
                                <Button className="mt-4" asChild>
                                    <Link href="/dashboard/contests/create">
                                        Create your first contest
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="drafts">
                <Card>
                    <CardHeader>
                        <CardTitle>Draft Contests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {draftContests.length > 0 ? (
                            <div className="space-y-4">
                                {draftContests.map((contest) => (
                                    <div
                                        key={contest.id}
                                        className="flex items-center justify-between border-b pb-4"
                                    >
                                        <div className="flex items-center space-x-4">
                                            <div className="rounded-full bg-gray-100 p-2">
                                                <Edit className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {contest.title || "Untitled Contest"}
                                                </p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <Badge variant="outline" className="capitalize">
                                                        {contest.platform || 'N/A'}
                                                    </Badge>
                                                    <Badge
                                                        variant={contest.contest_type === 'cpm' ? 'secondary' : 'default'}
                                                        className="capitalize"
                                                    >
                                                        {contest.contest_type === 'cpm' ? 'CPM' : (contest.contest_type || 'Leaderboard')}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Created: {formatLocalDateTime(contest.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-amber-500">Draft</Badge>
                                            <Button variant="outline" size="sm" asChild>
                                                <Link
                                                    href={`/dashboard/contests/create?draft=${contest.id}`}
                                                >
                                                    Continue
                                                </Link>
                                            </Button>
                                            <DeleteContestButton
                                                contestId={contest.id}
                                                contestTitle={contest.title || "Untitled Contest"}
                                                isLive={false} // Drafts are not live
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground">No draft contests</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
} 