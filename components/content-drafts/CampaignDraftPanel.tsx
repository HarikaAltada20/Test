"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clapperboard, Send, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { draftBlockMessage, type CampaignDraftStatus } from "@/lib/content-drafts";
import { getCampaignDraftStatus } from "./api";
import { UploadDraftsDialog } from "./UploadDraftsDialog";

type Props = {
  contestId: string;
  campaignTitle?: string | null;
  isDark: boolean;
  /** Called once the campaign's review setting is known (true when on). */
  onReviewModeKnown?: (enabled: boolean) => void;
};

const STEPS = ["Upload your draft", "The brand reviews it", "Post it and submit the link"];

/**
 * Review-before-posting box on a campaign page for creators: how it works,
 * their draft counts and the upload button. Renders nothing when the
 * campaign doesn't use it (or the feature isn't set up yet).
 */
export function CampaignDraftPanel({ contestId, campaignTitle, isDark, onReviewModeKnown }: Props) {
  const [status, setStatus] = useState<CampaignDraftStatus | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getCampaignDraftStatus(contestId);
      setStatus(s);
      onReviewModeKnown?.(!!s.review_before_posting);
    } catch {
      setStatus(null);
      onReviewModeKnown?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!status?.review_before_posting) return null;

  const counts = status.counts ?? {};
  const inReview = counts.pending_review ?? 0;
  const approved = counts.approved ?? 0;
  const changes = counts.revision_requested ?? 0;
  const posted = counts.posted ?? 0;
  const block = draftBlockMessage(status.block_reason, status);
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
      aria-labelledby="review-before-posting-heading"
      className={cn(
        "rounded-xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5 dark:border-[#7F39EC]/40 dark:bg-[#7F39EC]/10",
        isDark && "dark",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2
            id="review-before-posting-heading"
            className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
          >
            <ShieldCheck className="h-4 w-4 text-[#7F39EC] dark:text-purple-300" aria-hidden="true" />
            Review before posting
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This brand approves each video before it goes live. Only approved videos can be submitted.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {approved > 0 && (
            <Button asChild className="bg-[#7F39EC] hover:bg-[#7F39EC]/90">
              <Link href={`/dashboard/opportunities/${contestId}/submit`}>
                <Send className="mr-1.5 h-4 w-4" /> Submit posted link
              </Link>
            </Button>
          )}
          <Button
            variant={approved > 0 ? "outline" : "default"}
            className={
              approved > 0
                ? "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
                : "bg-[#7F39EC] hover:bg-[#7F39EC]/90"
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
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7F39EC] text-xs font-semibold text-white">
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
            className="inline-flex items-center gap-1 rounded-sm font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
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
