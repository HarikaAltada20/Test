"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight, Clapperboard, Loader2, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DRAFT_FILTER_LABELS,
  MY_DRAFT_FILTERS,
  draftNextStep,
  parseMyDraftFilter,
  type DraftListPage,
  type DraftListRow,
  type MyDraftFilter,
} from "@/lib/content-drafts";
import { EmptyState } from "@/components/campaign-access/EmptyState";
import { listMyDrafts } from "./api";
import { DraftDetailSheet } from "./DraftDetailSheet";
import { DraftStatusBadge } from "./DraftStatusBadge";
import { DraftThumb, useDraftPosters } from "./media";

const PAGE_SIZE = 30;

type Props = {
  isDark: boolean;
  /** Called with the number of drafts that need the creator (revision requested or approved). */
  onActionCountChange?: (count: number) => void;
};

/**
 * The creator's drafts across campaigns (My Submissions → Drafts).
 * URL: ?view=drafts&status=<filter>&campaign=<id>&draft=<id>
 */
export function MyDraftsPanel({ isDark, onActionCountChange }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const status = parseMyDraftFilter(params.get("status"));
  const campaignId = params.get("campaign");
  const openDraftId = params.get("draft");

  const [page, setPage] = useState<DraftListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useRef(0);

  const setParam = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const load = useCallback(
    async ({ append = false, silent = false } = {}) => {
      const id = ++latest.current;
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const res = await listMyDrafts({
          contestId: campaignId,
          status,
          offset: append ? page?.rows.length ?? 0 : 0,
          limit: PAGE_SIZE,
        });
        if (id !== latest.current) return;
        setPage((prev) => (append && prev ? { ...res, rows: [...prev.rows, ...res.rows] } : res));
        onActionCountChange?.((res.counts.revision_requested ?? 0) + (res.counts.approved ?? 0));
      } catch (e) {
        if (id !== latest.current) return;
        toast({
          title: "Couldn't load your drafts",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      } finally {
        if (id === latest.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaignId, status, page?.rows.length],
  );

  useEffect(() => {
    load();
    // Reload when the filters change, not when rows are appended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, status]);

  const rows = page?.rows ?? [];
  const posters = useDraftPosters(rows.map((r) => r.current_version?.id));
  const counts = page?.counts ?? {};
  const countFor = (f: MyDraftFilter) =>
    f === "all" ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : counts[f] ?? 0;
  const campaignTitle = campaignId ? rows.find((r) => r.contest_id === campaignId)?.campaign?.title : null;

  return (
    <div className={cn("space-y-4", isDark && "dark")}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Draft status" className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          {MY_DRAFT_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={status === f}
              onClick={() => setParam({ status: f === "all" ? null : f, draft: null })}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                status === f
                  ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                  : "border-gray-200 text-gray-700 hover:border-[#7F39EC]/60 dark:border-white/15 dark:text-gray-200",
              )}
            >
              {DRAFT_FILTER_LABELS[f]}
              {page && status !== f && countFor(f) > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {countFor(f)}
                </span>
              )}
            </button>
          ))}
        </div>
        {campaignId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 py-1 pl-3 pr-1 text-sm text-[#4A00BE] dark:bg-[#7F39EC]/20 dark:text-purple-200">
            {campaignTitle ? `Campaign: ${campaignTitle}` : "One campaign"}
            <button
              type="button"
              aria-label="Show drafts from all campaigns"
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:bg-white/10"
              onClick={() => setParam({ campaign: null, draft: null })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-white/10">
        {loading ? (
          <ul className="divide-y divide-gray-200 dark:divide-white/10" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-16 w-12 rounded-md dark:bg-white/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2 dark:bg-white/10" />
                  <Skeleton className="h-3 w-1/3 dark:bg-white/10" />
                </div>
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          status !== "all" ? (
            <EmptyState
              icon={SearchX}
              title={`No ${DRAFT_FILTER_LABELS[status].toLowerCase()} drafts`}
              actions={
                <Button size="sm" variant="outline" className="dark:border-white/15 dark:bg-transparent dark:text-gray-200" onClick={() => setParam({ status: null })}>
                  Show all drafts
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Clapperboard}
              title="No drafts yet"
              description="Some campaigns review your video before you post it. Upload a draft from the campaign page, and it shows up here."
              actions={
                <Button asChild size="sm" className="bg-[#7F39EC] hover:bg-[#7F39EC]/90">
                  <Link href="/dashboard/opportunities">Find campaigns</Link>
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-white/10">
            {rows.map((row) => (
              <DraftRow
                key={row.id}
                row={row}
                posterUrl={row.current_version ? posters[row.current_version.id] : null}
                onOpen={() => setParam({ draft: row.id })}
              />
            ))}
          </ul>
        )}
      </div>

      {page && rows.length < page.total && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="dark:border-white/15 dark:bg-transparent dark:text-gray-200"
            disabled={loadingMore}
            onClick={() => load({ append: true })}
          >
            {loadingMore && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Show more
          </Button>
        </div>
      )}

      <DraftDetailSheet
        draftId={openDraftId}
        onClose={() => setParam({ draft: null })}
        onChanged={() => load({ silent: true })}
        isDark={isDark}
      />
    </div>
  );
}

function DraftRow({
  row,
  posterUrl,
  onOpen,
}: {
  row: DraftListRow;
  posterUrl: string | null | undefined;
  onOpen: () => void;
}) {
  const v = row.current_version;
  const needsAction = row.display_status === "revision_requested" || (row.display_status === "approved" && !row.campaign?.has_ended);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
      >
        <DraftThumb posterUrl={posterUrl} durationSec={v?.duration_sec} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-gray-900 dark:text-white">{v?.title ?? "Untitled draft"}</p>
            {row.version_count > 1 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">v{row.version_count}</span>
            )}
          </div>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {row.campaign?.title ?? "Campaign"}
            {row.campaign?.brand_name ? ` · ${row.campaign.brand_name}` : ""}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              needsAction ? "font-medium text-[#7F39EC] dark:text-purple-300" : "text-gray-500 dark:text-gray-400",
            )}
          >
            {draftNextStep(row)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <DraftStatusBadge status={row.display_status} />
          <time dateTime={row.updated_at} className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNowStrict(new Date(row.updated_at), { addSuffix: true })}
          </time>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>
    </li>
  );
}
