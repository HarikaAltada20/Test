"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Check, ClipboardList, Inbox, Link2, Loader2, Search, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  MAX_BULK_REVIEW,
  applicationAnswerPreview,
  applicationDisplayStatus,
  clampPage,
  countsAfterReview,
  type ApplicationStatus,
  type ContestApplication,
} from "@/lib/campaign-access";
import { applicationsApi, type ApplicationListResponse } from "./api";
import { ApplicationStatusBadge } from "./AccessBadge";
import { LinkChip } from "./ApplicationAnswers";
import { ApplicationReviewDrawer } from "./ApplicationReviewDrawer";
import { CreatorAvatar } from "./CreatorAvatar";
import { EmptyState } from "./EmptyState";
import { RejectApplicationsDialog } from "./RejectApplicationsDialog";
import { RelativeTime } from "./RelativeTime";
import { ApplicationRowsSkeleton } from "./Skeletons";

type Props = {
  contestId: string;
  /** Called with the pending count whenever it changes, e.g. for the tab label. */
  onPendingCountChange?: (count: number) => void;
};

const PAGE_SIZE = 50;
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

export function ApplicationsPanel({ contestId, onPendingCountChange }: Props) {
  const isDark = useDashboardDark();
  const [status, setStatus] = useState<ApplicationStatus>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApplicationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Map<string, ContestApplication>>(new Map());
  const [inFlight, setInFlight] = useState<Set<string>>(new Set());
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [rejectTargets, setRejectTargets] = useState<ContestApplication[] | null>(null);
  const [approveTargets, setApproveTargets] = useState<ContestApplication[] | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const requestId = ++latestRequest.current;
      let movingPage = false;
      if (!silent) setLoading(true);
      try {
        const res = await applicationsApi.list(contestId, {
          status,
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        });
        if (requestId !== latestRequest.current) return;
        // Reviews can shrink the results so this page no longer exists; the page change reloads.
        const validPage = clampPage(page, res.total, PAGE_SIZE);
        if (validPage !== page) {
          movingPage = true;
          setPage(validPage);
          return;
        }
        setData(res);
        if (!silent) setSelected(new Map());
      } catch (e: unknown) {
        if (requestId !== latestRequest.current) return;
        toast({
          title: "Could not load applications",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      } finally {
        if (requestId === latestRequest.current && !movingPage) setLoading(false);
      }
    },
    [contestId, status, search, page],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const pendingCount = data?.counts?.pending;
  useEffect(() => {
    if (pendingCount !== undefined) onPendingCountChange?.(pendingCount);
  }, [pendingCount, onPendingCountChange]);

  const applications = useMemo(() => data?.applications ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyApplications = Object.values(data?.counts ?? {}).some((n) => n > 0);

  // Keep the drawer on a real row after reviewed rows leave the list.
  useEffect(() => {
    if (reviewIndex === null) return;
    if (applications.length === 0) setReviewIndex(null);
    else if (reviewIndex >= applications.length) setReviewIndex(applications.length - 1);
  }, [applications.length, reviewIndex]);

  const needsReapprove = (a: ContestApplication) => a.status === "approved" && !a.on_access_list;
  const canApprove = useCallback(
    (a: ContestApplication) =>
      a.status === "pending" || a.status === "rejected" || (a.status === "approved" && !a.on_access_list),
    [],
  );
  const canReject = useCallback((a: ContestApplication) => a.status === "pending", []);
  const selectable = applications.filter((a) => canApprove(a) || canReject(a));
  const allOnPageSelected = selectable.length > 0 && selectable.every((a) => selected.has(a.id));
  const selectedApps = Array.from(selected.values());
  const matchingCount = Math.min(total, MAX_BULK_REVIEW);

  const toggleSelected = (app: ContestApplication) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(app.id)) next.delete(app.id);
      else next.set(app.id, app);
      return next;
    });

  /**
   * Reviews optimistically: rows fade while the request runs and leave the list
   * when it succeeds; on failure they come back. A quiet reload then syncs the
   * page, including moving to a page that still exists.
   */
  const review = async (
    apps: ContestApplication[],
    decision: "approve" | "reject",
    reason?: string,
  ): Promise<boolean> => {
    if (apps.length === 0) return false;
    const ids = apps.map((a) => a.id);
    const target: ApplicationStatus = decision === "approve" ? "approved" : "rejected";
    setBusy(true);
    setInFlight((prev) => new Set([...prev, ...ids]));
    try {
      if (apps.length === 1) {
        const res = await applicationsApi.review(contestId, ids[0], decision, reason || undefined);
        toast({ title: res.message });
      } else {
        const res = await applicationsApi.bulkReview(contestId, ids, decision, reason || undefined);
        toast({
          title: `${res.updated} application${res.updated === 1 ? "" : "s"} ${
            decision === "approve" ? "approved" : "rejected"
          }`,
          description: res.skipped ? `${res.skipped} skipped` : undefined,
        });
      }
      const idSet = new Set(ids);
      setData((d) =>
        d && {
          ...d,
          applications: d.applications
            .filter((a) => !idSet.has(a.id) || status === target)
            .map((a) => (idSet.has(a.id) ? { ...a, status: target, on_access_list: decision === "approve" } : a)),
          total: status === target ? d.total : Math.max(0, d.total - apps.filter((a) => a.status === status).length),
          counts: countsAfterReview(d.counts, apps, decision),
        },
      );
      setSelected((prev) => {
        const next = new Map(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      void load({ silent: true });
      return true;
    } catch (e: unknown) {
      toast({
        title: "Something went wrong",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
      return false;
    } finally {
      setInFlight((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setBusy(false);
    }
  };

  const approveSelected = () => {
    const apps = selectedApps.filter(canApprove);
    if (apps.length > 1) setApproveTargets(apps);
    else review(apps, "approve");
  };

  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const res = await applicationsApi.list(contestId, {
        status,
        search: search || undefined,
        page: 1,
        limit: MAX_BULK_REVIEW,
      });
      setSelected(
        new Map(
          res.applications.filter((a) => canApprove(a) || canReject(a)).map((a) => [a.id, a]),
        ),
      );
    } catch (e: unknown) {
      toast({
        title: "Could not select all",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSelectingAll(false);
    }
  };

  const copyCampaignLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/opportunities/${contestId}`,
      );
      toast({ title: "Campaign link copied" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" });
    }
  };

  const renderStatus = (a: ContestApplication) => {
    const display = applicationDisplayStatus(a);
    if (display !== "access_removed") return <ApplicationStatusBadge status={display} />;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
            >
              <ApplicationStatusBadge status={display} />
            </button>
          </TooltipTrigger>
          <TooltipPortal>
          <TooltipContent className="max-w-60 border-gray-200 bg-white text-xs text-gray-900">
            Approved, then removed from the access list. Re-approve to give access back.
          </TooltipContent>
          </TooltipPortal>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderPreview = (a: ContestApplication) => {
    const preview = applicationAnswerPreview(a.answers);
    if (!preview) return null;
    if (preview.isLink) return <LinkChip url={preview.text} />;
    return (
      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-600 dark:text-gray-300">{preview.prompt}:</span>{" "}
        {preview.text}
      </span>
    );
  };

  return (
    <div className={cn("space-y-5", isDark && "dark")}>
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Applications
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Approving a creator adds them to this campaign&apos;s access list so they can see the
          full campaign and submit.
        </p>
      </div>

      <TabsPrimitive.Root
        value={status}
        onValueChange={(v) => {
          setStatus(v as ApplicationStatus);
          setPage(1);
          setReviewIndex(null);
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsPrimitive.List
            aria-label="Application status"
            className="flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-white/5"
          >
            {APPLICATION_STATUSES.map((s) => (
              <TabsPrimitive.Trigger
                key={s}
                value={s}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] data-[state=active]:bg-white data-[state=active]:text-[#4A00BE] data-[state=active]:shadow-sm dark:text-gray-300 dark:hover:text-white dark:data-[state=active]:bg-[#7F39EC] dark:data-[state=active]:text-white"
              >
                {APPLICATION_STATUS_LABELS[s]}
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 text-center text-xs",
                    s === "pending" && (data?.counts?.pending ?? 0) > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
                      : "bg-gray-200/80 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                  )}
                >
                  {data?.counts?.[s] ?? 0}
                </span>
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              className="h-10 pl-8 pr-9 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
              placeholder="Search username"
              aria-label="Search applications by username"
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
        </div>

        <TabsPrimitive.Content value={status} className="focus-visible:outline-none">
          <div className="rounded-md border border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              <Checkbox
                aria-label="Select all on this page"
                checked={allOnPageSelected}
                disabled={selectable.length === 0}
                onCheckedChange={(v) =>
                  setSelected((prev) => {
                    const next = new Map(prev);
                    selectable.forEach((a) => (v ? next.set(a.id, a) : next.delete(a.id)));
                    return next;
                  })
                }
              />
              <span className="flex-1">
                Creator<span className="sm:hidden"> · select all on this page</span>
              </span>
              <span className="hidden w-28 sm:block">Applied</span>
              <span className="hidden w-32 sm:block">Status</span>
              <span className="hidden w-48 text-right sm:block">Actions</span>
            </div>

            {allOnPageSelected && total > selectable.length && selected.size < matchingCount && (
              <div className="flex flex-wrap items-center justify-center gap-2 border-b border-gray-200 bg-purple-50/60 px-4 py-2 text-sm text-gray-700 dark:border-white/10 dark:bg-[#7F39EC]/10 dark:text-gray-200">
                All {selectable.length} on this page are selected.
                <button
                  type="button"
                  className="rounded-sm font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
                  disabled={selectingAll}
                  onClick={selectAllMatching}
                >
                  {selectingAll && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
                  Select all {matchingCount} matching
                </button>
                {total > MAX_BULK_REVIEW && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (up to {MAX_BULK_REVIEW} at a time)
                  </span>
                )}
              </div>
            )}

            {loading ? (
              <ApplicationRowsSkeleton />
            ) : applications.length === 0 ? (
              search ? (
                <EmptyState
                  icon={SearchX}
                  title="No applications match that username"
                  actions={
                    <Button size="sm" variant="outline" className={outlineDark} onClick={() => setSearchInput("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : !hasAnyApplications ? (
                <EmptyState
                  icon={Inbox}
                  title="No applications yet"
                  description="Share the campaign link so creators can find it and apply."
                  actions={
                    <Button size="sm" onClick={copyCampaignLink}>
                      <Link2 className="mr-1.5 h-4 w-4" /> Copy campaign link
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title={`No ${APPLICATION_STATUS_LABELS[status].toLowerCase()} applications`}
                />
              )
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-white/10">
                {applications.map((a, i) => {
                  const pending = inFlight.has(a.id);
                  return (
                    <li
                      key={a.id}
                      aria-busy={pending}
                      className={cn(
                        "flex flex-col gap-3 px-4 py-3 transition-opacity duration-300 sm:flex-row sm:items-center",
                        pending && "pointer-events-none opacity-40",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                        <Checkbox
                          className="mt-2.5 sm:mt-0"
                          aria-label={`Select @${a.username ?? "creator"}`}
                          checked={selected.has(a.id)}
                          disabled={!canApprove(a) && !canReject(a)}
                          onCheckedChange={() => toggleSelected(a)}
                        />
                        <button
                          type="button"
                          aria-label={`Review @${a.username ?? "creator"}'s application`}
                          className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] sm:items-center"
                          onClick={() => setReviewIndex(i)}
                        >
                          <CreatorAvatar
                            username={a.username}
                            fullName={a.full_name}
                            src={a.profile_picture_url}
                          />
                          <span className="min-w-0 flex-1 space-y-0.5">
                            <span className="block truncate font-medium text-gray-900 hover:text-[#7F39EC] dark:text-white dark:hover:text-purple-300">
                              @{a.username ?? "unknown"}
                              {a.full_name && (
                                <span className="font-normal text-gray-500 dark:text-gray-400">
                                  {" "}
                                  · {a.full_name}
                                </span>
                              )}
                            </span>
                            {renderPreview(a)}
                          </span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-7 sm:contents">
                        <span className="text-xs text-gray-500 dark:text-gray-400 sm:w-28 sm:text-sm sm:text-gray-600 sm:dark:text-gray-300">
                          <RelativeTime value={a.created_at} />
                        </span>
                        <span className="sm:w-32">{renderStatus(a)}</span>
                      </div>
                      {(canApprove(a) || canReject(a)) && (
                        <div className="grid grid-cols-2 gap-2 pl-7 sm:flex sm:w-48 sm:justify-end sm:pl-0">
                          {canReject(a) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={outlineDark}
                              disabled={busy}
                              onClick={() => setRejectTargets([a])}
                            >
                              Reject
                            </Button>
                          )}
                          {canApprove(a) && (
                            <Button
                              size="sm"
                              variant={needsReapprove(a) ? "outline" : "default"}
                              className={cn(
                                needsReapprove(a) ? cn("col-span-2", outlineDark) : "bg-[#7F39EC] hover:bg-[#7F39EC]/90",
                              )}
                              disabled={busy}
                              onClick={() => review([a], "approve")}
                            >
                              {pending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : needsReapprove(a) ? (
                                "Re-approve"
                              ) : (
                                "Approve"
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-gray-600 dark:text-gray-300">
            Page {page} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {selectedApps.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-lg border border-purple-200 bg-white p-3 text-sm shadow-lg dark:border-[#7F39EC]/40 dark:bg-[#170337] dark:text-gray-100"
        >
          <span className="font-medium">{selectedApps.length} selected</span>
          <Button
            size="sm"
            variant="ghost"
            className="dark:text-gray-300 dark:hover:bg-white/10"
            onClick={() => setSelected(new Map())}
          >
            Clear
          </Button>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className={outlineDark}
              disabled={busy || !selectedApps.some(canReject)}
              onClick={() => setRejectTargets(selectedApps.filter(canReject))}
            >
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button
              size="sm"
              className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
              disabled={busy || !selectedApps.some(canApprove)}
              onClick={approveSelected}
            >
              <Check className="mr-1 h-4 w-4" /> Approve
            </Button>
          </div>
        </div>
      )}

      <ApplicationReviewDrawer
        applications={applications}
        index={reviewIndex}
        onIndexChange={setReviewIndex}
        canApprove={canApprove}
        canReject={canReject}
        onApprove={(app) => {
          review([app], "approve");
        }}
        onReject={(app) => setRejectTargets([app])}
        busy={busy}
        shortcutsEnabled={!rejectTargets && !approveTargets}
        isDark={isDark}
      />

      <RejectApplicationsDialog
        count={rejectTargets?.length ?? 0}
        name={rejectTargets?.length === 1 ? `@${rejectTargets[0].username ?? "creator"}` : undefined}
        busy={busy}
        isDark={isDark}
        onCancel={() => setRejectTargets(null)}
        onConfirm={async (reason) => {
          if (rejectTargets && (await review(rejectTargets, "reject", reason))) setRejectTargets(null);
        }}
      />

      <AlertDialog open={!!approveTargets} onOpenChange={(o) => !o && setApproveTargets(null)}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {approveTargets?.length} creators?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;re added to the access list, can see the full campaign and submit, and each
              gets a notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark} disabled={busy}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (approveTargets && (await review(approveTargets, "approve"))) setApproveTargets(null);
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve {approveTargets?.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
