"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Send, ShieldCheck, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { draftBlockMessage, type CampaignDraftStatus } from "@/lib/content-drafts";
import { getCampaignDraftStatus } from "./api";
import { UploadDraftsDialog } from "./UploadDraftsDialog";

type Props = {
  contestId: string;
  campaignTitle?: string | null;
  isDark: boolean;
  /** The campaign accepts posts from more than one platform. */
  multiPlatform?: boolean;
  /** Called with the creator's draft status (null when it couldn't be loaded). */
  onStatusChange?: (status: CampaignDraftStatus | null) => void;
  /** Increase to open the upload dialog, e.g. from the page's main button. */
  uploadRequest?: number;
  className?: string;
};

/** True when the creator has an approved draft they can still link to a post. */
export function hasLinkableDraft(status: CampaignDraftStatus | null | undefined, multiPlatform = false): boolean {
  const counts = status?.counts ?? {};
  return (counts.approved ?? 0) > 0 || (multiPlatform && (counts.posted ?? 0) > 0);
}

const STEPS = ["Upload your draft", "The brand reviews it", "Post it and submit the link"];

/**
 * Review-before-posting box on a campaign page for creators: how it works,
 * their draft counts and the upload button. Renders nothing when the
 * campaign doesn't use it (or the feature isn't set up yet).
 */
export function CampaignDraftPanel({
  contestId,
  campaignTitle,
  isDark,
  multiPlatform = false,
  onStatusChange,
  uploadRequest = 0,
  className,
}: Props) {
  const [status, setStatus] = useState<CampaignDraftStatus | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    try {
      const s = await getCampaignDraftStatus(contestId);
      setStatus(s);
      onStatusChange?.(s);
    } catch {
      setStatus(null);
      onStatusChange?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  useEffect(() => {
    load();
  }, [load]);

  // The page's main button asks for an upload: open it, or show why not.
  useEffect(() => {
    if (!uploadRequest || !status?.review_before_posting) return;
    if (status.can_upload) {
      setUploadOpen(true);
    } else {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      sectionRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadRequest]);

  if (!status?.review_before_posting) return null;

  const counts = status.counts ?? {};
  const inReview = counts.pending_review ?? 0;
  const approved = counts.approved ?? 0;
  const changes = counts.revision_requested ?? 0;
  const posted = counts.posted ?? 0;
  const block = draftBlockMessage(status.block_reason, status);
  const linkable = hasLinkableDraft(status, multiPlatform);
  const slotsLeft =
    status.max_open != null ? Math.max(0, status.max_open - (status.open_count ?? 0)) : null;
  const draftsHref = `/dashboard/submissions?view=drafts&campaign=${contestId}`;
  const summary = [
    inReview && `${inReview} in review`,
    changes && `${changes} need${changes === 1 ? "s" : ""} changes`,
    approved && `${approved} approved, ready to post`,
    posted && `${posted} posted`,
  ].filter(Boolean) as string[];

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-labelledby="review-before-posting-heading"
      className={cn(
        "rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4 focus:outline-none sm:p-5 dark:border-white/10 dark:bg-white/[0.04]",
        isDark && "dark",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id="review-before-posting-heading"
            className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
          >
            <ShieldCheck className="h-4 w-4 text-[#0a0a0a] dark:text-white" aria-hidden="true" />
            Review before posting
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This brand approves each video before it goes live. Only approved videos can be submitted.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {linkable && (
            <Link
              href={`/dashboard/opportunities/${contestId}/submit`}
              className={cn(buttonVariants(), "bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200")}
            >
              <Send aria-hidden="true" /> Submit posted link
            </Link>
          )}
          <Button
            variant={linkable ? "outline" : "default"}
            className={
              linkable
                ? "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
                : "bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200"
            }
            disabled={!status.can_upload}
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Upload drafts
          </Button>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-sm dark:bg-white/5 dark:text-gray-200"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-xs font-semibold text-white dark:bg-white dark:text-[#0a0a0a]">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-gray-600 dark:text-gray-300">
          {block ? (
            <span className="text-amber-800 dark:text-amber-300">{block}</span>
          ) : summary.length ? (
            summary.join(" · ")
          ) : (
            "You haven't sent any drafts yet."
          )}
        </p>
        {(summary.length > 0 || (counts.rejected ?? 0) > 0) && (
          <Link
            href={draftsHref}
            className="inline-flex items-center gap-1 rounded-sm font-medium text-[#0a0a0a] dark:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] dark:focus-visible:ring-white dark:text-white"
          >
            <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" /> My drafts
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <UploadDraftsDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contestId={contestId}
        campaignTitle={campaignTitle}
        slotsLeft={slotsLeft}
        maxOpen={status.max_open ?? null}
        openCount={status.open_count ?? 0}
        isDark={isDark}
        onSent={() => load()}
      />
    </section>
  );
}
