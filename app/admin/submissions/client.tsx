"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    CheckCircle,
    XCircle,
    Clock,
    ExternalLink,
    User,
    Calendar,
    Eye,
    MessageSquare
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Local time formatting utility
const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMs = now.getTime() - time.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

    if (diffInDays > 0) {
        return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
        return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes > 0) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
};

interface SubmissionForVerification {
    id: string;
    creator_id: string;
    contest_id: string;
    video_title: string;
    video_thumbnail_url: string | null;
    content_link: string;
    platform: string;
    views: number;
    earnings: number;
    status: 'pending' | 'verified' | 'rejected';
    created_at: string;
    verified_at: string | null;
    rejection_reason: string | null;
    contests: {
        title: string;
        contest_type: string;
    };
    users: {
        username: string;
        full_name: string;
    };
}

export default function SubmissionVerificationClient() {
    const [submissions, setSubmissions] = useState<SubmissionForVerification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingSubmissions, setProcessingSubmissions] = useState<Set<string>>(new Set());
    const [selectedStatus, setSelectedStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
    const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

    const fetchSubmissions = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/verify-submission?status=${selectedStatus}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch submissions');
            }

            setSubmissions(data.submissions || []);
        } catch (err: any) {
            console.error('Error fetching submissions:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubmissions();
    }, [selectedStatus]);

    const handleVerifySubmission = async (submissionId: string, action: 'verified' | 'rejected' | 'pending', reason?: string) => {
        setProcessingSubmissions(prev => new Set(prev).add(submissionId));

        try {
            const response = await fetch('/api/admin/verify-submission', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    submissionId,
                    action,
                    reason: action === 'rejected' ? reason : undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update submission');
            }

            // Remove from current list if status changed
            setSubmissions(prev => prev.filter(s => s.id !== submissionId));

            // Clear rejection reason
            setRejectionReasons(prev => {
                const newReasons = { ...prev };
                delete newReasons[submissionId];
                return newReasons;
            });

            toast({
                title: "Success",
                description: `Submission ${action} successfully`,
            });

        } catch (err: any) {
            console.error('Error updating submission:', err);
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setProcessingSubmissions(prev => {
                const newSet = new Set(prev);
                newSet.delete(submissionId);
                return newSet;
            });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'rejected':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const renderStatusIcon = (status: string) => {
        switch (status) {
            case 'verified':
                return <CheckCircle className="h-4 w-4" />;
            case 'pending':
                return <Clock className="h-4 w-4" />;
            case 'rejected':
                return <XCircle className="h-4 w-4" />;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto py-8">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Loading submissions for verification...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Submission Verification</h1>
                <p className="text-muted-foreground">
                    Review and verify submissions for CPM-based contests. Only verified submissions will appear in leaderboards.
                </p>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 mb-6">
                {(['pending', 'verified', 'rejected'] as const).map((status) => (
                    <Button
                        key={status}
                        variant={selectedStatus === status ? "default" : "outline"}
                        onClick={() => setSelectedStatus(status)}
                        className="capitalize"
                    >
                        {renderStatusIcon(status)}
                        <span className="ml-2">{status}</span>
                    </Button>
                ))}
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {submissions.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">
                            No {selectedStatus} submissions found for CPM contests.
                        </p>
                        <Button variant="outline" onClick={fetchSubmissions} className="mt-4">
                            Refresh
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {submissions.map((submission) => (
                        <Card key={submission.id} className="overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarFallback>
                                                <User className="h-5 w-5" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-base">{submission.users.username}</CardTitle>
                                            <p className="text-sm text-muted-foreground">
                                                {submission.users.full_name}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className={getStatusColor(submission.status)}>
                                        {renderStatusIcon(submission.status)}
                                        <span className="ml-1 capitalize">{submission.status}</span>
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Contest and Submission Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Contest</p>
                                        <p className="text-sm">{submission.contests.title}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Platform</p>
                                        <p className="text-sm capitalize">{submission.platform}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Views</p>
                                        <p className="text-sm">{submission.views.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                                        <p className="text-sm">{formatTimeAgo(submission.created_at)}</p>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground mb-2">Content</p>
                                    <div className="flex items-start gap-3">
                                        {submission.video_thumbnail_url && (
                                            <img
                                                src={submission.video_thumbnail_url}
                                                alt="Content thumbnail"
                                                className="w-20 h-20 object-cover rounded"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{submission.video_title}</p>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="p-0 h-auto text-blue-600 hover:text-blue-800"
                                                asChild
                                            >
                                                <a
                                                    href={submission.content_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    View Content
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Rejection Reason (if rejected) */}
                                {submission.status === 'rejected' && submission.rejection_reason && (
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-2">Rejection Reason</p>
                                        <p className="text-sm bg-red-50 p-2 rounded border border-red-200">
                                            {submission.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                {/* Verification Actions */}
                                {submission.status === 'pending' && (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleVerifySubmission(submission.id, 'verified')}
                                                disabled={processingSubmissions.has(submission.id)}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                Verify
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                onClick={() => handleVerifySubmission(submission.id, 'rejected', rejectionReasons[submission.id])}
                                                disabled={processingSubmissions.has(submission.id)}
                                            >
                                                <XCircle className="h-4 w-4 mr-2" />
                                                Reject
                                            </Button>
                                        </div>

                                        {/* Rejection Reason Input */}
                                        <div>
                                            <Label htmlFor={`reason-${submission.id}`} className="text-sm">
                                                Rejection Reason (optional)
                                            </Label>
                                            <Textarea
                                                id={`reason-${submission.id}`}
                                                placeholder="Provide a reason for rejection..."
                                                value={rejectionReasons[submission.id] || ''}
                                                onChange={(e) => setRejectionReasons(prev => ({
                                                    ...prev,
                                                    [submission.id]: e.target.value
                                                }))}
                                                className="mt-1"
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Re-verification Actions */}
                                {(submission.status === 'verified' || submission.status === 'rejected') && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleVerifySubmission(submission.id, 'pending')}
                                            disabled={processingSubmissions.has(submission.id)}
                                        >
                                            <Clock className="h-4 w-4 mr-2" />
                                            Reset to Pending
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
} 