"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDateTime, formatMoney } from "@/lib/utils";
import {
    Shield,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Calendar,
    Building,
    AlertTriangle,
    FileText,
    Trophy,
    Users,
    DollarSign,
    ExternalLink,
    PlayCircle,
    StopCircle,
} from "lucide-react";

interface Contest {
    id: string;
    title: string;
    platform: string;
    contest_type: string;
    moderation_status: string;
    status: string;
    created_at: string;
    submitted_for_approval_at: string | null;
    approved_at: string | null;
    approved_by_name: string | null;
    published_at: string | null;
    rejection_reason: string | null;
    thumbnail_url: string | null;
    brief_html: string | null;
    start_date: string | null;
    end_date: string | null;
    advertiser_name: string;
    advertiser_id: string;
    contest_based_details: any;
}

const moderationStatusConfig = {
    pending_approval: {
        label: "Pending Approval",
        color: "bg-yellow-500",
        icon: Clock,
        description: "Awaiting admin review"
    },
    approved: {
        label: "Approved",
        color: "bg-blue-500",
        icon: CheckCircle,
        description: "Approved and ready to publish"
    },
    published: {
        label: "Published",
        color: "bg-green-500",
        icon: Eye,
        description: "Live on platform"
    },
    rejected: {
        label: "Rejected",
        color: "bg-red-500",
        icon: XCircle,
        description: "Rejected and needs revision"
    },
    draft: {
        label: "Draft",
        color: "bg-gray-500",
        icon: FileText,
        description: "Still being created by brand"
    },
};

const contestStatusConfig = {
    upcoming: { label: "Upcoming", color: "bg-purple-500", icon: Calendar },
    active: { label: "Active", color: "bg-green-600", icon: PlayCircle },
    ended: { label: "Ended", color: "bg-gray-600", icon: StopCircle },
};

