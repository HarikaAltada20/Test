"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DraftInfo {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface ContestCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    onViewAllDrafts?: () => void;
}

export function ContestCreationModal({ isOpen, onClose, userId, onViewAllDrafts }: ContestCreationModalProps) {
    const router = useRouter();
    const supabase = createClient();
    const [drafts, setDrafts] = useState<DraftInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);

    useEffect(() => {
        if (isOpen && userId) {
            loadDrafts();
        } else if (!isOpen) {
            // Reset loading state when modal closes
            setIsNavigating(false);
        }
    }, [isOpen, userId]);

    const loadDrafts = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("contests")
                .select("id, title, created_at, updated_at")
                .eq("advertiser_id", userId)
                .eq("moderation_status", "draft")
                .order("updated_at", { ascending: false });

            if (error) {
                console.error("Error loading drafts:", error);
                return;
            }

            setDrafts(data || []);
        } catch (error) {
            console.error("Error loading drafts:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = async () => {
        setIsNavigating(true);
        onClose();
        await router.push("/dashboard/contests/create?new=true");
    };

    const handleContinueDraft = async (draftId: string) => {
        setIsNavigating(true);
        onClose();
        await router.push(`/dashboard/contests/create?draft=${draftId}`);
    };

    const handleViewAllDrafts = async () => {
        setIsNavigating(true);
        onClose();
        if (onViewAllDrafts) {
            onViewAllDrafts();
        } else {
            // Fallback to URL navigation if callback not provided
            await router.push("/dashboard/contests?tab=draft");
        }
    };

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Loading...</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // No drafts - this shouldn't happen as the modal shouldn't open
    if (drafts.length === 0) {
        return null;
    }

    // Single draft
    if (drafts.length === 1) {
        const draft = drafts[0];
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Continue with Draft?</DialogTitle>
                        <DialogDescription>
                            You have an existing draft that you can continue working on.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{draft.title || "Untitled Draft"}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Last modified {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={() => handleContinueDraft(draft.id)}
                                className="w-full"
                                disabled={isNavigating}
                            >
                                {isNavigating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Continue with Draft
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleCreateNew}
                                className="w-full"
                                disabled={isNavigating}
                            >
                                {isNavigating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create New Contest
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Multiple drafts
    const recentDraft = drafts[0];
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Contest</DialogTitle>
                    <DialogDescription>
                        You have multiple drafts. Choose how you'd like to proceed.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Recent Draft</span>
                        </div>
                        <div className="text-sm">
                            <p className="font-medium">{recentDraft.title || "Untitled Draft"}</p>
                            <p className="text-muted-foreground">
                                Last modified {formatDistanceToNow(new Date(recentDraft.updated_at), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            onClick={() => handleContinueDraft(recentDraft.id)}
                            className="w-full"
                            disabled={isNavigating}
                        >
                            {isNavigating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Continue with Recent Draft
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleViewAllDrafts}
                            className="w-full"
                            disabled={isNavigating}
                        >
                            {isNavigating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Clock className="mr-2 h-4 w-4" />
                                    View All Drafts ({drafts.length})
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCreateNew}
                            className="w-full"
                            disabled={isNavigating}
                        >
                            {isNavigating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create New Contest
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 