"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, Clapperboard, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DraftListRow } from "@/lib/content-drafts";
import { listMyDrafts } from "./api";
import { DraftThumb, useDraftPosters } from "./media";

type Props = {
  contestId: string;
  /** Platform the post is from (youtube, instagram, tiktok). */
  platform: string | null;
  platformLabel: string;
  selectedId: string | null;
  onSelect: (draftId: string | null) => void;
  /** Change it to reload the list, e.g. after a refused submission. */
  reloadKey?: number;
  isDark: boolean;
};

/** An approved draft can be linked to one post per platform. */
function availableFor(row: DraftListRow, platform: string | null): boolean {
  const p = (platform ?? "").toLowerCase();
  return !row.posts.some((post) => (post.platform ?? "").toLowerCase() === p);
}

/**
 * First step of the submit page when the campaign reviews videos before
 * posting: the creator picks which approved draft the post is for.
 */
export function ApprovedDraftPicker({
  contestId,
  platform,
  platformLabel,
  selectedId,
  onSelect,
  reloadKey = 0,
  isDark,
}: Props) {
  const [rows, setRows] = useState<DraftListRow[] | null>(null);
  const [inReview, setInReview] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    listMyDrafts({ contestId, status: "approved_all", offset: 0, limit: 100 })
      .then((page) => {
        if (cancelled) return;
        setRows(page.rows);
        setInReview((page.counts.pending_review ?? 0) + (page.counts.revision_requested ?? 0));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contestId, reloadKey, attempt]);

  const available = (rows ?? []).filter((r) => availableFor(r, platform));
  const posters = useDraftPosters(available.map((r) => r.current_version?.id));

  // Keep the choice valid for this platform; with one option, choose it.
  useEffect(() => {
    if (!rows) return;
    if (selectedId && available.some((r) => r.id === selectedId)) return;
    onSelect(available.length === 1 ? available[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, platform]);

  const usedEverywhere = (rows?.length ?? 0) > 0 && available.length === 0;

  return (
    <section
      aria-labelledby="approved-draft-heading"
      className={cn(
        "mb-6 rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-[#7F39EC]/40 dark:bg-[#7F39EC]/10",
        isDark && "dark",
      )}
    >
      <h2 id="approved-draft-heading" className="text-base font-semibold text-gray-900 dark:text-white">
        1. Choose your approved draft
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        This campaign reviews videos before they&apos;re posted. Pick the approved draft you posted, then
        choose that post from {platformLabel} below.
      </p>

      <div className="mt-3">
        {failed ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300">
            Couldn&apos;t load your approved drafts.
            <Button
              size="sm"
              variant="outline"
              className="dark:border-white/15 dark:bg-transparent dark:text-gray-200"
              onClick={() => setAttempt((n) => n + 1)}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Try again
            </Button>
          </div>
        ) : rows === null ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your approved drafts…
          </div>
        ) : available.length === 0 ? (
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <p>
              {usedEverywhere
                ? `Your approved drafts are already linked to ${platformLabel} posts. Each approved draft can be posted once per platform.`
                : "You don't have an approved draft yet. Upload your video as a draft, wait for the brand to approve it, then post it and come back here."}
              {inReview > 0 &&
                ` ${inReview} of your drafts ${inReview === 1 ? "is" : "are"} still in review or waiting for changes.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="bg-[#7F39EC] hover:bg-[#7F39EC]/90">
                <Link href={`/dashboard/opportunities/${contestId}`}>
                  <Upload className="mr-1.5 h-4 w-4" /> Upload a draft
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="dark:border-white/15 dark:bg-transparent dark:text-gray-200"
              >
                <Link href={`/dashboard/submissions?view=drafts&campaign=${contestId}`}>
                  <Clapperboard className="mr-1.5 h-4 w-4" /> My drafts
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <fieldset>
            <legend className="sr-only">Approved drafts</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((row) => {
                const v = row.current_version;
                const checked = row.id === selectedId;
                const otherPosts = row.posts.map((p) => p.platform).filter(Boolean);
                return (
                  <label key={row.id} className="relative block cursor-pointer">
                    <input
                      type="radio"
                      name="approved-draft"
                      value={row.id}
                      checked={checked}
                      onChange={() => onSelect(row.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-white p-3 transition-colors dark:bg-white/5",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-[#7F39EC] peer-focus-visible:ring-offset-1",
                        checked
                          ? "border-[#7F39EC] ring-1 ring-[#7F39EC]"
                          : "border-gray-200 hover:border-[#7F39EC]/60 dark:border-white/10",
                      )}
                    >
                      <DraftThumb
                        posterUrl={v ? posters[v.id] : null}
                        durationSec={v?.duration_sec}
                        className="h-14 w-10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900 dark:text-white">
                          {v?.title ?? "Untitled draft"}
                          {row.version_count > 1 && (
                            <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                              v{v?.version_no ?? row.version_count}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {row.approved_at
                            ? `Approved ${formatDistanceToNowStrict(new Date(row.approved_at), { addSuffix: true })}`
                            : "Approved"}
                          {otherPosts.length > 0 && ` · posted on ${otherPosts.join(", ")}`}
                        </span>
                      </span>
                      <CheckCircle2
                        className={cn("h-5 w-5 shrink-0", checked ? "text-[#7F39EC]" : "text-transparent")}
                        aria-hidden="true"
                      />
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Post exactly the approved video. A post that went live before its approval is refused.
            </p>
          </fieldset>
        )}
      </div>
    </section>
  );
}
