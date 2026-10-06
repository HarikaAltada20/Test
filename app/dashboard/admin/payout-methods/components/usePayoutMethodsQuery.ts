"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { SKYDO_STATUS_LABELS, isSkydoStatus } from "@/lib/skydo-payout";
import type {
  AdminPayoutMethodRow,
  AdminPayoutMethodsSummary,
  AdminPayoutSortKey,
} from "@/lib/admin-payout-methods";
import type { SkydoStatus } from "@/types/earnings";

export type PayoutView = "skydo" | "all";
export type SkydoStage = SkydoStatus | "any";
export type AddedPreset = "any" | "today" | "7d" | "30d" | "custom";

export interface PayoutQueryState {
  view: PayoutView;
  search: string;
  methodType: string | null;
  skydoStage: SkydoStage;
  /** All view only; Skydo view uses skydoStage. */
  skydoStatus: SkydoStatus | null;
  overdue: boolean;
  userType: string | null;
  isDefault: "true" | "false" | null;
  added: AddedPreset;
  createdFrom: string | null;
  createdTo: string | null;
  sort: AdminPayoutSortKey;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
  methodId: string | null;
}

/** URL keys reset by "Clear all". View, sort, page size and drawer are kept. */
export const FILTER_PARAM_KEYS = [
  "search",
  "methodType",
  "stage",
  "skydoStatus",
  "overdue",
  "userType",
  "isDefault",
  "added",
  "createdFrom",
  "createdTo",
] as const;

