"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrandPostPhaseFilterOption,
  ContestFormatFilterOption,
  ContestListSortOption,
  ContestTypeFilterOption,
  CampaignListTabCounts,
  PostPhaseCounts,
} from "@/lib/campaign-list-filters-storage";
import { SSR_CAMPAIGN_LIST_DEFAULTS } from "@/lib/campaign-list-filters-storage";

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

/** Drop session list pages after create/update so navigation does not paint stale rows. */
export function clearServerCampaignListClientCache(): void {
  listCache.clear();
}

/** Prefetch only the most-used sibling tabs to limit DB load. */
function brandPrefetchTabs(): readonly string[] {
  return ["live", "ended"];
}

/**
 * ContestsListLoader SSR always uses these defaults. Only seed cache when the
 * hydrated client query matches — otherwise we cache "all" under the wrong key.
 */
function queryMatchesSsrDefaults(query: ServerCampaignListQuery): boolean {
  return (
    query.tab === SSR_CAMPAIGN_LIST_DEFAULTS.tab &&
    query.sort === SSR_CAMPAIGN_LIST_DEFAULTS.sort &&
    query.page === SSR_CAMPAIGN_LIST_DEFAULTS.page &&
    query.limit === SSR_CAMPAIGN_LIST_DEFAULTS.limit &&
    query.platform === SSR_CAMPAIGN_LIST_DEFAULTS.platform &&
    query.contestType === SSR_CAMPAIGN_LIST_DEFAULTS.contestType &&
    query.contestFormat === SSR_CAMPAIGN_LIST_DEFAULTS.contestFormat &&
    query.postContestPhase === SSR_CAMPAIGN_LIST_DEFAULTS.postContestPhase &&
    query.search === SSR_CAMPAIGN_LIST_DEFAULTS.search
  );
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
  const tasks = brandPrefetchTabs()
    .filter((tab) => tab !== current.tab)
    .map(async (tab) => {
      // Never carry ended/all post-phase filters into other tabs.
      const prefetchQuery: ServerCampaignListQuery = {
        ...current,
        tab,
        page: 1,
        postContestPhase: "all",
        enabled: true,
      };
      const key = cacheKeyFromQuery(prefetchQuery);
      if (listCache.has(key)) return;
      try {
        const response = await fetch(buildListUrl(prefetchQuery), {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        const parsed = parseListPayload(payload);
        if (parsed) listCache.set(key, parsed);
      } catch {
        // prefetch is best-effort
      }
    });

  await Promise.all(tasks);
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

  const applyResult = useCallback((payload: ServerCampaignListResult<T>) => {
    setContests(payload.contests);
    setTotal(payload.total);
    setTabCounts(payload.tabCounts);
    setPostPhaseCounts(payload.postPhaseCounts);
    setAvailablePlatforms(payload.availablePlatforms);
    setHasLoadedOnce(true);
  }, []);

  // Seed SSR payload only when the client query matches ContestsListLoader defaults.
  useEffect(() => {
    if (!query.enabled || seededRef.current || !initial?.contests) return;
    seededRef.current = true;
    if (!queryMatchesSsrDefaults(query)) return;
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

      // Cache hit: paint immediately; optional quiet background revalidation.
      if (cached) {
        applyResult(cached);
        setLoading(false);
        setIsValidating(Boolean(opts?.quiet));
      } else {
        // No cached page for this tab/filter — show spinner, never flash empty state.
        setLoading(true);
        setIsValidating(false);
      }

      const requestId = ++requestIdRef.current;
      setError(null);

      try {
        if (opts?.bustCache) {
          // Drop client tab cache only for this session — never wipe global Redis.
          listCache.clear();
          const clearScope = current.isAdminView ? "admin" : "self";
          await fetch(
            `/api/contests/clear-cache?scope=${encodeURIComponent(clearScope)}`,
            { method: "POST", credentials: "same-origin" },
          ).catch(() => undefined);
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
        // Background only — do not await (keeps tab switches responsive).
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
    [applyResult],
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
    } else {
      // Avoid showing the previous tab's campaigns while the new tab loads.
      setContests([]);
      setTotal(0);
      setLoading(true);
      setIsValidating(false);
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => {
        void fetchPage({ quiet: Boolean(cached) });
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
