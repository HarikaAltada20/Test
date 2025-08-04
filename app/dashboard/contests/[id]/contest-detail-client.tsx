"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getMetricsRefreshCooldownInfoOwner, formatRemainingTime } from "@/lib/constants";

// Removed global type imports, defining them locally below
// import { type Contest } from "@/types/contest"; 
// import { type Submission } from "@/types/submission"; 

import { DeleteContestButton } from "@/components/delete-contest-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EnhancedTabs as Tabs, EnhancedTabsContent as TabsContent, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger } from "@/components/ui/enhanced-tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, formatTimeAgo, cn } from "@/lib/utils";
import { centsToDollars, formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import RejectionReasonModal from "@/components/RejectionReasonModal";
import PaymentModal from "@/components/PaymentModal";
import {
    ArrowLeft,
    Calendar,
    ChevronDown,
    Clock,
    CreditCard,
    DollarSign,
    Edit,
    ExternalLink,
    FileText,
    Lightbulb,
    ListOrdered,
    MoreVertical,
    PlayCircle,
    ThumbsUp,
    ThumbsDown,
    MessageCircle,
    Share2,
    Eye,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Trophy,
    Users,
    Instagram,
    Youtube,
    Loader2,
    Info,
    RefreshCw,
    Trash2,
    Monitor,
    Play,
    Settings,
    Wallet
} from "lucide-react";

// --- Local Type Definitions ---
interface Contest {
    id: string;
    title: string;
    // Moderation status (admin workflow)
    moderation_status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'rejected';
    // Contest lifecycle status (only for published contests)
    status: 'upcoming' | 'active' | 'ended' | 'incomplete' | 'unknown' | null;
    // Post-contest status for ended contests
    post_contest_status?: 'pending_review' | 'in_review' | 'verification_complete' | 'payouts_processed' | null;
    contest_type?: "leaderboard" | "cpm" | null;
    thumbnail_url?: string | null;
    brief_html?: string | null;
    platform?: string | null;
    start_date: string | null;
    end_date: string | null;
    rules_html?: string | null;
    inspiration_links?: { url: string; description: string }[] | null;
    resources?: any | null;
    contest_based_details?: any | null;
    last_metrics_updated?: string | null;
    // Payment information
    payment_details?: any | null;
    // Moderation tracking fields
    submitted_for_approval_at?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    published_at?: string | null;
    rejection_reason?: string | null;
}

interface Submission {
    id: string;
    created_at: string;
    content_link: string;
    status: 'pending' | 'verified' | 'rejected' | 'paid';
    views: number | null;
    other_stats: Record<string, any> | null;
    platform: string | null;
    video_thumbnail_url: string | null;
    creator_display_name: string | null;
    creator_username: string | null;
    creator_avatar_url: string | null;
    creator_id: string | null;
    earnings?: number | null; // Added for earnings display
}
// --- End Local Type Definitions ---

interface ContestDetailClientProps {
    contest: Contest;
    initialSubmissions: Submission[] | null;
    durationDays: number | null;
    contestId: string;
    isAdminView?: boolean;
}

export default function ContestDetailClient({
    contest,
    initialSubmissions,
    durationDays,
    contestId,
    isAdminView = false,
}: ContestDetailClientProps) {
    const supabase = createClient();
    const { toast, toasts } = useToast();

    // Debug: Log current toasts state
    console.log('🔍 Current toasts state:', toasts);
    const [currentSubmissions, setCurrentSubmissions] = useState<Submission[]>(initialSubmissions || []);
    const [isLoadingSubmission, setIsLoadingSubmission] = useState<Record<string, boolean>>({});
    const [currentContest, setCurrentContest] = useState<Contest>(contest);

    // Status update states
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [statusUpdateReason, setStatusUpdateReason] = useState('');

    // Refresh metrics state
    const [isRefreshingMetrics, setIsRefreshingMetrics] = useState(false);

    // Rejection modal state
    const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
    const [pendingRejectionSubmission, setPendingRejectionSubmission] = useState<string | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [pendingPaymentSubmission, setPendingPaymentSubmission] = useState<string | null>(null);
    const [activeStatusTab, setActiveStatusTab] = useState<'all' | 'pending' | 'verified' | 'rejected' | 'paid'>('all');

    const cooldownInfo = getMetricsRefreshCooldownInfoOwner(currentContest.last_metrics_updated);

    // Filter submissions based on active tab
    const filteredSubmissions = currentSubmissions.filter(submission => {
        if (activeStatusTab === 'all') return true;
        return submission.status === activeStatusTab;
    });

    // Test toast function
    const testToast = () => {
        console.log('🧪 Test toast called');
        const result = toast({
            title: "🧪 Test Toast",
            description: "This is a test toast to verify the system is working",
            duration: 3000,
        });
        console.log('🧪 Toast result:', result);
    };

    useEffect(() => {
        setCurrentSubmissions(initialSubmissions || []);
    }, [initialSubmissions]);

    useEffect(() => {
        setCurrentContest(contest);
    }, [contest]);

    if (!currentContest) {
        return <p>Loading contest details or contest not found...</p>;
    }

    { console.log("contest data", currentContest) }

    const getStatusBadgeProps = (contest: Contest) => {
        // For unpublished contests, show moderation status
        if (contest.moderation_status !== 'published') {
            switch (contest.moderation_status) {
                case "draft": return { text: "Draft", className: "bg-gray-500 text-white" };
                case "pending_approval": return { text: "Pending Approval", className: "bg-yellow-500 text-white" };
                case "approved": return { text: "Ready to Publish", className: "bg-blue-500 text-white" };
                case "rejected": return { text: "Rejected", className: "bg-red-500 text-white" };
                default: return { text: "Unknown", className: "bg-slate-400 text-white" };
            }
        }

        // For published contests, show lifecycle status
        switch (contest.status) {
            case "active": return { text: "Live", className: "bg-green-500 text-white" };
            case "upcoming": return { text: "Upcoming", className: "bg-blue-500 text-white" };
            case "ended":
                // Show post-contest status for ended contests
                if (contest.post_contest_status === "pending_review") {
                    return { text: "Pending Review", className: "bg-yellow-500 text-white" };
                }
                if (contest.post_contest_status === "in_review") {
                    return { text: "In Review", className: "bg-orange-500 text-white" };
                }
                if (contest.post_contest_status === "verification_complete") {
                    return { text: "Verified - Payment Processing", className: "bg-purple-500 text-white" };
                }
                if (contest.post_contest_status === "payouts_processed") {
                    return { text: "Verified - Payment Released", className: "bg-green-600 text-white" };
                }
                return { text: "Ended", className: "bg-gray-500 text-white" };
            case "incomplete": return { text: "Incomplete", className: "bg-yellow-500 text-black" };
            default: return { text: "Unknown", className: "bg-slate-400 text-white" };
        }
    };
    const contestStatusBadgeInfo = getStatusBadgeProps(currentContest);

    const getSubmissionStatusBadge = (status: Submission['status']) => {
        switch (status) {
            case "pending": return { text: "Pending", icon: <AlertTriangle className="h-3 w-3 mr-1.5" />, className: "bg-yellow-100 text-yellow-700 border-yellow-300" };
            case "verified": return { text: "Verified", icon: <CheckCircle2 className="h-3 w-3 mr-1.5" />, className: "bg-green-100 text-green-700 border-green-300" };
            case "rejected": return { text: "Rejected", icon: <XCircle className="h-3 w-3 mr-1.5" />, className: "bg-red-100 text-red-700 border-red-300" };
            case "paid": return { text: "Paid", icon: <DollarSign className="h-3 w-3 mr-1.5" />, className: "bg-sky-100 text-sky-700 border-sky-300" };
            default: return { text: "Unknown", icon: <AlertTriangle className="h-3 w-3 mr-1.5" />, className: "bg-gray-100 text-gray-700 border-gray-300" };
        }
    };

    const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: Submission['status'], reason?: string, paymentDetails?: { paymentProofUrl: string; paymentDescription: string }) => {
        console.log('🚀 Starting submission status update:', { submissionId, newStatus, reason });
        setIsLoadingSubmission(prev => ({ ...prev, [submissionId]: true }));
        try {
            const response = await fetch('/api/admin/verify-submission', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                    action: newStatus,
                    reason: reason || null,
                    paymentDetails: paymentDetails || null,
                }),
            });

            const result = await response.json();
            console.log('📡 API Response:', { status: response.status, result });

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update submission status');
            }

            // Update the local submissions state
            setCurrentSubmissions(prev =>
                prev.map(sub =>
                    sub.id === submissionId
                        ? { ...sub, status: newStatus }
                        : sub
                )
            );

            // Enhanced toast messages for better UX
            const getToastConfig = (status: Submission['status']) => {
                switch (status) {
                    case 'verified':
                        return {
                            title: "✅ Submission Verified",
                            description: "Content has been verified and is now eligible for rewards",
                            variant: "default" as const
                        };
                    case 'rejected':
                        return {
                            title: "❌ Submission Rejected",
                            description: reason ? `Rejected: ${reason.split('\n')[0]}` : "Submission has been rejected",
                            variant: "destructive" as const
                        };
                    case 'pending':
                        return {
                            title: "⏳ Status Reset to Pending",
                            description: "Submission is back in pending review",
                            variant: "default" as const
                        };
                    case 'paid':
                        return {
                            title: "💰 Payment Confirmed",
                            description: "Payment has been processed and confirmed",
                            variant: "default" as const
                        };
                    default:
                        return {
                            title: "Status Updated",
                            description: result.message || `Submission status updated to ${newStatus}`,
                            variant: "default" as const
                        };
                }
            };

            const toastConfig = getToastConfig(newStatus);
            console.log('🎉 Calling toast with config:', toastConfig);
            toast(toastConfig);
        } catch (error: any) {
            console.error('Error updating submission status:', error);

            // Enhanced error toast messages
            let errorTitle = "❌ Update Failed";
            let errorDescription = error.message || "Failed to update submission status";

            // Provide more specific error messages based on common scenarios
            if (error.message?.includes('Unauthorized') || error.message?.includes('Authentication')) {
                errorTitle = "🔒 Access Denied";
                errorDescription = "You don't have permission to perform this action";
            } else if (error.message?.includes('not found')) {
                errorTitle = "🔍 Not Found";
                errorDescription = "Submission could not be found";
            } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorTitle = "🌐 Connection Error";
                errorDescription = "Network error. Please check your connection and try again";
            }

            console.log('❌ Calling error toast:', { errorTitle, errorDescription });
            toast({
                title: errorTitle,
                description: errorDescription,
                variant: "destructive",
            });
        } finally {
            setIsLoadingSubmission(prev => ({ ...prev, [submissionId]: false }));
        }
    };

    const handleRejectSubmission = (submissionId: string) => {
        setPendingRejectionSubmission(submissionId);
        setRejectionModalOpen(true);
    };

    const handleRejectionConfirm = (reason: string, additionalNotes?: string) => {
        if (pendingRejectionSubmission) {
            // Combine reason with additional notes if provided
            const fullReason = additionalNotes ? `${reason}\n\nAdditional Notes: ${additionalNotes}` : reason;
            handleUpdateSubmissionStatus(pendingRejectionSubmission, 'rejected', fullReason);
            setRejectionModalOpen(false);
            setPendingRejectionSubmission(null);
        }
    };

    const handleMarkAsPaid = (submissionId: string) => {
        setPendingPaymentSubmission(submissionId);
        setPaymentModalOpen(true);
    };

    const handlePaymentConfirm = (paymentDetails: { paymentProofUrl: string; paymentDescription: string }) => {
        if (pendingPaymentSubmission) {
            handleUpdateSubmissionStatus(pendingPaymentSubmission, 'paid', undefined, paymentDetails);
            setPaymentModalOpen(false);
            setPendingPaymentSubmission(null);
        }
    };

    const handleUpdateContestStatus = async () => {
        if (!selectedStatus) {
            toast({
                title: "Error",
                description: "Please select a status",
                variant: "destructive",
            });
            return;
        }

        setIsUpdatingStatus(true);
        try {
            const response = await fetch(`/api/contests/${contestId}/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: selectedStatus,
                    reason: statusUpdateReason || null,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update status');
            }

            // Update the local contest state
            setCurrentContest(prev => ({
                ...prev,
                post_contest_status: selectedStatus as any,
            }));

            // Enhanced contest status update toast
            const getContestStatusToast = (status: string) => {
                switch (status) {
                    case 'pending_review':
                        return {
                            title: "📋 Status: Pending Review",
                            description: "Contest is now pending review phase",
                        };
                    case 'in_review':
                        return {
                            title: "🔍 Status: In Review",
                            description: "Contest is currently under review",
                        };
                    case 'verification_complete':
                        return {
                            title: "✅ Status: Verification Complete",
                            description: "All submissions have been verified",
                        };
                    case 'payouts_processed':
                        return {
                            title: "💰 Status: Payouts Processed",
                            description: "All payments have been processed",
                        };
                    default:
                        return {
                            title: "Status Updated",
                            description: result.message,
                        };
                }
            };

            const contestToastConfig = getContestStatusToast(selectedStatus);
            toast(contestToastConfig);

            setStatusUpdateDialog(false);
            setSelectedStatus('');
            setStatusUpdateReason('');
        } catch (error: any) {
            console.error('Error updating contest status:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to update contest status",
                variant: "destructive",
            });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const canUpdateContestStatus = () => {
        return currentContest.moderation_status === 'published' &&
            currentContest.status === 'ended' &&
            currentContest.post_contest_status !== 'payouts_processed';
    };

    const getAvailableStatusOptions = () => {
        const current = currentContest.post_contest_status;
        const options = [
            { value: 'pending_review', label: 'Pending Review', description: 'Contest submissions are under initial review' },
            { value: 'in_review', label: 'In Review', description: 'Active review of submissions in progress' },
            { value: 'verification_complete', label: 'Verification Complete', description: 'All submissions verified, preparing payouts' },
            { value: 'payouts_processed', label: 'Payouts Processed', description: 'All payments have been released' },
        ];

        // For non-admin users (brands), exclude payouts_processed and only allow moving forward
        if (!isAdminView) {
            const currentIndex = options.findIndex(opt => opt.value === current);
            return options
                .filter(opt => opt.value !== 'payouts_processed') // Brands cannot set payouts_processed
                .filter((_, index) => index > currentIndex);
        }

        // For admins, show all options except current
        return options.filter(opt => opt.value !== current);
    };

    const handleRefreshMetrics = async () => {
        // Prevent multiple clicks
        if (isRefreshingMetrics) {
            return;
        }

        // Check rate limiting based on database value
        if (!cooldownInfo.canRefresh) {
            toast({
                title: "Please Wait",
                description: `You can refresh again in ${cooldownInfo.remainingMinutes} minute${cooldownInfo.remainingMinutes !== 1 ? 's' : ''}`,
                variant: "destructive",
            });
            return;
        }

        setIsRefreshingMetrics(true);

        try {
            // Add timeout for long-running requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

            const response = await fetch(`/api/contests/${contestId}/refresh-metrics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to refresh metrics');
            }

            toast({
                title: "Success! 🎉",
                description: `${result.message}. Budget and leaderboard updated!`,
            });

            // Refresh the page to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error: any) {
            console.error('Failed to refresh metrics:', error);

            if (error.name === 'AbortError') {
                toast({
                    title: "Request Timeout",
                    description: "The refresh is taking longer than expected. Please check back in a few minutes.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Refresh Failed",
                    description: error.message || "Could not refresh metrics. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsRefreshingMetrics(false);
        }
    };

    const formatStatKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };



    const getPlatformIcon = (platform?: string | null) => {
        const lowerPlatform = platform?.toLowerCase();
        if (lowerPlatform?.includes("youtube")) return <Youtube className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
        if (lowerPlatform?.includes("instagram")) return <Instagram className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
        return <Share2 className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
    }

    const extractPlatformMetrics = (submission: Submission) => {
        const platform = submission.platform?.toLowerCase();
        const stats = submission.other_stats || {};
        const baseViews = submission.views || 0;

        // Extract platform-specific metrics
        if (platform?.includes('youtube')) {
            const youtubeStats = stats.youtube || stats;
            return {
                views: baseViews,
                likes: youtubeStats.likes || youtubeStats.like_count || 0,
                comments: youtubeStats.comments || youtubeStats.comment_count || 0,
                shares: 0, // Not available
                subscribers_gained: 0, // Not available
                watch_time: 0, // Not available
                engagement_rate: 0, // Not available
            };
        } else if (platform?.includes('instagram')) {
            const igStats = stats.instagram || stats;
            return {
                views: baseViews,
                likes: igStats.likes || igStats.like_count || 0,
                comments: igStats.comments || igStats.comment_count || 0,
                shares: igStats.shares || igStats.share_count || 0,
                saves: igStats.saved || 0,
                reach: igStats.reach || 0,
                impressions: igStats.impressions || 0,
                engagement_rate: igStats.engagement_rate || 0,
                total_interactions: igStats.total_interactions || 0,
            };
        } else {
            // Generic platform metrics
            return {
                views: baseViews,
                likes: stats.likes || stats.like_count || 0,
                comments: stats.comments || stats.comment_count || 0,
                shares: stats.shares || stats.share_count || 0,
                engagement_rate: stats.engagement_rate || 0,
            };
        }
    };

    const formatMetricValue = (value: any, isRate = false) => {
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'number') {
            if (isRate) {
                return `${(value * 100).toFixed(1)}%`;
            }
            return value.toLocaleString();
        }
        return String(value);
    };

    const handleShare = async () => {
        if (contest.status === 'ended') {
            toast({
                title: 'Opportunity Ended',
                description: 'This opportunity has ended. Creators can no longer submit entries.',
                variant: 'destructive',
            });
            return;
        }

        if (contest.status === 'upcoming') {
            toast({
                title: 'Not Live Yet',
                description: "This opportunity is not live yet. You can share it, but creators won't be able to participate until the start date.",
                variant: 'default',
            });
            // Allow sharing to proceed
        }

        const shareUrl = `${window.location.origin}/dashboard/opportunities/${contest.id}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: contest.title,
                    text: `Check out this opportunity: ${contest.title}`,
                    url: shareUrl,
                });
            } else {
                await navigator.clipboard.writeText(shareUrl);
                toast({
                    title: 'Link Copied',
                    description: 'Opportunity link copied to clipboard!',
                    variant: 'default',
                });
            }
        } catch (error) {
            console.error('Error sharing:', error);
            toast({
                title: 'Share Failed',
                description: 'There was an error trying to share this opportunity.',
                variant: 'destructive',
            });
        }
    };


    const isContestEditable = currentContest.moderation_status === 'draft' || currentContest.moderation_status === 'rejected' ||
        (currentContest.moderation_status === 'approved' && currentContest.status === 'upcoming');
    const isContestDeletable = currentContest.moderation_status === 'draft' || currentContest.moderation_status === 'rejected';

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={isAdminView ? "/dashboard/admin/contests" : "/dashboard/contests"}>
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold text-gray-900">{currentContest.title}</h1>
                <Badge className={cn(contestStatusBadgeInfo.className, "ml-3 text-xs shadow-sm")}>
                    {contestStatusBadgeInfo.text}
                </Badge>
                {currentContest.contest_type && (
                    <Badge
                        variant={currentContest.contest_type === 'cpm' ? 'secondary' : 'default'}
                        className="capitalize ml-2 text-xs shadow-sm"
                    >
                        {currentContest.contest_type === 'cpm' ? 'CPM' : 'Leaderboard'}
                    </Badge>
                )}
            </div>

            {/* Modern Contest Overview - Redesigned for better UX */}
            <div className="space-y-6 mb-8">
                {/* Quick Actions Bar */}
                <div className="flex items-center justify-end gap-2 mb-6">

                    {/* Test Toast Button */}
                    <Button size="sm" variant="outline" onClick={testToast} className="border-blue-200 text-blue-700 hover:bg-blue-50 shadow-sm">
                        🧪 Test Toast
                    </Button>

                    {/* Contest Status Update Button */}
                    {canUpdateContestStatus() && (
                        <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Update Status
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Update Contest Status</DialogTitle>
                                    <DialogDescription>
                                        Change the post-contest status to reflect the current stage of verification and payouts.
                                        Current status: <strong>{currentContest.post_contest_status || 'Not set'}</strong>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <label htmlFor="status" className="text-sm font-medium">
                                            New Status
                                        </label>
                                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select new status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getAvailableStatusOptions().map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{option.label}</span>
                                                            <span className="text-xs text-muted-foreground">{option.description}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="reason" className="text-sm font-medium">
                                            Reason (Optional)
                                        </label>
                                        <Textarea
                                            id="reason"
                                            placeholder="Add a note about this status change..."
                                            value={statusUpdateReason}
                                            onChange={(e) => setStatusUpdateReason(e.target.value)}
                                            className="resize-none"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setStatusUpdateDialog(false)}
                                        disabled={isUpdatingStatus}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleUpdateContestStatus}
                                        disabled={isUpdatingStatus || !selectedStatus}
                                    >
                                        {isUpdatingStatus ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            'Update Status'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 transition-all duration-200 hover:scale-105"
                        onClick={handleShare}
                    >
                        <Share2 className="h-4 w-4" />
                        <span className="hidden sm:inline font-medium">Share</span>
                    </Button>

                    {isContestEditable && (
                        <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" asChild>
                            <Link href={isAdminView ? `/dashboard/admin/contests/${contestId}/edit` : `/dashboard/contests/${contestId}/edit`}>
                                <Edit className="h-4 w-4" />
                            </Link>
                        </Button>
                    )}

                    {isContestDeletable && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            asChild
                        >
                            <DeleteContestButton
                                contestId={contestId}
                                contestTitle={currentContest.title || 'this contest'}
                                isDeletable={isContestDeletable}
                            />
                        </Button>
                    )}
                </div>

                {/* Colorful Contest Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Platform Card */}
                    <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    {getPlatformIcon(currentContest.platform)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wide">Platform</p>
                                    <p className="text-lg font-bold text-red-900 dark:text-red-100 capitalize">{currentContest.platform || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Duration Card */}
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Duration</p>
                                    <p className="text-lg font-bold text-green-900 dark:text-green-100">{durationDays !== null ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : 'N/A'}</p>
                                    {currentContest.start_date && currentContest.end_date && (
                                        <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                            {formatLocalDateTime(currentContest.start_date, { month: 'short', day: 'numeric' })} - {formatLocalDateTime(currentContest.end_date, { month: 'short', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Prize/Budget Card */}
                    {(currentContest.contest_type === 'leaderboard' && currentContest.contest_based_details?.leaderboard_contest?.total_prize != null) && (
                        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700/50 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                        <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">Prize Pool</p>
                                        <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">{currentContest.contest_based_details.leaderboard_contest.winner_count} winners</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(currentContest.contest_type === 'cpm' && currentContest.contest_based_details?.cpm_contest?.total_budget != null) && (
                        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                        <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Total Budget</p>
                                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatMoney(currentContest.contest_based_details.cpm_contest.total_budget)}</p>
                                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">${currentContest.contest_based_details.cpm_contest.cpm_rate_usd} CPM</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Submissions Count Card */}
                    <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Submissions</p>
                                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100">{currentSubmissions.length}</p>
                                    <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">Total entries</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content Tabs */}
            <div className="mt-8">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList>
                        <TabsTrigger value="overview">
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="submissions">
                            Submissions <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">({currentSubmissions.length})</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="analytics">
                            Analytics
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-6 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                                <CardTitle className="text-gray-800 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                    Contest Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6 p-6">
                                {currentContest.thumbnail_url && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">Thumbnail</h3>
                                        <div className="flex justify-center">
                                            <img
                                                src={currentContest.thumbnail_url}
                                                alt={`${currentContest.title} thumbnail`}
                                                className="max-w-full max-h-80 object-contain border rounded-lg shadow-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <h3 className="font-semibold text-lg text-foreground">Brief</h3>
                                    {currentContest.brief_html ? (
                                        <div
                                            className="prose prose-sm max-w-none text-foreground bg-muted/30 p-4 rounded-lg border"
                                            dangerouslySetInnerHTML={{ __html: currentContest.brief_html }}
                                        />
                                    ) : (
                                        <p className="text-muted-foreground bg-muted/30 p-4 rounded-lg border">No brief provided</p>
                                    )}
                                </div>

                                {/* Contest Info Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Platform Card */}
                                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Platform</p>
                                                    <p className="text-lg font-bold text-blue-900 dark:text-blue-100 capitalize">
                                                        {currentContest.platform}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Status Card */}
                                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">Status</p>
                                                    <p className="text-lg font-bold text-purple-900 dark:text-purple-100 capitalize">
                                                        {contestStatusBadgeInfo.text}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Date & Time Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Start Date Card */}
                                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Start Date & Time</p>
                                                    <p className="text-lg font-bold text-green-900 dark:text-green-100">
                                                        {formatLocalDateTime(currentContest.start_date)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* End Date Card */}
                                    <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200 dark:border-orange-700/50 hover:shadow-lg transition-all duration-300">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                                                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs font-medium text-orange-800 dark:text-orange-300 uppercase tracking-wide">End Date & Time</p>
                                                    <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                                                        {formatLocalDateTime(currentContest.end_date)}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Conditional Prize Structure / CPM Details */}
                                {currentContest.contest_type === 'leaderboard' && currentContest.contest_based_details?.leaderboard_contest && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg text-foreground">Prize Structure</h3>

                                        {/* Prize Pool Summary */}
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                                                        <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Total Prize Pool</p>
                                                        <p className="text-xl font-bold text-green-900 dark:text-green-100">
                                                            {formatMoney(currentContest.contest_based_details.leaderboard_contest.total_prize)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                                                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Total Winners</p>
                                                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                                            {currentContest.contest_based_details.leaderboard_contest.winner_count}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Prize Distribution */}
                                        <div className="bg-muted/30 rounded-lg p-4 border">
                                            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                                <ListOrdered className="h-4 w-4" />
                                                Prize Distribution
                                            </h4>
                                            <div className="space-y-2">
                                                {Array.isArray(currentContest.contest_based_details.leaderboard_contest.prizes) &&
                                                    currentContest.contest_based_details.leaderboard_contest.prizes
                                                        .sort((a: any, b: any) => a.position - b.position)
                                                        .map((prize: any, index: number) => (
                                                            <div
                                                                key={index}
                                                                className="flex items-center justify-between py-3 px-3 bg-background rounded-lg border border-border"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                                        {prize.position}
                                                                    </div>
                                                                    <span className="font-medium text-foreground">
                                                                        Position {prize.position}
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                                                                    {formatMoney(prize.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {currentContest.contest_type === 'cpm' && currentContest.contest_based_details?.cpm_contest && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">CPM Configuration</h3>
                                        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
                                            <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                <span className="text-sm font-medium text-muted-foreground">CPM Rate:</span>
                                                <span className="font-semibold text-foreground">
                                                    ${parseFloat(currentContest.contest_based_details.cpm_contest.cpm_rate_usd).toFixed(2)} per 1000 views
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                <span className="text-sm font-medium text-muted-foreground">Total Budget:</span>
                                                <span className="font-semibold text-foreground">
                                                    {formatMoney(currentContest.contest_based_details.cpm_contest.total_budget)}
                                                </span>
                                            </div>
                                            {currentContest.contest_based_details.cpm_contest.min_views != null && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                    <span className="text-sm font-medium text-muted-foreground">Min Views:</span>
                                                    <span className="font-semibold text-foreground">
                                                        {currentContest.contest_based_details.cpm_contest.min_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            {currentContest.contest_based_details.cpm_contest.max_views != null && (
                                                <div className="flex justify-between items-center p-2 bg-background rounded border">
                                                    <span className="text-sm font-medium text-muted-foreground">Max Views (Cap):</span>
                                                    <span className="font-semibold text-foreground">
                                                        {currentContest.contest_based_details.cpm_contest.max_views.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="text-sm font-medium mt-3 mb-2 text-foreground">Terms & Conditions</h4>
                                                <div className="p-3 border rounded-lg bg-background text-sm text-foreground">
                                                    <div className="whitespace-pre-wrap break-words">
                                                        {currentContest.contest_based_details.cpm_contest.terms_conditions || "No specific terms provided."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Information */}
                                {(currentContest as any).payment_details && (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-lg text-foreground">Payment Information</h3>

                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl p-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
                                                        <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 uppercase tracking-wide">Prize Pool</p>
                                                        <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                                                            {(() => {
                                                                const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                                    ? JSON.parse((currentContest as any).payment_details)
                                                                    : (currentContest as any).payment_details;
                                                                return formatMoney(paymentDetails.total_prize_pool || 0);
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-purple-100 dark:bg-purple-800/30 rounded-lg">
                                                        <CreditCard className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-purple-800 dark:text-purple-300 uppercase tracking-wide">
                                                            Commission ({(() => {
                                                                const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                                    ? JSON.parse((currentContest as any).payment_details)
                                                                    : (currentContest as any).payment_details;
                                                                return paymentDetails.commission_percentage || 0;
                                                            })()}%)
                                                        </p>
                                                        <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                                                            {(() => {
                                                                const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                                    ? JSON.parse((currentContest as any).payment_details)
                                                                    : (currentContest as any).payment_details;
                                                                return formatMoney(paymentDetails.commission_amount || 0);
                                                            })()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Total Paid and Payment Method */}
                                            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700/50">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                                                            <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wide">Total Paid</p>
                                                            <p className="text-lg font-bold text-green-900 dark:text-green-100">
                                                                {(() => {
                                                                    const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                                        ? JSON.parse((currentContest as any).payment_details)
                                                                        : (currentContest as any).payment_details;
                                                                    return formatMoney(paymentDetails.total_amount_paid || 0);
                                                                })()}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {(() => {
                                                        const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                            ? JSON.parse((currentContest as any).payment_details)
                                                            : (currentContest as any).payment_details;
                                                        const walletUsed = paymentDetails.wallet_amount_used || 0;
                                                        const stripeUsed = paymentDetails.stripe_amount_paid || 0;

                                                        if (walletUsed > 0 && stripeUsed > 0) {
                                                            // Split payment
                                                            return (
                                                                <>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg">
                                                                            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">From Wallet</p>
                                                                            <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                                                                                {formatMoney(walletUsed)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
                                                                            <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">From Card</p>
                                                                            <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                                                                                {formatMoney(stripeUsed)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            );
                                                        } else if (walletUsed > 0) {
                                                            // Wallet only
                                                            return (
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-800/30 rounded-lg">
                                                                        <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Payment Method</p>
                                                                        <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Wallet</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else if (stripeUsed > 0) {
                                                            // Credit card only
                                                            return (
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-800/30 rounded-lg">
                                                                        <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">Payment Method</p>
                                                                        <p className="text-lg font-bold text-indigo-900 dark:text-indigo-100">Credit Card</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>

                                                {/* Payment Status and Date */}
                                                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700/50 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                        <span className="text-sm font-medium text-green-800 dark:text-green-300">
                                                            Payment {(() => {
                                                                const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                                    ? JSON.parse((currentContest as any).payment_details)
                                                                    : (currentContest as any).payment_details;
                                                                return paymentDetails.payment_status === 'completed' ? 'Completed' : 'Pending';
                                                            })()}
                                                        </span>
                                                    </div>
                                                    {(() => {
                                                        const paymentDetails = typeof (currentContest as any).payment_details === 'string'
                                                            ? JSON.parse((currentContest as any).payment_details)
                                                            : (currentContest as any).payment_details;
                                                        return paymentDetails.paid_at ? (
                                                            <span className="text-xs text-blue-700 dark:text-blue-400">
                                                                Paid on {formatLocalDateTime(paymentDetails.paid_at, {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(currentContest as any).rules_html && (
                                    <div className="space-y-3">
                                        <h3 className="font-semibold text-lg text-foreground">Rules</h3>
                                        <div className="border rounded-lg p-4 bg-muted/30">
                                            <div
                                                className="prose prose-sm max-w-none text-foreground"
                                                dangerouslySetInnerHTML={{ __html: (currentContest as any).rules_html }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Render inspiration links if present */}
                                {Array.isArray(currentContest.inspiration_links) &&
                                    currentContest.inspiration_links.length > 0 && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                                <ExternalLink className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                Inspiration Links
                                            </h3>
                                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl p-4">
                                                <div className="space-y-3">
                                                    {currentContest.inspiration_links.map((item, idx) => (
                                                        <div key={idx} className="flex items-center gap-3">
                                                            <ExternalLink className="w-6 h-6 text-purple-500" />
                                                            <div className="flex-1">
                                                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline break-all">{item.url}</a>
                                                                <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                {currentContest.resources &&
                                    ((Array.isArray(currentContest.resources) && currentContest.resources.length > 0) ||
                                        (typeof currentContest.resources === 'object' && Object.keys(currentContest.resources).length > 0)) && (
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                                                <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                Resources
                                            </h3>
                                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700/50 rounded-xl p-4">
                                                <div className="space-y-3">
                                                    {(Array.isArray(currentContest.resources) ? currentContest.resources :
                                                        Object.entries(currentContest.resources).map(([description, url]) => ({ url, description, type: 'external' }))
                                                    ).map((resource, idx) => {
                                                        const isImage = resource.url.startsWith('data:image') || /\.(jpg|jpeg|png|gif|jfif|webp)$/i.test(resource.url);
                                                        const isPdf = /\.pdf$/i.test(resource.url);
                                                        const isVideo = /\.(mp4|mov|avi|webm)$/i.test(resource.url);
                                                        const isInternal = resource.type === "internal";
                                                        return (
                                                            <Card
                                                                key={idx}
                                                                className="bg-white dark:bg-slate-800/50 border border-green-200 dark:border-green-700/30 hover:shadow-md transition-all duration-300"
                                                            >
                                                                <CardContent className="p-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            {isInternal && isImage && !isPdf ? (
                                                                                <img src={resource.url} alt={resource.description} className="w-10 h-10 object-cover rounded" />
                                                                            ) : isInternal && isPdf ? (
                                                                                <span className="inline-block">
                                                                                    <svg width="32" height="32" fill="none" viewBox="0 0 40 40">
                                                                                        <rect width="40" height="40" rx="8" fill="#F87171" />
                                                                                        <path d="M12 8h16v24H12V8z" fill="#fff" />
                                                                                        <path d="M14 12h12M14 16h12M14 20h8" stroke="#F87171" strokeWidth="1" />
                                                                                        <text x="20" y="28" textAnchor="middle" fill="#F87171" fontSize="8" fontWeight="bold">PDF</text>
                                                                                    </svg>
                                                                                </span>
                                                                            ) : isInternal && isVideo ? (
                                                                                <span className="inline-block">
                                                                                    <svg width="32" height="32" fill="none" viewBox="0 0 40 40">
                                                                                        <rect width="40" height="40" rx="8" fill="#38BDF8" />
                                                                                        <rect x="10" y="12" width="20" height="16" rx="2" fill="#fff" />
                                                                                        <path d="M16 16l6 4-6 4V16z" fill="#38BDF8" />
                                                                                        <circle cx="32" cy="14" r="3" fill="#FF4444" />
                                                                                    </svg>
                                                                                </span>
                                                                            ) : isInternal && !isImage && !isPdf && !isVideo ? (
                                                                                <span className="inline-block">
                                                                                    <svg width="32" height="32" fill="none" viewBox="0 0 40 40">
                                                                                        <rect width="40" height="40" rx="8" fill="#10B981" />
                                                                                        <rect x="10" y="8" width="18" height="24" rx="1" fill="#fff" />
                                                                                        <rect x="12" y="10" width="14" height="2" fill="#10B981" />
                                                                                        <rect x="12" y="14" width="14" height="1" fill="#10B981" />
                                                                                        <rect x="12" y="17" width="14" height="1" fill="#10B981" />
                                                                                        <rect x="12" y="20" width="10" height="1" fill="#10B981" />
                                                                                        <rect x="12" y="23" width="12" height="1" fill="#10B981" />
                                                                                        <rect x="12" y="26" width="8" height="1" fill="#10B981" />
                                                                                    </svg>
                                                                                </span>
                                                                            ) : (
                                                                                <div className="p-2 bg-green-100 dark:bg-green-800/30 rounded-lg">
                                                                                    <ExternalLink className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <span className="font-semibold text-green-900 dark:text-green-100">{resource.description}</span>
                                                                                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                                    {resource.type === "external" ? "External Link" : "Uploaded File"}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            asChild
                                                                            className="text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-800/20 flex-shrink-0 font-medium"
                                                                        >
                                                                            <a
                                                                                href={resource.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                            >
                                                                                <ExternalLink className="h-4 w-4 mr-1" />
                                                                                {isPdf ? "Open PDF" : isVideo ? "Play Video" : isImage ? "View Image" : "View Resource"}
                                                                            </a>
                                                                        </Button>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="submissions" className="mt-6">
                        {currentSubmissions.length > 0 ? (
                            <div className="space-y-6">
                                {/* Enhanced Header Section */}
                                <Card className="shadow-sm border-0 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                                                    <Trophy className="h-6 w-6 text-white" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                                        Submissions Leaderboard
                                                    </h2>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <Badge variant="secondary" className="px-3 py-1">
                                                            {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
                                                        </Badge>
                                                        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                                            {currentContest.platform}
                                                        </div>
                                                        {currentContest.last_metrics_updated && (
                                                            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                                                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                                                Last updated: {formatTimeAgo(currentContest.last_metrics_updated)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {(currentContest.moderation_status === 'published' && (currentContest.status === 'active' || currentContest.status === 'ended')) && currentSubmissions && currentSubmissions.length > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleRefreshMetrics}
                                                        disabled={isRefreshingMetrics || !cooldownInfo.canRefresh}
                                                        className={`flex items-center gap-2 shadow-sm ${cooldownInfo.canRefresh && !isRefreshingMetrics
                                                            ? 'border-green-200 text-green-700 hover:bg-green-50'
                                                            : 'border-gray-200 text-gray-500 cursor-not-allowed'
                                                            }`}
                                                        title={!cooldownInfo.canRefresh ? `Please wait ${cooldownInfo.remainingMinutes} more minute${cooldownInfo.remainingMinutes !== 1 ? 's' : ''}` : undefined}
                                                    >
                                                        {isRefreshingMetrics ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="h-4 w-4" />
                                                        )}
                                                        {isRefreshingMetrics ? 'Updating...' :
                                                            !cooldownInfo.canRefresh ? `Wait ${cooldownInfo.remainingMinutes}m` : 'Refresh Metrics'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Enhanced Status Filter Tabs */}
                                <Card className="shadow-sm">
                                    <CardContent className="p-4">
                                        <Tabs value={activeStatusTab} onValueChange={(value) => setActiveStatusTab(value as any)} className="w-full">
                                            <TabsList className="flex w-full h-auto p-1 bg-slate-100 rounded-lg">
                                                <TabsTrigger
                                                    value="all"
                                                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 hover:bg-white/50 rounded-md"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" />
                                                        <span className="text-xs font-medium">All</span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="px-1.5 py-0.5 text-xs h-5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                                    >
                                                        {currentSubmissions.length}
                                                    </Badge>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="pending"
                                                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 hover:bg-white/50 rounded-md"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        <span className="text-xs font-medium">Pending</span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="px-1.5 py-0.5 text-xs h-5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                                    >
                                                        {currentSubmissions.filter(s => s.status === 'pending').length}
                                                    </Badge>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="verified"
                                                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 hover:bg-white/50 rounded-md"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        <span className="text-xs font-medium">Verified</span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="px-1.5 py-0.5 text-xs h-5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                                    >
                                                        {currentSubmissions.filter(s => s.status === 'verified').length}
                                                    </Badge>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="rejected"
                                                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 hover:bg-white/50 rounded-md"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <XCircle className="h-3 w-3" />
                                                        <span className="text-xs font-medium">Rejected</span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="px-1.5 py-0.5 text-xs h-5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                                    >
                                                        {currentSubmissions.filter(s => s.status === 'rejected').length}
                                                    </Badge>
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="paid"
                                                    className="flex-1 flex flex-col items-center gap-1 py-2 px-1 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 hover:bg-white/50 rounded-md"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <Wallet className="h-3 w-3" />
                                                        <span className="text-xs font-medium">Paid</span>
                                                    </div>
                                                    <Badge
                                                        variant="secondary"
                                                        className="px-1.5 py-0.5 text-xs h-5 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                                                    >
                                                        {currentSubmissions.filter(s => s.status === 'paid').length}
                                                    </Badge>
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </CardContent>
                                </Card>

                                {/* Enhanced Submissions Table */}
                                <Card className="shadow-sm">
                                    <CardContent className="p-0">
                                        <div className="overflow-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-slate-100 hover:bg-slate-100 border-b border-slate-200">
                                                        <TableHead className="w-12">#</TableHead>
                                                        <TableHead>Creator</TableHead>
                                                        <TableHead className="text-center">Views</TableHead>
                                                        <TableHead className="text-center">Likes</TableHead>
                                                        <TableHead className="text-center">Comments</TableHead>
                                                        {/* Dynamic headers based on contest platform */}
                                                        {currentContest.platform?.toLowerCase().includes('instagram') && (
                                                            <>
                                                                <TableHead className="text-center">Shares</TableHead>
                                                                <TableHead className="text-center">Saves</TableHead>
                                                                <TableHead className="text-center">Reach</TableHead>
                                                                <TableHead className="text-center">Interactions</TableHead>
                                                                {/* <TableHead className="text-center">Engagement Rate</TableHead> */}
                                                            </>
                                                        )}
                                                        <TableHead className="text-center">Reward</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead className="text-center">Submitted</TableHead>
                                                        <TableHead className="text-center">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredSubmissions
                                                        .sort((a, b) => (b.views || 0) - (a.views || 0)) // Sort by views descending
                                                        .map((submission, index) => {
                                                            const metrics = extractPlatformMetrics(submission);
                                                            const submissionStatus = getSubmissionStatusBadge(submission.status);
                                                            const isLoading = isLoadingSubmission[submission.id] || false;
                                                            const rank = index + 1;

                                                            // Calculate reward/earnings display with proper color coding
                                                            const getRewardDisplay = () => {
                                                                // For rejected submissions - RED
                                                                if (submission.status === 'rejected') {
                                                                    return {
                                                                        amount: 0,
                                                                        label: "No Reward",
                                                                        className: "text-red-600 font-semibold"
                                                                    };
                                                                }

                                                                // For paid submissions - BLUE
                                                                if (submission.status === 'paid') {
                                                                    const earningsInDollars = submission.earnings ? centsToDollars(submission.earnings) : 0;
                                                                    return {
                                                                        amount: earningsInDollars,
                                                                        label: "Paid",
                                                                        className: "text-blue-600 font-semibold"
                                                                    };
                                                                }

                                                                // For leaderboard contests
                                                                if (currentContest.contest_type === 'leaderboard') {
                                                                    const contestDetails = currentContest.contest_based_details?.leaderboard_contest;
                                                                    const postContestStatus = currentContest.post_contest_status;
                                                                    const isContestCompleted = postContestStatus === 'verification_complete' || postContestStatus === 'payouts_processed';

                                                                    // If contest is completed and earnings are calculated
                                                                    if (isContestCompleted && submission.earnings !== null && submission.earnings !== undefined) {
                                                                        const earningsInDollars = centsToDollars(submission.earnings);
                                                                        if (earningsInDollars > 0) {
                                                                            return {
                                                                                amount: earningsInDollars,
                                                                                label: "Prize Won",
                                                                                className: "text-green-600 font-semibold"
                                                                            };
                                                                        } else {
                                                                            return {
                                                                                amount: 0,
                                                                                label: "No Prize Won",
                                                                                className: "text-gray-600"
                                                                            };
                                                                        }
                                                                    }

                                                                    // If contest is not completed yet
                                                                    if (!isContestCompleted) {
                                                                        // Calculate estimated prize based on ranking and prize distribution
                                                                        if (contestDetails?.prizes && Array.isArray(contestDetails.prizes)) {
                                                                            const currentRank = index + 1; // 1-based ranking
                                                                            const prizeForRank = contestDetails.prizes.find((prize: any) => prize.position === currentRank);

                                                                            if (prizeForRank) {
                                                                                const prizeAmount = centsToDollars(prizeForRank.amount);
                                                                                return {
                                                                                    amount: prizeAmount,
                                                                                    label: "Winning Zone",
                                                                                    className: "text-pink-600 font-semibold"
                                                                                };
                                                                            }
                                                                        }

                                                                        // Fallback if no prize distribution found
                                                                        return {
                                                                            amount: 0,
                                                                            label: "TBD",
                                                                            className: "text-yellow-600 font-semibold"
                                                                        };
                                                                    }
                                                                }

                                                                // For CPM contests
                                                                if (currentContest.contest_type === 'cpm') {
                                                                    const cpmConfig = currentContest.contest_based_details?.cpm_contest;
                                                                    const views = submission.views || 0;
                                                                    const postContestStatus = currentContest.post_contest_status;
                                                                    const isContestCompleted = postContestStatus === 'verification_complete' || postContestStatus === 'payouts_processed';

                                                                    // If contest is completed and earnings are calculated
                                                                    if (isContestCompleted && submission.earnings !== null && submission.earnings !== undefined) {
                                                                        const earningsInDollars = centsToDollars(submission.earnings);
                                                                        return {
                                                                            amount: earningsInDollars,
                                                                            label: "Final Earnings",
                                                                            className: "text-green-600 font-semibold"
                                                                        };
                                                                    }

                                                                    // Calculate estimated earnings for pending/verified submissions
                                                                    if (submission.status === 'pending' || submission.status === 'verified') {
                                                                        if (cpmConfig?.cpm_rate_usd) {
                                                                            let effectiveViews = views;
                                                                            if (cpmConfig.min_views != null && views < cpmConfig.min_views) {
                                                                                effectiveViews = 0;
                                                                            } else if (cpmConfig.max_views != null && views > cpmConfig.max_views) {
                                                                                effectiveViews = cpmConfig.max_views;
                                                                            }

                                                                            const calculatedEarnings = (effectiveViews * cpmConfig.cpm_rate_usd) / 1000;
                                                                            return {
                                                                                amount: calculatedEarnings,
                                                                                label: "Est. Earnings",
                                                                                className: "text-yellow-600 font-semibold"
                                                                            };
                                                                        }
                                                                    }
                                                                }

                                                                // Default fallback
                                                                return {
                                                                    amount: 0,
                                                                    label: "TBD",
                                                                    className: "text-gray-600"
                                                                };
                                                            };

                                                            const rewardInfo = getRewardDisplay();

                                                            return (
                                                                <TableRow key={submission.id} className={cn(
                                                                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200",
                                                                    rank <= 3 && "bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/10 border-l-4 border-l-yellow-400"
                                                                )}>
                                                                    <TableCell className="font-bold text-center">
                                                                        <div className="flex items-center justify-center">
                                                                            {rank <= 3 && <Trophy className={cn("h-4 w-4 mr-1",
                                                                                rank === 1 ? "text-yellow-500" :
                                                                                    rank === 2 ? "text-gray-400" :
                                                                                        "text-amber-600")} />}
                                                                            {rank}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-3">
                                                                            <Avatar className="h-12 w-12 border-2 border-slate-200 shadow-sm">
                                                                                <AvatarImage src={submission.creator_avatar_url || undefined} alt={submission.creator_display_name || submission.creator_username || "Creator"} />
                                                                                <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-slate-100 to-slate-200">
                                                                                    {(submission.creator_display_name || submission.creator_username)?.charAt(0).toUpperCase() || "C"}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                                                                                    {submission.creator_display_name || "Unknown Creator"}
                                                                                </p>
                                                                                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                                                                                    {submission.creator_username || "unknown"}
                                                                                </p>
                                                                                {submission.video_thumbnail_url && (
                                                                                    <a href={submission.content_link} target="_blank" rel="noopener noreferrer"
                                                                                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 mt-1 transition-colors">
                                                                                        <PlayCircle className="h-3 w-3" />
                                                                                        View Content
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                                                {formatMetricValue(metrics.views)}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500">views</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <div className="flex items-center gap-1">
                                                                                <ThumbsUp className="h-3 w-3 text-blue-500" />
                                                                                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                                                    {formatMetricValue(metrics.likes)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs text-slate-500">likes</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <div className="flex items-center gap-1">
                                                                                <MessageCircle className="h-3 w-3 text-green-500" />
                                                                                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                                                    {formatMetricValue(metrics.comments)}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-xs text-slate-500">comments</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    {/* Dynamic data cells based on contest platform */}
                                                                    {currentContest.platform?.toLowerCase().includes('instagram') && (
                                                                        <>
                                                                            <TableCell className="text-center font-mono text-sm">
                                                                                <div className="flex items-center justify-center gap-1">
                                                                                    <Share2 className="h-3 w-3 text-purple-500" />
                                                                                    {formatMetricValue(metrics.shares)}
                                                                                </div>
                                                                            </TableCell>
                                                                            <TableCell className="text-center font-mono text-sm">
                                                                                {formatMetricValue((metrics as any).saves)}
                                                                            </TableCell>
                                                                            <TableCell className="text-center font-mono text-sm">
                                                                                {formatMetricValue((metrics as any).reach)}
                                                                            </TableCell>
                                                                            <TableCell className="text-center font-mono text-sm">
                                                                                {formatMetricValue((metrics as any).total_interactions)}
                                                                            </TableCell>
                                                                            {/* <TableCell className="text-center font-mono text-sm">
                                                                            {formatMetricValue(metrics.engagement_rate, true)}
                                                                        </TableCell> */}
                                                                        </>
                                                                    )}
                                                                    <TableCell className="text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            {rewardInfo.amount !== null ? (
                                                                                rewardInfo.amount > 0 ? (
                                                                                    <div className="flex flex-col items-center">
                                                                                        <span className={cn("text-lg font-bold", rewardInfo.className)}>
                                                                                            ${rewardInfo.amount.toFixed(2)}
                                                                                        </span>
                                                                                        <span className="text-xs text-slate-500 capitalize">
                                                                                            {rewardInfo.label.toLowerCase()}
                                                                                        </span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex flex-col items-center">
                                                                                        <span className={cn("text-sm font-semibold", rewardInfo.className)}>
                                                                                            {rewardInfo.label}
                                                                                        </span>
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                <div className="flex flex-col items-center">
                                                                                    <span className={cn("text-sm font-semibold", rewardInfo.className)}>
                                                                                        {rewardInfo.label}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <div className="flex flex-col items-center">
                                                                            <Badge variant="outline" className={cn("text-xs inline-flex items-center gap-1 px-3 py-1 font-medium", submissionStatus.className)}>
                                                                                {submissionStatus.icon} {submissionStatus.text}
                                                                            </Badge>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center text-xs text-muted-foreground">
                                                                        <div className="flex flex-col">
                                                                            <span>{formatLocalDateTime(submission.created_at, { dateStyle: 'short' })}</span>
                                                                            <span className="text-xs text-gray-400">
                                                                                {formatLocalDateTime(submission.created_at, { timeStyle: 'short' })}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="sm" disabled={isLoading}>
                                                                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                                                                                    <span className="sr-only">Actions</span>
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                                                                <DropdownMenuSeparator />
                                                                                {submission.status !== 'verified' &&
                                                                                    <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'verified')}>
                                                                                        Mark as Verified
                                                                                    </DropdownMenuItem>}
                                                                                {submission.status !== 'rejected' &&
                                                                                    <DropdownMenuItem disabled={isLoading} onClick={() => handleRejectSubmission(submission.id)} className="text-red-600">
                                                                                        Mark as Rejected
                                                                                    </DropdownMenuItem>}
                                                                                {submission.status !== 'pending' &&
                                                                                    <DropdownMenuItem disabled={isLoading} onClick={() => handleUpdateSubmissionStatus(submission.id, 'pending')}>
                                                                                        Set to Pending
                                                                                    </DropdownMenuItem>}
                                                                                {submission.status !== 'paid' && isAdminView &&
                                                                                    (currentContest.post_contest_status === 'verification_complete' || currentContest.post_contest_status === 'payouts_processed') &&
                                                                                    <DropdownMenuItem disabled={isLoading} onClick={() => handleMarkAsPaid(submission.id)}>
                                                                                        Mark as Paid
                                                                                    </DropdownMenuItem>}
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem asChild>
                                                                                    <a href={submission.content_link} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                                                                        <ExternalLink className="h-3 w-3 mr-2" />
                                                                                        View Content
                                                                                    </a>
                                                                                </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Card className="shadow-sm border-0 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20">
                                <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                                    <div className="p-4 bg-white rounded-full shadow-lg mb-6">
                                        <FileText className="h-12 w-12 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">No Submissions Yet</h3>
                                    <p className="text-slate-600 dark:text-slate-400 max-w-md">
                                        When creators submit entries for this contest, they will appear here with detailed metrics and status information.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-4">
                        <Card>
                            <CardHeader><CardTitle>Contest Analytics</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-medium">Total Submissions</h3>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {currentSubmissions?.length || 0}
                                        </p>
                                    </div>
                                    <div className="border rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Trophy className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-medium">Approved Content</h3>
                                        </div>
                                        <p className="text-2xl font-bold">
                                            {currentSubmissions?.filter((s) => s.status === "verified")
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

            {/* Rejection Reason Modal */}
            <RejectionReasonModal
                isOpen={rejectionModalOpen}
                onClose={() => {
                    setRejectionModalOpen(false);
                    setPendingRejectionSubmission(null);
                }}
                onConfirm={handleRejectionConfirm}
                isLoading={isLoadingSubmission[pendingRejectionSubmission || ''] || false}
            />

            {/* Payment Modal */}
            <PaymentModal
                isOpen={paymentModalOpen}
                onClose={() => {
                    setPaymentModalOpen(false);
                    setPendingPaymentSubmission(null);
                }}
                onConfirm={handlePaymentConfirm}
                isLoading={isLoadingSubmission[pendingPaymentSubmission || ''] || false}
            />
        </div>
    );
} 