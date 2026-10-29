"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Clapperboard, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getPlatformIcon } from "@/lib/platform-icons";
import {
  buildSubmissionDraftMap,
  formatDuration,
  postedAfterApprovalLabel,
  type SubmissionDraftLink,
} from "@/lib/content-drafts";
import { ReviewPlayer } from "@/components/contest/review-mode/ReviewPlayer";
import {
  getReviewOpenUrl,
  isVerticalReviewContent,
  platformLabel,
  resolveReviewPlatform,
} from "@/components/contest/review-mode/review-metrics";
import { listPostedCampaignDrafts } from "./api";
import { DraftVideoPlayer } from "./media";

/**
 * Submissions made from an approved draft (Review before posting), keyed by
 * submission id. Empty until loaded, and stays empty when the campaign has no
 * posted drafts or the drafts feature isn't set up on this database.
 */
export function useSubmissionDrafts(contestId: string, enabled: boolean) {
  const [map, setMap] = useState<Map<string, SubmissionDraftLink>>(() => new Map());
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listPostedCampaignDrafts(contestId)
      .then((rows) => {
        if (!cancelled) setMap(buildSubmissionDraftMap(rows));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contestId, enabled]);
  return map;
}

export type ComparedPost = {
  id: string;
  contentLink: string | null;
  platform: string | null;
  videoId: string | null;
  videoThumbnailUrl: string | null;
  videoTitle: string | null;
  creatorName: string | null;
};

function formatWhen(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM, h:mm a");
}

/** One line of facts: approved when, link sent how long after, revision rounds. */
export function draftFacts(link: SubmissionDraftLink): string[] {
  const facts: string[] = [];
  const approved = formatWhen(link.approvedAt);
  if (approved) facts.push(`Approved ${approved}`);
  const gap = postedAfterApprovalLabel(link.approvedAt, link.submittedAt);
  if (gap) facts.push(`link sent ${gap}`);
  if (link.revisionCount > 0) {
    facts.push(`${link.revisionCount} revision${link.revisionCount === 1 ? "" : "s"}`);
  }
  return facts;
}

/** Small label pinned to the top of a video stage. */
export function StageLabel({
  tone,
  className,
  children,
}: {
  tone: "draft" | "post";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-2 top-2 z-[45] inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg",
        tone === "draft" ? "bg-violet-600 text-white" : "bg-white/90 text-slate-900",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The approved draft video in a dark 9:16 stage. */
export function ApprovedDraftStage({
  link,
  className,
}: {
  link: SubmissionDraftLink;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-2 ring-violet-500/70",
        className,
      )}
    >
      <StageLabel tone="draft">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sm:hidden">Draft</span>
        <span className="hidden sm:inline">Approved draft</span>
        {link.versionNo ? ` · v${link.versionNo}` : ""}
      </StageLabel>
      <DraftVideoPlayer
        versionId={link.versionId}
        purged={link.filesPurged}
        className="h-full w-full max-w-none rounded-none"
      />
    </div>
  );
}

type DialogProps = {
  link: SubmissionDraftLink | null;
  post: ComparedPost | null;
  onClose: () => void;
  /** Opens the draft's full history in the Drafts tab. */
  onOpenDraft?: (draftId: string) => void;
};

/**
 * Side by side: the draft the brand approved and the clip that was posted, so
 * a reviewer can check they match without leaving the submissions table.
 */
export function DraftCompareDialog({ link, post, onClose, onOpenDraft }: DialogProps) {
  const open = !!link && !!post;
  const platform = post ? resolveReviewPlatform(post.platform, post.contentLink) : null;
  const vertical =
    !!post && !!platform && isVerticalReviewContent(platform, post.contentLink, { title: post.videoTitle });
  const openUrl = post && platform ? getReviewOpenUrl(platform, post.contentLink, vertical) : null;
  const facts = link ? draftFacts(link) : [];
  const where = platform ? platformLabel(platform, vertical) : "the platform";

  return (
    <Dialog isdark open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto border-white/10 bg-slate-950 p-4 text-white sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-white">Approved draft vs posted clip</DialogTitle>
          <DialogDescription className="text-slate-400">
            {post?.creatorName ? `${post.creatorName} · ` : ""}
            Check that the posted clip is the video that was approved.
          </DialogDescription>
        </DialogHeader>

        {link && post && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <figure className="min-w-0">
                <ApprovedDraftStage
                  link={link}
                  className="mx-auto aspect-[9/16] w-full max-w-[315px]"
                />
                <figcaption className="mt-2 truncate text-center text-xs text-slate-400">
                  {link.title ?? "Untitled draft"}
                  {link.durationSec ? ` · ${formatDuration(link.durationSec)}` : ""}
                </figcaption>
              </figure>
              <figure className="min-w-0">
                <div
                  className={cn(
                    "relative mx-auto overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/15",
                    vertical ? "aspect-[9/16] w-full max-w-[315px]" : "aspect-video w-full",
                  )}
                >
                  <StageLabel tone="post">
                    <span className="flex h-4 w-4 items-center justify-center">
                      {getPlatformIcon(post.platform, "sm")}
                    </span>
                    Posted
                  </StageLabel>
                  <ReviewPlayer
                    submissionId={post.id}
                    contentLink={post.contentLink}
                    platform={post.platform}
                    videoId={post.videoId}
                    videoThumbnailUrl={post.videoThumbnailUrl}
                    live
                    prefetch={false}
                    muted={false}
                    playbackRate={1}
                  />
                </div>
                <figcaption className="mt-2 truncate text-center text-xs text-slate-400">
                  {post.videoTitle || where}
                </figcaption>
              </figure>
            </div>

            <div className="space-y-2 rounded-xl bg-white/5 p-3 text-sm">
              {facts.length > 0 && <p className="text-slate-300">{facts.join(" · ")}</p>}
              {link.caption && (
                <p className="whitespace-pre-wrap text-slate-200">
                  <span className="text-slate-400">Approved caption: </span>
                  {link.caption}
                </p>
              )}
              {link.hashtags.length > 0 && (
                <p className="text-violet-300">{link.hashtags.join(" ")}</p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {openUrl && (
                <Button
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Open post
                </Button>
              )}
              {onOpenDraft && (
                <Button
                  className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
                  onClick={() => {
                    onOpenDraft(link.draftId);
                    onClose();
                  }}
                >
                  <Clapperboard className="mr-1.5 h-4 w-4" /> Open draft history
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
