"use client";

import { useState } from "react";
import { Eye, Heart, MessageCircle, Share, Calendar, DollarSign, Users, Clock, TrendingUp, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

interface ContestTileProps {
    contest: {
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
        thumbnail_url?: string;
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
    };
    onViewDetails: (contestId: string) => void;
}

const PlatformIcon = ({ platform }: { platform: string }) => {
    const iconClass = "w-5 h-5";
    const gradientId = `instagram-gradient-${Math.random().toString(36).substr(2, 9)}`;

    switch (platform?.toLowerCase()) {
        case "youtube":
            return (
                <svg className={iconClass} viewBox="0 0 24 24" fill="#FF0000">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
            );
        case "instagram":
            return (
                <svg className={iconClass} viewBox="0 0 24 24" fill={`url(#${gradientId})`}>
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#833AB4" />
                            <stop offset="50%" stopColor="#E1306C" />
                            <stop offset="100%" stopColor="#FD1D1D" />
                        </linearGradient>
                    </defs>
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
            );
        default:
            return <div className={`${iconClass} bg-gray-400 rounded`}></div>;
    }
};

const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
        case "active":
        case "published":
            return "bg-green-100 text-green-800 border-green-200";
        case "draft":
            return "bg-gray-100 text-gray-800 border-gray-200";
        case "pending":
            return "bg-yellow-100 text-yellow-800 border-yellow-200";
        case "rejected":
            return "bg-red-100 text-red-800 border-red-200";
        case "completed":
            return "bg-blue-100 text-blue-800 border-blue-200";
        default:
            return "bg-gray-100 text-gray-800 border-gray-200";
    }
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

const getDaysRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

