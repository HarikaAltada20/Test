"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import ContestTile from "./ContestTile";
import { Loader2 } from "lucide-react";

interface ContestAnalyticsProps {
    userId: string;
    activeFilter?: string;
    onFilterChange?: (filter: string) => void;
}

interface Contest {
    id: string;
    title: string;
    platform: string;
    contest_type: string;
    start_date: string;
    end_date: string;
    created_at: string;
    live_submission_count: number;
    post_contest_status?: string;
    moderation_status?: string;
    contest_based_details?: any;
    submissions?: Array<{
        id: string;
        views: number;
        other_stats?: {
            [platform: string]: {
                likes?: number;
                comments?: number;
                shares?: number;
                saved?: number;
                reach?: number;
                views?: number;
            };
        };
        status: string;
        created_at: string;
    }>;
}

export default function ContestAnalytics({ userId, activeFilter = "all", onFilterChange }: ContestAnalyticsProps) {
    const [contests, setContests] = useState<Contest[]>([]);
    const [filteredContests, setFilteredContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchContests();
    }, [userId]);

    useEffect(() => {
        filterContests();
    }, [contests, activeFilter]);

    const fetchContests = async () => {
        try {
            setLoading(true);
            const supabase = createClient();

            const { data, error } = await supabase
                .from("contests")
                .select(`
          id,
          title,
          platform,
          contest_type,
          start_date,
          end_date,
          created_at,
          live_submission_count,
          post_contest_status,
          moderation_status,
          contest_based_details,
          thumbnail_url,
          submissions (
            id,
            views,
            other_stats,
            status,
            created_at
          )
        `)
                .eq("advertiser_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Filter to only show live or ended contests (contests with submissions)
            const liveOrEndedContests = (data || []).filter((contest: Contest) => {
                // Only show contests that have submissions (live or ended)
                return contest.submissions && contest.submissions.length > 0;
            });

            setContests(liveOrEndedContests);
        } catch (err) {
            console.error("Error fetching contests:", err);
            setError("Failed to fetch contests");
        } finally {
            setLoading(false);
        }
    };

    const filterContests = () => {
        let filtered = [...contests];

        // Apply filtering and recalculate metrics based on filtered submissions
        filtered = contests.map(contest => {
            let filteredSubmissions = contest.submissions || [];

            switch (activeFilter) {
                case "verifiedPaid":
                    filteredSubmissions = contest.submissions?.filter(sub =>
                        sub.status === "verified" || sub.status === "paid"
                    ) || [];
                    break;
                case "pending":
                    filteredSubmissions = contest.submissions?.filter(sub =>
                        sub.status === "pending"
                    ) || [];
                    break;
                case "verified":
                    filteredSubmissions = contest.submissions?.filter(sub =>
                        sub.status === "verified"
                    ) || [];
                    break;
                case "rejected":
                    filteredSubmissions = contest.submissions?.filter(sub =>
                        sub.status === "rejected"
                    ) || [];
                    break;
                case "paid":
                    filteredSubmissions = contest.submissions?.filter(sub =>
                        sub.status === "paid"
                    ) || [];
                    break;
                default:
                    // "all" - no filtering needed
                    break;
            }

            // Return contest with filtered submissions
            return {
                ...contest,
                submissions: filteredSubmissions,
                live_submission_count: filteredSubmissions.length
            };
        });

        // Only show contests that have submissions after filtering (unless it's "all")
        if (activeFilter !== "all") {
            filtered = filtered.filter(contest => contest.submissions && contest.submissions.length > 0);
        }

        setFilteredContests(filtered);
    };


    const calculateSummaryStats = () => {
        // Use filtered contests for summary stats
        const totalSubmissions = filteredContests.reduce((sum, contest) => sum + (contest.submissions?.length || 0), 0);
        const totalViews = filteredContests.reduce((sum, contest) =>
            sum + (contest.submissions?.reduce((subSum, sub) => subSum + (sub.views || 0), 0) || 0), 0
        );

        const totalSpent = filteredContests.reduce((sum, contest) => {
            const details = contest.contest_based_details;
            if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
                return sum + details.leaderboard_contest.total_prize;
            } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
                return sum + details.cpm_contest.total_budget;
            }
            return sum;
        }, 0);

        const avgCostPerView = totalViews > 0 ? totalSpent / totalViews : 0;
        const avgCostPerSubmission = totalSubmissions > 0 ? totalSpent / totalSubmissions : 0;

        return {
            totalContests: filteredContests.length,
            totalSubmissions,
            totalViews,
            totalSpent,
            avgCostPerView: Math.round(avgCostPerView * 100) / 100,
            avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100
        };
    };

    const handleViewDetails = (contestId: string) => {
        // Navigate to contest details page
        window.location.href = `/dashboard/contests/${contestId}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={fetchContests}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    const stats = calculateSummaryStats();

    return (
        <div className="space-y-6">

            {/* Filter Indicator */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Showing stats based on:</span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                        {activeFilter === "all" ? "All Submissions" :
                            activeFilter === "verifiedPaid" ? "Verified + Paid Submissions" :
                                activeFilter === "verified" ? "Verified Submissions" :
                                    activeFilter === "paid" ? "Paid Submissions" :
                                        activeFilter === "pending" ? "Pending Submissions" :
                                            activeFilter === "rejected" ? "Rejected Submissions" :
                                                activeFilter}
                    </span>
                </div>
                <div className="text-sm text-gray-500">
                    {filteredContests.length} contest{filteredContests.length !== 1 ? 's' : ''} found
                </div>
            </div>

            {/* Contest Tiles */}
            {filteredContests.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">No contests found for the selected filter.</p>
                    <p className="text-gray-400 text-sm mt-2">Create your first contest to get started!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredContests.map((contest) => (
                        <ContestTile
                            key={contest.id}
                            contest={contest}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
