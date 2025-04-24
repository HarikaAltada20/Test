"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { createSupabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface DeleteContestButtonProps {
    contestId: string;
    contestTitle: string;
    isLive: boolean;
    variant?: "outline" | "destructive" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
}

export function DeleteContestButton({
    contestId,
    contestTitle,
    isLive,
    variant = "outline",
    size = "sm",
    className = "",
}: DeleteContestButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const supabase = createSupabaseClient();

    // Don't show delete button for live contests
    if (isLive) {
        return null;
    }

    // Clean up storage files associated with the contest
    const cleanupStorageFiles = async () => {
        try {
            // Get the current user ID
            const { data: authData } = await supabase.auth.getUser();
            if (!authData?.user) return;

            const userId = authData.user.id;

            // First, fetch the contest to get its thumbnail_url and resources
            const { data: contestData, error: contestError } = await supabase
                .from("contests")
                .select("thumbnail_url, resources")
                .eq("id", contestId)
                .single();

            if (contestError) {
                console.error("Error getting contest data:", contestError);
                return;
            }

            // Delete thumbnail if exists
            if (contestData?.thumbnail_url) {
                try {
                    const thumbnailUrl = contestData.thumbnail_url;
                    if (thumbnailUrl.includes('supabase.co/storage/v1/object/public/contest-assets/')) {
                        // Extract file path from URL
                        const filePath = thumbnailUrl.split('public/contest-assets/')[1];
                        if (filePath) {
                            await supabase.storage
                                .from('contest-assets')
                                .remove([filePath]);
                        }
                    }
                } catch (err) {
                    console.error("Error removing thumbnail:", err);
                }
            }

            // Delete resources if exist
            if (contestData?.resources && typeof contestData.resources === 'object') {
                try {
                    const resourceUrls = Object.values(contestData.resources);
                    for (const url of resourceUrls) {
                        if (typeof url === 'string' && url.includes('supabase.co/storage/v1/object/public/contest-assets/')) {
                            // Extract file path from URL
                            const filePath = url.split('public/contest-assets/')[1];
                            if (filePath) {
                                await supabase.storage
                                    .from('contest-assets')
                                    .remove([filePath]);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error removing resources:", err);
                }
            }

            // As a fallback, also try to find and delete any files that might contain the contestId
            // Clean up thumbnail files
            try {
                // List files in the contest_thumbnails folder
                const { data: thumbnailFiles, error: thumbnailError } = await supabase.storage
                    .from('contest-assets')
                    .list('contest_thumbnails', {
                        search: contestId
                    });

                if (thumbnailError) {
                    console.error("Error listing thumbnail files:", thumbnailError);
                } else if (thumbnailFiles && thumbnailFiles.length > 0) {
                    // Delete all found thumbnail files
                    const thumbnailFilePaths = thumbnailFiles.map(file => `contest_thumbnails/${file.name}`);
                    await supabase.storage.from('contest-assets').remove(thumbnailFilePaths);
                }
            } catch (err) {
                console.error("Error deleting thumbnail files:", err);
            }

            // Clean up resource files
            try {
                // List files in the contest_resources folder
                const { data: resourceFiles, error: resourceError } = await supabase.storage
                    .from('contest-assets')
                    .list('contest_resources', {
                        search: contestId
                    });

                if (resourceError) {
                    console.error("Error listing resource files:", resourceError);
                } else if (resourceFiles && resourceFiles.length > 0) {
                    // Delete all found resource files
                    const resourceFilePaths = resourceFiles.map(file => `contest_resources/${file.name}`);
                    await supabase.storage.from('contest-assets').remove(resourceFilePaths);
                }
            } catch (err) {
                console.error("Error deleting resource files:", err);
            }
        } catch (error) {
            console.error("Error cleaning up storage files:", error);
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);

            // First clean up storage files
            await cleanupStorageFiles();

            // Then delete the contest from the database
            const { error } = await supabase
                .from("contests")
                .delete()
                .eq("id", contestId);

            if (error) {
                throw error;
            }

            // Show success toast
            toast({
                title: "Contest deleted",
                description: `"${contestTitle}" was successfully deleted.`,
                variant: "default",
            });

            // Close dialog and refresh
            setIsOpen(false);
            router.refresh();

            // Redirect to contests page if on detail page
            if (window.location.pathname.includes(`/dashboard/contests/${contestId}`)) {
                router.push("/dashboard/contests");
            }
        } catch (error: any) {
            console.error("Error deleting contest:", error);
            toast({
                title: "Error",
                description: `Failed to delete contest: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                variant={variant}
                size={size}
                className={`text-red-500 hover:text-red-700 hover:bg-red-50 ${className}`}
            >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Contest</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the contest "{contestTitle}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Contest"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
} 