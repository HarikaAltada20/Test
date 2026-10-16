"use client";

import { useState, useEffect, type ReactNode } from "react";
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
import { ArrowRight, Clock, Copy, FileText, Loader2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { DuplicateCampaignDialog } from "@/components/campaign-duplicate/DuplicateCampaignDialog";

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

/**
 * "How do you want to start?" for brands: continue a draft, start from
 * scratch, or copy one of their existing campaigns.
 */
export function ContestCreationModal({
  isOpen,
  onClose,
  userId,
  onViewAllDrafts,
}: ContestCreationModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const isDark = useDashboardDark();
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [hasCampaigns, setHasCampaigns] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      void loadDrafts();
    } else if (!isOpen) {
      // Reset loading state when modal closes
      setNavigatingTo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  const loadDrafts = async () => {
    try {
      setIsLoading(true);
      const [draftsResult, countResult] = await Promise.all([
        supabase
          .from("contests")
          .select("id, title,thumbnail_url, created_at, updated_at")
          .eq("advertiser_id", userId)
          .eq("moderation_status", "draft")
          .order("updated_at", { ascending: false }),
        supabase
          .from("contests")
          .select("id", { count: "exact", head: true })
          .eq("advertiser_id", userId),
      ]);

      if (draftsResult.error) {
        console.error("Error loading drafts:", draftsResult.error);
      }
      const draftRows = (draftsResult.data || []) as DraftInfo[];
      setDrafts(draftRows);
      setHasCampaigns(draftRows.length > 0 || (countResult.count ?? 0) > 0);
    } catch (error) {
      console.error("Error loading drafts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isNavigating = navigatingTo !== null;

  const handleCreateNew = async () => {
    setNavigatingTo("new");
    onClose();
    await router.push("/dashboard/contests/create?new=true");
  };

  const handleContinueDraft = async (draftId: string) => {
    setNavigatingTo("draft");
    onClose();
    await router.push(`/dashboard/contests/create?draft=${draftId}`);
  };

  const handleViewAllDrafts = async () => {
    setNavigatingTo("drafts");
    onClose();
    if (onViewAllDrafts) {
      onViewAllDrafts();
    } else {
      // Fallback to URL navigation if callback not provided
      await router.push("/dashboard/contests?tab=draft");
    }
  };

  const handleCopy = () => {
    onClose();
    setCopyOpen(true);
  };

  const recentDraft = drafts[0];

  const optionCard = (
    key: string,
    icon: ReactNode,
    title: string,
    description: string,
    onClick: () => void,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      disabled={isNavigating}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] disabled:opacity-60",
        isDark
          ? "border-violet-500/30 bg-[#0c0618] hover:border-[#7F39EC] hover:bg-violet-500/10"
          : "border-purple-200 bg-white hover:border-[#7F39EC] hover:bg-purple-50/60",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          isDark ? "bg-violet-500/15 text-violet-200" : "bg-[#7F39EC]/10 text-[#7F39EC]",
        )}
      >
        {navigatingTo === key ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
        <DialogContent
          className={cn(
            "w-[calc(100vw-16px)] max-w-md md:max-w-lg",
            isDark ? "bg-[#06021D] text-white" : "bg-white text-black",
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle className={cn("text-xl", isDark ? "text-white" : "text-gray-900")}>
              Create campaign
            </DialogTitle>
            <DialogDescription className="text-md text-muted-foreground">
              How do you want to start?
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#7F39EC]" />
            </div>
          ) : (
            <div className="space-y-4">
              {recentDraft && (
                <div className="space-y-3 rounded-xl border border-[#7F39EC] bg-[#D9C0FF26] p-4">
                  <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                    Continue your draft
                  </p>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-purple-100/60 dark:bg-violet-500/15">
                      {recentDraft.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recentDraft.thumbnail_url}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-[13px] font-medium", isDark ? "text-white" : "text-gray-900")}>
                        {recentDraft.title || "Untitled Draft"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last modified{" "}
                        {formatDistanceToNow(new Date(recentDraft.updated_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => handleContinueDraft(recentDraft.id)}
                      className={cn(
                        "flex-1 rounded-full",
                        isDark ? "bg-[#7F39EC]" : "bg-[#D9C0FF61] text-[#7F39EC]",
                      )}
                      disabled={isNavigating}
                    >
                      {navigatingTo === "draft" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Continue draft
                    </Button>
                    {drafts.length > 1 && (
                      <Button
                        variant="outline"
                        onClick={handleViewAllDrafts}
                        className="flex-1 rounded-full border-[#7F39EC] text-[#7F39EC]"
                        disabled={isNavigating}
                      >
                        <Clock className="h-4 w-4" />
                        All drafts ({drafts.length})
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {optionCard(
                  "new",
                  <Plus className="h-5 w-5" />,
                  "Start from scratch",
                  "A blank campaign. You set up every step yourself.",
                  handleCreateNew,
                )}
                {hasCampaigns &&
                  optionCard(
                    "copy",
                    <Copy className="h-5 w-5" />,
                    "Copy an existing campaign",
                    "Pick one of your campaigns and choose what to copy into a new draft.",
                    handleCopy,
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DuplicateCampaignDialog open={copyOpen} onOpenChange={setCopyOpen} isAdmin={false} />
    </>
  );
}
