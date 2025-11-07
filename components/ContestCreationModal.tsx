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
import { cn } from "@/lib/utils";

interface DraftInfo {
  id: string;
  title: string;
  thumbnail_url: string;
  created_at: string;
  updated_at: string;
}

interface ContestCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onViewAllDrafts?: () => void;
}

export function ContestCreationModal({
  isOpen,
  onClose,
  userId,
  onViewAllDrafts,
}: ContestCreationModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mode, setMode] = useState<"light" | "dark">("light");

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

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
        .select("id, title,thumbnail_url, created_at, updated_at")
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

  const isDark = mode === "dark";

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
        <DialogContent
          className={cn("sm:max-w-md", isDark ? "bg-[#06021D]" : "bg-white")}
        >
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
      <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
        <DialogContent
            className={cn("max-w-md md:max-w-lg", isDark ? "bg-[#06021D] text-white" : "bg-white text-black")}    
           
        >
          <DialogHeader>
            <DialogTitle className={cn("text-xl", isDark ? "text-white" : "text-black")}>Continue with Draft?</DialogTitle>
            <DialogDescription className="text-md text-muted-foreground">
              You have an existing draft that you can continue working on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mb-4">
            <div className="p-4 border border-[#7F39EC] bg-[#D9C0FF26] rounded-lg">
              {/* <FileText className="h-4 w-4 text-muted-foreground" /> */}

              <div className="flex items-center gap-4 text-sm">
                <div className="rounded-full flex-shrink-0 h-14 w-14 md:w-16 md:h-16 overflow-hidden">
                  <img
                    src={draft.thumbnail_url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                <div className="flex-1">
                  <span className="font-medium text-[13px]">
                    {draft.title || "Untitled Draft"}
                  </span>

                  <p className="text-sm text-muted-foreground">
                    Last modified{" "}
                    {formatDistanceToNow(new Date(draft.updated_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleContinueDraft(draft.id)}

                className={cn(
                    "w-full text-md py-3 rounded-full ",
                    isDark ? "bg-[#7F39EC]" : " bg-[#D9C0FF61] text-[#7F39EC]"
                  )}
                disabled={isNavigating}
              >
                {isNavigating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    {/* <FileText className="h-4 w-4" /> */}
                    Continue with Draft
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateNew}         
                className={cn(
                    "w-full border text-md py-3 rounded-full",
                    isDark ? "bg-[#06021D] border-white" : "text-[#7F39EC] border-[#7F39EC]"
                  )}
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
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent className="max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Create Contest</DialogTitle>
          <DialogDescription className="text-md">
            You have multiple drafts. Choose how you'd like to proceed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 border border-[#7F39EC] bg-[#D9C0FF26] rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {/* <Clock className="h-4 w-4 text-muted-foreground" /> */}
              <span className="font-medium">Recent Draft</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="rounded-full flex-shrink-0 h-14 w-14 md:w-16 md:h-16 overflow-hidden">
                <img
                  src={recentDraft.thumbnail_url}
                  alt="Thumbnail"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="flex-1">
                <p className="font-medium text-[13px]">
                  {recentDraft.title || "Untitled Draft"}
                </p>
                <p className="text-muted-foreground">
                  Last modified{" "}
                  {formatDistanceToNow(new Date(recentDraft.updated_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Button
              onClick={() => handleContinueDraft(recentDraft.id)}
              className="w-full bg-[#D9C0FF61] text-md py-3 rounded-full text-[#7F39EC]"
              disabled={isNavigating}
            >
              {isNavigating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Continue with Recent Draft
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleViewAllDrafts}
              className="w-full text-md py-3 text-[#7F39EC] border-[#7F39EC] rounded-full"
              disabled={isNavigating}
            >
              {isNavigating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5" />
                  View All Drafts ({drafts.length})
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateNew}
              className="w-full text-md py-3 text-[#7F39EC] border-[#7F39EC] rounded-full"
              disabled={isNavigating}
            >
              {isNavigating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Loading...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
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