const DEFAULT_SORT: Record<PayoutView, { sort: AdminPayoutSortKey; order: "asc" | "desc" }> = {
  skydo: { sort: "stage_since", order: "asc" },
  all: { sort: "created_at", order: "desc" },
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function parseState(params: URLSearchParams, fallbackView: PayoutView): PayoutQueryState {
  const view: PayoutView =
    params.get("view") === "all" ? "all" : params.get("view") === "skydo" ? "skydo" : fallbackView;
  const stageParam = params.get("stage");
  const skydoStage: SkydoStage =
    stageParam === "any" ? "any" : isSkydoStatus(stageParam) ? stageParam : "email_pending";
  const skydoStatusParam = params.get("skydoStatus");
  const addedParam = params.get("added");
  const added: AddedPreset =
    addedParam === "today" || addedParam === "7d" || addedParam === "30d" || addedParam === "custom"
      ? addedParam
      : "any";
  const isDefaultParam = params.get("isDefault");
  const sortParam = params.get("sort") as AdminPayoutSortKey | null;
  const orderParam = params.get("order");

  return {
    view,
    search: params.get("search") ?? "",
    methodType: params.get("methodType"),
    skydoStage,
    skydoStatus: isSkydoStatus(skydoStatusParam) ? skydoStatusParam : null,
    overdue: params.get("overdue") === "1",
    userType: params.get("userType"),
    isDefault: isDefaultParam === "true" || isDefaultParam === "false" ? isDefaultParam : null,
    added,
    createdFrom: params.get("createdFrom"),
    createdTo: params.get("createdTo"),
    sort: sortParam ?? DEFAULT_SORT[view].sort,
    order: orderParam === "asc" || orderParam === "desc" ? orderParam : DEFAULT_SORT[view].order,
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
    pageSize: Math.max(1, Number(params.get("pageSize") ?? "25") || 25),
    methodId: params.get("method"),
  };
}

/** Builds the API filter query string (no page/format). */
export function buildApiQuery(state: PayoutQueryState): URLSearchParams {
  const qs = new URLSearchParams();
  if (state.search.trim()) qs.set("search", state.search.trim());
  if (state.view === "skydo") {
    qs.set("methodType", "skydo");
    if (state.overdue) qs.set("overdue", "1");
    else if (state.skydoStage !== "any") qs.set("skydoStatus", state.skydoStage);
  } else {
    if (state.methodType) qs.set("methodType", state.methodType);
    if (state.skydoStatus) qs.set("skydoStatus", state.skydoStatus);
  }
  if (state.userType) qs.set("userType", state.userType);
  if (state.isDefault) qs.set("isDefault", state.isDefault);
  if (state.added === "today") qs.set("createdFrom", startOfTodayIso());
  else if (state.added === "7d" || state.added === "30d") qs.set("addedWithin", state.added);
  else if (state.added === "custom") {
    if (state.createdFrom) qs.set("createdFrom", state.createdFrom);
    if (state.createdTo) qs.set("createdTo", state.createdTo);
  }
  qs.set("sort", state.sort);
  qs.set("order", state.order);
  return qs;
}

export function hasActiveFilters(state: PayoutQueryState): boolean {
  return Boolean(
    state.search.trim() ||
      state.userType ||
      state.isDefault ||
      state.added !== "any" ||
      (state.view === "all" && (state.methodType || state.skydoStatus))
  );
}

export function usePayoutMethodsQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [fallbackView, setFallbackView] = useState<PayoutView>("skydo");
  const state = useMemo(
    () => parseState(new URLSearchParams(searchParams.toString()), fallbackView),
    [searchParams, fallbackView]
  );

  const [rows, setRows] = useState<AdminPayoutMethodRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AdminPayoutMethodsSummary | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const resolvedDefaultView = useRef(searchParams.get("view") !== null);

  const setParams = useCallback(
    (updates: Record<string, string | null>, options: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      if (options.resetPage ?? true) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setView = useCallback(
    (view: PayoutView) => {
      setParams({ view, sort: null, order: null, method: null });
    },
    [setParams]
  );

  const clearFilters = useCallback(() => {
    const cleared: Record<string, string | null> = {};
    for (const key of FILTER_PARAM_KEYS) cleared[key] = null;
    setParams(cleared);
  }, [setParams]);

  const apiQuery = useMemo(() => buildApiQuery(state).toString(), [state]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    const qs = new URLSearchParams(apiQuery);
    qs.set("page", String(state.page));
    qs.set("pageSize", String(state.pageSize));
    fetch(`/api/admin/payout-methods?${qs.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load payout methods");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const nextSummary: AdminPayoutMethodsSummary | null = json.summary ?? null;
        setRows(json.data ?? []);
        setTotal(json.total ?? 0);
        setSummary(nextSummary);
        setLastUpdated(Date.now());
        if (!resolvedDefaultView.current) {
          resolvedDefaultView.current = true;
          if ((nextSummary?.by_skydo_status.email_pending ?? 0) === 0) setFallbackView("all");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) toast.error(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setRefreshing(false);
        setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiQuery, state.page, state.pageSize, reloadKey]);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  const patchRows = useCallback(
    (ids: string[], patch: Partial<AdminPayoutMethodRow>) => {
      const set = new Set(ids);
      setRows((prev) => prev.map((r) => (set.has(r.id) ? { ...r, ...patch } : r)));
    },
    []
  );

  /** Sends one status to many rows (single PATCH for one id, bulk endpoint otherwise). */
  const sendStatus = useCallback(async (ids: string[], status: SkydoStatus) => {
    if (ids.length === 1) {
      const res = await fetch(`/api/admin/payout-methods/${ids[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skydo_status: status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update status");
      return 1;
    }
    const res = await fetch("/api/admin/payout-methods/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, skydo_status: status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Bulk update failed");
    return (json.updated as number) ?? ids.length;
  }, []);

  /**
   * Changes Skydo status with an Undo toast. `previous` maps id -> prior status
   * so undo can restore mixed selections.
   */
  const updateStatus = useCallback(
    async (
      ids: string[],
      status: SkydoStatus,
      previous: Record<string, SkydoStatus | null>,
      options: { silent?: boolean } = {}
    ): Promise<boolean> => {
      if (ids.length === 0) return false;
      const nowIso = new Date().toISOString();
      patchRows(ids, { skydo_status: status, skydo_status_updated_at: nowIso, stage_since: nowIso });
      try {
        const updated = await sendStatus(ids, status);
        if (!options.silent) {
          const label = SKYDO_STATUS_LABELS[status];
          toast.success(
            updated === 1 ? `Marked as ${label}` : `${updated} Skydo methods marked as ${label}`,
            {
              action: {
                label: "Undo",
                onClick: () => {
                  const groups = new Map<SkydoStatus, string[]>();
                  for (const id of ids) {
                    const prev = previous[id];
                    if (!prev) continue;
                    groups.set(prev, [...(groups.get(prev) ?? []), id]);
                  }
                  void Promise.all(
                    Array.from(groups.entries()).map(([prev, groupIds]) =>
                      sendStatus(groupIds, prev)
                    )
                  )
                    .then(() => {
                      toast.success("Status change undone");
                      refetch();
                    })
                    .catch((err: Error) => toast.error(err.message));
                },
              },
            }
          );
        }
        refetch();
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        refetch();
        return false;
      }
    },
    [patchRows, refetch, sendStatus]
  );

  const saveNotes = useCallback(
    async (id: string, notes: string | null): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/payout-methods/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_notes: notes }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to save notes");
        patchRows([id], { admin_notes: json.data?.admin_notes ?? null });
        return true;
      } catch (err) {
        toast.error((err as Error).message);
        return false;
      }
    },
    [patchRows]
  );

  const fetchAllMatching = useCallback(
    async (format: "emails" | "ids") => {
      const res = await fetch(`/api/admin/payout-methods?${apiQuery}&format=${format}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      return json as {
        emails?: string[];
        ids: string[];
        skydoIds?: string[];
        truncated?: boolean;
      };
    },
    [apiQuery]
  );

  return {
    state,
    rows,
    total,
    summary,
    initialLoading,
    refreshing,
    lastUpdated,
    apiQuery,
    setParams,
    setView,
    clearFilters,
    refetch,
    updateStatus,
    saveNotes,
    fetchAllMatching,
    patchRows,
  };
}

export type PayoutMethodsQuery = ReturnType<typeof usePayoutMethodsQuery>;