export default function ContestModerationClient() {
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState("pending_approval");
    const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [showRejectionDialog, setShowRejectionDialog] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [processingAction, setProcessingAction] = useState(false);
    const { toast } = useToast();

    const fetchContests = async (status: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/contest-moderation?status=${status}`);

            if (!response.ok) {
                throw new Error("Failed to fetch contests");
            }

            const data = await response.json();
            setContests(data.contests || []);
        } catch (error) {
            console.error("Error fetching contests:", error);
            toast({
                title: "Error",
                description: "Failed to fetch contests",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContests(selectedStatus);
    }, [selectedStatus]);

    const handleApprove = async (contestId: string) => {
        try {
            setProcessingAction(true);

            const response = await fetch("/api/admin/contest-moderation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contestId,
                    action: "approve",
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to approve contest");
            }

            toast({
                title: "Success",
                description: "Contest approved successfully",
            });

            await fetchContests(selectedStatus);
            setShowApprovalDialog(false);
            setSelectedContest(null);
        } catch (error) {
            console.error("Error approving contest:", error);
            toast({
                title: "Error",
                description: "Failed to approve contest",
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleReject = async (contestId: string) => {
        if (!rejectionReason.trim()) {
            toast({
                title: "Error",
                description: "Please provide a rejection reason",
                variant: "destructive",
            });
            return;
        }

        try {
            setProcessingAction(true);

            const response = await fetch("/api/admin/contest-moderation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contestId,
                    action: "reject",
                    reason: rejectionReason.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to reject contest");
            }

            toast({
                title: "Success",
                description: "Contest rejected successfully",
            });

            await fetchContests(selectedStatus);
            setShowRejectionDialog(false);
            setSelectedContest(null);
            setRejectionReason("");
        } catch (error) {
            console.error("Error rejecting contest:", error);
            toast({
                title: "Error",
                description: "Failed to reject contest",
                variant: "destructive",
            });
        } finally {
            setProcessingAction(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Not set";
        return formatLocalDateTime(dateString, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getModerationStatusBadge = (moderationStatus: string) => {
        const config = moderationStatusConfig[moderationStatus as keyof typeof moderationStatusConfig];
        if (!config) return null;

        const Icon = config.icon;
        return (
            <Badge className={`${config.color} text-white border-0`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    const getContestStatusBadge = (status: string | null) => {
        if (!status) return null;

        const config = contestStatusConfig[status as keyof typeof contestStatusConfig];
        if (!config) return null;

        const Icon = config.icon;
        return (
            <Badge className={`${config.color} text-white border-0 ml-2`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };



    const renderContestCard = (contest: Contest) => {
        const leaderboardPrizeMoney = contest.contest_type === 'leaderboard' &&
            contest.contest_based_details?.leaderboard_contest?.total_prize;

        const cpmBudget = contest.contest_type === 'cpm' &&
            contest.contest_based_details?.cpm_contest?.total_budget;

        const budgetSpent = contest.contest_type === 'cpm'
            ? contest.contest_based_details?.cpm_contest?.budget_spent ?? 0
            : 0;

        return (
            <Card key={contest.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                    {contest.thumbnail_url ? (
                        <img
                            src={contest.thumbnail_url}
                            alt={contest.title || "Contest thumbnail"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <Trophy className="h-12 w-12 mb-2" />
                            <span className="text-sm font-medium">No Image</span>
                        </div>
                    )}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                        {getModerationStatusBadge(contest.moderation_status)}
                        {contest.moderation_status === 'published' && getContestStatusBadge(contest.status)}
                    </div>
                </div>

                <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold line-clamp-2">
                        {contest.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Building className="h-4 w-4" />
                        {contest.advertiser_name}
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    <div className="space-y-3">
                        {/* Contest Details Section - matching regular contest list */}
                        <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <div className="flex items-center">
                                <Trophy className="h-4 w-4 mr-2 flex-shrink-0 text-rose-500" />
                                <span>Platform: <span className="font-medium text-slate-700 dark:text-slate-300">{contest.platform || "N/A"}</span></span>
                            </div>
                            {contest.start_date && (
                                <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Starts: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.start_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                                </div>
                            )}
                            {contest.end_date && (
                                <div className="flex items-center">
                                    <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Ends: <span className="font-medium text-slate-700 dark:text-slate-300">{formatLocalDateTime(contest.end_date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span>
                                </div>
                            )}
                            <div className="flex items-center">
                                <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>Contest Type: <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {contest.contest_type === 'cpm' ? 'CPM Based' : contest.contest_type === 'leaderboard' ? 'Leaderboard' : contest.contest_type ? contest.contest_type.charAt(0).toUpperCase() + contest.contest_type.slice(1) : 'N/A'}
                                </span></span>
                            </div>
                            {(leaderboardPrizeMoney || cpmBudget) && (
                                <div className="flex items-center">
                                    <DollarSign className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>
                                        Prize Pool:
                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                            {' '}{formatMoney(leaderboardPrizeMoney || cpmBudget)}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {contest.moderation_status === 'rejected' && contest.rejection_reason && (
                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="text-sm font-medium text-red-800 dark:text-red-200">
                                            Rejection Reason
                                        </div>
                                        <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                                            {contest.rejection_reason}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => window.open(`/dashboard/admin/contests/${contest.id}`, '_blank')}
                            >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                            </Button>

                            {contest.moderation_status === 'pending_approval' && (
                                <>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setSelectedContest(contest);
                                            setShowApprovalDialog(true);
                                        }}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                            setSelectedContest(contest);
                                            setShowRejectionDialog(true);
                                        }}
                                    >
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Reject
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Group contests by status for tab counts
    const contestCounts = {
        pending_approval: contests.filter(c => c.moderation_status === 'pending_approval').length,
        approved: contests.filter(c => c.moderation_status === 'approved').length,
        published: contests.filter(c => c.moderation_status === 'published').length,
        rejected: contests.filter(c => c.moderation_status === 'rejected').length,
        draft: contests.filter(c => c.moderation_status === 'draft').length,
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Contest Moderation</h1>
                    <p className="text-muted-foreground">
                        Review and approve contests before they go live
                    </p>
                </div>
            </div>

            <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
                <div className="overflow-x-auto">
                    <TabsList className="grid w-full grid-cols-5 h-14 p-1.5 bg-muted/30 border border-border/50 shadow-sm mb-8 min-w-[600px]">
                        <TabsTrigger
                            value="pending_approval"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Pending <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestCounts.pending_approval}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="approved"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Approved <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestCounts.approved}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="published"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Published <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestCounts.published}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="rejected"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Rejected <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestCounts.rejected}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            value="draft"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold data-[state=active]:shadow-lg data-[state=active]:border data-[state=active]:border-primary/30 text-muted-foreground data-[state=active]:scale-105 transition-all duration-300"
                        >
                            Drafts <Badge variant="secondary" className="ml-2 data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                                {contestCounts.draft}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value={selectedStatus} className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : contests.length === 0 ? (
                        <Card>
                            <CardContent className="p-6 text-center">
                                <p className="text-muted-foreground">No contests found for this status</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
                            {contests.map((contest) => renderContestCard(contest))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Approval Dialog */}
            <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve Contest</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to approve "{selectedContest?.title}"?
                            The contest will be marked as ready for publication.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedContest && handleApprove(selectedContest.id)}
                            disabled={processingAction}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {processingAction ? "Approving..." : "Approve Contest"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejection Dialog */}
            <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Contest</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting "{selectedContest?.title}".
                            This will help the advertiser understand what needs to be changed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="my-4">
                        <Textarea
                            placeholder="Explain why this contest is being rejected..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedContest && handleReject(selectedContest.id)}
                            disabled={processingAction || !rejectionReason.trim()}
                        >
                            {processingAction ? "Rejecting..." : "Reject Contest"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
} 