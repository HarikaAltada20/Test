"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { formatDistanceToNowStrict } from "date-fns";
import { Clapperboard, Inbox, Loader2, Search, SearchX, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_DRAFT_FILTERS,
  CAMPAIGN_DRAFT_FILTER_LABELS,
  waitingLabel,
  type CampaignDraftFilter,
  type DraftListPage,
  type DraftListRow,
  type DraftSort,
} from "@/lib/content-drafts";
import { CreatorAvatar } from "@/components/campaign-access/CreatorAvatar";
import { EmptyState } from "@/components/campaign-access/EmptyState";
import { listCampaignDrafts } from "./api";
import { DraftReviewDrawer } from "./DraftReviewDrawer";
import { DraftStatusBadge } from "./DraftStatusBadge";
import { DraftThumb, useDraftPosters } from "./media";

type Props = {
  contestId: string;
  /** Called with the number of drafts waiting for review, e.g. for the tab label. */
  onPendingCountChange?: (count: number) => void;
  /** Open this draft first (from a notification link). */
  initialDraftId?: string | null;
};

const PAGE_SIZE = 50;

/** The campaign's Drafts tab for its brand and admins. */
export function DraftReviewPanel({ contestId, onPendingCountChange, initialDraftId }: Props) {
  const isDark = useDashboardDark();
  const [status, setStatus] = useState<CampaignDraftFilter>("pending_review");
  const [sort, setSort] = useState<DraftSort>("oldest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<DraftListPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(initialDraftId ?? null);
  const latest = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(
    async ({ append = false, silent = false }: { append?: boolean; silent?: boolean } = {}) => {
      const id = ++latest.current;
      if (append) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const res = await listCampaignDrafts({
          contestId,
          status,
          search,
          sort,
          offset: append ? data?.rows.length ?? 0 : 0,
          // A silent refresh keeps everything already shown.
          limit: silent ? Math.max(PAGE_SIZE, data?.rows.length ?? 0) : PAGE_SIZE,
        });
        if (id !== latest.current) return;
        setData((prev) => (append && prev ? { ...res, rows: [...prev.rows, ...res.rows] } : res));
        onPendingCountChange?.(res.counts.pending_review ?? 0);
      } catch (e) {
        if (id !== latest.current) return;
        toast({
          title: "Couldn't load drafts",
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
    [contestId, status, search, sort, data?.rows.length],
  );

  useEffect(() => {
    load();
    setReviewIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId, status, search, sort]);

  const rows = data?.rows ?? [];
  const posters = useDraftPosters(rows.map((r) => r.current_version?.id));

  // Keep the drawer on a real row after the list changes under it.
  useEffect(() => {
    if (reviewIndex !== null && reviewIndex >= rows.length) {
      setReviewIndex(rows.length ? rows.length - 1 : null);
    }
  }, [rows.length, reviewIndex]);

  // Deep link: open the draft from a notification once it's in the list.
  useEffect(() => {
    if (!pendingOpenId || loading) return;
    const i = rows.findIndex((r) => r.id === pendingOpenId);
    if (i >= 0) {
      setReviewIndex(i);
      setPendingOpenId(null);
    } else if (status !== "all") {
      setStatus("all");
    } else {
      setPendingOpenId(null);
    }
  }, [pendingOpenId, rows, loading, status]);

  const counts = data?.counts ?? {};
  const countFor = (f: CampaignDraftFilter) =>
    f === "all" ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : counts[f] ?? 0;
  const anyDrafts = countFor("all") > 0;

  return (
    <div className={cn("space-y-5", isDark && "dark")}>
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Drafts
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Creators upload their video here before posting. Approve it, ask for changes, or reject
          it. Only approved videos can be submitted.
        </p>
        {data?.review_before_posting === false && (
          <p className="mt-2 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-300">
            Review before posting is off for this campaign, so creators can post without approval. You
            can still review the drafts already sent.
          </p>
        )}
      </div>

      <TabsPrimitive.Root
        value={status}
        onValueChange={(v) => setStatus(v as CampaignDraftFilter)}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsPrimitive.List
            aria-label="Draft status"
            className="flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-white/5"
          >
            {CAMPAIGN_DRAFT_FILTERS.map((s) => (
              <TabsPrimitive.Trigger
                key={s}
                value={s}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] data-[state=active]:bg-white data-[state=active]:text-[#4A00BE] data-[state=active]:shadow-sm dark:text-gray-300 dark:hover:text-white dark:data-[state=active]:bg-[#7F39EC] dark:data-[state=active]:text-white"
              >
                {CAMPAIGN_DRAFT_FILTER_LABELS[s]}
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 text-center text-xs",
                    s === "pending_review" && countFor(s) > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
                      : "bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                  )}
                >
                  {countFor(s)}
                </span>
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-60">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                className="h-10 pl-8 pr-9 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
                placeholder="Search creator or title"
                aria-label="Search drafts by creator or title"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={() => setSearchInput("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as DraftSort)}>
              <SelectTrigger aria-label="Sort drafts" isDark={isDark} className="h-10 w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="oldest" isDark={isDark}>
                  Oldest first
                </SelectItem>
                <SelectItem value="newest" isDark={isDark}>
                  Newest first
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsPrimitive.Content value={status} className="focus-visible:outline-none">
          <div className="rounded-md border border-gray-200 dark:border-white/10">
            {loading ? (
              <ul className="divide-y divide-gray-200 dark:divide-white/10" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-16 w-12 rounded-md dark:bg-white/10" />
                    <Skeleton className="h-9 w-9 rounded-full dark:bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3 dark:bg-white/10" />
                      <Skeleton className="h-3 w-1/4 dark:bg-white/10" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : rows.length === 0 ? (
              search ? (
                <EmptyState
                  icon={SearchX}
                  title="No drafts match your search"
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      className="dark:border-white/15 dark:bg-transparent dark:text-gray-200"
                      onClick={() => setSearchInput("")}
                    >
                      Clear search
                    </Button>
                  }
                />
              ) : !anyDrafts ? (
                <EmptyState
                  icon={Clapperboard}
                  title="No drafts yet"
                  description="When creators upload a video for review, it shows up here. You'll get a notification."
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title={
                    status === "pending_review"
                      ? "You're all caught up"
                      : `No ${CAMPAIGN_DRAFT_FILTER_LABELS[status].toLowerCase()} drafts`
                  }
                />
              )
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {rows.map((row, i) => (
                  <ReviewRow
                    key={row.id}
                    row={row}
                    posterUrl={row.current_version ? posters[row.current_version.id] : null}
                    onOpen={() => setReviewIndex(i)}
                  />
                ))}
              </ul>
            )}
          </div>
          {data && rows.length < data.total && (
            <div className="mt-3 flex justify-center">
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
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      <DraftReviewDrawer
        rows={rows}
        index={reviewIndex}
        onIndexChange={setReviewIndex}
        onChanged={() => load({ silent: true })}
        isDark={isDark}
      />
    </div>
  );
}

function ReviewRow({
  row,
  posterUrl,
  onOpen,
}: {
  row: DraftListRow;
  posterUrl: string | null | undefined;
  onOpen: () => void;
}) {
  const v = row.current_version;
  const creator = row.creator;
  const pending = row.display_status === "pending_review";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
      >
        <DraftThumb posterUrl={posterUrl} durationSec={v?.duration_sec} />
        <CreatorAvatar
          username={creator?.username}
          fullName={creator?.full_name}
          src={creator?.profile_picture_url}
          className="hidden sm:flex"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-gray-900 dark:text-white">
            {v?.title ?? "Untitled draft"}
            {row.version_count > 1 && (
              <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">v{row.version_count}</span>
            )}
          </p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            @{creator?.username ?? "creator"}
            {row.record && (
              <span className="hidden sm:inline">
                {" "}
                · {row.record.approved} approved · {row.record.rejected} rejected · trust {row.record.draft_trust}%
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <DraftStatusBadge status={row.display_status} />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {pending
              ? `Waiting ${waitingLabel(row.submitted_at)}`
              : formatDistanceToNowStrict(new Date(row.updated_at), { addSuffix: true })}
          </span>
        </div>
      </button>
    </li>
  );
}
