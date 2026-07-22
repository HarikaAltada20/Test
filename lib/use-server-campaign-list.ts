"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrandPostPhaseFilterOption,
  ContestFormatFilterOption,
  ContestListSortOption,
  ContestTypeFilterOption,
} from "@/lib/campaign-list-filters-storage";
import type {
  CampaignListTabCounts,
  PostPhaseCounts,
} from "@/lib/contest-list-query";

export type ServerCampaignListQuery = {
  isAdminView: boolean;
  tab: string;
  sort: ContestListSortOption | string;
  page: number;
  limit: number;
  platform: string;
  contestType: ContestTypeFilterOption | string;
  contestFormat: ContestFormatFilterOption | string;
  postContestPhase: BrandPostPhaseFilterOption | string;
  search: string;
  enabled: boolean;
};

export type ServerCampaignListResult<T> = {
  contests: T[];
  total: number;
  tabCounts: CampaignListTabCounts;
  postPhaseCounts: PostPhaseCounts;
  availablePlatforms: string[];
};

const EMPTY_TAB_COUNTS: CampaignListTabCounts = {
  all: 0,
  draft: 0,
  pending_approval: 0,
  ready: 0,
  upcoming: 0,
  live: 0,
  ended: 0,
  rejected: 0,
};

const EMPTY_POST_PHASE: PostPhaseCounts = {
  post_pending_review: 0,
  post_in_review: 0,
  post_payment_pending: 0,
  post_paid: 0,
};

/** In-memory cache so tab/filter switches feel instant. */
const listCache = new Map<string, ServerCampaignListResult<unknown>>();

function brandPrefetchTabs(isAdminView: boolean): readonly string[] {
  return isAdminView
    ? [
        "all",
        "live",
        "ended",
        "upcoming",
        "draft",
        "pending_approval",
        "ready",
        "rejected",
      ]
    : ["all", "live", "ended", "upcoming"];
}

function buildListUrl(query: ServerCampaignListQuery): string {
  const base = query.isAdminView
    ? "/api/admin/contests/list"
    : "/api/contests/list";
  const params = new URLSearchParams({
    tab: query.tab,
    sort: query.sort,
    page: String(query.page),
    limit: String(query.limit),
    platform: query.platform,
    contestType: query.contestType,
    contestFormat: query.contestFormat,
    postContestPhase: query.postContestPhase,
    search: query.search,
  });
  return `${base}?${params.toString()}`;
}

function cacheKeyFromQuery(query: ServerCampaignListQuery): string {
  return buildListUrl(query);
}

function parseListPayload<T>(payload: unknown): ServerCampaignListResult<T> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.contests)) return null;
  return {
    contests: p.contests as T[],
    total: Number(p.total) || 0,
    tabCounts: (p.tabCounts as CampaignListTabCounts) || EMPTY_TAB_COUNTS,
    postPhaseCounts:
      (p.postPhaseCounts as PostPhaseCounts) || EMPTY_POST_PHASE,
    availablePlatforms: Array.isArray(p.availablePlatforms)
      ? (p.availablePlatforms as string[])
      : ["all"],
  };
}