export default function ContestTile({ contest, onViewDetails }: ContestTileProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Calculate metrics from filtered submissions
    const filteredSubmissions = contest.submissions || [];
    const platform = contest.platform?.toLowerCase();

    // Extract metrics from nested other_stats structure
    const totalViews = filteredSubmissions.reduce((sum, sub) => {
        // Use platform-specific views from other_stats, fallback to direct views
        const platformViews = sub.other_stats?.[platform]?.views || 0;
        const directViews = sub.views || 0;
        // Use the higher value or platform-specific if available
        return sum + (platformViews > 0 ? platformViews : directViews);
    }, 0);

    const totalLikes = filteredSubmissions.reduce((sum, sub) => {
        return sum + (sub.other_stats?.[platform]?.likes || 0);
    }, 0);

    const totalComments = filteredSubmissions.reduce((sum, sub) => {
        return sum + (sub.other_stats?.[platform]?.comments || 0);
    }, 0);

    const totalShares = filteredSubmissions.reduce((sum, sub) => {
        return sum + (sub.other_stats?.[platform]?.shares || 0);
    }, 0);

    const totalSaved = filteredSubmissions.reduce((sum, sub) => {
        return sum + (sub.other_stats?.[platform]?.saved || 0);
    }, 0);

    const totalReach = filteredSubmissions.reduce((sum, sub) => {
        return sum + (sub.other_stats?.[platform]?.reach || 0);
    }, 0);

    // Calculate total spent
    let totalSpent = 0;
    if (contest.contest_type === "leaderboard" && contest.contest_based_details?.leaderboard_contest?.total_prize) {
        totalSpent = contest.contest_based_details.leaderboard_contest.total_prize;
    } else if (contest.contest_type === "cpm" && contest.contest_based_details?.cpm_contest?.total_budget) {
        totalSpent = contest.contest_based_details.cpm_contest.total_budget;
    }

    const daysRemaining = getDaysRemaining(contest.end_date);
    const isActive = daysRemaining > 0;
    const status = isActive ? "Active" : "Completed";

    // Platform-specific metrics
    const getPlatformMetrics = () => {
        const platform = contest.platform?.toLowerCase();

        if (platform === "instagram") {
            return [
                { icon: Users, label: "Submissions", value: contest.live_submission_count || 0 },
                { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
                { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
                { icon: MessageCircle, label: "Comments", value: totalComments.toLocaleString() },
                { icon: Share, label: "Shares", value: totalShares.toLocaleString() },
                { icon: TrendingUp, label: "Reach", value: totalReach.toLocaleString() },
                { icon: Target, label: "Saved", value: totalSaved.toLocaleString() },
            ];
        } else if (platform === "youtube") {
            return [
                { icon: Users, label: "Submissions", value: contest.live_submission_count || 0 },
                { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
                { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
                { icon: MessageCircle, label: "Comments", value: totalComments.toLocaleString() },
            ];
        } else {
            return [
                { icon: Users, label: "Submissions", value: contest.live_submission_count || 0 },
                { icon: Eye, label: "Views", value: totalViews.toLocaleString() },
                { icon: Heart, label: "Likes", value: totalLikes.toLocaleString() },
                { icon: MessageCircle, label: "Comments", value: totalComments.toLocaleString() },
            ];
        }
    };

    const platformMetrics = getPlatformMetrics();

    return (
        <Card
            className={`transition-all duration-300 hover:shadow-lg cursor-pointer group border-2 hover:border-purple-300 ${isHovered ? "shadow-lg border-purple-300" : "border-gray-200"
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onViewDetails(contest.id)}
        >
            <CardContent className="p-6">
                <div className="flex items-center gap-6">
                    {/* Contest Thumbnail */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-20 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center border-2 border-purple-200 group-hover:border-purple-300 transition-colors overflow-hidden">
                            {contest.thumbnail_url && contest.thumbnail_url.trim() !== "" ? (
                                <img
                                    src={contest.thumbnail_url}
                                    alt={contest.title}
                                    className="w-full h-full object-cover rounded-lg"
                                    onError={(e) => {
                                        // Hide image on error and show platform icon instead
                                        const img = e.currentTarget;
                                        const fallback = img.nextElementSibling as HTMLElement;
                                        img.style.display = 'none';
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div className="hidden flex items-center justify-center w-full h-full">
                                <PlatformIcon platform={contest.platform} />
                            </div>
                        </div>
                    </div>

                    {/* Contest Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-gray-900 truncate mb-3 group-hover:text-purple-700 transition-colors flex items-center gap-2">
                                    {contest.title}
                                    <PlatformIcon platform={contest.platform} />
                                </h3>
                                <div className="flex items-center gap-3">
                                    <Badge
                                        variant="outline"
                                        className={`text-sm px-3 py-1 ${getStatusColor(status)} font-medium`}
                                    >
                                        {status}
                                    </Badge>
                                    {isActive && (
                                        <span className="text-sm text-gray-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                                            ⏰ {daysRemaining > 0 ? `${daysRemaining} days left` : "Ended"}
                                        </span>
                                    )}
                                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full border">
                                        {contest.platform?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-purple-600 mb-1">
                                    {formatCurrencyFromCents(totalSpent)}
                                </div>
                                <div className="text-xs text-gray-500 font-medium">Total Payout</div>
                            </div>
                        </div>

                        {/* Platform-specific Metrics */}
                        <div className={`grid gap-3 mb-4 ${platform === "instagram"
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
                            : "grid-cols-2 md:grid-cols-4"
                            }`}>
                            {platformMetrics.map((metric, index) => {
                                const Icon = metric.icon;
                                return (
                                    <div key={index} className="bg-purple-50 rounded-lg p-3 group-hover:bg-purple-100 transition-colors border border-purple-100">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className="w-4 h-4 text-purple-600" />
                                            <span className="text-xs text-gray-700 font-medium">
                                                {metric.label}
                                            </span>
                                        </div>
                                        <div className="text-lg font-bold text-gray-900">
                                            {metric.value}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Contest Dates */}
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-purple-600" />
                                <span className="font-medium">Launch:</span>
                                <span>{formatDate(contest.start_date)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-600" />
                                <span className="font-medium">End:</span>
                                <span>{formatDate(contest.end_date)}</span>
                            </div>
                        </div>
                    </div>

                    {/* View Details Button */}
                    <div className="flex-shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-all duration-300 border-purple-300 text-purple-600 hover:bg-purple-50 hover:border-purple-400"
                        >
                            View Details →
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}