async function prefetchSiblingTabs(current: ServerCampaignListQuery) {
  for (const tab of brandPrefetchTabs(current.isAdminView)) {
    if (tab === current.tab) continue;
    const prefetchQuery: ServerCampaignListQuery = {
      ...current,
      tab,
      page: 1,
      enabled: true,
    };
    const key = cacheKeyFromQuery(prefetchQuery);
    if (listCache.has(key)) continue;
    try {
      const response = await fetch(buildListUrl(prefetchQuery), {
        cache: "no-store",
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const parsed = parseListPayload(payload);
      if (parsed) listCache.set(key, parsed);
    } catch {
      // prefetch is best-effort
    }
  }
}

/**
 * Fetches a server-sorted campaign page. Uses an in-memory cache so switching
 * tabs/filters shows data immediately when previously loaded.
 */
export function useServerCampaignList<T>(
  query: ServerCampaignListQuery,
  initial?: Partial<ServerCampaignListResult<T>>,
) {
  const [contests, setContests] = useState<T[]>(initial?.contests ?? []);
  const [total, setTotal] = useState(
    initial?.total ?? initial?.contests?.length ?? 0,
  );
  const [tabCounts, setTabCounts] = useState<CampaignListTabCounts>(
    initial?.tabCounts ?? EMPTY_TAB_COUNTS,
  );
  const [postPhaseCounts, setPostPhaseCounts] = useState<PostPhaseCounts>(
    initial?.postPhaseCounts ?? EMPTY_POST_PHASE,
  );
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>(
    initial?.availablePlatforms ?? ["all"],
  );
  /** True only while waiting with no data to show for this query. */
  const [loading, setLoading] = useState(false);
  /** True on background refetch when prior/cached data is already shown. */
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(
    Boolean(initial?.contests && initial?.total !== undefined),
  );
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const seededRef = useRef(false);
  const contestsRef = useRef(contests);
  contestsRef.current = contests;

  const applyResult = useCallback((payload: ServerCampaignListResult<T>) => {
    setContests(payload.contests);
    setTotal(payload.total);
    setTabCounts(payload.tabCounts);
    setPostPhaseCounts(payload.postPhaseCounts);
    setAvailablePlatforms(payload.availablePlatforms);
    setHasLoadedOnce(true);
  }, []);

  // Seed SSR/initial payload into cache so revisiting that query is instant.
  useEffect(() => {
    if (!query.enabled || seededRef.current || !initial?.contests) return;
    seededRef.current = true;
    const key = cacheKeyFromQuery(query);
    if (listCache.has(key)) return;
    listCache.set(key, {
      contests: initial.contests,
      total: initial.total ?? initial.contests.length,
      tabCounts: initial.tabCounts ?? EMPTY_TAB_COUNTS,
      postPhaseCounts: initial.postPhaseCounts ?? EMPTY_POST_PHASE,
      availablePlatforms: initial.availablePlatforms ?? ["all"],
    } as ServerCampaignListResult<unknown>);
  }, [
    query.enabled,
    query.isAdminView,
    query.tab,
    query.sort,
    query.page,
    query.limit,
    query.platform,
    query.contestType,
    query.contestFormat,
    query.postContestPhase,
    query.search,
    initial,
  ]);

  const fetchPage = useCallback(
    async (opts?: { bustCache?: boolean; quiet?: boolean }) => {
      const current = queryRef.current;
      if (!current.enabled) return;

      const key = cacheKeyFromQuery(current);
      const cached = !opts?.bustCache
        ? (listCache.get(key) as ServerCampaignListResult<T> | undefined)
        : undefined;

      if (cached) {
        applyResult(cached);
        setLoading(false);
        setIsValidating(true);
      } else if (!opts?.quiet) {
        // Keep prior campaigns visible — only block when we have nothing to show.
        if (hasLoadedOnce || contestsRef.current.length > 0) {
          setIsValidating(true);
          setLoading(false);
        } else {
          setLoading(true);
        }
      }

      const requestId = ++requestIdRef.current;
      setError(null);

      try {
        if (opts?.bustCache) {
          listCache.clear();
          await fetch("/api/contests/clear-cache", { method: "POST" }).catch(
            () => undefined,
          );
        }

        const url = buildListUrl(current);
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`List fetch failed (${response.status})`);
        }
        const payload = await response.json();
        if (requestId !== requestIdRef.current) return;
        const parsed = parseListPayload<T>(payload);
        if (!parsed) {
          throw new Error("Invalid list response");
        }
        listCache.set(key, parsed as ServerCampaignListResult<unknown>);
        applyResult(parsed);
        void prefetchSiblingTabs(current);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load campaigns";
        console.error("[useServerCampaignList]", message);
        setError(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsValidating(false);
        }
      }
    },
    [applyResult, hasLoadedOnce],
  );

  useEffect(() => {
    if (!query.enabled) return;

    // Instant paint from cache when switching tabs/filters.
    const key = cacheKeyFromQuery(query);
    const cached = listCache.get(key) as ServerCampaignListResult<T> | undefined;
    if (cached) {
      applyResult(cached);
      setLoading(false);
      setIsValidating(false);
    } else if (!(hasLoadedOnce || contestsRef.current.length > 0)) {
      setLoading(true);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => {
        void fetchPage({ quiet: Boolean(cached) || hasLoadedOnce });
      },
      query.search ? 250 : 0,
    );

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- primitive deps only
  }, [
    query.enabled,
    query.isAdminView,
    query.tab,
    query.sort,
    query.page,
    query.limit,
    query.platform,
    query.contestType,
    query.contestFormat,
    query.postContestPhase,
    query.search,
  ]);

  const refresh = useCallback(
    () => fetchPage({ bustCache: true }),
    [fetchPage],
  );

  return {
    contests,
    total,
    tabCounts,
    postPhaseCounts,
    availablePlatforms,
    loading,
    isValidating,
    hasLoadedOnce,
    error,
    refresh,
    setContests,
  };
}
